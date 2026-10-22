"""High-performance self-contained Decision Tree and Random Forest for Root Cause Classification.

Implemented with NumPy and SciPy for complete airgap reliability, zero external C-dependency issues,
full serialization to JSON, out-of-bag scoring, and feature importance extraction.
"""

from __future__ import annotations

import math
from typing import Any, Dict, List, Optional, Tuple
import numpy as np

from backend.root_cause_data.schema import CANONICAL_FEATURE_ORDER, ROOT_CAUSE_TAXONOMY


class DecisionTreeNode:
    """Node in a classification decision tree."""

    def __init__(
        self,
        feature_idx: Optional[int] = None,
        threshold: Optional[float] = None,
        left: Optional[DecisionTreeNode] = None,
        right: Optional[DecisionTreeNode] = None,
        value: Optional[int] = None,
        probabilities: Optional[np.ndarray] = None,
        impurity_decrease: float = 0.0,
    ):
        self.feature_idx = feature_idx
        self.threshold = threshold
        self.left = left
        self.right = right
        self.value = value  # Class index
        self.probabilities = probabilities  # Array of class probabilities
        self.impurity_decrease = impurity_decrease

    @property
    def is_leaf(self) -> bool:
        return self.value is not None

    def to_dict(self) -> Dict[str, Any]:
        """Serializes node to recursive dictionary."""
        if self.is_leaf:
            return {
                "is_leaf": True,
                "value": int(self.value) if self.value is not None else 0,
                "probabilities": self.probabilities.tolist() if self.probabilities is not None else [],
            }
        return {
            "is_leaf": False,
            "feature_idx": int(self.feature_idx) if self.feature_idx is not None else None,
            "threshold": float(self.threshold) if self.threshold is not None else 0.0,
            "impurity_decrease": float(self.impurity_decrease),
            "left": self.left.to_dict() if self.left else None,
            "right": self.right.to_dict() if self.right else None,
        }

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> DecisionTreeNode:
        """Deserializes node from recursive dictionary."""
        if data.get("is_leaf"):
            return cls(
                value=data.get("value"),
                probabilities=np.array(data.get("probabilities", []), dtype=np.float32),
            )
        return cls(
            feature_idx=data.get("feature_idx"),
            threshold=data.get("threshold"),
            impurity_decrease=data.get("impurity_decrease", 0.0),
            left=cls.from_dict(data["left"]) if data.get("left") else None,
            right=cls.from_dict(data["right"]) if data.get("right") else None,
        )


