"""Unit tests for Model 2 Root Cause Dataset Engineering, Training, and Evaluation."""

import json
from pathlib import Path
import pytest
import numpy as np

from backend.root_cause_data.schema import (
    CANONICAL_FEATURE_ORDER,
    ROOT_CAUSE_TAXONOMY,
    SENSOR_UNIT_REGISTRY,
    SensorReading,
)
from backend.root_cause_data.validator import TelemetryValidator
from backend.root_cause_data.time_window import TimeWindowFeatureExtractor
from backend.root_cause_data.ingestion import TelemetryIngestionEngine
from backend.root_cause_data.splitter import LeakageFreeSplitter
from backend.root_cause_data.fixtures import generate_pipeline_test_fixtures
from backend.root_cause_data.pipeline import RootCauseDatasetPipeline
from backend.training.root_cause.contract import Model2ArtifactContract, ModelMetadata
from backend.training.root_cause.baseline import MajorityClassBaseline, DefectPriorHeuristicBaseline
from backend.training.root_cause.tree_model import DecisionTreeClassifier, RandomForestClassifier
from backend.training.root_cause.trainer import RootCauseModelTrainer
from backend.evaluation.root_cause.metrics import RootCauseMetricsCalculator
from backend.evaluation.root_cause.confusion_matrix import ConfusionMatrixCalculator
from backend.evaluation.root_cause.calibration import CalibrationEvaluator
from backend.evaluation.root_cause.explainability import RootCauseExplainer
from backend.evaluation.root_cause.evaluate_model import Model2Evaluator


def test_schema_and_taxonomy_completeness():
    assert len(ROOT_CAUSE_TAXONOMY) == 9
    assert "thermal_stress_soldering" in ROOT_CAUSE_TAXONOMY
    assert "squeegee_pressure_drift" in ROOT_CAUSE_TAXONOMY
    assert "screen_mesh_clogging" in ROOT_CAUSE_TAXONOMY
    assert "firing_thermal_profile_excursion" in ROOT_CAUSE_TAXONOMY
    assert "mechanical_handling_impact" in ROOT_CAUSE_TAXONOMY
    assert "lamination_pressure_imbalance" in ROOT_CAUSE_TAXONOMY
    assert "ingot_thermal_gradient" in ROOT_CAUSE_TAXONOMY
    assert "chemical_texturing_contamination" in ROOT_CAUSE_TAXONOMY
    assert "nominal_process_variation" in ROOT_CAUSE_TAXONOMY

    # Verify sensor registry
    assert len(SENSOR_UNIT_REGISTRY) >= 20
    assert "soldering_temp_top_c" in SENSOR_UNIT_REGISTRY
    assert SENSOR_UNIT_REGISTRY["soldering_temp_top_c"].unit == "C"
    assert "squeegee_pressure_n_cm2" in SENSOR_UNIT_REGISTRY
    assert SENSOR_UNIT_REGISTRY["squeegee_pressure_n_cm2"].unit == "N/cm2"


def test_validator_detects_bounds_and_units():
    validator = TelemetryValidator(reject_out_of_bounds=True)
    inspections, readings, _ = generate_pipeline_test_fixtures(n_batches=1, wafers_per_batch=2)

    sample = readings[0]
    valid, err = validator.validate_reading(sample)
    assert valid is True
    assert err is None

    # Test corrupted unit
    corrupt_unit = sample.model_copy(update={"unit": "psi"})
    valid_unit, err_unit = validator.validate_reading(corrupt_unit)
    assert valid_unit is False
    assert "Unit mismatch" in err_unit

    # Test impossible physical value
    corrupt_val = sample.model_copy(update={"measurement_value": -500.0})
    valid_val, err_val = validator.validate_reading(corrupt_val)
    assert valid_val is False
    assert "outside valid physical range" in err_val


def test_time_window_extractor_canonical_features():
    extractor = TimeWindowFeatureExtractor()
    inspections, readings, _ = generate_pipeline_test_fixtures(n_batches=1, wafers_per_batch=2)

    features = extractor.extract_features_for_inspection(
        inspection_time=inspections[0]["created_at"],
        readings=readings,
        events=[],
        defect_metadata=inspections[0],
    )

    assert len(features) == len(CANONICAL_FEATURE_ORDER)
    for feat in CANONICAL_FEATURE_ORDER:
        assert feat in features

    arr = extractor.vector_to_ordered_array(features)
    assert arr.shape == (len(CANONICAL_FEATURE_ORDER),)
    assert not np.isnan(arr).any()


