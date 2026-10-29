"""SolarVision AI — Model 2: ELPV Full-Cell Defectiveness Screening CLI Bridge.

Accepts ONLY a complete cropped single solar EL cell, not a YOLO defect bounding
box or a full module image without a reliable cell crop.
"""
from __future__ import annotations

import argparse
import json
from pathlib import Path
import sys

from .predictor import InvalidCellImage, Model2ScreeningPredictor


def main() -> None:
    parser = argparse.ArgumentParser(
        description="SolarVision AI Model 2 ELPV Single-Cell Screening CLI Bridge"
    )
    parser.add_argument("--input", required=True, help="Path to cropped single solar EL cell image")
    parser.add_argument("--json", required=True, help="Path to output screening result JSON")
    args = parser.parse_args()

    input_path = Path(args.input)
    if not input_path.exists():
        sys.stderr.write(f"Error: Input file does not exist: {args.input}\n")
        sys.exit(1)

    try:
        data = input_path.read_bytes()
        predictor = Model2ScreeningPredictor()
        result = predictor.predict_bytes(data)
    except InvalidCellImage as exc:
        sys.stderr.write(f"Validation error: {exc}\n")
        sys.exit(2)
    except Exception as exc:
        sys.stderr.write(f"Error during Model 2 screening: {exc}\n")
        sys.exit(1)

    json_path = Path(args.json)
    json_path.parent.mkdir(parents=True, exist_ok=True)
    json_path.write_text(json.dumps(result, indent=2))
    sys.exit(0)


if __name__ == "__main__":
    main()
