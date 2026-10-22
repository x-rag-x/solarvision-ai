"""
SolarVision AI — Model 4: Predictive Maintenance
Balanced Random Forest Classifier (Chen et al. Bootstrap Resampling)
"""

from __future__ import annotations

from typing import Any, Dict, List, Optional, Tuple
import numpy as np


class SimpleDecisionTreeNode:
    def __init__(
        self,
        depth: int = 0,
        feature_idx: Optional[int] = None,
        threshold: Optional[float] = None,
        left: Optional["SimpleDecisionTreeNode"] = None,
        right: Optional["SimpleDecisionTreeNode"] = None,
        prob_positive: float = 0.0,
        is_leaf: bool = False,
    ) -> None:
        self.depth = depth
        self.feature_idx = feature_idx
        self.threshold = threshold
        self.left = left
        self.right = right
        self.prob_positive = prob_positive
        self.is_leaf = is_leaf

    def predict_one(self, x: np.ndarray) -> float:
        if self.is_leaf:
            return self.prob_positive
        assert self.feature_idx is not None and self.threshold is not None
        if x[self.feature_idx] <= self.threshold:
            assert self.left is not None
            return self.left.predict_one(x)
        else:
            assert self.right is not None
            return self.right.predict_one(x)

    def to_dict(self) -> Dict[str, Any]:
        if self.is_leaf:
            return {"is_leaf": True, "prob_positive": self.prob_positive, "depth": self.depth}
        return {
            "is_leaf": False,
            "depth": self.depth,
            "feature_idx": self.feature_idx,
            "threshold": self.threshold,
            "left": self.left.to_dict() if self.left else None,
            "right": self.right.to_dict() if self.right else None,
            "prob_positive": self.prob_positive,
        }

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "SimpleDecisionTreeNode":
        if data.get("is_leaf", False):
            return cls(
                depth=data.get("depth", 0),
                prob_positive=float(data.get("prob_positive", 0.0)),
                is_leaf=True,
            )
        node = cls(
            depth=data.get("depth", 0),
            feature_idx=data.get("feature_idx"),
            threshold=float(data["threshold"]) if data.get("threshold") is not None else None,
            prob_positive=float(data.get("prob_positive", 0.0)),
            is_leaf=False,
        )
        if data.get("left"):
            node.left = cls.from_dict(data["left"])
        if data.get("right"):
            node.right = cls.from_dict(data["right"])
        return node


class SimpleDecisionTree:
    def __init__(
        self,
        max_depth: int = 7,
        min_samples_split: int = 4,
        max_features_ratio: float = 0.8,
        random_state: int = 42,
    ) -> None:
        self.max_depth = max_depth
        self.min_samples_split = min_samples_split
        self.max_features_ratio = max_features_ratio
        self.random_state = random_state
        self.root: Optional[SimpleDecisionTreeNode] = None

    def fit(self, X: np.ndarray, y: np.ndarray, rng: np.random.RandomState) -> "SimpleDecisionTree":
        self.root = self._build_tree(X, y, depth=0, rng=rng)
        return self

    def _gini(self, y: np.ndarray) -> float:
        n = len(y)
        if n == 0:
            return 0.0
        p = np.mean(y == 1)
        return 2.0 * p * (1.0 - p)

    def _build_tree(
        self, X: np.ndarray, y: np.ndarray, depth: int, rng: np.random.RandomState
    ) -> SimpleDecisionTreeNode:
        n_samples, n_features = X.shape
        p_pos = float(np.mean(y == 1)) if n_samples > 0 else 0.0

        if (
            depth >= self.max_depth
            or n_samples < self.min_samples_split
            or p_pos == 0.0
            or p_pos == 1.0
        ):
            return SimpleDecisionTreeNode(depth=depth, prob_positive=p_pos, is_leaf=True)

        current_gini = self._gini(y)
        best_gain = -1.0
        best_feat = None
        best_th = None
        best_left_idx = None
        best_right_idx = None

        # Random feature subset selection
        n_sub_feats = max(1, int(n_features * self.max_features_ratio))
        sub_feats = rng.choice(n_features, size=n_sub_feats, replace=False)

        for f_idx in sub_feats:
            col_vals = X[:, f_idx]
            # Select 10 candidate percentiles
            percentiles = np.linspace(10, 90, 9)
            candidate_thresholds = np.percentile(col_vals, percentiles)

            for th in candidate_thresholds:
                left_mask = col_vals <= th
                right_mask = ~left_mask

                n_left = np.sum(left_mask)
                n_right = np.sum(right_mask)
                if n_left == 0 or n_right == 0:
                    continue

                gini_left = self._gini(y[left_mask])
                gini_right = self._gini(y[right_mask])
                weighted_gini = (n_left * gini_left + n_right * gini_right) / n_samples
                gain = current_gini - weighted_gini

                if gain > best_gain:
                    best_gain = gain
                    best_feat = f_idx
                    best_th = float(th)
                    best_left_idx = left_mask
                    best_right_idx = right_mask

        if best_gain <= 1e-5 or best_feat is None or best_left_idx is None or best_right_idx is None:
            return SimpleDecisionTreeNode(depth=depth, prob_positive=p_pos, is_leaf=True)

        left_node = self._build_tree(X[best_left_idx], y[best_left_idx], depth + 1, rng)
        right_node = self._build_tree(X[best_right_idx], y[best_right_idx], depth + 1, rng)

        return SimpleDecisionTreeNode(
            depth=depth,
            feature_idx=best_feat,
            threshold=best_th,
            left=left_node,
            right=right_node,
            prob_positive=p_pos,
            is_leaf=False,
        )

    def predict_proba(self, X: np.ndarray) -> np.ndarray:
        if self.root is None:
            raise RuntimeError("Tree is not fitted.")
        return np.array([self.root.predict_one(x) for x in X], dtype=np.float32)


