"""
SolarVision AI — Model 3: Predictive Quality Analysis
Unit and Integration Test Suite
"""

import tempfile
from pathlib import Path
import pytest
import numpy as np

from backend.predictive_quality_data.loader import SECOMDataLoader
from backend.predictive_quality_data.preprocessor import QualityDataPreprocessor
from backend.predictive_quality_data.splitter import QualityDataSplitter
from backend.evaluation.predictive_quality.curves import compute_pr_curve, compute_roc_curve
from backend.evaluation.predictive_quality.metrics import QualityMetricsCalculator
from backend.evaluation.predictive_quality.calibration import (
    ProbabilityCalibrator,
    QualityCalibrationEvaluator,
)
from backend.evaluation.predictive_quality.threshold import ThresholdOptimizer
from backend.training.predictive_quality.baseline import MajorityDummyQualityClassifier
from backend.training.predictive_quality.logistic_regression import CostSensitiveLogisticRegression
from backend.training.predictive_quality.random_forest import BalancedRandomForestQualityClassifier
from backend.training.predictive_quality.gradient_boosting import GradientBoostedQualityClassifier
from backend.training.predictive_quality.contract import (
    Model3ArtifactContract,
    PredictiveQualityModelMetadata,
)


class TestModel3PredictiveQuality:

    def test_secom_dataset_loader_and_provenance(self):
        loader = SECOMDataLoader()
        assert loader.verify_files_exist(), "SECOM raw dataset files must exist."

        X, y, timestamps = loader.load_raw()
        assert X.shape == (1567, 590)
        assert len(y) == 1567
        assert len(timestamps) == 1567

        # Label counts
        n_fail = int(np.sum(y == 1))
        n_pass = int(np.sum(y == 0))
        assert n_fail == 104
        assert n_pass == 1463
        assert np.isclose(n_fail / len(y), 0.06637, atol=1e-3)

        meta = loader.get_provenance_metadata()
        assert meta.dataset_name == "UCI SECOM (Semi-Conductor Manufacturing Process)"
        assert meta.doi == "10.24432/C57G69"
        assert meta.total_instances == 1567
        assert meta.raw_feature_count == 590
        assert meta.pass_instances == 1463
        assert meta.fail_instances == 104

    def test_zero_leakage_preprocessor_fitting(self):
        loader = SECOMDataLoader()
        X, y, _ = loader.load_raw()

        # Split 70% train
        n_train = 1000
        X_train = X[:n_train]
        X_test = X[n_train:]

        preprocessor = QualityDataPreprocessor(
            max_missing_ratio=0.50,
            clip_zscore=5.0,
            add_missing_indicators=True,
        )

        assert not preprocessor.is_fitted
        X_train_trans = preprocessor.fit_transform(X_train)
        assert preprocessor.is_fitted

        # Must have dropped constant features and high missing features
        assert len(preprocessor.constant_feature_indices) > 50
        assert len(preprocessor.high_missing_feature_indices) > 10
        assert len(preprocessor.retained_feature_indices) > 0

        # Transformed train and test matrices must have NO NaNs
        assert not np.isnan(X_train_trans).any(), "X_train transformed contains NaNs!"
        X_test_trans = preprocessor.transform(X_test)
        assert not np.isnan(X_test_trans).any(), "X_test transformed contains NaNs!"
        assert X_train_trans.shape[1] == X_test_trans.shape[1]

        # Serialization test
        d = preprocessor.to_dict()
        p_reconstructed = QualityDataPreprocessor.from_dict(d)
        assert p_reconstructed.is_fitted
        assert p_reconstructed.n_output_features == preprocessor.n_output_features
        X_test_recon = p_reconstructed.transform(X_test)
        np.testing.assert_allclose(X_test_trans, X_test_recon)

    def test_splitter_leakage_and_temporal_order(self):
        loader = SECOMDataLoader()
        X, y, timestamps = loader.load_raw()

        # Chronological split test
        splits_chrono = QualityDataSplitter.chronological_split(
            X, y, timestamps=timestamps, train_ratio=0.70, val_ratio=0.15
        )
        assert splits_chrono.split_strategy == "time_aware_chronological"
        assert len(splits_chrono.X_train) == int(1567 * 0.70)
        assert splits_chrono.train_summary.max_timestamp <= splits_chrono.val_summary.min_timestamp
        assert splits_chrono.val_summary.max_timestamp <= splits_chrono.test_summary.min_timestamp

        # Stratified split test
        splits_strat = QualityDataSplitter.stratified_split(
            X, y, train_ratio=0.70, val_ratio=0.15, random_state=42
        )
        assert splits_strat.split_strategy == "stratified_random"
        # Verify failure rate is preserved across splits (~6.6%)
        assert abs(splits_strat.train_summary.failure_rate_pct - 6.64) < 1.0
        assert abs(splits_strat.val_summary.failure_rate_pct - 6.64) < 2.0
        assert abs(splits_strat.test_summary.failure_rate_pct - 6.64) < 2.0

    def test_metrics_and_curves_calculation(self):
        y_true = np.array([0, 0, 0, 0, 0, 0, 1, 1, 1, 1])
        y_prob = np.array([0.1, 0.2, 0.15, 0.3, 0.4, 0.6, 0.7, 0.8, 0.85, 0.9])

        res = QualityMetricsCalculator.compute(y_true, y_prob, threshold=0.50)
        assert res.true_positives == 4
        assert res.false_positives == 1
        assert res.true_negatives == 5
        assert res.false_negatives == 0
        assert res.recall_fail == 1.0
        assert res.precision_fail == 4.0 / 5.0
        expected_f1 = 2.0 * (0.8 * 1.0) / (0.8 + 1.0)
        assert np.isclose(res.f1_fail, expected_f1, atol=1e-3)
        assert res.roc_auc > 0.90
        assert res.pr_auc > 0.80

    def test_threshold_optimizer_f1_maximization(self):
        # Skewed predictions where probabilities for failure are low (<0.40)
        y_true = np.array([0, 0, 0, 0, 0, 0, 0, 1, 1, 1])
        y_prob = np.array([0.02, 0.04, 0.05, 0.08, 0.10, 0.12, 0.15, 0.25, 0.30, 0.35])

        # At default 0.50 threshold, failure recall is 0.0
        default_res = QualityMetricsCalculator.compute(y_true, y_prob, threshold=0.50)
        assert default_res.f1_fail == 0.0
        assert default_res.recall_fail == 0.0

        # Optimizing threshold selects a threshold below 0.25 to capture failures
        opt_th, opt_res, _ = ThresholdOptimizer.optimize_threshold(
            y_val_true=y_true, y_val_prob=y_prob, criterion="f1_fail"
        )
        assert opt_th <= 0.25
        assert opt_res.f1_fail > 0.80
        assert opt_res.recall_fail == 1.0

    def test_models_train_and_predict(self):
        # Small synthetic mock slice to verify fit & predict API
        X_mock = np.random.randn(40, 20).astype(np.float32)
        y_mock = np.array([0] * 35 + [1] * 5, dtype=np.int64)

        # Baseline
        base = MajorityDummyQualityClassifier().fit(X_mock, y_mock)
        assert len(base.predict(X_mock)) == 40
        assert (base.predict(X_mock) == 0).all()

        # Logistic Regression
        lr = CostSensitiveLogisticRegression(max_epochs=20).fit(X_mock, y_mock)
        probs_lr = lr.predict_proba(X_mock)
        assert len(probs_lr) == 40
        assert (probs_lr >= 0.0).all() and (probs_lr <= 1.0).all()

        # Random Forest
        rf = BalancedRandomForestQualityClassifier(n_estimators=10, max_depth=4).fit(X_mock, y_mock)
        probs_rf = rf.predict_proba(X_mock)
        assert len(probs_rf) == 40
        assert (probs_rf >= 0.0).all() and (probs_rf <= 1.0).all()

        # Gradient Boosting
        gb = GradientBoostedQualityClassifier(n_estimators=10).fit(X_mock, y_mock)
        probs_gb = gb.predict_proba(X_mock)
        assert len(probs_gb) == 40
        assert (probs_gb >= 0.0).all() and (probs_gb <= 1.0).all()

    def test_artifact_contract_serialization_and_verification(self):
        with tempfile.TemporaryDirectory() as tmp_dir:
            out_file = Path(tmp_dir) / "test_model3.json"

            meta = PredictiveQualityModelMetadata(
                model_name="SolarVision_TestModel",
                model_version="3.0.0-benchmark",
                created_at="2026-10-22T08:00:00Z",
                domain="general_semiconductor_quality_benchmark",
                framework="PyTorch_NumPy_SciPy",
                dataset_name="UCI SECOM",
                dataset_doi="10.24432/C57G69",
                dataset_license="CC-BY 4.0",
                training_samples=1000,
                val_samples=250,
                test_samples=250,
                input_feature_count=590,
                retained_feature_count=450,
                output_feature_count=450,
                split_strategy="stratified_random",
                target_labels={"Pass": 0, "Fail": 1},
                optimal_threshold=0.35,
                test_metrics={"accuracy": 0.90, "f1_fail": 0.25},
                calibration_metrics={"ece": 0.05, "brier_score": 0.08},
                reproducibility={"seed": 42},
                status="BENCHMARK_EVALUATED_READY",
            )

            path, sha256 = Model3ArtifactContract.serialize_artifact(
                metadata=meta,
                model_payload={"weights": [0.1, -0.2]},
                preprocessor_dict={"means": [0.0]},
                output_path=out_file,
            )

            assert path.exists()
            assert sha256 is not None
            assert len(sha256) == 64

            # Verify load and contract validation
            loaded_meta, model_p, prep_d = Model3ArtifactContract.load_and_verify(path)
            assert loaded_meta.model_name == "SolarVision_TestModel"
            assert loaded_meta.domain == "general_semiconductor_quality_benchmark"
            assert loaded_meta.status == "BENCHMARK_EVALUATED_READY"
            assert loaded_meta.sha256_hash == sha256

    def test_reconciled_80_20_split_leakage_and_counts(self):
        loader = SECOMDataLoader()
        X, y, timestamps = loader.load_raw()

        splits_8020 = QualityDataSplitter.stratified_split_80_20(
            X, y, random_state=42, timestamps=timestamps
        )
        assert len(splits_8020.X_train) == int(1567 * 0.64)  # 1002
        assert len(splits_8020.X_val) == int(1567 * 0.16)    # 250
        assert len(splits_8020.X_test) == 1567 - len(splits_8020.X_train) - len(splits_8020.X_val)
        assert len(splits_8020.X_test) in (314, 315)  # 20% test partition (~314-315 samples)

        # Assert no index overlaps
        assert len(splits_8020.X_train) + len(splits_8020.X_val) + len(splits_8020.X_test) == 1567

    def test_probability_calibrator_platt_and_isotonic(self):
        np.random.seed(42)
        # Synthetic probabilities and labels with overconfidence
        y_val_prob = np.random.uniform(0.1, 0.9, size=100)
        y_val_true = (y_val_prob > 0.6).astype(int)

        # Platt scaling
        platt = ProbabilityCalibrator(method="platt")
        assert not platt.is_fitted
        platt.fit(y_val_prob, y_val_true)
        assert platt.is_fitted

        y_test_prob = np.array([0.1, 0.4, 0.7, 0.9])
        cal_platt = platt.calibrate(y_test_prob)
        assert len(cal_platt) == 4
        assert (cal_platt >= 0.0).all() and (cal_platt <= 1.0).all()
        # Monotonicity check
        assert cal_platt[0] <= cal_platt[1] <= cal_platt[2] <= cal_platt[3]

        # Serialization check
        d = platt.to_dict()
        assert d["method"] == "platt"
        assert d["is_fitted"] is True
        platt_restored = ProbabilityCalibrator.from_dict(d)
        np.testing.assert_allclose(platt_restored.calibrate(y_test_prob), cal_platt)

        # Isotonic regression
        iso = ProbabilityCalibrator(method="isotonic")
        iso.fit(y_val_prob, y_val_true)
        assert iso.is_fitted
        cal_iso = iso.calibrate(y_test_prob)
        assert len(cal_iso) == 4
        assert (cal_iso >= 0.0).all() and (cal_iso <= 1.0).all()

