from __future__ import annotations

import argparse
import json
from pathlib import Path
import sys

import cv2

from .config import settings
from .inference import inference_service, image_to_data_url, load_image_safely

THRESHOLDS = (0.25, 0.10, 0.05, 0.01)


def main() -> None:
    parser = argparse.ArgumentParser(description="SolarVision AI YOLO26n CLI Inference Bridge")
    parser.add_argument("--input", required=True, help="Path to input EL/NIR solar cell image")
    parser.add_argument("--annotated", required=True, help="Path to save annotated output image")
    parser.add_argument("--json", required=True, help="Path to save detection result JSON")
    parser.add_argument("--confidence", type=float, default=None, help="Confidence threshold (defaults to settings: 0.25)")
    parser.add_argument("--image-size", "--imgsz", type=int, default=None, help="Inference image resolution (defaults to settings: 640)")
    parser.add_argument(
        "--diagnostic",
        action="store_true",
        help="Compare 0.25, 0.10, 0.05, and 0.01 thresholds for development diagnostics",
    )
    parser.add_argument(
        "--diagnostic-dir",
        default=None,
        help="Directory for per-threshold diagnostic annotated images",
    )
    parser.add_argument(
        "--diagnostic-annotated",
        default=None,
        help="Backward-compatible path for the lowest-threshold diagnostic annotation",
    )
    args = parser.parse_args()

    input_path = Path(args.input)
    if not input_path.exists():
        sys.stderr.write(f"Error: Input file does not exist: {args.input}\n")
        sys.exit(1)

    if args.confidence is not None:
        if not (0.0 <= args.confidence <= 1.0):
            sys.stderr.write(f"Error: Invalid confidence threshold {args.confidence}. Must be between 0.0 and 1.0.\n")
            sys.exit(1)

    if args.image_size is not None:
        if not (32 <= args.image_size <= 4096):
            sys.stderr.write(f"Error: Invalid image size {args.image_size}. Must be between 32 and 4096.\n")
            sys.exit(1)

    try:
        image = load_image_safely(input_path)
    except Exception as exc:
        sys.stderr.write(f"Error decoding image '{args.input}': {exc}\n")
        sys.exit(1)

    conf = args.confidence if args.confidence is not None else settings.confidence_threshold
    imgsz = args.image_size if args.image_size is not None else settings.image_size
    try:
        detections, annotated, processing_time_ms = inference_service.predict(
            image, confidence=conf, image_size=imgsz
        )
    except Exception as exc:
        sys.stderr.write(f"Error during inference execution: {exc}\n")
        sys.exit(1)

    annotated_path = Path(args.annotated)
    annotated_path.parent.mkdir(parents=True, exist_ok=True)
    cv2.imwrite(str(annotated_path), annotated)

    payload: dict[str, object] = {
        "source_filename": input_path.name,
        "image_dimensions": {"width": int(image.shape[1]), "height": int(image.shape[0])},
        "image_properties": inference_service.image_properties(image),
        "model_path": str(settings.model_path),
        "model_name": "YOLO26n",
        "class_names": inference_service.class_names(),
        "inference_configuration": {
            "confidence_threshold": conf,
            "iou_threshold": settings.iou_threshold,
            "image_size": imgsz,
            "preprocessing": "Ultralytics letterbox/normalization via model.predict",
        },
        "processing_time_ms": round(processing_time_ms, 2),
        "pre_nms_raw_prediction_count": None,
        "detections": [item.model_dump() for item in detections],
        "annotated_image_data_url": image_to_data_url(annotated),
        "annotated_image_path": str(annotated_path.resolve()),
    }

    if args.diagnostic:
        diagnostic = inference_service.diagnostics(image, THRESHOLDS, image_size=imgsz)
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
            diag_ann_path = Path(args.diagnostic_annotated)
            diag_ann_path.parent.mkdir(parents=True, exist_ok=True)
            cv2.imwrite(str(diag_ann_path), diagnostic["threshold_annotations"][lowest_key])
            output_paths[lowest_key] = str(diag_ann_path.resolve())

        payload["diagnostic_annotated_paths"] = output_paths

    json_path = Path(args.json)
    json_path.parent.mkdir(parents=True, exist_ok=True)
    json_path.write_text(json.dumps(payload, indent=2), encoding="utf-8")


if __name__ == "__main__":
    main()
