"""
SolarVision AI — Model 3: Predictive Quality Analysis
Cost-Sensitive Operating Threshold Optimization for Rare Yield Failures
"""

from __future__ import annotations

from typing import Any, Dict, List, Tuple
import numpy as np

from .metrics import QualityMetricsCalculator, QualityMetricsResult


class ThresholdOptimizer:
    """
    Optimizes operating decision thresholds for imbalanced binary quality outcomes.
    In SECOM (6.6% failure rate), a default 0.50 threshold frequently yields 0.0 recall.
    Sweeping thresholds identifies the optimal balance between failure detection and false alarms.
    """

    @classmethod
    def optimize_threshold(
        cls,
        y_val_true: np.ndarray,
        y_val_prob: np.ndarray,
        criterion: str = "f1_fail",  # 'f1_fail' | 'balanced_accuracy' | 'youden_index'
        min_threshold: float = 0.05,
        max_threshold: float = 0.90,
        n_steps: int = 86,
    ) -> Tuple[float, QualityMetricsResult, List[Dict[str, float]]]:
        thresholds = np.linspace(min_threshold, max_threshold, n_steps)
        best_thresh = 0.50
        best_score = -1.0
        best_metrics: Any = None
        sweep_history: List[Dict[str, float]] = []

        for tau in thresholds:
            res = QualityMetricsCalculator.compute(y_val_true, y_val_prob, threshold=float(tau))
            
            if criterion == "f1_fail":
                score = res.f1_fail
            elif criterion == "balanced_accuracy":
                score = res.balanced_accuracy
            elif criterion == "youden_index":
                score = res.recall_fail + res.specificity_pass - 1.0
            else:
                score = res.macro_f1

            sweep_history.append({
                "threshold": round(float(tau), 3),
                "f1_fail": res.f1_fail,
                "precision_fail": res.precision_fail,
                "recall_fail": res.recall_fail,
                "macro_f1": res.macro_f1,
                "accuracy": res.accuracy,
                "balanced_accuracy": res.balanced_accuracy,
            })

            # Tie-breaking: prefer higher recall if scores match
            if score > best_score:
                best_score = score
                best_thresh = float(tau)
                best_metrics = res

        if best_metrics is None:
            best_metrics = QualityMetricsCalculator.compute(y_val_true, y_val_prob, threshold=0.50)
            best_thresh = 0.50

        return best_thresh, best_metrics, sweep_history
