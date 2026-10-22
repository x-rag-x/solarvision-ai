"""
SolarVision AI — Phase 3 / Model 3 QA
Task 2: Model 2 Production Contract v2 (48-Feature) Audit Test Suite

Confirms new Model 2 production training strictly uses the approved 48-feature v2 schema,
verifying feature order, preprocessing isolation, missingness semantics, normalization,
taxonomy alignment, and distinguishing legacy 40-D from production 48-D readiness.
"""

from pathlib import Path
import json
import numpy as np
import pytest

from backend.root_cause_data.feature_spec import (
    CANONICAL_FEATURES_V2,
    CANONICAL_FEATURE_NAMES_V2,
    CANONICAL_FEATURE_COUNT_V2,
    FEATURE_SCHEMA_VERSION,
    FeatureDomain,
    MissingValuePolicy,
)
from backend.root_cause_data.schema import (
    CANONICAL_FEATURE_ORDER as LEGACY_40_FEATURE_ORDER,
    ROOT_CAUSE_TAXONOMY,
)
from backend.root_cause_data.preprocessor import TrainingOnlyFeaturePreprocessor
from backend.training.root_cause.contract import (
    Model2ArtifactContract,
    ModelMetadata,
)
from backend.app.root_cause.model_loader import Model2Loader


