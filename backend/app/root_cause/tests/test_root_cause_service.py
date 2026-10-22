import json
from pathlib import Path
import pytest
import numpy as np

from backend.app.root_cause.model_loader import Model2Loader
from backend.app.root_cause.schemas import (
    BatchInput,
    DefectInput,
    MachineInput,
    ProductionEventInput,
    RootCauseAnalysisInput,
    RootCauseStatus,
    SensorMeasurementInput,
)
from backend.app.root_cause.service import RootCauseService


def test_service_returns_missing_process_data_when_no_telemetry():
    loader = Model2Loader(artifact_path=Path("non_existent.pt"))
    service = RootCauseService(loader=loader)

    payload = RootCauseAnalysisInput(
        inspection_id="insp-no-telemetry",
        detections=[
            DefectInput(defect_type="soldering_defect", confidence=0.9, x1=10, y1=10, x2=50, y2=50)
        ],
    )

    response = service.analyze(payload)
    assert response.status == RootCauseStatus.MISSING_PROCESS_DATA
    assert len(response.probable_causes) == 0
    assert any("missing manufacturing process telemetry" in lim.lower() for lim in response.limitations)
    shared = response.to_shared_dict()
    assert shared["status"] == "missing_process_data"
    assert shared["probableCauses"] == []
    assert shared["inspectionId"] == "insp-no-telemetry"


def test_service_returns_not_trained_when_process_data_present_but_no_checkpoint():
    loader = Model2Loader(artifact_path=Path("non_existent_rc_model.pt"))
    service = RootCauseService(loader=loader)

    payload = RootCauseAnalysisInput(
        inspection_id="insp-with-process-data",
        batch_id="batch-123",
        machine_id="machine-01",
        detections=[
            DefectInput(defect_type="crack", confidence=0.85, x1=10, y1=10, x2=100, y2=100)
        ],
        machine=MachineInput(
            machine_id="machine-01",
            machine_type="stringer",
            status="operational",
        ),
        sensor_measurements=[
            SensorMeasurementInput(
                sensor_type="soldering_temp",
                measurement_value=320.0,
                unit="°C",
            )
        ],
    )

    response = service.analyze(payload)
    # Zero fabrication rule: Must be not_trained, zero causes, zero fabricated confidence!
    assert response.status == RootCauseStatus.NOT_TRAINED
    assert len(response.probable_causes) == 0
    assert response.model_version == "none"
    assert any("not trained" in lim.lower() for lim in response.limitations)

    shared = response.to_shared_dict()
    assert shared["status"] == "not_trained"
    assert shared["probableCauses"] == []
    assert shared["modelVersion"] == "none"
    assert shared["inspectionId"] == "insp-with-process-data"
    assert shared["batchId"] == "batch-123"
    assert shared["machineId"] == "machine-01"


def test_service_returns_ready_with_calibrated_causes_when_model_is_ready():
    loader = Model2Loader(artifact_path=Path("dummy.pt"))

    def test_predictor(vec: np.ndarray):
        return (
            [
                {
                    "cause_code": "thermal_stress_soldering",
                    "label": "Thermal Stress Soldering",
                    "confidence": 0.84,
                    "recommended_action": "Recalibrate soldering temperature PID controller",
                    "supporting_evidence": ["Temperature sensor drift corroborated by soldering defects"],
                }
            ],
            {"soldering_temp_top_mean_w15": 0.42, "feat_is_short_circuit": 0.38},
        )

    loader.register_test_predictor(test_predictor, version="2.1.0-verified")
    service = RootCauseService(loader=loader)

    payload = RootCauseAnalysisInput(
        inspection_id="insp-ready-001",
        batch_id="batch-PERC-01",
        machine_id="machine-STR-02",
        detections=[
            DefectInput(defect_type="soldering_defect", confidence=0.88, x1=5, y1=5, x2=45, y2=45)
        ],
        machine=MachineInput(
            machine_id="machine-STR-02",
            machine_type="stringer",
            status="operational",
        ),
        sensor_measurements=[
            SensorMeasurementInput(
                sensor_type="soldering_temp",
                measurement_value=360.0,
                unit="°C",
                is_anomaly=True,
                anomaly_score=0.91,
            )
        ],
        production_events=[
            ProductionEventInput(
                event_type="thermal_drift",
                severity="high",
                message="Soldering iron thermal overshoot detected",
            )
        ],
    )

    response = service.analyze(payload)
    assert response.status == RootCauseStatus.READY
    assert len(response.probable_causes) == 1
    assert response.model_version == "2.1.0-verified"

    cause = response.probable_causes[0]
    assert cause.cause_code == "thermal_stress_soldering"
    assert cause.confidence == 0.84
    assert len(cause.supporting_evidence) > 0
    assert cause.recommended_action is not None

    shared = response.to_shared_dict()
    assert shared["status"] == "ready"
    assert shared["inspectionId"] == "insp-ready-001"
    assert shared["batchId"] == "batch-PERC-01"
    assert shared["machineId"] == "machine-STR-02"
    assert shared["modelVersion"] == "2.1.0-verified"
    assert len(shared["probableCauses"]) == 1
    assert shared["probableCauses"][0]["causeCode"] == "thermal_stress_soldering"
    assert shared["probableCauses"][0]["confidence"] == 0.84
    assert "supportingEvidence" in shared["probableCauses"][0]
    assert "recommendedAction" in shared["probableCauses"][0]


def test_cli_execution_with_json_file(tmp_path):
    import subprocess
    import sys

    input_file = tmp_path / "cli_input.json"
    output_file = tmp_path / "cli_output.json"

    input_payload = {
        "inspectionId": "cli-insp-001",
        "batchId": "batch-CLI-01",
        "machineId": "machine-CLI-01",
        "detections": [
            {"defectType": "crack", "confidence": 0.8, "x1": 10, "y1": 10, "x2": 20, "y2": 20}
        ],
        "machine": {
            "machineId": "machine-CLI-01",
            "machineType": "stringer",
            "status": "operational"
        },
        "sensorMeasurements": [
            {"sensorType": "soldering_temp", "measurementValue": 320.0, "unit": "°C"}
        ]
    }
    input_file.write_text(json.dumps(input_payload), encoding="utf-8")

    cmd = [
        sys.executable,
        "-m",
        "backend.app.root_cause.cli",
        "--input",
        str(input_file),
        "--output",
        str(output_file),
    ]

    proc = subprocess.run(cmd, capture_output=True, text=True)
    assert proc.returncode == 0, f"CLI stderr: {proc.stderr}"
    assert output_file.exists()

    result = json.loads(output_file.read_text(encoding="utf-8"))
    assert result["inspectionId"] == "cli-insp-001"
    assert result["status"] == "not_trained"
    assert result["probableCauses"] == []
    assert result["modelVersion"] == "none"
