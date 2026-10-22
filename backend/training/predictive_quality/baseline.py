"""
SolarVision AI — Model 3: Predictive Quality Analysis
Baseline Dummy Classifiers for Quality Benchmark
"""

from __future__ import annotations

from typing import Any, Dict, List
import numpy as np


class MajorityDummyQualityClassifier:
    """Always predicts the majority class (Pass = 0)."""

    def __init__(self) -> None:
        self.majority_class: int = 0
        self.pos_probability: float = 0.0

    def fit(self, X: np.ndarray, y: np.ndarray) -> MajorityDummyQualityClassifier:
        n_samples = len(y)
        n_pos = int(np.sum(y == 1))
        self.pos_probability = float(n_pos / max(n_samples, 1))
        self.majority_class = 0  # Pass is majority (93.4%)
        return self

    def predict(self, X: np.ndarray) -> np.ndarray:
        return np.full(len(X), self.majority_class, dtype=np.int64)

    def predict_proba(self, X: np.ndarray) -> np.ndarray:
        """Returns P(y=1) as 0.0 (or empirical prior)."""
        return np.full(len(X), self.pos_probability, dtype=np.float32)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "model_type": "MajorityDummyQualityClassifier",
            "majority_class": self.majority_class,
            "pos_probability": self.pos_probability,
        }

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> MajorityDummyQualityClassifier:
        m = cls()
        m.majority_class = data["majority_class"]
        m.pos_probability = data["pos_probability"]
        return m
