"""Behavioral coverage of retrospective labels, temporal safety and contracts."""

import csv
import io
import json
from dataclasses import replace
from datetime import datetime, timedelta, timezone

import pytest

from prepare_complete_journey import DEFAULT_POLICY, DEFAULT_SETTINGS, create_outputs, save_outputs
from src.complete_journey_source import ObservedHistory, RejectedBasket, load_settings, normalize_frames, parse_utc
from src.purchase_match import (
    Basket, BasketItem, Candidate, FEATURE_COLUMNS, TemplatePolicy, TemplateType,
    candidate_features, catalog_before, label_for, make_candidates, matches,
    recent_history, threshold_minor,
)

UTC = timezone.utc
CUTOFF = datetime(2017, 7, 1, tzinfo=UTC)
START = datetime(2017, 1, 1, 5, tzinfo=UTC)
END = datetime(2018, 1, 1, 5, tzinfo=UTC)


@pytest.fixture
def policy():
    return TemplatePolicy.from_dict(json.loads(DEFAULT_POLICY.read_bytes()))


def basket(key="one", at=None, household="A", store="shop", amount=10000, category="food", product="rice", items=None):
    return Basket(key, household, store, at or CUTOFF - timedelta(days=1),
                  items or (BasketItem(product, category, 1, amount),))


def candidate(kind=TemplateType.MIN_SPEND, threshold=10000, multiplier="1.0"):
    return Candidate(kind, 7, None if kind == TemplateType.PRODUCT_PURCHASE else threshold,
                     None if kind == TemplateType.PRODUCT_PURCHASE else multiplier,
                     "food" if kind == TemplateType.CATEGORY_SPEND else None,
                     "shop" if kind == TemplateType.MERCHANT_SPEND else None,
                     "rice" if kind == TemplateType.PRODUCT_PURCHASE else None)


def label(baskets, candidate_value=None, **changes):
    args = dict(household="A", cutoff=CUTOFF, candidate=candidate_value or candidate(),
                observation_start=START, observation_end=END, gaps=(), invalid_times=())
    return label_for(tuple(baskets), **(args | changes))


def test_single_basket_not_sum_of_receipts():
    assert label([basket("a", CUTOFF, amount=6000), basket("b", CUTOFF + timedelta(days=1), amount=6000)]) == (0, None, None)
    assert label([basket("a", CUTOFF, amount=10000)]) == (1, "a", None)


def test_cutoff_and_expiry_boundaries():
    assert label([basket(at=CUTOFF)])[0] == 1
    assert label([basket(at=CUTOFF + timedelta(days=7))])[0] == 0
    assert label([basket(at=CUTOFF - timedelta(seconds=1))])[0] == 0
    assert label([], observation_end=CUTOFF + timedelta(days=7))[0] == 0
    assert label([], observation_end=CUTOFF + timedelta(days=7, seconds=-1))[0] is None


def test_ownership_and_store():
    assert label([basket(at=CUTOFF, household="B")])[0] == 0
    assert label([basket(at=CUTOFF, store="other")], candidate(TemplateType.MERCHANT_SPEND))[0] == 0
    assert label([basket(at=CUTOFF)], candidate(TemplateType.MERCHANT_SPEND))[0] == 1


def test_category_spend_sums_only_target_items_in_one_basket():
    lines = (BasketItem("rice", "food", 1, 6000), BasketItem("bread", "food", 1, 4000), BasketItem("soap", "household", 1, 9000))
    value = basket(at=CUTOFF, items=lines)
    assert matches(value, candidate(TemplateType.CATEGORY_SPEND))
    assert not matches(value, candidate(TemplateType.CATEGORY_SPEND, 15000, "1.5"))


def test_product_presence_and_no_minimum():
    assert matches(basket(), candidate(TemplateType.PRODUCT_PURCHASE))
    assert not matches(basket(product="other"), candidate(TemplateType.PRODUCT_PURCHASE))
    with pytest.raises(ValueError):
        Candidate(TemplateType.PRODUCT_PURCHASE, 7, 100, "1.0", product_key="rice")


def test_unknown_or_censored_window_never_gets_zero():
    assert label([], gaps=((CUTOFF + timedelta(days=1), CUTOFF + timedelta(days=2)),))[2] == "known_observation_gap"
    assert label([], invalid_times=(CUTOFF,))[2] == "rejected_future_basket"
    assert label([], invalid_times=(CUTOFF + timedelta(days=7),))[0] == 0
    assert label([], gaps=((CUTOFF + timedelta(days=7), CUTOFF + timedelta(days=8)),))[0] == 0


