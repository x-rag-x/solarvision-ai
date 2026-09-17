from __future__ import annotations

import base64
import time
from typing import Any

import cv2
import numpy as np

from .config import settings
from .schemas import Detection


class YoloInferenceService:
    def __init__(self) -> None:
        self._model: Any | None = None
        self._load_error: str | None = None

    def load(self) -> None:
        if not settings.model_path.exists():
            raise FileNotFoundError("YOLO model not found. Please place best.pt in the configured model path.")
        try:
            from ultralytics import YOLO

            self._model = YOLO(str(settings.model_path))
            self._load_error = None
        except Exception as exc:  # pragma: no cover - depends on runtime model deps
            self._load_error = str(exc)
            raise RuntimeError(f"Unable to load YOLO model: {exc}") from exc

    @property
    def model(self) -> Any:
        if self._model is None:
            self.load()
        return self._model

    def class_names(self) -> list[str]:
        names = getattr(self.model, "names", {}) or {}
        return [str(names[idx]) for idx in sorted(names)] if isinstance(names, dict) else [str(name) for name in names]

    def model_info(self) -> dict[str, Any]:
        if not settings.model_path.exists():
            return {"status": "model_missing", "model_path": str(settings.model_path), "exists": False, "model_name": "YOLO26n", "class_names": [], "confidence_threshold": settings.confidence_threshold, "iou_threshold": settings.iou_threshold, "image_size": settings.image_size, "independent_metrics_status": "No independent test metrics provided"}
        try:
            return {"status": "ready", "model_path": str(settings.model_path), "exists": True, "model_name": "YOLO26n", "class_names": self.class_names(), "confidence_threshold": settings.confidence_threshold, "iou_threshold": settings.iou_threshold, "image_size": settings.image_size, "independent_metrics_status": "No independent test metrics provided"}
        except Exception as exc:
            return {"status": "load_error", "model_path": str(settings.model_path), "exists": True, "model_name": "YOLO26n", "class_names": [], "confidence_threshold": settings.confidence_threshold, "iou_threshold": settings.iou_threshold, "image_size": settings.image_size, "independent_metrics_status": f"Model load error: {exc}"}

    def _predict_once(self, image: np.ndarray, confidence: float) -> tuple[list[Detection], np.ndarray, float]:
        started = time.perf_counter()
        results = self.model.predict(source=image, conf=confidence, iou=settings.iou_threshold, imgsz=settings.image_size, verbose=False)
        result = results[0]
        names = getattr(result, "names", {}) or {}
        detections: list[Detection] = []
        annotated = image.copy()
        boxes = getattr(result, "boxes", None)
        if boxes is not None:
            xyxy = boxes.xyxy.cpu().numpy() if getattr(boxes, "xyxy", None) is not None else []
            confs = boxes.conf.cpu().numpy() if getattr(boxes, "conf", None) is not None else []
            classes = boxes.cls.cpu().numpy().astype(int) if getattr(boxes, "cls", None) is not None else []
            for box, confidence_value, class_id in zip(xyxy, confs, classes):
                x1, y1, x2, y2 = [float(value) for value in box]
                label = str(names.get(int(class_id), class_id)) if isinstance(names, dict) else str(class_id)
                detections.append(Detection(defect_type=label, confidence=float(confidence_value), x1=x1, y1=y1, x2=x2, y2=y2))
        elapsed_ms = (time.perf_counter() - started) * 1000
        return detections, annotated, elapsed_ms

    @staticmethod
    def _annotate(image: np.ndarray, detections: list[Detection]) -> np.ndarray:
        annotated = image.copy()
        for detection in detections:
            cv2.rectangle(annotated, (int(detection.x1), int(detection.y1)), (int(detection.x2), int(detection.y2)), (0, 212, 180), 2)
            cv2.putText(annotated, f"{detection.defect_type} {detection.confidence:.2f}", (int(detection.x1), max(18, int(detection.y1) - 6)), cv2.FONT_HERSHEY_SIMPLEX, 0.55, (0, 212, 180), 2, cv2.LINE_AA)
        return annotated

    def predict(self, image: np.ndarray, confidence: float | None = None) -> tuple[list[Detection], np.ndarray, float]:
        detections, _, elapsed_ms = self._predict_once(image, settings.confidence_threshold if confidence is None else confidence)
        return detections, self._annotate(image, detections), elapsed_ms

    def diagnostics(self, image: np.ndarray, thresholds: tuple[float, ...] = (0.25, 0.10, 0.05)) -> dict[str, Any]:
        # Ultralytics' public predict() result is already NMS-filtered. The pre-NMS
        # tensor is not exposed by this application path, so it is reported honestly
        # as unavailable rather than being confused with the post-NMS candidate count.
        candidates, _, raw_time = self._predict_once(image, 0.001)
        image_height, image_width = image.shape[:2]
        for candidate in candidates:
            candidate.near_image_boundary = candidate.x1 <= 2 or candidate.y1 <= 2 or candidate.x2 >= image_width - 2 or candidate.y2 >= image_height - 2
        comparison: list[dict[str, Any]] = []
        diagnostic_annotated = image.copy()
        for threshold in thresholds:
            started = time.perf_counter()
            detections = [candidate for candidate in candidates if candidate.confidence >= threshold]
            processing_time_ms = (time.perf_counter() - started) * 1000
            comparison.append({"threshold": threshold, "detection_count": len(detections), "detections": [item.model_dump() for item in detections], "processing_time_ms": round(processing_time_ms, 2)})
            if threshold == min(thresholds):
                diagnostic_annotated = self._annotate(image, detections)
        return {"pre_nms_raw_prediction_count": None, "pre_nms_raw_prediction_status": "Unavailable through the public Ultralytics predict() result used by this service", "nms_filtered_candidate_count": len(candidates), "candidate_confidence": 0.001, "threshold_comparison": comparison, "diagnostic_annotated": diagnostic_annotated, "nms_processing_time_ms": round(raw_time, 2)}


def image_to_data_url(image: np.ndarray) -> str:
    ok, encoded = cv2.imencode(".jpg", image, [int(cv2.IMWRITE_JPEG_QUALITY), 90])
    if not ok:
        raise RuntimeError("Unable to encode annotated inspection image")
    content = base64.b64encode(encoded.tobytes()).decode("ascii")
    return f"data:image/jpeg;base64,{content}"


inference_service = YoloInferenceService()
