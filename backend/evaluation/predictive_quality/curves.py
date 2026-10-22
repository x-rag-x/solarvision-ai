"""
SolarVision AI — Model 3: Predictive Quality Analysis
Area Under ROC Curve (ROC-AUC) and Precision-Recall Curve (PR-AUC)
"""

from __future__ import annotations

from typing import List, Tuple
import numpy as np


def compute_roc_curve(y_true: np.ndarray, y_score: np.ndarray) -> Tuple[np.ndarray, np.ndarray, np.ndarray, float]:
    """
    Computes false positive rates (FPR), true positive rates (TPR), thresholds, and ROC-AUC.
    """
    y_true = (np.asarray(y_true) == 1).astype(np.int32)
    y_score = np.asarray(y_score, dtype=np.float64)

    # Sort descending by predicted score
    desc_order = np.argsort(y_score)[::-1]
    y_true_sorted = y_true[desc_order]
    y_score_sorted = y_score[desc_order]

    # Distinct threshold points
    distinct_mask = np.diff(y_score_sorted) != 0
    threshold_idxs = np.where(distinct_mask)[0]
    threshold_idxs = np.append(threshold_idxs, len(y_true_sorted) - 1)

    tps = np.cumsum(y_true_sorted)[threshold_idxs]
    fps = (1 + threshold_idxs) - tps

    total_pos = tps[-1]
    total_neg = fps[-1]

    if total_pos == 0 or total_neg == 0:
        return np.array([0.0, 1.0]), np.array([0.0, 1.0]), np.array([1.0, 0.0]), 0.5

    tpr = np.pad(tps / total_pos, (1, 0), "constant", constant_values=0.0)
    fpr = np.pad(fps / total_neg, (1, 0), "constant", constant_values=0.0)
    thresholds = np.pad(y_score_sorted[threshold_idxs], (1, 0), "constant", constant_values=y_score_sorted[0] + 1.0)

    # Trapezoidal rule for ROC AUC
    trap_fn = getattr(np, "trapezoid", np.trapz)
    roc_auc = float(trap_fn(tpr, fpr))
    return fpr, tpr, thresholds, max(0.0, min(1.0, roc_auc))


def compute_pr_curve(y_true: np.ndarray, y_score: np.ndarray) -> Tuple[np.ndarray, np.ndarray, float]:
    """
    Computes precision, recall curve and PR-AUC (Average Precision).
    Particularly critical for imbalanced quality datasets (6.6% positive rate).
    """
    y_true = (np.asarray(y_true) == 1).astype(np.int32)
    y_score = np.asarray(y_score, dtype=np.float64)

    desc_order = np.argsort(y_score)[::-1]
    y_true_sorted = y_true[desc_order]
    y_score_sorted = y_score[desc_order]

    distinct_mask = np.diff(y_score_sorted) != 0
    threshold_idxs = np.where(distinct_mask)[0]
    threshold_idxs = np.append(threshold_idxs, len(y_true_sorted) - 1)

    tps = np.cumsum(y_true_sorted)[threshold_idxs]
    fps = (1 + threshold_idxs) - tps

    total_pos = tps[-1]
    if total_pos == 0:
        return np.array([0.0]), np.array([0.0]), 0.0

    precision = tps / (tps + fps)
    recall = tps / total_pos

    # Monotonic precision-recall integration (Average Precision)
    # AP = sum_n (R_n - R_{n-1}) * P_n
    r_prev = 0.0
    pr_auc = 0.0
    for p, r in zip(precision, recall):
        pr_auc += (r - r_prev) * p
        r_prev = r

    # Prepend recall=0 point
    precision = np.pad(precision, (1, 0), "constant", constant_values=1.0)
    recall = np.pad(recall, (1, 0), "constant", constant_values=0.0)

    return precision, recall, float(np.clip(pr_auc, 0.0, 1.0))
