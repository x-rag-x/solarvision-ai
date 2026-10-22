"""
SolarVision AI — Model 3: Predictive Quality Monitoring
Unit Test Suite for Python Backend Components
"""

import json
from pathlib import Path
import numpy as np
import pytest

from backend.app.predictive_quality.schemas import (
    ElectricalParametersInput,
    ModelDomain,
    PredictiveQualityInput,
    PredictiveQualityStatus,
    QualityOutcome,
    RiskLevel,
    SensorReadingInput,
)
from backend.app.predictive_quality.feature_extractor import (
    CANONICAL_SOLAR_FEATURE_COUNT,
    CANONICAL_SOLAR_FEATURES,
    PredictiveQualityFeatureExtractor,
)
from backend.app.predictive_quality.model_loader import Model3Loader
from backend.app.predictive_quality.service import PredictiveQualityService


class TestFeatureExtractor:
    def test_canonical_feature_definitions(self):
        extractor = PredictiveQualityFeatureExtractor()
        assert len(CANONICAL_SOLAR_FEATURES) == CANONICAL_SOLAR_FEATURE_COUNT
        assert CANONICAL_SOLAR_FEATURE_COUNT == 32
        assert CANONICAL_SOLAR_FEATURES[0].name == "voc_v"
        assert CANONICAL_SOLAR_FEATURES[5].name == "cell_efficiency_pct"

    def test_extract_from_electrical_and_sensors(self):
        extractor = PredictiveQualityFeatureExtractor()
        req = PredictiveQualityInput(
            electrical_parameters=ElectricalParametersInput(
                voc_v=0.690,
                isc_a=11.2,
                cell_efficiency_pct=24.1,
            ),
            sensor_measurements=[
                SensorReadingInput(sensor_type="soldering_temp_top_c", measurement_value=235.0),
                SensorReadingInput(sensor_type="squeegee_pressure_n_cm2", measurement_value=19.5),
            ],
        )

        assert extractor.has_sufficient_features(req) is True
        vec, names, raw_map = extractor.extract(req)

        assert len(vec) == 32
        assert vec[0] == pytest.approx(0.690)  # voc_v
        assert vec[1] == pytest.approx(11.2)   # isc_a
        assert vec[5] == pytest.approx(24.1)   # efficiency
        assert vec[6] == pytest.approx(235.0)  # soldering_temp_top_c
        assert vec[9] == pytest.approx(19.5)   # squeegee_pressure_n_cm2

        # Unspecified features should have nominal values
        assert vec[7] == pytest.approx(220.0)  # soldering_temp_bottom_c nominal

    def test_benchmark_feature_extraction(self):
        extractor = PredictiveQualityFeatureExtractor(domain=ModelDomain.SEMICONDUCTOR_BENCHMARK)
        benchmark_vec = [float(i) for i in range(40)]
        req = PredictiveQualityInput(
            domain=ModelDomain.SEMICONDUCTOR_BENCHMARK,
            feature_vector=benchmark_vec,
        )

        assert extractor.has_sufficient_features(req) is True
        vec, names, raw_map = extractor.extract(req)
        assert len(vec) == 40
        assert names[0] == "secom_signal_000"


class TestModel3Loader:
    def test_missing_artifact_truthfully_unready(self, tmp_path: Path):
        non_existent = tmp_path / "missing_model.json"
        loader = Model3Loader(artifact_path=non_existent)
        assert loader.is_ready is False
        assert "not found" in loader.unavailability_reason.lower()

    def test_prototype_quarantine_in_production(self, tmp_path: Path):
        proto_file = tmp_path / "proto_model.json"
        proto_data = {
            "metadata": {
                "model_id": "proto-quality",
                "model_name": "Prototype Model",
                "model_version": "0.1.0-alpha",
                "framework": "scikit-learn",
                "domain": "solar_cell_manufacturing",
                "schema_version": "1.0.0",
                "expected_dim": 32,
                "feature_names": [f.name for f in CANONICAL_SOLAR_FEATURES],
                "target_classes": ["pass", "warning", "fail"],
                "evaluation_status": "validation_prototype",
            },
            "model_payload": {},
        }
        proto_file.write_text(json.dumps(proto_data), encoding="utf-8")

        # In production mode (allow_prototype=False), it must be unready
        loader = Model3Loader(artifact_path=proto_file, allow_prototype=False)
        assert loader.is_ready is False
        assert "validation_prototype" in loader.unavailability_reason

        # In test mode (allow_prototype=True), it loads
        loader_test = Model3Loader(artifact_path=proto_file, allow_prototype=True)
        assert loader_test.is_ready is True

    def test_dimension_mismatch_rejection(self, tmp_path: Path):
        corrupt_file = tmp_path / "corrupt_dim.json"
        corrupt_data = {
            "metadata": {
                "schema_version": "1.0.0",
                "domain": "solar_cell_manufacturing",
                "expected_dim": 32,
                "feature_names": ["only_one_feature"],
                "evaluation_status": "production_ready",
            },
        }
        corrupt_file.write_text(json.dumps(corrupt_data), encoding="utf-8")
        loader = Model3Loader(artifact_path=corrupt_file)
        assert loader.is_ready is False
        assert "mismatch" in loader.unavailability_reason.lower()


