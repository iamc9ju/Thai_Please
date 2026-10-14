"""Regression coverage for the offline contract and single-order label oracle."""

import csv
import io
import json
from datetime import timedelta
from decimal import Decimal

import pytest
from pydantic import ValidationError

from prepare_data import DEFAULT_CONFIG, create_outputs, save_outputs
from src.data_contract import (
    Assignment, FEATURE_COLUMNS, GeneratorConfig, History, Item, METADATA_COLUMNS,
    Order, OrderStatus, Outcome, Quest, QuestType,
)
from src.features import calculate_features
from src.quest_rules import allocate_discount, derive_outcome, qualifies
from src.synthetic_history import generate_history


@pytest.fixture(scope="session")
def demo():
    return generate_history(GeneratorConfig.model_validate_json(DEFAULT_CONFIG.read_bytes()))


def revised(record, **changes):
    return type(record).model_validate(record.model_dump() | changes)


def assignment(demo, kind=QuestType.MIN_SPEND, threshold=10000, **changes):
    t = demo.config.start_at + timedelta(days=35)
    quest = Quest(
        quest_key="test-quest", quest_type=kind,
        min_spend_minor=None if kind == QuestType.PRODUCT_PURCHASE else threshold,
        reward_point=50, duration_days=7,
        target_category_id="demo-food" if kind == QuestType.CATEGORY_SPEND else None,
        target_merchant_id="demo-merchant-food" if kind == QuestType.MERCHANT_SPEND else None,
        target_product_id="demo-rice" if kind == QuestType.PRODUCT_PURCHASE else None,
    )
    result = Assignment(
        assignment_key="test-assignment", user_key=demo.users[0].user_key, quest=quest,
        assigned_at=t, feature_as_of=t, expires_at=t + timedelta(days=7),
        status=Outcome.ACTIVE, outcome_known_at=None, completed_order_key=None,
    )
    return revised(result, **changes)


def item(key="line-1", price=10000, category="demo-food", product="demo-rice", eligible=True):
    return Item(item_key=key, product_key=product, category_key=category, product_name_snapshot=product,
                unit_price_minor=price, quantity=1, line_total_minor=price, discount_eligible=eligible)


def order(demo, key="test-order", at=None, items=None, discount=0, subsidy=0, **changes):
    lines = items if items is not None else (item(),)
    subtotal = sum(line.line_total_minor for line in lines)
    paid_at = at if at is not None else assignment(demo).assigned_at + timedelta(hours=1)
    result = Order(
        order_key=key, user_key=demo.users[0].user_key, merchant_key="demo-merchant-food",
        status=OrderStatus.PAID, created_at=paid_at - timedelta(minutes=1), paid_at=paid_at,
        items=lines, subtotal_minor=subtotal, discount_minor=discount, final_minor=subtotal - discount,
        subsidy_minor=subsidy, personal_minor=subtotal - discount - subsidy,
    )
    return revised(result, **changes)


def history(demo, orders=(), assignments=()):
    return revised(demo, orders=orders, assignments=assignments)


@pytest.mark.parametrize("kind", tuple(QuestType))
def test_all_four_rules_use_one_owned_paid_order(demo, kind):
    candidate = assignment(demo, kind)
    paid = order(demo)
    assert qualifies(candidate, paid)
    assert not qualifies(candidate, revised(paid, user_key=demo.users[1].user_key))
    assert not qualifies(candidate, revised(paid, status=OrderStatus.PENDING, paid_at=None))


@pytest.mark.parametrize("offset,expected", [(timedelta(0), True), (timedelta(days=7), False), (timedelta(seconds=-1), False)])
def test_assignment_validity_is_half_open(demo, offset, expected):
    candidate = assignment(demo)
    assert qualifies(candidate, order(demo, at=candidate.assigned_at + offset)) is expected


def test_receipts_are_not_aggregated_and_subsidy_is_not_discount(demo):
    candidate = assignment(demo)
    smaller = tuple(order(demo, key=f"part-{index}", items=(item(price=6000),)) for index in range(2))
    result = derive_outcome(candidate, smaller, candidate.expires_at + timedelta(minutes=1), 60)
    assert result.status == Outcome.EXPIRED
    assert qualifies(candidate, order(demo, subsidy=9000))
    assert not qualifies(candidate, order(demo, discount=1))


def test_category_uses_allocated_post_discount_snapshot(demo):
    candidate = assignment(demo, QuestType.CATEGORY_SPEND, 13000)
    paid = order(demo, items=(item(price=15000), item("line-2", 5000, "demo-household", "demo-soap-food")), discount=4000, subsidy=8000)
    assert allocate_discount(paid) == {"line-1": 3000, "line-2": 1000}
    assert not qualifies(candidate, paid)  # food is 120, not subtotal 150 or personal 80
    assert qualifies(revised(candidate, quest=revised(candidate.quest, min_spend_minor=12000)), paid)


