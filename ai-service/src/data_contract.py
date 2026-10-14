"""Versioned offline contract matching docs/ai/DATASET_SCHEMA.md."""

from datetime import datetime, timedelta
from enum import StrEnum
from typing import Self

from pydantic import BaseModel, ConfigDict, Field, model_validator

DATA_ORIGIN = "SYNTHETIC"
DATASET_VERSION = "synthetic-v1"
FEATURE_VERSION = "features-v1"
RULE_VERSION = "single-order-category-allocation-v1"
FEATURE_PRECISION = 6
NO_TARGET = "__NO_TARGET__"
FEATURE_COLUMNS = (
    "purchases_7d", "purchases_30d", "avg_order_value_30d", "total_spend_30d",
    "target_category_purchases_30d", "target_merchant_purchases_30d",
    "target_product_purchases_30d", "quests_assigned_before",
    "quests_completed_before", "quests_expired_before", "quest_completion_rate",
    "same_type_completion_rate", "quest_type", "min_spend", "reward_point",
    "duration_days", "target_category_id", "target_merchant_id",
    "target_product_id", "spend_gap_vs_avg_30d",
)
METADATA_COLUMNS = (
    "assignment_key", "user_key", "quest_key", "assigned_at", "feature_as_of",
    "expires_at", "outcome_known_at", "completed_order_key", "completed",
    "data_origin", "dataset_version", "feature_schema_version", "rule_version", "currency",
)


class QuestType(StrEnum):
    MIN_SPEND = "MIN_SPEND"
    CATEGORY_SPEND = "CATEGORY_SPEND"
    PRODUCT_PURCHASE = "PRODUCT_PURCHASE"
    MERCHANT_SPEND = "MERCHANT_SPEND"


class Outcome(StrEnum):
    ACTIVE = "ACTIVE"
    COMPLETED = "COMPLETED"
    EXPIRED = "EXPIRED"


class OrderStatus(StrEnum):
    PAID = "PAID"
    PENDING = "PENDING"


class Record(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True, frozen=True)

    @model_validator(mode="after")
    def utc_dates(self) -> Self:
        for name in type(self).model_fields:
            value = getattr(self, name)
            if isinstance(value, datetime) and value.utcoffset() != timedelta(0):
                raise ValueError(f"{name} must be timezone-aware UTC")
        return self


class User(Record):
    user_key: str = Field(min_length=1)
    created_at: datetime


class Merchant(Record):
    merchant_key: str = Field(min_length=1)


class Category(Record):
    category_key: str = Field(min_length=1)


class Product(Record):
    product_key: str = Field(min_length=1)
    merchant_key: str
    category_key: str
    unit_price_minor: int = Field(gt=0)


class Item(Record):
    item_key: str = Field(min_length=1)
    product_key: str
    category_key: str
    product_name_snapshot: str
    unit_price_minor: int = Field(ge=0)
    quantity: int = Field(gt=0)
    line_total_minor: int = Field(ge=0)
    discount_eligible: bool

    @model_validator(mode="after")
    def totals(self) -> Self:
        if self.line_total_minor != self.unit_price_minor * self.quantity:
            raise ValueError("item total does not match quantity and price")
        return self


class Order(Record):
    order_key: str = Field(min_length=1)
    user_key: str
    merchant_key: str
    status: OrderStatus
    created_at: datetime
    paid_at: datetime | None
    items: tuple[Item, ...] = Field(min_length=1)
    subtotal_minor: int = Field(ge=0)
    discount_minor: int = Field(ge=0)
    final_minor: int = Field(ge=0)
    subsidy_minor: int = Field(ge=0)
    personal_minor: int = Field(ge=0)

    @model_validator(mode="after")
    def consistency(self) -> Self:
        if self.subtotal_minor != sum(item.line_total_minor for item in self.items):
            raise ValueError("subtotal differs from item snapshots")
        eligible = sum(item.line_total_minor for item in self.items if item.discount_eligible)
        if self.discount_minor > eligible or self.final_minor != self.subtotal_minor - self.discount_minor:
            raise ValueError("invalid discount/final amount")
        if self.personal_minor + self.subsidy_minor != self.final_minor:
            raise ValueError("payment funding does not match final amount")
        if len({item.item_key for item in self.items}) != len(self.items):
            raise ValueError("duplicate item keys")
        if (self.status == OrderStatus.PAID) != (self.paid_at is not None):
            raise ValueError("paid status requires paid_at; pending forbids it")
        if self.paid_at is not None and self.paid_at < self.created_at:
            raise ValueError("paid before order creation")
        return self