class TestPredictiveQualityService:
    def test_returns_missing_features_when_empty(self):
        svc = PredictiveQualityService()
        req = PredictiveQualityInput()  # Empty input
        res = svc.forecast(req)

        assert res.status == PredictiveQualityStatus.MISSING_FEATURES
        assert res.quality_outcome == QualityOutcome.UNKNOWN
        assert res.risk_level == RiskLevel.UNKNOWN
        assert res.probabilities == {}
        assert res.predicted_yield is None
        assert "Missing manufacturing process telemetry" in res.limitations[0]

    def test_returns_not_trained_when_artifact_absent(self):
        svc = PredictiveQualityService()
        req = PredictiveQualityInput(
            electrical_parameters=ElectricalParametersInput(voc_v=0.68),
        )
        res = svc.forecast(req)

        assert res.status == PredictiveQualityStatus.NOT_TRAINED
        assert res.quality_outcome == QualityOutcome.UNKNOWN
        assert res.probabilities == {}
        assert res.predicted_yield is None
        assert any("not ready" in lim.lower() for lim in res.limitations)

    def test_test_predictor_hook_execution(self):
        svc = PredictiveQualityService()

        # Mock predictor for integration test harness
        def mock_predictor(x: np.ndarray):
            probs = {"pass": 0.85, "warning": 0.10, "fail": 0.05}
            return "pass", "low", probs, 0.85

        svc.loader.register_test_predictor(mock_predictor, version="3.0.0-test")

        req = PredictiveQualityInput(
            batch_id="BATCH-TEST-001",
            electrical_parameters=ElectricalParametersInput(voc_v=0.685, cell_efficiency_pct=23.5),
        )
        res = svc.forecast(req)

        assert res.status == PredictiveQualityStatus.READY
        assert res.quality_outcome == QualityOutcome.PASS
        assert res.risk_level == RiskLevel.LOW
        assert res.probabilities["pass"] == 0.85
        assert res.confidence == 0.85
        assert res.predicted_yield is not None
        assert res.predicted_yield > 80.0
        assert res.confidence_interval is not None
        assert res.model_version == "3.0.0-test"

    def test_benchmark_domain_differentiation(self):
        svc = PredictiveQualityService()

        # 1. Real benchmark inference with 590 SECOM features
        req_590 = PredictiveQualityInput(
            domain=ModelDomain.SEMICONDUCTOR_BENCHMARK,
            feature_vector=[0.0] * 590,
        )
        res_590 = svc.forecast(req_590)

        assert res_590.domain == ModelDomain.SEMICONDUCTOR_BENCHMARK
        assert res_590.status == PredictiveQualityStatus.READY
        assert "pass" in res_590.probabilities
        assert "fail" in res_590.probabilities
        assert pytest.approx(res_590.probabilities["pass"] + res_590.probabilities["fail"]) == 1.0
        assert res_590.is_calibrated is True
        assert any("benchmark" in lim.lower() for lim in res_590.limitations)
        assert any("not a solar-cell factory validation" in lim.lower() for lim in res_590.limitations)

        # 2. Reject feature count mismatch on benchmark domain
        req_mismatch = PredictiveQualityInput(
            domain=ModelDomain.SEMICONDUCTOR_BENCHMARK,
            feature_vector=[1.0] * 40,
        )
        res_mismatch = svc.forecast(req_mismatch)
        assert res_mismatch.status == PredictiveQualityStatus.ERROR
        assert any("dimensionality mismatch" in lim.lower() for lim in res_mismatch.limitations)

        # 3. Solar domain remains truthfully not_trained
        req_solar = PredictiveQualityInput(
            domain=ModelDomain.SOLAR_CELL_MANUFACTURING,
            feature_vector=[0.5] * 32,
        )
        res_solar = svc.forecast(req_solar)
        assert res_solar.domain == ModelDomain.SOLAR_CELL_MANUFACTURING
        assert res_solar.status == PredictiveQualityStatus.NOT_TRAINED
