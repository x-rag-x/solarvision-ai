from __future__ import annotations

import io
import json
from pathlib import Path
from unittest.mock import patch
import cv2
import numpy as np
import pytest
from starlette.testclient import TestClient

from backend.app.config import settings
from backend.app.main import app
from backend.app.schemas import InspectionResponse

client = TestClient(app)

REAL_TEST_IMAGE = Path("data/dataset/images/test/img003707.jpg")


def create_test_image_bytes(width: int = 256, height: int = 256, color: int = 120) -> bytes:
    img = np.full((height, width, 3), color, dtype=np.uint8)
    ok, buf = cv2.imencode(".jpg", img)
    assert ok
    return buf.tobytes()


# ============================================================================
# 1. Valid Image Uploads & Actual Inference Responses
# ============================================================================

def test_inspect_valid_image_returns_200_and_correct_shape() -> None:
    img_bytes = create_test_image_bytes()
    files = {"file": ("cell_test.jpg", io.BytesIO(img_bytes), "image/jpeg")}
    response = client.post("/inspect", files=files)
    assert response.status_code == 200

    data = response.json()
    assert data["status"] == "completed"
    assert data["source_filename"] == "cell_test.jpg"
    assert data["model_name"] == "YOLO26n"
    assert isinstance(data["inspection_id"], str)
    assert len(data["inspection_id"]) == 36  # UUID length
    assert isinstance(data["processing_time_ms"], (int, float))
    assert data["processing_time_ms"] > 0
    assert "summary" in data
    assert "total_detections" in data["summary"]
    assert isinstance(data["detections"], list)
    assert "annotated_image_url" in data
    assert "annotated_image_data_url" in data
    assert data["annotated_image_data_url"].startswith("data:image/jpeg;base64,")
    assert "inference_configuration" in data
    assert data["inference_configuration"]["confidence_threshold"] == 0.25
    assert data["inference_configuration"]["image_size"] == 640


def test_inspect_real_el_cell_generates_verified_detections() -> None:
    if not REAL_TEST_IMAGE.exists():
        pytest.skip(f"Held-out test image {REAL_TEST_IMAGE} not present")

    with open(REAL_TEST_IMAGE, "rb") as f:
        file_bytes = f.read()

    files = {"file": ("img003707.jpg", io.BytesIO(file_bytes), "image/jpeg")}
    response = client.post("/inspect", files=files)
    assert response.status_code == 200

    data = response.json()
    assert data["status"] == "completed"
    assert data["summary"]["total_detections"] >= 1
    assert len(data["detections"]) >= 1

    det = data["detections"][0]
    assert det["defect_type"] == "star_crack"
    assert 0.0 <= det["confidence"] <= 1.0
    assert det["confidence"] >= 0.50
    assert 0 <= det["x1"] <= det["x2"]
    assert 0 <= det["y1"] <= det["y2"]


def test_inspect_endpoint_alias_consistency() -> None:
    img_bytes = create_test_image_bytes()
    files = {"file": ("cell.jpg", io.BytesIO(img_bytes), "image/jpeg")}
    resp_primary = client.post("/inspect", files=files)
    files = {"file": ("cell.jpg", io.BytesIO(img_bytes), "image/jpeg")}
    resp_alias = client.post("/api/inspections", files=files)

    assert resp_primary.status_code == 200
    assert resp_alias.status_code == 200
    assert resp_alias.json()["model_name"] == resp_primary.json()["model_name"]


# ============================================================================
# 2. Unsupported Media Types & Invalid Files
# ============================================================================

@pytest.mark.parametrize(
    "filename,mime_type,payload",
    [
        ("script.sh", "application/x-sh", b"#!/bin/bash\necho hello"),
        ("document.pdf", "application/pdf", b"%PDF-1.4 header text"),
        ("report.json", "application/json", b'{"key": "value"}'),
        ("readme.txt", "text/plain", b"Simple text contents"),
        ("song.mp3", "audio/mpeg", b"ID3\x03\x00\x00\x00"),
    ],
)
def test_unsupported_media_types_return_415(filename: str, mime_type: str, payload: bytes) -> None:
    files = {"file": (filename, io.BytesIO(payload), mime_type)}
    response = client.post("/inspect", files=files)
    assert response.status_code == 415
    assert "unsupported" in response.json()["detail"].lower()


def test_empty_image_upload_returns_400() -> None:
    files = {"file": ("empty.jpg", io.BytesIO(b""), "image/jpeg")}
    response = client.post("/inspect", files=files)
    assert response.status_code == 400
    assert "empty" in response.json()["detail"].lower()


