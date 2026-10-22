"""Multiclass evaluation metrics suite for Model 2 Root Cause Analysis."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Dict, List, Optional
import numpy as np

from backend.root_cause_data.schema import ROOT_CAUSE_TAXONOMY


@dataclass
class PerClassMetric:
    class_name: str
    class_id: int
    support: int
    true_positives: int
    false_positives: int
    false_negatives: int
    precision: float
    recall: float
    f1_score: float


@dataclass
class ClassificationMetricsResult:
    accuracy: float
    balanced_accuracy: float
    macro_precision: float
    macro_recall: float
    macro_f1: float
    weighted_f1: float
    per_class: Dict[str, PerClassMetric]


class RootCauseMetricsCalculator:
    """Computes comprehensive classification metrics across all root cause categories."""

    def __init__(self, class_names: Optional[List[str]] = None):
        self.class_names = class_names or list(ROOT_CAUSE_TAXONOMY)
        self.num_classes = len(self.class_names)

    def calculate(
        self, y_true: np.ndarray, y_pred: np.ndarray
    ) -> ClassificationMetricsResult:
        y_true = np.asarray(y_true, dtype=np.int64)
        y_pred = np.asarray(y_pred, dtype=np.int64)

        n_samples = len(y_true)
        if n_samples == 0:
            raise ValueError("Cannot calculate metrics on empty arrays.")

        acc = float(np.mean(y_true == y_pred))

        per_class: Dict[str, PerClassMetric] = {}
        recalls: List[float] = []
        precisions: List[float] = []
        f1s: List[float] = []
        supports: List[int] = []

        for idx, name in enumerate(self.class_names):
            tp = int(np.sum((y_true == idx) & (y_pred == idx)))
            fp = int(np.sum((y_true != idx) & (y_pred == idx)))
            fn = int(np.sum((y_true == idx) & (y_pred != idx)))
            sup = int(np.sum(y_true == idx))

            prec = float(tp / (tp + fp)) if (tp + fp) > 0 else 0.0
            rec = float(tp / (tp + fn)) if (tp + fn) > 0 else 0.0
            f1 = float((2 * prec * rec) / (prec + rec)) if (prec + rec) > 0 else 0.0

            per_class[name] = PerClassMetric(
                class_name=name,
                class_id=idx,
                support=sup,
                true_positives=tp,
                false_positives=fp,
                false_negatives=fn,
                precision=round(prec, 4),
                recall=round(rec, 4),
                f1_score=round(f1, 4),
            )

            recalls.append(rec)
            precisions.append(prec)
            f1s.append(f1)
            supports.append(sup)

        macro_p = float(np.mean(precisions))
        macro_r = float(np.mean(recalls))
        macro_f1 = float(np.mean(f1s))

        # Weighted F1
        total_sup = sum(supports)
        weighted_f1 = (
            float(sum(f * s for f, s in zip(f1s, supports)) / total_sup)
            if total_sup > 0
            else 0.0
        )

        # Balanced accuracy = macro recall
        balanced_acc = macro_r

        return ClassificationMetricsResult(
            accuracy=round(acc, 4),
            balanced_accuracy=round(balanced_acc, 4),
            macro_precision=round(macro_p, 4),
            macro_recall=round(macro_r, 4),
            macro_f1=round(macro_f1, 4),
            weighted_f1=round(weighted_f1, 4),
            per_class=per_class,
        )
