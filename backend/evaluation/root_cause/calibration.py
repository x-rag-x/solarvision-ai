"""Probability calibration evaluation for Model 2 predictions."""

from __future__ import annotations

from typing import Any, Dict, List
import numpy as np


class CalibrationEvaluator:
    """Evaluates probability calibration using Expected Calibration Error (ECE) and binning."""

    def __init__(self, n_bins: int = 10):
        self.n_bins = n_bins

    def evaluate_calibration(
        self, y_true: np.ndarray, y_proba: np.ndarray
    ) -> Dict[str, Any]:
        """
        Computes multi-class calibration metrics.
        Takes top predicted confidence for each sample and compares with empirical accuracy in bins.
        """
        y_true = np.asarray(y_true, dtype=np.int64)
        y_proba = np.asarray(y_proba, dtype=np.float32)

        confidences = np.max(y_proba, axis=1)
        predictions = np.argmax(y_proba, axis=1)
        accuracies = (predictions == y_true).astype(np.float32)

        bin_boundaries = np.linspace(0.0, 1.0, self.n_bins + 1)
        bin_details: List[Dict[str, Any]] = []

        total_samples = len(y_true)
        ece = 0.0
        mce = 0.0

        for b in range(self.n_bins):
            b_low = bin_boundaries[b]
            b_high = bin_boundaries[b + 1]

            in_bin = (confidences > b_low) & (confidences <= b_high)
            bin_size = int(np.sum(in_bin))

            if bin_size > 0:
                bin_acc = float(np.mean(accuracies[in_bin]))
                bin_conf = float(np.mean(confidences[in_bin]))
                gap = abs(bin_acc - bin_conf)

                ece += (bin_size / total_samples) * gap
                mce = max(mce, gap)

                bin_details.append({
                    "bin_range": [round(float(b_low), 2), round(float(b_high), 2)],
                    "count": bin_size,
                    "accuracy": round(bin_acc, 4),
                    "confidence": round(bin_conf, 4),
                    "calibration_gap": round(gap, 4),
                })
            else:
                bin_details.append({
                    "bin_range": [round(float(b_low), 2), round(float(b_high), 2)],
                    "count": 0,
                    "accuracy": None,
                    "confidence": None,
                    "calibration_gap": 0.0,
                })

        # Multi-class Brier score
        one_hot = np.zeros_like(y_proba)
        for i, val in enumerate(y_true):
            one_hot[i, val] = 1.0
        brier_score = float(np.mean(np.sum((y_proba - one_hot) ** 2, axis=1)))

        is_calibrated = ece <= 0.08

        return {
            "expected_calibration_error_ece": round(float(ece), 4),
            "max_calibration_error_mce": round(float(mce), 4),
            "brier_score": round(brier_score, 4),
            "is_calibrated": is_calibrated,
            "calibration_assessment": (
                "Confidence scores are well-calibrated (ECE <= 0.08). Predicted probabilities represent true empirical risk."
                if is_calibrated
                else "Confidence values exhibit over/under-confidence drift (ECE > 0.08). Temperature scaling or Platt scaling recommended."
            ),
            "bins": bin_details,
        }
