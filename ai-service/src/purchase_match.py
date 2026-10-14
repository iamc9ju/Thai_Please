"""Currency-independent candidate features and retrospective one-basket labels.

This module has no source-reader, model, database or financial mutation dependency.
"""

import hashlib
import random
from dataclasses import dataclass
from datetime import datetime, timedelta
from decimal import Decimal, ROUND_CEILING, ROUND_HALF_EVEN, localcontext
from enum import StrEnum


class TemplateType(StrEnum):
    MIN_SPEND = "MIN_SPEND"
    CATEGORY_SPEND = "CATEGORY_SPEND"
    PRODUCT_PURCHASE = "PRODUCT_PURCHASE"
    MERCHANT_SPEND = "MERCHANT_SPEND"


FEATURE_VERSION = "purchase-match-features-v2"
LABEL_VERSION = "observed-single-basket-match-v1"
FEATURE_COLUMNS = (
    "purchases_7d", "purchases_30d", "target_category_purchases_30d",
    "target_merchant_purchases_30d", "target_product_purchases_30d",
    "quest_type", "min_spend_ratio", "duration_days",
)


def require_utc(value: datetime) -> None:
    if value.utcoffset() != timedelta(0):
        raise ValueError("timestamp must be timezone-aware UTC")


@dataclass(frozen=True)
class BasketItem:
    product_key: str
    category_key: str
    quantity: int
    sales_minor: int

    def __post_init__(self) -> None:
        if not self.product_key or not self.category_key:
            raise ValueError("item needs product/category identity")
        if type(self.quantity) is not int or self.quantity <= 0:
            raise ValueError("item quantity must be a positive integer")
        if type(self.sales_minor) is not int or self.sales_minor < 0:
            raise ValueError("item sales must be nonnegative integer minor units")


@dataclass(frozen=True)
class Basket:
    basket_key: str
    household_key: str
    store_key: str
    at: datetime
    items: tuple[BasketItem, ...]

    def __post_init__(self) -> None:
        require_utc(self.at)
        if not self.basket_key or not self.household_key or not self.store_key or not self.items:
            raise ValueError("basket needs identity and items")
        if self.total_minor <= 0:
            raise ValueError("observed purchase needs a positive basket total")
        if len({item.product_key for item in self.items}) != len(self.items):
            raise ValueError("duplicate product lines need explicit consolidation")

    @property
    def total_minor(self) -> int:
        return sum(item.sales_minor for item in self.items)


@dataclass(frozen=True)
class Candidate:
    kind: TemplateType
    duration_days: int
    min_spend_minor: int | None
    configured_multiplier: str | None
    category_key: str | None = None
    store_key: str | None = None
    product_key: str | None = None

    def __post_init__(self) -> None:
        if not isinstance(self.kind, TemplateType) or type(self.duration_days) is not int or self.duration_days <= 0:
            raise ValueError("invalid candidate type/duration")
        targets = (self.category_key, self.store_key, self.product_key)
        expected = {
            TemplateType.MIN_SPEND: (None, None, None),
            TemplateType.CATEGORY_SPEND: (self.category_key, None, None),
            TemplateType.MERCHANT_SPEND: (None, self.store_key, None),
            TemplateType.PRODUCT_PURCHASE: (None, None, self.product_key),
        }[self.kind]
        if targets != expected or (self.kind != TemplateType.MIN_SPEND and not any(targets)):
            raise ValueError("candidate has missing/mixed targets")
        if any(value == "" for value in targets):
            raise ValueError("empty target is invalid")
        if self.kind == TemplateType.PRODUCT_PURCHASE:
            if self.min_spend_minor is not None or self.configured_multiplier is not None:
                raise ValueError("product-only candidate must omit spend")
        else:
            if type(self.min_spend_minor) is not int or self.min_spend_minor <= 0:
                raise ValueError("spend threshold must be positive integer minor units")
            if self.configured_multiplier is None or not Decimal(self.configured_multiplier).is_finite() or Decimal(self.configured_multiplier) <= 0:
                raise ValueError("spend candidate needs positive multiplier")


