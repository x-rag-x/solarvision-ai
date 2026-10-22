"""Baseline classifiers for Model 2 Root Cause benchmark comparison."""

from __future__ import annotations

from collections import Counter
from typing import Any, Dict, List, Optional
import numpy as np

from backend.root_cause_data.schema import (
    DEFECT_TO_PLAUSIBLE_CAUSES,
    ROOT_CAUSE_TAXONOMY,
)


class MajorityClassBaseline:
    """Baseline classifier predicting the most frequent training class."""

    def __init__(self):
        self.majority_class: str = ROOT_CAUSE_TAXONOMY[0]
        self.class_probabilities: np.ndarray = np.ones(len(ROOT_CAUSE_TAXONOMY)) / len(ROOT_CAUSE_TAXONOMY)
        self.classes: List[str] = list(ROOT_CAUSE_TAXONOMY)

    def fit(self, y: Any) -> MajorityClassBaseline:
        if y is None or len(y) == 0:
            return self
        if isinstance(y, np.ndarray):
            if np.issubdtype(y.dtype, np.integer):
                y = [self.classes[i] if 0 <= i < len(self.classes) else str(i) for i in y]
            else:
                y = list(y)
        counts = Counter(y)
        self.majority_class = counts.most_common(1)[0][0]

        total = len(y)
        probs = np.array([counts.get(c, 0) / total for c in self.classes], dtype=np.float32)
        # Smoothing
        if probs.sum() > 0:
            self.class_probabilities = probs / probs.sum()
        return self

    def predict(self, X: np.ndarray) -> List[str]:
        n_samples = len(X)
        return [self.majority_class] * n_samples

    def predict_proba(self, X: np.ndarray) -> np.ndarray:
        n_samples = len(X)
        return np.tile(self.class_probabilities, (n_samples, 1))


class DefectPriorHeuristicBaseline:
    """
    Expert rule-based baseline mapping Model 1 defect types to their physically
    plausible root causes without utilizing continuous sensor readings.
    """

    def __init__(self):
        self.classes: List[str] = list(ROOT_CAUSE_TAXONOMY)

    def fit(self, X: np.ndarray, y: List[str]) -> DefectPriorHeuristicBaseline:
        # Rule-based model requires no training, but adheres to standard estimator interface
        return self

    def predict_single(self, feature_dict: Dict[str, float]) -> str:
        """Applies domain rules to optical defect indicators."""
        if feature_dict.get("feat_is_star_crack", 0.0) > 0.5:
            return "mechanical_handling_impact"
        if feature_dict.get("feat_is_crack", 0.0) > 0.5:
            # Check temperature delta if present
            if abs(feature_dict.get("soldering_temp_delta_mean_w15", 0.0)) > 15.0:
                return "thermal_stress_soldering"
            return "mechanical_handling_impact"
        if feature_dict.get("feat_is_finger", 0.0) > 0.5 or feature_dict.get("feat_is_printing_error", 0.0) > 0.5:
            return "screen_mesh_clogging"
        if feature_dict.get("feat_is_thick_line", 0.0) > 0.5:
            return "squeegee_pressure_drift"
        if feature_dict.get("feat_is_short_circuit", 0.0) > 0.5:
            return "firing_thermal_profile_excursion"
        if (
            feature_dict.get("feat_is_black_core", 0.0) > 0.5
            or feature_dict.get("feat_is_dislocation", 0.0) > 0.5
        ):
            return "ingot_thermal_gradient"

        return "nominal_process_variation"

    def predict(self, X_features: List[Dict[str, float]]) -> List[str]:
        return [self.predict_single(f) for f in X_features]
