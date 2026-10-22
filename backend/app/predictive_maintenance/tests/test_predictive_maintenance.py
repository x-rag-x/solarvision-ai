"""
SolarVision AI — Model 4: Predictive Maintenance
Unit Test Suite for Python Backend Components
"""

import json
from pathlib import Path
import numpy as np
import pytest

from backend.app.predictive_maintenance.feature_extractor import (
    CANONICAL_FEATURE_SPECS,
    CANONICAL_MAINTENANCE_FEATURE_COUNT,
    CANONICAL_MAINTENANCE_FEATURE_NAMES,
    PredictiveMaintenanceFeatureExtractor,
)
from backend.app.predictive_maintenance.model_loader import Model4Loader
from backend.app.predictive_maintenance.schemas import (
    FailureMode,
    MachineHealthState,
    Model4Domain,
    Model4Status,
    PredictiveMaintenanceInput,
    PredictiveMaintenanceResponse,
)
from backend.app.predictive_maintenance.service import (
    PredictiveMaintenanceService,
    predictive_maintenance_service,
)


class TestFeatureExtractor:
    def test_canonical_feature_definitions(self):
        assert len(CANONICAL_FEATURE_SPECS) == CANONICAL_MAINTENANCE_FEATURE_COUNT
        assert CANONICAL_MAINTENANCE_FEATURE_COUNT == 6
        assert CANONICAL_MAINTENANCE_FEATURE_NAMES == [
            "product_type",
            "air_temperature_k",
            "process_temperature_k",
            "rotational_speed_rpm",
            "torque_nm",
            "tool_wear_min",
        ]

    def test_feature_sufficiency_check(self):
        extractor = PredictiveMaintenanceFeatureExtractor()

        # Incomplete request (missing features)
        req_incomplete = PredictiveMaintenanceInput(
            air_temperature_k=300.0,
            process_temperature_k=310.0,
        )
        assert extractor.has_sufficient_features(req_incomplete) is False

        # Complete request with all 6 features
        req_complete = PredictiveMaintenanceInput(
            product_type="M",
            air_temperature_k=300.0,
            process_temperature_k=310.0,
            rotational_speed_rpm=1500.0,
            torque_nm=40.0,
            tool_wear_min=50.0,
        )
        assert extractor.has_sufficient_features(req_complete) is True

    def test_extract_from_fields(self):
        extractor = PredictiveMaintenanceFeatureExtractor()
        req = PredictiveMaintenanceInput(
            product_type="L",
            air_temperature_k=298.2,
            process_temperature_k=308.6,
            rotational_speed_rpm=1551.0,
            torque_nm=42.8,
            tool_wear_min=0.0,
        )
        vec, names, raw_map = extractor.extract(req)
        assert len(vec) == 6
        assert vec[0] == 0.0  # L is encoded as 0.0
        assert vec[1] == pytest.approx(298.2)
        assert vec[2] == pytest.approx(308.6)
        assert vec[3] == pytest.approx(1551.0)
        assert vec[4] == pytest.approx(42.8)
        assert vec[5] == pytest.approx(0.0)

    def test_extract_product_types(self):
        extractor = PredictiveMaintenanceFeatureExtractor()
        for p_str, expected_code in [("L", 0.0), ("M", 1.0), ("H", 2.0)]:
            req = PredictiveMaintenanceInput(
                product_type=p_str,
                air_temperature_k=300.0,
                process_temperature_k=310.0,
                rotational_speed_rpm=1500.0,
                torque_nm=40.0,
                tool_wear_min=10.0,
            )
            vec, _, _ = extractor.extract(req)
            assert vec[0] == expected_code

    def test_engineered_features_computation(self):
        extractor = PredictiveMaintenanceFeatureExtractor()
        # Test ΔT, Power, Strain calculation
        raw = np.array([0.0, 300.0, 309.0, 1500.0, 40.0, 100.0], dtype=np.float64)
        eng_vec = extractor.compute_engineered_features(raw)
        eng_dict = extractor.compute_engineered_dict(raw)

        # ΔT = 309.0 - 300.0 = 9.0
        assert eng_dict["temp_diff_k"] == pytest.approx(9.0)
        assert eng_vec[8] == pytest.approx(9.0)

        # Power = 40.0 * (2 * pi * 1500 / 60) = 40 * 157.0796 = ~6283.185 W
        expected_power = 40.0 * (2.0 * np.pi * 1500.0 / 60.0)
        assert eng_dict["mechanical_power_w"] == pytest.approx(expected_power, rel=1e-3)
        assert eng_vec[9] == pytest.approx(expected_power, rel=1e-3)

        # Strain = 100.0 * 40.0 = 4000.0
        assert eng_dict["tool_wear_strain"] == pytest.approx(4000.0)
        assert eng_vec[10] == pytest.approx(4000.0)

        # One-hot
        assert eng_dict["product_type_L"] == 1.0
        assert eng_dict["product_type_M"] == 0.0
        assert eng_dict["product_type_H"] == 0.0
        assert eng_vec[1] == 1.0  # type_L