def test_features_use_only_pre_cutoff_distinct_baskets(policy):
    values = (basket("older", CUTOFF - timedelta(days=30)), basket("recent", CUTOFF - timedelta(days=7)), basket("now", CUTOFF), basket("other", household="B"))
    recent = recent_history(values, "A", CUTOFF, 30)
    features = candidate_features(recent, CUTOFF, candidate(TemplateType.CATEGORY_SPEND), policy)
    assert features["purchases_7d"] == 1
    assert features["purchases_30d"] == 2
    assert features["target_category_purchases_30d"] == 2
    assert features["target_product_purchases_30d"] is None
    assert tuple(features) == FEATURE_COLUMNS
    assert "label" not in features and "reward_point" not in features
    assert not any("completed" in key or key.endswith("_id") for key in features)
    with pytest.raises(ValueError):
        candidate_features(recent + (values[2],), CUTOFF, candidate(), policy)


def test_target_counts_are_basket_counts_not_item_counts(policy):
    lines = (BasketItem("rice", "food", 3, 6000), BasketItem("bread", "food", 2, 4000))
    value = basket(items=lines)
    features = candidate_features((value,), CUTOFF, candidate(TemplateType.CATEGORY_SPEND), policy)
    assert features["target_category_purchases_30d"] == 1
    assert features["purchases_30d"] == 1


def test_no_history_and_wrong_threshold_fail(policy):
    with pytest.raises(ValueError):
        threshold_minor(0, 0, "1.0")
    with pytest.raises(ValueError):
        candidate_features((basket(),), CUTOFF, candidate(threshold=40000), policy)
    with pytest.raises(ValueError):
        candidate_features((basket(), basket("other", household="B")), CUTOFF, candidate(), policy)


def test_exact_threshold_rounding_and_currency_normalization(policy):
    assert threshold_minor(10001, 2, "1.5") == 7501
    features = candidate_features((basket(),), CUTOFF, candidate(), policy)
    scaled = candidate_features((basket(amount=100000),), CUTOFF, candidate(threshold=100000), policy)
    assert features == scaled
    assert features["min_spend_ratio"] == "1.000000"


def test_candidates_and_targets_do_not_inspect_future(policy):
    past = (basket(),)
    initial = make_candidates(past, "A", CUTOFF, policy, 123)
    future = basket("future", CUTOFF + timedelta(days=1), store="future-shop", product="future-product", category="future-category")
    assert make_candidates(past + (future,), "A", CUTOFF, policy, 123) == initial
    assert len(initial) == 4
    assert all(value.category_key != "future-category" for value in initial)
    with pytest.raises(ValueError):
        make_candidates(past, "A", CUTOFF, policy, 123, catalog_before(past, CUTOFF + timedelta(days=1)))


@pytest.mark.parametrize("changes", [
    {"extra": True}, {"spend_multipliers": ["NaN"]}, {"duration_days": [0]},
    {"product_requires_spend": True}, {"history_days": 7}, {"quest_types": ["MIN_SPEND"]},
])
def test_invalid_policy_rejected(changes):
    with pytest.raises(ValueError):
        TemplatePolicy.from_dict(json.loads(DEFAULT_POLICY.read_bytes()) | changes)


def source_frames():
    import pandas as pd
    t = pd.DataFrame({
        "household_id": ["A", "A"], "store_id": ["shop", "shop"], "basket_id": ["same", "same"],
        "product_id": ["rice", "soap"], "quantity": [1, 1], "sales_value": [10.0, 2.0],
        "retail_disc": [0.0, 0.0], "coupon_disc": [0.0, 0.0], "coupon_match_disc": [0.0, 0.0],
        "week": [1, 1], "transaction_timestamp": pd.to_datetime(["2017-06-27T12:00:00Z"] * 2, utc=True),
    })
    p = pd.DataFrame({"product_id": ["rice", "soap"], "manufacturer_id": ["m", "m"],
                      "department": ["GROCERY", "DRUG GM"], "brand": ["National", "National"],
                      "product_category": ["food", "household"], "product_type": ["rice", "soap"],
                      "package_size": ["one", "one"]})
    return t, p


def test_source_rejects_whole_basket_not_partial_total():
    t, p = source_frames()
    settings = load_settings(json.loads(DEFAULT_SETTINGS.read_bytes()))
    settings = settings | {"category_level": "product_category"}
    valid = normalize_frames(t, p, settings, {})
    assert len(valid.baskets) == 1 and valid.baskets[0].total_minor == 1200
    t.loc[1, "quantity"] = 0
    rejected = normalize_frames(t, p, settings, {})
    assert not rejected.baskets and len(rejected.rejected) == 1
    assert rejected.cleaning["rejected_lines"] == 2


