"""
SolarVision AI — Final 24-Hour Coding Sprint
Agent 3: ML Validation & Model Integrity Test Suite
Verifies all 4 models, contracts, checksums, test-set metrics, and serving parity.
"""

from __future__ import annotations

import hashlib
import json
from pathlib import Path
import numpy as np
import pytest
import torch

# Model 1 imports
from backend.app.inference import DEFAULT_CLASS_NAMES, YoloInferenceService

# Model 2 imports
from backend.app.root_cause.model_loader import Model2Loader
from backend.app.root_cause.schemas import DefectInput, RootCauseAnalysisInput, RootCauseStatus
from backend.app.root_cause.service import RootCauseService
from backend.root_cause_data.feature_spec import CANONICAL_FEATURES_V2

# Model 3 imports
from backend.app.predictive_quality.model_loader import Model3Loader
from backend.app.predictive_quality.schemas import ModelDomain
from backend.training.predictive_quality.contract import Model3ArtifactContract

# Model 4 imports
from backend.app.predictive_maintenance.model_loader import Model4Loader
from backend.app.predictive_maintenance.schemas import Model4Domain
from backend.evaluation.predictive_maintenance.metrics import MaintenanceMetricsCalculator
from backend.predictive_maintenance_data.loader import AI4IDataLoader
from backend.predictive_maintenance_data.preprocessor import PredictiveMaintenancePreprocessor
from backend.predictive_maintenance_data.splitter import MaintenanceDataSplitter
from backend.training.predictive_maintenance.contract import Model4ArtifactContract
from backend.training.predictive_maintenance.gradient_boosting import GradientBoostedMaintenanceClassifier


