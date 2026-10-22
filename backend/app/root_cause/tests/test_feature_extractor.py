import numpy as np
import pytest

from backend.app.root_cause.feature_extractor import FeatureExtractor
from backend.root_cause_data.schema import CANONICAL_FEATURE_ORDER, ROOT_CAUSE_TAXONOMY
from backend.root_cause_data.feature_spec import (
    CANONICAL_FEATURES_V2,
    CANONICAL_FEATURE_NAMES_V2,
    CANONICAL_FEATURE_COUNT_V2,
    FEATURE_SCHEMA_VERSION,
)
from backend.app.root_cause.schemas import (
    BatchInput,
    DefectInput,
    MachineInput,
    ProductionEventInput,
    RootCauseAnalysisInput,
    SensorMeasurementInput,
)


def test_feature_extractor_returns_correct_shape():
    extractor = FeatureExtractor()
    assert len(extractor.feature_names) == 88
    assert len(extractor.canonical_feature_names) == 40
    assert extractor.canonical_feature_names[0] == "feat_defect_count"
    assert extractor.canonical_feature_names[-1] == "has_warning_recent_1h"

    payload = RootCauseAnalysisInput(
        inspection_id="test-insp-001",
        batch_id="batch-A1",
        machine_id="machine-STR-01",
        detections=[
            DefectInput(defect_type="soldering_defect", confidence=0.92, x1=10, y1=10, x2=50, y2=50),
            DefectInput(defect_type="crack", confidence=0.88, x1=500, y1=500, x2=550, y2=550),
        ],
        batch=BatchInput(
            batch_id="batch-A1",
            wafer_type="monocrystalline",
            target_quantity=1000,
            actual_quantity=950,
        ),
        machine=MachineInput(
            machine_id="machine-STR-01",
            machine_type="stringer",
            status="operational",
            last_maintenance_at="2026-10-01T00:00:00Z",
        ),
        sensor_measurements=[
            SensorMeasurementInput(
                sensor_type="soldering_temp",
                measurement_value=245.0,
                unit="°C",
                is_anomaly=True,
                anomaly_score=0.82,
            ),
            SensorMeasurementInput(
                sensor_type="lamination_temp",
                measurement_value=145.0,
                unit="°C",
                is_anomaly=False,
            ),
        ],
        production_events=[
            ProductionEventInput(
                event_type="thermal_drift",
                severity="high",
                message="Soldering tip temperature fluctuated by +25°C",
            )
        ],
    )

    result = extractor.extract(payload)
    assert isinstance(result.feature_vector, np.ndarray)
    assert result.feature_vector.shape == (88,)
    assert result.canonical_vector.shape == (40,)
    assert result.canonical_v2_vector.shape == (48,)
    assert not np.isnan(result.feature_vector).any()
    assert not np.isinf(result.feature_vector).any()
    assert not np.isnan(result.canonical_v2_vector).any()
    assert not np.isinf(result.canonical_v2_vector).any()
    assert result.has_sufficient_process_data is True

    # Check serving features
    assert result.feature_dict["defect_count_soldering_defect"] == 1.0
    assert result.feature_dict["defect_count_crack"] == 1.0
    assert result.feature_dict["defect_total_count"] == 2.0
    assert result.feature_dict["events_total_count"] == 1.0
    assert result.feature_dict["events_high_count"] == 1.0


def test_feature_extractor_detects_insufficient_process_data():
    extractor = FeatureExtractor()
    payload = RootCauseAnalysisInput(
        inspection_id="test-only-defects",
        detections=[
            DefectInput(defect_type="crack", confidence=0.75, x1=0.1, y1=0.1, x2=0.2, y2=0.2),
        ],
        # No machine, no batch, no sensors, no events
    )

    result = extractor.extract(payload)
    assert result.has_sufficient_process_data is False
    assert "machine" in result.missing_fields
    assert "batch" in result.missing_fields
    assert "production_events" in result.missing_fields


