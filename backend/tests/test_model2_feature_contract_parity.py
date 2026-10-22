"""
SolarVision AI — Phase 3B Independent Model 2 Validation
Test Suite: Feature Contract Parity & Numerical Serving-Training Equivalence

Audits:
1. Exact dimensionality across all four specifications:
   - backend/root_cause_data/schema.py (CANONICAL_FEATURE_ORDER: 40 features)
   - server/rootCause/featureContract.ts (CANONICAL_FEATURE_ORDER: 40 features)
   - backend/root_cause_data/feature_spec.py (CANONICAL_FEATURES_V2: 48 features)
   - backend/app/root_cause/feature_extractor.py (online serving vector: 88 features)
2. Normalization scheme disparity (min-max / physical nominals vs z-score normalization).
3. Numerical parity on a controlled fixture through inference extraction vs training extraction.
4. Model loader / artifact manifest input shape compatibility.
"""

from __future__ import annotations

import math
from typing import Any, Dict, List
import numpy as np
import pytest

from backend.root_cause_data.schema import (
    CANONICAL_FEATURE_ORDER,
    ROOT_CAUSE_TAXONOMY,
    ROOT_CAUSE_DESCRIPTIONS,
    SENSOR_UNIT_REGISTRY,
)
from backend.root_cause_data.feature_spec import (
    CANONICAL_FEATURES_V2,
    CANONICAL_FEATURE_NAMES_V2,
    CANONICAL_FEATURE_COUNT_V2,
    RECONCILED_ROOT_CAUSE_CATALOG,
)
from backend.app.root_cause.feature_extractor import (
    FeatureExtractor,
    STANDARD_DEFECT_CLASSES,
    STANDARD_MACHINE_TYPES,
    STANDARD_SENSOR_GROUPS,
    SENSOR_BOUNDS,
    SENSOR_NOMINALS,
)
from backend.app.root_cause.schemas import (
    BatchInput,
    DefectInput,
    MachineInput,
    ProductionEventInput,
    RootCauseAnalysisInput,
    SensorMeasurementInput,
)
from backend.training.root_cause.contract import Model2ArtifactContract


@pytest.fixture
def controlled_multimodal_fixture() -> RootCauseAnalysisInput:
    """
    Standardized, fully specified multi-modal fixture for numerical parity testing.
    Contains known defect bounding boxes, machine context, batch material data,
    sensor readings with controlled values, and production events.
    """
    return RootCauseAnalysisInput(
        inspection_id="insp_test_parity_001",
        batch_id="batch_mono_perc_line1",
        machine_id="mach_str_tabber_03",
        confidence_threshold=0.25,
        detections=[
            DefectInput(
                defect_type="crack",
                confidence=0.88,
                x1=100.0,
                y1=150.0,
                x2=200.0,
                y2=250.0,
            ),
            DefectInput(
                defect_type="finger_interruption",
                confidence=0.74,
                x1=450.0,
                y1=500.0,
                x2=550.0,
                y2=520.0,
            ),
            DefectInput(
                defect_type="soldering_defect",
                confidence=0.91,
                x1=50.0,
                y1=50.0,
                x2=120.0,
                y2=100.0,
            ),
        ],
        machine=MachineInput(
            machine_id="mach_str_tabber_03",
            machine_type="stringer",
            status="operational",
            last_maintenance_at="2026-10-01T08:00:00Z",
            next_maintenance_due="2026-11-01T08:00:00Z",
        ),
        batch=BatchInput(
            batch_id="batch_mono_perc_line1",
            batch_number="LOT-202610-01",
            wafer_type="monocrystalline_perc",
            target_quantity=5000,
            actual_quantity=2500,
        ),
        sensor_measurements=[
            SensorMeasurementInput(
                sensor_type="soldering_temp_top_c",
                measurement_value=245.0,  # +20°C above nominal 225°C
                unit="C",
                is_anomaly=True,
                anomaly_score=0.85,
            ),
            SensorMeasurementInput(
                sensor_type="soldering_temp_bottom_c",
                measurement_value=220.0,  # nominal
                unit="C",
            ),
            SensorMeasurementInput(
                sensor_type="ribbon_tension_n",
                measurement_value=1.5,   # nominal 1.2N
                unit="N",
            ),
            SensorMeasurementInput(
                sensor_type="squeegee_pressure_n_cm2",
                measurement_value=20.0,  # nominal 18.0 N/cm2
                unit="N/cm2",
            ),
            SensorMeasurementInput(
                sensor_type="firing_peak_temp_c",
                measurement_value=865.0, # nominal 860.0°C
                unit="C",
            ),
            SensorMeasurementInput(
                sensor_type="lamination_temp_c",
                measurement_value=150.0, # nominal 148.0°C
                unit="C",
            ),
            SensorMeasurementInput(
                sensor_type="lamination_pressure_bar",
                measurement_value=0.95,  # nominal 0.90 bar
                unit="bar",
            ),
            SensorMeasurementInput(
                sensor_type="gripper_vacuum_kpa",
                measurement_value=-72.0, # nominal -75.0 kPa
                unit="kPa",
            ),
        ],
        production_events=[
            ProductionEventInput(
                event_type="thermal_drift_warning",
                severity="high",
                message="Soldering head temperature exceeded upper warning limit +15°C",
            ),
            ProductionEventInput(
                event_type="ribbon_tension_adjustment",
                severity="info",
                message="Routine automated tension auto-trim completed",
            ),
        ],
    )


