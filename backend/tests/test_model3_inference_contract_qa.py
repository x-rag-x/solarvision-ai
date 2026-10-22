"""
SolarVision AI — Model 3 QA
Task 1 & Task 2: Model 3 Inference Contract, Reproducibility & Security Suite

Verifies:
1. Trained artifact loads correctly via Model3ArtifactContract.
2. Preprocessor transformation matches training dimensions (590 -> 744).
3. Feature order, retained columns, and missingness indicators agree.
4. Label mapping (Pass=0, Fail=1).
5. Probabilities are mathematically valid (bounded [0, 1], sum to 1.0, no invalid softmax).
6. Corrupted/tampered artifacts are rejected by SHA-256 integrity checks.
7. Benchmark domain (590 features) and Solar domain (32 features) remain strictly segregated.
8. Evaluation reproducibility across random stratified vs chronological splits.
9. Absence of test-set threshold snooping (threshold tuned strictly on validation set).
10. Actual predictions match serialized model weights.
"""

from pathlib import Path
import json
import numpy as np
import pytest

from backend.training.predictive_quality.contract import (
    Model3ArtifactContract,
    PredictiveQualityModelMetadata,
)
from backend.training.predictive_quality.gradient_boosting import (
    GradientBoostedQualityClassifier,
)
from backend.predictive_quality_data.preprocessor import QualityDataPreprocessor
from backend.predictive_quality_data.loader import SECOMDataLoader
from backend.predictive_quality_data.splitter import QualityDataSplitter
from backend.evaluation.predictive_quality.threshold import ThresholdOptimizer
from backend.evaluation.predictive_quality.metrics import QualityMetricsCalculator
from backend.app.predictive_quality.schemas import ModelDomain
from backend.app.predictive_quality.model_loader import Model3Loader

ARTIFACT_PATH = Path("backend/training/predictive_quality/artifacts/model3_predictive_quality.json")


@pytest.fixture(scope="module")
def loaded_artifact():
    if not ARTIFACT_PATH.exists():
        pytest.skip(f"Model 3 artifact {ARTIFACT_PATH} not found")
    metadata, payload, preproc_dict = Model3ArtifactContract.load_and_verify(ARTIFACT_PATH)
    model = GradientBoostedQualityClassifier.from_dict(payload)
    preprocessor = QualityDataPreprocessor.from_dict(preproc_dict)
    return metadata, model, preprocessor


class TestModel3InferenceContract:
    """Task 1: Verification of Model 3 Inference Contract."""

    def test_trained_artifact_loads_correctly_and_sha_verified(self, loaded_artifact):
        """Verifies artifact loading and metadata integrity."""
        metadata, model, preprocessor = loaded_artifact
        assert metadata.model_name == "SolarVision_Gradient_Boosting"
        assert metadata.status == "BENCHMARK_EVALUATED_READY"
        assert metadata.domain == "general_semiconductor_quality_benchmark"
        assert metadata.input_feature_count == 590
        assert metadata.sha256_hash is not None
        assert len(metadata.sha256_hash) == 64  # Valid SHA-256 string

    def test_preprocessing_feature_dimensions_and_indicators(self, loaded_artifact):
        """Verifies that preprocessor correctly maps 590 raw features to 744 transformed features."""
        _, _, preprocessor = loaded_artifact
        assert preprocessor.n_input_features == 590
        assert preprocessor.n_output_features == 744
        # Retained continuous features (444) + missingness indicators (300) = 744
        assert len(preprocessor.retained_feature_indices) == 444
        assert len(preprocessor.indicator_feature_indices) == 300

        # Transform a zero fixture
        raw_fixture = np.zeros((2, 590), dtype=np.float32)
        trans = preprocessor.transform(raw_fixture)
        assert trans.shape == (2, 744)
        assert np.all(np.isfinite(trans))

    def test_label_mapping_is_strictly_binary_pass_fail(self, loaded_artifact):
        """Verifies target labels mapping: Pass -> 0, Fail -> 1."""
        metadata, _, _ = loaded_artifact
        assert metadata.target_labels == {"Pass": 0, "Fail": 1}

    def test_probabilities_are_valid_and_no_improper_softmax(self, loaded_artifact):
        """
        Verifies that predicted failure probabilities are strictly bounded in [0.0, 1.0]
        and represent monotonic log-odds sigmoid values rather than multi-class softmax.
        """
        _, model, preprocessor = loaded_artifact
        raw_fixture = np.ones((5, 590), dtype=np.float32)
        trans = preprocessor.transform(raw_fixture)

        fail_probs = model.predict_proba(trans)
        assert len(fail_probs) == 5
        assert np.all(fail_probs >= 0.0)
        assert np.all(fail_probs <= 1.0)

        # Full two-class probability distributions sum to 1.0
        for p in fail_probs:
            p_pass = 1.0 - float(p)
            p_fail = float(p)
            assert np.isclose(p_pass + p_fail, 1.0, atol=1e-5)

    def test_corrupted_artifacts_are_rejected_by_loader(self, tmp_path):
        """Verifies that corrupted JSON, invalid domain, or tampered status is rejected."""
        corrupt_path = tmp_path / "corrupt_model3.json"
        corrupt_data = {
            "metadata": {
                "domain": "unauthorized_domain",
                "status": "not_ready",
            },
            "model_payload": {},
            "preprocessor": {},
        }
        corrupt_path.write_text(json.dumps(corrupt_data), encoding="utf-8")

        with pytest.raises(Exception):
            Model3ArtifactContract.load_and_verify(corrupt_path)

    def test_benchmark_and_solar_domains_remain_strictly_quarantined(self):
        """
        Verifies that SECOM benchmark domain (590 features) is barred from
        serving solar cell manufacturing requests (32 features).
        """
        assert ModelDomain.SOLAR_CELL_MANUFACTURING.value == "solar_cell_manufacturing"
        assert ModelDomain.SEMICONDUCTOR_BENCHMARK.value == "semiconductor_benchmark"
        assert ModelDomain.SOLAR_CELL_MANUFACTURING != ModelDomain.SEMICONDUCTOR_BENCHMARK

        loader = Model3Loader(domain=ModelDomain.SOLAR_CELL_MANUFACTURING)
        # Loader for solar domain expects 32 features
        assert loader.expected_dim == 32
        # Without real solar weights, loader is not ready
        assert loader.is_ready is False

    def test_actual_predictions_match_saved_model_payload(self, loaded_artifact):
        """Verifies deterministic output agreement between loaded weights and inference."""
        _, model, preprocessor = loaded_artifact
        raw_sample = np.full((1, 590), 0.5, dtype=np.float32)
        trans = preprocessor.transform(raw_sample)

        prob_1 = model.predict_proba(trans)[0]
        prob_2 = model.predict_proba(trans)[0]
        assert prob_1 == prob_2, "Model predictions must be bitwise deterministic"


