"""
SolarVision AI — Model 4: Predictive Maintenance
Zero-Leakage Decision Threshold Optimizer
"""

from __future__ import annotations

from typing import Tuple
import numpy as np


class ThresholdOptimizer:
    """
    Finds the optimal decision threshold tau* strictly using validation split predictions.
    Never pass test split data to this optimizer.
    """

    @classmethod
    def optimize_threshold(
        cls,
        y_val_true: np.ndarray,
        y_val_prob: np.ndarray,
        criterion: str = "f1_failure",
        n_candidates: int = 100,
    ) -> Tuple[float, float, str]:
        y_t = np.asarray(y_val_true, dtype=np.int32)
        y_p = np.asarray(y_val_prob, dtype=np.float32)

        candidates = np.linspace(0.01, 0.99, n_candidates)
        best_th = 0.50
        best_score = -1.0

        for th in candidates:
            y_pred = (y_p >= th).astype(np.int32)
            tp = int(np.sum((y_pred == 1) & (y_t == 1)))
            fp = int(np.sum((y_pred == 1) & (y_t == 0)))
            fn = int(np.sum((y_pred == 0) & (y_t == 1)))
            tn = int(np.sum((y_pred == 0) & (y_t == 0)))

            prec = tp / max(tp + fp, 1) if (tp + fp) > 0 else 0.0
            rec = tp / max(tp + fn, 1) if (tp + fn) > 0 else 0.0
            f1_fail = (2.0 * prec * rec) / (prec + rec) if (prec + rec) > 0 else 0.0

            if criterion == "f1_failure":
                score = f1_fail
            elif criterion == "balanced_accuracy":
                spec = tn / max(tn + fp, 1)
                score = (rec + spec) / 2.0
            elif criterion == "macro_f1":
                prec_norm = tn / max(tn + fn, 1)
                spec_norm = tn / max(tn + fp, 1)
                f1_norm = (2.0 * prec_norm * spec_norm) / (prec_norm + spec_norm) if (prec_norm + spec_norm) > 0 else 0.0
                score = (f1_fail + f1_norm) / 2.0
            else:
                score = f1_fail

            if score > best_score:
                best_score = score
                best_th = th

        return round(float(best_th), 4), round(float(best_score), 4), criterion
