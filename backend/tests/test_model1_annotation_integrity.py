"""
SolarVision AI — Python Model 1 Annotation & Demonstration Images Integrity Test
"""

from pathlib import Path
import cv2
import numpy as np
import pytest

from backend.app.inference import inference_service, load_image_safely


SAMPLE_DIR = Path("client/public/samples")


@pytest.fixture(scope="module")
def loaded_service():
    inference_service.load()
    return inference_service


def test_source_demonstration_images_are_clean_and_unannotated():
    """Verify that demonstration images in client/public/samples are clean grayscale frames with no pre-baked color boxes."""
    sample_files = list(SAMPLE_DIR.glob("*.jpg"))
    assert len(sample_files) >= 4, f"Expected at least 4 sample images in {SAMPLE_DIR}"

    for sample_path in sample_files:
        img = cv2.imread(str(sample_path))
        assert img is not None, f"Failed to load image: {sample_path}"
        assert img.shape[0] >= 512 and img.shape[1] >= 512, f"Unexpected dimensions {img.shape} for {sample_path.name}"

        # Grayscale verification: B, G, R channels are identical
        diff_bg = np.abs(img[:, :, 0].astype(int) - img[:, :, 1].astype(int))
        diff_gr = np.abs(img[:, :, 1].astype(int) - img[:, :, 2].astype(int))
        assert diff_bg.max() == 0, f"{sample_path.name} is not pure grayscale (B!=G)"
        assert diff_gr.max() == 0, f"{sample_path.name} is not pure grayscale (G!=R)"


def test_sample1_microcrack_prediction_count(loaded_service):
    """Sample 1 returns exactly 1 defect above default 0.25 threshold."""
    img_path = SAMPLE_DIR / "sample-el-cell-1.jpg"
    img = load_image_safely(img_path)
    dets, _ = loaded_service._predict_once(img, confidence=0.25)

    assert len(dets) == 1, f"Expected exactly 1 detection on sample-1, got {len(dets)}"
    assert dets[0].defect_type == "star_crack"
    assert dets[0].confidence >= 0.60
    assert 0 <= dets[0].x1 < dets[0].x2 <= img.shape[1]
    assert 0 <= dets[0].y1 < dets[0].y2 <= img.shape[0]


def test_sample2_segmented_crack_prediction_count(loaded_service):
    """Sample 2 returns exactly 2 collinear crack defects above default 0.25 threshold."""
    img_path = SAMPLE_DIR / "sample-el-cell-2.jpg"
    img = load_image_safely(img_path)
    dets, _ = loaded_service._predict_once(img, confidence=0.25)

    assert len(dets) == 2, f"Expected exactly 2 detections on sample-2, got {len(dets)}"
    for d in dets:
        assert d.defect_type == "crack"
        assert d.confidence >= 0.25


def test_sample3_single_crack_prediction_count(loaded_service):
    """Sample 3 returns exactly 1 isolated crack defect above default 0.25 threshold."""
    img_path = SAMPLE_DIR / "sample-el-cell-3.jpg"
    img = load_image_safely(img_path)
    dets, _ = loaded_service._predict_once(img, confidence=0.25)

    assert len(dets) == 1, f"Expected exactly 1 detection on sample-3, got {len(dets)}"
    assert dets[0].defect_type == "crack"
    assert dets[0].confidence >= 0.80


def test_sample_multi_prediction_count(loaded_service):
    """Sample Multi returns exactly 5 defects above default 0.25 threshold."""
    img_path = SAMPLE_DIR / "sample-el-cell-multi.jpg"
    img = load_image_safely(img_path)
    dets, _ = loaded_service._predict_once(img, confidence=0.25)

    assert len(dets) == 5, f"Expected exactly 5 detections on sample-multi, got {len(dets)}"
    defect_types = {d.defect_type for d in dets}
    assert "crack" in defect_types
    assert "finger" in defect_types


def test_backend_annotate_preserves_dimensions_and_adds_boxes(loaded_service):
    """Verify backend _annotate function produces an annotated image matching original dimensions."""
    img_path = SAMPLE_DIR / "sample-el-cell-3.jpg"
    img = load_image_safely(img_path)
    dets, _ = loaded_service._predict_once(img, confidence=0.25)

    annotated = loaded_service._annotate(img, dets)
    assert annotated.shape == img.shape
    # Ensure annotated image now contains non-grayscale color (the (0, 212, 180) BGR box)
    diff = np.abs(annotated[:, :, 0].astype(int) - annotated[:, :, 1].astype(int))
    assert diff.max() > 50, "Annotated image expected to have color annotations drawn"
