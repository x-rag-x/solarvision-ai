"""
SolarVision AI — Model 4: Predictive Maintenance
Majority Baseline Classifier (Dummy Quality Benchmark)
"""

from __future__ import annotations

from typing import Any, Dict
import numpy as np


class MajorityDummyMaintenanceClassifier:
    """
    Baseline classifier that predicts class membership according to the empirical training prevalence.
    Illustrates the high accuracy paradox in imbalanced predictive maintenance.
    """

    def __init__(self) -> None:
        self.prevalence: float = 0.0
        self.majority_class: int = 0
        self.is_fitted: bool = False

    def fit(self, X: np.ndarray, y: np.ndarray) -> "MajorityDummyMaintenanceClassifier":
        y_arr = np.asarray(y, dtype=np.int32)
        self.prevalence = float(np.mean(y_arr == 1))
        self.majority_class = 0
        self.is_fitted = True
        return self

    def predict_proba(self, X: np.ndarray) -> np.ndarray:
        if not self.is_fitted:
            raise RuntimeError("Classifier is not fitted.")
        n_samples = len(X)
        return np.full(n_samples, self.prevalence, dtype=np.float32)

    def predict(self, X: np.ndarray, threshold: float = 0.50) -> np.ndarray:
        probs = self.predict_proba(X)
        return (probs >= threshold).astype(np.int32)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "model_type": "MajorityDummyMaintenanceClassifier",
            "prevalence": self.prevalence,
            "majority_class": self.majority_class,
            "is_fitted": self.is_fitted,
        }

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "MajorityDummyMaintenanceClassifier":
        clf = cls()
        clf.prevalence = float(data["prevalence"])
        clf.majority_class = int(data["majority_class"])
        clf.is_fitted = bool(data["is_fitted"])
        return clf