def test_corrupted_image_bytes_return_400() -> None:
    corrupted_data = b"\xff\xd8\xff\xe0" + b"random_corrupted_binary_garbage_not_an_image" * 20
    files = {"file": ("corrupt.jpg", io.BytesIO(corrupted_data), "image/jpeg")}
    response = client.post("/inspect", files=files)
    assert response.status_code == 400
    assert "not a readable image" in response.json()["detail"].lower()


def test_oversized_payload_rejection() -> None:
    # Test payload size limit (> 50 MB)
    large_payload = b"x" * (50 * 1024 * 1024 + 1024)
    files = {"file": ("giant.jpg", io.BytesIO(large_payload), "image/jpeg")}
    response = client.post("/inspect", files=files)
    assert response.status_code == 413
    assert "exceeds" in response.json()["detail"].lower()


# ============================================================================
# 3. Confidence Parameter Validation
# ============================================================================

@pytest.mark.parametrize("invalid_conf", [-0.5, -0.01, 1.01, 2.0, 100.0])
def test_out_of_range_confidence_returns_422(invalid_conf: float) -> None:
    img_bytes = create_test_image_bytes()
    files = {"file": ("cell.jpg", io.BytesIO(img_bytes), "image/jpeg")}
    response = client.post(f"/inspect?confidence={invalid_conf}", files=files)
    assert response.status_code == 422


def test_non_numeric_confidence_returns_422() -> None:
    img_bytes = create_test_image_bytes()
    files = {"file": ("cell.jpg", io.BytesIO(img_bytes), "image/jpeg")}
    response = client.post("/inspect?confidence=high_confidence", files=files)
    assert response.status_code == 422


@pytest.mark.parametrize("valid_conf", [0.0, 0.05, 0.25, 0.70, 1.0])
def test_valid_confidence_boundaries_accepted(valid_conf: float) -> None:
    img_bytes = create_test_image_bytes()
    files = {"file": ("cell.jpg", io.BytesIO(img_bytes), "image/jpeg")}
    response = client.post(f"/inspect?confidence={valid_conf}", files=files)
    assert response.status_code == 200
    data = response.json()
    assert data["inference_configuration"]["confidence_threshold"] == valid_conf


# ============================================================================
# 4. Error Handling & Backend Failure Resilience
# ============================================================================

def test_inference_service_failure_returns_503() -> None:
    img_bytes = create_test_image_bytes()
    files = {"file": ("cell.jpg", io.BytesIO(img_bytes), "image/jpeg")}

    with patch("backend.app.main.inference_service.predict") as mock_predict:
        mock_predict.side_effect = RuntimeError("CUDA/PyTorch tensor allocation failure")
        response = client.post("/inspect", files=files)
        assert response.status_code == 503
        assert "inference execution failed" in response.json()["detail"].lower()


def test_diagnostic_failure_resilience() -> None:
    img_bytes = create_test_image_bytes()
    files = {"file": ("cell.jpg", io.BytesIO(img_bytes), "image/jpeg")}
    unhandled_client = TestClient(app, raise_server_exceptions=False)

    with patch("backend.app.main.inference_service.diagnostics") as mock_diag:
        mock_diag.side_effect = ValueError("Diagnostic pipeline failed")
        response = unhandled_client.post("/inspect?diagnostic=true", files=files)
        # Unhandled internal exception in diagnostics returns 500 Internal Server Error
        assert response.status_code == 500


# ============================================================================
# 5. Contract Compatibility with Node tRPC Service
# ============================================================================

def test_response_conforms_to_node_service_contract() -> None:
    img_bytes = create_test_image_bytes()
    files = {"file": ("el_cell_sample.jpg", io.BytesIO(img_bytes), "image/jpeg")}
    response = client.post("/inspect", files=files)
    assert response.status_code == 200

    payload = response.json()
    # Verified against InspectionResponse Pydantic schema
    validated = InspectionResponse(**payload)
    assert validated.inspection_id == payload["inspection_id"]

    # Verify keys strictly consumed by server/inspection/service.ts:
    # result.processing_time_ms
    # result.detections -> [{ defect_type, confidence, x1, y1, x2, y2 }]
    # result.annotated_image_data_url
    assert "processing_time_ms" in payload
    assert isinstance(payload["processing_time_ms"], (int, float))
    assert "detections" in payload
    for det in payload["detections"]:
        assert "defect_type" in det
        assert "confidence" in det
        assert "x1" in det
        assert "y1" in det
        assert "x2" in det
        assert "y2" in det
    assert "annotated_image_data_url" in payload
    assert payload["annotated_image_data_url"].startswith("data:image/jpeg;base64,")