def test_leakage_free_splitter_batch_disjointness():
    inspections, readings, ground_truths = generate_pipeline_test_fixtures(n_batches=4, wafers_per_batch=10)
    pipeline = RootCauseDatasetPipeline()
    res = pipeline.run_pipeline(use_test_fixtures_for_verification=True)

    splits = res["dataset_files"]
    train_vecs = json.loads(Path(splits["train"]).read_text())
    val_vecs = json.loads(Path(splits["val"]).read_text())
    test_vecs = json.loads(Path(splits["test"]).read_text())

    train_batches = set(r["batch_id"] for r in train_vecs if r["batch_id"])
    val_batches = set(r["batch_id"] for r in val_vecs if r["batch_id"])
    test_batches = set(r["batch_id"] for r in test_vecs if r["batch_id"])

    # Verify zero batch leakage between train, val, test
    assert len(train_batches.intersection(val_batches)) == 0
    assert len(train_batches.intersection(test_batches)) == 0
    assert len(val_batches.intersection(test_batches)) == 0


def test_production_database_reports_dataset_blocked():
    """Confirms that the real database currently reports DATASET_BLOCKED without hallucinating data."""
    pipeline = RootCauseDatasetPipeline()
    res = pipeline.run_pipeline(use_test_fixtures_for_verification=False)

    assert res["status"] == "DATASET_BLOCKED"
    assert res["labeled_count"] == 0
    assert len(res["audit_result"].blocking_reasons) > 0


def test_random_forest_training_and_serialization(tmp_path):
    trainer = RootCauseModelTrainer(output_dir=tmp_path)
    res = trainer.run_dry_run_verification()

    assert res["training_verification"] == "SUCCESS"
    assert Path(res["artifact_path"]).exists()

    # Load and test artifact
    metadata, model_dict = Model2ArtifactContract.load_artifact(res["artifact_path"])
    assert metadata.model_name == "SolarVision_RootCause_RF"
    assert metadata.num_classes == 9
    assert metadata.feature_count == len(CANONICAL_FEATURE_ORDER)
    assert len(metadata.feature_importances) == len(CANONICAL_FEATURE_ORDER)

    # Test reconstruction
    rf = RandomForestClassifier.from_dict(model_dict)
    assert len(rf.trees) == 30

    dummy_input = np.zeros((2, len(CANONICAL_FEATURE_ORDER)), dtype=np.float32)
    preds = rf.predict(dummy_input)
    assert len(preds) == 2
    proba = rf.predict_proba(dummy_input)
    assert proba.shape == (2, 9)
    # Probabilities sum to 1
    assert np.allclose(np.sum(proba, axis=1), [1.0, 1.0])


def test_evaluation_metrics_and_calibration():
    y_true = np.array([0, 1, 2, 3, 4, 0, 1, 2, 3, 4])
    y_pred = np.array([0, 1, 2, 3, 0, 0, 1, 2, 3, 4])

    calc = RootCauseMetricsCalculator(ROOT_CAUSE_TAXONOMY)
    metrics = calc.calculate(y_true, y_pred)
    assert metrics.accuracy == 0.90
    assert metrics.weighted_f1 > 0.85

    cm_calc = ConfusionMatrixCalculator(ROOT_CAUSE_TAXONOMY)
    cm = cm_calc.calculate(y_true, y_pred)
    assert len(cm["raw_matrix"]) == 9
    assert len(cm["top_confusion_pairs"]) >= 1

    calib_calc = CalibrationEvaluator(n_bins=5)
    dummy_proba = np.zeros((10, 9), dtype=np.float32)
    for i, p in enumerate(y_pred):
        dummy_proba[i, p] = 0.9
        dummy_proba[i, (p + 1) % 9] = 0.1

    calib = calib_calc.evaluate_calibration(y_true, dummy_proba)
    assert "expected_calibration_error_ece" in calib
    assert calib["expected_calibration_error_ece"] >= 0.0


def test_explainability_diagnostic_attribution():
    importances = {feat: 0.02 for feat in CANONICAL_FEATURE_ORDER}
    importances["squeegee_pressure_mean_w15"] = 0.25

    explainer = RootCauseExplainer(importances)
    sample_feats = [0.0] * len(CANONICAL_FEATURE_ORDER)
    # Excursion on squeegee pressure
    idx = CANONICAL_FEATURE_ORDER.index("squeegee_pressure_mean_w15")
    sample_feats[idx] = 32.0  # Above nominal 18.0

    exp = explainer.explain_prediction(
        predicted_cause="squeegee_pressure_drift",
        feature_vector=sample_feats,
        confidence=0.88,
    )

    assert exp["predicted_cause"] == "squeegee_pressure_drift"
    assert len(exp["top_contributing_factors"]) == 5
    assert exp["top_contributing_factors"][0]["feature"] == "squeegee_pressure_mean_w15"
    assert "squeegee" in exp["recommended_action"].lower()
