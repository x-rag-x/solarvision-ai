"""
SolarVision AI — Model 3: Predictive Quality Analysis
Binary Quality Classification Metrics Suite
"""

from __future__ import annotations

from dataclasses import asdict, dataclass
from typing import Any, Dict, List, Optional
import numpy as np

from .curves import compute_pr_curve, compute_roc_curve


@dataclass(frozen=True)
class QualityMetricsResult:
    accuracy: float
    balanced_accuracy: float
    precision_fail: float
    recall_fail: float
    specificity_pass: float
    f1_fail: float
    f1_pass: float
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


class QualityMetricsCalculator:
    """Computes comprehensive binary classification metrics for imbalanced quality datasets."""

    @classmethod
    def compute(
        cls,
        y_true: np.ndarray,
        y_prob: np.ndarray,
        threshold: float = 0.50,
    ) -> QualityMetricsResult:
        y_t = np.asarray(y_true, dtype=np.int64)
        y_p = np.asarray(y_prob, dtype=np.float32)
        y_pred = (y_p >= threshold).astype(np.int64)

        tp = int(np.sum((y_pred == 1) & (y_t == 1)))
        fp = int(np.sum((y_pred == 1) & (y_t == 0)))
        tn = int(np.sum((y_pred == 0) & (y_t == 0)))
        fn = int(np.sum((y_pred == 0) & (y_t == 1)))
        total = len(y_t)

        # Failure class (1) metrics
        prec_fail = float(tp / (tp + fp)) if (tp + fp) > 0 else 0.0
        rec_fail = float(tp / (tp + fn)) if (tp + fn) > 0 else 0.0
        f1_fail = (
            float(2.0 * prec_fail * rec_fail / (prec_fail + rec_fail))
            if (prec_fail + rec_fail) > 0
            else 0.0
        )

        # Pass class (0) metrics
        prec_pass = float(tn / (tn + fn)) if (tn + fn) > 0 else 0.0
        rec_pass = float(tn / (tn + fp)) if (tn + fp) > 0 else 0.0  # Specificity
        f1_pass = (
            float(2.0 * prec_pass * rec_pass / (prec_pass + rec_pass))
            if (prec_pass + rec_pass) > 0
            else 0.0
        )

        macro_f1 = (f1_fail + f1_pass) / 2.0
        accuracy = float((tp + tn) / total) if total > 0 else 0.0
        balanced_acc = (rec_fail + rec_pass) / 2.0

        n_pos = tp + fn
        n_neg = tn + fp
        weighted_f1 = float((n_pos * f1_fail + n_neg * f1_pass) / total) if total > 0 else 0.0

        # Compute curves
        _, _, _, roc_auc = compute_roc_curve(y_t, y_p)
        _, _, pr_auc = compute_pr_curve(y_t, y_p)

        return QualityMetricsResult(
            accuracy=round(accuracy, 4),
            balanced_accuracy=round(balanced_acc, 4),
            precision_fail=round(prec_fail, 4),
            recall_fail=round(rec_fail, 4),
            specificity_pass=round(rec_pass, 4),
            f1_fail=round(f1_fail, 4),
            f1_pass=round(f1_pass, 4),
            macro_f1=round(macro_f1, 4),
            weighted_f1=round(weighted_f1, 4),
            roc_auc=round(roc_auc, 4),
            pr_auc=round(pr_auc, 4),
            true_positives=tp,
            false_positives=fp,
            true_negatives=tn,
            false_negatives=fn,
            total_samples=total,
            threshold_used=round(threshold, 4),
        )