class DecisionTreeClassifier:
    """Multiclass Classification Tree using Gini Impurity."""

    def __init__(
        self,
        max_depth: int = 10,
        min_samples_split: int = 2,
        min_samples_leaf: int = 1,
        max_features: Optional[str | int] = "sqrt",
        random_state: Optional[int] = None,
        num_classes: int = len(ROOT_CAUSE_TAXONOMY),
    ):
        self.max_depth = max_depth
        self.min_samples_split = min_samples_split
        self.min_samples_leaf = min_samples_leaf
        self.max_features = max_features
        self.random_state = random_state
        self.num_classes = num_classes
        self.root: Optional[DecisionTreeNode] = None
        self.feature_importances_: np.ndarray = np.zeros(len(CANONICAL_FEATURE_ORDER))
        self.rng = np.random.RandomState(random_state)

    def _gini(self, y_indices: np.ndarray) -> float:
        """Computes Gini impurity for class index array."""
        if len(y_indices) == 0:
            return 0.0
        counts = np.bincount(y_indices, minlength=self.num_classes)
        probs = counts / len(y_indices)
        return 1.0 - float(np.sum(probs ** 2))

    def _best_split(
        self, X: np.ndarray, y: np.ndarray
    ) -> Tuple[Optional[int], Optional[float], float]:
        """Finds the best split (feature_idx, threshold, impurity_reduction)."""
        n_samples, n_features = X.shape
        if n_samples < self.min_samples_split:
            return None, None, 0.0

        current_gini = self._gini(y)
        best_gain = 0.0
        best_feat = None
        best_thresh = None

        # Determine feature subset size
        if self.max_features == "sqrt":
            k_features = max(1, int(math.isqrt(n_features)))
        elif self.max_features == "log2":
            k_features = max(1, int(math.log2(n_features)))
        elif isinstance(self.max_features, int):
            k_features = min(n_features, self.max_features)
        else:
            k_features = n_features

        feature_indices = self.rng.choice(n_features, size=k_features, replace=False)

        for feat_idx in feature_indices:
            values = X[:, feat_idx]
            unique_vals = np.unique(values)
            if len(unique_vals) <= 1:
                continue

            # Evaluate split midpoints
            thresholds = (unique_vals[:-1] + unique_vals[1:]) / 2.0
            # Subsample candidate thresholds if too many to maintain fast training
            if len(thresholds) > 20:
                thresholds = np.quantile(thresholds, np.linspace(0.05, 0.95, 20))

            for thresh in thresholds:
                left_mask = values <= thresh
                right_mask = ~left_mask

                n_left = np.sum(left_mask)
                n_right = n_samples - n_left

                if n_left < self.min_samples_leaf or n_right < self.min_samples_leaf:
                    continue

                gini_left = self._gini(y[left_mask])
                gini_right = self._gini(y[right_mask])

                gain = current_gini - ((n_left / n_samples) * gini_left + (n_right / n_samples) * gini_right)

                if gain > best_gain:
                    best_gain = gain
                    best_feat = feat_idx
                    best_thresh = float(thresh)

        return best_feat, best_thresh, best_gain

    def _build_tree(
        self, X: np.ndarray, y: np.ndarray, depth: int = 0
    ) -> DecisionTreeNode:
        """Recursively grows the decision tree."""
        n_samples = len(y)
        counts = np.bincount(y, minlength=self.num_classes)
        probs = (counts / n_samples).astype(np.float32)
        majority_val = int(np.argmax(counts))

        # Stopping criteria: pure node, max depth, or insufficient samples
        if depth >= self.max_depth or n_samples < self.min_samples_split or len(np.unique(y)) == 1:
            return DecisionTreeNode(value=majority_val, probabilities=probs)

        feat_idx, thresh, gain = self._best_split(X, y)

        if feat_idx is None or gain <= 1e-7:
            return DecisionTreeNode(value=majority_val, probabilities=probs)

        # Accumulate feature importance (normalized by sample count ratio)
        self.feature_importances_[feat_idx] += gain * (n_samples / len(self._total_samples))

        left_mask = X[:, feat_idx] <= thresh
        right_mask = ~left_mask

        left_child = self._build_tree(X[left_mask], y[left_mask], depth + 1)
        right_child = self._build_tree(X[right_mask], y[right_mask], depth + 1)

        return DecisionTreeNode(
            feature_idx=feat_idx,
            threshold=thresh,
            left=left_child,
            right=right_child,
            impurity_decrease=gain,
        )

    def fit(self, X: np.ndarray, y: np.ndarray) -> DecisionTreeClassifier:
        """Fits decision tree on training matrix X and integer class labels y."""
        X = np.asarray(X, dtype=np.float32)
        y = np.asarray(y, dtype=np.int64)
        self._total_samples = y
        self.feature_importances_ = np.zeros(X.shape[1], dtype=np.float64)
        self.root = self._build_tree(X, y, depth=0)
        return self

    def _predict_row_proba(self, node: DecisionTreeNode, row: np.ndarray) -> np.ndarray:
        if node.is_leaf:
            return node.probabilities if node.probabilities is not None else np.zeros(self.num_classes)

        if row[node.feature_idx] <= node.threshold:
            return self._predict_row_proba(node.left, row)
        return self._predict_row_proba(node.right, row)

    def predict_proba(self, X: np.ndarray) -> np.ndarray:
        """Returns array of predicted class probabilities shape (N, num_classes)."""
        X = np.asarray(X, dtype=np.float32)
        if not self.root:
            raise RuntimeError("DecisionTreeClassifier is not fitted.")
        return np.array([self._predict_row_proba(self.root, row) for row in X], dtype=np.float32)

    def predict(self, X: np.ndarray) -> np.ndarray:
        """Returns predicted class indices shape (N,)."""
        proba = self.predict_proba(X)
        return np.argmax(proba, axis=1)

    def to_dict(self) -> Dict[str, Any]:
        """Serializes decision tree to dict."""
        return {
            "max_depth": self.max_depth,
            "min_samples_split": self.min_samples_split,
            "min_samples_leaf": self.min_samples_leaf,
            "num_classes": self.num_classes,
            "root": self.root.to_dict() if self.root else None,
            "feature_importances": self.feature_importances_.tolist(),
        }

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> DecisionTreeClassifier:
        """Reconstructs tree from dict."""
        tree = cls(
            max_depth=data.get("max_depth", 10),
            min_samples_split=data.get("min_samples_split", 2),
            min_samples_leaf=data.get("min_samples_leaf", 1),
            num_classes=data.get("num_classes", len(ROOT_CAUSE_TAXONOMY)),
        )
        if data.get("root"):
            tree.root = DecisionTreeNode.from_dict(data["root"])
        tree.feature_importances_ = np.array(data.get("feature_importances", []), dtype=np.float64)
        return tree


