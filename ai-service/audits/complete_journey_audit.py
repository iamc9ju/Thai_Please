"""Read-only audit of pinned Complete Journey R files; no model or DB writes."""

import argparse
import hashlib
import json
import sys
from decimal import Decimal
from pathlib import Path


def audit(source: Path) -> dict:
    # Reader dependencies are isolated in the ignored external audit directory.
    sys.path.insert(0, str(source / "reader"))
    import numpy as np
    import pandas as pd
    import pyreadr

    transactions = pyreadr.read_r(str(source / "transactions.rds"), timezone="UTC")[None]
    products = pyreadr.read_r(str(source / "products.rda"))["products"]
    assert str(transactions.transaction_timestamp.dt.tz) == "UTC"
    assert not products.product_id.duplicated().any()
    money = {}
    for column in ("sales_value", "retail_disc", "coupon_disc", "coupon_match_disc"):
        values = transactions[column]
        decimals = [Decimal(str(value)) for value in values]
        assert all(value.is_finite() for value in decimals)
        # R stores source money as doubles. Permit only serialization noise,
        # record it, then reconcile using integer cents (never float sums).
        deviations = [abs(value * 100 - (value * 100).to_integral_value()) for value in decimals]
        assert max(deviations) < Decimal("0.00000001")
        cents = np.array([int((value * 100).to_integral_value()) for value in decimals], dtype=np.int64)
        money[column] = {
            "negative_rows": int((cents < 0).sum()),
            "zero_rows": int((cents == 0).sum()),
            "positive_rows": int((cents > 0).sum()),
            "sum_cents": int(cents.sum()),
            "max_cents": int(cents.max()),
            "max_binary_source_deviation_cents": str(max(deviations)),
        }
        if column == "sales_value":
            transactions["sales_cents"] = cents

    by_basket = transactions.groupby("basket_id", sort=False)
    consistency = by_basket[["household_id", "store_id", "transaction_timestamp"]].nunique()
    baskets = by_basket.agg(
        household_id=("household_id", "first"),
        store_id=("store_id", "first"),
        timestamp=("transaction_timestamp", "min"),
        lines=("product_id", "size"),
        source_sales_cents=("sales_cents", "sum"),
    )
    history = baskets.groupby("household_id").agg(
        baskets=("timestamp", "size"), first=("timestamp", "min"), last=("timestamp", "max")
    )
    spans = (history["last"] - history["first"]).dt.total_seconds() / 86400
    joined = transactions.merge(products, on="product_id", how="left", validate="many_to_one", indicator=True)
    product_missing = joined["_merge"].eq("left_only")
    category_missing = joined.product_category.isna()
    source_columns = [column for column in transactions.columns if column != "sales_cents"]

    cutoff = pd.Timestamp("2017-07-01T00:00:00Z")
    window_metrics = {}
    windows = {}
    for days in (7, 30):
        selected = baskets[(baskets.timestamp >= cutoff - pd.Timedelta(days=days)) & (baskets.timestamp < cutoff)]
        counts = selected.groupby("household_id").size().reindex(history.index, fill_value=0)
        windows[days] = set(selected.index)
        window_metrics[str(days)] = {
            "basket_count": int(len(selected)),
            "households_with_purchases": int((counts > 0).sum()),
            "households_without_purchases": int((counts == 0).sum()),
            "median_baskets_all_households": float(counts.median()),
            "median_baskets_purchasing_households": float(counts[counts > 0].median()),
        }
    assert windows[7].issubset(windows[30])
    assert int(baskets.lines.sum()) == len(transactions)
    assert int(baskets.source_sales_cents.sum()) == money["sales_value"]["sum_cents"]
    assert int(product_missing.sum() + (~product_missing).sum()) == len(transactions)

    # Anonymous actual basket, showing category totals without publishing household IDs.
    example_index = baskets[(baskets.lines >= 5) & (baskets.source_sales_cents > 0)].index[0]
    example = joined[joined.basket_id == example_index]
    category_totals = example.groupby("product_category", dropna=False).sales_cents.sum()
    assert int(category_totals.sum()) == int(baskets.loc[example_index, "source_sales_cents"])

    return {
        "source_commit": (source / "source_commit.txt").read_text().strip(),
        "reader": {"pyreadr": pyreadr.__version__, "pandas": pd.__version__, "timezone": "UTC"},
        "files": {name: {"bytes": (source / name).stat().st_size, "sha256": hashlib.sha256((source / name).read_bytes()).hexdigest()} for name in ("transactions.rds", "products.rda", "DESCRIPTION", "prep-data.R")},
        "transactions": {
            "rows": len(transactions), "columns": source_columns,
            "households": int(transactions.household_id.nunique()),
            "stores": int(transactions.store_id.nunique()),
            "products": int(transactions.product_id.nunique()),
            "missing": {key: int(value) for key, value in transactions[source_columns].isna().sum().items()},
            "exact_duplicate_rows": int(transactions[source_columns].duplicated().sum()),
            "duplicate_basket_product_rows": int(transactions.duplicated(["basket_id", "product_id"]).sum()),
            "quantity_nonpositive": int((transactions.quantity <= 0).sum()),
            "quantity_fractional": int((transactions.quantity % 1 != 0).sum()),
            "min_utc": transactions.transaction_timestamp.min().isoformat(),
            "max_utc": transactions.transaction_timestamp.max().isoformat(),
            "local_dates_observed": int(transactions.transaction_timestamp.dt.tz_convert("America/New_York").dt.date.nunique()),
            "money": money,
        },
        "baskets": {
            "count": len(baskets),
            "inconsistent": {key: int((consistency[key] > 1).sum()) for key in consistency.columns},
            "zero_source_sales": int((baskets.source_sales_cents == 0).sum()),
            "source_sales_cents_quantiles": {str(q): float(baskets.source_sales_cents.quantile(q)) for q in (0, 0.25, 0.5, 0.75, 0.95, 1)},
        },
        "household_history": {
            "baskets_quantiles": {str(q): float(history.baskets.quantile(q)) for q in (0, 0.25, 0.5, 0.75, 1)},
            "households_at_least_5_baskets": int((history.baskets >= 5).sum()),
            "households_at_least_10_baskets": int((history.baskets >= 10).sum()),
            "households_span_at_least_30_days": int((spans >= 30).sum()),
            "households_span_at_least_90_days": int((spans >= 90).sum()),
        },
        "product_metadata": {
            "rows": len(products), "columns": list(products.columns),
            "missing": {key: int(value) for key, value in products.isna().sum().items()},
            "departments": int(products.department.nunique()),
            "categories": int(products.product_category.nunique()),
            "types": int(products.product_type.nunique()),
            "transaction_products_missing_metadata": int(joined.loc[product_missing, "product_id"].nunique()),
            "transaction_rows_missing_metadata": int(product_missing.sum()),
            "transaction_rows_missing_category": int(category_missing.sum()),
            "positive_sales_rows_missing_category": int((category_missing & (joined.sales_cents > 0)).sum()),
            "department_line_counts": {str(key): int(value) for key, value in joined.department.value_counts(dropna=False).items()},
        },
        "example_basket": {
            "utc_timestamp": baskets.loc[example_index, "timestamp"].isoformat(),
            "line_count": int(len(example)),
            "source_sales_cents": int(baskets.loc[example_index, "source_sales_cents"]),
            "category_sales_cents": {str(key): int(value) for key, value in category_totals.items()},
        },
        "window_demo": {"cutoff_utc": cutoff.isoformat(), "windows": window_metrics},
        "checks": ["unique_product_metadata_ids", "all_money_finite_cent_precision_with_documented_binary_noise", "basket_line_count_reconciles", "basket_sales_reconciles", "product_join_partition_reconciles", "7d_subset_30d", "example_category_totals_reconcile"],
    }


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source", type=Path, required=True)
    parser.add_argument("--summary", type=Path, required=True)
    args = parser.parse_args()
    result = audit(args.source)
    args.summary.write_text(json.dumps(result, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(json.dumps({"transactions": result["transactions"]["rows"], "baskets": result["baskets"]["count"], "checks_passed": len(result["checks"]), "summary": str(args.summary)}, ensure_ascii=False))
