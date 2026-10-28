"""
SolarVision AI — Model 3: Sandia Solar Electrical Performance Prediction
CLI Interface & Subprocess Bridge
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path
import sys

from .model_loader import SandiaModelLoader
from .schemas import SandiaPredictionInput
from .service import SandiaPerformanceService, sandia_performance_service


def main() -> None:
    parser = argparse.ArgumentParser(
        description="SolarVision AI Model 3 Sandia Solar Electrical Performance Prediction CLI Bridge"
    )
    parser.add_argument("--input", help="Path to input JSON payload (or '-' for stdin)")
    parser.add_argument("--output", help="Path to write output JSON response (or '-' for stdout)")
    parser.add_argument("--model-path", help="Path to custom scikit-learn .joblib pipeline file")
    parser.add_argument("--schema-path", help="Path to custom feature_schema.json")
    parser.add_argument("--status-only", action="store_true", help="Print model readiness status and exit")
    parser.add_argument("--metadata-only", action="store_true", help="Print model metadata and limitations and exit")
    parser.add_argument("--schema-only", action="store_true", help="Print feature schema specification and exit")

    args = parser.parse_args()

    service = sandia_performance_service
    if args.model_path or args.schema_path:
        loader = SandiaModelLoader(
            artifact_path=args.model_path,
            schema_path=args.schema_path,
        )
        service = SandiaPerformanceService(loader=loader)

    if args.status_only:
        status_info = service.get_status().to_dict()
        sys.stdout.write(json.dumps(status_info, indent=2))
        sys.stdout.write("\n")
        sys.exit(0)

    if args.metadata_only:
        meta_info = service.get_metadata()
        sys.stdout.write(json.dumps(meta_info, indent=2))
        sys.stdout.write("\n")
        sys.exit(0)

    if args.schema_only:
        schema_info = service.get_schema()
        sys.stdout.write(json.dumps(schema_info, indent=2))
        sys.stdout.write("\n")
        sys.exit(0)

    if not args.input:
        parser.print_help()
        sys.exit(1)

    # Read input payload
    if args.input == "-":
        payload_text = sys.stdin.read()
    else:
        payload_text = Path(args.input).read_text(encoding="utf-8")

    try:
        raw_dict = json.loads(payload_text)
        req = SandiaPredictionInput(**raw_dict)
    except Exception as exc:
        sys.stderr.write(f"Invalid input payload: {exc}\n")
        sys.exit(2)

    response = service.predict(req)
    out_json = json.dumps(response.to_dict(), indent=2)

    if args.output and args.output != "-":
        Path(args.output).write_text(out_json, encoding="utf-8")
    else:
        sys.stdout.write(out_json)
        sys.stdout.write("\n")


if __name__ == "__main__":
    main()
