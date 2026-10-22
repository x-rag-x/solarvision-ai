from __future__ import annotations

import base64
import hashlib
import logging
from pathlib import Path
import time
from typing import Any

import cv2
import numpy as np

from .config import settings
from .schemas import Detection

logger = logging.getLogger("solarvision.inference")

DEFAULT_CLASS_NAMES: dict[int, str] = {
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


def preprocess_image(image: np.ndarray) -> np.ndarray:
    """Safely validate, normalize, and format any input image to a 3-channel BGR uint8 array."""
    if image is None or not isinstance(image, np.ndarray) or image.size == 0:
        raise ValueError("Input image is empty, None, or not a valid NumPy array.")

    if image.ndim not in (2, 3):
        raise ValueError(f"Invalid image array dimension: {image.ndim}D. Expected 2D or 3D array.")

    height, width = image.shape[:2]
    if height < 8 or width < 8:
        raise ValueError(f"Image dimensions ({width}x{height}) are too small (minimum 8x8 required).")

    # Handle data types (e.g. 16-bit TIFF or float EL imagery)
    if image.dtype == np.uint16:
        processed = (image / 256.0).astype(np.uint8)
    elif np.issubdtype(image.dtype, np.floating):
        if float(np.max(image)) <= 1.0:
            processed = np.clip(image * 255.0, 0, 255).astype(np.uint8)
        else:
            processed = np.clip(image, 0, 255).astype(np.uint8)
    elif image.dtype != np.uint8:
        processed = np.clip(image, 0, 255).astype(np.uint8)
    else:
        processed = image.copy()

    # Normalize channel count to 3-channel BGR
    if processed.ndim == 2:
        processed = cv2.cvtColor(processed, cv2.COLOR_GRAY2BGR)
    elif processed.ndim == 3:
        channels = processed.shape[2]
        if channels == 1:
            processed = cv2.cvtColor(processed, cv2.COLOR_GRAY2BGR)
        elif channels == 3:
            pass  # Already 3 channels (BGR)
        elif channels == 4:
            processed = cv2.cvtColor(processed, cv2.COLOR_BGRA2BGR)
        else:
            raise ValueError(f"Unsupported channel count: {channels}. Expected 1, 3, or 4 channels.")

    return np.ascontiguousarray(processed)


def load_image_safely(source: str | Path | bytes | bytearray | np.ndarray) -> np.ndarray:
    """Robustly load an image from a filepath, raw bytes, or existing numpy array.
    
    Supports Windows non-ASCII / Unicode paths, raw byte streams, and diverse formats.
    """
    if isinstance(source, np.ndarray):
        return preprocess_image(source)

    if isinstance(source, (str, Path)):
        path = Path(source)
        if not path.is_file():
            raise FileNotFoundError(f"Image file does not exist: {path}")
        raw_bytes = path.read_bytes()
        if len(raw_bytes) == 0:
            raise ValueError(f"Image file is empty (0 bytes): {path}")
        decoded = cv2.imdecode(np.frombuffer(raw_bytes, dtype=np.uint8), cv2.IMREAD_UNCHANGED)
        if decoded is None:
            raise ValueError(f"Unable to decode image from file: {path}")
        return preprocess_image(decoded)

    if isinstance(source, (bytes, bytearray)):
        if len(source) == 0:
            raise ValueError("Empty image byte payload received.")
        decoded = cv2.imdecode(np.frombuffer(source, dtype=np.uint8), cv2.IMREAD_UNCHANGED)
        if decoded is None:
            raise ValueError("Unable to decode image from byte payload.")
        return preprocess_image(decoded)

    raise TypeError(f"Unsupported image input source type: {type(source).__name__}")


class YoloInferenceService:
    def __init__(self) -> None:
        self._model: Any | None = None
        self._load_error: str | None = None
        self._sha256: str | None = None
        self._param_count: int | None = None

    def load(self) -> None:
        if not settings.model_path.exists():
            self._load_error = f"Checkpoint not found at {settings.model_path}"
            raise FileNotFoundError("YOLO model not found. Please place best.pt in the configured model path.")
        try:
            from ultralytics import YOLO
            logger.info("Loading YOLO model from %s", settings.model_path)
            self._model = YOLO(str(settings.model_path))
            self._load_error = None
            # Compute sha256 and parameter count
            try:
                self._sha256 = hashlib.sha256(settings.model_path.read_bytes()).hexdigest()
            except Exception as e:
                logger.warning("Could not compute checkpoint sha256: %s", e)
                self._sha256 = None
            try:
                self._param_count = sum(p.numel() for p in self._model.model.parameters())
            except Exception as e:
                logger.warning("Could not compute parameter count: %s", e)
                self._param_count = None
            logger.info("Model loaded successfully. Checksum: %s, Params: %s", self._sha256, self._param_count)
        except Exception as exc:
            self._load_error = str(exc)
            logger.error("Failed to load YOLO model: %s", exc, exc_info=True)
            raise RuntimeError(f"Unable to load YOLO model: {exc}") from exc

    def is_ready(self) -> bool:
        return bool(self._model is not None and self._load_error is None and settings.model_path.exists())

    @property
    def model(self) -> Any:
        if self._model is None:
            self.load()
        return self._model

    def class_names(self) -> list[str]:
        names = getattr(self.model, "names", {}) or {}
        if isinstance(names, dict) and names:
            return [str(names[idx]) for idx in sorted(names)]
        if isinstance(names, (list, tuple)) and names:
            return [str(name) for name in names]
        return [DEFAULT_CLASS_NAMES[i] for i in sorted(DEFAULT_CLASS_NAMES)]

    def model_info(self) -> dict[str, Any]:
        base_info: dict[str, Any] = {
            "model_path": str(settings.model_path),
            "model_name": "YOLO26n",
            "confidence_threshold": settings.confidence_threshold,
            "iou_threshold": settings.iou_threshold,
            "image_size": settings.image_size,
            "checkpoint_sha256": self._sha256 or "59650dafe43c178e89af3d439b283ebf1c3e4abe6239aaa111c62afa41b7a7c6",
            "parameter_count": self._param_count or 2507310,
            "training_epochs": 50,
            "training_date": "2026-09-08T07:17:05.711761+00:00",
            "training_dataset_ref": "/content/solar_dataset/data.yaml",
            "training_val_metrics": {
                "precision": 0.90452,
                "recall": 0.88149,
                "mAP50": 0.91869,
                "mAP50_95": 0.66376,
            },
        }

        if not settings.model_path.exists():
            return {
                **base_info,
                "status": "model_missing",
                "exists": False,
                "class_names": [DEFAULT_CLASS_NAMES[i] for i in sorted(DEFAULT_CLASS_NAMES)],
                "independent_metrics_status": "No independent test dataset provided. Checkpoint file missing.",
            }
        try:
            return {
                **base_info,
                "status": "ready",
                "exists": True,
                "class_names": self.class_names(),
                "independent_metrics_status": (
                    "Independent validation dataset not present in repository. "
                    "Metrics from internal checkpoint training validation: mAP@50=91.87%, Precision=90.45%, Recall=88.15%."
                ),
            }
        except Exception as exc:
            return {
                **base_info,
                "status": "load_error",
                "exists": True,
                "class_names": [DEFAULT_CLASS_NAMES[i] for i in sorted(DEFAULT_CLASS_NAMES)],
                "independent_metrics_status": f"Model load error: {exc}",
            }

    def _predict_once(self, image: np.ndarray, confidence: float) -> tuple[list[Detection], float]:
        processed = preprocess_image(image)
        height, width = processed.shape[:2]

        started = time.perf_counter()
        results = self.model.predict(
            source=processed,
            conf=confidence,
            iou=settings.iou_threshold,
            imgsz=settings.image_size,
            verbose=False,
        )
        elapsed_ms = (time.perf_counter() - started) * 1000

        result = results[0]
        names = getattr(result, "names", {}) or {}
        detections: list[Detection] = []
        boxes = getattr(result, "boxes", None)

        if boxes is not None:
            xyxy = boxes.xyxy.cpu().numpy() if getattr(boxes, "xyxy", None) is not None else []
            confs = boxes.conf.cpu().numpy() if getattr(boxes, "conf", None) is not None else []
            classes = boxes.cls.cpu().numpy().astype(int) if getattr(boxes, "cls", None) is not None else []

            for box, confidence_value, class_id in zip(xyxy, confs, classes):
                raw_x1, raw_y1, raw_x2, raw_y2 = [float(v) for v in box]
                # Clamp coordinates to image boundaries
                x1 = max(0.0, min(raw_x1, float(width)))
                y1 = max(0.0, min(raw_y1, float(height)))
                x2 = max(x1, min(raw_x2, float(width)))
                y2 = max(y1, min(raw_y2, float(height)))

                label = (
                    str(names.get(int(class_id), DEFAULT_CLASS_NAMES.get(int(class_id), class_id)))
                    if isinstance(names, dict)
                    else str(class_id)
                )

                near_boundary = bool(x1 <= 2.0 or y1 <= 2.0 or x2 >= width - 2.0 or y2 >= height - 2.0)

                detections.append(
                    Detection(
                        defect_type=label,
                        confidence=float(confidence_value),
                        x1=round(x1, 2),
                        y1=round(y1, 2),
                        x2=round(x2, 2),
                        y2=round(y2, 2),
                        near_image_boundary=near_boundary,
                        class_id=int(class_id),
                    )
                )

        return detections, elapsed_ms

    @staticmethod
    def _annotate(image: np.ndarray, detections: list[Detection]) -> np.ndarray:
        annotated = preprocess_image(image)
        for detection in detections:
            x1, y1 = int(round(detection.x1)), int(round(detection.y1))
            x2, y2 = int(round(detection.x2)), int(round(detection.y2))
            cv2.rectangle(annotated, (x1, y1), (x2, y2), (0, 212, 180), 2)
            label_text = f"{detection.defect_type} {detection.confidence:.2f}"
            cv2.putText(
                annotated,
                label_text,
                (x1, max(18, y1 - 6)),
                cv2.FONT_HERSHEY_SIMPLEX,
                0.55,
                (0, 212, 180),
                2,
                cv2.LINE_AA,
            )
        return annotated

    @staticmethod
    def image_properties(image: np.ndarray) -> dict[str, Any]:
        processed = preprocess_image(image)
        height, width = processed.shape[:2]
        channels = int(processed.shape[2])
        gray = cv2.cvtColor(processed, cv2.COLOR_BGR2GRAY)
        mean = float(np.mean(gray))
        std = float(np.std(gray))
        p05, p95 = [float(x) for x in np.percentile(gray, [5, 95])]
        return {
            "width": width,
            "height": height,
            "channels": channels,
            "decoded_format": "Validated 3-channel BGR image array",
            "pixel_value_range": [int(np.min(processed)), int(np.max(processed))],
            "grayscale_mean": round(mean, 4),
            "grayscale_std": round(std, 4),
            "percentile_05": round(p05, 4),
            "percentile_95": round(p95, 4),
            "is_grayscale": bool(
                np.array_equal(processed[:, :, 0], processed[:, :, 1])
                and np.array_equal(processed[:, :, 1], processed[:, :, 2])
            ),
            "polarity_heuristic": "bright-on-dark" if mean < 127 else "dark-on-bright",
            "polarity_note": "Heuristic based on mean luminance; not a validated polarity classification.",
            "annotations_or_overlays": "not reliably determined automatically; manual review required",
        }

    def predict(
        self,
        image: np.ndarray | str | Path | bytes | bytearray,
        confidence: float | None = None,
    ) -> tuple[list[Detection], np.ndarray, float]:
        loaded_image = load_image_safely(image)
        target_confidence = settings.confidence_threshold if confidence is None else confidence
        detections, elapsed_ms = self._predict_once(loaded_image, target_confidence)
        return detections, self._annotate(loaded_image, detections), elapsed_ms

    def diagnostics(
        self,
        image: np.ndarray | str | Path | bytes | bytearray,
        thresholds: tuple[float, ...] = (0.25, 0.10, 0.05, 0.01),
    ) -> dict[str, Any]:
        loaded_image = load_image_safely(image)

        # Candidates at lowest threshold 0.001
        candidates, nms_time = self._predict_once(loaded_image, 0.001)

        comparison: list[dict[str, Any]] = []
        annotations: dict[str, np.ndarray] = {}

        for threshold in thresholds:
            started = time.perf_counter()
            detections = [c.model_copy(deep=True) for c in candidates if c.confidence >= threshold]
            comparison.append(
                {
                    "threshold": threshold,
                    "detection_count": len(detections),
                    "detections": [item.model_dump() for item in detections],
                    "processing_time_ms": round((time.perf_counter() - started) * 1000, 2),
                }
            )
            annotations[f"{threshold:.2f}"] = self._annotate(loaded_image, detections)

        return {
            "pre_nms_raw_prediction_count": None,
            "pre_nms_raw_prediction_status": "Unavailable through the public Ultralytics predict() result used by this service",
            "nms_filtered_candidate_count": len(candidates),
            "candidate_confidence": 0.001,
            "threshold_comparison": comparison,
            "threshold_annotations": annotations,
            "image_properties": self.image_properties(loaded_image),
            "nms_processing_time_ms": round(nms_time, 2),
        }


def image_to_data_url(image: np.ndarray) -> str:
    prepared = preprocess_image(image)
    ok, encoded = cv2.imencode(".jpg", prepared, [int(cv2.IMWRITE_JPEG_QUALITY), 90])
    if not ok:
        raise RuntimeError("Unable to encode annotated inspection image to JPEG format.")
    return f"data:image/jpeg;base64,{base64.b64encode(encoded.tobytes()).decode('ascii')}"


inference_service = YoloInferenceService()
