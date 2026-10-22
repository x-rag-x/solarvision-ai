"""
SolarVision AI — Model 3: Predictive Quality Analysis
Reproducible, Zero-Leakage Preprocessing Pipeline for SECOM Data
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple
import numpy as np


class QualityDataPreprocessor:
    """
    Fits feature selection, median imputation, and standard scaling strictly
    on training data (D_train) to guarantee zero data leakage.
    
    Processing Steps:
    1. Identify and remove constant/zero-variance columns (on D_train).
    2. Identify and remove excessive missingness columns (>max_missing_ratio, default 0.50).
    3. Compute feature-wise medians for remaining columns (on D_train).
    4. Compute feature-wise means and standard deviations (on D_train).
    5. Optionally generate binary missingness indicators.
    6. Transform inputs with imputation and z-score scaling, clipped to [-clip_zscore, +clip_zscore].
    """

    def __init__(
        self,
        max_missing_ratio: float = 0.50,
        clip_zscore: float = 5.0,
        add_missing_indicators: bool = True,
    ) -> None:
        self.max_missing_ratio = float(max_missing_ratio)
        self.clip_zscore = float(clip_zscore)
        self.add_missing_indicators = bool(add_missing_indicators)

        self.is_fitted: bool = False
        self.n_input_features: int = 0
        self.constant_feature_indices: List[int] = []
        self.high_missing_feature_indices: List[int] = []
        self.retained_feature_indices: List[int] = []
        self.feature_medians: np.ndarray = np.empty(0, dtype=np.float32)
        self.feature_means: np.ndarray = np.empty(0, dtype=np.float32)
        self.feature_stds: np.ndarray = np.empty(0, dtype=np.float32)
        self.indicator_feature_indices: List[int] = []  # Retained features that have missing values
        self.n_output_features: int = 0

    def fit(self, X_train: np.ndarray) -> QualityDataPreprocessor:
        """
        Learns preprocessing parameters strictly from X_train.
        """
        X = np.asarray(X_train, dtype=np.float32)
        n_samples, n_features = X.shape
        self.n_input_features = n_features

        nan_mask = np.isnan(X)

        # 1. Identify columns exceeding missing ratio
        missing_counts = np.sum(nan_mask, axis=0)
        missing_ratios = missing_counts / float(n_samples)
        high_missing_set = set(int(c) for c in np.where(missing_ratios > self.max_missing_ratio)[0])
        self.high_missing_feature_indices = sorted(list(high_missing_set))

        # 2. Identify constant / zero-variance columns on non-NaN entries
        constant_set = set()
        for c in range(n_features):
            if c in high_missing_set:
                continue
            valid_vals = X[:, c][~nan_mask[:, c]]
            if len(valid_vals) == 0:
                constant_set.add(c)
            elif np.all(valid_vals == valid_vals[0]) or np.std(valid_vals) < 1e-8:
                constant_set.add(c)
        self.constant_feature_indices = sorted(list(constant_set))

        # 3. Retain features that are neither high-missing nor constant
        drop_set = high_missing_set.union(constant_set)
        self.retained_feature_indices = [c for c in range(n_features) if c not in drop_set]

        # 4. Compute training medians, means, and stds for retained features
        n_retained = len(self.retained_feature_indices)
        medians = np.zeros(n_retained, dtype=np.float32)
        means = np.zeros(n_retained, dtype=np.float32)
        stds = np.zeros(n_retained, dtype=np.float32)
        has_missing_on_train: List[int] = []

        for out_idx, orig_col in enumerate(self.retained_feature_indices):
            valid_vals = X[:, orig_col][~nan_mask[:, orig_col]]
            if np.any(nan_mask[:, orig_col]):
                has_missing_on_train.append(out_idx)

            if len(valid_vals) > 0:
                med = float(np.median(valid_vals))
                mu = float(np.mean(valid_vals))
                sig = float(np.std(valid_vals))
                if sig < 1e-7:
                    sig = 1.0
            else:
                med = 0.0
                mu = 0.0
                sig = 1.0

            medians[out_idx] = med
            means[out_idx] = mu
            stds[out_idx] = sig

        self.feature_medians = medians
        self.feature_means = means
        self.feature_stds = stds
        self.indicator_feature_indices = has_missing_on_train

        # Output feature count = retained features + (missing indicators if enabled)
        if self.add_missing_indicators:
            self.n_output_features = n_retained + len(self.indicator_feature_indices)
        else:
            self.n_output_features = n_retained

        self.is_fitted = True
        return self

    def transform(self, X: np.ndarray) -> np.ndarray:
        """
        Transforms feature matrix X using frozen training statistics.
        """
        if not self.is_fitted:
            raise RuntimeError("QualityDataPreprocessor must be fitted before calling transform().")

        X_in = np.asarray(X, dtype=np.float32)
        if X_in.shape[1] != self.n_input_features:
            raise ValueError(
                f"Feature dimension mismatch: preprocessor expected {self.n_input_features} features, "
                f"received {X_in.shape[1]}."
            )

        n_samples = X_in.shape[0]

        # Extract retained columns
        X_sub = X_in[:, self.retained_feature_indices].copy()
        nan_sub = np.isnan(X_sub)

        # Impute missing values with training medians
        for j in range(len(self.retained_feature_indices)):
            col_nan = nan_sub[:, j]
            if np.any(col_nan):
                X_sub[col_nan, j] = self.feature_medians[j]

        # Standardize using training mean and std
        X_scaled = (X_sub - self.feature_means) / (self.feature_stds + 1e-7)

        # Clip extreme outliers
        if self.clip_zscore > 0:
            X_scaled = np.clip(X_scaled, -self.clip_zscore, self.clip_zscore)

        if not self.add_missing_indicators or len(self.indicator_feature_indices) == 0:
            return X_scaled

        # Append missingness indicators
        indicators = nan_sub[:, self.indicator_feature_indices].astype(np.float32)
        return np.hstack([X_scaled, indicators])

    def fit_transform(self, X_train: np.ndarray) -> np.ndarray:
        return self.fit(X_train).transform(X_train)

    def to_dict(self) -> Dict[str, Any]:
        if not self.is_fitted:
            raise RuntimeError("Cannot serialize unfitted preprocessor.")
        return {
            "max_missing_ratio": self.max_missing_ratio,
            "clip_zscore": self.clip_zscore,
            "add_missing_indicators": self.add_missing_indicators,
            "n_input_features": self.n_input_features,
            "constant_feature_indices": self.constant_feature_indices,
            "high_missing_feature_indices": self.high_missing_feature_indices,
            "retained_feature_indices": self.retained_feature_indices,
            "feature_medians": self.feature_medians.tolist(),
            "feature_means": self.feature_means.tolist(),
            "feature_stds": self.feature_stds.tolist(),
            "indicator_feature_indices": self.indicator_feature_indices,
            "n_output_features": self.n_output_features,
        }

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> QualityDataPreprocessor:
        p = cls(
            max_missing_ratio=data["max_missing_ratio"],
            clip_zscore=data["clip_zscore"],
            add_missing_indicators=data["add_missing_indicators"],
        )
        p.is_fitted = True
        p.n_input_features = data["n_input_features"]
        p.constant_feature_indices = data["constant_feature_indices"]
        p.high_missing_feature_indices = data["high_missing_feature_indices"]
        p.retained_feature_indices = data["retained_feature_indices"]
        p.feature_medians = np.array(data["feature_medians"], dtype=np.float32)
        p.feature_means = np.array(data["feature_means"], dtype=np.float32)
        p.feature_stds = np.array(data["feature_stds"], dtype=np.float32)
        p.indicator_feature_indices = data["indicator_feature_indices"]
        p.n_output_features = data["n_output_features"]
        return p

    def save(self, filepath: Path | str) -> None:
        Path(filepath).write_text(json.dumps(self.to_dict(), indent=2), encoding="utf-8")

    @classmethod
    def load(cls, filepath: Path | str) -> QualityDataPreprocessor:
        data = json.loads(Path(filepath).read_text(encoding="utf-8"))
        return cls.from_dict(data)
