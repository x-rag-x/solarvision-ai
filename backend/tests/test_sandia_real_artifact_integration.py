"""
SolarVision AI — Model 3: Sandia Solar Electrical Performance Prediction
Real-Artifact Integration Test Suite: Genuine Scikit-Learn Pipeline, Dynamic Schema Contract & Zero-Fabrication Parity
"""

from __future__ import annotations

import json
from pathlib import Path
import pytest
from starlette.testclient import TestClient

from backend.app.config import settings
from backend.app.main import app
from backend.app.sandia_performance.model_loader import SandiaModelLoader
from backend.app.sandia_performance.schemas import SandiaModelStatus
from backend.app.sandia_performance.service import sandia_performance_service

client = TestClient(app)

EXPECTED_TRAINER_PREDICTION = 99.50759793687902
EXPECTED_SHA256 = "045f9a15b7981c3e88ac18011dfa1b16821874bf211fa582cf148840e5dbf373"
EXPECTED_FEATURE_NAMES = [
    "Total_Exposure",
    "Nameplate_Pmp_(W)",
    "Nameplate_Isc_(A)",
    "Nameplate_Voc_(V)",
    "Nameplate_Imp_(A)",
    "Nameplate_Vmp_(V)",
    "Make",
    "Model",
    "Cell_Wafer_Type",
]