@dataclass(frozen=True)
class TemplatePolicy:
    schema_version: str
    policy_version: str
    scope: str
    quest_types: tuple[TemplateType, ...]
    spend_multipliers: tuple[str, ...]
    duration_days: tuple[int, ...]
    history_days: int
    short_history_days: int
    feature_decimal_places: int
    target_history_selection_percent: int
    product_requires_spend: bool
    threshold_rounding: str

    @classmethod
    def from_dict(cls, data: dict) -> "TemplatePolicy":
        if set(data) != set(cls.__dataclass_fields__):
            raise ValueError("unexpected/missing template policy fields")
        if data["schema_version"] != "quest-template-policy-v2" or data["scope"] != "OFFLINE_EXPERIMENT":
            raise ValueError("unsupported template policy schema/scope")
        if data["product_requires_spend"] is not False or data["threshold_rounding"] != "CEILING_MINOR_UNIT":
            raise ValueError("unsupported product/spend policy")
        kinds = tuple(TemplateType(value) for value in data["quest_types"])
        if len(kinds) != len(TemplateType) or set(kinds) != set(TemplateType):
            raise ValueError("policy must list each supported type once")
        ratios = tuple(data["spend_multipliers"])
        if not ratios or any(not isinstance(value, str) or not Decimal(value).is_finite() or Decimal(value) <= 0 for value in ratios):
            raise ValueError("invalid spend multipliers")
        if len(set(ratios)) != len(ratios):
            raise ValueError("duplicate spend multipliers")
        durations = tuple(data["duration_days"])
        if not durations or any(type(value) is not int or value <= 0 for value in durations):
            raise ValueError("invalid durations")
        for field in ("history_days", "short_history_days", "feature_decimal_places", "target_history_selection_percent"):
            if type(data[field]) is not int:
                raise ValueError("policy integer field has invalid type")
        if (data["history_days"], data["short_history_days"]) != (30, 7):
            raise ValueError("feature contract requires 7/30 day windows")
        if not 0 <= data["feature_decimal_places"] <= 12 or not 0 <= data["target_history_selection_percent"] <= 100:
            raise ValueError("policy precision/selection percentage outside bounds")
        if not isinstance(data["policy_version"], str) or not data["policy_version"]:
            raise ValueError("policy version required")
        return cls(**(data | {"quest_types": kinds, "spend_multipliers": ratios, "duration_days": durations}))


def recent_history(baskets: tuple[Basket, ...], household: str, cutoff: datetime, days: int) -> tuple[Basket, ...]:
    require_utc(cutoff)
    return tuple(basket for basket in baskets if basket.household_key == household and cutoff - timedelta(days=days) <= basket.at < cutoff)


def threshold_minor(total_minor: int, purchases: int, multiplier: str) -> int:
    if total_minor <= 0 or purchases <= 0:
        raise ValueError("relative spend requires positive historical average")
    ratio = Decimal(multiplier)
    if not ratio.is_finite() or ratio <= 0:
        raise ValueError("invalid multiplier")
    with localcontext() as context:
        context.prec = 40
        return int((Decimal(total_minor) * ratio / purchases).to_integral_value(rounding=ROUND_CEILING))


def validate_candidate(candidate: Candidate, policy: TemplatePolicy, recent: tuple[Basket, ...]) -> None:
    if candidate.kind not in policy.quest_types or candidate.duration_days not in policy.duration_days:
        raise ValueError("candidate outside policy")
    if candidate.kind != TemplateType.PRODUCT_PURCHASE:
        if candidate.configured_multiplier not in policy.spend_multipliers:
            raise ValueError("candidate multiplier outside policy")
        expected = threshold_minor(sum(basket.total_minor for basket in recent), len(recent), candidate.configured_multiplier)
        if candidate.min_spend_minor != expected:
            raise ValueError("candidate threshold differs from historical-average policy")


def candidate_features(recent: tuple[Basket, ...], cutoff: datetime, candidate: Candidate, policy: TemplatePolicy) -> dict[str, int | str | None]:
    require_utc(cutoff)
    if any(not cutoff - timedelta(days=policy.history_days) <= basket.at < cutoff for basket in recent):
        raise ValueError("features contain out-of-window/future purchases")
    if len({basket.household_key for basket in recent}) > 1:
        raise ValueError("features mix household histories")
    validate_candidate(candidate, policy, recent)
    total = sum(basket.total_minor for basket in recent)
    ratio = None
    if candidate.min_spend_minor is not None:
        with localcontext() as context:
            context.prec = 40
            ratio = format((Decimal(candidate.min_spend_minor) * len(recent) / total).quantize(Decimal(1).scaleb(-policy.feature_decimal_places), rounding=ROUND_HALF_EVEN), "f")
    features = {
        "purchases_7d": sum(basket.at >= cutoff - timedelta(days=policy.short_history_days) for basket in recent),
        "purchases_30d": len(recent),
        "target_category_purchases_30d": sum(any(item.category_key == candidate.category_key for item in basket.items) for basket in recent) if candidate.category_key is not None else None,
        "target_merchant_purchases_30d": sum(basket.store_key == candidate.store_key for basket in recent) if candidate.store_key is not None else None,
        "target_product_purchases_30d": sum(any(item.product_key == candidate.product_key for item in basket.items) for basket in recent) if candidate.product_key is not None else None,
        "quest_type": candidate.kind.value,
        "min_spend_ratio": ratio,
        "duration_days": candidate.duration_days,
    }
    if tuple(features) != FEATURE_COLUMNS:
        raise ValueError("features differ from v2 schema")
    return features


