import asyncio
import io
import time
import cv2
import numpy as np
import pytest
import httpx
from httpx import ASGITransport

from backend.app.main import app
from backend.app.inference import inference_service
from backend.app.schemas import Detection


def create_dummy_jpeg() -> bytes:
    """Generate a minimal valid 100x100 3-channel JPEG byte buffer."""
    img = np.zeros((100, 100, 3), dtype=np.uint8)
    cv2.rectangle(img, (20, 20), (80, 80), (255, 255, 255), -1)
    ok, buf = cv2.imencode(".jpg", img)
    assert ok, "Failed to encode dummy image"
    return buf.tobytes()


@pytest.mark.anyio
async def test_health_remains_responsive_during_slow_inference(monkeypatch):
    """
    Regression Test (Task 8):
    Confirms that while a slow or long-running YOLO inference is executing in Starlette's
    threadpool, /health and /health/ready continue to respond promptly on the main event loop
    without blocking or timing out.
    """
    jpeg_bytes = create_dummy_jpeg()
    monkeypatch.setattr(inference_service, "is_ready", lambda: True)

    inference_executed = False

    def deliberately_slow_predict(image, confidence=None, image_size=None):
        nonlocal inference_executed
        inference_executed = True
        # Simulate heavy CPU-bound forward pass running for 1.2 seconds in worker thread
        time.sleep(1.2)
        dummy_dets = [
            Detection(
                defect_type="crack",
                confidence=0.92,
                x1=25.0,
                y1=25.0,
                x2=75.0,
                y2=75.0,
                class_id=0,
                near_image_boundary=False,
            )
        ]
        return dummy_dets, np.zeros((100, 100, 3), dtype=np.uint8), 1200.0

    monkeypatch.setattr(inference_service, "predict", deliberately_slow_predict)

    async with httpx.AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as client:
        # 1. Launch slow inspection asynchronously
        inspection_task = asyncio.create_task(
            client.post(
                "/api/inspections",
                files={"file": ("test_cell.jpg", jpeg_bytes, "image/jpeg")},
                params={"confidence": 0.25},
            )
        )

        # 2. Wait briefly to ensure inspection is actively running inside worker thread
        await asyncio.sleep(0.15)
        assert not inspection_task.done(), "Inspection finished prematurely"

        # 3. Probe /health while inference is in flight
        t_health_0 = time.perf_counter()
        health_resp = await client.get("/health")
        health_elapsed_s = time.perf_counter() - t_health_0

        assert health_resp.status_code == 200
        health_data = health_resp.json()
        assert health_data["status"] == "ok"
        # Crucial assertion: /health responded rapidly (<0.35s) instead of waiting for 1.2s inference
        assert health_elapsed_s < 0.35, f"/health was blocked! Took {health_elapsed_s:.3f}s"

        # 4. Probe /health/ready while inference is in flight
        t_ready_0 = time.perf_counter()
        ready_resp = await client.get("/health/ready")
        ready_elapsed_s = time.perf_counter() - t_ready_0

        assert ready_resp.status_code == 200
        ready_data = ready_resp.json()
        assert ready_data["status"] == "ready"
        assert ready_elapsed_s < 0.35, f"/health/ready was blocked! Took {ready_elapsed_s:.3f}s"

        # 5. Await the slow inspection to complete
        inspection_response = await inspection_task
        assert inspection_response.status_code == 200
        result_json = inspection_response.json()
        assert result_json["status"] == "completed"
        assert len(result_json["detections"]) == 1
        assert result_json["detections"][0]["defect_type"] == "crack"
        assert inference_executed is True


@pytest.mark.anyio
async def test_concurrent_inferences_are_serialized_by_semaphore(monkeypatch):
    """
    Regression Test (Task 4):
    Confirms that concurrent inspection requests are bounded by the concurrency semaphore,
    ensuring at most 1 heavy YOLO inference executes simultaneously on CPU/RAM.
    """
    jpeg_bytes = create_dummy_jpeg()
    monkeypatch.setattr(inference_service, "is_ready", lambda: True)

    active_inferences = 0
    max_concurrent_inferences = 0

    def tracked_predict(image, confidence=None, image_size=None):
        nonlocal active_inferences, max_concurrent_inferences
        active_inferences += 1
        max_concurrent_inferences = max(max_concurrent_inferences, active_inferences)
        time.sleep(0.4)
        active_inferences -= 1
        return [], np.zeros((100, 100, 3), dtype=np.uint8), 400.0

    monkeypatch.setattr(inference_service, "predict", tracked_predict)

    async with httpx.AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as client:
        # Launch two inspections at the same moment
        task1 = asyncio.create_task(
            client.post(
                "/api/inspections",
                files={"file": ("cell1.jpg", jpeg_bytes, "image/jpeg")},
            )
        )
        task2 = asyncio.create_task(
            client.post(
                "/api/inspections",
                files={"file": ("cell2.jpg", jpeg_bytes, "image/jpeg")},
            )
        )

        resp1, resp2 = await asyncio.gather(task1, task2)
        assert resp1.status_code == 200
        assert resp2.status_code == 200
        # Verify semaphore strictly serialized execution: peak concurrent inferences was exactly 1
        assert max_concurrent_inferences == 1, (
            f"Expected max concurrent inferences to be 1, but observed {max_concurrent_inferences}"
        )
