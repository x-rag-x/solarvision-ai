"""
SolarVision AI — Model 4: Predictive Maintenance
Gradient Boosted Decision Stumps/Trees (LogitBoost Engine)
"""

from __future__ import annotations

from typing import Any, Dict, List, Optional
import numpy as np


class DecisionStump:
    def __init__(
        self,
        feature_idx: int = 0,
        threshold: float = 0.0,
        left_val: float = 0.0,
        right_val: float = 0.0,
    ) -> None:
        self.feature_idx = int(feature_idx)
        self.threshold = float(threshold)
        self.left_val = float(left_val)
        self.right_val = float(right_val)

    def predict(self, X: np.ndarray) -> np.ndarray:
        return np.where(X[:, self.feature_idx] <= self.threshold, self.left_val, self.right_val)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "feature_idx": self.feature_idx,
            "threshold": self.threshold,
            "left_val": self.left_val,
            "right_val": self.right_val,
        }

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "DecisionStump":
        return cls(
            feature_idx=data["feature_idx"],
            threshold=data["threshold"],
            left_val=data["left_val"],
            right_val=data["right_val"],
        )


class GradientBoostedMaintenanceClassifier:
    """
    LogitBoost gradient boosting with shrinkage and decision stumps.
    Optimizes binary cross-entropy loss with L2 leaf regularization.
    """

    def __init__(
        self,
        n_estimators: int = 60,
        learning_rate: float = 0.08,
        random_state: int = 42,
    ) -> None:
        self.n_estimators = int(n_estimators)
        self.learning_rate = float(learning_rate)
        self.random_state = int(random_state)
        self.initial_log_odds: float = 0.0
        self.stumps: List[DecisionStump] = []
        self.is_fitted: bool = False

    def fit(self, X: np.ndarray, y: np.ndarray) -> "GradientBoostedMaintenanceClassifier":
        rng = np.random.RandomState(self.random_state)
        n_samples, n_features = X.shape

        p_base = float(np.clip(np.mean(y == 1), 1e-4, 1.0 - 1e-4))
        self.initial_log_odds = float(np.log(p_base / (1.0 - p_base)))

        F = np.full(n_samples, self.initial_log_odds, dtype=np.float64)
        self.stumps = []

        eps = 1e-7
        l2_reg = 1.0

        for m in range(self.n_estimators):
            # Compute probabilities
            p = 1.0 / (1.0 + np.exp(-np.clip(F, -20.0, 20.0)))
            # Compute negative gradient (pseudo-residuals)
            residuals = y - p
            # Compute hessian (weights)
            weights = p * (1.0 - p)

            # Find best split across candidate features and percentiles
            best_loss_reduction = -1.0
            best_feat = 0
            best_th = 0.0
            best_left_gamma = 0.0
            best_right_gamma = 0.0

            # Subsample features
            cand_features = rng.choice(n_features, size=min(n_features, 6), replace=False)

            for f_idx in cand_features:
                col_vals = X[:, f_idx]
                percentiles = np.linspace(5, 95, 19)
                candidate_thresholds = np.percentile(col_vals, percentiles)

                for th in candidate_thresholds:
                    left_mask = col_vals <= th
                    right_mask = ~left_mask

                    w_left = np.sum(weights[left_mask])
                    w_right = np.sum(weights[right_mask])

                    if w_left < eps or w_right < eps:
                        continue

                    r_left = np.sum(residuals[left_mask])
                    r_right = np.sum(residuals[right_mask])

                    gamma_l = r_left / (w_left + l2_reg)
                    gamma_r = r_right / (w_right + l2_reg)

                    loss_red = (r_left**2 / (w_left + l2_reg)) + (r_right**2 / (w_right + l2_reg))

                    if loss_red > best_loss_reduction:
                        best_loss_reduction = loss_red
                        best_feat = f_idx
                        best_th = float(th)
                        best_left_gamma = float(gamma_l)
                        best_right_gamma = float(gamma_r)

            stump = DecisionStump(
                feature_idx=best_feat,
                threshold=best_th,
                left_val=best_left_gamma,
                right_val=best_right_gamma,
            )
            self.stumps.append(stump)
            F += self.learning_rate * stump.predict(X)

        self.is_fitted = True
        return self

    def predict_proba(self, X: np.ndarray) -> np.ndarray:
        if not self.is_fitted:
            raise RuntimeError("Model is not fitted.")

        n_samples = len(X)
        F = np.full(n_samples, self.initial_log_odds, dtype=np.float64)

        for stump in self.stumps:
            F += self.learning_rate * stump.predict(X)

        probs = 1.0 / (1.0 + np.exp(-np.clip(F, -20.0, 20.0)))
        return probs.astype(np.float32)

    def predict(self, X: np.ndarray, threshold: float = 0.50) -> np.ndarray:
        probs = self.predict_proba(X)
        return (probs >= threshold).astype(np.int32)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "model_type": "GradientBoostedMaintenanceClassifier",
            "n_estimators": len(self.stumps),
            "learning_rate": self.learning_rate,
            "initial_log_odds": self.initial_log_odds,
            "stumps": [s.to_dict() for s in self.stumps],
            "is_fitted": self.is_fitted,
        }

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "GradientBoostedMaintenanceClassifier":
        model = cls(
            n_estimators=data.get("n_estimators", 60),
            learning_rate=data.get("learning_rate", 0.08),
        )
        model.initial_log_odds = float(data["initial_log_odds"])
        model.stumps = [DecisionStump.from_dict(s) for s in data.get("stumps", [])]
        model.is_fitted = bool(data.get("is_fitted", True))
        return model
