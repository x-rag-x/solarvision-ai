"""
SolarVision AI — Model 4: Predictive Maintenance
Unit and Integration Test Suite
"""

from pathlib import Path
import tempfile
import numpy as np
import pytest

from backend.predictive_maintenance_data.loader import AI4IDataLoader
from backend.predictive_maintenance_data.preprocessor import PredictiveMaintenancePreprocessor
from backend.predictive_maintenance_data.splitter import MaintenanceDataSplitter
from backend.evaluation.predictive_maintenance.curves import compute_pr_curve, compute_roc_curve
from backend.evaluation.predictive_maintenance.metrics import MaintenanceMetricsCalculator
from backend.evaluation.predictive_maintenance.calibration import (
    MaintenanceCalibrationEvaluator,
    ProbabilityCalibrator,
)
from backend.evaluation.predictive_maintenance.threshold import ThresholdOptimizer
from backend.training.predictive_maintenance.baseline import MajorityDummyMaintenanceClassifier
from backend.training.predictive_maintenance.logistic_regression import CostSensitiveLogisticRegression
from backend.training.predictive_maintenance.random_forest import BalancedRandomForestMaintenanceClassifier
from backend.training.predictive_maintenance.gradient_boosting import GradientBoostedMaintenanceClassifier
from backend.training.predictive_maintenance.contract import (
    Model4ArtifactContract,
    PredictiveMaintenanceModelMetadata,
)


