"""
Verification and exploratory data analysis of the UCI SECOM dataset.
"""

from pathlib import Path
import numpy as np

def verify_secom():
    raw_dir = Path("backend/predictive_quality_data/raw")
    data_path = raw_dir / "secom.data"
    labels_path = raw_dir / "secom_labels.data"

    print("=== SECOM Dataset Verification ===")
    print(f"Features file: {data_path} (exists: {data_path.exists()}, size: {data_path.stat().st_size} bytes)")
    print(f"Labels file:   {labels_path} (exists: {labels_path.exists()}, size: {labels_path.stat().st_size} bytes)")

    # Read labels and timestamps
    labels = []
    timestamps = []
    with open(labels_path, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            parts = line.split(" ", 1)
            lbl = int(parts[0])
            ts = parts[1].strip('"') if len(parts) > 1 else ""
            labels.append(lbl)
            timestamps.append(ts)

    labels = np.array(labels, dtype=np.int32)
    n_samples = len(labels)
    n_pass = int(np.sum(labels == -1))
    n_fail = int(np.sum(labels == 1))
    fail_rate = n_fail / n_samples

    print(f"\nTotal instances: {n_samples}")
    print(f"Pass count (-1): {n_pass} ({n_pass / n_samples * 100:.2f}%)")
    print(f"Fail count (+1): {n_fail} ({fail_rate * 100:.2f}%)")
    print(f"Imbalance ratio: {n_pass / n_fail:.2f} : 1")
    print(f"Timestamp range: {timestamps[0]} to {timestamps[-1]}")

    # Load feature matrix using numpy fromfile or genfromtxt / loadtxt
    print("\nLoading feature matrix...")
    features = np.genfromtxt(data_path, delimiter=" ", dtype=np.float32)
    print(f"Feature matrix shape: {features.shape}")

    # Missing value analysis
    nan_mask = np.isnan(features)
    total_entries = features.size
    total_nans = int(np.sum(nan_mask))
    pct_nans = total_nans / total_entries * 100.0
    print(f"Total missing values: {total_nans} / {total_entries} ({pct_nans:.2f}%)")

    # Column missingness
    col_nans = np.sum(nan_mask, axis=0)
    col_nan_pct = col_nans / n_samples * 100.0
    cols_zero_missing = int(np.sum(col_nans == 0))
    cols_over_50_pct = int(np.sum(col_nan_pct > 50.0))
    cols_over_20_pct = int(np.sum(col_nan_pct > 20.0))

    print(f"Features with zero missing values: {cols_zero_missing} / {features.shape[1]}")
    print(f"Features with >20% missing values: {cols_over_20_pct} / {features.shape[1]}")
    print(f"Features with >50% missing values: {cols_over_50_pct} / {features.shape[1]}")

    # Constant / zero-variance features (excluding NaNs)
    constant_cols = []
    for c in range(features.shape[1]):
        valid_vals = features[:, c][~nan_mask[:, c]]
        if len(valid_vals) == 0:
            constant_cols.append(c)
        elif np.all(valid_vals == valid_vals[0]):
            constant_cols.append(c)

    print(f"Constant/Zero-variance features: {len(constant_cols)} (columns: {constant_cols[:10]}...)")

    return {
        "n_samples": n_samples,
        "n_features": features.shape[1],
        "n_pass": n_pass,
        "n_fail": n_fail,
        "fail_rate": fail_rate,
        "total_nans": total_nans,
        "pct_nans": pct_nans,
        "cols_zero_missing": cols_zero_missing,
        "cols_over_50_pct": cols_over_50_pct,
        "constant_cols": constant_cols,
    }

if __name__ == "__main__":
    verify_secom()