def test_sensor_bounds_and_nominal_normalization():
    extractor = FeatureExtractor()
    payload = RootCauseAnalysisInput(
        inspection_id="test-sensor-norm",
        sensor_measurements=[
            # Extreme value exceeding physical bounds (should be clamped safely)
            SensorMeasurementInput(
                sensor_type="lamination_temp",
                measurement_value=9999.0,
                unit="°C",
            ),
        ],
    )
    result = extractor.extract(payload)
    # laminator_temp is bounded to 220°C max; value should be clamped
    # SENSOR_BOUNDS["laminator_temp"] is (20.0, 220.0), nominal is (145.0, 15.0)
    # Normalized: (220.0 - 145.0) / 15.0 = 5.0
    val = result.feature_dict["sensor_laminator_temp_max_norm"]
    assert val == pytest.approx(5.0, rel=1e-2)
    assert not np.isnan(val)


def test_canonical_v2_48_feature_extraction_contract():
    extractor = FeatureExtractor()
    assert extractor.schema_version == "2.0.0"
    assert extractor.canonical_feature_count_v2 == 48
    assert len(extractor.canonical_features_v2) == 48
    assert extractor.canonical_features_v2[0] == "defect_count_crack"
    assert extractor.canonical_features_v2[47] == "events_operator_override_flag"

    payload = RootCauseAnalysisInput(
        inspection_id="insp-v2-test",
        detections=[
            DefectInput(defect_type="crack", confidence=0.90, x1=0.1, y1=0.1, x2=0.3, y2=0.3),
            DefectInput(defect_type="hotspot", confidence=0.85, x1=0.4, y1=0.4, x2=0.6, y2=0.6),
        ],
        batch=BatchInput(batch_id="batch-01", wafer_type="monocrystalline", target_quantity=100, actual_quantity=50),
        machine=MachineInput(machine_id="mach-01", machine_type="stringer", status="operational"),
        sensor_measurements=[
            SensorMeasurementInput(sensor_type="soldering_temp_top_c", measurement_value=240.0, unit="C"),
            SensorMeasurementInput(sensor_type="ribbon_tension_n", measurement_value=1.5, unit="N"),
        ],
        production_events=[
            ProductionEventInput(event_type="thermal_drift", severity="high", message="Temperature spike"),
        ],
    )

    vec48 = extractor.extract_canonical_v2(payload)
    assert isinstance(vec48, np.ndarray)
    assert vec48.shape == (48,)
    assert not np.isnan(vec48).any()
    assert not np.isinf(vec48).any()

    # Verify specific feature positions:
    # 0: defect_count_crack == 1.0
    assert vec48[0] == 1.0
    # 5: defect_count_hotspot == 1.0
    assert vec48[5] == 1.0
    # 9: defect_total_count == 2.0
    assert vec48[9] == 2.0
    # 15: machine_is_stringer == 1.0
    assert vec48[15] == 1.0
    # 27: batch_is_monocrystalline == 1.0
    assert vec48[27] == 1.0
    # 31: batch_progress_ratio == 0.5
    assert vec48[31] == 0.5
    # 32: sensor_soldering_temp_top_norm: (240 - 225)/15 = 1.0
    assert vec48[32] == pytest.approx(1.0, rel=1e-2)
    # 34: sensor_ribbon_tension_norm: (1.5 - 1.2)/0.3 = 1.0
    assert vec48[34] == pytest.approx(1.0, rel=1e-2)
    # 44: events_high_count == 1.0
    assert vec48[44] == 1.0
    # 45: events_thermal_flag == 1.0
    assert vec48[45] == 1.0


def test_validate_feature_vector_dimension_strictness():
    # Exactly 48 features must pass
    valid_48 = np.zeros(48, dtype=np.float32)
    FeatureExtractor.validate_feature_vector(valid_48, 48)

    # 40 features must be rejected if 48 expected
    invalid_40 = np.zeros(40, dtype=np.float32)
    with pytest.raises(ValueError, match="Feature vector dimension mismatch"):
        FeatureExtractor.validate_feature_vector(invalid_40, 48)

    # 88 features must be rejected if 48 expected
    invalid_88 = np.zeros(88, dtype=np.float32)
    with pytest.raises(ValueError, match="Feature vector dimension mismatch"):
        FeatureExtractor.validate_feature_vector(invalid_88, 48)