class TestModel4PredictiveMaintenance:

    def test_ai4i_dataset_loader_and_provenance(self):
        loader = AI4IDataLoader()
        assert loader.verify_file_exists(), "AI4I 2020 raw dataset file must exist."

        X, y, modes, records = loader.load_raw()
        assert X.shape == (10000, 6), f"Expected shape (10000, 6), got {X.shape}"
        assert len(y) == 10000
        assert modes.shape == (10000, 5)

        # Class counts
        n_fail = int(np.sum(y == 1))
        n_pass = int(np.sum(y == 0))
        assert n_fail == 339
        assert n_pass == 9661
        assert np.isclose(n_fail / len(y), 0.0339, atol=1e-3)

        meta = loader.get_provenance_metadata()
        assert meta.dataset_name == "UCI AI4I 2020 Predictive Maintenance Dataset"
        assert meta.doi == "10.24432/C5HS5C"
        assert meta.total_instances == 10000
        assert meta.input_feature_count == 6
        assert meta.failure_instances == 339
        assert meta.is_synthetic is True
        assert meta.sha256_hash == "dc6630cd9b1f0f853922fad78a1b6436570d3f1ec863f1dd5c4340ac56bc8a8e"

    def test_zero_leakage_preprocessor_fitting_and_serialization(self):
        loader = AI4IDataLoader()
        X, y, _, _ = loader.load_raw()

        n_train = 7000
        X_train = X[:n_train]
        X_test = X[n_train:]

        prep = PredictiveMaintenancePreprocessor(clip_zscore=5.0)
        assert not prep.is_fitted
        X_train_trans = prep.fit_transform(X_train)
        assert prep.is_fitted
        assert X_train_trans.shape == (n_train, 6)

        # Check serialization roundtrip
        d = prep.to_dict()
        assert d["n_input_features"] == 6
        assert d["n_output_features"] == 6
        assert len(d["means"]) == 6

        restored_prep = PredictiveMaintenancePreprocessor.from_dict(d)
        X_test_trans_1 = prep.transform(X_test)
        X_test_trans_2 = restored_prep.transform(X_test)
        np.testing.assert_allclose(X_test_trans_1, X_test_trans_2, rtol=1e-5)

    def test_splitter_leakage_and_class_stratification(self):
        loader = AI4IDataLoader()
        X, y, modes, _ = loader.load_raw()

        splits = MaintenanceDataSplitter.stratified_split(
            X, y, modes=modes, train_ratio=0.70, val_ratio=0.15, random_state=42
        )
        assert len(splits.X_train) + len(splits.X_val) + len(splits.X_test) == 10000
        assert 6995 <= len(splits.X_train) <= 7005
        assert 1495 <= len(splits.X_val) <= 1505
        assert 1495 <= len(splits.X_test) <= 1505
        assert splits.train_summary.failure_count == int(339 * 0.70)
        assert splits.val_summary.failure_count == int(339 * 0.15)

        # 80/20 reconciled split
        splits_8020 = MaintenanceDataSplitter.stratified_split_80_20(
            X, y, modes=modes, random_state=42
        )
        assert len(splits_8020.X_train) + len(splits_8020.X_val) + len(splits_8020.X_test) == 10000
        assert 6395 <= len(splits_8020.X_train) <= 6405
        assert 1595 <= len(splits_8020.X_val) <= 1605
        assert 1995 <= len(splits_8020.X_test) <= 2005

    def test_threshold_optimizer_and_metrics_calculation(self):
        np.random.seed(42)
        y_val = np.array([0] * 95 + [1] * 5)
        # Synthetic noisy probabilities
        y_prob = np.concatenate([np.random.uniform(0.01, 0.20, 95), np.random.uniform(0.30, 0.90, 5)])

        opt_th, score, crit = ThresholdOptimizer.optimize_threshold(y_val, y_prob, criterion="f1_failure")
        assert 0.0 < opt_th < 1.0
        assert score > 0.50

        metrics = MaintenanceMetricsCalculator.compute(y_val, y_prob, threshold=opt_th)
        assert metrics.true_positives >= 4
        assert metrics.recall_failure >= 0.80

    def test_probability_calibrator_platt_scaling(self):
        np.random.seed(42)
        y_val_prob = np.random.uniform(0.1, 0.9, size=100)
        y_val_true = (y_val_prob > 0.6).astype(int)

        cal = ProbabilityCalibrator(method="platt")
        assert not cal.is_fitted
        cal.fit(y_val_prob, y_val_true)
        assert cal.is_fitted

        y_test_prob = np.array([0.1, 0.4, 0.7, 0.9])
        cal_p = cal.calibrate(y_test_prob)
        assert len(cal_p) == 4
        assert (cal_p >= 0.0).all() and (cal_p <= 1.0).all()
        # Monotonicity check
        assert cal_p[0] <= cal_p[1] <= cal_p[2] <= cal_p[3]

    def test_model_training_and_inference(self):
        # Small mock batch
        X_mock = np.random.randn(50, 6).astype(np.float32)
        y_mock = np.array([0] * 45 + [1] * 5, dtype=np.int32)

        # Baseline
        base = MajorityDummyMaintenanceClassifier().fit(X_mock, y_mock)
        assert len(base.predict_proba(X_mock)) == 50

        # Logistic Regression
        lr = CostSensitiveLogisticRegression(max_epochs=20, random_state=42).fit(X_mock, y_mock)
        probs_lr = lr.predict_proba(X_mock)
        assert len(probs_lr) == 50
        assert (probs_lr >= 0.0).all() and (probs_lr <= 1.0).all()

        # Random Forest
        rf = BalancedRandomForestMaintenanceClassifier(n_estimators=5, max_depth=4, random_state=42).fit(X_mock, y_mock)
        probs_rf = rf.predict_proba(X_mock)
        assert len(probs_rf) == 50

        # Gradient Boosting
        gb = GradientBoostedMaintenanceClassifier(n_estimators=10, random_state=42).fit(X_mock, y_mock)
        probs_gb = gb.predict_proba(X_mock)
        assert len(probs_gb) == 50

    def test_artifact_contract_serialization_and_verification(self):
        with tempfile.TemporaryDirectory() as tmp_dir:
            out_file = Path(tmp_dir) / "test_model4.json"

            meta = PredictiveMaintenanceModelMetadata(
                model_name="SolarVision_TestModel4",
                model_version="4.0.0-benchmark",
                created_at="2026-10-22T12:00:00Z",
                domain="general_industrial_equipment_benchmark",
                framework="PyTorch_NumPy_SciPy",
                dataset_name="UCI AI4I 2020",
                dataset_doi="10.24432/C5HS5C",
                dataset_license="CC-BY 4.0",
                dataset_sha256="dc6630cd9b1f0f853922fad78a1b6436570d3f1ec863f1dd5c4340ac56bc8a8e",
                training_samples=7000,
                val_samples=1500,
                test_samples=1500,
                input_feature_count=6,
                feature_names=["type", "air_temperature_k", "process_temperature_k", "rotational_speed_rpm", "torque_nm", "tool_wear_min"],
                ordered_feature_schema=[{"index": "0", "name": "type"}],
                split_strategy="stratified_random",
                target_labels={"healthy": 0, "failure": 1},
                optimal_threshold=0.35,
                test_metrics={"accuracy": 0.95, "f1_failure": 0.65},
                calibration_metrics={"expected_calibration_error_ece": 0.02, "brier_score": 0.03},
                reproducibility={"random_state": 42},
                status="BENCHMARK_EVALUATED_READY",
                is_synthetic_benchmark=True,
                synthetic_disclaimer="Synthetic benchmark",
            )

            path, sha256 = Model4ArtifactContract.serialize_artifact(
                metadata=meta,
                model_payload={"weights": [0.1, -0.2]},
                preprocessor_dict={"means": [0.0]},
                output_path=out_file,
            )

            assert path.exists()
            assert sha256 is not None
            assert len(sha256) == 64

            loaded_meta, model_p, prep_d = Model4ArtifactContract.load_and_verify(path)
            assert loaded_meta.model_name == "SolarVision_TestModel4"
            assert loaded_meta.domain == "general_industrial_equipment_benchmark"
            assert loaded_meta.status == "BENCHMARK_EVALUATED_READY"
            assert loaded_meta.sha256_hash == sha256

    def test_trained_production_artifact_reload_and_reproducibility(self):
        artifact_path = Path("backend/training/predictive_maintenance/artifacts/model4_predictive_maintenance.json")
        if not artifact_path.exists():
            pytest.skip("Model 4 benchmark artifact not yet generated.")

        meta, model_payload, preprocessor_dict = Model4ArtifactContract.load_and_verify(artifact_path)
        assert meta.domain in ("ai4i_synthetic_benchmark", "general_industrial_equipment_benchmark")
        assert meta.status == "BENCHMARK_EVALUATED_READY"
        assert meta.is_synthetic_benchmark is True
        assert meta.input_feature_count == 6
        assert len(meta.feature_names) == 6
        assert meta.feature_names == [
            "type",
            "air_temperature_k",
            "process_temperature_k",
            "rotational_speed_rpm",
            "torque_nm",
            "tool_wear_min",
        ]
        assert meta.optimal_threshold > 0.0

        # Verify preprocessor restoration
        prep = PredictiveMaintenancePreprocessor.from_dict(preprocessor_dict)
        test_input = [["L", 298.1, 308.6, 1551.0, 42.8, 0.0]]
        x_trans = prep.transform(test_input)
        assert x_trans.shape == (1, 6)

        # Verify model prediction
        model = GradientBoostedMaintenanceClassifier.from_dict(model_payload)
        prob = model.predict_proba(x_trans)
        assert len(prob) == 1
        assert 0.0 <= prob[0] <= 1.0