class TestModel4Loader:
    def test_missing_artifact_unready(self, tmp_path: Path):
        non_existent = tmp_path / "missing_model.json"
        loader = Model4Loader(artifact_path=non_existent)
        assert loader.is_ready is False
        assert "not found" in loader.unavailability_reason.lower()

    def test_solar_factory_domain_strictly_unready(self):
        loader = Model4Loader(domain=Model4Domain.SOLAR_FACTORY)
        assert loader.is_ready is False
        assert "quarantined" in loader.unavailability_reason.lower() or "pending" in loader.unavailability_reason.lower()

        # Prediction must raise RuntimeError
        vec = np.array([0.0, 300.0, 310.0, 1500.0, 40.0, 0.0])
        with pytest.raises(RuntimeError) as exc_info:
            loader.predict(vec, domain=Model4Domain.SOLAR_FACTORY)
        assert "strictly not_trained" in str(exc_info.value).lower()

    def test_sha256_integrity_check(self, tmp_path: Path):
        corrupt_file = tmp_path / "corrupt_model.json"
        content = {
            "metadata": {
                "model_id": "test-pm",
                "model_name": "Test PM Model",
                "version": "1.0.0",
                "framework": "scikit-learn",
                "domain": "ai4i_synthetic_benchmark",
                "sha256": "0000000000000000000000000000000000000000000000000000000000000000",
                "schema_version": "1.0.0",
                "expected_dim": 6,
                "source_dataset": "UCI AI4I 2020",
                "evaluation_status": "production_candidate",
            },
            "model_payload": {"type": "logistic_regression", "intercept": 0.0, "coefficients": [0.0] * 6},
        }
        corrupt_file.write_text(json.dumps(content), encoding="utf-8")

        loader = Model4Loader(artifact_path=corrupt_file)
        assert loader.is_ready is False
        assert "sha-256 integrity verification failed" in loader.unavailability_reason.lower()

    def test_test_predictor_hook(self):
        loader = Model4Loader(domain=Model4Domain.AI4I_SYNTHETIC_BENCHMARK)

        def mock_predictor(x: np.ndarray):
            return (
                MachineHealthState.FAILURE,
                FailureMode.TOOL_WEAR_FAILURE,
                0.92,
                0.08,
                {FailureMode.TOOL_WEAR_FAILURE.value: 0.92, FailureMode.NONE.value: 0.08},
            )

        loader.register_test_predictor(mock_predictor)
        assert loader.is_ready is True

        vec = np.array([0.0, 300.0, 310.0, 1500.0, 40.0, 210.0])
        health, mode, p_fail, p_healthy, mode_probs, risk_factors = loader.predict(
            vec, domain=Model4Domain.AI4I_SYNTHETIC_BENCHMARK
        )
        assert health == MachineHealthState.FAILURE
        assert mode == FailureMode.TOOL_WEAR_FAILURE
        assert p_fail == 0.92
        assert p_healthy == 0.08


