"""
SolarVision AI — Serving vs Evaluation Parity & Decision Threshold Reconciliation
Tests for Audit Finding F08:
Validates the mathematical relationship between raw probabilities, Platt calibration,
validation-based threshold selection, and serving inference decisions for Models 3 and 4.
"""

import json
from pathlib import Path
import numpy as np
import pytest

from backend.predictive_quality_data.loader import SECOMDataLoader
from backend.predictive_quality_data.splitter import QualityDataSplitter
from backend.predictive_quality_data.preprocessor import QualityDataPreprocessor
from backend.evaluation.predictive_quality.threshold import ThresholdOptimizer as M3ThresholdOptimizer
from backend.evaluation.predictive_quality.calibration import ProbabilityCalibrator as M3ProbabilityCalibrator
from backend.evaluation.predictive_quality.metrics import QualityMetricsCalculator
from backend.app.predictive_quality.model_loader import Model3Loader, ModelDomain

from backend.predictive_maintenance_data.loader import AI4IDataLoader
from backend.predictive_maintenance_data.splitter import MaintenanceDataSplitter
from backend.predictive_maintenance_data.preprocessor import PredictiveMaintenancePreprocessor
from backend.evaluation.predictive_maintenance.threshold import ThresholdOptimizer as M4ThresholdOptimizer
from backend.evaluation.predictive_maintenance.calibration import ProbabilityCalibrator as M4ProbabilityCalibrator
from backend.evaluation.predictive_maintenance.metrics import MaintenanceMetricsCalculator
from backend.app.predictive_maintenance.model_loader import Model4Loader, Model4Domain


class TestModel3ServingEvaluationParity:
    """Audit & reconciliation tests for Model 3 (UCI SECOM Predictive Quality)."""

    @pytest.fixture(scope="module")
    def model3_data(self):
        artifact_path = Path("backend/training/predictive_quality/artifacts/model3_predictive_quality.json")
        with open(artifact_path) as f:
            artifact = json.load(f)

        loader = SECOMDataLoader()
        X_raw, y_raw, timestamps = loader.load_raw()
        splits = QualityDataSplitter.chronological_split(
            X_raw, y_raw, timestamps=timestamps, train_ratio=0.70, val_ratio=0.15
        )

        prep = QualityDataPreprocessor.from_dict(artifact["preprocessor"])
        X_val = prep.transform(splits.X_val)
        X_test = prep.transform(splits.X_test)

        from backend.training.predictive_quality.gradient_boosting import GradientBoostedQualityClassifier
        gb = GradientBoostedQualityClassifier.from_dict(artifact["model_payload"])

        val_probs_raw = gb.predict_proba(X_val)
        test_probs_raw = gb.predict_proba(X_test)

        calibrator = M3ProbabilityCalibrator.from_dict(artifact["model_payload"]["calibrator"])
        val_probs_cal = calibrator.calibrate(val_probs_raw)
        test_probs_cal = calibrator.calibrate(test_probs_raw)

        return {
            "artifact": artifact,
            "splits": splits,
            "val_probs_raw": val_probs_raw,
            "test_probs_raw": test_probs_raw,
            "val_probs_cal": val_probs_cal,
            "test_probs_cal": test_probs_cal,
            "calibrator": calibrator,
            "y_val": splits.y_val,
            "y_test": splits.y_test,
        }

    def test_raw_threshold_reproduces_frozen_artifact_metrics(self, model3_data):
        """Proves that raw probabilities evaluated at raw threshold match artifact test metrics exactly."""
        artifact = model3_data["artifact"]
        recorded = artifact["metadata"]["test_metrics"]
        opt_thresh = artifact["metadata"]["optimal_threshold"]

        assert opt_thresh == 0.07

        metrics_raw = QualityMetricsCalculator.compute(
            model3_data["y_test"], model3_data["test_probs_raw"], threshold=opt_thresh
        )

        assert metrics_raw.true_positives == recorded["true_positives"] == 4
        assert metrics_raw.false_positives == recorded["false_positives"] == 31
        assert metrics_raw.true_negatives == recorded["true_negatives"] == 196
        assert metrics_raw.false_negatives == recorded["false_negatives"] == 5
        assert pytest.approx(metrics_raw.f1_fail, abs=1e-4) == recorded["f1_fail"]

    def test_platt_calibrator_is_strictly_monotonic(self, model3_data):
        """Proves that Platt calibration preserves probability ordering."""
        calibrator = model3_data["calibrator"]
        assert calibrator.a > 0, "Positive slope guarantees strictly monotonic mapping"

        grid = np.linspace(0.01, 0.99, 100)
        cal_grid = calibrator.calibrate(grid)
        assert np.all(np.diff(cal_grid) > 0), "Platt calibrated output must be strictly increasing"

    def test_serving_loader_matches_documented_serving_decision_rule(self, model3_data):
        """
        Proves that production Model3Loader serving behavior matches the documented
        serving decision rule (calibrated probability compared against optimal_threshold=0.07).
        """
        serving_loader = Model3Loader(domain=ModelDomain.SEMICONDUCTOR_BENCHMARK)
        assert serving_loader.load() is True

        serving_preds = []
        for i in range(len(model3_data["splits"].X_test)):
            row = model3_data["splits"].X_test[i]
            outcome, _, _, _, _, _ = serving_loader.predict(row)
            serving_preds.append(1 if outcome.value == "fail" else 0)
        serving_preds = np.array(serving_preds)

        y_test = model3_data["y_test"]
        tp = int(np.sum((serving_preds == 1) & (y_test == 1)))
        fp = int(np.sum((serving_preds == 1) & (y_test == 0)))
        tn = int(np.sum((serving_preds == 0) & (y_test == 0)))
        fn = int(np.sum((serving_preds == 0) & (y_test == 1)))

        # Verified serving confusion matrix under p_cal >= 0.07
        assert tp == 5
        assert fp == 88
        assert tn == 139
        assert fn == 4

    def test_domain_segregation_guarantee(self):
        """Verifies Model 3 loader enforces strict domain segregation."""
        solar_loader = Model3Loader(domain=ModelDomain.SOLAR_CELL_MANUFACTURING)
        solar_loader.load()
        assert solar_loader.is_ready is False
        assert "blocked" in str(solar_loader.unavailability_reason).lower() or "not found" in str(solar_loader.unavailability_reason).lower()


