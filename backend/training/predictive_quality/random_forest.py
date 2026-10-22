"""
SolarVision AI — Model 3: Predictive Quality Analysis
Balanced Random Forest Classifier for High-Dimensional Imbalanced Quality Data
"""

from __future__ import annotations

import json
from typing import Any, Dict, List, Optional
import numpy as np


class BinaryDecisionNode:
    """Node in a binary decision tree."""

    def __init__(
        self,
        feature_idx: Optional[int] = None,
        threshold: Optional[float] = None,
        prob: Optional[float] = None,
        left: Optional[BinaryDecisionNode] = None,
        right: Optional[BinaryDecisionNode] = None,
    ) -> None:
        self.feature_idx = feature_idx
        self.threshold = threshold
        self.prob = prob  # Empirical P(y=1) at leaf
        self.left = left
        self.right = right

    @property
    def is_leaf(self) -> bool:
        return self.prob is not None

    def to_dict(self) -> Dict[str, Any]:
        if self.is_leaf:
            return {"prob": float(self.prob)}
        return {
            "feature_idx": int(self.feature_idx),
            "threshold": float(self.threshold),
            "left": self.left.to_dict() if self.left else None,
            "right": self.right.to_dict() if self.right else None,
        }

    @classmethod
    def from_dict(cls, d: Dict[str, Any]) -> BinaryDecisionNode:
        if "prob" in d and d["prob"] is not None:
            return cls(prob=float(d["prob"]))
        return cls(
            feature_idx=d["feature_idx"],
            threshold=d["threshold"],
            left=cls.from_dict(d["left"]) if d.get("left") else None,
            right=cls.from_dict(d["right"]) if d.get("right") else None,
        )


class SingleBinaryTree:
    """Individual decision tree fitted on balanced bootstrap samples."""

    def __init__(
        self,
        max_depth: int = 8,
        min_samples_split: int = 5,
        max_features: str = "sqrt",
        random_state: int = 42,
    ) -> None:
        self.max_depth = max_depth
        self.min_samples_split = min_samples_split
        self.max_features = max_features
        self.random_state = random_state
        self.root: Optional[BinaryDecisionNode] = None

    def _gini(self, y: np.ndarray) -> float:
        n = len(y)
        if n == 0:
            return 0.0
        p1 = np.sum(y == 1) / n
        p0 = 1.0 - p1
        return float(1.0 - (p0 ** 2 + p1 ** 2))

    def _build_tree(
        self, X: np.ndarray, y: np.ndarray, depth: int, rng: np.random.RandomState
    ) -> BinaryDecisionNode:
        n_samples, n_features = X.shape
        n_pos = np.sum(y == 1)

        # Leaf conditions
        if (
            depth >= self.max_depth
            or n_samples < self.min_samples_split
            or n_pos == 0
            or n_pos == n_samples
        ):
            leaf_prob = float(n_pos / max(n_samples, 1))
            return BinaryDecisionNode(prob=leaf_prob)

        # Feature subsampling (sqrt(D))
        if self.max_features == "sqrt":
            k = max(1, int(np.sqrt(n_features)))
        else:
            k = n_features
        feat_sub = rng.choice(n_features, size=k, replace=False)

        best_gain = -1.0
        best_feat = None
        best_thresh = None

        current_gini = self._gini(y)

        for f_idx in feat_sub:
            vals = X[:, f_idx]
            # Subsample candidate split thresholds (quantiles)
            if len(vals) > 20:
                thresholds = np.percentile(vals, [20, 35, 50, 65, 80])
            else:
                thresholds = np.unique(vals)

            for t in thresholds:
                left_mask = vals <= t
                right_mask = ~left_mask

                n_left = np.sum(left_mask)
                n_right = np.sum(right_mask)
                if n_left == 0 or n_right == 0:
                    continue

                gini_split = (n_left / n_samples) * self._gini(y[left_mask]) + (
                    n_right / n_samples
                ) * self._gini(y[right_mask])
                gain = current_gini - gini_split

                if gain > best_gain:
                    best_gain = gain
                    best_feat = f_idx
                    best_thresh = float(t)

        if best_gain <= 1e-6 or best_feat is None:
            return BinaryDecisionNode(prob=float(n_pos / max(n_samples, 1)))

        left_mask = X[:, best_feat] <= best_thresh
        left_child = self._build_tree(X[left_mask], y[left_mask], depth + 1, rng)
        right_child = self._build_tree(X[~left_mask], y[~left_mask], depth + 1, rng)

        return BinaryDecisionNode(
            feature_idx=best_feat,
            threshold=best_thresh,
            left=left_child,
            right=right_child,
        )

    def fit(self, X: np.ndarray, y: np.ndarray) -> SingleBinaryTree:
        rng = np.random.RandomState(self.random_state)
        self.root = self._build_tree(X, y, depth=0, rng=rng)
        return self

    def _predict_sample_prob(self, x: np.ndarray, node: BinaryDecisionNode) -> float:
        if node.is_leaf:
            return float(node.prob)
        if x[node.feature_idx] <= node.threshold:
            return self._predict_sample_prob(x, node.left)
        return self._predict_sample_prob(x, node.right)

    def predict_proba(self, X: np.ndarray) -> np.ndarray:
        if self.root is None:
            raise RuntimeError("Tree not fitted.")
        return np.array([self._predict_sample_prob(x, self.root) for x in X], dtype=np.float32)


