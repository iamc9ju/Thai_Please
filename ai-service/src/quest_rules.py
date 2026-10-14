"""Offline labeling oracle, not a production payment/reward service."""

from datetime import datetime, timedelta

from .data_contract import Assignment, Order, OrderStatus, Outcome, QuestType


def allocate_discount(order: Order) -> dict[str, int]:
    """BR-QUEST-PRICING-01: exact largest remainder, snapshot order breaks ties."""
    eligible = [item for item in order.items if item.discount_eligible]
    base = sum(item.line_total_minor for item in eligible)
    allocated = {item.item_key: 0 for item in order.items}
    if base == 0:
        if order.discount_minor != 0:
            raise ValueError("nonzero discount without eligible base")
        return allocated
    remainders: list[tuple[int, int, str]] = []
    for index, item in enumerate(eligible):
        quotient, remainder = divmod(order.discount_minor * item.line_total_minor, base)
        allocated[item.item_key] = quotient
        remainders.append((-remainder, index, item.item_key))
    leftover = order.discount_minor - sum(allocated.values())
    for _, _, item_key in sorted(remainders)[:leftover]:
        allocated[item_key] += 1
    if sum(allocated.values()) != order.discount_minor:
        raise ValueError("discount allocation failed reconciliation")
    if any(allocated[item.item_key] > item.line_total_minor for item in order.items):
        raise ValueError("negative line payable")
    return allocated


def qualifies(assignment: Assignment, order: Order) -> bool:
    if order.status != OrderStatus.PAID or order.paid_at is None:
        return False
    if order.user_key != assignment.user_key or not assignment.assigned_at <= order.paid_at < assignment.expires_at:
        return False
    quest = assignment.quest
    if quest.quest_type == QuestType.PRODUCT_PURCHASE:
        return any(item.product_key == quest.target_product_id for item in order.items)
    threshold = quest.min_spend_minor
    if threshold is None:
        raise ValueError("spend quest missing threshold")
    if quest.quest_type == QuestType.MIN_SPEND:
        return order.final_minor >= threshold
    if quest.quest_type == QuestType.MERCHANT_SPEND:
        return order.merchant_key == quest.target_merchant_id and order.final_minor >= threshold
    if quest.quest_type == QuestType.CATEGORY_SPEND:
        discounts = allocate_discount(order)
        category_spend = sum(
            item.line_total_minor - discounts[item.item_key]
            for item in order.items if item.category_key == quest.target_category_id
        )
        return category_spend >= threshold
    raise ValueError("unsupported quest type")


def derive_outcome(
    assignment: Assignment, orders: tuple[Order, ...], as_of: datetime, delay_seconds: int
) -> Assignment:
    matches = sorted(
        (order for order in orders if qualifies(assignment, order)),
        key=lambda order: (order.paid_at, order.order_key),
    )
    status = Outcome.ACTIVE
    known_at: datetime | None = None
    proof: str | None = None
    if matches:
        paid_at = matches[0].paid_at
        if paid_at is None:
            raise ValueError("paid proof without timestamp")
        completion_known_at = paid_at + timedelta(seconds=delay_seconds)
        if completion_known_at <= as_of:
            status, known_at, proof = Outcome.COMPLETED, completion_known_at, matches[0].order_key
    elif assignment.expires_at + timedelta(seconds=delay_seconds) <= as_of:
        status = Outcome.EXPIRED
        known_at = assignment.expires_at + timedelta(seconds=delay_seconds)
    values = assignment.model_dump()
    values.update(status=status, outcome_known_at=known_at, completed_order_key=proof)
    return Assignment.model_validate(values)


def validate_outcomes(assignments: tuple[Assignment, ...], orders: tuple[Order, ...], as_of: datetime, delay_seconds: int) -> None:
    for assignment in assignments:
        expected = derive_outcome(assignment, orders, as_of, delay_seconds)
        if (assignment.status, assignment.outcome_known_at, assignment.completed_order_key) != (
            expected.status, expected.outcome_known_at, expected.completed_order_key
        ):
            raise ValueError(f"inconsistent outcome for {assignment.assignment_key}")