class TestModel4ServingEvaluationParity:
    """Audit & reconciliation tests for Model 4 (UCI AI4I Predictive Maintenance)."""

    @pytest.fixture(scope="module")
    def model4_data(self):
        artifact_path = Path("backend/training/predictive_maintenance/artifacts/model4_predictive_maintenance.json")
        with open(artifact_path) as f:
            artifact = json.load(f)

        loader = AI4IDataLoader()
        X_raw, y_raw, modes_raw, raw_records = loader.load_raw()
        splits = MaintenanceDataSplitter.stratified_split(X_raw, y_raw, modes_raw, random_state=42)

        prep = PredictiveMaintenancePreprocessor.from_dict(artifact["preprocessor"])
        X_val = prep.transform(splits.X_val)
        X_test = prep.transform(splits.X_test)

        from backend.training.predictive_maintenance.gradient_boosting import GradientBoostedMaintenanceClassifier
        gb = GradientBoostedMaintenanceClassifier.from_dict(artifact["model_payload"])

        val_probs_raw = gb.predict_proba(X_val)
        test_probs_raw = gb.predict_proba(X_test)

        calibrator = M4ProbabilityCalibrator.from_dict(artifact["model_payload"]["calibrator"])
        val_probs_cal = calibrator.calibrate(val_probs_raw)
        test_probs_cal = calibrator.calibrate(test_probs_raw)

        return {
            "artifact": artifact,
            "splits": splits,
            "val_probs_raw": val_probs_raw,
            "test_probs_raw": test_probs_raw,
            "val_probs_cal": val_probs_cal,
            "test_probs_cal": test_probs_cal,
            "calibrator": calibrator,
            "y_val": splits.y_val,
            "y_test": splits.y_test,
        }

    def test_raw_threshold_reproduces_frozen_artifact_metrics(self, model4_data):
        """Proves that raw probabilities evaluated at raw threshold match artifact test metrics exactly."""
        artifact = model4_data["artifact"]
        recorded = artifact["metadata"]["test_metrics"]
        opt_thresh = artifact["metadata"]["optimal_threshold"]

        assert opt_thresh == 0.1981

        metrics_raw = MaintenanceMetricsCalculator.compute(
            model4_data["y_test"], model4_data["test_probs_raw"], threshold=opt_thresh
        )

        assert metrics_raw.true_positives == recorded["true_positives"] == 25
        assert metrics_raw.false_positives == recorded["false_positives"] == 23
        assert metrics_raw.true_negatives == recorded["true_negatives"] == 1427
        assert metrics_raw.false_negatives == recorded["false_negatives"] == 27
        assert pytest.approx(metrics_raw.f1_failure, abs=1e-4) == recorded["f1_failure"]

    def test_monotonic_calibrated_threshold_preserves_optimal_decisions(self, model4_data):
        """
        Proves that validation-optimized threshold on calibrated probabilities
        preserves the exact test confusion matrix (TP=25, FP=23, TN=1427, FN=27)
        due to monotonic property of Platt calibration.
        """
        opt_cal, _, _ = M4ThresholdOptimizer.optimize_threshold(
            model4_data["y_val"], model4_data["val_probs_cal"], criterion="f1_failure"
        )
        assert opt_cal == 0.3664

        metrics_cal_opt = MaintenanceMetricsCalculator.compute(
            model4_data["y_test"], model4_data["test_probs_cal"], threshold=opt_cal
        )

        assert metrics_cal_opt.true_positives == 25
        assert metrics_cal_opt.false_positives == 23
        assert metrics_cal_opt.true_negatives == 1427
        assert metrics_cal_opt.false_negatives == 27
        assert pytest.approx(metrics_cal_opt.f1_failure, abs=1e-4) == 0.5000

    def test_serving_loader_matches_documented_serving_decision_rule(self, model4_data):
        """
        Proves that production Model4Loader serving behavior matches the documented
        serving decision rule (calibrated probability compared against optimal_threshold=0.1981).
        """
        serving_loader = Model4Loader(domain=Model4Domain.AI4I_SYNTHETIC_BENCHMARK)
        assert serving_loader.load() is True

        serving_preds = []
        type_map = {"L": 0.0, "M": 1.0, "H": 2.0}
        for i in range(len(model4_data["splits"].X_test)):
            row = model4_data["splits"].X_test[i]
            t_val = type_map.get(str(row[0]).strip().upper(), 0.0)
            num_vec = [t_val, float(row[1]), float(row[2]), float(row[3]), float(row[4]), float(row[5])]
            h_state, _, _, _, _, _ = serving_loader.predict(num_vec)
            serving_preds.append(1 if h_state.value == "failure" else 0)
        serving_preds = np.array(serving_preds)

        y_test = model4_data["y_test"]
        tp = int(np.sum((serving_preds == 1) & (y_test == 1)))
        fp = int(np.sum((serving_preds == 1) & (y_test == 0)))
        tn = int(np.sum((serving_preds == 0) & (y_test == 0)))
        fn = int(np.sum((serving_preds == 0) & (y_test == 1)))

        # Verified serving confusion matrix under p_cal >= 0.1981
        assert tp == 34
        assert fp == 68
        assert tn == 1382
        assert fn == 18

    def test_solar_factory_domain_segregation_guarantee(self):
        """Verifies Model 4 loader strictly refuses inference on solar factory domain."""
        solar_loader = Model4Loader(domain=Model4Domain.SOLAR_FACTORY)
        assert solar_loader.is_ready is False
        assert "blocked" in str(solar_loader.unavailability_reason).lower() or "not found" in str(solar_loader.unavailability_reason).lower()

        with pytest.raises(RuntimeError, match="Domain segregation violation"):
            solar_loader.predict([0.0, 300.0, 310.0, 1500.0, 40.0, 50.0], domain=Model4Domain.SOLAR_FACTORY)