def matches(basket: Basket, candidate: Candidate) -> bool:
    if candidate.kind == TemplateType.PRODUCT_PURCHASE:
        return any(item.product_key == candidate.product_key for item in basket.items)
    if candidate.kind == TemplateType.CATEGORY_SPEND:
        amount = sum(item.sales_minor for item in basket.items if item.category_key == candidate.category_key)
    elif candidate.kind == TemplateType.MERCHANT_SPEND:
        if basket.store_key != candidate.store_key:
            return False
        amount = basket.total_minor
    else:
        amount = basket.total_minor
    return candidate.min_spend_minor is not None and amount >= candidate.min_spend_minor


def label_for(baskets: tuple[Basket, ...], household: str, cutoff: datetime, candidate: Candidate,
              observation_start: datetime, observation_end: datetime,
              gaps: tuple[tuple[datetime, datetime], ...], invalid_times: tuple[datetime, ...]) -> tuple[int | None, str | None, str | None]:
    for value in (cutoff, observation_start, observation_end, *invalid_times):
        require_utc(value)
    expires = cutoff + timedelta(days=candidate.duration_days)
    if cutoff < observation_start or expires > observation_end:
        return None, None, "outside_observation"
    for start, end in gaps:
        require_utc(start)
        require_utc(end)
        if start >= end:
            raise ValueError("invalid observation gap")
        if start < expires and end > cutoff:
            return None, None, "known_observation_gap"
    if any(cutoff <= at < expires for at in invalid_times):
        return None, None, "rejected_future_basket"
    future = sorted((basket for basket in baskets if basket.household_key == household and cutoff <= basket.at < expires), key=lambda basket: (basket.at, basket.basket_key))
    proof = next((basket.basket_key for basket in future if matches(basket, candidate)), None)
    return int(proof is not None), proof, None


@dataclass(frozen=True)
class CatalogBefore:
    cutoff: datetime
    categories: tuple[str, ...]
    stores: tuple[str, ...]
    products: tuple[str, ...]


def catalog_before(baskets: tuple[Basket, ...], cutoff: datetime) -> CatalogBefore:
    require_utc(cutoff)
    past = tuple(basket for basket in baskets if basket.at < cutoff)
    return CatalogBefore(cutoff,
                         tuple(sorted({item.category_key for basket in past for item in basket.items})),
                         tuple(sorted({basket.store_key for basket in past})),
                         tuple(sorted({item.product_key for basket in past for item in basket.items})))


def make_candidates(baskets: tuple[Basket, ...], household: str, cutoff: datetime, policy: TemplatePolicy, seed: int,
                    catalog: CatalogBefore | None = None) -> tuple[Candidate, ...]:
    recent = recent_history(baskets, household, cutoff, policy.history_days)
    if not recent:
        return ()
    # Target pools contain only products/stores observed before cutoff.
    available = catalog if catalog is not None else catalog_before(baskets, cutoff)
    if available.cutoff != cutoff:
        raise ValueError("catalog cutoff does not match candidate cutoff")
    if not available.products or not available.categories or not available.stores:
        return ()
    salt = hashlib.sha256(f"{seed}|{household}|{cutoff.isoformat()}|{policy.policy_version}".encode()).digest()
    rng = random.Random(int.from_bytes(salt, "big"))
    result = []
    for kind in policy.quest_types:
        use_history = rng.randrange(100) < policy.target_history_selection_percent
        category = store = product = None
        if kind == TemplateType.CATEGORY_SPEND:
            pool = sorted({item.category_key for basket in recent for item in basket.items}) if use_history else available.categories
            category = rng.choice(pool)
        elif kind == TemplateType.MERCHANT_SPEND:
            pool = sorted({basket.store_key for basket in recent}) if use_history else available.stores
            store = rng.choice(pool)
        elif kind == TemplateType.PRODUCT_PURCHASE:
            pool = sorted({item.product_key for basket in recent for item in basket.items}) if use_history else available.products
            product = rng.choice(pool)
        multiplier = None if kind == TemplateType.PRODUCT_PURCHASE else rng.choice(policy.spend_multipliers)
        threshold = threshold_minor(sum(basket.total_minor for basket in recent), len(recent), multiplier) if multiplier is not None else None
        candidate = Candidate(kind, rng.choice(policy.duration_days), threshold, multiplier, category, store, product)
        validate_candidate(candidate, policy, recent)
        result.append(candidate)
    return tuple(result)