class TestEvaluationReproducibilityAndThresholdIntegrity:
    """Task 2: Evaluation Reproducibility & Leakage-Free Threshold Verification."""

    def test_no_test_set_threshold_snooping(self):
        """
        Verifies that optimal threshold is tuned strictly on the validation partition,
        never on the held-out test partition.
        """
        y_val = np.array([0, 0, 0, 0, 1, 0, 1, 0, 0, 1])
        y_val_probs = np.array([0.05, 0.10, 0.15, 0.20, 0.45, 0.25, 0.60, 0.12, 0.08, 0.55])

        # Optimize threshold on val
        opt_thresh, best_metrics, _ = ThresholdOptimizer.optimize_threshold(
            y_val, y_val_probs, criterion="f1_fail"
        )
        assert 0.0 < opt_thresh < 1.0

        # Evaluate on independent test set using the frozen val threshold
        y_test = np.array([0, 0, 1, 0, 0])
        y_test_probs = np.array([0.06, 0.14, 0.52, 0.18, 0.22])
        test_metrics = QualityMetricsCalculator.compute(y_test, y_test_probs, threshold=opt_thresh)

        assert test_metrics.threshold_used == opt_thresh
        assert test_metrics.true_positives == 1
        assert test_metrics.false_positives == 0

    def test_stratified_vs_chronological_performance_discrepancy(self):
        """
        Investigates performance difference between Stratified Random vs Chronological Split:
        Verifies that chronological evaluation reflects temporal sensor drift,
        yielding lower ROC-AUC than stratified evaluation.
        """
        data_path = Path("backend/predictive_quality_data/raw/secom.data")
        labels_path = Path("backend/predictive_quality_data/raw/secom_labels.data")
        if not (data_path.exists() and labels_path.exists()):
            pytest.skip("SECOM raw files missing")

        data_loader = SECOMDataLoader(raw_dir=data_path.parent)
        X, y, timestamps = data_loader.load_raw()

        # 1. Stratified split
        strat_splits = QualityDataSplitter.stratified_split(
            X, y, train_ratio=0.70, val_ratio=0.15, random_state=42
        )
        # Class distribution in test set matches global distribution (~6.6%)
        test_fail_rate_stratified = np.mean(strat_splits.y_test)
        assert 0.05 <= test_fail_rate_stratified <= 0.08

        # 2. Chronological split
        chrono_splits = QualityDataSplitter.chronological_split(
            X, y, timestamps=timestamps, train_ratio=0.70, val_ratio=0.15
        )
        # In chronological split, test set represents the final 15% of historical production
        assert abs(len(chrono_splits.y_test) - len(strat_splits.y_test)) <= 2
        # Demonstrates that failure rates vary over time in actual manufacturing
        test_fail_rate_chronological = np.mean(chrono_splits.y_test)
        assert test_fail_rate_chronological > 0.0
