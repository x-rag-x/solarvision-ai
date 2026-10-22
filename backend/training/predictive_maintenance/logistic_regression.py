"""
SolarVision AI — Model 4: Predictive Maintenance
Cost-Sensitive Regularized Logistic Regression (PyTorch Engine)
"""

from __future__ import annotations

from typing import Any, Dict, Optional
import numpy as np
import torch
import torch.nn as nn
import torch.optim as optim


class CostSensitiveLogisticRegression:
    """
    Cost-sensitive binary logistic regression with L2 regularization.
    Applies inverse class weighting to compensate for the 28.5:1 class imbalance.
    """

    def __init__(
        self,
        learning_rate: float = 0.02,
        weight_decay: float = 0.01,
        max_epochs: int = 150,
        random_state: int = 42,
    ) -> None:
        self.learning_rate = float(learning_rate)
        self.weight_decay = float(weight_decay)
        self.max_epochs = int(max_epochs)
        self.random_state = int(random_state)

        self.weights: Optional[np.ndarray] = None
        self.bias: float = 0.0
        self.pos_weight: float = 1.0
        self.is_fitted: bool = False
        self.n_features: int = 0

    def fit(self, X: np.ndarray, y: np.ndarray) -> "CostSensitiveLogisticRegression":
        torch.manual_seed(self.random_state)
        np.random.seed(self.random_state)

        X_t = torch.tensor(X, dtype=torch.float32)
        y_t = torch.tensor(y, dtype=torch.float32).unsqueeze(1)

        n_samples, n_features = X.shape
        self.n_features = n_features

        n_pos = float(torch.sum(y_t == 1.0))
        n_neg = float(torch.sum(y_t == 0.0))
        # Compute cost-sensitive positive weight
        self.pos_weight = n_neg / max(n_pos, 1.0)

        linear = nn.Linear(n_features, 1)
        criterion = nn.BCEWithLogitsLoss(pos_weight=torch.tensor([self.pos_weight], dtype=torch.float32))
        optimizer = optim.AdamW(
            linear.parameters(),
            lr=self.learning_rate,
            weight_decay=self.weight_decay,
        )

        linear.train()
        batch_size = 256
        n_batches = int(np.ceil(n_samples / batch_size))

        for epoch in range(self.max_epochs):
            indices = torch.randperm(n_samples)
            for b in range(n_batches):
                batch_idx = indices[b * batch_size : (b + 1) * batch_size]
                X_batch = X_t[batch_idx]
                y_batch = y_t[batch_idx]

                optimizer.zero_grad()
                logits = linear(X_batch)
                loss = criterion(logits, y_batch)
                loss.backward()
                optimizer.step()

        with torch.no_grad():
            self.weights = linear.weight.numpy().ravel().astype(np.float64)
            self.bias = float(linear.bias.numpy()[0])

        self.is_fitted = True
        return self

    def predict_proba(self, X: np.ndarray) -> np.ndarray:
        if not self.is_fitted or self.weights is None:
            raise RuntimeError("Model is not fitted.")
        X_arr = np.asarray(X, dtype=np.float64)
        logits = np.dot(X_arr, self.weights) + self.bias
        # Sigmoid
        probs = 1.0 / (1.0 + np.exp(-np.clip(logits, -20.0, 20.0)))
        return probs.astype(np.float32)

    def predict(self, X: np.ndarray, threshold: float = 0.50) -> np.ndarray:
        probs = self.predict_proba(X)
        return (probs >= threshold).astype(np.int32)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "model_type": "CostSensitiveLogisticRegression",
            "n_features": self.n_features,
            "weights": [float(w) for w in self.weights] if self.weights is not None else [],
            "bias": float(self.bias),
            "pos_weight": float(self.pos_weight),
            "learning_rate": self.learning_rate,
            "weight_decay": self.weight_decay,
            "max_epochs": self.max_epochs,
            "random_state": self.random_state,
            "is_fitted": self.is_fitted,
        }

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "CostSensitiveLogisticRegression":
        model = cls(
            learning_rate=data.get("learning_rate", 0.02),
            weight_decay=data.get("weight_decay", 0.01),
            max_epochs=data.get("max_epochs", 150),
            random_state=data.get("random_state", 42),
        )
        model.n_features = data.get("n_features", 6)
        model.weights = np.array(data["weights"], dtype=np.float64)
        model.bias = float(data["bias"])
        model.pos_weight = float(data.get("pos_weight", 1.0))
        model.is_fitted = bool(data.get("is_fitted", True))
        return model
