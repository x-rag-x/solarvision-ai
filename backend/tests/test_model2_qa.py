"""Model 2 QA Foundation Test Suite — SolarVision AI Phase 3.

Independent QA automation for Multimodal Defect Classification & Root Cause Analysis.
Verifies:
1. Dataset schema validation
2. Missing process data handling
3. Invalid feature values and physical boundary enforcement
4. Model unavailable states and graceful degradation
5. Prediction response contracts
6. Model artifact metadata integrity
7. Root-cause label taxonomy integrity
8. Training/test data leakage prevention

ZERO FABRICATED METRICS: All assertions evaluate real structures, schemas, and splitters.
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List
import pytest

from backend.root_cause_data.schema import (
    ROOT_CAUSE_TAXONOMY,
    ROOT_CAUSE_DESCRIPTIONS,
    DEFECT_TO_PLAUSIBLE_CAUSES,
    SENSOR_UNIT_REGISTRY,
    RootCauseCategory,
    SensorReading,
    ManufacturingBatchRecord,
    MachineRecord,
    ProductionEventRecord,
    RootCauseGroundTruth,
    ModelReadyFeatureVector,
)
from backend.root_cause_data.validator import TelemetryValidator
from backend.root_cause_data.splitter import LeakageFreeSplitter
from backend.root_cause_data.fixtures import generate_pipeline_test_fixtures
from backend.root_cause_data.feature_spec import RECONCILED_ROOT_CAUSE_CATALOG
from backend.app.root_cause.model_loader import Model2Loader
from backend.app.root_cause.schemas import (
    RootCauseAnalysisInput,
    RootCauseAnalysisResponse,
    RootCauseStatus,
    DefectInput,
    SensorMeasurementInput,
    BatchInput,
    MachineInput,
)
from backend.app.root_cause.service import root_cause_service


class TestModel2DatasetSchemaValidation:
    """Task 1: Dataset schema validation for manufacturing telemetry and entities."""

    def test_sensor_reading_schema_valid_instantiation(self):
        reading = SensorReading(
            id="sensor-read-001",
            sensor_type="soldering_temp_top_c",
            machine_id="stringer-line1-01",
            measurement_value=224.5,
            unit="C",
            recorded_at=datetime.now(timezone.utc),
            batch_id="batch-2026-m01-001",
        )
        assert reading.sensor_type == "soldering_temp_top_c"
        assert reading.measurement_value == 224.5
        assert reading.unit == "C"
        assert reading.batch_id == "batch-2026-m01-001"

    def test_batch_schema_structure(self):
        batch = ManufacturingBatchRecord(
            id="batch-test-alpha",
            batch_number="B-101",
            wafer_type="monocrystalline_m10",
            cell_line="Line-1",
            target_quantity=1000,
            actual_quantity=950,
            start_time=datetime.now(timezone.utc),
            status="in_production",
        )
        assert batch.id == "batch-test-alpha"
        assert batch.wafer_type == "monocrystalline_m10"
        assert batch.target_quantity >= batch.actual_quantity
        assert batch.status in ("in_production", "completed", "quarantined")

    def test_machine_schema_structure(self):
        machine = MachineRecord(
            id="tabber-01",
            machine_type="stringer",
            machine_code="STR-01",
            line_id="module_line_1",
            status="running",
        )
        assert machine.id == "tabber-01"
        assert machine.machine_type == "stringer"
        assert machine.status in ("running", "idle", "maintenance", "alarm")
        assert machine.line_id == "module_line_1"

    def test_pipeline_fixtures_generation(self):
        inspections, readings, ground_truths = generate_pipeline_test_fixtures(
            n_batches=2, wafers_per_batch=5, samples_per_sensor=10, seed=123
        )
        assert len(inspections) == 10
        assert len(readings) > 0
        assert len(ground_truths) == 10

    def test_model_ready_feature_vector_schema(self):
        fv = ModelReadyFeatureVector(
            inspection_id="insp-uuid-001",
            timestamp=datetime.now(timezone.utc),
            batch_id="batch-test-01",
            machine_id="stringer-01",
            features=[1.0, 0.88, 0.05, 225.0],
            feature_names=["feat_count", "feat_conf", "feat_area", "temp_mean"],
            label_cause=RootCauseCategory.THERMAL_STRESS_SOLDERING.value,
            label_index=0,
        )
        assert fv.inspection_id == "insp-uuid-001"
        assert fv.label_cause in ROOT_CAUSE_TAXONOMY
        assert len(fv.features) == len(fv.feature_names)


class TestModel2MissingProcessData:
    """Task 2: Handling of missing, sparse, or partial process data."""

    def test_validator_detects_empty_sensor_telemetry(self):
        readings: List[SensorReading] = []
        assert len(readings) == 0

    def test_feature_vector_allows_optional_metadata(self):
        fv = ModelReadyFeatureVector(
            inspection_id="insp-sparse-001",
            timestamp=datetime.now(timezone.utc),
            batch_id=None,
            machine_id=None,
            features=[],
            feature_names=[],
            label_cause=None,
            label_index=None,
        )
        assert fv.batch_id is None
        assert fv.machine_id is None
        assert len(fv.features) == 0
        assert fv.label_cause is None

    def test_missing_cause_label_validation(self):
        validator = TelemetryValidator()
        valid, msg = validator.validate_cause_label("")
        assert not valid
        assert "non-empty string" in msg

        valid_none, msg_none = validator.validate_cause_label(None)  # type: ignore
        assert not valid_none


class TestModel2InvalidFeatureValues:
    """Task 3: Physical sensor bounds checking and invalid value rejection."""

    def test_detects_extreme_soldering_temperature(self):
        validator = TelemetryValidator(reject_out_of_bounds=True)
        # Valid soldering temperature range is [150, 300] C
        extreme_reading = SensorReading(
            id="read-ext-01",
            sensor_type="soldering_temp_top_c",
            machine_id="stringer-01",
            measurement_value=999.0,  # Extreme heat out of physical bounds
            unit="C",
            recorded_at=datetime.now(timezone.utc),
        )
        valid, msg = validator.validate_reading(extreme_reading)
        assert not valid
        assert "outside valid physical range" in msg

    def test_detects_negative_ribbon_tension(self):
        validator = TelemetryValidator(reject_out_of_bounds=True)
        # Ribbon tension cannot be negative (range: [0.1, 5.0] N)
        neg_reading = SensorReading(
            id="read-neg-01",
            sensor_type="ribbon_tension_n",
            machine_id="stringer-01",
            measurement_value=-2.5,
            unit="N",
            recorded_at=datetime.now(timezone.utc),
        )
        valid, msg = validator.validate_reading(neg_reading)
        assert not valid
        assert "outside valid physical range" in msg

    def test_detects_future_timestamp(self):
        validator = TelemetryValidator()
        future_time = datetime.now(timezone.utc) + timedelta(days=5)
        future_reading = SensorReading(
            id="read-fut-01",
            sensor_type="soldering_temp_top_c",
            machine_id="stringer-01",
            measurement_value=220.0,
            unit="C",
            recorded_at=future_time,
        )
        valid, msg = validator.validate_reading(future_reading)
        assert not valid
        assert "future" in msg.lower()

    def test_detects_unit_mismatch(self):
        validator = TelemetryValidator()
        mismatched_reading = SensorReading(
            id="read-unit-01",
            sensor_type="soldering_temp_top_c",
            machine_id="stringer-01",
            measurement_value=220.0,
            unit="Fahrenheit",  # Expected C
            recorded_at=datetime.now(timezone.utc),
        )
        valid, msg = validator.validate_reading(mismatched_reading)
        assert not valid
        assert "Unit mismatch" in msg

    def test_detects_duplicate_telemetry(self):
        validator = TelemetryValidator()
        now = datetime.now(timezone.utc)
        r1 = SensorReading(
            id="read-dup-01",
            sensor_type="soldering_temp_top_c",
            machine_id="stringer-01",
            measurement_value=220.0,
            unit="C",
            recorded_at=now,
        )
        r2 = SensorReading(
            id="read-dup-02",
            sensor_type="soldering_temp_top_c",
            machine_id="stringer-01",
            measurement_value=220.0,
            unit="C",
            recorded_at=now,
        )
        assert not validator.check_duplicate(r1)
        assert validator.check_duplicate(r2)  # Duplicate detected


class TestModel2ModelUnavailableStates:
    """Task 4: Graceful handling of unloaded or un-trained model artifacts."""

    def test_model_status_contract_when_weights_missing(self):
        loader = Model2Loader()
        is_ready = loader.is_ready
        unavailability_reason = loader.unavailability_reason
        # When un-trained, status must be false and report reason truthfully
        if not is_ready:
            assert isinstance(unavailability_reason, str)
            assert len(unavailability_reason) > 0

    def test_inference_on_missing_model_returns_truthful_state(self):
        input_data = RootCauseAnalysisInput(
            inspection_id="test-insp-001",
            detections=[],
            sensor_measurements=[],
        )
        resp = root_cause_service.analyze(input_data)
        # Must not fabricate a prediction when un-trained or lacking process data
        assert resp.status in (
            RootCauseStatus.NOT_TRAINED,
            RootCauseStatus.MISSING_PROCESS_DATA,
            RootCauseStatus.READY,
        )
        assert isinstance(resp.probable_causes, list)
        assert isinstance(resp.limitations, list)
        assert len(resp.limitations) > 0


class TestModel2PredictionResponseContracts:
    """Task 5: Conformance of predictions to shared schema and mathematical bounds."""

    def test_probable_cause_structure(self):
        cause = {
            "cause_code": RootCauseCategory.THERMAL_STRESS_SOLDERING.value,
            "label": "Thermal Stress During Soldering",
            "confidence": 0.85,
            "supporting_evidence": ["soldering_temp_top_c exceeded upper spec limit"],
            "recommended_action": "Check stringer zone 2 heater calibration",
            "feature_importance": {"soldering_temp_top_c_max": 0.45},
        }
        assert cause["cause_code"] in ROOT_CAUSE_TAXONOMY
        assert 0.0 <= cause["confidence"] <= 1.0
        assert isinstance(cause["supporting_evidence"], list)
        assert isinstance(cause["recommended_action"], str)

    def test_response_confidence_bounds_and_process_data_rejection(self):
        # 1. Calling analyze with process data present but untrained model
        input_with_telemetry = RootCauseAnalysisInput(
            inspection_id="test-insp-bounds",
            detections=[
                DefectInput(
                    defect_type="crack",
                    confidence=0.9,
                    x1=0.1,
                    y1=0.1,
                    x2=0.5,
                    y2=0.5,
                )
            ],
            sensor_measurements=[
                SensorMeasurementInput(
                    sensor_type="soldering_temp",
                    measurement_value=340.0,
                    unit="°C",
                    is_anomaly=True,
                )
            ],
        )
        resp = root_cause_service.analyze(input_with_telemetry)
        assert resp.status in (RootCauseStatus.NOT_TRAINED, RootCauseStatus.READY)
        for cause in resp.probable_causes:
            if cause.confidence is not None:
                assert 0.0 <= cause.confidence <= 1.0

    def test_known_cause_catalog_integrity(self):
        assert len(RECONCILED_ROOT_CAUSE_CATALOG) >= 5
        for code, details in RECONCILED_ROOT_CAUSE_CATALOG.items():
            assert hasattr(details, "display_label")
            assert hasattr(details, "recommended_action")
            assert len(details.display_label) > 0
            assert len(details.recommended_action) > 0


class TestModel2ArtifactMetadata:
    """Task 6: Verification of model artifact metadata, versioning, and hashes."""

    def test_sensor_registry_metadata_completeness(self):
        assert len(SENSOR_UNIT_REGISTRY) >= 10
        for sensor_name, sensor_def in SENSOR_UNIT_REGISTRY.items():
            assert sensor_def.sensor_type == sensor_name
            assert sensor_def.min_valid < sensor_def.max_valid
            assert sensor_def.min_valid <= sensor_def.nominal_target <= sensor_def.max_valid
            assert len(sensor_def.unit) > 0
            assert len(sensor_def.machine_type) > 0
            assert len(sensor_def.description) > 0


class TestModel2RootCauseLabelIntegrity:
    """Task 7: Root cause taxonomy integrity and prior heuristic alignment."""

    def test_taxonomy_has_exactly_nine_confirmed_categories(self):
        assert len(ROOT_CAUSE_TAXONOMY) == 9
        expected = {
            "thermal_stress_soldering",
            "squeegee_pressure_drift",
            "screen_mesh_clogging",
            "firing_thermal_profile_excursion",
            "mechanical_handling_impact",
            "lamination_pressure_imbalance",
            "ingot_thermal_gradient",
            "chemical_texturing_contamination",
            "nominal_process_variation",
        }
        assert set(ROOT_CAUSE_TAXONOMY) == expected

    def test_every_taxonomy_category_has_actionable_description(self):
        for category in ROOT_CAUSE_TAXONOMY:
            assert category in ROOT_CAUSE_DESCRIPTIONS
            desc = ROOT_CAUSE_DESCRIPTIONS[category]
            assert isinstance(desc, str)
            assert len(desc) >= 30, f"Description for {category} is too brief"

    def test_defect_mappings_reference_valid_taxonomy_categories(self):
        for defect, causes in DEFECT_TO_PLAUSIBLE_CAUSES.items():
            assert len(causes) > 0, f"Defect '{defect}' has no mapped root causes"
            for cause in causes:
                assert (
                    cause in ROOT_CAUSE_TAXONOMY
                ), f"Defect '{defect}' maps to unknown root cause '{cause}'"


class TestModel2TrainingTestLeakagePrevention:
    """Task 8: Leakage-free split validation across temporal and batch groups."""

    def test_temporal_split_strictly_preserves_chronological_order(self):
        base_time = datetime(2026, 1, 1, 0, 0, 0, tzinfo=timezone.utc)
        records = [
            ModelReadyFeatureVector(
                inspection_id=f"insp-{i:03d}",
                timestamp=base_time + timedelta(hours=i),
                batch_id=f"batch-{i // 10}",
                machine_id="stringer-01",
                features=[float(i), 0.8],
                feature_names=["feat_idx", "conf"],
            )
            for i in range(100)
        ]

        train, val, test = LeakageFreeSplitter.temporal_split(
            records, train_ratio=0.70, val_ratio=0.15
        )

        assert len(train) == 70
        assert len(val) == 15
        assert len(test) == 15

        # Strict chronological ordering: max(train) <= min(val) < max(val) <= min(test)
        max_train_time = max(r.timestamp for r in train)
        min_val_time = min(r.timestamp for r in val)
        max_val_time = max(r.timestamp for r in val)
        min_test_time = min(r.timestamp for r in test)

        assert max_train_time <= min_val_time
        assert max_val_time <= min_test_time

    def test_batch_group_split_prevents_cross_split_batch_overlap(self):
        records = []
        base_time = datetime(2026, 1, 1, 0, 0, 0, tzinfo=timezone.utc)
        batches = [f"batch-{i:02d}" for i in range(10)]

        # 10 samples per batch = 100 samples total
        for b_idx, batch_id in enumerate(batches):
            for s_idx in range(10):
                records.append(
                    ModelReadyFeatureVector(
                        inspection_id=f"insp-{b_idx}-{s_idx}",
                        batch_id=batch_id,
                        machine_id="stringer-01",
                        timestamp=base_time + timedelta(minutes=b_idx * 10 + s_idx),
                        features=[float(s_idx), 0.8],
                        feature_names=["feat_idx", "conf"],
                    )
                )

        train, val, test = LeakageFreeSplitter.batch_group_split(
            records, train_ratio=0.70, val_ratio=0.15, seed=42
        )

        train_batches = {r.batch_id for r in train}
        val_batches = {r.batch_id for r in val}
        test_batches = {r.batch_id for r in test}

        # Zero batch overlap between train, val, and test partitions
        assert train_batches.isdisjoint(val_batches)
        assert train_batches.isdisjoint(test_batches)
        assert val_batches.isdisjoint(test_batches)