class Quest(Record):
    quest_key: str = Field(min_length=1)
    quest_type: QuestType
    min_spend_minor: int | None = Field(default=None, ge=0)
    reward_point: int = Field(ge=0)
    duration_days: int = Field(gt=0)
    target_category_id: str | None = None
    target_merchant_id: str | None = None
    target_product_id: str | None = None

    @model_validator(mode="after")
    def rule_shape(self) -> Self:
        targets = {
            QuestType.MIN_SPEND: (None, None, None),
            QuestType.CATEGORY_SPEND: (self.target_category_id, None, None),
            QuestType.MERCHANT_SPEND: (None, self.target_merchant_id, None),
            QuestType.PRODUCT_PURCHASE: (None, None, self.target_product_id),
        }
        actual = (self.target_category_id, self.target_merchant_id, self.target_product_id)
        if actual != targets[self.quest_type]:
            raise ValueError("mixed targets are not supported in fixture v1")
        if self.quest_type != QuestType.MIN_SPEND and not any(actual):
            raise ValueError("quest target missing")
        if (self.quest_type == QuestType.PRODUCT_PURCHASE) != (self.min_spend_minor is None):
            raise ValueError("product-only quests omit min_spend; spend quests require it")
        return self


class Assignment(Record):
    assignment_key: str = Field(min_length=1)
    user_key: str
    quest: Quest
    assigned_at: datetime
    feature_as_of: datetime
    expires_at: datetime
    status: Outcome
    outcome_known_at: datetime | None
    completed_order_key: str | None

    @model_validator(mode="after")
    def validity(self) -> Self:
        if self.feature_as_of > self.assigned_at or self.expires_at <= self.assigned_at:
            raise ValueError("invalid feature cutoff or validity")
        if self.expires_at != self.assigned_at + timedelta(days=self.quest.duration_days):
            raise ValueError("duration differs from validity")
        if (self.status == Outcome.ACTIVE) != (self.outcome_known_at is None):
            raise ValueError("only finalized outcomes have known_at")
        if (self.status == Outcome.COMPLETED) != (self.completed_order_key is not None):
            raise ValueError("completed assignment requires one order proof")
        if self.outcome_known_at is not None and self.outcome_known_at < self.assigned_at:
            raise ValueError("outcome known before assignment")
        if self.status == Outcome.EXPIRED and self.outcome_known_at is not None and self.outcome_known_at < self.expires_at:
            raise ValueError("expiry finalized before validity ends")
        return self


class CatalogConfig(Record):
    merchants: tuple[Merchant, ...] = Field(min_length=1)
    categories: tuple[Category, ...] = Field(min_length=1)
    products: tuple[Product, ...] = Field(min_length=1)


class GeneratorConfig(Record):
    seed: int
    currency: str = Field(pattern=r"^[A-Z]{3}$")
    currency_scale: int = Field(ge=0, le=4)
    start_at: datetime
    history_days: int = Field(gt=0, le=366)
    users: int = Field(gt=0, le=1000)
    assignments_per_user: int = Field(gt=0, le=100)
    first_assignment_day: int = Field(ge=30)
    assignment_interval_days: int = Field(gt=0)
    duration_days: int = Field(gt=0)
    outcome_delay_seconds: int = Field(ge=0)
    purchase_chance_percent: tuple[int, ...] = Field(min_length=1)
    quantities: tuple[int, ...] = Field(min_length=1)
    discount_percent: tuple[int, ...] = Field(min_length=1)
    subsidy_percent: tuple[int, ...] = Field(min_length=1)
    min_spend_minor: tuple[int, ...] = Field(min_length=1)
    reward_points: tuple[int, ...] = Field(min_length=1)
    catalog: CatalogConfig

    @model_validator(mode="after")
    def ranges(self) -> Self:
        for values in (self.purchase_chance_percent, self.discount_percent, self.subsidy_percent):
            if any(value < 0 or value > 100 for value in values):
                raise ValueError("fixture percentages must be 0..100")
        if any(value <= 0 for value in self.quantities + self.min_spend_minor):
            raise ValueError("quantities/thresholds must be positive")
        if any(value < 0 for value in self.reward_points):
            raise ValueError("negative reward")
        if self.assignment_interval_days <= self.duration_days:
            raise ValueError("fixture avoids overlapping quest assignments")
        last_day = self.first_assignment_day + (self.assignments_per_user - 1) * self.assignment_interval_days
        if last_day >= self.history_days:
            raise ValueError("assignments must start before dataset cutoff")
        validate_catalog(self.catalog)
        return self