class TestPredictiveMaintenanceService:
    def test_solar_factory_zero_fabrication(self):
        service = PredictiveMaintenanceService()
        req = PredictiveMaintenanceInput(
            domain=Model4Domain.SOLAR_FACTORY,
            machine_id="CELL-LINE-A-STATION-01",
            product_type="M",
            air_temperature_k=300.0,
            process_temperature_k=310.0,
            rotational_speed_rpm=1500.0,
            torque_nm=40.0,
            tool_wear_min=20.0,
        )

        res = service.forecast(req)
        assert res.status == Model4Status.NOT_TRAINED
        assert res.domain == Model4Domain.SOLAR_FACTORY
        assert res.health_state == MachineHealthState.UNKNOWN
        assert res.failure_probability is None
        assert res.healthy_probability is None
        assert res.confidence is None
        assert "not yet trained" in res.recommended_action.lower()
        assert any("zero synthetic" in lim.lower() for lim in res.limitations)

    def test_missing_features_response(self):
        service = PredictiveMaintenanceService()
        req = PredictiveMaintenanceInput(
            domain=Model4Domain.AI4I_SYNTHETIC_BENCHMARK,
            air_temperature_k=300.0,
        )
        res = service.forecast(req)
        assert res.status == Model4Status.MISSING_FEATURES
        assert res.health_state == MachineHealthState.UNKNOWN
        assert "insufficient telemetry" in res.recommended_action.lower()

    def test_benchmark_inference_with_mock_predictor(self):
        service = PredictiveMaintenanceService()

        # Register mock predictor on benchmark loader
        def mock_pred(x: np.ndarray):
            # If tool_wear (index 5) >= 200, trigger failure
            if x[5] >= 200.0:
                return (
                    MachineHealthState.FAILURE,
                    FailureMode.TOOL_WEAR_FAILURE,
                    0.95,
                    0.05,
                    {FailureMode.TOOL_WEAR_FAILURE.value: 0.95, FailureMode.NONE.value: 0.05},
                )
            return (
                MachineHealthState.HEALTHY,
                FailureMode.NONE,
                0.02,
                0.98,
                {FailureMode.NONE.value: 0.98, FailureMode.TOOL_WEAR_FAILURE.value: 0.02},
            )

        service.benchmark_loader.register_test_predictor(mock_pred)

        # 1. Healthy machine test
        res_healthy = service.benchmark_predict(
            product_type="L",
            air_temperature_k=298.0,
            process_temperature_k=308.0,
            rotational_speed_rpm=1500.0,
            torque_nm=40.0,
            tool_wear_min=30.0,
            machine_id="MILL-001",
        )
        assert res_healthy.status == Model4Status.READY
        assert res_healthy.health_state == MachineHealthState.HEALTHY
        assert res_healthy.failure_mode == FailureMode.NONE
        assert res_healthy.failure_probability == 0.02
        assert "normal" in res_healthy.recommended_action.lower()

        # 2. Failing machine test (excess tool wear)
        res_fail = service.benchmark_predict(
            product_type="L",
            air_temperature_k=298.0,
            process_temperature_k=308.0,
            rotational_speed_rpm=1500.0,
            torque_nm=40.0,
            tool_wear_min=220.0,
            machine_id="MILL-002",
        )
        assert res_fail.status == Model4Status.READY
        assert res_fail.health_state == MachineHealthState.FAILURE
        assert res_fail.failure_mode == FailureMode.TOOL_WEAR_FAILURE
        assert res_fail.failure_probability == 0.95
        assert "tool wear" in res_fail.recommended_action.lower()
        # Verify serialization
        shared = res_fail.to_shared_dict()
        assert shared["healthState"] == "failure"
        assert shared["failureMode"] == "tool_wear_failure"
        assert shared["domain"] == "ai4i_synthetic_benchmark"


