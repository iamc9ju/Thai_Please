"""Prepare a retrospective candidate pilot; intentionally contains no training."""

import argparse
import csv
import hashlib
import io
import json
import random
from collections import Counter, defaultdict
from dataclasses import asdict
from datetime import timedelta
from pathlib import Path

from src.complete_journey_source import ObservedHistory, load_settings, parse_utc, read_source
from src.purchase_match import (
    FEATURE_COLUMNS, FEATURE_VERSION, LABEL_VERSION, TemplatePolicy,
    candidate_features, catalog_before, label_for, make_candidates, recent_history,
)

ROOT = Path(__file__).resolve().parent
DEFAULT_SETTINGS = ROOT / "config" / "complete_journey_pilot.json"
DEFAULT_POLICY = ROOT / "config" / "quest_template_policy_v2.json"
DEFAULT_SOURCE = ROOT / "external" / "complete-journey-audit"
DEFAULT_OUTPUT = ROOT / "data" / "complete_journey_pilot"
METADATA_COLUMNS = (
    "sample_key", "household_key", "feature_as_of", "expires_at",
    "target_category_key", "target_store_key", "target_product_key",
    "configured_multiplier", "min_spend_minor", "history_sales_minor", "history_baskets",
    "currency", "amount_basis", "policy_version", "matching_basket_key",
)


def json_bytes(value: object) -> bytes:
    return (json.dumps(value, ensure_ascii=False, sort_keys=True, indent=2, allow_nan=False) + "\n").encode("utf-8")


def digest(value: bytes) -> str:
    return hashlib.sha256(value).hexdigest()


def csv_bytes(rows: list[dict], columns: tuple[str, ...]) -> bytes:
    stream = io.StringIO(newline="")
    writer = csv.DictWriter(stream, fieldnames=columns, lineterminator="\n")
    writer.writeheader()
    writer.writerows(rows)
    return stream.getvalue().encode("utf-8")


