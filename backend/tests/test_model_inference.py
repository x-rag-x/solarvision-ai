from __future__ import annotations

from pathlib import Path
import cv2
import numpy as np
import pytest

from backend.app.inference import inference_service


@pytest.fixture
def sample_storage_image() -> Path | None:
    storage = Path("backend/storage")
    candidates = list(storage.glob("*-input.jpeg")) + list(storage.glob("*-input.jpg"))
    return candidates[0] if candidates else None


def test_model_runs_on_storage_images(sample_storage_image: Path | None) -> None:
    if not sample_storage_image:
        pytest.skip("No storage sample images available in backend/storage")

    detections, annotated, elapsed_ms = inference_service.predict(sample_storage_image, confidence=0.25)
    assert isinstance(detections, list)
    assert isinstance(annotated, np.ndarray)
    assert elapsed_ms > 0

    img = cv2.imread(str(sample_storage_image))
    assert annotated.shape[:2] == img.shape[:2]

    # Verify all bounding boxes are within bounds
    h, w = img.shape[:2]
    for d in detections:
        assert 0.0 <= d.x1 <= d.x2 <= float(w)
        assert 0.0 <= d.y1 <= d.y2 <= float(h)
        assert 0.0 <= d.confidence <= 1.0
        assert d.defect_type in inference_service.class_names()


def test_model_on_defect_free_negative_sample() -> None:
    # Uniform dark gray solar cell without defects
    defect_free = np.full((640, 640, 3), 40, dtype=np.uint8)
    detections, annotated, elapsed_ms = inference_service.predict(defect_free, confidence=0.25)

    assert len(detections) == 0
    assert annotated.shape == (640, 640, 3)
    assert elapsed_ms > 0


def test_model_multidimension_handling() -> None:
    for shape in [(320, 320), (640, 640), (480, 800), (960, 540)]:
        h, w = shape
        test_img = np.full((h, w, 3), 50, dtype=np.uint8)
        # Add a simulated line anomaly
        cv2.line(test_img, (w // 4, h // 4), (3 * w // 4, 3 * h // 4), (200, 200, 200), 2)

        detections, annotated, elapsed_ms = inference_service.predict(test_img, confidence=0.01)
        assert annotated.shape == (h, w, 3)
        assert elapsed_ms > 0
        for d in detections:
            assert 0.0 <= d.x1 <= d.x2 <= float(w)
            assert 0.0 <= d.y1 <= d.y2 <= float(h)


def test_diagnostics_monotonic_threshold_counts(sample_storage_image: Path | None) -> None:
    if not sample_storage_image:
        test_img = np.full((640, 640, 3), 60, dtype=np.uint8)
        cv2.circle(test_img, (320, 320), 40, (230, 230, 230), -1)
    else:
        test_img = sample_storage_image

    diag = inference_service.diagnostics(test_img, thresholds=(0.25, 0.10, 0.05, 0.01))
    comparison = diag["threshold_comparison"]

    counts = [item["detection_count"] for item in comparison]
    # Counts should be non-decreasing as threshold decreases:
    # count(0.25) <= count(0.10) <= count(0.05) <= count(0.01)
    assert counts[0] <= counts[1] <= counts[2] <= counts[3]
    assert diag["nms_filtered_candidate_count"] >= counts[3]