class TestCliAndApi:
    def test_cli_status_flag(self, capsys):
        import sys
        from backend.app.predictive_maintenance.cli import main

        sys.argv = ["cli.py", "--status-only"]
        with pytest.raises(SystemExit) as exc:
            main()
        assert exc.value.code == 0
        captured = capsys.readouterr()
        data = json.loads(captured.out)
        assert data["schemaVersion"] == "1.0.0"
        assert "isReady" in data
        assert data["expectedDim"] == 6

    def test_cli_features_flag(self, capsys):
        import sys
        from backend.app.predictive_maintenance.cli import main

        sys.argv = ["cli.py", "--features-only"]
        with pytest.raises(SystemExit) as exc:
            main()
        assert exc.value.code == 0
        captured = capsys.readouterr()
        data = json.loads(captured.out)
        assert data["canonicalFeatureCount"] == 6
        assert len(data["features"]) == 6

    def test_cli_metadata_flag(self, capsys):
        import sys
        from backend.app.predictive_maintenance.cli import main

        sys.argv = ["cli.py", "--metadata-only"]
        with pytest.raises(SystemExit) as exc:
            main()
        assert exc.value.code == 0
        captured = capsys.readouterr()
        data = json.loads(captured.out)
        assert "Mathes" in data["citation"]
        assert len(data["failureModes"]) == 5

    def test_cli_readiness_flag(self, capsys):
        import sys
        from backend.app.predictive_maintenance.cli import main

        sys.argv = ["cli.py", "--readiness-only"]
        with pytest.raises(SystemExit) as exc:
            main()
        assert exc.value.code == 0
        captured = capsys.readouterr()
        data = json.loads(captured.out)
        assert data["solarFactory"]["status"] == "not_trained"
        assert data["solarFactory"]["zeroFabricationPledge"] is True


class TestRealArtifactInference:
    def test_real_artifact_loads_and_verifies(self):
        loader = Model4Loader(domain=Model4Domain.AI4I_SYNTHETIC_BENCHMARK)
        assert loader.is_ready is True
        assert loader.manifest is not None
        assert loader.manifest.domain == Model4Domain.AI4I_SYNTHETIC_BENCHMARK
        assert loader.manifest.schema_version == "1.0.0"
        assert loader.manifest.expected_dim == 6
        assert loader.is_calibrated is True
        assert loader.calibration_method == "platt"
        assert loader.optimal_threshold == pytest.approx(0.1981, abs=1e-3)

    def test_real_inference_three_ai4i_records(self):
        loader = Model4Loader(domain=Model4Domain.AI4I_SYNTHETIC_BENCHMARK)

        # Record 1: AI4I Index 0 - Normal Healthy Operation (y=0)
        # Type: M (1.0), Air: 298.1, Proc: 308.6, RPM: 1551, Torque: 42.8, Wear: 0
        r1 = np.array([1.0, 298.1, 308.6, 1551.0, 42.8, 0.0], dtype=np.float32)
        h1, m1, pf1, ph1, mp1, rf1 = loader.predict(r1)
        assert h1 == MachineHealthState.HEALTHY
        assert m1 == FailureMode.NONE
        assert pf1 == pytest.approx(0.0018, abs=1e-3)
        assert ph1 == pytest.approx(0.9982, abs=1e-3)
        assert mp1 == {}  # Zero fake per-mode probabilities

        # Record 2: AI4I Index 160 - Heavy Tool Wear & High Torque Failure (y=1, OSF)
        # Type: L (0.0), Air: 298.4, Proc: 308.2, RPM: 1282, Torque: 60.7, Wear: 216
        r160 = np.array([0.0, 298.4, 308.2, 1282.0, 60.7, 216.0], dtype=np.float32)
        h160, m160, pf160, ph160, mp160, rf160 = loader.predict(r160)
        assert h160 == MachineHealthState.FAILURE
        assert m160 == FailureMode.TOOL_WEAR_FAILURE
        assert pf160 == pytest.approx(0.9151, abs=1e-3)
        assert ph160 == pytest.approx(0.0849, abs=1e-3)
        assert mp160 == {}
        assert len(rf160) >= 2
        assert any(rf.factor_name == "tool_wear_min" for rf in rf160)

        # Record 3: AI4I Index 69 - Power Excursion Warning/Near-fail (y=1, PWF)
        # Type: L (0.0), Air: 298.9, Proc: 309.0, RPM: 1410, Torque: 65.7, Wear: 191
        r69 = np.array([0.0, 298.9, 309.0, 1410.0, 65.7, 191.0], dtype=np.float32)
        h69, m69, pf69, ph69, mp69, rf69 = loader.predict(r69)
        assert h69 == MachineHealthState.WARNING
        assert m69 == FailureMode.POWER_FAILURE
        assert pf69 == pytest.approx(0.1083, abs=1e-3)
        assert mp69 == {}
        assert len(rf69) >= 2