class TestSandiaRealArtifactIntegration:
    """Verifies end-to-end integration with genuine trained scikit-learn pipeline and trainer contracts."""

    @pytest.fixture(autouse=True)
    def ensure_real_pipeline_loaded(self):
        """Ensures the real artifact pipeline is loaded for these integration tests."""
        sandia_performance_service.loader.artifact_path = settings.sandia_model_path
        sandia_performance_service.loader.schema_path = settings.sandia_schema_path
        sandia_performance_service.loader.sample_input_path = settings.sandia_sample_input_path
        sandia_performance_service.loader.target_path = settings.sandia_target_path
        sandia_performance_service.loader.clear_mock()
        yield

    def test_pipeline_artifact_and_manifest_integrity(self):
        """Verifies pipeline.joblib existence, size, and SHA-256 integrity manifest agreement."""
        artifact_path = settings.sandia_model_path
        assert artifact_path.exists(), f"Real pipeline artifact {artifact_path} must exist on disk."

        manifest_path = artifact_path.parent / "manifest.json"
        assert manifest_path.exists(), f"Integrity manifest {manifest_path} must exist."

        manifest_data = json.loads(manifest_path.read_text(encoding="utf-8"))
        assert manifest_data["sha256"] == EXPECTED_SHA256
        assert manifest_data["size_bytes"] == 1246515

        import hashlib
        computed_sha = hashlib.sha256(artifact_path.read_bytes()).hexdigest()
        assert computed_sha == EXPECTED_SHA256, "SHA-256 checksum of pipeline.joblib must match manifest."

    def test_status_endpoint_reports_ready_with_real_artifact(self):
        """Verifies GET /sandia-performance/status reports honest READY state and no path leakage."""
        resp = client.get("/sandia-performance/status")
        assert resp.status_code == 200
        data = resp.json()

        assert data["is_ready"] is True
        assert data["is_mock"] is False
        assert data["status"] == "ready"
        assert data["trainer_handoff_pending"] is False
        assert data["model_name"] == "SolarVision-Sandia-Performance-Model3"
        assert data["model_version"] == "1.0.0"
        assert data["contract_version"] == "1.0.0"
        assert data["artifact_name"] == "pipeline.joblib"
        assert data["feature_schema_loaded"] is True
        assert data["target_definition_loaded"] is True
        assert data["sample_input_loaded"] is True
        assert data["expected_dim"] == 9
        assert "D:\\" not in str(data)

    def test_schema_and_target_definition_contracts(self):
        """Verifies dynamic schema and target definition endpoints conform strictly to contract."""
        # 1. Feature Schema
        resp_schema = client.get("/sandia-performance/schema")
        assert resp_schema.status_code == 200
        schema_data = resp_schema.json()
        assert schema_data["status"] == "loaded"
        assert schema_data["expectedFeatureCount"] == 9

        feature_names = [f["name"] for f in schema_data["features"]]
        assert feature_names == EXPECTED_FEATURE_NAMES

        # Verify Total_Exposure is not required (allows missing value imputation)
        total_exp = next(f for f in schema_data["features"] if f["name"] == "Total_Exposure")
        assert total_exp["required"] is False
        assert total_exp["type"] == "float"

        # 2. Target Definition
        resp_target = client.get("/sandia-performance/target-definition")
        assert resp_target.status_code == 200
        target_data = resp_target.json()
        assert target_data["status"] == "loaded"
        target_def = target_data["targetDefinition"]
        assert target_def["target_name"] == "power_retention_pct"
        assert target_def["target_type"] == "regression"
        assert target_def["target_unit"] == "%"
        assert target_def["metadata"]["error_unit"] == "percentage_points"
        assert target_def["metadata"]["prediction_unit"] == "%"

    def test_sample_input_endpoint_returns_trainer_conforming_sample(self):
        """Verifies GET /sandia-performance/sample-input returns sample matching trainer schema."""
        resp = client.get("/sandia-performance/sample-input")
        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] == "loaded"
        sample_input = data["sampleInput"]
        assert "features" in sample_input
        features = sample_input["features"]
        assert features["Total_Exposure"] is None
        assert features["Nameplate_Pmp_(W)"] == 270.0
        assert features["Nameplate_Isc_(A)"] == 9.18
        assert features["Make"] == "35"
        assert features["Model"] == "1"
        assert features["Cell_Wafer_Type"] == "mono-Si module"

    def test_real_pipeline_single_prediction_matches_trainer_benchmark(self):
        """
        Validates genuine scikit-learn pipeline inference against the trainer's reference prediction:
        approximately 99.50759793687902.
        """
        sample_file = settings.sandia_sample_input_path
        payload = json.loads(sample_file.read_text(encoding="utf-8"))

        resp = client.post("/sandia-performance/predict", json=payload)
        assert resp.status_code == 200
        data = resp.json()

        assert data["status"] == "ready"
        assert data["is_mock"] is False
        assert data["model_version"] == "1.0.0"
        assert data["prediction"] is not None

        item = data["prediction"]
        assert item["is_mock"] is False
        assert item["target_name"] == "power_retention_pct"
        assert item["target_unit"] == "%"
        assert item["confidence"] is None  # Zero fabrication: no fake confidences
        assert item["uncertainty"] is None  # Zero fabrication: no fake uncertainties
        assert item["features_used"] == EXPECTED_FEATURE_NAMES

        # Verify numerical accuracy against trainer benchmark prediction
        assert item["prediction"] == pytest.approx(EXPECTED_TRAINER_PREDICTION, abs=1e-4)

    def test_missing_total_exposure_imputation_preserves_pipeline_preprocessing(self):
        """Verifies that missing Total_Exposure is imputed by the trained pipeline without arbitrary constants."""
        payload = {
            "module_id": "MOD-TEST-MISSING-EXP",
            "features": {
                "Total_Exposure": None,
                "Nameplate_Pmp_(W)": 270.0,
                "Nameplate_Isc_(A)": 9.18,
                "Nameplate_Voc_(V)": 38.4,
                "Nameplate_Imp_(A)": 8.7,
                "Nameplate_Vmp_(V)": 31.0,
                "Make": "35",
                "Model": "1",
                "Cell_Wafer_Type": "mono-Si module",
            },
        }

        resp = client.post("/sandia-performance/predict", json=payload)
        assert resp.status_code == 200
        data = resp.json()
        assert data["prediction"]["prediction"] == pytest.approx(EXPECTED_TRAINER_PREDICTION, abs=1e-4)

    def test_real_pipeline_batch_prediction(self):
        """Verifies batch inference across multiple genuine observation inputs."""
        batch_payload = {
            "items": [
                {
                    "module_id": "PV-MOD-A",
                    "features": {
                        "Total_Exposure": None,
                        "Nameplate_Pmp_(W)": 270.0,
                        "Nameplate_Isc_(A)": 9.18,
                        "Nameplate_Voc_(V)": 38.4,
                        "Nameplate_Imp_(A)": 8.7,
                        "Nameplate_Vmp_(V)": 31.0,
                        "Make": "35",
                        "Model": "1",
                        "Cell_Wafer_Type": "mono-Si module",
                    },
                },
                {
                    "module_id": "PV-MOD-B",
                    "features": {
                        "Total_Exposure": 500.0,
                        "Nameplate_Pmp_(W)": 285.0,
                        "Nameplate_Isc_(A)": 9.45,
                        "Nameplate_Voc_(V)": 39.1,
                        "Nameplate_Imp_(A)": 8.9,
                        "Nameplate_Vmp_(V)": 32.0,
                        "Make": "35",
                        "Model": "1",
                        "Cell_Wafer_Type": "mono-Si module",
                    },
                },
            ]
        }

        resp = client.post("/sandia-performance/predict-batch", json=batch_payload)
        assert resp.status_code == 200
        data = resp.json()

        assert data["status"] == "ready"
        assert data["is_mock"] is False
        assert data["total_items"] == 2
        assert len(data["predictions"]) == 2
        assert all(p["is_mock"] is False for p in data["predictions"])
        assert data["predictions"][0]["prediction"] == pytest.approx(EXPECTED_TRAINER_PREDICTION, abs=1e-4)

    def test_strict_schema_validation_rejects_missing_required_features(self):
        """Verifies that omitting a required feature (e.g. Nameplate_Pmp_(W)) fails with HTTP 422."""
        invalid_payload = {
            "features": {
                "Total_Exposure": 100.0,
                # Nameplate_Pmp_(W) is missing
                "Nameplate_Isc_(A)": 9.18,
                "Nameplate_Voc_(V)": 38.4,
                "Nameplate_Imp_(A)": 8.7,
                "Nameplate_Vmp_(V)": 31.0,
                "Make": "35",
                "Model": "1",
                "Cell_Wafer_Type": "mono-Si module",
            }
        }
        resp = client.post("/sandia-performance/predict", json=invalid_payload)
        assert resp.status_code == 422
        assert "Missing required feature" in resp.json()["detail"]

    def test_strict_schema_validation_rejects_unexpected_features(self):
        """Verifies that submitting unregistered features fails with HTTP 422."""
        invalid_payload = {
            "features": {
                "Total_Exposure": None,
                "Nameplate_Pmp_(W)": 270.0,
                "Nameplate_Isc_(A)": 9.18,
                "Nameplate_Voc_(V)": 38.4,
                "Nameplate_Imp_(A)": 8.7,
                "Nameplate_Vmp_(V)": 31.0,
                "Make": "35",
                "Model": "1",
                "Cell_Wafer_Type": "mono-Si module",
                "unregistered_bogus_sensor": 999.0,
            }
        }
        resp = client.post("/sandia-performance/predict", json=invalid_payload)
        assert resp.status_code == 422
        assert "Unexpected feature" in resp.json()["detail"]
