"""
SolarVision AI — Model 4: Predictive Maintenance
Probability Calibration and Reliability Evaluation (ECE, Brier Score, Platt Scaler)
"""

from __future__ import annotations

from typing import Any, Dict, List, Optional
import numpy as np
from scipy.optimize import minimize


class MaintenanceCalibrationEvaluator:
    """Evaluates probability calibration using Expected Calibration Error (ECE) and Brier Score."""

    def __init__(self, n_bins: int = 10) -> None:
        self.n_bins = int(n_bins)

    def evaluate(self, y_true: np.ndarray, y_prob: np.ndarray) -> Dict[str, Any]:
        y_t = np.asarray(y_true, dtype=np.int32)
        y_p = np.asarray(y_prob, dtype=np.float32)

        n_samples = len(y_t)
        if n_samples == 0:
            return {"expected_calibration_error_ece": 0.0, "brier_score": 0.0, "is_calibrated": True, "bins": []}

        # Brier Score = mean squared error between predicted probabilities and binary target
        brier_score = float(np.mean((y_p - y_t) ** 2))

        bin_edges = np.linspace(0.0, 1.0, self.n_bins + 1)
        bin_details: List[Dict[str, Any]] = []
        ece = 0.0
        mce = 0.0

        for b in range(self.n_bins):
            b_low, b_high = bin_edges[b], bin_edges[b + 1]
            in_bin = (y_p >= b_low) & (y_p < b_high if b < self.n_bins - 1 else y_p <= b_high)
            bin_size = int(np.sum(in_bin))

            if bin_size > 0:
                bin_acc = float(np.mean(y_t[in_bin]))
                bin_conf = float(np.mean(y_p[in_bin]))
                gap = abs(bin_acc - bin_conf)
                ece += (bin_size / n_samples) * gap
                mce = max(mce, gap)

                bin_details.append({
                    "bin_low": round(float(b_low), 2),
                    "bin_high": round(float(b_high), 2),
                    "count": bin_size,
                    "accuracy": round(bin_acc, 4),
                    "confidence": round(bin_conf, 4),
                    "gap": round(gap, 4),
                })
            else:
                bin_details.append({
                    "bin_low": round(float(b_low), 2),
                    "bin_high": round(float(b_high), 2),
                    "count": 0,
                    "accuracy": None,
                    "confidence": None,
                    "gap": 0.0,
                })

        # Industrial rule-of-thumb: calibrated if ECE <= 0.05
        is_calibrated = bool(ece <= 0.05)

        return {
            "expected_calibration_error_ece": round(float(ece), 4),
            "max_calibration_error_mce": round(float(mce), 4),
            "brier_score": round(brier_score, 4),
            "is_calibrated": is_calibrated,
            "bins": bin_details,
        }


class ProbabilityCalibrator:
    """
    Post-hoc probability calibrator fitted strictly on validation split predictions
    to eliminate test-set leakage.
    Supports Platt scaling (sigmoid mapping over log-odds).
    """

    def __init__(self, method: str = "platt") -> None:
        if method != "platt":
            raise ValueError(f"Unsupported calibration method: {method}")
        self.method = method
        self.a: float = 1.0
        self.b: float = 0.0
        self.is_fitted: bool = False

    def fit(self, y_prob_val: np.ndarray, y_true_val: np.ndarray) -> "ProbabilityCalibrator":
        """Fits calibration strictly on validation predictions and true labels."""
        p = np.asarray(y_prob_val, dtype=np.float64)
        y = np.asarray(y_true_val, dtype=np.float64)

        eps = 1e-6
        p_c = np.clip(p, eps, 1.0 - eps)
        logits = np.log(p_c / (1.0 - p_c))

        def objective(params: np.ndarray) -> float:
            a_val, b_val = params
            z = a_val * logits + b_val
            pred = 1.0 / (1.0 + np.exp(-z))
            pred = np.clip(pred, eps, 1.0 - eps)
            loss = -np.mean(y * np.log(pred) + (1.0 - y) * np.log(1.0 - pred))
            return float(loss)

        res = minimize(
            objective,
            x0=[1.0, 0.0],
            method="L-BFGS-B",
            bounds=[(1e-4, 15.0), (-15.0, 15.0)],
        )
        self.a = float(res.x[0])
        self.b = float(res.x[1])
        self.is_fitted = True
        return self

    def calibrate(self, y_prob: np.ndarray) -> np.ndarray:
        if not self.is_fitted:
            raise RuntimeError("Calibrator has not been fitted.")

        p = np.asarray(y_prob, dtype=np.float64)
        eps = 1e-6
        p_c = np.clip(p, eps, 1.0 - eps)
        logits = np.log(p_c / (1.0 - p_c))
        z = self.a * logits + self.b
        cal_p = 1.0 / (1.0 + np.exp(-z))
        return np.clip(cal_p, 0.0, 1.0).astype(np.float32)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "method": self.method,
            "is_fitted": self.is_fitted,
            "platt_a": float(self.a) if self.is_fitted else None,
            "platt_b": float(self.b) if self.is_fitted else None,
        }

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "ProbabilityCalibrator":
        cal = cls(method=data.get("method", "platt"))
        cal.is_fitted = data.get("is_fitted", False)
        if data.get("platt_a") is not None:
            cal.a = float(data["platt_a"])
        if data.get("platt_b") is not None:
            cal.b = float(data["platt_b"])
        return cal
