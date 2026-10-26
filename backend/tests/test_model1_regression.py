from __future__ import annotations

import io
import json
from pathlib import Path
import subprocess
import sys
import tempfile

import cv2
import numpy as np
import pytest
from starlette.testclient import TestClient

from backend.app.config import settings
from backend.app.inference import DEFAULT_CLASS_NAMES, inference_service, load_image_safely, preprocess_image
from backend.app.main import app
from backend.app.schemas import Detection, InspectionResponse

client = TestClient(app)

REAL_TEST_IMAGE = Path("data/dataset/images/test/img003707.jpg")
REAL_GOOD_IMAGE = Path("downloads/solar_cell_EL_image/PVELAD/EL2021/othertypes/good/img021379.jpg")


def test_class_label_mapping() -> None:
    """Certify exact 9-class mapping and index order."""
    expected_order = [
        "crack",
        "finger",
        "black_core",
        "thick_line",
        "star_crack",
        "horizontal_dislocation",
        "vertical_dislocation",
        "printing_error",
        "short_circuit",
    ]
    service_names = inference_service.class_names()
    assert len(service_names) == 9
    for idx, expected in enumerate(expected_order):
        assert service_names[idx] == expected
        assert DEFAULT_CLASS_NAMES[idx] == expected


def test_valid_real_image_inference() -> None:
    """Verify real held-out EL image inference and detection output."""
    if not REAL_TEST_IMAGE.exists():
        pytest.skip(f"Test image {REAL_TEST_IMAGE} not present")

    detections, annotated, elapsed_ms = inference_service.predict(REAL_TEST_IMAGE, confidence=0.25)
    assert isinstance(detections, list)
    assert isinstance(annotated, np.ndarray)
    assert elapsed_ms > 0
    assert len(detections) >= 1

    det = detections[0]
    assert det.defect_type == "star_crack"
    assert det.confidence >= 0.50
    assert 800 <= det.x1 <= 900
    assert 200 <= det.y1 <= 320


def test_invalid_image_handling() -> None:
    """Verify comprehensive rejection of corrupted, empty, or invalid images."""
    # 1. Empty byte payload
    with pytest.raises(ValueError, match="(?i)empty"):
        load_image_safely(b"")

    # 2. Corrupt bytes
    with pytest.raises(ValueError, match="Unable to decode"):
        load_image_safely(b"not-an-image-payload-corrupt")

    # 3. None or non-numpy array
    with pytest.raises(ValueError, match="empty, None"):
        preprocess_image(None)

    # 4. Dimension too small (< 8x8)
    tiny_img = np.zeros((4, 4, 3), dtype=np.uint8)
    with pytest.raises(ValueError, match="too small"):
        preprocess_image(tiny_img)

    # 5. Non-existent file
    with pytest.raises(FileNotFoundError):
        load_image_safely(Path("non_existent_image_file.jpg"))


def test_detection_output_structure_and_coordinates() -> None:
    """Verify detection schema, boundary clamping, and coordinate correctness."""
    if not REAL_TEST_IMAGE.exists():
        pytest.skip("Test image not present")

    img = cv2.imread(str(REAL_TEST_IMAGE))
    h, w = img.shape[:2]

    detections, annotated, _ = inference_service.predict(REAL_TEST_IMAGE, confidence=0.01)
    assert len(detections) > 0

    for d in detections:
        # Schema checks
        assert isinstance(d, Detection)
        assert isinstance(d.defect_type, str)
        assert d.defect_type in inference_service.class_names()
        assert 0.0 <= d.confidence <= 1.0

        # Coordinate bounds checks: 0 <= x1 <= x2 <= w, 0 <= y1 <= y2 <= h
        assert 0.0 <= d.x1 <= d.x2 <= float(w), f"Invalid X coordinates: [{d.x1}, {d.x2}] for width {w}"
        assert 0.0 <= d.y1 <= d.y2 <= float(h), f"Invalid Y coordinates: [{d.y1}, {d.y2}] for height {h}"
        assert isinstance(d.near_image_boundary, bool)


