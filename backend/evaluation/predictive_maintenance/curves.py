"""
SolarVision AI — Model 4: Predictive Maintenance
ROC-AUC and Precision-Recall Curves and Area Computations
"""

from __future__ import annotations

from typing import Tuple
import numpy as np


def _integrate(y: np.ndarray, x: np.ndarray) -> float:
    if hasattr(np, "trapezoid"):
        return float(np.trapezoid(y, x))
    return float(np.trapz(y, x))  # type: ignore


def compute_roc_curve(
    y_true: np.ndarray, y_prob: np.ndarray, n_thresholds: int = 200
) -> Tuple[np.ndarray, np.ndarray, float]:
    """Computes False Positive Rate (FPR), True Positive Rate (TPR), and ROC-AUC."""
    y_t = np.asarray(y_true, dtype=np.int32)
    y_p = np.asarray(y_prob, dtype=np.float32)

    n_pos = int(np.sum(y_t == 1))
    n_neg = int(np.sum(y_t == 0))

    if n_pos == 0 or n_neg == 0:
        return np.array([0.0, 1.0]), np.array([0.0, 1.0]), 0.5

    thresholds = np.linspace(0.0, 1.0, n_thresholds)
    tpr_list = []
    fpr_list = []

    for th in reversed(thresholds):
        y_pred = (y_p >= th).astype(np.int32)
        tp = int(np.sum((y_pred == 1) & (y_t == 1)))
        fp = int(np.sum((y_pred == 1) & (y_t == 0)))
        tpr_list.append(tp / n_pos)
        fpr_list.append(fp / n_neg)

    fpr_arr = np.array([0.0] + fpr_list + [1.0])
    tpr_arr = np.array([0.0] + tpr_list + [1.0])

    order = np.argsort(fpr_arr)
    fpr_sorted = fpr_arr[order]
    tpr_sorted = tpr_arr[order]

    roc_auc = _integrate(tpr_sorted, fpr_sorted)
    return fpr_sorted, tpr_sorted, float(np.clip(roc_auc, 0.0, 1.0))


def compute_pr_curve(
    y_true: np.ndarray, y_prob: np.ndarray, n_thresholds: int = 200
) -> Tuple[np.ndarray, np.ndarray, float]:
    """Computes Recall, Precision, and Precision-Recall AUC (PR-AUC / Average Precision)."""
    y_t = np.asarray(y_true, dtype=np.int32)
    y_p = np.asarray(y_prob, dtype=np.float32)

    n_pos = int(np.sum(y_t == 1))
    if n_pos == 0:
        return np.array([0.0, 1.0]), np.array([0.0, 0.0]), 0.0

    thresholds = np.linspace(0.0, 1.0, n_thresholds)
    prec_list = []
    rec_list = []

    for th in reversed(thresholds):
        y_pred = (y_p >= th).astype(np.int32)
        tp = int(np.sum((y_pred == 1) & (y_t == 1)))
        fp = int(np.sum((y_pred == 1) & (y_t == 0)))
        p = tp / max(tp + fp, 1) if (tp + fp) > 0 else 1.0
        r = tp / n_pos
        prec_list.append(p)
        rec_list.append(r)

    rec_arr = np.array([0.0] + rec_list + [1.0])
    prec_arr = np.array([1.0] + prec_list + [float(n_pos / len(y_t))])

    order = np.argsort(rec_arr)
    rec_sorted = rec_arr[order]
    prec_sorted = prec_arr[order]

    pr_auc = _integrate(prec_sorted, rec_sorted)
    return rec_sorted, prec_sorted, float(np.clip(pr_auc, 0.0, 1.0))