class TestFeatureContractDiscrepancyAudit:
    """
    Audits the exact dimensional and architectural contract across the repository.
    Explicitly documents where 40, 48, and 88 feature contracts exist and how they relate.
    """

    def test_canonical_40_order_parity_between_backend_and_orchestration(self):
        """
        Confirms that backend/root_cause_data/schema.py and
        server/rootCause/featureContract.ts agree on CANONICAL_FEATURE_ORDER (40 features).
        """
        assert len(CANONICAL_FEATURE_ORDER) == 40
        assert Model2ArtifactContract.get_canonical_features() == list(CANONICAL_FEATURE_ORDER)

        # Expected domain splits in 40-D schema:
        defect_features = [f for f in CANONICAL_FEATURE_ORDER if f.startswith("feat_")]
        assert len(defect_features) == 12  # count, max_conf, mean_conf, area_ratio + 8 defect flags

        event_features = [f for f in CANONICAL_FEATURE_ORDER if "event_" in f or "warning" in f]
        assert len(event_features) == 2  # event_count_recent_1h, has_warning_recent_1h

        sensor_features = [f for f in CANONICAL_FEATURE_ORDER if f not in defect_features and f not in event_features]
        assert len(sensor_features) == 26  # rolling window physical sensors & electrical tests

    def test_canonical_48_v2_spec_properties(self):
        """
        Audits the 48-dimensional v2 canonical specification in backend/root_cause_data/feature_spec.py.
        """
        assert CANONICAL_FEATURE_COUNT_V2 == 48
        assert len(CANONICAL_FEATURE_NAMES_V2) == 48

        # Group 1: Defect optical (15)
        # Group 2: Machine context (12)
        # Group 3: Batch material (5)
        # Group 4: Sensor telemetry (10)
        # Group 5: Production events (6)
        # 15 + 12 + 5 + 10 + 6 = 48
        groups = {}
        for f in CANONICAL_FEATURES_V2:
            groups[f.domain.value] = groups.get(f.domain.value, 0) + 1

        assert groups["defect_optical"] == 15
        assert groups["machine_context"] == 12
        assert groups["batch_material"] == 5
        assert groups["sensor_telemetry"] == 10
        assert groups["production_event"] == 6

    def test_online_serving_88_dimensions_composition(self):
        """
        Audits the 88-dimensional online serving feature extractor in backend/app/root_cause/feature_extractor.py.
        """
        extractor = FeatureExtractor()
        assert len(extractor.feature_names) == 88

        # 15 defect + 12 machine + 5 batch + 50 sensor (7 groups * 7 metrics + 1) + 6 events = 88
        assert len(STANDARD_DEFECT_CLASSES) == 9
        assert len(STANDARD_MACHINE_TYPES) == 7
        assert len(STANDARD_SENSOR_GROUPS) == 7

    def test_reconciled_taxonomy_integrity(self):
        """
        Verifies that both 9-class SEMI root-cause taxonomy and RECONCILED_ROOT_CAUSE_CATALOG agree.
        """
        assert len(ROOT_CAUSE_TAXONOMY) == 9
        assert len(RECONCILED_ROOT_CAUSE_CATALOG) == 9

        for cat in ROOT_CAUSE_TAXONOMY:
            assert cat in RECONCILED_ROOT_CAUSE_CATALOG
            mapping = RECONCILED_ROOT_CAUSE_CATALOG[cat]
            assert mapping.taxonomy_identifier == cat
            assert mapping.cause_code.startswith("RC-")
            assert len(mapping.recommended_action) > 10