def test_no_detection_on_defect_free_real_cell() -> None:
    """Verify 100% specificity / zero false alarm on genuine healthy EL cell."""
    if not REAL_GOOD_IMAGE.exists():
        pytest.skip(f"Healthy cell image {REAL_GOOD_IMAGE} not present")

    detections, annotated, elapsed_ms = inference_service.predict(REAL_GOOD_IMAGE, confidence=0.25)
    assert len(detections) == 0, f"Expected 0 detections on healthy cell, got {len(detections)}"
    assert isinstance(annotated, np.ndarray)
    assert elapsed_ms > 0


def test_cli_and_fastapi_prediction_consistency() -> None:
    """Verify exact 100% prediction parity between CLI tool and FastAPI endpoint."""
    if not REAL_TEST_IMAGE.exists():
        pytest.skip("Test image not present")

    # 1. FastAPI inference
    with open(REAL_TEST_IMAGE, "rb") as f:
        file_bytes = f.read()

    files = {"file": ("img003707.jpg", io.BytesIO(file_bytes), "image/jpeg")}
    api_response = client.post("/inspect?confidence=0.25", files=files)
    assert api_response.status_code == 200
    api_data = api_response.json()

    # 2. CLI inference
    with tempfile.TemporaryDirectory() as tmp_dir:
        tmp = Path(tmp_dir)
        ann_path = tmp / "cli_annotated.jpg"
        json_path = tmp / "cli_result.json"

        cmd = [
            sys.executable,
            "-m",
            "backend.app.infer_cli",
            "--input",
            str(REAL_TEST_IMAGE),
            "--annotated",
            str(ann_path),
            "--json",
            str(json_path),
            "--confidence",
            "0.25",
        ]
        proc = subprocess.run(cmd, capture_output=True, text=True)
        assert proc.returncode == 0, f"CLI error: {proc.stderr}"
        assert json_path.exists()
        cli_data = json.loads(json_path.read_text(encoding="utf-8"))

    # Compare predictions
    api_dets = api_data["detections"]
    cli_dets = cli_data["detections"]

    assert len(api_dets) == len(cli_dets), f"Count mismatch: API={len(api_dets)}, CLI={len(cli_dets)}"
    for a, c in zip(api_dets, cli_dets):
        assert a["defect_type"] == c["defect_type"]
        assert pytest.approx(a["confidence"], abs=1e-3) == c["confidence"]
        assert pytest.approx(a["x1"], abs=0.5) == c["x1"]
        assert pytest.approx(a["y1"], abs=0.5) == c["y1"]
        assert pytest.approx(a["x2"], abs=0.5) == c["x2"]
        assert pytest.approx(a["y2"], abs=0.5) == c["y2"]


def test_threshold_ladder_sensitivity_monotonicity() -> None:
    """Verify sensitivity increases monotonically across operational ladder [0.25, 0.10, 0.05, 0.01]."""
    if not REAL_TEST_IMAGE.exists():
        pytest.skip("Test image not present")

    diag = inference_service.diagnostics(REAL_TEST_IMAGE, thresholds=(0.25, 0.10, 0.05, 0.01))
    comparison = diag["threshold_comparison"]
    counts = [item["detection_count"] for item in comparison]

    # Monotonic non-decreasing: 0.25 <= 0.10 <= 0.05 <= 0.01
    assert counts[0] <= counts[1] <= counts[2] <= counts[3], f"Non-monotonic counts: {counts}"
    assert counts[0] >= 1, "Expected at least 1 detection at production 0.25"


