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
    args = parser.parse_args()
    image = cv2.imread(args.input)
    if image is None:
        raise RuntimeError("Uploaded file is not a readable image")
    detections, annotated, processing_time_ms = inference_service.predict(image)
    cv2.imwrite(args.annotated, annotated)
    Path(args.json).write_text(json.dumps({
        "processing_time_ms": round(processing_time_ms, 2),
        "detections": [item.model_dump() for item in detections],
        "annotated_image_data_url": image_to_data_url(annotated),
    }))


if __name__ == "__main__":
    main()
