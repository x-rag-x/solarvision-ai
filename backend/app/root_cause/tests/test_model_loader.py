from pathlib import Path
import pytest
import numpy as np

from backend.app.root_cause.model_loader import Model2Loader, DEFAULT_ARTIFACT_JSON
from backend.root_cause_data.schema import ROOT_CAUSE_TAXONOMY


def test_model_loader_defaults_to_not_ready_when_no_artifact():
    loader = Model2Loader(artifact_path=Path("non_existent_model.pt"))
    assert loader.is_ready is False
    assert loader.model_version == "none"
    assert "not found" in loader.unavailability_reason.lower()


def test_model_loader_rejects_empty_file(tmp_path):
    empty_file = tmp_path / "empty_model.pt"
    empty_file.touch()

    loader = Model2Loader(artifact_path=empty_file)
    assert loader.is_ready is False
    assert "0 bytes" in loader.unavailability_reason


def test_model_loader_rejects_validation_prototype_in_production_mode():
    if DEFAULT_ARTIFACT_JSON.exists():
        loader = Model2Loader(artifact_path=DEFAULT_ARTIFACT_JSON, allow_prototype=False)
        # Because the artifact status is 'validation_prototype' (dataset blocked), must not be ready in prod!
        assert loader.is_ready is False
        assert "not production ready" in loader.unavailability_reason.lower()


def test_model_loader_loads_validation_prototype_in_prototype_mode():
    if DEFAULT_ARTIFACT_JSON.exists():
        loader = Model2Loader(artifact_path=DEFAULT_ARTIFACT_JSON, allow_prototype=True)
        assert loader.is_ready is True
        assert loader.model_version == "2.0.0-rc1"
        assert loader.manifest is not None
        assert loader.manifest.cause_classes == list(ROOT_CAUSE_TAXONOMY)
        assert loader.is_calibrated is False  # Raw ensemble vote frequency, not calibrated
        assert loader.expected_dim == 40  # Legacy artifact dimension


def test_model_loader_exact_dimension_enforcement():
    if DEFAULT_ARTIFACT_JSON.exists():
        loader = Model2Loader(artifact_path=DEFAULT_ARTIFACT_JSON, allow_prototype=True)
        # loader.expected_dim is 40 for this artifact
        correct_dim_vec = np.zeros(40, dtype=np.float32)
        causes, _ = loader.predict(correct_dim_vec, ["feat"] * 40)
        assert isinstance(causes, list)

        # Mismatched dimension (e.g. 48 or 88) must raise ValueError immediately
        wrong_dim_vec = np.zeros(48, dtype=np.float32)
        with pytest.raises(ValueError, match="does not match model expected dimensions"):
            loader.predict(wrong_dim_vec, ["feat"] * 48)


def test_model_loader_custom_predictor_registration():
    loader = Model2Loader(artifact_path=Path("fake.pt"))
    assert loader.is_ready is False

    def dummy_predictor(vec: np.ndarray):
        return (
            [
                {
                    "cause_code": "thermal_stress_soldering",
                    "label": "Thermal Stress Soldering",
                    "confidence": 0.88,
                    "recommended_action": "Check soldering temperature PID controller",
                    "supporting_evidence": ["Test evidence 1"],
                }
            ],
            {"soldering_temp_top_mean_w15": 0.95},
        )

    loader.register_test_predictor(dummy_predictor, version="2.0.0-rc1")
    assert loader.is_ready is True
    assert loader.model_version == "2.0.0-rc1"

    dummy_features = np.zeros(40, dtype=np.float32)
    causes, imp = loader.predict(dummy_features, ["f1", "f2"])
    assert len(causes) == 1
    assert causes[0]["cause_code"] == "thermal_stress_soldering"
    assert causes[0]["confidence"] == 0.88
    assert imp["soldering_temp_top_mean_w15"] == 0.95

    loader.clear_test_predictor()
    assert loader.is_ready is False