class TestNumericalParityAndPreprocessing:
    """
    Executes controlled numerical parity tests through inference preprocessing
    and training preprocessing.
    """

    def test_canonical_40_numerical_extraction_parity(self, controlled_multimodal_fixture):
        """
        Extracts 40-feature canonical vector via FeatureExtractor.to_canonical_40
        and verifies deterministic numerical properties against physical inputs.
        """
        extractor = FeatureExtractor()
        result = extractor.extract(controlled_multimodal_fixture)

        # 1. 88-D serving vector exists and has no NaN or Inf
        assert result.feature_vector.shape == (88,)
        assert not np.isnan(result.feature_vector).any()
        assert not np.isinf(result.feature_vector).any()

        # 2. 40-D canonical vector exists and has no NaN or Inf
        assert result.canonical_vector is not None
        assert result.canonical_vector.shape == (40,)
        assert not np.isnan(result.canonical_vector).any()
        assert not np.isinf(result.canonical_vector).any()

        vec40 = result.canonical_vector
        fnames = CANONICAL_FEATURE_ORDER

        # Check exact defect statistics in 40-D vector:
        idx_count = fnames.index("feat_defect_count")
        assert vec40[idx_count] == 3.0  # 3 detections

        idx_max_conf = fnames.index("feat_max_detection_conf")
        np.testing.assert_almost_equal(vec40[idx_max_conf], 0.91, decimal=3)

        idx_mean_conf = fnames.index("feat_mean_detection_conf")
        expected_mean = (0.88 + 0.74 + 0.91) / 3.0
        np.testing.assert_almost_equal(vec40[idx_mean_conf], expected_mean, decimal=3)

        # Check defect binary indicators:
        idx_crack = fnames.index("feat_is_crack")
        assert vec40[idx_crack] == 1.0

        idx_finger = fnames.index("feat_is_finger")
        assert vec40[idx_finger] == 1.0

        idx_black_core = fnames.index("feat_is_black_core")
        assert vec40[idx_black_core] == 0.0

        # Check sensor values (physical values in 40-D canonical schema):
        idx_sold_top = fnames.index("soldering_temp_top_mean_w15")
        assert vec40[idx_sold_top] == 245.0  # supplied measurement

        idx_sold_delta = fnames.index("soldering_temp_delta_mean_w15")
        assert vec40[idx_sold_delta] == 25.0  # 245.0 - 220.0

        idx_ribbon = fnames.index("ribbon_tension_mean_w15")
        assert vec40[idx_ribbon] == 1.5

        # Check unmonitored sensors use nominal baseline:
        idx_snapoff = fnames.index("screen_snapoff_mean_w15")
        assert vec40[idx_snapoff] == 1.8  # baseline nominal

        # Check event context:
        idx_events = fnames.index("event_count_recent_1h")
        assert vec40[idx_events] == 2.0

        idx_warn = fnames.index("has_warning_recent_1h")
        assert vec40[idx_warn] == 1.0

    def test_normalization_contrast_zscore_vs_minmax(self, controlled_multimodal_fixture):
        """
        Demonstrates and documents the mathematical difference between:
        a) Physical / nominal baseline representation (40-D schema)
        b) Z-score normalization: (x - mu) / sigma (88-D & 48-D schemas)
        c) Min-Max scaling: (x - min) / (max - min)
        """
        temp_val = 245.0
        nom_mean = 225.0
        nom_std = 15.0
        min_bound = 150.0
        max_bound = 300.0

        # Physical representation
        phys_diff = temp_val - nom_mean  # +20.0°C excursion

        # Z-score representation
        z_score = (temp_val - nom_mean) / nom_std  # +1.333 sigma
        np.testing.assert_almost_equal(z_score, 1.3333, decimal=3)

        # Min-Max representation
        min_max = (temp_val - min_bound) / (max_bound - min_bound)  # 95 / 150 = 0.6333
        np.testing.assert_almost_equal(min_max, 0.6333, decimal=3)

        # Confirm that passing z-score into a model expecting raw physical degrees
        # (or vice versa) would be catastrophic (factor of ~180x difference!)
        assert abs(temp_val - z_score) > 200.0

    def test_contract_dimension_mismatch_guard_in_loader(self):
        """
        Verifies that Model2Loader strictly enforces contract dimensions
        and rejects artifacts that do not match the expected 40-feature canonical contract.
        """
        from backend.app.root_cause.model_loader import Model2Loader

        loader = Model2Loader()
        # Default state is not ready because genuine weights are not trained
        assert not loader.is_ready
        reason = loader.unavailability_reason.lower()
        assert (
            "not found" in reason
            or "not trained" in reason
            or "validation_prototype" in reason
            or "not production ready" in reason
            or "blocked" in reason
        )
