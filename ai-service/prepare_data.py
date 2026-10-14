"""Generate or validate synthetic history and export the Step 2 training contract."""

import argparse
import csv
import hashlib
import io
import json
from collections import Counter
from pathlib import Path

from src.data_contract import (
    DATA_ORIGIN, FEATURE_COLUMNS, GeneratorConfig, History, METADATA_COLUMNS, OrderStatus, Outcome, QuestType,
)
from src.features import calculate_features
from src.quest_rules import validate_outcomes
from src.synthetic_history import generate_history

SERVICE_ROOT = Path(__file__).resolve().parent
DEFAULT_CONFIG = SERVICE_ROOT / "config" / "synthetic_demo.json"
DEFAULT_OUTPUT = SERVICE_ROOT / "data"
RAW_FILE = "raw_history.json"
CSV_FILE = "training_data.csv"
SNAPSHOT_FILE = "feature_snapshots.json"
MANIFEST_FILE = "manifest.json"


def json_bytes(value: object) -> bytes:
    return (json.dumps(value, ensure_ascii=False, indent=2, sort_keys=True, allow_nan=False) + "\n").encode("utf-8")


def sha256(value: bytes) -> str:
    return hashlib.sha256(value).hexdigest()


def create_outputs(history: History) -> dict[str, bytes]:
    validate_outcomes(history.assignments, history.orders, history.dataset_as_of, history.config.outcome_delay_seconds)
    rows: list[dict[str, int | str | None]] = []
    snapshots: list[dict[str, object]] = []
    for assignment in history.assignments:
        features = calculate_features(history, assignment)
        snapshots.append({
            "assignment_key": assignment.assignment_key,
            "feature_as_of": assignment.feature_as_of.isoformat(),
            "feature_schema_version": history.feature_schema_version,
            "features": features,
        })
        if assignment.status == Outcome.ACTIVE:
            continue
        known_at = assignment.outcome_known_at
        if known_at is None:
            raise ValueError("finalized assignment without known_at")
        row: dict[str, int | str | None] = {
            "assignment_key": assignment.assignment_key,
            "user_key": assignment.user_key,
            "quest_key": assignment.quest.quest_key,
            "assigned_at": assignment.assigned_at.isoformat(),
            "feature_as_of": assignment.feature_as_of.isoformat(),
            "expires_at": assignment.expires_at.isoformat(),
            "outcome_known_at": known_at.isoformat(),
            "completed_order_key": assignment.completed_order_key,
            "completed": int(assignment.status == Outcome.COMPLETED),
            "data_origin": history.data_origin,
            "dataset_version": history.dataset_version,
            "feature_schema_version": history.feature_schema_version,
            "rule_version": history.rule_version,
            "currency": history.config.currency,
        }
        row.update(features)
        rows.append(row)
    if {row["completed"] for row in rows} != {0, 1}:
        raise ValueError("demo training output requires both finalized labels")
    if {row["quest_type"] for row in rows} != {kind.value for kind in QuestType}:
        raise ValueError("demo training output must cover all four quest types")
    stream = io.StringIO(newline="")
    writer = csv.DictWriter(stream, fieldnames=METADATA_COLUMNS + FEATURE_COLUMNS, lineterminator="\n")
    writer.writeheader()
    writer.writerows(rows)
    raw = json_bytes(history.model_dump(mode="json"))
    csv_data = stream.getvalue().encode("utf-8")
    snapshot_data = json_bytes(snapshots)
    outputs = {RAW_FILE: raw, CSV_FILE: csv_data, SNAPSHOT_FILE: snapshot_data}
    manifest = {
        "data_origin": DATA_ORIGIN,
        "dataset_version": history.dataset_version,
        "feature_schema_version": history.feature_schema_version,
        "rule_version": history.rule_version,
        "dataset_as_of": history.dataset_as_of.isoformat(),
        "seed": history.config.seed,
        "currency": history.config.currency,
        "currency_scale": history.config.currency_scale,
        "config_sha256": sha256(json_bytes(history.config.model_dump(mode="json"))),
        "files_sha256": {name: sha256(contents) for name, contents in outputs.items()},
        "feature_columns": FEATURE_COLUMNS,
        "metadata_columns": METADATA_COLUMNS,
        "counts": {
            "users": len(history.users), "paid_orders": sum(order.status == OrderStatus.PAID for order in history.orders),
            "assignments": len(history.assignments), "training_rows": len(rows),
            "excluded_active": sum(assignment.status == Outcome.ACTIVE for assignment in history.assignments),
            "labels": dict(Counter(str(row["completed"]) for row in rows)),
            "quest_types": dict(Counter(str(row["quest_type"]) for row in rows)),
        },
        "limitations": [
            "SYNTHETIC academic fixture; not evidence of real predictive performance or spending uplift.",
            "No model training, API, DB seed, wallet/point ledger, or production rule engine implemented.",
            "Non-overlapping assignments avoid deciding simultaneous reward policy.",
            "Offline/DB parity has not yet been tested.",
        ],
    }
    outputs[MANIFEST_FILE] = json_bytes(manifest)
    return outputs


def save_outputs(outputs: dict[str, bytes], directory: Path, overwrite: bool = False) -> None:
    # Check every destination before writing so a conflict cannot replace earlier files.
    for name, content in outputs.items():
        target = directory / name
        if target.exists() and target.read_bytes() != content and not overwrite:
            raise FileExistsError(f"different output exists: {target}; use a new directory or explicit --overwrite")
    directory.mkdir(parents=True, exist_ok=True)
    for name, content in outputs.items():
        target = directory / name
        if not target.exists() or target.read_bytes() != content:
            target.write_bytes(content)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    source = parser.add_mutually_exclusive_group()
    source.add_argument("--config", type=Path, default=DEFAULT_CONFIG)
    source.add_argument("--raw", type=Path, help="validate and re-export an existing synthetic history")
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    parser.add_argument("--overwrite", action="store_true", help="explicitly replace differing generated fixture files")
    arguments = parser.parse_args()
    try:
        history = History.model_validate_json(arguments.raw.read_bytes()) if arguments.raw else generate_history(
            GeneratorConfig.model_validate_json(arguments.config.read_bytes())
        )
        outputs = create_outputs(history)
        save_outputs(outputs, arguments.output, arguments.overwrite)
    except (ValueError, OSError) as error:
        parser.exit(1, f"Data preparation failed: {error}\n")
    print(outputs[MANIFEST_FILE].decode("utf-8"))


if __name__ == "__main__":
    main()