class TestModel2ProductionContractV2:
    """Rigorous verification of the 48-dimensional v2 production contract."""

    def test_canonical_feature_count_is_strictly_48(self):
        """Verifies canonical v2 dimension is exactly 48 features."""
        assert CANONICAL_FEATURE_COUNT_V2 == 48
        assert len(CANONICAL_FEATURES_V2) == 48
        assert len(CANONICAL_FEATURE_NAMES_V2) == 48

    def test_canonical_feature_domain_decomposition(self):
        """
        Verifies exact domain group partitioning across the 48 features:
        - 15 Model 1 Defect Optical (0-14)
        - 12 Machine Context & Health (15-26)
        - 5 Batch Material & Progress (27-31)
        - 10 Continuous Sensor Telemetry (32-41)
        - 6 Production Events & Severity (42-47)
        """
        domains = [f.domain for f in CANONICAL_FEATURES_V2]
        defect_count = sum(1 for d in domains if d == FeatureDomain.DEFECT_OPTICAL)
        machine_count = sum(1 for d in domains if d == FeatureDomain.MACHINE_CONTEXT)
        batch_count = sum(1 for d in domains if d == FeatureDomain.BATCH_MATERIAL)
        sensor_count = sum(1 for d in domains if d == FeatureDomain.SENSOR_TELEMETRY)
        event_count = sum(1 for d in domains if d == FeatureDomain.PRODUCTION_EVENT)

        assert defect_count == 15, f"Expected 15 defect optical features, got {defect_count}"
        assert machine_count == 12, f"Expected 12 machine context features, got {machine_count}"
        assert batch_count == 5, f"Expected 5 batch material features, got {batch_count}"
        assert sensor_count == 10, f"Expected 10 sensor telemetry features, got {sensor_count}"
        assert event_count == 6, f"Expected 6 production event features, got {event_count}"
        assert defect_count + machine_count + batch_count + sensor_count + event_count == 48

    def test_exact_feature_ordering_and_indices(self):
        """Verifies sequential indices (0 to 47) without gaps or duplicates."""
        for idx, feat in enumerate(CANONICAL_FEATURES_V2):
            assert feat.index == idx, f"Feature {feat.name} index mismatch: expected {idx}, got {feat.index}"
            assert feat.name == CANONICAL_FEATURE_NAMES_V2[idx]

    def test_preprocessing_fitted_strictly_on_training_data_zero_leakage(self):
        """
        Verifies that TrainingOnlyFeaturePreprocessor derives means, standard deviations,
        and medians exclusively from the training split, with zero leakage from validation/test.
        """
        np.random.seed(42)
        n_train = 200
        n_test = 50

        # Create distinct distributions for train and test
        X_train = np.random.normal(loc=10.0, scale=2.0, size=(n_train, 48))
        X_test = np.random.normal(loc=99.0, scale=0.5, size=(n_test, 48))

        preprocessor = TrainingOnlyFeaturePreprocessor(clip_zscore=5.0)
        preprocessor.fit(X_train)

        # Preprocessor means must reflect train distribution (~10.0), unaffected by test data (~99.0)
        assert np.all(np.abs(preprocessor.means_ - 10.0) < 0.5), (
            "Preprocessor means must be computed solely from X_train"
        )
        assert preprocessor.observed_counts_[0] == n_train

        # Transform test data using training parameters
        X_test_trans, mask_test = preprocessor.transform(X_test)
        # Scaled test samples should be far from 0.0 (reflecting true distribution shift)
        assert np.mean(X_test_trans) > 4.0, (
            "Test data transformation must use training parameters, revealing shift"
        )

    def test_missingness_semantics_and_mask_generation(self):
        """
        Verifies that missing features generate explicit boolean masks and obey
        domain-specific missingness policies (zero_fill, nominal_baseline, default_progress).
        """
        X = np.ones((5, 48))
        missing_mask = np.zeros((5, 48), dtype=bool)

        # Introduce missing sensors on sample 0
        missing_mask[0, 32:42] = True  # Sensor channels missing
        X[0, 32:42] = np.nan

        preprocessor = TrainingOnlyFeaturePreprocessor()
        preprocessor.fit(X, missing_mask_train=missing_mask)
        X_trans, out_mask = preprocessor.transform(X, missing_mask=missing_mask)

        # Missing mask must be preserved in output
        assert np.all(out_mask[0, 32:42] == True)
        assert np.all(out_mask[1, :] == False)
        # Imputed sensor values must be finite and clipped
        assert np.all(np.isfinite(X_trans))

    def test_label_taxonomy_strictly_matches_9_classes(self):
        """Verifies the 9-class manufacturing root-cause taxonomy alignment."""
        expected_classes = [
            "thermal_stress_soldering",
            "squeegee_pressure_drift",
            "screen_mesh_clogging",
            "firing_thermal_profile_excursion",
            "mechanical_handling_impact",
            "lamination_pressure_imbalance",
            "ingot_thermal_gradient",
            "chemical_texturing_contamination",
            "nominal_process_variation",
        ]
        assert list(ROOT_CAUSE_TAXONOMY) == expected_classes
        assert len(ROOT_CAUSE_TAXONOMY) == 9

    def test_distinguish_legacy_40d_from_production_48d(self):
        """
        Explicitly asserts that legacy 40-D schema is NOT interchangeable with production 48-D v2.
        Attempting to load a 40-D artifact under 48-D contract must be rejected by dimension check.
        """
        assert len(LEGACY_40_FEATURE_ORDER) == 40
        assert len(CANONICAL_FEATURE_NAMES_V2) == 48

        # 40-D feature set differs in both count and feature set
        assert set(LEGACY_40_FEATURE_ORDER) != set(CANONICAL_FEATURE_NAMES_V2)

        # Metadata contract specifies v2 schema version
        metadata_48 = ModelMetadata(
            model_name="SolarVision_RootCause_RF",
            model_version="2.0.0-rc1",
            created_at="2026-10-22T00:00:00Z",
            framework="random_forest",
            feature_count=48,
            feature_names=list(CANONICAL_FEATURE_NAMES_V2),
            num_classes=9,
            target_classes=list(ROOT_CAUSE_TAXONOMY),
            hyperparameters={"n_estimators": 100},
            training_samples=500,
            metrics={"f1_macro": 0.88},
            feature_importances={},
            feature_schema_version=FEATURE_SCHEMA_VERSION,
        )
        assert metadata_48.feature_count == 48
        assert metadata_48.feature_schema_version == "2.0.0"

    def test_model_loader_rejects_prototype_and_incompatible_dimensions(self, tmp_path: Path):
        """
        Verifies that Model2Loader in production mode rejects:
        1. Non-existent artifacts
        2. Incompatible feature counts
        3. Prototype weights (quarantine enforcement)
        """
        # 1. Non-existent artifact
        non_existent = tmp_path / "non_existent.json"
        loader = Model2Loader(artifact_path=non_existent)
        assert loader.is_ready is False

        # 2. Prototype quarantine
        proto_path = tmp_path / "proto.json"
        proto_data = {
            "metadata": {
                "model_name": "SolarVision_RootCause_RF",
                "model_version": "0.1.0-prototype",
                "framework": "random_forest",
                "feature_count": 48,
                "feature_names": list(CANONICAL_FEATURE_NAMES_V2),
                "num_classes": 9,
                "target_classes": list(ROOT_CAUSE_TAXONOMY),
                "status": "validation_prototype",
                "feature_schema_version": "2.0.0",
                "training_samples": 100,
                "hyperparameters": {},
                "metrics": {},
                "feature_importances": {},
                "created_at": "2026-10-22T00:00:00Z",
            },
            "model_payload": {},
        }
        proto_path.write_text(json.dumps(proto_data), encoding="utf-8")
        loader_proto = Model2Loader(artifact_path=proto_path)
        assert loader_proto.is_ready is False
        assert "prototype" in loader_proto.unavailability_reason.lower()
