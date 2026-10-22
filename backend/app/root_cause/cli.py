"""
SolarVision AI — Model 2: Manufacturing Root Cause Analysis
CLI Interface & Bridge
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path
import sys

from .model_loader import Model2Loader
from .schemas import RootCauseAnalysisInput
from .service import RootCauseService, root_cause_service


def main() -> None:
    parser = argparse.ArgumentParser(description="SolarVision AI Model 2 Root Cause CLI Bridge")
    parser.add_argument("--input", help="Path to input JSON payload (or '-' for stdin)")
    parser.add_argument("--output", help="Path to write output JSON response (or '-' for stdout)")
    parser.add_argument("--model-path", help="Path to custom model checkpoint file")
    parser.add_argument("--status-only", action="store_true", help="Print model readiness status and exit")

    args = parser.parse_args()

    service = root_cause_service
    if args.model_path:
        loader = Model2Loader(artifact_path=Path(args.model_path))
        service = RootCauseService(loader=loader)

    if args.status_only:
        status_info = {
            "model_name": "SolarVision-RC-Model2",
            "is_ready": service.loader.is_ready,
            "model_version": service.loader.model_version,
            "artifact_path": str(service.loader.artifact_path),
            "unavailability_reason": service.loader.unavailability_reason,
        }
        print(json.dumps(status_info, indent=2))
        sys.exit(0)

    if not args.input:
        sys.stderr.write("Error: --input argument is required (use '-' for stdin or path to JSON file).\n")
        sys.exit(1)

    # Read input payload
    try:
        if args.input == "-":
            raw_text = sys.stdin.read()
        else:
            with open(args.input, "r", encoding="utf-8") as f:
                raw_text = f.read()
        input_dict = json.loads(raw_text)
    except Exception as exc:
        sys.stderr.write(f"Error reading input payload: {exc}\n")
        sys.exit(1)

    # Validate schema
    try:
        input_data = RootCauseAnalysisInput(**input_dict)
    except Exception as exc:
        sys.stderr.write(f"Input validation error: {exc}\n")
        sys.exit(1)

    # Execute service
    result = service.analyze(input_data)
    shared_dict = result.to_shared_dict()
    output_json = json.dumps(shared_dict, indent=2)

    # Write output
    if args.output and args.output != "-":
        out_p = Path(args.output)
        out_p.parent.mkdir(parents=True, exist_ok=True)
        with open(out_p, "w", encoding="utf-8") as f:
            f.write(output_json)
    else:
        print(output_json)


if __name__ == "__main__":
    main()
