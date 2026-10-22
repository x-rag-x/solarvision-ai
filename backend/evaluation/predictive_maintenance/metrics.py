"""
SolarVision AI — Model 4: Predictive Maintenance
Evaluation Metrics: Confusion Matrix, Failure Precision/Recall/F1, Macro-F1, Balanced Accuracy
"""

from __future__ import annotations

from dataclasses import asdict, dataclass
from typing import Any, Dict, List, Optional
import numpy as np

from .curves import compute_pr_curve, compute_roc_curve


@dataclass(frozen=True)
class MaintenanceMetricsResult:
    accuracy: float
    balanced_accuracy: float
    precision_failure: float
    recall_failure: float
    specificity_normal: float
    f1_failure: float
    f1_normal: float
    macro_f1: float
    weighted_f1: float
    roc_auc: float
    pr_auc: float
    true_positives: int
    false_positives: int
    true_negatives: int
    false_negatives: int
    total_samples: int
    threshold_used: float

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


class MaintenanceMetricsCalculator:
    """Calculates comprehensive classification metrics prioritizing the rare failure class."""

    @classmethod
    def compute(
        cls,
        y_true: np.ndarray,
        y_prob: np.ndarray,
        threshold: float = 0.50,
    ) -> MaintenanceMetricsResult:
        y_t = np.asarray(y_true, dtype=np.int32)
        y_p = np.asarray(y_prob, dtype=np.float32)

        if len(y_t) != len(y_p):
            raise ValueError(f"Shape mismatch: y_true {y_t.shape} vs y_prob {y_p.shape}")

        y_pred = (y_p >= threshold).astype(np.int32)

        tp = int(np.sum((y_pred == 1) & (y_t == 1)))
        fp = int(np.sum((y_pred == 1) & (y_t == 0)))
        tn = int(np.sum((y_pred == 0) & (y_t == 0)))
        fn = int(np.sum((y_pred == 0) & (y_t == 1)))
        total = len(y_t)

        prec_fail = tp / max(tp + fp, 1) if (tp + fp) > 0 else 0.0
        rec_fail = tp / max(tp + fn, 1) if (tp + fn) > 0 else 0.0
        spec_norm = tn / max(tn + fp, 1) if (tn + fp) > 0 else 0.0

        f1_fail = (
            (2.0 * prec_fail * rec_fail) / (prec_fail + rec_fail)
            if (prec_fail + rec_fail) > 0
            else 0.0
        )

        prec_norm = tn / max(tn + fn, 1) if (tn + fn) > 0 else 0.0
        f1_norm = (
            (2.0 * prec_norm * spec_norm) / (prec_norm + spec_norm)
            if (prec_norm + spec_norm) > 0
            else 0.0
        )

        macro_f1 = (f1_fail + f1_norm) / 2.0
        n_pos = tp + fn
        n_neg = tn + fp
        weighted_f1 = (n_pos * f1_fail + n_neg * f1_norm) / max(total, 1)
        accuracy = (tp + tn) / max(total, 1)
        balanced_accuracy = (rec_fail + spec_norm) / 2.0

        # AUC Metrics
        _, _, roc_auc = compute_roc_curve(y_t, y_p)
        _, _, pr_auc = compute_pr_curve(y_t, y_p)

        return MaintenanceMetricsResult(
            accuracy=round(float(accuracy), 4),
            balanced_accuracy=round(float(balanced_accuracy), 4),
            precision_failure=round(float(prec_fail), 4),
            recall_failure=round(float(rec_fail), 4),
            specificity_normal=round(float(spec_norm), 4),
            f1_failure=round(float(f1_fail), 4),
            f1_normal=round(float(f1_norm), 4),
            macro_f1=round(float(macro_f1), 4),
            weighted_f1=round(float(weighted_f1), 4),
            roc_auc=round(float(roc_auc), 4),
            pr_auc=round(float(pr_auc), 4),
            true_positives=tp,
            false_positives=fp,
            true_negatives=tn,
            false_negatives=fn,
            total_samples=total,
            threshold_used=round(float(threshold), 4),
        )
