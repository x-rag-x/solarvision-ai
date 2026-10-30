"""
SolarVision AI — Model 3: Sandia Solar Electrical Performance Prediction
Unit Test Suite: Loader, Dynamic Schema, Mock Isolation, Scikit-Learn Pipeline & Batch Limits
"""

import json
from pathlib import Path
import tempfile
import numpy as np
import pytest
from sklearn.linear_model import LinearRegression, Ridge
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler
import joblib

from backend.app.sandia_performance.model_loader import SandiaModelLoader
from backend.app.sandia_performance.schemas import (
    MAX_BATCH_SIZE,
    FeatureSchemaManifest,
    FeatureSpec,
    SandiaBatchPredictionInput,
    SandiaModelStatus,
    SandiaPredictionInput,
    SandiaPredictionItem,
    TargetDefinitionManifest,
)
from backend.app.sandia_performance.service import SandiaPerformanceService


class TestSandiaModelLoaderAndService:

    def test_missing_artifact_reports_unready_and_not_trained(self):
        """Verifies clean failure, zero-fabrication, and path sanitization when artifact is missing."""
        with tempfile.TemporaryDirectory() as tmpdir:
            missing_joblib = Path(tmpdir) / "pipeline.joblib"
            loader = SandiaModelLoader(artifact_path=missing_joblib)

            assert not loader.is_ready
            assert not loader.is_mock
            assert "Sandia solar performance model artifact" in loader.unavailability_reason
            # Ensure raw absolute local path is not leaked in public unavailability reason
            assert "D:\\" not in loader.unavailability_reason
            assert loader.model_version == "none"

            service = SandiaPerformanceService(loader=loader)
            status = service.get_status()
            assert status.status == SandiaModelStatus.NOT_TRAINED
            assert not status.is_ready
            assert status.trainer_handoff_pending is True
            assert status.artifact_name == "pipeline.joblib"

            # Prediction attempt returns NOT_TRAINED with limitation notes
            inp = SandiaPredictionInput(features={"feature_1": 800.0, "feature_2": 35.0})
            resp = service.predict(inp)
            assert resp.status == SandiaModelStatus.NOT_TRAINED
            assert resp.prediction is None
            assert any("Zero synthetic predictions" in lim for lim in resp.limitations)

    def test_isolated_mock_predictor_explicitly_flagged(self):
        """Verifies isolated mock test doubles are strictly distinguished from real predictions (is_mock=True)."""
        with tempfile.TemporaryDirectory() as tmpdir:
            missing_joblib = Path(tmpdir) / "pipeline.joblib"
            loader = SandiaModelLoader(artifact_path=missing_joblib)
            assert not loader.is_ready

            def mock_predict_fn(X: np.ndarray, feature_names: list[str]):
                # Test mock returning power retention calculation
                mock_retention = float(np.mean(X) * 0.1)
                return mock_retention, "nominal_performance", None, None

            loader.set_mock_predictor(mock_predict_fn, model_version="test-mock-v1")
            assert loader.is_ready
            assert loader.is_mock
            assert loader.model_version == "test-mock-v1"

            # Provide mock schema so extraction succeeds
            schema = FeatureSchemaManifest(
                schema_version="1.0.0",
                features=[
                    FeatureSpec(name="sensor_a", required=True),
                    FeatureSpec(name="sensor_b", required=True),
                ],
            )
            loader._feature_schema = schema

            service = SandiaPerformanceService(loader=loader)
            status = service.get_status()
            assert status.is_ready is True
            assert status.is_mock is True
            assert status.model_version == "test-mock-v1"

            # Execute inference with mock
            inp = SandiaPredictionInput(
                module_id="MOCK-CELL-01",
                features={"sensor_a": 100.0, "sensor_b": 50.0},
            )
            resp = service.predict(inp)

            assert resp.status == SandiaModelStatus.READY
            assert resp.is_mock is True
            assert resp.prediction is not None
            assert resp.prediction.is_mock is True
            assert resp.prediction.module_id == "MOCK-CELL-01"
            assert resp.prediction.confidence is None  # Zero fabrication: no fake confidence
            assert any("ISOLATED TEST MOCK" in lim for lim in resp.limitations)

            # Clear mock returns to unloaded state
            loader.clear_mock()
            assert not loader.is_mock
            assert not loader.is_ready

    def test_real_scikit_learn_pipeline_loading_and_inference(self):
        """Verifies loading and executing a trusted scikit-learn .joblib pipeline (is_mock=False)."""
        with tempfile.TemporaryDirectory() as tmpdir:
            artifact_dir = Path(tmpdir)
            pipeline_path = artifact_dir / "pipeline.joblib"
            schema_path = artifact_dir / "feature_schema.json"
            target_path = artifact_dir / "target_definition.json"

            # Write trainer schema (features not hardcoded)
            schema_data = {
                "schema_version": "1.0.0",
                "dataset_name": "Sandia PV Performance",
                "features": [
                    {"name": "irradiance_poa", "type": "float", "required": True},
                    {"name": "module_temp", "type": "float", "required": True},
                ],
            }
            schema_path.write_text(json.dumps(schema_data), encoding="utf-8")

            # Write trainer dynamic target definition (e.g. power retention percentage)
            target_data = {
                "target_name": "power_retention_pct",
                "target_type": "regression",
                "target_unit": "%",
                "description": "Degradation-adjusted power retention relative to STC rating",
            }
            target_path.write_text(json.dumps(target_data), encoding="utf-8")

            # Fit scikit-learn pipeline
            X_calib = np.array([
                [800.0, 25.0],
                [900.0, 30.0],
                [1000.0, 25.0],
                [600.0, 45.0],
            ], dtype=np.float64)
            y_calib = np.array([92.5, 88.0, 95.0, 78.5], dtype=np.float64)

            pipeline = Pipeline([
                ("scaler", StandardScaler()),
                ("regressor", Ridge(alpha=1.0)),
            ])
            pipeline.fit(X_calib, y_calib)
            joblib.dump(pipeline, pipeline_path)

            import hashlib
            manifest_path = artifact_dir / "manifest.json"
            manifest_path.write_text(
                json.dumps({"version": "1.0.0", "sha256": hashlib.sha256(pipeline_path.read_bytes()).hexdigest()}),
                encoding="utf-8",
            )

            loader = SandiaModelLoader(
                artifact_path=pipeline_path,
                schema_path=schema_path,
                target_path=target_path,
            )
            assert loader.is_ready is True
            assert loader.is_mock is False
            assert loader.target_definition.target_name == "power_retention_pct"
            assert loader.target_definition.target_unit == "%"

            service = SandiaPerformanceService(loader=loader)
            inp = SandiaPredictionInput(
                module_id="REAL-PV-MOD-01",
                features={"irradiance_poa": 1000.0, "module_temp": 25.0},
            )
            resp = service.predict(inp)

            assert resp.status == SandiaModelStatus.READY
            assert resp.is_mock is False
            assert resp.prediction.is_mock is False
            assert resp.prediction.target_name == "power_retention_pct"
            assert resp.prediction.target_unit == "%"
            assert resp.prediction.confidence is None  # Zero fabrication
            assert resp.prediction.uncertainty is None
            assert 90.0 <= resp.prediction.prediction <= 100.0

    def test_dynamic_feature_schema_rejection_of_missing_and_unexpected_features(self):
        """Verifies schema validation strictly rejects unexpected features and missing required features."""
        with tempfile.TemporaryDirectory() as tmpdir:
            tmp_path = Path(tmpdir)
            schema_file = tmp_path / "feature_schema.json"

            schema_data = {
                "schema_version": "1.0.0",
                "features": [
                    {"name": "input_irradiance", "type": "float", "required": True, "min_value": 0.0, "max_value": 1500.0},
                    {"name": "input_temp", "type": "float", "required": True, "min_value": -40.0, "max_value": 100.0},
                    {"name": "optional_wind", "type": "float", "required": False},
                ],
            }
            schema_file.write_text(json.dumps(schema_data), encoding="utf-8")

            loader = SandiaModelLoader(schema_path=schema_file)
            loader.set_mock_predictor(lambda X, names: (100.0, None, None, None))
            service = SandiaPerformanceService(loader=loader)

            # 1. Valid input with all required features
            valid_inp = SandiaPredictionInput(
                features={"input_irradiance": 800.0, "input_temp": 25.0}
            )
            resp = service.predict(valid_inp)
            assert resp.status == SandiaModelStatus.READY

            # 2. Reject missing required feature
            missing_inp = SandiaPredictionInput(
                features={"input_irradiance": 800.0}
            )
            resp_missing = service.predict(missing_inp)
            assert resp_missing.status == SandiaModelStatus.VALIDATION_ERROR
            assert any("Missing required feature" in lim for lim in resp_missing.limitations)

            # 3. Reject unexpected features not in schema
            unexpected_inp = SandiaPredictionInput(
                features={
                    "input_irradiance": 800.0,
                    "input_temp": 25.0,
                    "unknown_rogue_sensor": 99.0,
                }
            )
            resp_unexpected = service.predict(unexpected_inp)
            assert resp_unexpected.status == SandiaModelStatus.VALIDATION_ERROR
            assert any("Unexpected feature(s)" in lim for lim in resp_unexpected.limitations)

            # 4. Range boundary produces non-fatal warning
            range_inp = SandiaPredictionInput(
                features={"input_irradiance": 2000.0, "input_temp": 25.0}
            )
            resp_warn = service.predict(range_inp)
            assert resp_warn.status == SandiaModelStatus.READY
            assert len(resp_warn.prediction.warnings) == 1
            assert "exceeds physical maximum" in resp_warn.prediction.warnings[0]

    def test_batch_prediction_evaluation_and_limits(self):
        """Verifies batch inference respects MAX_BATCH_SIZE (100) and handles multi-item evaluations."""
        with tempfile.TemporaryDirectory() as tmpdir:
            schema_file = Path(tmpdir) / "feature_schema.json"
            schema_data = {
                "schema_version": "1.0.0",
                "features": [{"name": "feat_a", "type": "float", "required": True}],
            }
            schema_file.write_text(json.dumps(schema_data), encoding="utf-8")

            loader = SandiaModelLoader(schema_path=schema_file)
            loader.set_mock_predictor(lambda X, names: (float(X[0, 0] * 2.0), None, None, None))
            service = SandiaPerformanceService(loader=loader)

            # Valid batch of 3 items
            batch = SandiaBatchPredictionInput(
                items=[
                    SandiaPredictionInput(module_id="M1", features={"feat_a": 10.0}),
                    SandiaPredictionInput(module_id="M2", features={"feat_a": 20.0}),
                    SandiaPredictionInput(module_id="M3", features={"feat_a": 30.0}),
                ]
            )
            resp = service.predict_batch(batch)
            assert resp.status == SandiaModelStatus.READY
            assert resp.total_items == 3
            assert resp.predictions[0].prediction == 20.0
            assert resp.predictions[2].prediction == 60.0

            # Exceeding MAX_BATCH_SIZE (101 items) fails Pydantic validation
            with pytest.raises(Exception):
                oversized_items = [
                    SandiaPredictionInput(features={"feat_a": float(i)})
                    for i in range(MAX_BATCH_SIZE + 1)
                ]
                SandiaBatchPredictionInput(items=oversized_items)

    def test_sha256_checksum_verification_and_tamper_rejection(self):
        """Verifies SHA-256 integrity validation and sanitized error message on mismatch."""
        with tempfile.TemporaryDirectory() as tmpdir:
            artifact_dir = Path(tmpdir)
            pipeline_path = artifact_dir / "pipeline.joblib"
            manifest_path = artifact_dir / "manifest.json"

            pipe = LinearRegression()
            pipe.fit([[1.0]], [2.0])
            joblib.dump(pipe, pipeline_path)

            import hashlib
            real_sha = hashlib.sha256(pipeline_path.read_bytes()).hexdigest()

            # Tampered manifest
            manifest_path.write_text(
                json.dumps({"version": "1.0.0", "sha256": "0000000000000000000000000000000000000000000000000000000000000000"}),
                encoding="utf-8",
            )
            loader_tampered = SandiaModelLoader(artifact_path=pipeline_path)
            assert not loader_tampered.is_ready
            assert "integrity verification failed" in loader_tampered.unavailability_reason
            assert "D:\\" not in loader_tampered.unavailability_reason

            # Valid manifest
            manifest_path.write_text(
                json.dumps({"version": "1.0.0", "sha256": real_sha}),
                encoding="utf-8",
            )
            loader_valid = SandiaModelLoader(artifact_path=pipeline_path)
            assert loader_valid.is_ready
            assert loader_valid.model_version == "1.0.0"
