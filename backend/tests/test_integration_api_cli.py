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

from backend.app.main import app
from backend.app.config import settings

client = TestClient(app)


def create_sample_image(color: int = 128) -> bytes:
    img = np.full((128, 128, 3), color, dtype=np.uint8)
    ok, buf = cv2.imencode(".jpg", img)
    assert ok
    return buf.tobytes()


def test_api_health() -> None:
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"
    assert data["model_exists"] is True
    assert data["storage_available"] is True

    # Test alias /api/health
    resp_alias = client.get("/api/health")
    assert resp_alias.status_code == 200
    assert resp_alias.json()["status"] == "ok"


def test_api_model_info() -> None:
    response = client.get("/model")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ready"
    assert data["exists"] is True
    assert data["model_name"] == "YOLO26n"
    assert len(data["class_names"]) == 9
    assert data["checkpoint_sha256"] == "59650dafe43c178e89af3d439b283ebf1c3e4abe6239aaa111c62afa41b7a7c6"
    assert data["parameter_count"] == 2507310
    assert data["confidence_threshold"] == 0.25
    assert data["iou_threshold"] == 0.70
    assert data["image_size"] == 640


def test_api_inspect_valid_image() -> None:
    img_bytes = create_sample_image(128)
    files = {"file": ("test_cell.jpg", io.BytesIO(img_bytes), "image/jpeg")}
    response = client.post("/inspect", files=files)
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "completed"
    assert data["source_filename"] == "test_cell.jpg"
    assert data["model_name"] == "YOLO26n"
    assert isinstance(data["processing_time_ms"], (int, float))
    assert "summary" in data
    assert "total_detections" in data["summary"]
    assert isinstance(data["detections"], list)
    assert data["annotated_image_data_url"].startswith("data:image/jpeg;base64,")
    assert data["annotated_image_url"] is not None


def test_api_inspect_with_confidence_override() -> None:
    img_bytes = create_sample_image(128)
    files = {"file": ("test_cell.jpg", io.BytesIO(img_bytes), "image/jpeg")}
    response = client.post("/inspect?confidence=0.10", files=files)
    assert response.status_code == 200
    data = response.json()
    assert data["inference_configuration"]["confidence_threshold"] == 0.10


def test_api_inspect_with_diagnostics() -> None:
    img_bytes = create_sample_image(128)
    files = {"file": ("test_cell.jpg", io.BytesIO(img_bytes), "image/jpeg")}
    response = client.post("/inspect?diagnostic=true", files=files)
    assert response.status_code == 200
    data = response.json()
    assert data["diagnostics"] is not None
    assert len(data["diagnostics"]["threshold_comparison"]) == 4
    thresholds = [t["threshold"] for t in data["diagnostics"]["threshold_comparison"]]
    assert thresholds == [0.25, 0.10, 0.05, 0.01]


def test_api_inspect_empty_file_fails() -> None:
    files = {"file": ("empty.jpg", io.BytesIO(b""), "image/jpeg")}
    response = client.post("/inspect", files=files)
    assert response.status_code == 400
    assert "empty" in response.json()["detail"].lower()


def test_api_inspect_invalid_media_type_fails() -> None:
    files = {"file": ("text.txt", io.BytesIO(b"Hello world"), "text/plain")}
    response = client.post("/inspect", files=files)
    assert response.status_code == 415


def test_cli_execution_and_prediction_agreement() -> None:
    # Pick a real sample image from backend/storage if available, else generate one
    storage_dir = Path("backend/storage")
    sample_images = list(storage_dir.glob("*-input.jpeg")) + list(storage_dir.glob("*-input.jpg"))
    if sample_images:
        test_img_path = sample_images[0]
    else:
        test_img_path = Path(tempfile.mktemp(suffix=".jpg"))
        cv2.imwrite(str(test_img_path), np.full((256, 256, 3), 100, dtype=np.uint8))

    with tempfile.TemporaryDirectory() as tmp_dir:
        tmp = Path(tmp_dir)
        ann_out = tmp / "annotated.jpg"
        json_out = tmp / "result.json"

        # 1. Run CLI
        cmd = [
            sys.executable,
            "-m",
            "backend.app.infer_cli",
            "--input",
            str(test_img_path),
            "--annotated",
            str(ann_out),
            "--json",
            str(json_out),
            "--confidence",
            "0.25",
        ]
        proc = subprocess.run(cmd, capture_output=True, text=True)
        assert proc.returncode == 0, f"CLI stderr: {proc.stderr}"
        assert ann_out.exists()
        assert json_out.exists()

        cli_result = json.loads(json_out.read_text(encoding="utf-8"))
        assert "detections" in cli_result
        assert cli_result["model_name"] == "YOLO26n"

        # 2. Run API on same image
        with open(test_img_path, "rb") as f:
            files = {"file": (test_img_path.name, f, "image/jpeg")}
            api_resp = client.post("/inspect?confidence=0.25", files=files)
        assert api_resp.status_code == 200
        api_result = api_resp.json()

        # 3. Verify agreement
        assert len(cli_result["detections"]) == len(api_result["detections"])
        for cli_det, api_det in zip(cli_result["detections"], api_result["detections"]):
            assert cli_det["defect_type"] == api_det["defect_type"]
            assert abs(cli_det["confidence"] - api_det["confidence"]) < 1e-4
            assert abs(cli_det["x1"] - api_det["x1"]) < 1e-2
            assert abs(cli_det["y1"] - api_det["y1"]) < 1e-2
            assert abs(cli_det["x2"] - api_det["x2"]) < 1e-2
            assert abs(cli_det["y2"] - api_det["y2"]) < 1e-2
