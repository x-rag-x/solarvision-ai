"""
SolarVision AI — Model 4: Predictive Maintenance
Zero-Leakage Preprocessor for 6 Agreed Measurement Fields
"""

from __future__ import annotations

from typing import Any, Dict, List, Optional
import numpy as np


class PredictiveMaintenancePreprocessor:
    """
    Transforms raw 6-feature measurement inputs into standardized numerical tensors.
    Guarantees zero data leakage: all statistics (means, standard deviations, medians)
    are computed strictly on the training partition.

    Input Features (Exact Order):
      0: type ('L', 'M', 'H')
      1: air_temperature_k (float)
      2: process_temperature_k (float)
      3: rotational_speed_rpm (float)
      4: torque_nm (float)
      5: tool_wear_min (float)
    """

    CANONICAL_FEATURE_NAMES: List[str] = [
        "type",
        "air_temperature_k",
        "process_temperature_k",
        "rotational_speed_rpm",
        "torque_nm",
        "tool_wear_min",
    ]

    TYPE_MAPPING: Dict[str, float] = {
        "L": 0.0,
        "M": 1.0,
        "H": 2.0,
    }

    def __init__(
        self,
        clip_zscore: float = 5.0,
    ) -> None:
        self.clip_zscore = float(clip_zscore)
        self.is_fitted: bool = False
        self.n_input_features: int = 6
        self.n_output_features: int = 6

        # Statistics fitted strictly on D_train
        self.medians: Optional[np.ndarray] = None
        self.means: Optional[np.ndarray] = None
        self.stds: Optional[np.ndarray] = None

    def _encode_row(self, row: List[Any] | np.ndarray) -> np.ndarray:
        """Converts raw row with potential string 'Type' into 6 numerical floats."""
        t_val = row[0]
        if isinstance(t_val, str):
            encoded_type = self.TYPE_MAPPING.get(t_val.strip().upper(), 0.0)
        else:
            encoded_type = float(t_val)

        return np.array([
            encoded_type,
            float(row[1]) if row[1] is not None else np.nan,
            float(row[2]) if row[2] is not None else np.nan,
            float(row[3]) if row[3] is not None else np.nan,
            float(row[4]) if row[4] is not None else np.nan,
            float(row[5]) if row[5] is not None else np.nan,
        ], dtype=np.float64)

    def fit(self, X: np.ndarray | List[List[Any]]) -> "PredictiveMaintenancePreprocessor":
        """Fits imputer and standardizer strictly on training data."""
        numeric_rows: List[np.ndarray] = []
        for r in X:
            numeric_rows.append(self._encode_row(r))

        X_num = np.vstack(numeric_rows)
        if X_num.shape[1] != self.n_input_features:
            raise ValueError(f"Expected {self.n_input_features} features, got {X_num.shape[1]}")

        # Compute medians for imputation
        self.medians = np.nanmedian(X_num, axis=0)

        # Impute temporary matrix to compute mean and std
        X_imp = X_num.copy()
        for j in range(self.n_input_features):
            mask = np.isnan(X_imp[:, j])
            X_imp[mask, j] = self.medians[j]

        self.means = np.mean(X_imp, axis=0)
        self.stds = np.std(X_imp, axis=0)
        # Avoid division by zero
        self.stds[self.stds < 1e-7] = 1.0

        self.is_fitted = True
        return self

    def transform(self, X: np.ndarray | List[List[Any]]) -> np.ndarray:
        """Transforms input measurements using fitted training statistics."""
        if not self.is_fitted:
            raise RuntimeError("Preprocessor must be fitted on training data before calling transform().")

        numeric_rows: List[np.ndarray] = []
        for r in X:
            numeric_rows.append(self._encode_row(r))

        X_num = np.vstack(numeric_rows)

        # 1. Impute missing values using training medians
        for j in range(self.n_input_features):
            mask = np.isnan(X_num[:, j])
            X_num[mask, j] = self.medians[j]

        # 2. Standardize continuous features (type, air_temp, proc_temp, rpm, torque, tool_wear)
        z = (X_num - self.means) / self.stds
        z_clipped = np.clip(z, -self.clip_zscore, self.clip_zscore)

        return z_clipped.astype(np.float32)

    def fit_transform(self, X: np.ndarray | List[List[Any]]) -> np.ndarray:
        return self.fit(X).transform(X)

    def to_dict(self) -> Dict[str, Any]:
        if not self.is_fitted:
            raise RuntimeError("Cannot serialize unfitted preprocessor.")
        return {
            "n_input_features": self.n_input_features,
            "n_output_features": self.n_output_features,
            "feature_names": list(self.CANONICAL_FEATURE_NAMES),
            "type_mapping": dict(self.TYPE_MAPPING),
            "clip_zscore": self.clip_zscore,
            "medians": [float(v) for v in self.medians],
            "means": [float(v) for v in self.means],
            "stds": [float(v) for v in self.stds],
        }

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "PredictiveMaintenancePreprocessor":
        prep = cls(clip_zscore=data.get("clip_zscore", 5.0))
        prep.medians = np.array(data["medians"], dtype=np.float64)
        prep.means = np.array(data["means"], dtype=np.float64)
        prep.stds = np.array(data["stds"], dtype=np.float64)
        prep.n_input_features = data.get("n_input_features", 6)
        prep.n_output_features = data.get("n_output_features", 6)
        prep.is_fitted = True
        return prep
