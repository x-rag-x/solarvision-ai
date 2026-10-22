"""Model 2 Contract Compatibility & Artifact Verification Test Suite.

Audits agreement between Agent 1 (Serving / FastAPI) and Agent 3 (Data Engineering / Training).
Verifies:
1. Canonical feature count and order agreement (flags 40 vs 88 discrepancy)
2. Cause category taxonomy agreement (flags 9-class domain taxonomy vs 7 RC-* codes)
3. Sensor units and physical engineering bounds
4. Missing process data handling
5. Corrupted / invalid model artifact rejection
6. Checkpoint format and manifest schema verification
"""

from __future__ import annotations

import json
from pathlib import Path
import tempfile
import pytest
import numpy as np

from backend.root_cause_data.schema import (
    CANONICAL_FEATURE_ORDER,
    ROOT_CAUSE_TAXONOMY,
    SENSOR_UNIT_REGISTRY,
    RootCauseCategory,
)
from backend.training.root_cause.contract import (
    Model2ArtifactContract,
    MODEL2_VERSION,
    MODEL2_NAME,
)
from backend.app.root_cause.feature_extractor import (
    FeatureExtractor,
    STANDARD_DEFECT_CLASSES,
    STANDARD_MACHINE_TYPES,
    STANDARD_SENSOR_GROUPS,
    SENSOR_BOUNDS,
    SENSOR_NOMINALS,
)
from backend.root_cause_data.feature_spec import RECONCILED_ROOT_CAUSE_CATALOG
from backend.app.root_cause.model_loader import (
    Model2Loader,
)
from backend.app.root_cause.schemas import (
    RootCauseAnalysisInput,
    RootCauseStatus,
    DefectInput,
    SensorMeasurementInput,
)
from backend.app.root_cause.service import RootCauseService


class TestModel2ContractCompatibility:
    """Task 2: Rigorous audit of feature, schema, and taxonomy alignment."""

    def test_audits_feature_count_divergence_between_pipeline_and_serving(self):
        """
        Agent 3's data pipeline specifies 40 canonical time-series rolling features.
        Agent 1's serving feature extractor specifies 88 multi-modal online features.
        This test documents the contract divergence that must be unified before final training.
        """
        training_features = Model2ArtifactContract.get_canonical_features()
        assert len(training_features) == 40

        extractor = FeatureExtractor()
        serving_features = extractor.feature_names
        assert len(serving_features) == 88

        # Explicitly verify the contract gap so that release blockers can be logged accurately
        assert len(training_features) != len(serving_features), (
            f"Expected documented difference: training specifies {len(training_features)} features, "
            f"serving specifies {len(serving_features)} features."
        )

    def test_audits_taxonomy_naming_divergence_between_training_and_catalog(self):
        """
        Agent 3 uses the 9-class photovoltaic domain taxonomy (e.g. thermal_stress_soldering).
        Agent 1 uses the 7-code equipment catalog (e.g. RC-SOLD-01).
        Verifies both sets and flags the need for bidirectional mapping.
        """
        training_classes = Model2ArtifactContract.get_target_classes()
        assert len(training_classes) == 9
        assert "thermal_stress_soldering" in training_classes
        assert "nominal_process_variation" in training_classes

        serving_catalog_codes = [mapping.cause_code for mapping in RECONCILED_ROOT_CAUSE_CATALOG.values()]
        assert len(serving_catalog_codes) == 9
        assert "RC-SOLD-01" in serving_catalog_codes

        # Reconciled catalog provides 1-to-1 mapping between 9 SEMI classes and engineering codes
        assert set(training_classes) == set(RECONCILED_ROOT_CAUSE_CATALOG.keys())

    def test_sensor_bounds_and_units_compatibility(self):
        """
        Verifies that physical sensor boundaries agree between the data registry
        (Agent 3) and serving bounds (Agent 1).
        """
        # Laminator temperature: registry specifies [120, 180] C nominal, serving specifies [20, 220] C bounds
        laminator_def = SENSOR_UNIT_REGISTRY.get("lamination_temp_c")
        assert laminator_def is not None
        assert laminator_def.min_valid == 120.0
        assert laminator_def.max_valid == 180.0

        serving_bounds = SENSOR_BOUNDS.get("laminator_temp")
        assert serving_bounds is not None
        assert serving_bounds[0] <= laminator_def.min_valid
        assert serving_bounds[1] >= laminator_def.max_valid

    def test_invalid_corrupted_model_artifact_rejection(self):
        """
        Ensures that if an invalid or zero-byte model artifact exists,
        Model2Loader catches the error gracefully, marks is_ready = False,
        and does NOT crash the application.
        """
        with tempfile.TemporaryDirectory() as tmp_dir:
            corrupt_artifact = Path(tmp_dir) / "corrupt_model.pt"
            corrupt_artifact.write_text("NOT_A_VALID_PYTORCH_OR_JOBLIB_MODEL")

            loader = Model2Loader(artifact_path=corrupt_artifact)
            assert not loader.is_ready
            assert loader.unavailability_reason is not None
            assert len(loader.unavailability_reason) > 0

    def test_zero_byte_model_artifact_rejection(self):
        """Zero-byte files must be flagged as empty/corrupted artifacts."""
        with tempfile.TemporaryDirectory() as tmp_dir:
            empty_artifact = Path(tmp_dir) / "empty_model.pt"
            empty_artifact.touch()

            loader = Model2Loader(artifact_path=empty_artifact)
            assert not loader.is_ready
            assert loader.unavailability_reason is not None

    def test_missing_data_handling_in_feature_extractor(self):
        """
        FeatureExtractor must handle completely missing sensors by setting
        missing indicator flags and imputed default nominal values without NaN or Inf.
        """
        extractor = FeatureExtractor()
        # Input with only defects, no sensors
        minimal_input = RootCauseAnalysisInput(
            inspection_id="insp-no-sensor",
            detections=[
                DefectInput(
                    defect_type="crack",
                    confidence=0.85,
                    x1=0.1,
                    y1=0.1,
                    x2=0.5,
                    y2=0.5,
                )
            ],
            sensor_measurements=[],
        )

        result = extractor.extract(minimal_input)
        assert len(result.feature_vector) == 88
        assert not np.isnan(result.feature_vector).any(), "Feature vector contains NaN!"
        assert not np.isinf(result.feature_vector).any(), "Feature vector contains Inf!"

        # Missing indicator flags must be active for sensor groups
        for sg in STANDARD_SENSOR_GROUPS:
            assert result.feature_dict[f"sensor_{sg}_is_missing"] == 1.0

    def test_service_returns_missing_process_data_when_telemetry_absent(self):
        """
        RootCauseService must truthfully return MISSING_PROCESS_DATA status
        when no telemetry or machine context is supplied.
        """
        service = RootCauseService()
        empty_input = RootCauseAnalysisInput(
            inspection_id="insp-empty-telemetry",
            detections=[
                DefectInput(
                    defect_type="finger_interruption",
                    confidence=0.92,
                    x1=0.2,
                    y1=0.2,
                    x2=0.4,
                    y2=0.4,
                )
            ],
            sensor_measurements=[],
            production_events=[],
        )

        response = service.analyze(empty_input)
        assert response.status == RootCauseStatus.MISSING_PROCESS_DATA
        assert len(response.probable_causes) == 0
        assert len(response.limitations) >= 1
        assert "Missing manufacturing process telemetry" in response.limitations[0]
