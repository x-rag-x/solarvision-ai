"""
SolarVision AI — Model 3: Predictive Quality Analysis
Gradient Boosted Decision Trees & XGBoost Adapter for Binary Quality Prediction
"""

from __future__ import annotations

import json
from typing import Any, Dict, List, Optional, Tuple
import numpy as np


class RegressionStump:
    """Fast single-split regression decision stump for gradient boosting."""

    def __init__(
        self,
        feature_idx: int = 0,
        threshold: float = 0.0,
        left_val: float = 0.0,
        right_val: float = 0.0,
    ) -> None:
        self.feature_idx = int(feature_idx)
        self.threshold = float(threshold)
        self.left_val = float(left_val)
        self.right_val = float(right_val)

    def predict(self, X: np.ndarray) -> np.ndarray:
        preds = np.where(X[:, self.feature_idx] <= self.threshold, self.left_val, self.right_val)
        return preds.astype(np.float32)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "feature_idx": self.feature_idx,
            "threshold": self.threshold,
            "left_val": self.left_val,
            "right_val": self.right_val,
        }

    @classmethod
    def from_dict(cls, d: Dict[str, Any]) -> RegressionStump:
        return cls(
            feature_idx=d["feature_idx"],
            threshold=d["threshold"],
            left_val=d["left_val"],
            right_val=d["right_val"],
        )


class GradientBoostedQualityClassifier:
    """
    LogitBoost gradient boosting binary classifier for tabular sensor data.
    Minimizes binary cross-entropy using gradient descent in function space with shrinkage.
    """

    def __init__(
        self,
        n_estimators: int = 60,
        learning_rate: float = 0.10,
        max_depth: int = 3,
        random_state: int = 42,
    ) -> None:
        self.n_estimators = int(n_estimators)
        self.learning_rate = float(learning_rate)
        self.max_depth = int(max_depth)
        self.random_state = int(random_state)

        self.initial_log_odds: float = 0.0
        self.stumps: List[RegressionStump] = []
        self.is_fitted: bool = False
        self.has_native_xgboost: bool = False

    def fit(self, X: np.ndarray, y: np.ndarray) -> GradientBoostedQualityClassifier:
        rng = np.random.RandomState(self.random_state)
        n_samples, n_features = X.shape

        p_pos = float(np.mean(y == 1))
        p_pos = max(1e-4, min(1.0 - 1e-4, p_pos))
        self.initial_log_odds = float(np.log(p_pos / (1.0 - p_pos)))

        f_vals = np.full(n_samples, self.initial_log_odds, dtype=np.float32)
        self.stumps = []

        for m in range(self.n_estimators):
            # Compute current model probabilities
            probs = 1.0 / (1.0 + np.exp(-np.clip(f_vals, -20.0, 20.0)))
            # Negative gradient of binary cross-entropy (pseudo-residuals)
            residuals = (y - probs).astype(np.float32)

            # Subsample features (sqrt(D))
            k = max(2, int(np.sqrt(n_features)))
            feat_subset = rng.choice(n_features, size=k, replace=False)

            best_mse = float("inf")
            best_stump: Optional[RegressionStump] = None

            for f_idx in feat_subset:
                vals = X[:, f_idx]
                pcts = np.percentile(vals, [25, 50, 75])

                for t in pcts:
                    left_mask = vals <= t
                    right_mask = ~left_mask

                    if np.sum(left_mask) == 0 or np.sum(right_mask) == 0:
                        continue

                    l_val = float(np.mean(residuals[left_mask]))
                    r_val = float(np.mean(residuals[right_mask]))

                    pred_r = np.where(left_mask, l_val, r_val)
                    mse = float(np.mean((residuals - pred_r) ** 2))

                    if mse < best_mse:
                        best_mse = mse
                        best_stump = RegressionStump(
                            feature_idx=f_idx,
                            threshold=float(t),
                            left_val=l_val,
                            right_val=r_val,
                        )

            if best_stump is not None:
                self.stumps.append(best_stump)
                f_vals += self.learning_rate * best_stump.predict(X)

        self.is_fitted = True
        return self

    def predict_proba(self, X: np.ndarray) -> np.ndarray:
        if not self.is_fitted:
            raise RuntimeError("Model is not fitted.")
        f_vals = np.full(len(X), self.initial_log_odds, dtype=np.float32)
        for stump in self.stumps:
            f_vals += self.learning_rate * stump.predict(X)
        probs = 1.0 / (1.0 + np.exp(-np.clip(f_vals, -20.0, 20.0)))
        return probs.astype(np.float32)

    def predict(self, X: np.ndarray, threshold: float = 0.50) -> np.ndarray:
        probs = self.predict_proba(X)
        return (probs >= threshold).astype(np.int64)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "model_type": "GradientBoostedQualityClassifier",
            "n_estimators": self.n_estimators,
            "learning_rate": self.learning_rate,
            "initial_log_odds": self.initial_log_odds,
            "stumps": [s.to_dict() for s in self.stumps],
            "is_fitted": self.is_fitted,
        }

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> GradientBoostedQualityClassifier:
        m = cls(
            n_estimators=data["n_estimators"],
            learning_rate=data["learning_rate"],
        )
        m.initial_log_odds = float(data["initial_log_odds"])
        m.stumps = [RegressionStump.from_dict(d) for d in data.get("stumps", [])]
        m.is_fitted = bool(data["is_fitted"])
        return m