@pytest.mark.parametrize("prices,discount", [((1, 1, 1), 1), ((3, 5, 7), 4), ((10, 20, 30), 59)])
def test_largest_remainder_conserves_money_and_stable_ties(demo, prices, discount):
    paid = order(demo, items=tuple(item(f"line-{index}", price) for index, price in enumerate(prices)), discount=discount)
    allocation = allocate_discount(paid)
    assert sum(allocation.values()) == discount
    assert sum(line.line_total_minor - allocation[line.item_key] for line in paid.items) == paid.final_minor
    assert all(allocation[line.item_key] <= line.line_total_minor for line in paid.items)
    if prices == (1, 1, 1):
        assert allocation == {"line-0": 1, "line-1": 0, "line-2": 0}


def test_discount_excludes_ineligible_items_and_zero_base(demo):
    paid = order(demo, items=(item(price=100), item("line-2", 100, eligible=False)), discount=20)
    assert allocate_discount(paid) == {"line-1": 20, "line-2": 0}
    assert allocate_discount(order(demo, items=(item(price=0),))) == {"line-1": 0}
    with pytest.raises(ValidationError):
        revised(paid, discount_minor=101, final_minor=99, personal_minor=99)


def test_target_mismatch_does_not_qualify(demo):
    paid = order(demo, items=(item(product="demo-soap-food", category="demo-household"),))
    assert not qualifies(assignment(demo, QuestType.PRODUCT_PURCHASE), paid)
    assert not qualifies(assignment(demo, QuestType.CATEGORY_SPEND), paid)
    assert not qualifies(assignment(demo, QuestType.MERCHANT_SPEND), revised(paid, merchant_key="demo-merchant-local"))


def test_7_30_windows_include_lower_boundary_exclude_future_foreign_pending(demo):
    candidate = assignment(demo)
    t = candidate.feature_as_of
    orders = tuple(order(demo, key=f"day-{day}", at=t - timedelta(days=day)) for day in (0, 7, 8, 30, 31))
    extra = (
        order(demo, key="foreign", at=t - timedelta(days=1), user_key=demo.users[1].user_key),
        order(demo, key="pending", at=t - timedelta(days=1), status=OrderStatus.PENDING, paid_at=None),
    )
    features = calculate_features(history(demo, orders + extra), candidate)
    assert features["purchases_7d"] == 1
    assert features["purchases_30d"] == 3
    assert features["total_spend_30d"] == "300.00"
    assert features["avg_order_value_30d"] == "100.000000"


def test_target_counts_distinct_orders_not_lines_or_quantity(demo):
    candidate = assignment(demo, QuestType.CATEGORY_SPEND)
    paid = order(demo, at=candidate.assigned_at - timedelta(days=1), items=(item(), item("line-2")))
    features = calculate_features(history(demo, (paid,)), candidate)
    assert features["target_category_purchases_30d"] == 1
    assert features["target_merchant_purchases_30d"] is None
    empty = calculate_features(history(demo), candidate)
    assert empty["target_category_purchases_30d"] == 0
    assert empty["avg_order_value_30d"] is None
    assert empty["quest_completion_rate"] is None
    assert empty["spend_gap_vs_avg_30d"] is None


def test_history_counts_known_outcomes_only_and_excludes_active_from_denominator(demo):
    current = assignment(demo)
    old_time = current.assigned_at - timedelta(days=20)
    past = []
    for index in range(8):
        status = Outcome.COMPLETED if index < 3 else Outcome.EXPIRED if index < 5 else Outcome.ACTIVE
        past.append(revised(current, assignment_key=f"past-{index}", assigned_at=old_time, feature_as_of=old_time,
                            expires_at=old_time + timedelta(days=7), status=status,
                            outcome_known_at=old_time + timedelta(days=8) if status != Outcome.ACTIVE else None,
                            completed_order_key=f"proof-{index}" if status == Outcome.COMPLETED else None))
    features = calculate_features(history(demo, assignments=tuple(past) + (current,)), current)
    assert features["quests_assigned_before"] == 8
    assert features["quests_completed_before"] == 3
    assert features["quests_expired_before"] == 2
    assert features["quest_completion_rate"] == "0.600000"
    assert features["same_type_completion_rate"] == "0.600000"
    delayed = revised(past[0], outcome_known_at=current.feature_as_of + timedelta(seconds=1))
    changed = calculate_features(history(demo, assignments=(delayed,)), current)
    assert changed["quests_completed_before"] == 0
    assert changed["quest_completion_rate"] is None


def test_future_purchase_does_not_change_features_and_negative_gap_is_retained(demo):
    candidate = assignment(demo)
    before = order(demo, key="before", at=candidate.assigned_at - timedelta(days=1), items=(item(price=12000),))
    original = calculate_features(history(demo, (before,)), candidate)
    after = order(demo, key="after", at=candidate.assigned_at + timedelta(days=1), items=(item(price=99999),))
    assert calculate_features(history(demo, (before, after)), candidate) == original
    assert original["spend_gap_vs_avg_30d"] == "-20.000000"


