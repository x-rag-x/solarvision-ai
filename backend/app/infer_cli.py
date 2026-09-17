from __future__ import annotations

import argparse
import json
from pathlib import Path

import cv2

from .config import settings
from .inference import inference_service, image_to_data_url


THRESHOLDS = (0.25, 0.10, 0.05, 0.01)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", required=True)
    parser.add_argument("--annotated", required=True)
    parser.add_argument("--json", required=True)
    parser.add_argument("--diagnostic", action="store_true", help="Compare 0.25, 0.10, 0.05, and 0.01 thresholds for development diagnostics")
    parser.add_argument("--diagnostic-dir", default=None, help="Directory for per-threshold diagnostic annotated images")
    parser.add_argument("--diagnostic-annotated", default=None, help="Backward-compatible path for the lowest-threshold diagnostic annotation")
    args = parser.parse_args()
    image = cv2.imread(args.input)
    if image is None:
        raise RuntimeError("Uploaded file is not a readable image")
    detections, annotated, processing_time_ms = inference_service.predict(image)
    cv2.imwrite(args.annotated, annotated)
    payload: dict[str, object] = {
        "source_filename": Path(args.input).name,
        "image_dimensions": {"width": int(image.shape[1]), "height": int(image.shape[0])},
        "image_properties": inference_service.image_properties(image),
        "model_path": str(settings.model_path),
        "model_name": "YOLO26n",
        "class_names": inference_service.class_names(),
        "inference_configuration": {"confidence_threshold": settings.confidence_threshold, "iou_threshold": settings.iou_threshold, "image_size": settings.image_size, "preprocessing": "Ultralytics letterbox/normalization via model.predict"},
        "processing_time_ms": round(processing_time_ms, 2),
        "pre_nms_raw_prediction_count": None,
        "detections": [item.model_dump() for item in detections],
        "annotated_image_data_url": image_to_data_url(annotated),
        "annotated_image_path": str(Path(args.annotated).resolve()),
    }
    if args.diagnostic:
        diagnostic = inference_service.diagnostics(image, THRESHOLDS)
        payload["pre_nms_raw_prediction_count"] = diagnostic["pre_nms_raw_prediction_count"]
        payload["pre_nms_raw_prediction_status"] = diagnostic["pre_nms_raw_prediction_status"]
        payload["nms_filtered_candidate_count"] = diagnostic["nms_filtered_candidate_count"]
        payload["candidate_confidence"] = diagnostic["candidate_confidence"]
        payload["image_properties"] = diagnostic["image_properties"]
        payload["threshold_comparison"] = diagnostic["threshold_comparison"]
        output_paths: dict[str, str] = {}
        if args.diagnostic_dir:
            directory = Path(args.diagnostic_dir)
            directory.mkdir(parents=True, exist_ok=True)
            for key, diagnostic_image in diagnostic["threshold_annotations"].items():
                output = directory / f"annotated-conf-{key}.jpg"
                cv2.imwrite(str(output), diagnostic_image)
                output_paths[key] = str(output.resolve())
        if args.diagnostic_annotated:
            lowest_key = f"{min(THRESHOLDS):.2f}"
            cv2.imwrite(args.diagnostic_annotated, diagnostic["threshold_annotations"][lowest_key])
            output_paths[lowest_key] = str(Path(args.diagnostic_annotated).resolve())
        payload["diagnostic_annotated_paths"] = output_paths
    Path(args.json).write_text(json.dumps(payload, indent=2))


if __name__ == "__main__":
    main()
