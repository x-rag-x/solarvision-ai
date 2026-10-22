"""
SolarVision AI — Model 3: Predictive Quality Analysis
Cost-Sensitive Regularized Logistic Regression Classifier
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any, Dict, List, Optional
import numpy as np
import torch
import torch.nn as nn
import torch.optim as optim


class CostSensitiveLogisticRegression:
    """
    L2-regularized, cost-sensitive Logistic Regression classifier using PyTorch autograd.
    Directly counteracts severe class imbalance (14:1) via positive class weighting.
    """

    def __init__(
        self,
        learning_rate: float = 0.01,
        weight_decay: float = 0.01,
        max_epochs: int = 150,
        class_weight_multiplier: Optional[float] = None,  # None means auto: n_neg / n_pos
        random_state: int = 42,
    ) -> None:
        self.learning_rate = float(learning_rate)
        self.weight_decay = float(weight_decay)
        self.max_epochs = int(max_epochs)
        self.class_weight_multiplier = class_weight_multiplier
        self.random_state = int(random_state)

        self.weights: Optional[np.ndarray] = None
        self.bias: float = 0.0
        self.is_fitted: bool = False
        self.pos_weight_: float = 1.0

    def fit(self, X: np.ndarray, y: np.ndarray) -> CostSensitiveLogisticRegression:
        torch.manual_seed(self.random_state)
        np.random.seed(self.random_state)

        X_t = torch.tensor(X, dtype=torch.float32)
        y_t = torch.tensor(y, dtype=torch.float32).unsqueeze(1)

        n_samples, n_features = X.shape
        n_pos = float(torch.sum(y_t == 1.0))
        n_neg = float(n_samples - n_pos)

        if self.class_weight_multiplier is not None:
            self.pos_weight_ = float(self.class_weight_multiplier)
        else:
            self.pos_weight_ = float(n_neg / max(n_pos, 1.0))

        pos_weight_tensor = torch.tensor([self.pos_weight_], dtype=torch.float32)
        criterion = nn.BCEWithLogitsLoss(pos_weight=pos_weight_tensor)

        linear = nn.Linear(n_features, 1, bias=True)
        # Xavier initialization
        nn.init.xavier_uniform_(linear.weight)
        nn.init.zeros_(linear.bias)

        optimizer = optim.Adam(
            linear.parameters(),
            lr=self.learning_rate,
            weight_decay=self.weight_decay,
        )

        linear.train()
        for epoch in range(self.max_epochs):
            optimizer.zero_grad()
            logits = linear(X_t)
            loss = criterion(logits, y_t)
            loss.backward()
            optimizer.step()

        # Extract fitted parameters
        linear.eval()
        with torch.no_grad():
            self.weights = linear.weight.numpy().flatten().copy()
            self.bias = float(linear.bias.item())
        self.is_fitted = True
        return self

    def predict_proba(self, X: np.ndarray) -> np.ndarray:
        """Computes predicted probabilities P(y=1 | X)."""
        if not self.is_fitted or self.weights is None:
            raise RuntimeError("Model is not fitted.")
        logits = np.dot(X, self.weights) + self.bias
        # Numerically stable sigmoid
        probs = 1.0 / (1.0 + np.exp(-np.clip(logits, -30.0, 30.0)))
        return probs.astype(np.float32)

    def predict(self, X: np.ndarray, threshold: float = 0.50) -> np.ndarray:
        probs = self.predict_proba(X)
        return (probs >= threshold).astype(np.int64)

    def to_dict(self) -> Dict[str, Any]:
        if not self.is_fitted or self.weights is None:
            raise RuntimeError("Cannot serialize unfitted model.")
        return {
            "model_type": "CostSensitiveLogisticRegression",
            "learning_rate": self.learning_rate,
            "weight_decay": self.weight_decay,
            "max_epochs": self.max_epochs,
            "class_weight_multiplier": self.class_weight_multiplier,
            "pos_weight_": self.pos_weight_,
            "weights": self.weights.tolist(),
            "bias": self.bias,
            "is_fitted": self.is_fitted,
        }

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> CostSensitiveLogisticRegression:
        m = cls(
            learning_rate=data["learning_rate"],
            weight_decay=data["weight_decay"],
            max_epochs=data["max_epochs"],
            class_weight_multiplier=data["class_weight_multiplier"],
        )
        m.weights = np.array(data["weights"], dtype=np.float32)
        m.bias = float(data["bias"])
        m.pos_weight_ = float(data["pos_weight_"])
        m.is_fitted = bool(data["is_fitted"])
        return m
