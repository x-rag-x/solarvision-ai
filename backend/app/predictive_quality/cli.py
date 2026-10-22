"""
SolarVision AI — Model 3: Predictive Quality Monitoring
CLI Interface & Subprocess Bridge
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path
import sys

from .feature_extractor import (
    CANONICAL_SOLAR_FEATURES,
    CANONICAL_SOLAR_FEATURE_COUNT,
    MODEL3_FEATURE_SCHEMA_VERSION,
)
from .model_loader import Model3Loader
from .schemas import (
    ModelDomain,
    PredictiveQualityInput,
)
from .service import PredictiveQualityService, predictive_quality_service


def main() -> None:
    parser = argparse.ArgumentParser(description="SolarVision AI Model 3 Predictive Quality CLI Bridge")
    parser.add_argument("--input", help="Path to input JSON payload (or '-' for stdin)")
    parser.add_argument("--output", help="Path to write output JSON response (or '-' for stdout)")
    parser.add_argument("--model-path", help="Path to custom model checkpoint file")
    parser.add_argument("--domain", default="solar_cell_manufacturing", help="Target domain (solar_cell_manufacturing or semiconductor_benchmark)")
    parser.add_argument("--status-only", action="store_true", help="Print model readiness status and exit")
    parser.add_argument("--metadata-only", action="store_true", help="Print model metadata and limitations and exit")
    parser.add_argument("--features-only", action="store_true", help="Print canonical feature specification and exit")

    args = parser.parse_args()

    # Domain selection
    try:
        domain = ModelDomain(args.domain)
    except ValueError:
        domain = ModelDomain.SOLAR_CELL_MANUFACTURING

    service = predictive_quality_service
    if args.model_path:
        loader = Model3Loader(artifact_path=Path(args.model_path), domain=domain)
        service = PredictiveQualityService(loader=loader)

    if args.status_only:
        status_info = {
            "modelName": "SolarVision-PQ-Model3",
            "isReady": service.loader.is_ready,
            "modelVersion": service.loader.model_version,
            "domain": domain.value,
            "artifactPath": str(service.loader.artifact_path),
            "unavailabilityReason": service.loader.unavailability_reason,
            "expectedDim": service.loader.expected_dim,
            "schemaVersion": MODEL3_FEATURE_SCHEMA_VERSION,
            "isCalibrated": service.loader.is_calibrated,
            "calibrationMethod": service.loader.calibration_method,
            "manifest": service.loader.manifest.model_dump() if service.loader.manifest else None,
        }
        print(json.dumps(status_info, indent=2))
        sys.exit(0)

    if args.features_only:
        features_info = {
            "schemaVersion": MODEL3_FEATURE_SCHEMA_VERSION,
            "canonicalFeatureCount": CANONICAL_SOLAR_FEATURE_COUNT,
            "features": [
                {
                    "index": f.index,
                    "name": f.name,
                    "unit": f.unit,
                    "nominal": f.nominal,
                    "minValid": f.min_valid,
                    "maxValid": f.max_valid,
                    "description": f.description,
                }
                for f in CANONICAL_SOLAR_FEATURES
            ],
        }
        print(json.dumps(features_info, indent=2))
        sys.exit(0)

    if args.metadata_only:
        if domain == ModelDomain.SEMICONDUCTOR_BENCHMARK:
            meta = {
                "modelId": "secom-semiconductor-benchmark",
                "modelName": "UCI SECOM Yield Benchmark Baseline",
                "domain": ModelDomain.SEMICONDUCTOR_BENCHMARK.value,
                "sourceDataset": "UCI Machine Learning Repository SECOM Dataset",
                "targetClasses": ["pass", "fail"],
                "labelMeaning": "-1: Pass (In-spec yield), +1: Fail (Wafer yield excursion)",
                "expectedDim": 590,
                "evaluationStatus": "benchmark_reference",
                "isBenchmark": True,
                "limitations": [
                    "External semiconductor benchmark; anonymized microelectronics wafer fabrication signals.",
                    "Not calibrated for solar cell manufacturing line equipment.",
                    "Used strictly for comparative algorithmic verification.",
                ],
            }
        else:
            meta = {
                "modelId": "solar-predictive-quality-v1",
                "modelName": "SolarVision PV Wafer Predictive Quality & Yield Forecaster",
                "domain": ModelDomain.SOLAR_CELL_MANUFACTURING.value,
                "sourceDataset": "SolarVision Manufacturing SCADA & Inline Flash Telemetry",
                "targetClasses": ["pass", "warning", "fail"],
                "labelMeaning": "pass: Tier-1 efficiency yield; warning: marginal parameter drift; fail: severe defect/scrap risk",
                "expectedDim": CANONICAL_SOLAR_FEATURE_COUNT,
                "evaluationStatus": "dataset_pending",
                "isBenchmark": False,
                "limitations": [
                    "Requires inline flash-test electrical characterization (Voc, Isc, FF, Rs, Rsh).",
                    "Requires SCADA sensor telemetry from stringer, furnace, and screen printer.",
                    "Production checkpoint training blocked pending real factory yield datasets.",
                ],
            }
        print(json.dumps(meta, indent=2))
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
        input_data = PredictiveQualityInput(**input_dict)
    except Exception as exc:
        sys.stderr.write(f"Input validation error: {exc}\n")
        sys.exit(1)

    # Execute service
    result = service.forecast(input_data)
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