class BalancedRandomForestQualityClassifier:
    """
    Ensemble of decision trees trained on balanced bootstrap subsamples
    (Chen et al., Balanced Random Forest).
    Each tree draws all failure examples and an equal/2x sample of pass examples.
    """

    def __init__(
        self,
        n_estimators: int = 50,
        max_depth: int = 8,
        min_samples_split: int = 4,
        majority_ratio: float = 2.0,  # ratio of passes to fails in each tree bootstrap
        random_state: int = 42,
    ) -> None:
        self.n_estimators = int(n_estimators)
        self.max_depth = int(max_depth)
        self.min_samples_split = int(min_samples_split)
        self.majority_ratio = float(majority_ratio)
        self.random_state = int(random_state)

        self.trees: List[SingleBinaryTree] = []
        self.feature_importances_: Optional[np.ndarray] = None
        self.is_fitted: bool = False

    def fit(self, X: np.ndarray, y: np.ndarray) -> BalancedRandomForestQualityClassifier:
        rng = np.random.RandomState(self.random_state)
        pos_indices = np.where(y == 1)[0]
        neg_indices = np.where(y == 0)[0]

        n_pos = len(pos_indices)
        if n_pos == 0:
            raise ValueError("Training set contains zero failure samples.")

        n_neg_sample = min(len(neg_indices), max(10, int(n_pos * self.majority_ratio)))

        self.trees = []
        for t_idx in range(self.n_estimators):
            # Bootstrap positive class with replacement
            sampled_pos = rng.choice(pos_indices, size=n_pos, replace=True)
            # Subsample negative class without replacement (or with)
            sampled_neg = rng.choice(neg_indices, size=n_neg_sample, replace=True)

            tree_indices = np.concatenate([sampled_pos, sampled_neg])
            rng.shuffle(tree_indices)

            tree = SingleBinaryTree(
                max_depth=self.max_depth,
                min_samples_split=self.min_samples_split,
                max_features="sqrt",
                random_state=self.random_state + t_idx * 17,
            )
            tree.fit(X[tree_indices], y[tree_indices])
            self.trees.append(tree)

        self.is_fitted = True
        return self

    def predict_proba(self, X: np.ndarray) -> np.ndarray:
        if not self.is_fitted or not self.trees:
            raise RuntimeError("Model is not fitted.")
        tree_probs = [tree.predict_proba(X) for tree in self.trees]
        # Average probability across all ensemble trees
        return np.mean(tree_probs, axis=0).astype(np.float32)

    def predict(self, X: np.ndarray, threshold: float = 0.50) -> np.ndarray:
        probs = self.predict_proba(X)
        return (probs >= threshold).astype(np.int64)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "model_type": "BalancedRandomForestQualityClassifier",
            "n_estimators": self.n_estimators,
            "max_depth": self.max_depth,
            "min_samples_split": self.min_samples_split,
            "majority_ratio": self.majority_ratio,
            "random_state": self.random_state,
            "trees": [t.root.to_dict() for t in self.trees if t.root],
        }

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> BalancedRandomForestQualityClassifier:
        m = cls(
            n_estimators=data["n_estimators"],
            max_depth=data["max_depth"],
            min_samples_split=data["min_samples_split"],
            majority_ratio=data["majority_ratio"],
            random_state=data["random_state"],
        )
        m.trees = []
        for t_dict in data.get("trees", []):
            tree = SingleBinaryTree(max_depth=m.max_depth)
            tree.root = BinaryDecisionNode.from_dict(t_dict)
            m.trees.append(tree)
        m.is_fitted = True
        return m