class TestFinalFourModelsMLIntegrity:
    """Rigorous end-to-end verification of all four SolarVision AI ML models."""

    # =========================================================================
    # TASK 1: MODEL 1 (YOLO Defect Detection)
    # =========================================================================
    def test_model1_checkpoint_integrity_and_class_mapping(self):
        ckpt_path = Path("backend/models/best.pt")
        assert ckpt_path.exists(), "Model 1 checkpoint 'backend/models/best.pt' must exist."

        raw_bytes = ckpt_path.read_bytes()
        assert len(raw_bytes) == 5394117, f"Expected size 5,394,117 bytes, got {len(raw_bytes)}"
        sha256 = hashlib.sha256(raw_bytes).hexdigest()
        assert sha256 == "59650dafe43c178e89af3d439b283ebf1c3e4abe6239aaa111c62afa41b7a7c6"

        # Verify serving loader initialization
        service = YoloInferenceService()
        assert not service.is_ready()
        service.load()
        assert service.is_ready()

        info = service.model_info()
        assert info["checkpoint_sha256"] == sha256
        assert info["parameter_count"] == 2507310
        assert info["training_epochs"] == 50
        assert info["confidence_threshold"] == 0.25
        assert info["iou_threshold"] == 0.7
        assert info["image_size"] == 640

        # Exact 9-class taxonomy
        expected_classes = [
            "crack",
            "finger",
            "black_core",
            "thick_line",
            "star_crack",
            "horizontal_dislocation",
            "vertical_dislocation",
            "printing_error",
            "short_circuit",
        ]
        assert service.class_names() == expected_classes
        assert [DEFAULT_CLASS_NAMES[i] for i in range(9)] == expected_classes

        # Forward pass on blank image
        dummy_img = np.zeros((640, 640, 3), dtype=np.uint8)
        detections, annotated, elapsed_ms = service.predict(dummy_img, confidence=0.25)
        assert isinstance(detections, list)
        assert isinstance(annotated, np.ndarray)
        assert elapsed_ms > 0.0

    # =========================================================================
    # TASK 2: MODEL 2 (Manufacturing Root Cause Analysis)
    # =========================================================================
    def test_model2_feature_contract_and_dataset_blocked_status(self):
        # 1. 48-dimensional contract specification
        spec_path = Path("backend/root_cause_data/artifacts/canonical_feature_specification_v2.json")
        assert spec_path.exists(), "Canonical feature spec v2 must exist."
        with open(spec_path, "r", encoding="utf-8") as f:
            spec = json.load(f)
        assert spec["schema_version"] == "2.0.0"
        assert spec["feature_count"] == 48
        assert len(spec["features"]) == 48
        assert len(CANONICAL_FEATURES_V2) == 48

        # 2. Loader enforces DATASET_BLOCKED / not_trained in production
        loader = Model2Loader()
        assert loader.is_ready is False, "Model 2 loader must not be ready for production inference."
        assert "validation_prototype" in loader.unavailability_reason
        assert "blocked" in loader.unavailability_reason.lower()

        # 3. Serving service truthful response
        service = RootCauseService()
        req = RootCauseAnalysisInput(
            inspection_id="audit-test-insp-01",
            defects=[DefectInput(defectType="crack", confidence=0.85, x1=10, y1=10, x2=50, y2=50)],
        )
        resp = service.analyze(req)
        assert resp.status in (RootCauseStatus.NOT_TRAINED, RootCauseStatus.MISSING_PROCESS_DATA)
        assert len(resp.probable_causes) == 0

    # =========================================================================
    # TASK 3: MODEL 3 (Predictive Quality — UCI SECOM Benchmark)
    # =========================================================================
    def test_model3_uci_secom_artifact_integrity_and_metrics(self):
        artifact_path = Path("backend/training/predictive_quality/artifacts/model3_predictive_quality.json")
        assert artifact_path.exists(), "Model 3 artifact must exist."

        meta, payload, prep_dict = Model3ArtifactContract.load_and_verify(artifact_path)
        assert meta.sha256_hash == "392d26cd80b37bd3600e49124099b9ba17cbff05be404ca8d0e35bebda196beb"
        assert meta.dataset_name == "UCI SECOM (Semi-Conductor Manufacturing Process)"
        assert meta.dataset_doi == "10.24432/C57G69"
        assert meta.input_feature_count == 590
        assert meta.retained_feature_count == 444
        assert meta.output_feature_count == 744
        assert meta.split_strategy == "time_aware_chronological"
        assert meta.optimal_threshold == 0.07
        assert meta.training_samples == 1096
        assert meta.val_samples == 235
        assert meta.test_samples == 236

        # Exact held-out test metrics
        tm = meta.test_metrics
        assert tm["total_samples"] == 236
        assert tm["true_positives"] == 4
        assert tm["false_positives"] == 31
        assert tm["true_negatives"] == 196
        assert tm["false_negatives"] == 5
        assert np.isclose(tm["accuracy"], 0.8475, atol=1e-3)
        assert np.isclose(tm["balanced_accuracy"], 0.6539, atol=1e-3)
        assert np.isclose(tm["precision_fail"], 0.1143, atol=1e-3)
        assert np.isclose(tm["recall_fail"], 0.4444, atol=1e-3)
        assert np.isclose(tm["f1_fail"], 0.1818, atol=1e-3)
        assert np.isclose(tm["roc_auc"], 0.6366, atol=1e-3)
        assert np.isclose(tm["pr_auc"], 0.0782, atol=1e-3)

        # Serving loader domain segregation
        bench_loader = Model3Loader(domain=ModelDomain.SEMICONDUCTOR_BENCHMARK)
        assert bench_loader.is_ready is True
        assert bench_loader.optimal_threshold == 0.07
        assert bench_loader.expected_dim == 590

        solar_loader = Model3Loader(domain=ModelDomain.SOLAR_CELL_MANUFACTURING)
        assert solar_loader.is_ready is False
        assert "blocked" in solar_loader.unavailability_reason.lower()

    # =========================================================================
    # TASK 4: MODEL 4 (Predictive Maintenance — UCI AI4I 2020 Benchmark)
    # =========================================================================
    def test_model4_ai4i_artifact_integrity_and_reproduced_test_metrics(self):
        artifact_path = Path("backend/training/predictive_maintenance/artifacts/model4_predictive_maintenance.json")
        assert artifact_path.exists(), "Model 4 artifact must exist."

        raw_bytes = artifact_path.read_bytes()
        file_sha256 = hashlib.sha256(raw_bytes).hexdigest()
        assert file_sha256 == "ccd95565498e3cdc49cf79d6489877bb7df1e3ed23a6f973f359e750b56cd7e2"

        # Verify raw AI4I dataset
        loader = AI4IDataLoader()
        assert loader.verify_file_exists()
        X_raw, y_raw, modes, _ = loader.load_raw()
        meta_prov = loader.get_provenance_metadata()
        assert meta_prov.sha256_hash == "dc6630cd9b1f0f853922fad78a1b6436570d3f1ec863f1dd5c4340ac56bc8a8e"
        assert meta_prov.doi == "10.24432/C5HS5C"
        assert meta_prov.total_instances == 10000
        assert meta_prov.failure_instances == 339

        # Six canonical features in frozen order
        expected_features = [
            "type",
            "air_temperature_k",
            "process_temperature_k",
            "rotational_speed_rpm",
            "torque_nm",
            "tool_wear_min",
        ]
        meta, payload, prep_dict = Model4ArtifactContract.load_and_verify(artifact_path)
        assert meta.feature_names == expected_features
        assert meta.input_feature_count == 6
        assert meta.optimal_threshold == 0.1981
        assert meta.domain == "ai4i_synthetic_benchmark"

        # Reproduce held-out test evaluation
        splits = MaintenanceDataSplitter.stratified_split(
            X_raw, y_raw, modes=modes, train_ratio=0.70, val_ratio=0.15, random_state=42
        )
        assert len(splits.X_test) == 1502

        prep = PredictiveMaintenancePreprocessor.from_dict(prep_dict)
        X_test = prep.transform(splits.X_test)
        y_test = splits.y_test

        model = GradientBoostedMaintenanceClassifier.from_dict(payload)
        test_probs = model.predict_proba(X_test)

        m = MaintenanceMetricsCalculator.compute(y_test, test_probs, threshold=meta.optimal_threshold)
        assert m.true_positives == 25, f"Expected TP=25, got {m.true_positives}"
        assert m.false_positives == 23, f"Expected FP=23, got {m.false_positives}"
        assert m.true_negatives == 1427, f"Expected TN=1427, got {m.true_negatives}"
        assert m.false_negatives == 27, f"Expected FN=27, got {m.false_negatives}"
        assert np.isclose(m.precision_failure, 0.5208, atol=1e-3)
        assert np.isclose(m.recall_failure, 0.4808, atol=1e-3)
        assert np.isclose(m.f1_failure, 0.5000, atol=1e-3)
        assert np.isclose(m.roc_auc, 0.9307, atol=1e-3)
        assert np.isclose(m.pr_auc, 0.4796, atol=1e-3)

    # =========================================================================
    # TASK 5: MODEL 4 SERVING PARITY AND DOMAIN QUARANTINE
    # =========================================================================
    def test_model4_serving_parity_and_domain_quarantine(self):
        bench_loader = Model4Loader(domain=Model4Domain.AI4I_SYNTHETIC_BENCHMARK)
        assert bench_loader.is_ready is True
        assert bench_loader.expected_dim == 6
        assert bench_loader.optimal_threshold == 0.1981

        solar_loader = Model4Loader(domain=Model4Domain.SOLAR_FACTORY)
        assert solar_loader.is_ready is False
        assert "blocked" in solar_loader.unavailability_reason.lower()

        # Solar factory prediction must raise RuntimeError
        test_vec = np.array([0.0, 298.1, 308.6, 1551.0, 42.8, 0.0], dtype=np.float32)
        with pytest.raises(RuntimeError) as exc_info:
            solar_loader.predict(test_vec, domain=Model4Domain.SOLAR_FACTORY)
        assert "strictly not_trained" in str(exc_info.value).lower()
