"""
SolarVision AI — Model 3: Predictive Quality Analysis
SECOM Dataset Loader and Integrity Validator
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple
import numpy as np


@dataclass(frozen=True)
class SECOMDatasetMetadata:
    dataset_name: str
    source_url: str
    doi: str
    license: str
    donation_date: str
    total_instances: int
    raw_feature_count: int
    pass_instances: int
    fail_instances: int
    failure_rate_pct: float
    imbalance_ratio: float
    earliest_timestamp: str
    latest_timestamp: str
    missing_value_count: int
    missing_value_pct: float


class SECOMDataLoader:
    """
    Loads, parses, and validates the official UCI SECOM benchmark dataset.
    Features: 1567 instances x 590 continuous process sensors.
    Labels: -1 (Pass, 1463), 1 (Fail, 104).
    Timestamps: DD/MM/YYYY HH:MM:SS format.
    """

    DEFAULT_RAW_DIR = Path(__file__).resolve().parent / "raw"

    def __init__(self, raw_dir: Optional[Path | str] = None) -> None:
        self.raw_dir = Path(raw_dir or self.DEFAULT_RAW_DIR)
        self.features_file = self.raw_dir / "secom.data"
        self.labels_file = self.raw_dir / "secom_labels.data"
        self.names_file = self.raw_dir / "secom.names"

    def verify_files_exist(self) -> bool:
        return (
            self.features_file.exists()
            and self.features_file.stat().st_size > 0
            and self.labels_file.exists()
            and self.labels_file.stat().st_size > 0
        )

    def load_raw(self) -> Tuple[np.ndarray, np.ndarray, List[datetime]]:
        """
        Loads raw feature matrix X (float32 with NaNs), binary labels y ({0, 1}),
        and parsed UTC timestamps.
        
        Returns:
            X: np.ndarray of shape (1567, 590) with np.nan for missing sensor entries.
            y: np.ndarray of shape (1567,) where 0 = Pass (-1 original) and 1 = Fail (+1 original).
            timestamps: List of datetime objects in UTC.
        """
        if not self.verify_files_exist():
            raise FileNotFoundError(
                f"UCI SECOM dataset files missing in {self.raw_dir}. "
                f"Expected 'secom.data' and 'secom_labels.data'."
            )

        # 1. Parse labels and timestamps
        labels_raw: List[int] = []
        timestamps: List[datetime] = []

        with open(self.labels_file, "r", encoding="utf-8") as f:
            for line_idx, line in enumerate(f):
                line = line.strip()
                if not line:
                    continue
                parts = line.split(" ", 1)
                raw_lbl = int(parts[0])  # -1 or 1
                # Convert: -1 (Pass) -> 0, 1 (Fail) -> 1
                binary_label = 1 if raw_lbl == 1 else 0
                labels_raw.append(binary_label)

                # Parse timestamp: e.g. "19/07/2008 11:55:00" (DD/MM/YYYY HH:MM:SS)
                ts_str = parts[1].strip('"') if len(parts) > 1 else ""
                try:
                    dt = datetime.strptime(ts_str, "%d/%m/%Y %H:%M:%S").replace(tzinfo=timezone.utc)
                except ValueError:
                    # Fallback standard format
                    dt = datetime.fromisoformat(ts_str) if ts_str else datetime.fromtimestamp(0, tz=timezone.utc)
                timestamps.append(dt)

        y = np.array(labels_raw, dtype=np.int64)

        # 2. Parse feature matrix (space-separated float32, NaN represented as 'NaN')
        X = np.genfromtxt(self.features_file, delimiter=" ", dtype=np.float32)

        if X.shape[0] != len(y):
            raise ValueError(
                f"Row mismatch: feature matrix has {X.shape[0]} rows, labels file has {len(y)} rows."
            )

        return X, y, timestamps

    def get_provenance_metadata(self) -> SECOMDatasetMetadata:
        X, y, timestamps = self.load_raw()
        n_samples, n_features = X.shape
        n_fail = int(np.sum(y == 1))
        n_pass = int(np.sum(y == 0))
        n_nans = int(np.sum(np.isnan(X)))
        total_cells = X.size

        sorted_ts = sorted(timestamps)

        return SECOMDatasetMetadata(
            dataset_name="UCI SECOM (Semi-Conductor Manufacturing Process)",
            source_url="https://archive.ics.uci.edu/dataset/179/secom",
            doi="10.24432/C57G69",
            license="Creative Commons Attribution 4.0 International (CC-BY 4.0)",
            donation_date="2008-11-19",
            total_instances=n_samples,
            raw_feature_count=n_features,
            pass_instances=n_pass,
            fail_instances=n_fail,
            failure_rate_pct=round((n_fail / n_samples) * 100.0, 2),
            imbalance_ratio=round(n_pass / max(n_fail, 1), 2),
            earliest_timestamp=sorted_ts[0].isoformat(),
            latest_timestamp=sorted_ts[-1].isoformat(),
            missing_value_count=n_nans,
            missing_value_pct=round((n_nans / total_cells) * 100.0, 2),
        )
