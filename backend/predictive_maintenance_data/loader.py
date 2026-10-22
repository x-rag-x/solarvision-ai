"""
SolarVision AI — Model 4: Predictive Maintenance
Dataset Loader, Forensic Auditor, and Metadata Verification for UCI AI4I 2020 Dataset
"""

from __future__ import annotations

import csv
from dataclasses import asdict, dataclass
import hashlib
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple
import numpy as np

RAW_DATA_DIR = Path(__file__).resolve().parent / "raw"
DEFAULT_CSV_PATH = RAW_DATA_DIR / "ai4i2020.csv"


@dataclass(frozen=True)
class AI4IDatasetMetadata:
    dataset_name: str
    source_url: str
    doi: str
    license: str
    citation: str
    total_instances: int
    raw_feature_count: int
    input_feature_count: int
    normal_instances: int
    failure_instances: int
    failure_rate_pct: float
    imbalance_ratio: float
    is_synthetic: bool
    synthetic_generation_details: str
    sha256_hash: str
    target_name: str
    feature_names: List[str]
    failure_modes: List[str]


class AI4IDataLoader:
    """
    Loads, validates, and parses the UCI AI4I 2020 Predictive Maintenance dataset.
    Enforces strict column exclusion:
      - Excludes 'UDI' and 'Product ID' (Identifiers)
      - Excludes 'Machine failure' (Supervised Target)
      - Excludes 'TWF', 'HDF', 'PWF', 'OSF', 'RNF' (Failure Modes)
    Yields strictly the agreed 6 measurement features.
    """

    CANONICAL_FEATURE_NAMES: List[str] = [
        "type",
        "air_temperature_k",
        "process_temperature_k",
        "rotational_speed_rpm",
        "torque_nm",
        "tool_wear_min",
    ]

    RAW_COLUMN_MAPPING: Dict[str, str] = {
        "Type": "type",
        "Air temperature [K]": "air_temperature_k",
        "Process temperature [K]": "process_temperature_k",
        "Rotational speed [rpm]": "rotational_speed_rpm",
        "Torque [Nm]": "torque_nm",
        "Tool wear [min]": "tool_wear_min",
    }

    FAILURE_MODE_COLUMNS: List[str] = ["TWF", "HDF", "PWF", "OSF", "RNF"]

    def __init__(self, csv_path: Optional[Path | str] = None) -> None:
        self.csv_path = Path(csv_path or DEFAULT_CSV_PATH)

    def verify_file_exists(self) -> bool:
        return self.csv_path.exists() and self.csv_path.is_file()

    def get_sha256_hash(self) -> str:
        if not self.verify_file_exists():
            raise FileNotFoundError(f"AI4I 2020 dataset not found at {self.csv_path}")
        return hashlib.sha256(self.csv_path.read_bytes()).hexdigest()

    def load_raw(
        self,
    ) -> Tuple[np.ndarray, np.ndarray, np.ndarray, List[Dict[str, Any]]]:
        """
        Loads the dataset from disk.
        Returns:
            X_measurements: (N, 6) object array with [type, air_temp, proc_temp, rpm, torque, tool_wear]
            y_failure: (N,) int array with 0 (healthy) or 1 (machine failure)
            failure_modes: (N, 5) int array with [TWF, HDF, PWF, OSF, RNF]
            raw_records: list of original row dictionaries for forensic inspection
        """
        if not self.verify_file_exists():
            from .fetch_ai4i import fetch_and_verify_ai4i
            fetch_and_verify_ai4i()

        raw_records: List[Dict[str, Any]] = []
        X_list: List[List[Any]] = []
        y_list: List[int] = []
        modes_list: List[List[int]] = []

        with open(self.csv_path, mode="r", encoding="utf-8-sig") as f:
            reader = csv.DictReader(f)
            for row in reader:
                raw_records.append(dict(row))

                # Extract exactly the agreed 6 measurement features in strict canonical order
                feature_row = [
                    str(row["Type"]).strip(),
                    float(row["Air temperature [K]"]),
                    float(row["Process temperature [K]"]),
                    float(row["Rotational speed [rpm]"]),
                    float(row["Torque [Nm]"]),
                    float(row["Tool wear [min]"]),
                ]
                X_list.append(feature_row)

                # Extract supervised binary target
                y_list.append(int(row["Machine failure"]))

                # Extract 5 failure mode labels (strictly quarantined for diagnostic audit)
                modes_row = [int(row[col]) for col in self.FAILURE_MODE_COLUMNS]
                modes_list.append(modes_row)

        X_arr = np.array(X_list, dtype=object)
        y_arr = np.array(y_list, dtype=np.int32)
        modes_arr = np.array(modes_list, dtype=np.int32)

        return X_arr, y_arr, modes_arr, raw_records

    def get_provenance_metadata(self) -> AI4IDatasetMetadata:
        sha256 = self.get_sha256_hash()
        X, y, modes, _ = self.load_raw()

        n_total = len(y)
        n_fail = int(np.sum(y == 1))
        n_pass = int(np.sum(y == 0))
        fail_pct = round((n_fail / n_total) * 100.0, 2)
        imbalance = round(n_pass / max(n_fail, 1), 2)

        return AI4IDatasetMetadata(
            dataset_name="UCI AI4I 2020 Predictive Maintenance Dataset",
            source_url="https://archive.ics.uci.edu/dataset/601/ai4i+2020+predictive+maintenance+dataset",
            doi="10.24432/C5HS5C",
            license="Creative Commons Attribution 4.0 International (CC-BY 4.0)",
            citation=(
                "Matzka, S. (2020). Explainable Artificial Intelligence for Predictive "
                "Maintenance: A General Approach with Automated Feature Engineering. "
                "IEEE International Conference on Emerging Technologies and Factory Automation (ETFA 2020)."
            ),
            total_instances=n_total,
            raw_feature_count=14,
            input_feature_count=6,
            normal_instances=n_pass,
            failure_instances=n_fail,
            failure_rate_pct=fail_pct,
            imbalance_ratio=imbalance,
            is_synthetic=True,
            synthetic_generation_details=(
                "Physically modeled simulation reflecting real milling process logs with mathematical "
                "failure rules for Tool Wear Failure (TWF), Heat Dissipation Failure (HDF), "
                "Power Failure (PWF), Overstrain Failure (OSF), and Random Failure (RNF)."
            ),
            sha256_hash=sha256,
            target_name="Machine failure (binary: 0 = Normal, 1 = Failure)",
            feature_names=list(self.CANONICAL_FEATURE_NAMES),
            failure_modes=list(self.FAILURE_MODE_COLUMNS),
        )
