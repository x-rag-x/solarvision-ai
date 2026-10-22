from __future__ import annotations

import base64
from pathlib import Path
import tempfile
import cv2
import numpy as np
import pytest

from backend.app.inference import (
    DEFAULT_CLASS_NAMES,
    image_to_data_url,
    load_image_safely,
    preprocess_image,
    inference_service,
)
from backend.app.schemas import Detection


def test_default_class_names() -> None:
    expected = {
        0: "crack",
        1: "finger",
        2: "black_core",
        3: "thick_line",
        4: "star_crack",
        5: "horizontal_dislocation",
        6: "vertical_dislocation",
        7: "printing_error",
        8: "short_circuit",
    }
    assert DEFAULT_CLASS_NAMES == expected
    assert len(DEFAULT_CLASS_NAMES) == 9


def test_service_class_names() -> None:
    names = inference_service.class_names()
    assert len(names) == 9
    assert names == [DEFAULT_CLASS_NAMES[i] for i in range(9)]


def test_preprocess_image_valid_bgr() -> None:
    img = np.zeros((100, 100, 3), dtype=np.uint8)
    processed = preprocess_image(img)
    assert processed.shape == (100, 100, 3)
    assert processed.dtype == np.uint8


def test_preprocess_image_2d_grayscale() -> None:
    gray = np.full((120, 120), 128, dtype=np.uint8)
    processed = preprocess_image(gray)
    assert processed.shape == (120, 120, 3)
    assert processed.dtype == np.uint8
    # B, G, R channels should be equal
    assert np.array_equal(processed[:, :, 0], processed[:, :, 1])
    assert np.array_equal(processed[:, :, 1], processed[:, :, 2])


def test_preprocess_image_single_channel_3d() -> None:
    img_1c = np.full((50, 50, 1), 75, dtype=np.uint8)
    processed = preprocess_image(img_1c)
    assert processed.shape == (50, 50, 3)
    assert processed.dtype == np.uint8


def test_preprocess_image_4channel_bgra() -> None:
    bgra = np.full((80, 80, 4), 200, dtype=np.uint8)
    processed = preprocess_image(bgra)
    assert processed.shape == (80, 80, 3)
    assert processed.dtype == np.uint8


def test_preprocess_image_uint16() -> None:
    u16 = np.full((64, 64), 32768, dtype=np.uint16)
    processed = preprocess_image(u16)
    assert processed.shape == (64, 64, 3)
    assert processed.dtype == np.uint8
    assert processed[0, 0, 0] == 128  # 32768 / 256 = 128


def test_preprocess_image_float_normalized() -> None:
    flt_norm = np.full((40, 40, 3), 0.5, dtype=np.float32)
    processed = preprocess_image(flt_norm)
    assert processed.shape == (40, 40, 3)
    assert processed.dtype == np.uint8
    assert processed[0, 0, 0] == 127 or processed[0, 0, 0] == 128


def test_preprocess_image_float_unnormalized() -> None:
    flt_raw = np.full((40, 40, 3), 150.0, dtype=np.float32)
    processed = preprocess_image(flt_raw)
    assert processed.shape == (40, 40, 3)
    assert processed.dtype == np.uint8
    assert processed[0, 0, 0] == 150


def test_preprocess_image_invalid_inputs() -> None:
    with pytest.raises(ValueError, match="empty, None"):
        preprocess_image(None)  # type: ignore

    with pytest.raises(ValueError, match="empty, None"):
        preprocess_image(np.array([], dtype=np.uint8))

    with pytest.raises(ValueError, match="dimension"):
        preprocess_image(np.zeros((10,), dtype=np.uint8))

    with pytest.raises(ValueError, match="dimension"):
        preprocess_image(np.zeros((10, 10, 3, 3), dtype=np.uint8))

    with pytest.raises(ValueError, match="too small"):
        preprocess_image(np.zeros((5, 5, 3), dtype=np.uint8))

    with pytest.raises(ValueError, match="Unsupported channel count"):
        preprocess_image(np.zeros((20, 20, 5), dtype=np.uint8))


def test_load_image_safely_from_bytes() -> None:
    img = np.full((50, 50, 3), 100, dtype=np.uint8)
    ok, buf = cv2.imencode(".jpg", img)
    assert ok
    raw_bytes = buf.tobytes()

    loaded = load_image_safely(raw_bytes)
    assert loaded.shape == (50, 50, 3)
    assert loaded.dtype == np.uint8


def test_load_image_safely_from_file() -> None:
    img = np.full((60, 60, 3), 180, dtype=np.uint8)
    with tempfile.NamedTemporaryFile(suffix=".png", delete=False) as tmp:
        tmp_path = Path(tmp.name)
    try:
        cv2.imwrite(str(tmp_path), img)
        loaded = load_image_safely(tmp_path)
        assert loaded.shape == (60, 60, 3)
    finally:
        if tmp_path.exists():
            tmp_path.unlink()


def test_load_image_safely_errors() -> None:
    with pytest.raises(ValueError, match="Empty image byte payload"):
        load_image_safely(b"")

    with pytest.raises(ValueError, match="Unable to decode image from byte payload"):
        load_image_safely(b"not an image file content")

    with pytest.raises(FileNotFoundError):
        load_image_safely(Path("non_existent_image_path_12345.jpg"))

    with pytest.raises(TypeError, match="Unsupported image input source type"):
        load_image_safely(12345)  # type: ignore


def test_image_properties() -> None:
    img = np.zeros((100, 100, 3), dtype=np.uint8)
    props = inference_service.image_properties(img)
    assert props["width"] == 100
    assert props["height"] == 100
    assert props["channels"] == 3
    assert props["is_grayscale"] is True
    assert props["polarity_heuristic"] == "bright-on-dark"


def test_image_to_data_url() -> None:
    img = np.zeros((50, 50, 3), dtype=np.uint8)
    data_url = image_to_data_url(img)
    assert data_url.startswith("data:image/jpeg;base64,")
    encoded = data_url.split(",", 1)[1]
    decoded = base64.b64decode(encoded)
    assert len(decoded) > 0


def test_detection_schema() -> None:
    d = Detection(
        defect_type="crack",
        confidence=0.88,
        x1=10.5,
        y1=20.0,
        x2=55.0,
        y2=80.2,
        near_image_boundary=False,
    )
    assert d.defect_type == "crack"
    assert d.confidence == 0.88
    assert d.x1 == 10.5
    assert d.near_image_boundary is False
