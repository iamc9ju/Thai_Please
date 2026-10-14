"""Pinned R source adapter; retain entire observed baskets or reject them."""

import hashlib
import importlib
import sys
from collections import Counter
from dataclasses import dataclass
from datetime import datetime
from decimal import Decimal
from pathlib import Path

from .purchase_match import Basket, BasketItem, require_utc


@dataclass(frozen=True)
class RejectedBasket:
    household_key: str
    basket_key: str
    at: datetime
    reasons: tuple[str, ...]


@dataclass(frozen=True)
class ObservedHistory:
    baskets: tuple[Basket, ...]
    rejected: tuple[RejectedBasket, ...]
    observation_start: datetime
    observation_end: datetime
    gaps: tuple[tuple[datetime, datetime], ...]
    provenance: dict
    cleaning: dict


def parse_utc(value: str) -> datetime:
    result = datetime.fromisoformat(value.replace("Z", "+00:00"))
    require_utc(result)
    return result


def load_settings(data: dict) -> dict:
    required = {
        "dataset_version", "seed", "households", "cutoffs_utc", "currency", "currency_scale",
        "amount_basis", "category_level", "observation_start_utc", "observation_end_utc", "known_gaps_utc",
        "excluded_departments", "money_noise_tolerance_cents", "source_commit", "source_sha256",
    }
    if set(data) != required:
        raise ValueError("unexpected/missing preparation settings")
    if data["currency"] != "USD" or data["currency_scale"] != 2 or data["amount_basis"] != "SOURCE_SALES_VALUE":
        raise ValueError("adapter only supports the audited source amount basis")
    if data["category_level"] not in ("department", "product_category"):
        raise ValueError("unsupported source category level")
    if not isinstance(data["dataset_version"], str) or not data["dataset_version"]:
        raise ValueError("dataset version required")
    if type(data["seed"]) is not int or type(data["households"]) is not int or data["households"] <= 0:
        raise ValueError("invalid sampling settings")
    start, end = parse_utc(data["observation_start_utc"]), parse_utc(data["observation_end_utc"])
    if start >= end:
        raise ValueError("invalid observation bounds")
    cutoffs = tuple(parse_utc(value) for value in data["cutoffs_utc"])
    if not cutoffs or len(set(cutoffs)) != len(cutoffs) or tuple(sorted(cutoffs)) != cutoffs:
        raise ValueError("cutoffs must be unique and chronological")
    for gap in data["known_gaps_utc"]:
        if len(gap) != 2 or not start <= parse_utc(gap[0]) < parse_utc(gap[1]) <= end:
            raise ValueError("invalid known observation gap")
    tolerance = Decimal(data["money_noise_tolerance_cents"])
    if not tolerance.is_finite() or not 0 < tolerance < 1:
        raise ValueError("invalid money precision tolerance")
    if not isinstance(data["excluded_departments"], list) or any(not isinstance(value, str) or not value for value in data["excluded_departments"]):
        raise ValueError("invalid excluded departments")
    if set(data["source_sha256"]) != {"transactions.rds", "products.rda"}:
        raise ValueError("pinned source hashes required")
    if any(not isinstance(value, str) or len(value) != 64 or any(char not in "0123456789abcdef" for char in value) for value in data["source_sha256"].values()):
        raise ValueError("invalid source hash")
    return data


