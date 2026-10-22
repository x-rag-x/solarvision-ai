"""
Independent Algorithmic Verification Suite for Vectorized Random Forest.

Verifies:
1. Analytical Gini impurity calculations.
2. Binary and multi-class tree split finding.
3. Out-of-bag (OOB) sample tracking and scoring.
4. Probability normalization (sum to 1.0) and monotonicity.
5. Mean Decrease in Impurity (Gini) feature importance correctness.
6. Serialization round-trip integrity (to_dict / from_dict).
7. PyTorch callable compatibility for Agent 1 loader integration.
"""

from __future__ import annotations

import math
import numpy as np
import pytest
import torch

from backend.training.root_cause.tree_model import (
    DecisionTreeClassifier,
    DecisionTreeNode,
    RandomForestClassifier,
)
from backend.root_cause_data.schema import ROOT_CAUSE_TAXONOMY


class TestGiniImpurityAnalytics:
    """Verifies Gini impurity against analytical mathematical formulations."""

    def test_gini_pure_node(self):
        tree = DecisionTreeClassifier()
        pure_labels = np.zeros(20, dtype=np.int64)
        assert tree._gini(pure_labels) == 0.0

    def test_gini_balanced_binary_split(self):
        tree = DecisionTreeClassifier()
        # Binary balanced: Gini = 1 - (0.5^2 + 0.5^2) = 0.5
        balanced = np.array([0] * 50 + [1] * 50, dtype=np.int64)
        np.testing.assert_almost_equal(tree._gini(balanced), 0.5, decimal=5)

    def test_gini_uniform_three_class(self):
        tree = DecisionTreeClassifier()
        # 3-class uniform: Gini = 1 - 3 * (1/3)^2 = 1 - 3/9 = 2/3 ≈ 0.66667
        uniform_3 = np.array([0] * 30 + [1] * 30 + [2] * 30, dtype=np.int64)
        np.testing.assert_almost_equal(tree._gini(uniform_3), 2.0 / 3.0, decimal=5)


class TestDecisionTreeProperties:
    """Verifies single classification tree convergence and split behavior."""

    def test_linearly_separable_data_zero_training_error(self):
        # 1D threshold problem: x < 0 -> class 0, x >= 0 -> class 1
        X = np.linspace(-5, 5, 100).reshape(-1, 1)
        y = (X[:, 0] >= 0.0).astype(np.int64)

        tree = DecisionTreeClassifier(max_depth=3, random_state=42)
        tree.fit(X, y)

        preds = tree.predict(X)
        np.testing.assert_array_equal(preds, y)

    def test_multiclass_depth_monotonicity(self):
        # Multi-class spiral/radial dataset
        rng = np.random.RandomState(42)
        X = rng.randn(150, 4).astype(np.float32)
        # 3 classes based on radial distance
        r = np.linalg.norm(X, axis=1)
        y = np.digitize(r, bins=[1.5, 2.5]).astype(np.int64)

        tree_shallow = DecisionTreeClassifier(max_depth=1, random_state=42)
        tree_shallow.fit(X, y)
        acc_shallow = np.mean(tree_shallow.predict(X) == y)

        tree_deep = DecisionTreeClassifier(max_depth=6, random_state=42)
        tree_deep.fit(X, y)
        acc_deep = np.mean(tree_deep.predict(X) == y)

        assert acc_deep >= acc_shallow


class TestRandomForestEnsemble:
    """Verifies ensemble properties, OOB scoring, and feature importances."""

    def test_probability_distribution_sums_to_one(self):
        rng = np.random.RandomState(123)
        X = rng.randn(60, 8).astype(np.float32)
        y = rng.randint(0, 4, size=60)

        rf = RandomForestClassifier(n_estimators=10, max_depth=4, num_classes=4, random_state=42)
        rf.fit(X, y)

        probs = rf.predict_proba(X)
        assert probs.shape == (60, 4)
        sums = np.sum(probs, axis=1)
        np.testing.assert_allclose(sums, np.ones(60), atol=1e-5)

    def test_out_of_bag_scoring_in_valid_range(self):
        rng = np.random.RandomState(42)
        X = rng.randn(100, 5).astype(np.float32)
        y = (X[:, 0] + X[:, 1] > 0).astype(np.int64)

        rf = RandomForestClassifier(n_estimators=30, max_depth=5, num_classes=2, random_state=42)
        rf.fit(X, y)

        assert 0.0 <= rf.oob_score_ <= 1.0
        # For this simple linear signal, OOB accuracy should easily beat random coin toss (0.5)
        assert rf.oob_score_ > 0.65

    def test_feature_importances_attribute_true_signal_column(self):
        # Column 0 has strong predictive signal, Column 1 is pure random noise
        rng = np.random.RandomState(42)
        n = 200
        X = np.zeros((n, 2), dtype=np.float32)
        X[:, 0] = rng.randn(n)          # Signal
        X[:, 1] = rng.uniform(-1, 1, n)  # Pure noise
        y = (X[:, 0] > 0.0).astype(np.int64)

        rf = RandomForestClassifier(n_estimators=25, max_depth=4, num_classes=2, random_state=42)
        rf.fit(X, y)

        assert rf.feature_importances_.shape == (2,)
        np.testing.assert_almost_equal(np.sum(rf.feature_importances_), 1.0, decimal=5)
        # Signal column must dominate noise column
        assert rf.feature_importances_[0] > rf.feature_importances_[1] * 2.0

    def test_forest_serialization_and_exact_reconstruction(self):
        rng = np.random.RandomState(99)
        X = rng.randn(40, 6).astype(np.float32)
        y = rng.randint(0, 3, size=40)

        rf_orig = RandomForestClassifier(n_estimators=5, max_depth=3, num_classes=3, random_state=42)
        rf_orig.fit(X, y)

        orig_probs = rf_orig.predict_proba(X)
        serialized = rf_orig.to_dict()

        # Reconstruct from dictionary
        rf_restored = RandomForestClassifier.from_dict(serialized)
        restored_probs = rf_restored.predict_proba(X)

        np.testing.assert_allclose(orig_probs, restored_probs, atol=1e-6)
        np.testing.assert_almost_equal(rf_orig.oob_score_, rf_restored.oob_score_)


class TestAgent1LoaderInteroperability:
    """Verifies that RandomForestClassifier can be invoked directly by Agent 1's PyTorch loader."""

    def test_pytorch_callable_invocation_returns_valid_logits(self):
        rng = np.random.RandomState(42)
        X = rng.randn(20, 10).astype(np.float32)
        y = rng.randint(0, 5, size=20)

        rf = RandomForestClassifier(n_estimators=10, max_depth=4, num_classes=5, random_state=42)
        rf.fit(X, y)

        # Agent 1 passes a torch.Tensor of shape [1, feature_dim]
        sample_tensor = torch.from_numpy(X[0]).float().unsqueeze(0)
        output_logits = rf(sample_tensor)

        assert isinstance(output_logits, torch.Tensor)
        assert output_logits.shape == (1, 5)

        # Softmax in Agent 1 loader must recover class probabilities summing to 1.0
        recovered_probs = torch.softmax(output_logits, dim=-1).squeeze(0).numpy()
        np.testing.assert_allclose(np.sum(recovered_probs), 1.0, atol=1e-5)

        # Must match direct predict_proba closely
        direct_probs = rf.predict_proba(X[0:1])[0]
        np.testing.assert_allclose(recovered_probs, direct_probs, atol=1e-4)