class RandomForestClassifier:
    """
    Ensemble of Decision Trees with bootstrap bagging, out-of-bag scoring,
    and Mean Decrease in Impurity feature ranking.
    """

    def __init__(
        self,
        n_estimators: int = 50,
        max_depth: int = 12,
        min_samples_split: int = 2,
        min_samples_leaf: int = 1,
        max_features: Optional[str | int] = "sqrt",
        random_state: int = 42,
        num_classes: int = len(ROOT_CAUSE_TAXONOMY),
    ):
        self.n_estimators = n_estimators
        self.max_depth = max_depth
        self.min_samples_split = min_samples_split
        self.min_samples_leaf = min_samples_leaf
        self.max_features = max_features
        self.random_state = random_state
        self.num_classes = num_classes

        self.trees: List[DecisionTreeClassifier] = []
        self.feature_importances_: np.ndarray = np.zeros(len(CANONICAL_FEATURE_ORDER))
        self.oob_score_: float = 0.0

    def fit(self, X: np.ndarray, y: np.ndarray) -> RandomForestClassifier:
        """Trains ensemble using bootstrap sampling and calculates OOB error."""
        X = np.asarray(X, dtype=np.float32)
        y = np.asarray(y, dtype=np.int64)
        n_samples, n_features = X.shape

        rng = np.random.RandomState(self.random_state)
        self.trees = []
        cumulative_importances = np.zeros(n_features, dtype=np.float64)

        # OOB tracking
        oob_predictions = np.zeros((n_samples, self.num_classes), dtype=np.float64)
        oob_counts = np.zeros(n_samples, dtype=np.int32)

        for i in range(self.n_estimators):
            tree_seed = rng.randint(0, 1000000)
            tree_rng = np.random.RandomState(tree_seed)

            # Bootstrap sample with replacement
            bootstrap_indices = tree_rng.choice(n_samples, size=n_samples, replace=True)
            oob_mask = np.ones(n_samples, dtype=bool)
            oob_mask[bootstrap_indices] = False

            X_b = X[bootstrap_indices]
            y_b = y[bootstrap_indices]

            tree = DecisionTreeClassifier(
                max_depth=self.max_depth,
                min_samples_split=self.min_samples_split,
                min_samples_leaf=self.min_samples_leaf,
                max_features=self.max_features,
                random_state=tree_seed,
                num_classes=self.num_classes,
            )
            tree.fit(X_b, y_b)
            self.trees.append(tree)

            cumulative_importances += tree.feature_importances_

            # Track OOB predictions
            if np.any(oob_mask):
                oob_idx = np.where(oob_mask)[0]
                oob_preds = tree.predict_proba(X[oob_idx])
                oob_predictions[oob_idx] += oob_preds
                oob_counts[oob_idx] += 1

        # Normalize feature importances
        total_imp = float(np.sum(cumulative_importances))
        if total_imp > 0:
            self.feature_importances_ = cumulative_importances / total_imp
        else:
            self.feature_importances_ = np.ones(n_features) / n_features

        # Compute OOB accuracy
        valid_oob = oob_counts > 0
        if np.any(valid_oob):
            oob_class_preds = np.argmax(oob_predictions[valid_oob], axis=1)
            self.oob_score_ = float(np.mean(oob_class_preds == y[valid_oob]))
        else:
            self.oob_score_ = 0.0

        return self

    def predict_raw_votes(self, X: np.ndarray) -> np.ndarray:
        """
        Computes raw unweighted vote counts across ensemble trees.
        Returns shape (N, num_classes) where entries represent discrete tree votes.
        Separates raw decision scores from empirical class probabilities.
        """
        X = np.asarray(X, dtype=np.float32)
        if not self.trees:
            raise RuntimeError("RandomForestClassifier is not fitted.")

        votes = np.zeros((len(X), self.num_classes), dtype=np.int32)
        for tree in self.trees:
            preds = tree.predict(X)
            for i, p in enumerate(preds):
                votes[i, p] += 1
        return votes

    def predict_proba(self, X: np.ndarray) -> np.ndarray:
        """
        Computes empirical ensemble class probabilities by averaging tree leaf frequency distributions.
        Note: Probabilities are direct empirical posteriors in [0, 1] summing to 1.0.
        They are NOT transformed through softmax.
        """
        X = np.asarray(X, dtype=np.float32)
        if not self.trees:
            raise RuntimeError("RandomForestClassifier is not fitted.")

        accum = np.zeros((len(X), self.num_classes), dtype=np.float32)
        for tree in self.trees:
            accum += tree.predict_proba(X)
        return accum / len(self.trees)


    def predict(self, X: np.ndarray) -> np.ndarray:
        """Returns predicted class indices."""
        proba = self.predict_proba(X)
        return np.argmax(proba, axis=1)

    def __call__(self, X: Any) -> Any:
        """Enables direct callable execution for PyTorch loader compatibility."""
        return self.forward(X)

    def forward(self, X: Any) -> Any:
        """Executes forward inference, converting input tensors and returning logits."""
        try:
            import torch
            is_torch = isinstance(X, torch.Tensor)
        except ImportError:
            is_torch = False

        if is_torch:
            import torch
            X_np = X.detach().cpu().numpy()
            if X_np.ndim == 1:
                X_np = X_np.reshape(1, -1)
            probs = self.predict_proba(X_np)
            # Log-transform probabilities so torch.softmax in Agent 1 loader yields exact probabilities
            logits = np.log(np.clip(probs, 1e-7, 1.0))
            return torch.from_numpy(logits).float()
        else:
            X_np = np.asarray(X, dtype=np.float32)
            if X_np.ndim == 1:
                X_np = X_np.reshape(1, -1)
            return self.predict_proba(X_np)

    def to_dict(self) -> Dict[str, Any]:
        """Serializes entire forest to JSON-compatible dictionary."""
        return {
            "n_estimators": self.n_estimators,
            "max_depth": self.max_depth,
            "min_samples_split": self.min_samples_split,
            "min_samples_leaf": self.min_samples_leaf,
            "max_features": str(self.max_features),
            "random_state": self.random_state,
            "num_classes": self.num_classes,
            "oob_score": float(self.oob_score_),
            "feature_importances": self.feature_importances_.tolist(),
            "trees": [t.to_dict() for t in self.trees],
        }

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> RandomForestClassifier:
        """Reconstructs forest from dictionary."""
        rf = cls(
            n_estimators=data.get("n_estimators", 50),
            max_depth=data.get("max_depth", 12),
            min_samples_split=data.get("min_samples_split", 2),
            min_samples_leaf=data.get("min_samples_leaf", 1),
            max_features=data.get("max_features", "sqrt"),
            random_state=data.get("random_state", 42),
            num_classes=data.get("num_classes", len(ROOT_CAUSE_TAXONOMY)),
        )
        rf.oob_score_ = data.get("oob_score", 0.0)
        rf.feature_importances_ = np.array(data.get("feature_importances", []), dtype=np.float64)
        rf.trees = [DecisionTreeClassifier.from_dict(t) for t in data.get("trees", [])]
        return rf
