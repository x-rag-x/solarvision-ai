"""
SolarVision AI — Model 2: Manufacturing Root Cause Analysis
Training-Only Preprocessing Pipeline & Missingness Masking

Enforces strict data hygiene in photovoltaic manufacturing time-series:
1. Calculates empirical normalization statistics strictly on training data (no leakage to val/test).
2. Generates explicit missingness masks so that missing sensors do NOT falsely mimic nominal setpoints.
3. Serializes learned parameters to machine-readable JSON artifacts.
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple
import numpy as np

from .feature_spec import (
    CANONICAL_FEATURES_V2,
    CANONICAL_FEATURE_NAMES_V2,
    CANONICAL_FEATURE_COUNT_V2,
    FEATURE_SCHEMA_VERSION,
    FeatureDomain,
    MissingValuePolicy,
)


class TrainingOnlyFeaturePreprocessor:
    """
    Fits feature scaling and imputation parameters strictly on training partitions.
    Never uses global or validation/test data during fitting.
    """

    def __init__(self, clip_zscore: float = 5.0) -> None:
        self.clip_zscore = clip_zscore
        self.feature_names: List[str] = list(CANONICAL_FEATURE_NAMES_V2)
        self.n_features = len(self.feature_names)

        # Learned parameters (strictly from training data)
        self.fitted_: bool = False
        self.means_: np.ndarray = np.zeros(self.n_features, dtype=np.float64)
        self.stds_: np.ndarray = np.ones(self.n_features, dtype=np.float64)
        self.medians_: np.ndarray = np.zeros(self.n_features, dtype=np.float64)
        self.observed_counts_: np.ndarray = np.zeros(self.n_features, dtype=np.int64)
        self.missing_rates_: np.ndarray = np.zeros(self.n_features, dtype=np.float64)

    def fit(self, X_train: np.ndarray, missing_mask_train: Optional[np.ndarray] = None) -> TrainingOnlyFeaturePreprocessor:
        """
        Fits empirical means, standard deviations, and missingness rates strictly on X_train.
        
        Args:
            X_train: Numerical feature matrix of shape (N_samples, 48).
            missing_mask_train: Boolean mask of shape (N_samples, 48) where True indicates missing data.
        """
        X = np.asarray(X_train, dtype=np.float64)
        if X.ndim != 2 or X.shape[1] != self.n_features:
            raise ValueError(
                f"Expected X_train shape (N, {self.n_features}), got {X.shape}"
            )

        n_samples = X.shape[0]
        if n_samples == 0:
            raise ValueError("Cannot fit preprocessor on 0 training samples.")

        if missing_mask_train is None:
            # Detect NaNs as missing
            missing_mask = np.isnan(X)
        else:
            missing_mask = np.asarray(missing_mask_train, dtype=bool)

        self.means_ = np.zeros(self.n_features, dtype=np.float64)
        self.stds_ = np.ones(self.n_features, dtype=np.float64)
        self.medians_ = np.zeros(self.n_features, dtype=np.float64)
        self.observed_counts_ = np.zeros(self.n_features, dtype=np.int64)
        self.missing_rates_ = np.zeros(self.n_features, dtype=np.float64)

        for col_idx in range(self.n_features):
            col_missing = missing_mask[:, col_idx]
            observed_vals = X[~col_missing, col_idx]
            obs_count = len(observed_vals)
            self.observed_counts_[col_idx] = obs_count
            self.missing_rates_[col_idx] = float(np.mean(col_missing))

            feat_def = CANONICAL_FEATURES_V2[col_idx]

            if obs_count > 0:
                mean_val = float(np.mean(observed_vals))
                std_val = float(np.std(observed_vals))
                med_val = float(np.median(observed_vals))

                self.means_[col_idx] = mean_val
                # Guard against zero variance in constant features
                self.stds_[col_idx] = std_val if std_val > 1e-6 else 1.0
                self.medians_[col_idx] = med_val
            else:
                # Fallback to domain nominal definition only if completely unobserved in train
                self.means_[col_idx] = feat_def.nominal_mean if feat_def.nominal_mean is not None else 0.0
                self.stds_[col_idx] = feat_def.nominal_std if feat_def.nominal_std is not None else 1.0
                self.medians_[col_idx] = self.means_[col_idx]

        self.fitted_ = True
        return self

    def transform(
        self, X: np.ndarray, missing_mask: Optional[np.ndarray] = None
    ) -> Tuple[np.ndarray, np.ndarray]:
        """
        Transforms input matrix using strictly training-fitted statistics.
        
        Returns:
            (X_transformed, missing_indicators)
            - X_transformed: Normalized feature matrix with clipped z-scores.
            - missing_indicators: Boolean/float mask indicating which observations were missing,
              preventing models from misinterpreting imputed baselines as true normal conditions.
        """
        if not self.fitted_:
            raise RuntimeError("Preprocessor must be fitted on training data before transform.")

        X_in = np.asarray(X, dtype=np.float64).copy()
        if X_in.ndim != 2 or X_in.shape[1] != self.n_features:
            raise ValueError(f"Expected shape (N, {self.n_features}), got {X_in.shape}")

        if missing_mask is None:
            mask = np.isnan(X_in)
        else:
            mask = np.asarray(missing_mask, dtype=bool)

        X_out = np.zeros_like(X_in, dtype=np.float32)

        for col_idx in range(self.n_features):
            feat_def = CANONICAL_FEATURES_V2[col_idx]
            col_mask = mask[:, col_idx]

            vals = X_in[:, col_idx]
            # Replace NaNs with median/mean learned from training partition
            vals[col_mask] = self.medians_[col_idx]

            if feat_def.domain == FeatureDomain.SENSOR_TELEMETRY:
                # Standardize using training empirical statistics
                z = (vals - self.means_[col_idx]) / self.stds_[col_idx]
                X_out[:, col_idx] = np.clip(z, -self.clip_zscore, self.clip_zscore)
            else:
                # Non-sensor features (counts, binary flags, ratios) retain their natural scale
                # clamped to physical range
                X_out[:, col_idx] = np.clip(vals, feat_def.min_valid, feat_def.max_valid)

        missing_indicators = mask.astype(np.float32)
        return X_out, missing_indicators

    def fit_transform(
        self, X_train: np.ndarray, missing_mask_train: Optional[np.ndarray] = None
    ) -> Tuple[np.ndarray, np.ndarray]:
        return self.fit(X_train, missing_mask_train).transform(X_train, missing_mask_train)

    def to_dict(self) -> Dict[str, Any]:
        """Serializes learned parameters to dictionary."""
        if not self.fitted_:
            raise RuntimeError("Preprocessor is not fitted.")
        return {
            "schema_version": FEATURE_SCHEMA_VERSION,
            "clip_zscore": self.clip_zscore,
            "feature_names": self.feature_names,
            "means": self.means_.tolist(),
            "stds": self.stds_.tolist(),
            "medians": self.medians_.tolist(),
            "observed_counts": self.observed_counts_.tolist(),
            "missing_rates": self.missing_rates_.tolist(),
        }

    def save(self, file_path: Path | str) -> None:
        """Saves fitted preprocessor to JSON file."""
        path = Path(file_path)
        path.parent.mkdir(parents=True, exist_ok=True)
        with open(path, "w", encoding="utf-8") as f:
            json.dump(self.to_dict(), f, indent=2)

    @classmethod
    def load(cls, file_path: Path | str) -> TrainingOnlyFeaturePreprocessor:
        """Loads fitted preprocessor from JSON file."""
        with open(file_path, "r", encoding="utf-8") as f:
            data = json.load(f)

        preprocessor = cls(clip_zscore=data.get("clip_zscore", 5.0))
        preprocessor.feature_names = data["feature_names"]
        preprocessor.n_features = len(preprocessor.feature_names)
        preprocessor.means_ = np.array(data["means"], dtype=np.float64)
        preprocessor.stds_ = np.array(data["stds"], dtype=np.float64)
        preprocessor.medians_ = np.array(data["medians"], dtype=np.float64)
        preprocessor.observed_counts_ = np.array(data["observed_counts"], dtype=np.int64)
        preprocessor.missing_rates_ = np.array(data["missing_rates"], dtype=np.float64)
        preprocessor.fitted_ = True
        return preprocessor
