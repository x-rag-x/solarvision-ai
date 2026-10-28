"""
SolarVision AI — Model 3: Sandia Solar Electrical Performance Prediction
Integration Test Suite: FastAPI Routing, Error Sanitization, Mock Isolation, Batch Limits & SECOM Preservation
"""

from __future__ import annotations

import numpy as np
import pytest
from starlette.testclient import TestClient

from backend.app.main import app
from backend.app.sandia_performance.schemas import (
    FeatureSchemaManifest,
    FeatureSpec,
    SandiaModelStatus,
)
from backend.app.sandia_performance.service import sandia_performance_service

client = TestClient(app)


class TestSandiaBackendIntegration:

    def test_sandia_status_endpoint_returns_200_and_not_trained(self):
        """Verifies GET /sandia-performance/status reports honest readiness without leaking server paths."""
        sandia_performance_service.loader.clear_mock()

        resp = client.get("/sandia-performance/status")
        assert resp.status_code == 200
        data = resp.json()

        assert data["model_name"] == "SolarVision-Sandia-Performance-Model3"
        assert data["contract_version"] == "1.0.0"
        assert data["is_ready"] is False
        assert data["is_mock"] is False
        assert data["status"] == "not_trained"
        assert data["trainer_handoff_pending"] is True
        assert data["artifact_name"] == "pipeline.joblib"
        assert "Sandia solar performance model artifact" in data["unavailability_reason"]
        # Security: No local Windows drive or root directory leaked in public response
        assert "D:\\" not in str(data)

        # Check /api prefix alias
        resp_alias = client.get("/api/sandia-performance/status")
        assert resp_alias.status_code == 200
        assert resp_alias.json()["status"] == "not_trained"

    def test_sandia_predict_returns_503_when_artifact_missing(self):
        """Verifies POST /sandia-performance/predict returns 503 rather than fabricating fake output."""
        sandia_performance_service.loader.clear_mock()

        payload = {
            "module_id": "PV-MOD-TEST-001",
            "features": {
                "irradiance": 1000.0,
                "temperature": 25.0,
            },
        }

        resp = client.post("/sandia-performance/predict", json=payload)
        assert resp.status_code == 503
        detail = resp.json()["detail"]
        assert "Sandia solar performance model artifact" in detail
        assert "D:\\" not in detail

        # Check /api prefix alias
        resp_alias = client.post("/api/sandia-performance/predict", json=payload)
        assert resp_alias.status_code == 503

    def test_sandia_predict_batch_returns_503_when_artifact_missing(self):
        """Verifies POST /sandia-performance/predict-batch returns 503 when artifact is missing."""
        sandia_performance_service.loader.clear_mock()

        batch_payload = {
            "items": [
                {
                    "module_id": "PV-MOD-01",
                    "features": {"f1": 100.0},
                }
            ]
        }
        resp = client.post("/sandia-performance/predict-batch", json=batch_payload)
        assert resp.status_code == 503

    def test_mock_fixture_prediction_is_strictly_flagged_as_mock(self):
        """Verifies isolated mock predictions return 200 with explicit is_mock=True."""
        try:
            # Set temporary mock schema
            sandia_performance_service.loader._feature_schema = FeatureSchemaManifest(
                schema_version="1.0.0",
                features=[
                    FeatureSpec(name="irradiance", required=True),
                    FeatureSpec(name="cell_temp", required=True),
                ],
            )

            # Inject isolated test mock
            def mock_predictor(X: np.ndarray, feature_names: list[str]):
                return 88.5, "mock_power_retention", None, None

            sandia_performance_service.loader.set_mock_predictor(
                mock_predictor,
                model_version="mock-integration-v1",
            )

            # 1. Single prediction endpoint
            payload = {
                "module_id": "MOCK-TEST-MOD",
                "features": {"irradiance": 800.0, "cell_temp": 45.0},
            }
            resp = client.post("/sandia-performance/predict", json=payload)
            assert resp.status_code == 200
            data = resp.json()

            assert data["status"] == "ready"
            assert data["is_mock"] is True
            assert data["model_version"] == "mock-integration-v1"
            assert data["prediction"] is not None
            assert data["prediction"]["is_mock"] is True
            assert data["prediction"]["prediction"] == 88.5
            assert data["prediction"]["prediction_label"] == "mock_power_retention"
            assert data["prediction"]["confidence"] is None  # Zero fabrication
            assert data["prediction"]["uncertainty"] is None
            assert any("ISOLATED TEST MOCK" in lim for lim in data["limitations"])

            # 2. Batch prediction endpoint
            batch_payload = {
                "items": [
                    {"module_id": "M1", "features": {"irradiance": 800.0, "cell_temp": 25.0}},
                    {"module_id": "M2", "features": {"irradiance": 900.0, "cell_temp": 30.0}},
                ]
            }
            batch_resp = client.post("/sandia-performance/predict-batch", json=batch_payload)
            assert batch_resp.status_code == 200
            batch_data = batch_resp.json()
            assert batch_data["is_mock"] is True
            assert batch_data["total_items"] == 2
            assert all(p["is_mock"] is True for p in batch_data["predictions"])

        finally:
            sandia_performance_service.loader.clear_mock()
            assert not sandia_performance_service.loader.is_mock
            assert not sandia_performance_service.loader.is_ready

    def test_input_validation_rejects_empty_missing_or_unexpected_features(self):
        """Verifies input validation handles empty payloads and unexpected features with HTTP 422."""
        try:
            sandia_performance_service.loader._feature_schema = FeatureSchemaManifest(
                schema_version="1.0.0",
                features=[FeatureSpec(name="sensor_x", required=True)],
            )
            sandia_performance_service.loader.set_mock_predictor(lambda X, names: (1.0, None, None, None))

            # Empty payload
            resp_empty = client.post("/sandia-performance/predict", json={})
            assert resp_empty.status_code == 422

            # Missing required feature
            resp_missing = client.post(
                "/sandia-performance/predict",
                json={"features": {"other_sensor": 10.0}},
            )
            assert resp_missing.status_code == 422
            assert "Unexpected feature" in resp_missing.json()["detail"] or "Missing required feature" in resp_missing.json()["detail"]

            # Unexpected feature passed alongside required
            resp_unexpected = client.post(
                "/sandia-performance/predict",
                json={"features": {"sensor_x": 10.0, "rogue_feature": 5.0}},
            )
            assert resp_unexpected.status_code == 422
            assert "Unexpected feature" in resp_unexpected.json()["detail"]

            # Malformed non-numeric feature
            resp_malformed = client.post(
                "/sandia-performance/predict",
                json={"features": {"sensor_x": "not-a-number"}},
            )
            assert resp_malformed.status_code == 422

        finally:
            sandia_performance_service.loader.clear_mock()

    def test_batch_limit_rejection_over_100_items(self):
        """Verifies that submitting over MAX_BATCH_SIZE (100) items is rejected with HTTP 422."""
        oversized_batch = {
            "items": [
                {"module_id": f"MOD-{i}", "features": {"sensor_x": float(i)}}
                for i in range(101)
            ]
        }
        resp = client.post("/sandia-performance/predict-batch", json=oversized_batch)
        assert resp.status_code == 422

    def test_schema_sample_input_and_metadata_endpoints(self):
        """Verifies discovery endpoints return expected status codes without exposing internal paths."""
        # Schema endpoint
        resp_schema = client.get("/sandia-performance/schema")
        assert resp_schema.status_code == 200
        schema_data = resp_schema.json()
        assert "status" in schema_data
        assert "D:\\" not in str(schema_data)

        # Sample input endpoint
        resp_sample = client.get("/sandia-performance/sample-input")
        assert resp_sample.status_code == 200
        sample_data = resp_sample.json()
        assert "status" in sample_data
        assert "D:\\" not in str(sample_data)

        # Target definition endpoint
        resp_target = client.get("/sandia-performance/target-definition")
        assert resp_target.status_code == 200
        target_data = resp_target.json()
        assert "status" in target_data
        assert "D:\\" not in str(target_data)

        # Metadata endpoint
        resp_meta = client.get("/sandia-performance/metadata")
        assert resp_meta.status_code == 200
        meta_data = resp_meta.json()
        assert meta_data["modelId"] == "sandia-electrical-performance-v1"
        assert meta_data["framework"] == "scikit-learn (.joblib pipeline)"
        assert "Sandia National Laboratories" in meta_data["attribution"]
        assert "D:\\" not in str(meta_data)

    def test_secom_predictive_quality_preservation(self):
        """
        Regression Check: Verifies existing SECOM predictive quality endpoints
        continue to function identically and are not affected by the Sandia service addition.
        """
        # 1. SECOM Status endpoint
        pq_status_resp = client.get("/predictive-quality/status")
        assert pq_status_resp.status_code == 200
        pq_status = pq_status_resp.json()
        assert "benchmarkReady" in pq_status
        assert pq_status["benchmarkReady"] is True
        assert pq_status["expectedDim"] in (590, 32)

        # 2. SECOM Features endpoint
        pq_features_resp = client.get("/predictive-quality/features")
        assert pq_features_resp.status_code == 200
        pq_features = pq_features_resp.json()
        assert pq_features["canonicalFeatureCount"] == 32

        # 3. SECOM Benchmark Metadata endpoint
        pq_bench_meta_resp = client.get("/predictive-quality/benchmark-metadata")
        assert pq_bench_meta_resp.status_code == 200
        pq_bench_meta = pq_bench_meta_resp.json()
        assert pq_bench_meta["benchmarkName"] == "UCI SECOM Semiconductor Yield Benchmark"
        assert pq_bench_meta["inputFeatureCount"] == 590
