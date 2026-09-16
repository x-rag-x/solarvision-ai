from __future__ import annotations

import argparse
import json
from pathlib import Path

import cv2

from .config import settings
from .inference import inference_service, image_to_data_url


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", required=True)
    parser.add_argument("--annotated", required=True)
    parser.add_argument("--json", required=True)
    parser.add_argument("--diagnostic", action="store_true", help="Compare 0.25, 0.10, and 0.05 thresholds for development diagnostics")
    parser.add_argument("--diagnostic-annotated", default=None, help="Optional path for the 0.05 diagnostic annotation")
    args = parser.parse_args()
    image = cv2.imread(args.input)
    if image is None:
        raise RuntimeError("Uploaded file is not a readable image")
    detections, annotated, processing_time_ms = inference_service.predict(image)
    cv2.imwrite(args.annotated, annotated)
    payload: dict[str, object] = {
        "source_filename": Path(args.input).name,
        "image_dimensions": {"width": int(image.shape[1]), "height": int(image.shape[0])},
        "model_path": str(settings.model_path),
        "model_name": "YOLO26n",
        "class_names": inference_service.class_names(),
        "inference_configuration": {"confidence_threshold": settings.confidence_threshold, "iou_threshold": settings.iou_threshold, "image_size": settings.image_size, "preprocessing": "Ultralytics letterbox/normalization via model.predict"},
        "processing_time_ms": round(processing_time_ms, 2),
        "raw_prediction_count": None,
        "detections": [item.model_dump() for item in detections],
        "annotated_image_data_url": image_to_data_url(annotated),
    }
    if args.diagnostic:
        diagnostic = inference_service.diagnostics(image)
        payload["raw_prediction_count"] = diagnostic["raw_prediction_count"]
        payload["raw_prediction_threshold"] = diagnostic["raw_prediction_threshold"]
        payload["threshold_comparison"] = diagnostic["threshold_comparison"]
        if args.diagnostic_annotated:
            cv2.imwrite(args.diagnostic_annotated, diagnostic["diagnostic_annotated"])
            payload["diagnostic_annotated_path"] = args.diagnostic_annotated
    Path(args.json).write_text(json.dumps(payload, indent=2))


if __name__ == "__main__":
    main()
