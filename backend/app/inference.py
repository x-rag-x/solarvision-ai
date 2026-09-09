from __future__ import annotations

import base64
import time
from pathlib import Path
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
            raise FileNotFoundError(
                "YOLO model not found. Please place best.pt in the configured model path."
            )
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

    def model_info(self) -> dict[str, Any]:
        if not settings.model_path.exists():
            return {
                "status": "model_missing",
                "model_path": str(settings.model_path),
                "exists": False,
                "model_name": "YOLO26n",
                "class_names": [],
                "independent_metrics_status": "No independent test metrics provided",
            }
        try:
            model = self.model
            names = getattr(model, "names", {}) or {}
            class_names = [str(names[idx]) for idx in sorted(names)] if isinstance(names, dict) else [str(name) for name in names]
            return {
                "status": "ready",
                "model_path": str(settings.model_path),
                "exists": True,
                "model_name": "YOLO26n",
                "class_names": class_names,
                "independent_metrics_status": "No independent test metrics provided",
            }
        except Exception as exc:
            return {
                "status": "load_error",
                "model_path": str(settings.model_path),
                "exists": True,
                "model_name": "YOLO26n",
                "class_names": [],
                "independent_metrics_status": f"Model load error: {exc}",
            }

    def predict(self, image: np.ndarray) -> tuple[list[Detection], np.ndarray, float]:
        started = time.perf_counter()
        results = self.model.predict(
            source=image,
            conf=settings.confidence_threshold,
            imgsz=settings.image_size,
            verbose=False,
        )
        result = results[0]
        names = getattr(result, "names", {}) or {}
        detections: list[Detection] = []
        annotated = image.copy()
        boxes = getattr(result, "boxes", None)
        if boxes is not None:
            xyxy = boxes.xyxy.cpu().numpy() if getattr(boxes, "xyxy", None) is not None else []
            confs = boxes.conf.cpu().numpy() if getattr(boxes, "conf", None) is not None else []
            classes = boxes.cls.cpu().numpy().astype(int) if getattr(boxes, "cls", None) is not None else []
            for box, confidence, class_id in zip(xyxy, confs, classes):
                x1, y1, x2, y2 = [float(value) for value in box]
                label = str(names.get(int(class_id), class_id)) if isinstance(names, dict) else str(class_id)
                detections.append(
                    Detection(
                        defect_type=label,
                        confidence=float(confidence),
                        x1=x1,
                        y1=y1,
                        x2=x2,
                        y2=y2,
                    )
                )
                cv2.rectangle(annotated, (int(x1), int(y1)), (int(x2), int(y2)), (0, 212, 180), 2)
                cv2.putText(
                    annotated,
                    f"{label} {float(confidence):.2f}",
                    (int(x1), max(18, int(y1) - 6)),
                    cv2.FONT_HERSHEY_SIMPLEX,
                    0.55,
                    (0, 212, 180),
                    2,
                    cv2.LINE_AA,
                )
        elapsed_ms = (time.perf_counter() - started) * 1000
        return detections, annotated, elapsed_ms


def image_to_data_url(image: np.ndarray) -> str:
    ok, encoded = cv2.imencode(".jpg", image, [int(cv2.IMWRITE_JPEG_QUALITY), 90])
    if not ok:
        raise RuntimeError("Unable to encode annotated inspection image")
    content = base64.b64encode(encoded.tobytes()).decode("ascii")
    return f"data:image/jpeg;base64,{content}"


inference_service = YoloInferenceService()