def test_application_contract_compatibility() -> None:
    """Verify response structure conforms to Node server/inspection/service.ts contract."""
    if not REAL_TEST_IMAGE.exists():
        pytest.skip("Test image not present")

    with open(REAL_TEST_IMAGE, "rb") as f:
        file_bytes = f.read()

    files = {"file": ("test.jpg", io.BytesIO(file_bytes), "image/jpeg")}
    resp = client.post("/inspect", files=files)
    assert resp.status_code == 200
    data = resp.json()

    # Required fields by Node service
    assert "inspection_id" in data
    assert "source_filename" in data
    assert "model_name" in data
    assert "processing_time_ms" in data
    assert "detections" in data
    assert "annotated_image_data_url" in data
    assert "annotated_image_url" in data
    assert "inference_configuration" in data
    assert data["inference_configuration"]["confidence_threshold"] == 0.25


def test_dynamic_image_size_propagation() -> None:
    """Verify that image_size / imgsz parameter propagates across API, CLI, and inference service."""
    sample_img = Path("client/public/samples/sample-el-cell-3.jpg")
    if not sample_img.exists():
        pytest.skip(f"Sample image {sample_img} not present")

    # 1. Inference service
    dets_640, _, _ = inference_service.predict(sample_img, confidence=0.10, image_size=640)
    dets_1024, _, _ = inference_service.predict(sample_img, confidence=0.10, image_size=1024)
    assert len(dets_640) == 1
    assert len(dets_1024) == 1
    assert dets_640[0].defect_type == "crack"
    assert dets_1024[0].defect_type == "crack"
    # Confidences differ slightly between 640 and 1024 due to scale
    assert dets_640[0].confidence > 0.75
    assert dets_1024[0].confidence > 0.70

    # 2. FastAPI endpoint with image_size
    with open(sample_img, "rb") as f:
        resp = client.post(
            "/inspect?confidence=0.10&image_size=1024",
            files={"file": ("sample-el-cell-3.jpg", f, "image/jpeg")},
        )
    assert resp.status_code == 200
    api_data = resp.json()
    assert api_data["inference_configuration"]["image_size"] == 1024
    assert len(api_data["detections"]) == 1

    # 3. CLI execution with --image-size
    with tempfile.TemporaryDirectory() as tmpdir:
        ann_path = Path(tmpdir) / "ann.jpg"
        json_path = Path(tmpdir) / "result.json"
        cmd = [
            sys.executable,
            "-m",
            "backend.app.infer_cli",
            "--input",
            str(sample_img),
            "--annotated",
            str(ann_path),
            "--json",
            str(json_path),
            "--confidence",
            "0.10",
            "--image-size",
            "1024",
        ]
        proc = subprocess.run(cmd, capture_output=True, text=True)
        assert proc.returncode == 0, f"CLI error: {proc.stderr}"
        cli_data = json.loads(json_path.read_text(encoding="utf-8"))
        assert cli_data["inference_configuration"]["image_size"] == 1024
        assert len(cli_data["detections"]) == 1


def test_sample_el_cell_3_confidence_ladder_gap() -> None:
    """
    Certifies forensic finding: sample-el-cell-3.jpg genuinely contains a single
    high-confidence bottom-right crack (~0.81), and candidate drop-off produces
    identical 1-detection counts at 0.25, 0.10, and 0.05.
    """
    sample_img = Path("client/public/samples/sample-el-cell-3.jpg")
    if not sample_img.exists():
        pytest.skip(f"Sample image {sample_img} not present")

    d25, _, _ = inference_service.predict(sample_img, confidence=0.25, image_size=640)
    d10, _, _ = inference_service.predict(sample_img, confidence=0.10, image_size=640)
    d05, _, _ = inference_service.predict(sample_img, confidence=0.05, image_size=640)
    d01, _, _ = inference_service.predict(sample_img, confidence=0.01, image_size=640)

    assert len(d25) == 1, "Expected 1 detection at conf=0.25"
    assert len(d10) == 1, "Expected 1 detection at conf=0.10"
    assert len(d05) == 1, "Expected 1 detection at conf=0.05"
    assert len(d01) == 3, "Expected 3 detections at conf=0.01"

    # Confirm bottom-right crack coordinates and type
    crack = d25[0]
    assert crack.defect_type == "crack"
    assert crack.confidence > 0.80
    assert crack.x1 > 800 and crack.y1 > 850