def test_delayed_finalization_is_not_visible_early(demo):
    candidate = assignment(demo)
    paid = order(demo)
    assert paid.paid_at is not None
    pending = derive_outcome(candidate, (paid,), paid.paid_at + timedelta(seconds=30), 60)
    assert pending.status == Outcome.ACTIVE
    complete = derive_outcome(candidate, (paid,), candidate.expires_at + timedelta(days=1), 60)
    assert complete.status == Outcome.COMPLETED
    assert complete.completed_order_key == paid.order_key


def test_raw_contract_rejects_tampering_timezone_float_duplicates_and_unknown_fields(demo):
    values = demo.model_dump(mode="json")
    cases = []
    for field, value in (("final_minor", -1), ("subtotal_minor", 1), ("discount_minor", 1.5), ("paid_at", "2026-02-01T00:00:00"), ("secret", "should-not-exist")):
        changed = json.loads(json.dumps(values))
        changed["orders"][0][field] = value
        cases.append(changed)
    duplicate = json.loads(json.dumps(values))
    duplicate["orders"].append(duplicate["orders"][0])
    cases.append(duplicate)
    dangling = json.loads(json.dumps(values))
    dangling["assignments"][0]["quest"]["target_product_id"] = "missing"
    cases.append(dangling)
    for case in cases:
        with pytest.raises(ValidationError):
            History.model_validate_json(json.dumps(case))


def test_mixed_quest_rules_are_rejected(demo):
    with pytest.raises(ValidationError):
        revised(assignment(demo).quest, target_product_id="demo-rice")
    with pytest.raises(ValidationError):
        revised(assignment(demo, QuestType.PRODUCT_PURCHASE).quest, min_spend_minor=100)


def test_config_rejects_overlap_percent_ranges_and_empty_merchant_catalog(demo):
    for changes in ({"assignment_interval_days": 7}, {"discount_percent": (101,)}, {"currency_scale": 5}):
        with pytest.raises(ValidationError):
            revised(demo.config, **changes)
    catalog = revised(demo.config.catalog, products=tuple(product for product in demo.config.catalog.products if product.merchant_key == "demo-merchant-food"))
    with pytest.raises(ValidationError, match="requires at least one product"):
        revised(demo.config, catalog=catalog)


def test_later_catalog_reclassification_does_not_rewrite_item_snapshot(demo):
    candidate = assignment(demo, QuestType.CATEGORY_SPEND)
    paid = order(demo, at=candidate.assigned_at - timedelta(days=1))
    before = history(demo, (paid,))
    products = tuple(revised(product, category_key="demo-household") if product.product_key == "demo-rice" else product for product in demo.config.catalog.products)
    changed_config = revised(demo.config, catalog=revised(demo.config.catalog, products=products))
    after = revised(before, config=changed_config)
    assert calculate_features(before, candidate) == calculate_features(after, candidate)
    assert calculate_features(after, candidate)["target_category_purchases_30d"] == 1


def test_outputs_are_reproducible_validated_and_never_label_active(demo, tmp_path):
    outputs = create_outputs(demo)
    assert outputs == create_outputs(generate_history(demo.config))
    reloaded = History.model_validate_json(outputs["raw_history.json"])
    assert outputs == create_outputs(reloaded)
    rows = list(csv.DictReader(io.StringIO(outputs["training_data.csv"].decode("utf-8"))))
    assert tuple(rows[0]) == METADATA_COLUMNS + FEATURE_COLUMNS
    active_keys = {a.assignment_key for a in demo.assignments if a.status == Outcome.ACTIVE}
    assert active_keys and not active_keys.intersection(row["assignment_key"] for row in rows)
    assert {row["completed"] for row in rows} == {"0", "1"}
    assert {row["quest_type"] for row in rows} == {kind.value for kind in QuestType}
    assert len({row["assignment_key"] for row in rows}) == len(rows)
    for row in rows:
        assert row["data_origin"] == "SYNTHETIC"
        assert int(row["purchases_7d"]) <= int(row["purchases_30d"])
        if row["quest_completion_rate"]:
            assert Decimal(0) <= Decimal(row["quest_completion_rate"]) <= Decimal(1)
        assert bool(row["completed_order_key"]) == (row["completed"] == "1")
    save_outputs(outputs, tmp_path)
    save_outputs(outputs, tmp_path)
    (tmp_path / "manifest.json").write_text("user content", encoding="utf-8")
    with pytest.raises(FileExistsError):
        save_outputs(outputs, tmp_path)
    assert (tmp_path / "manifest.json").read_text() == "user content"


def test_inconsistent_labels_are_rejected_not_silently_repaired(demo):
    expired = next(a for a in demo.assignments if a.status == Outcome.EXPIRED)
    forged = revised(expired, status=Outcome.COMPLETED, completed_order_key=demo.orders[0].order_key)
    bad = history(demo, demo.orders, tuple(forged if a.assignment_key == expired.assignment_key else a for a in demo.assignments))
    with pytest.raises(ValueError, match="inconsistent outcome"):
        create_outputs(bad)
