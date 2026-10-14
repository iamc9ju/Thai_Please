"""Point-in-time feature extraction from validated immutable synthetic facts."""

from datetime import timedelta
from decimal import Decimal, ROUND_HALF_EVEN, localcontext

from .data_contract import Assignment, FEATURE_COLUMNS, FEATURE_PRECISION, History, OrderStatus, Outcome

FeatureValue = int | str | None
FeatureMap = dict[str, FeatureValue]


def derived_decimal(value: Decimal) -> str:
    with localcontext() as context:
        context.prec = 40
        return format(value.quantize(Decimal(1).scaleb(-FEATURE_PRECISION), rounding=ROUND_HALF_EVEN), "f")


def money_text(minor: int, scale: int) -> str:
    return format(Decimal(minor).scaleb(-scale), f".{scale}f")


def rate(successes: int, finalized: int) -> str | None:
    return derived_decimal(Decimal(successes) / finalized) if finalized else None


def calculate_features(history: History, assignment: Assignment) -> FeatureMap:
    cutoff = assignment.feature_as_of
    quest = assignment.quest
    recent = [order for order in history.orders if (
        order.user_key == assignment.user_key and order.status == OrderStatus.PAID
        and order.paid_at is not None and cutoff - timedelta(days=30) <= order.paid_at < cutoff
    )]
    seven = sum(order.paid_at is not None and order.paid_at >= cutoff - timedelta(days=7) for order in recent)
    total_minor = sum(order.final_minor for order in recent)
    total = Decimal(total_minor).scaleb(-history.config.currency_scale)
    average = total / len(recent) if recent else None
    previous = [prior for prior in history.assignments if prior.user_key == assignment.user_key and prior.assigned_at < cutoff]
    finalized = [prior for prior in previous if prior.outcome_known_at is not None and prior.outcome_known_at < cutoff and prior.status in (Outcome.COMPLETED, Outcome.EXPIRED)]
    completed = sum(prior.status == Outcome.COMPLETED for prior in finalized)
    expired = sum(prior.status == Outcome.EXPIRED for prior in finalized)
    similar = [prior for prior in finalized if prior.quest.quest_type == quest.quest_type]
    threshold = Decimal(quest.min_spend_minor).scaleb(-history.config.currency_scale) if quest.min_spend_minor is not None else None
    result: FeatureMap = {
        "purchases_7d": seven,
        "purchases_30d": len(recent),
        "avg_order_value_30d": derived_decimal(average) if average is not None else None,
        "total_spend_30d": money_text(total_minor, history.config.currency_scale),
        "target_category_purchases_30d": sum(any(item.category_key == quest.target_category_id for item in order.items) for order in recent) if quest.target_category_id is not None else None,
        "target_merchant_purchases_30d": sum(order.merchant_key == quest.target_merchant_id for order in recent) if quest.target_merchant_id is not None else None,
        "target_product_purchases_30d": sum(any(item.product_key == quest.target_product_id for item in order.items) for order in recent) if quest.target_product_id is not None else None,
        "quests_assigned_before": len(previous),
        "quests_completed_before": completed,
        "quests_expired_before": expired,
        "quest_completion_rate": rate(completed, completed + expired),
        "same_type_completion_rate": rate(sum(prior.status == Outcome.COMPLETED for prior in similar), len(similar)),
        "quest_type": quest.quest_type.value,
        "min_spend": money_text(quest.min_spend_minor, history.config.currency_scale) if quest.min_spend_minor is not None else None,
        "reward_point": quest.reward_point,
        "duration_days": quest.duration_days,
        "target_category_id": quest.target_category_id,
        "target_merchant_id": quest.target_merchant_id,
        "target_product_id": quest.target_product_id,
        "spend_gap_vs_avg_30d": derived_decimal(threshold - average) if threshold is not None and average is not None else None,
    }
    if tuple(result) != FEATURE_COLUMNS:
        raise ValueError("feature order does not match contract")
    return result