def create_outputs(history: ObservedHistory, settings: dict, policy: TemplatePolicy, policy_raw: bytes) -> dict[str, bytes]:
    if TemplatePolicy.from_dict(json.loads(policy_raw)) != policy:
        raise ValueError("policy object differs from policy provenance bytes")
    cutoffs = tuple(parse_utc(value) for value in settings["cutoffs_utc"])
    by_household = defaultdict(list)
    invalid_by_household = defaultdict(list)
    for basket in history.baskets:
        by_household[basket.household_key].append(basket)
    for basket in history.rejected:
        invalid_by_household[basket.household_key].append(basket.at)
    # Sample households from information available at the first cutoff only.
    eligible = sorted(key for key, baskets in by_household.items() if recent_history(tuple(baskets), key, cutoffs[0], policy.history_days))
    if len(eligible) < settings["households"]:
        raise ValueError("not enough historically eligible households for requested pilot")
    selected = sorted(random.Random(settings["seed"]).sample(eligible, settings["households"]))
    catalogs = {cutoff: catalog_before(history.baskets, cutoff) for cutoff in cutoffs}
    rows = []
    excluded = []
    snapshots = []
    for household in selected:
        baskets = tuple(by_household[household])
        invalid_times = tuple(invalid_by_household[household])
        for cutoff in cutoffs:
            lower = cutoff - timedelta(days=policy.history_days)
            reason = None
            if lower < history.observation_start or cutoff > history.observation_end:
                reason = "history_outside_observation"
            elif any(start < cutoff and end > lower for start, end in history.gaps):
                reason = "history_known_gap"
            elif any(lower <= at < cutoff for at in invalid_times):
                reason = "rejected_history_basket"
            recent = recent_history(baskets, household, cutoff, policy.history_days)
            if not recent:
                reason = reason or "no_recent_history_for_relative_target"
            if reason:
                excluded.append({"household_key": household, "feature_as_of": cutoff.isoformat(), "quest_type": "ALL", "reason": reason})
                continue
            candidates = make_candidates(baskets, household, cutoff, policy, settings["seed"], catalogs[cutoff])
            for candidate in candidates:
                features = candidate_features(recent, cutoff, candidate, policy)
                label, proof, reason = label_for(baskets, household, cutoff, candidate, history.observation_start, history.observation_end, history.gaps, invalid_times)
                identity = {"household": household, "cutoff": cutoff.isoformat(), "candidate": asdict(candidate), "policy": policy.policy_version}
                sample_key = digest(json_bytes(identity))
                metadata = {
                    "sample_key": sample_key, "household_key": household,
                    "feature_as_of": cutoff.isoformat(),
                    "expires_at": (cutoff + timedelta(days=candidate.duration_days)).isoformat(),
                    "target_category_key": candidate.category_key,
                    "target_store_key": candidate.store_key, "target_product_key": candidate.product_key,
                    "configured_multiplier": candidate.configured_multiplier,
                    "min_spend_minor": candidate.min_spend_minor,
                    "history_sales_minor": sum(basket.total_minor for basket in recent),
                    "history_baskets": len(recent), "currency": settings["currency"],
                    "amount_basis": settings["amount_basis"], "policy_version": policy.policy_version,
                    "label": label, "matching_basket_key": proof,
                }
                snapshots.append({"metadata": metadata, "features": features, "exclusion_reason": reason})
                if reason:
                    excluded.append({"household_key": household, "feature_as_of": cutoff.isoformat(), "quest_type": candidate.kind.value, "reason": reason})
                else:
                    rows.append(metadata | features)
    rows.sort(key=lambda row: (row["feature_as_of"], row["household_key"], row["quest_type"]))
    if len({row["sample_key"] for row in rows}) != len(rows):
        raise ValueError("duplicate sample identities")
    labels = Counter(str(row["label"]) for row in rows)
    coverage = {kind.value: dict(Counter(str(row["label"]) for row in rows if row["quest_type"] == kind.value)) for kind in policy.quest_types}
    if set(labels) != {"0", "1"} or any(set(values) != {"0", "1"} for values in coverage.values()):
        raise ValueError("pilot needs both labels for each supported type; inspect preparation settings")
    valid_snapshots = [snapshot for snapshot in snapshots if snapshot["exclusion_reason"] is None]
    preview = [next(snapshot for snapshot in valid_snapshots if snapshot["features"]["quest_type"] == kind.value and snapshot["metadata"]["label"] == label)
               for kind in policy.quest_types for label in (0, 1)]
    outputs = {
        "training_data.csv": csv_bytes(rows, METADATA_COLUMNS + FEATURE_COLUMNS + ("label",)),
        "excluded_samples.csv": csv_bytes(excluded, ("household_key", "feature_as_of", "quest_type", "reason")),
        "sample_preview.json": json_bytes(preview),
        "feature_schema.json": json_bytes({"version": FEATURE_VERSION, "ordered_features": FEATURE_COLUMNS,
                                         "label_column": "label", "metadata_columns": METADATA_COLUMNS,
                                         "label_version": LABEL_VERSION, "score_type": "purchase_match_probability"}),
        "template_policy.json": policy_raw,
    }
    rejected_household_cutoffs = sum(row["quest_type"] == "ALL" for row in excluded)
    manifest = {
        "dataset_version": settings["dataset_version"], "data_origin": "EXTERNAL_OBSERVED_PURCHASES_WITH_HYPOTHETICAL_CANDIDATES",
        "feature_version": FEATURE_VERSION, "label_version": LABEL_VERSION,
        "settings": settings, "settings_sha256": digest(json_bytes(settings)),
        "policy_version": policy.policy_version, "policy_sha256": digest(policy_raw),
        "source": history.provenance, "cleaning": history.cleaning,
        "selected_households": selected, "household_selection": "SEEDED_SAMPLE_OF_PRE_FIRST_CUTOFF_ELIGIBLE_HOUSEHOLDS",
        "counts": {
            "requested_households": settings["households"], "cutoffs": len(cutoffs),
            "maximum_samples": settings["households"] * len(cutoffs) * len(policy.quest_types),
            "training_rows": len(rows), "labels": dict(labels), "types_and_labels": coverage,
            "represented_households": len({row["household_key"] for row in rows}),
            "excluded_household_cutoffs": rejected_household_cutoffs,
            "excluded_candidate_rows": len(excluded) - rejected_household_cutoffs,
            "excluded_reasons": dict(Counter(row["reason"] for row in excluded)),
        },
        "files_sha256": {name: digest(value) for name, value in outputs.items()},
        "limitations": [
            "No real quest exposure/outcomes or incentive response; scores describe observed purchase-match behavior.",
            "Source sales is retailer revenue; not verified platform post-discount net payable. No currency conversion.",
            "Households/stores are source entities; target IDs are metadata, not transferable model predictors.",
            "Source dates were rebased and seconds manufactured; observations are not precise historical payment facts.",
            "Product metadata is a static source table, not a verified historical category snapshot stream.",
            "Strict whole-basket exclusion/censoring biases the retained sample toward well-observed histories; compare coverage before scaling.",
            "No model training, evaluation metrics, split fitting, API, DB seeding or financial/reward mutation.",
            "Later temporal splits must keep same-cutoff candidate groups together and purge outcome-window overlap.",
        ],
    }
    outputs["manifest.json"] = json_bytes(manifest)
    return outputs


def save_outputs(output: Path, outputs: dict[str, bytes], overwrite: bool = False) -> None:
    conflicts = [name for name, contents in outputs.items() if (output / name).exists() and (output / name).read_bytes() != contents]
    if conflicts and not overwrite:
        raise FileExistsError(f"different existing outputs: {', '.join(conflicts)}; select a new directory or explicitly --overwrite")
    output.mkdir(parents=True, exist_ok=True)
    for name, contents in outputs.items():
        if not (output / name).exists() or (output / name).read_bytes() != contents:
            (output / name).write_bytes(contents)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source", type=Path, default=DEFAULT_SOURCE)
    parser.add_argument("--reader", type=Path)
    parser.add_argument("--settings", type=Path, default=DEFAULT_SETTINGS)
    parser.add_argument("--policy", type=Path, default=DEFAULT_POLICY)
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    parser.add_argument("--overwrite", action="store_true")
    args = parser.parse_args()
    settings = load_settings(json.loads(args.settings.read_text(encoding="utf-8")))
    policy_raw = args.policy.read_bytes()
    policy = TemplatePolicy.from_dict(json.loads(policy_raw))
    history = read_source(args.source, args.reader, settings)
    print(json.dumps({"source_normalized": history.cleaning}, ensure_ascii=False), flush=True)
    outputs = create_outputs(history, settings, policy, policy_raw)
    save_outputs(args.output, outputs, args.overwrite)
    print(json.dumps(json.loads(outputs["manifest.json"])["counts"], ensure_ascii=False))


if __name__ == "__main__":
    main()