def normalize_frames(transactions, products, settings: dict, provenance: dict) -> ObservedHistory:
    import numpy as np
    import pandas as pd

    transaction_fields = {"household_id", "store_id", "basket_id", "product_id", "quantity", "sales_value", "retail_disc", "coupon_disc", "coupon_match_disc", "week", "transaction_timestamp"}
    product_fields = {"product_id", "manufacturer_id", "department", "brand", "product_category", "product_type", "package_size"}
    if set(transactions.columns) != transaction_fields or set(products.columns) != product_fields:
        raise ValueError("source columns differ from audited contract")
    if products.product_id.isna().any() or products.product_id.duplicated().any():
        raise ValueError("product metadata has missing/duplicate IDs")
    keys = ["household_id", "store_id", "basket_id", "product_id", "transaction_timestamp"]
    if transactions[keys].isna().any().any():
        raise ValueError("source has missing identity/timestamp")
    if str(transactions.transaction_timestamp.dt.tz) != "UTC":
        raise ValueError("source reader must preserve explicit UTC")
    if transactions.duplicated(["basket_id", "product_id"]).any():
        raise ValueError("ambiguous duplicate basket/product rows")
    consistency = transactions.groupby("basket_id")[["household_id", "store_id", "transaction_timestamp"]].nunique()
    if (consistency != 1).any().any():
        raise ValueError("basket identity/ownership/time is inconsistent")
    start, end = parse_utc(settings["observation_start_utc"]), parse_utc(settings["observation_end_utc"])
    if ((transactions.transaction_timestamp < start) | (transactions.transaction_timestamp >= end)).any():
        raise ValueError("transaction outside declared observation bounds")
    joined = transactions.merge(products[["product_id", "department", "product_category"]], on="product_id", how="left", validate="many_to_one")
    joined["target_category"] = joined[settings["category_level"]]
    rounded = []
    max_noise = Decimal(0)
    tolerance = Decimal(settings["money_noise_tolerance_cents"])
    for value in joined.sales_value:
        amount = Decimal(str(value))
        if not amount.is_finite():
            raise ValueError("non-finite source sales value")
        cents = amount * (10 ** settings["currency_scale"])
        nearest = cents.to_integral_value()
        deviation = abs(cents - nearest)
        max_noise = max(max_noise, deviation)
        if deviation >= tolerance:
            raise ValueError("source sales value exceeds minor-unit precision tolerance")
        rounded.append(int(nearest))
    joined["sales_minor"] = np.array(rounded, dtype=np.int64)
    invalid = {
        "nonpositive_or_fractional_quantity": joined.quantity.isna() | ~np.isfinite(joined.quantity) | (joined.quantity <= 0) | (joined.quantity % 1 != 0),
        "negative_sales": joined.sales_minor < 0,
        "missing_selected_category": joined.target_category.isna(),
        "excluded_department": joined.department.isin(settings["excluded_departments"]),
    }
    reasons: dict[str, set[str]] = {}
    invalid_line_counts = {}
    for reason, mask in invalid.items():
        invalid_line_counts[reason] = int(mask.sum())
        for key in joined.loc[mask, "basket_id"].unique():
            reasons.setdefault(str(key), set()).add(reason)
    totals = joined.groupby("basket_id").sales_minor.sum()
    for key in totals[totals <= 0].index:
        reasons.setdefault(str(key), set()).add("nonpositive_basket_total")
    baskets = []
    rejected = []
    # Sort once and stream groups; creating/sorting 155k tiny DataFrames is costly.
    ordered = joined.sort_values(["basket_id", "product_id"])
    current = None
    items = []

    def finish(first, lines) -> None:
        key = str(first.basket_id)
        at = first.transaction_timestamp.to_pydatetime()
        household, store = str(first.household_id), str(first.store_id)
        if key in reasons:
            rejected.append(RejectedBasket(household, key, at, tuple(sorted(reasons[key]))))
        else:
            baskets.append(Basket(key, household, store, at, tuple(lines)))

    for row in ordered.itertuples(index=False):
        if current is None or row.basket_id != current.basket_id:
            if current is not None:
                finish(current, items)
            current, items = row, []
        if str(row.basket_id) not in reasons:
            items.append(BasketItem(str(row.product_id), str(row.target_category), int(row.quantity), int(row.sales_minor)))
    if current is not None:
        finish(current, items)
    accepted_lines = sum(len(basket.items) for basket in baskets)
    rejected_lines = len(transactions) - accepted_lines
    assert len(baskets) + len(rejected) == len(totals)
    return ObservedHistory(
        tuple(sorted(baskets, key=lambda basket: (basket.at, basket.basket_key))),
        tuple(sorted(rejected, key=lambda basket: (basket.at, basket.basket_key))), start, end,
        tuple((parse_utc(gap[0]), parse_utc(gap[1])) for gap in settings["known_gaps_utc"]), provenance,
        {"raw_lines": len(transactions), "raw_baskets": len(totals), "accepted_lines": accepted_lines,
         "rejected_lines": rejected_lines, "accepted_baskets": len(baskets), "rejected_baskets": len(rejected),
         "invalid_line_counts": invalid_line_counts,
         "rejected_basket_reasons": dict(Counter(reason for rejected_basket in rejected for reason in rejected_basket.reasons)),
         "max_binary_source_noise_cents": str(max_noise), "strategy": "REJECT_WHOLE_BASKET_AND_CENSOR_AFFECTED_WINDOWS"},
    )


def read_source(source: Path, reader: Path | None, settings: dict) -> ObservedHistory:
    hashes = {}
    for name, expected in settings["source_sha256"].items():
        digest = hashlib.sha256((source / name).read_bytes()).hexdigest()
        if digest != expected:
            raise ValueError(f"source file hash mismatch: {name}")
        hashes[name] = digest
    if reader is not None:
        sys.path.insert(0, str(reader.resolve()))
    try:
        pyreadr = importlib.import_module("pyreadr")
    except ImportError as error:
        raise RuntimeError("R reader unavailable; use the documented compatible audit runtime/reader") from error
    transactions = pyreadr.read_r(str(source / "transactions.rds"), timezone="UTC")[None]
    products = pyreadr.read_r(str(source / "products.rda"))["products"]
    return normalize_frames(transactions, products, settings, {
        "repository": "https://github.com/bradleyboehmke/completejourney",
        "commit": settings["source_commit"], "files_sha256": hashes, "reader_version": pyreadr.__version__,
        "source_amount_basis": settings["amount_basis"], "currency": settings["currency"],
        "category_level": settings["category_level"],
        "currency_scale": settings["currency_scale"],
    })
