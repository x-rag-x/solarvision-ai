"""Optional XGBoost adapter for Model 2 Root Cause training."""

from __future__ import annotations

import logging
from typing import Any, Dict, List, Optional
import numpy as np

logger = logging.getLogger("solarvision.root_cause.xgboost")

_XGBOOST_AVAILABLE = False
try:
    import xgboost as xgb
    _XGBOOST_AVAILABLE = True
except ImportError:
    xgb = None  # type: ignore


class XGBoostAdapter:
    """
    Adapter for XGBoost classifier. Gracefully reports dependency availability
    and provides a consistent estimator interface.
    """

    def __init__(
        self,
        n_estimators: int = 100,
        max_depth: int = 6,
        learning_rate: float = 0.1,
        random_state: int = 42,
    ):
        self.n_estimators = n_estimators
        self.max_depth = max_depth
        self.learning_rate = learning_rate
        self.random_state = random_state
        self.model: Any = None

    @classmethod
    def is_available(cls) -> bool:
        return _XGBOOST_AVAILABLE

    def fit(self, X: np.ndarray, y: np.ndarray) -> XGBoostAdapter:
        if not _XGBOOST_AVAILABLE:
            raise RuntimeError(
                "XGBoost library is not installed in the active environment. "
                "Use the native RandomForestClassifier or install xgboost."
            )

        self.model = xgb.XGBClassifier(
            n_estimators=self.n_estimators,
            max_depth=self.max_depth,
            learning_rate=self.learning_rate,
            random_state=self.random_state,
            objective="multi:softprob",
            eval_metric="mlogloss",
        )
        self.model.fit(X, y)
        return self

    def predict(self, X: np.ndarray) -> np.ndarray:
        if not self.model:
            raise RuntimeError("XGBoost model is not fitted or unavailable.")
        return self.model.predict(X)

    def predict_proba(self, X: np.ndarray) -> np.ndarray:
        if not self.model:
            raise RuntimeError("XGBoost model is not fitted or unavailable.")
        return self.model.predict_proba(X)