def unique_keys(records: tuple[Record, ...], field: str) -> set[str]:
    keys = [getattr(record, field) for record in records]
    if len(set(keys)) != len(keys) or NO_TARGET in keys:
        raise ValueError(f"duplicate/reserved {field}")
    return set(keys)


def validate_catalog(catalog: CatalogConfig) -> None:
    merchants = unique_keys(catalog.merchants, "merchant_key")
    categories = unique_keys(catalog.categories, "category_key")
    unique_keys(catalog.products, "product_key")
    for product in catalog.products:
        if product.merchant_key not in merchants or product.category_key not in categories:
            raise ValueError("dangling product catalog reference")
    if merchants != {product.merchant_key for product in catalog.products}:
        raise ValueError("every fixture merchant requires at least one product")


class History(Record):
    data_origin: str
    dataset_version: str
    feature_schema_version: str
    rule_version: str
    config: GeneratorConfig
    dataset_as_of: datetime
    users: tuple[User, ...]
    orders: tuple[Order, ...]
    assignments: tuple[Assignment, ...]

    @model_validator(mode="after")
    def references(self) -> Self:
        if (self.data_origin, self.dataset_version, self.feature_schema_version, self.rule_version) != (
            DATA_ORIGIN, DATASET_VERSION, FEATURE_VERSION, RULE_VERSION
        ):
            raise ValueError("unsupported provenance/version")
        if self.dataset_as_of != self.config.start_at + timedelta(days=self.config.history_days):
            raise ValueError("dataset cutoff differs from config")
        users = unique_keys(self.users, "user_key")
        unique_keys(self.orders, "order_key")
        unique_keys(self.assignments, "assignment_key")
        user_times = {user.user_key: user.created_at for user in self.users}
        products = {product.product_key: product for product in self.config.catalog.products}
        merchants = {merchant.merchant_key for merchant in self.config.catalog.merchants}
        categories = {category.category_key for category in self.config.catalog.categories}
        for order in self.orders:
            if order.user_key not in users or order.merchant_key not in merchants:
                raise ValueError("dangling order owner/merchant")
            if order.created_at < user_times[order.user_key] or order.created_at > self.dataset_as_of:
                raise ValueError("invalid order creation timeline")
            if order.paid_at is not None and order.paid_at > self.dataset_as_of:
                raise ValueError("future paid order in extracted history")
            for item in order.items:
                if item.product_key not in products or item.category_key not in categories:
                    raise ValueError("dangling item product/category")
                if products[item.product_key].merchant_key != order.merchant_key:
                    raise ValueError("cross-merchant order item")
        for assignment in self.assignments:
            quest = assignment.quest
            if assignment.user_key not in users:
                raise ValueError("dangling assignment owner")
            if not user_times[assignment.user_key] <= assignment.feature_as_of <= assignment.assigned_at <= self.dataset_as_of:
                raise ValueError("invalid assignment timeline")
            if assignment.outcome_known_at is not None and assignment.outcome_known_at > self.dataset_as_of:
                raise ValueError("future finalized outcome")
            for key, allowed in ((quest.target_category_id, categories), (quest.target_merchant_id, merchants), (quest.target_product_id, set(products))):
                if key is not None and key not in allowed:
                    raise ValueError("dangling quest target")
        return self
