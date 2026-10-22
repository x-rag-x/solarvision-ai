"""
Unit Tests for Training-Only Feature Preprocessor & Missingness Indicators.

Verifies:
1. Strict fitting on training data (no leakage to validation/test).
2. Missingness masks prevent missing sensors from falsely implying nominal setpoints.
3. Empirical standardization formula z = clip((x - mean) / std, -5.0, 5.0).
4. Serialization and round-trip reloading integrity.
"""

from __future__ import annotations

import json
from pathlib import Path
import numpy as np
import pytest

from backend.root_cause_data.preprocessor import TrainingOnlyFeaturePreprocessor
from backend.root_cause_data.feature_spec import CANONICAL_FEATURE_COUNT_V2


def test_preprocessor_fitting_and_transformation():
    rng = np.random.RandomState(42)
    n_train = 100
    n_features = CANONICAL_FEATURE_COUNT_V2

    # Create synthetic feature matrix
    X_train = rng.randn(n_train, n_features).astype(np.float32)
    # Simulate missing values in sensor column index 32
    missing_mask = np.zeros_like(X_train, dtype=bool)
    missing_mask[:20, 32] = True
    X_train[missing_mask] = np.nan

    preprocessor = TrainingOnlyFeaturePreprocessor(clip_zscore=5.0)
    X_scaled, missing_indicators = preprocessor.fit_transform(X_train, missing_mask)

    assert preprocessor.fitted_
    assert preprocessor.missing_rates_[32] == 0.20
    assert X_scaled.shape == (n_train, n_features)
    assert missing_indicators.shape == (n_train, n_features)

    # Missing indicator must be 1.0 for the missing rows
    assert np.all(missing_indicators[:20, 32] == 1.0)
    assert np.all(missing_indicators[20:, 32] == 0.0)

    # Scaled values must not contain any NaNs or Infs
    assert not np.any(np.isnan(X_scaled))
    assert not np.any(np.isinf(X_scaled))


def test_preprocessor_prevents_leakage_from_test_split():
    rng = np.random.RandomState(101)
    n_features = CANONICAL_FEATURE_COUNT_V2

    # Training data: mean is 10.0
    X_train = 10.0 + rng.randn(50, n_features).astype(np.float32)
    # Test data: distribution shifted to mean 50.0 (e.g. process drift in future)
    X_test = 50.0 + rng.randn(20, n_features).astype(np.float32)

    preprocessor = TrainingOnlyFeaturePreprocessor()
    preprocessor.fit(X_train)

    # Learned mean must reflect training distribution (~10.0), NOT test distribution
    np.testing.assert_allclose(preprocessor.means_, np.full(n_features, 10.0), atol=0.5)

    X_test_scaled, _ = preprocessor.transform(X_test)
    # Since X_test is ~50.0, z-score should be around (50 - 10)/1 = 40, clipped to 5.0
    assert np.all(X_test_scaled[:, 32] >= 4.0)


def test_preprocessor_serialization_round_trip(tmp_path: Path):
    rng = np.random.RandomState(42)
    X_train = rng.randn(40, CANONICAL_FEATURE_COUNT_V2).astype(np.float32)

    preprocessor = TrainingOnlyFeaturePreprocessor()
    preprocessor.fit(X_train)

    json_path = tmp_path / "scaler_params.json"
    preprocessor.save(json_path)
    assert json_path.exists()

    loaded = TrainingOnlyFeaturePreprocessor.load(json_path)
    assert loaded.fitted_
    np.testing.assert_allclose(preprocessor.means_, loaded.means_)
    np.testing.assert_allclose(preprocessor.stds_, loaded.stds_)
    np.testing.assert_allclose(preprocessor.medians_, loaded.medians_)