def test_source_missing_category_rejects_whole_basket():
    t, p = source_frames()
    p.loc[1, "department"] = None
    result = normalize_frames(t, p, json.loads(DEFAULT_SETTINGS.read_bytes()), {})
    assert not result.baskets and result.rejected[0].reasons == ("missing_selected_category",)


def test_source_ambiguous_money_or_ownership_fails():
    t, p = source_frames()
    settings = json.loads(DEFAULT_SETTINGS.read_bytes())
    t.loc[0, "sales_value"] = 10.005
    with pytest.raises(ValueError):
        normalize_frames(t, p, settings, {})
    t.loc[0, "sales_value"] = 10.0
    t.loc[1, "household_id"] = "B"
    with pytest.raises(ValueError):
        normalize_frames(t, p, settings, {})


def test_naive_timestamp_rejected():
    with pytest.raises(ValueError):
        parse_utc("2017-07-01T00:00:00")
    with pytest.raises(ValueError):
        basket(at=datetime(2017, 7, 1))


def tiny_history():
    return ObservedHistory((basket("past-a"), basket("past-b", household="B"), basket("future", CUTOFF, amount=20000)), (), START, END, (), {}, {})


def pilot_settings():
    return load_settings(json.loads(DEFAULT_SETTINGS.read_bytes()) | {"households": 2, "cutoffs_utc": [CUTOFF.isoformat()]})


def test_export_reproducibility_and_provenance(policy, tmp_path):
    raw = DEFAULT_POLICY.read_bytes()
    outputs = create_outputs(tiny_history(), pilot_settings(), policy, raw)
    assert create_outputs(tiny_history(), pilot_settings(), policy, raw) == outputs
    rows = list(csv.DictReader(io.StringIO(outputs["training_data.csv"].decode())))
    assert len(rows) == 8 and {row["label"] for row in rows} == {"0", "1"}
    schema = json.loads(outputs["feature_schema.json"])
    assert schema["ordered_features"] == list(FEATURE_COLUMNS)
    assert "household_key" in schema["metadata_columns"]
    assert "label" not in schema["metadata_columns"]
    preview = json.loads(outputs["sample_preview.json"])
    assert len({(row["features"]["quest_type"], row["metadata"]["label"]) for row in preview}) == 8
    save_outputs(tmp_path, outputs)
    save_outputs(tmp_path, outputs)
    before = (tmp_path / "manifest.json").read_bytes()
    with pytest.raises(FileExistsError):
        save_outputs(tmp_path, outputs | {"training_data.csv": b"different"})
    assert (tmp_path / "manifest.json").read_bytes() == before


def test_history_censoring_and_household_selection(policy):
    history = tiny_history()
    invalid = RejectedBasket("B", "bad", CUTOFF - timedelta(days=1), ("missing",))
    # C supplies observable negative examples; future-only D cannot be sampled.
    past_c = basket("past-c", household="C")
    future_only = basket("future-d", CUTOFF + timedelta(days=1), household="D")
    output = create_outputs(replace(history, baskets=history.baskets + (past_c, future_only), rejected=(invalid,)), pilot_settings() | {"households": 3}, policy, DEFAULT_POLICY.read_bytes())
    manifest = json.loads(output["manifest.json"])
    assert manifest["selected_households"] == ["A", "B", "C"]
    assert manifest["counts"]["excluded_household_cutoffs"] == 1
    rows = list(csv.DictReader(io.StringIO(output["training_data.csv"].decode())))
    assert {row["household_key"] for row in rows} == {"A", "C"}


def test_bad_settings_and_policy_provenance(policy):
    with pytest.raises(ValueError):
        load_settings(json.loads(DEFAULT_SETTINGS.read_bytes()) | {"households": True})
    with pytest.raises(ValueError):
        create_outputs(tiny_history(), pilot_settings(), policy, json.dumps(json.loads(DEFAULT_POLICY.read_bytes()) | {"spend_multipliers": ["2.0"]}).encode())


def test_export_rejects_type_without_positive_examples(policy):
    history = replace(tiny_history(), baskets=tiny_history().baskets[:2])
    with pytest.raises(ValueError, match="both labels"):
        create_outputs(history, pilot_settings(), policy, DEFAULT_POLICY.read_bytes())
