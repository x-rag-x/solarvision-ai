from __future__ import annotations

import hashlib
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
from backend.app.inference import (
    DEFAULT_CLASS_NAMES,
    YoloInferenceService,
    inference_service,
    load_image_safely,
    preprocess_image,
)
from backend.app.main import app
from backend.app.schemas import Detection

client = TestClient(app)

EXPECTED_SHA256 = "59650dafe43c178e89af3d439b283ebf1c3e4abe6239aaa111c62afa41b7a7c6"
EXPECTED_PARAM_COUNT = 2507310
EXPECTED_CLASS_ORDER = [
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

REAL_TEST_IMAGE = Path("data/dataset/images/test/img003707.jpg")
REAL_GOOD_IMAGE = Path("downloads/solar_cell_EL_image/PVELAD/EL2021/othertypes/good/img021379.jpg")


# ============================================================================
# 1. Model Checkpoint Integrity & Parameter Count
# ============================================================================

def test_checkpoint_file_exists_and_sha256_unaltered() -> None:
    assert settings.model_path.exists(), f"Checkpoint {settings.model_path} missing"
    hasher = hashlib.sha256()
    with open(settings.model_path, "rb") as f:
        while chunk := f.read(1024 * 1024):
            hasher.update(chunk)
    actual_hash = hasher.hexdigest()
    assert (
        actual_hash == EXPECTED_SHA256
    ), f"Model checkpoint hash modified! Expected {EXPECTED_SHA256}, got {actual_hash}"


def test_model_parameter_count_matches_baseline() -> None:
    info = inference_service.model_info()
    assert info["parameter_count"] == EXPECTED_PARAM_COUNT, (
        f"Parameter count changed! Expected {EXPECTED_PARAM_COUNT}, got {info['parameter_count']}"
    )


# ============================================================================
# 2. Original Nine-Class Taxonomy Mapping
# ============================================================================

def test_nine_class_mapping_order_and_names() -> None:
    service_classes = inference_service.class_names()
    assert len(service_classes) == 9, f"Expected 9 classes, got {len(service_classes)}"
    assert service_classes == EXPECTED_CLASS_ORDER
    dict_classes = [DEFAULT_CLASS_NAMES[i] for i in range(9)]
    assert dict_classes == EXPECTED_CLASS_ORDER

    # Verify model info metadata matches
    info = inference_service.model_info()
    assert info["class_names"] == EXPECTED_CLASS_ORDER


# ============================================================================
# 3. Input Image Preprocessing Across Diverse Formats
# ============================================================================

def test_preprocessing_2d_grayscale() -> None:
    gray = np.full((512, 512), 100, dtype=np.uint8)
    processed = preprocess_image(gray)
    assert processed.ndim == 3
    assert processed.shape == (512, 512, 3)
    assert processed.dtype == np.uint8


def test_preprocessing_3channel_bgr() -> None:
    bgr = np.full((512, 512, 3), 100, dtype=np.uint8)
    processed = preprocess_image(bgr)
    assert processed.shape == (512, 512, 3)
    assert processed.dtype == np.uint8


def test_preprocessing_4channel_bgra() -> None:
    bgra = np.full((512, 512, 4), 100, dtype=np.uint8)
    processed = preprocess_image(bgra)
    assert processed.shape == (512, 512, 3)
    assert processed.dtype == np.uint8


def test_preprocessing_16bit_uint16() -> None:
    u16 = np.full((256, 256), 32000, dtype=np.uint16)
    processed = preprocess_image(u16)
    assert processed.shape == (256, 256, 3)
    assert processed.dtype == np.uint8


def test_preprocessing_float32_normalized() -> None:
    f32 = np.full((256, 256, 3), 0.5, dtype=np.float32)
    processed = preprocess_image(f32)
    assert processed.shape == (256, 256, 3)
    assert processed.dtype == np.uint8
    assert abs(int(processed[0, 0, 0]) - 127) <= 1


def test_load_image_safely_bytes_and_path() -> None:
    sample = np.full((100, 100, 3), 150, dtype=np.uint8)
    ok, buf = cv2.imencode(".png", sample)
    assert ok
    encoded = buf.tobytes()

    # Load from bytes
    loaded_bytes = load_image_safely(encoded)
    assert loaded_bytes.shape == (100, 100, 3)

    # Load from file path
    with tempfile.NamedTemporaryFile(suffix=".png", delete=False) as tmp:
        tmp_path = Path(tmp.name)
        tmp_path.write_bytes(encoded)

    try:
        loaded_path = load_image_safely(tmp_path)
        assert loaded_path.shape == (100, 100, 3)
    finally:
        tmp_path.unlink(missing_ok=True)


# ============================================================================
# 4. Confidence Filtering & Monotonic Sensitivity
# ============================================================================

def test_confidence_filtering_monotonicity() -> None:
    if not REAL_TEST_IMAGE.exists():
        pytest.skip(f"Test image {REAL_TEST_IMAGE} not present")

    thresholds = [0.80, 0.50, 0.25, 0.10, 0.05, 0.01]
    counts = []

    for conf in thresholds:
        detections, _, _ = inference_service.predict(REAL_TEST_IMAGE, confidence=conf)
        counts.append(len(detections))
        for d in detections:
            assert d.confidence >= conf, f"Detection conf {d.confidence} < threshold {conf}"

    # As threshold decreases, count must be non-decreasing
    for i in range(len(counts) - 1):
        assert (
            counts[i] <= counts[i + 1]
        ), f"Monotonicity violated: conf {thresholds[i]} ({counts[i]}) > conf {thresholds[i+1]} ({counts[i+1]})"


# ============================================================================
# 5. Bounding-Box Clamping & Coordinate Validity
# ============================================================================

def test_bounding_box_coordinates_strictly_bounded() -> None:
    if not REAL_TEST_IMAGE.exists():
        pytest.skip(f"Test image {REAL_TEST_IMAGE} not present")

    img = cv2.imread(str(REAL_TEST_IMAGE))
    h, w = img.shape[:2]

    detections, annotated, _ = inference_service.predict(REAL_TEST_IMAGE, confidence=0.01)
    assert len(detections) > 0

    for d in detections:
        assert 0.0 <= d.x1 <= d.x2 <= float(w), f"Out of bounds X: [{d.x1}, {d.x2}] for W={w}"
        assert 0.0 <= d.y1 <= d.y2 <= float(h), f"Out of bounds Y: [{d.y1}, {d.y2}] for H={h}"
        # Verify near_image_boundary logic
        margin_x = float(w) * 0.02
        margin_y = float(h) * 0.02
        expected_boundary = (
            d.x1 <= margin_x or d.y1 <= margin_y or d.x2 >= (w - margin_x) or d.y2 >= (h - margin_y)
        )
        assert d.near_image_boundary == expected_boundary


# ============================================================================
# 6. Empty Detection Behavior
# ============================================================================

def test_empty_detection_on_defect_free_cell() -> None:
    # Uniform gray negative control image
    defect_free = np.full((640, 640, 3), 45, dtype=np.uint8)
    detections, annotated, elapsed_ms = inference_service.predict(defect_free, confidence=0.25)

    assert len(detections) == 0
    assert isinstance(annotated, np.ndarray)
    assert annotated.shape == (640, 640, 3)
    assert elapsed_ms > 0


def test_empty_detection_on_real_healthy_cell_dataset_image() -> None:
    if not REAL_GOOD_IMAGE.exists():
        pytest.skip(f"Healthy image {REAL_GOOD_IMAGE} not present")

    detections, annotated, elapsed_ms = inference_service.predict(REAL_GOOD_IMAGE, confidence=0.25)
    assert len(detections) == 0, f"False positive on healthy cell: {detections}"
    assert isinstance(annotated, np.ndarray)
    assert elapsed_ms > 0


# ============================================================================
# 7. CLI / FastAPI Prediction Parity
# ============================================================================

def test_cli_and_fastapi_absolute_consistency() -> None:
    if not REAL_TEST_IMAGE.exists():
        pytest.skip(f"Test image {REAL_TEST_IMAGE} not present")

    # Run FastAPI
    with open(REAL_TEST_IMAGE, "rb") as f:
        api_resp = client.post("/inspect?confidence=0.25", files={"file": ("cell.jpg", f, "image/jpeg")})
    assert api_resp.status_code == 200
    api_data = api_resp.json()

    # Run CLI
    with tempfile.TemporaryDirectory() as tmp_dir:
        tmp = Path(tmp_dir)
        ann_path = tmp / "ann.jpg"
        json_path = tmp / "res.json"

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
        cli_data = json.loads(json_path.read_text(encoding="utf-8"))

    # Assert prediction parity
    assert len(api_data["detections"]) == len(cli_data["detections"])
    for api_det, cli_det in zip(api_data["detections"], cli_data["detections"]):
        assert api_det["defect_type"] == cli_det["defect_type"]
        assert pytest.approx(api_det["confidence"], abs=1e-3) == cli_det["confidence"]
        assert pytest.approx(api_det["x1"], abs=0.5) == cli_det["x1"]
        assert pytest.approx(api_det["y1"], abs=0.5) == cli_det["y1"]
        assert pytest.approx(api_det["x2"], abs=0.5) == cli_det["x2"]
        assert pytest.approx(api_det["y2"], abs=0.5) == cli_det["y2"]


# ============================================================================
# 8. Inference Error Handling
# ============================================================================

def test_inference_rejection_of_tiny_image() -> None:
    tiny = np.zeros((4, 4, 3), dtype=np.uint8)
    with pytest.raises(ValueError, match="too small"):
        preprocess_image(tiny)


def test_inference_rejection_of_empty_payload() -> None:
    with pytest.raises(ValueError, match="(?i)empty"):
        load_image_safely(b"")


def test_inference_rejection_of_corrupt_payload() -> None:
    with pytest.raises(ValueError, match="Unable to decode"):
        load_image_safely(b"\x00\x01\x02\x03not_an_image")