class BalancedRandomForestMaintenanceClassifier:
    """
    Ensemble of decision trees trained on balanced bootstrap subsamples (Chen et al.).
    Guarantees equal representation of failure events in every individual tree.
    """

    def __init__(
        self,
        n_estimators: int = 50,
        max_depth: int = 7,
        min_samples_split: int = 4,
        majority_ratio: float = 2.0,
        random_state: int = 42,
    ) -> None:
        self.n_estimators = int(n_estimators)
        self.max_depth = int(max_depth)
        self.min_samples_split = int(min_samples_split)
        self.majority_ratio = float(majority_ratio)
        self.random_state = int(random_state)
        self.trees: List[SimpleDecisionTree] = []
        self.is_fitted: bool = False

    def fit(self, X: np.ndarray, y: np.ndarray) -> "BalancedRandomForestMaintenanceClassifier":
        rng = np.random.RandomState(self.random_state)
        pos_indices = np.where(y == 1)[0]
        neg_indices = np.where(y == 0)[0]

        n_pos = len(pos_indices)
        n_neg_sample = int(min(len(neg_indices), n_pos * self.majority_ratio))

        self.trees = []
        for i in range(self.n_estimators):
            # Bootstrap positive and negative samples
            sub_pos = rng.choice(pos_indices, size=n_pos, replace=True)
            sub_neg = rng.choice(neg_indices, size=n_neg_sample, replace=True)
            boot_idx = np.concatenate([sub_pos, sub_neg])
            rng.shuffle(boot_idx)

            tree_rng = np.random.RandomState(self.random_state + i * 17 + 1)
            tree = SimpleDecisionTree(
                max_depth=self.max_depth,
                min_samples_split=self.min_samples_split,
                random_state=self.random_state + i,
            )
            tree.fit(X[boot_idx], y[boot_idx], rng=tree_rng)
            self.trees.append(tree)

        self.is_fitted = True
        return self

    def predict_proba(self, X: np.ndarray) -> np.ndarray:
        if not self.is_fitted or not self.trees:
            raise RuntimeError("Model is not fitted.")
        all_probs = np.array([tree.predict_proba(X) for tree in self.trees])
        return np.mean(all_probs, axis=0).astype(np.float32)

    def predict(self, X: np.ndarray, threshold: float = 0.50) -> np.ndarray:
        probs = self.predict_proba(X)
        return (probs >= threshold).astype(np.int32)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "model_type": "BalancedRandomForestMaintenanceClassifier",
            "n_estimators": self.n_estimators,
            "max_depth": self.max_depth,
            "min_samples_split": self.min_samples_split,
            "majority_ratio": self.majority_ratio,
            "random_state": self.random_state,
            "trees": [t.root.to_dict() for t in self.trees if t.root],
            "is_fitted": self.is_fitted,
        }

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "BalancedRandomForestMaintenanceClassifier":
        model = cls(
            n_estimators=data.get("n_estimators", 50),
            max_depth=data.get("max_depth", 7),
            min_samples_split=data.get("min_samples_split", 4),
            majority_ratio=data.get("majority_ratio", 2.0),
            random_state=data.get("random_state", 42),
        )
        model.trees = []
        for tree_data in data.get("trees", []):
            tree = SimpleDecisionTree(max_depth=model.max_depth)
            tree.root = SimpleDecisionTreeNode.from_dict(tree_data)
            model.trees.append(tree)
        model.is_fitted = bool(data.get("is_fitted", True))
        return model
