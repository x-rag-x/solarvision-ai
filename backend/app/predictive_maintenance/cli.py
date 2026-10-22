"""
SolarVision AI — Model 4: Predictive Maintenance
CLI Interface & Subprocess Bridge
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path
import sys

from .feature_extractor import (
    CANONICAL_FEATURE_SPECS,
    CANONICAL_MAINTENANCE_FEATURE_COUNT,
    CANONICAL_MAINTENANCE_FEATURE_NAMES,
)
from .model_loader import Model4Loader
from .schemas import (
    MODEL4_CONTRACT_VERSION,
    Model4Domain,
    PredictiveMaintenanceInput,
)
from .service import PredictiveMaintenanceService, predictive_maintenance_service


def main() -> None:
    parser = argparse.ArgumentParser(description="SolarVision AI Model 4 Predictive Maintenance CLI Bridge")
    parser.add_argument("--input", help="Path to input JSON payload (or '-' for stdin)")
    parser.add_argument("--output", help="Path to write output JSON response (or '-' for stdout)")
    parser.add_argument("--model-path", help="Path to custom model checkpoint file")
    parser.add_argument(
        "--domain",
        default="ai4i_synthetic_benchmark",
        help="Target domain (ai4i_synthetic_benchmark or solar_factory)",
    )
    parser.add_argument("--status-only", action="store_true", help="Print model readiness status and exit")
    parser.add_argument("--metadata-only", action="store_true", help="Print benchmark metadata and exit")
    parser.add_argument("--features-only", action="store_true", help="Print canonical feature specification and exit")
    parser.add_argument("--readiness-only", action="store_true", help="Print domain readiness comparison and exit")

    args = parser.parse_args()

    # Parse domain
    try:
        domain = Model4Domain(args.domain)
    except ValueError:
        domain = Model4Domain.AI4I_SYNTHETIC_BENCHMARK

    # Custom loader setup if path specified
    service = predictive_maintenance_service
    if args.model_path:
        loader = Model4Loader(artifact_path=Path(args.model_path), domain=domain)
        if domain == Model4Domain.SOLAR_FACTORY:
            service = PredictiveMaintenanceService(solar_loader=loader)
        else:
            service = PredictiveMaintenanceService(benchmark_loader=loader)

    active_loader = service.get_loader_for_domain(domain)

    if args.status_only:
        status_info = {
            "modelName": active_loader.manifest.model_name if active_loader.manifest else "SolarVision-PM-Model4",
            "isReady": active_loader.is_ready,
            "modelVersion": active_loader.model_version,
            "domain": active_loader.domain.value,
            "artifactPath": str(active_loader.artifact_path),
            "unavailabilityReason": active_loader.unavailability_reason,
            "expectedDim": active_loader.expected_dim,
            "schemaVersion": MODEL4_CONTRACT_VERSION,
            "isCalibrated": active_loader.is_calibrated,
            "calibrationMethod": active_loader.calibration_method,
            "manifest": active_loader.manifest.model_dump() if active_loader.manifest else None,
            "benchmarkReady": service.benchmark_loader.is_ready,
            "solarReady": service.solar_loader.is_ready,
        }
        print(json.dumps(status_info, indent=2))
        sys.exit(0)

    if args.features_only:
        features_info = {
            "schemaVersion": MODEL4_CONTRACT_VERSION,
            "canonicalFeatureCount": CANONICAL_MAINTENANCE_FEATURE_COUNT,
            "features": [
                {
                    "index": spec.index,
                    "name": spec.name,
                    "unit": spec.unit,
                    "nominal": spec.nominal,
                    "minValid": spec.min_valid,
                    "maxValid": spec.max_valid,
                    "description": spec.description,
                }
                for spec in CANONICAL_FEATURE_SPECS
            ],
        }
        print(json.dumps(features_info, indent=2))
        sys.exit(0)

    if args.metadata_only:
        meta = {
            "modelId": "ai4i-2020-predictive-maintenance-benchmark",
            "modelName": "AI4I 2020 Predictive Maintenance Milling Machine Classifier",
            "domain": Model4Domain.AI4I_SYNTHETIC_BENCHMARK.value,
            "sourceDataset": "UCI Machine Learning Repository AI4I 2020 Predictive Maintenance Dataset",
            "citation": "Mathes, S. (2020). AI4I 2020 Predictive Maintenance Dataset. UCI Machine Learning Repository. DOI: 10.24432/C5HS5C",
            "license": "Creative Commons Attribution 4.0 International (CC BY 4.0)",
            "targetClasses": ["healthy", "failure"],
            "failureModes": [
                {"code": "TWF", "name": "Tool Wear Failure", "description": "Failure induced by wear time exceeding tool life (200-240 min)."},
                {"code": "HDF", "name": "Heat Dissipation Failure", "description": "Failure caused by low thermal gradient (ΔT < 8.6 K) at low spindle speed (< 1380 rpm)."},
                {"code": "PWF", "name": "Power Failure", "description": "Failure caused by drive power outside operating window (< 3500 W or > 9000 W)."},
                {"code": "OSF", "name": "Overstrain Failure", "description": "Failure caused by excessive product of tool wear and torque exceeding strain threshold."},
                {"code": "RNF", "name": "Random Failure", "description": "Uncorrelated random process failure with 0.1% background rate."},
            ],
            "inputFeatureCount": CANONICAL_MAINTENANCE_FEATURE_COUNT,
            "featureNames": CANONICAL_MAINTENANCE_FEATURE_NAMES,
            "isBenchmark": True,
            "isCalibrated": service.benchmark_loader.is_calibrated,
            "calibrationMethod": service.benchmark_loader.calibration_method,
            "calibrationMetrics": service.benchmark_loader.calibration_metrics,
            "limitations": [
                "External synthetic milling machine benchmark (Mathes et al., CC BY 4.0).",
                "Simulated physical process; not verified against crystalline solar cell manufacturing tools.",
                "Strictly segregated from solar factory domain.",
                "Zero synthetic solar factory predictions are returned.",
            ],
        }
        print(json.dumps(meta, indent=2))
        sys.exit(0)

    if args.readiness_only:
        readiness = {
            "contractVersion": MODEL4_CONTRACT_VERSION,
            "ai4iSyntheticBenchmark": {
                "status": "ready" if service.benchmark_loader.is_ready else "not_trained",
                "isOperational": service.benchmark_loader.is_ready,
                "version": service.benchmark_loader.model_version,
                "artifactPresent": service.benchmark_loader.artifact_path.exists(),
                "unavailabilityReason": (
                    service.benchmark_loader.unavailability_reason if not service.benchmark_loader.is_ready else None
                ),
            },
            "solarFactory": {
                "status": "not_trained",
                "isOperational": False,
                "version": "none",
                "artifactPresent": service.solar_loader.artifact_path.exists(),
                "unavailabilityReason": (
                    "Factory model is pending domain adaptation. Crystalline solar fab SCADA maintenance "
                    "telemetry collection is required before training."
                ),
                "quarantined": True,
                "zeroFabricationPledge": True,
            },
        }
        print(json.dumps(readiness, indent=2))
        sys.exit(0)

    # Ingest JSON payload
    raw_text: str
    if not args.input or args.input == "-":
        raw_text = sys.stdin.read()
    else:
        raw_text = Path(args.input).read_text(encoding="utf-8")

    if not raw_text.strip():
        err_response = {
            "contractVersion": MODEL4_CONTRACT_VERSION,
            "status": "error",
            "domain": domain.value,
            "limitations": ["Empty JSON input provided to Model 4 CLI."],
            "processingTimeMs": 0.0,
        }
        print(json.dumps(err_response))
        sys.exit(1)

    try:
        payload_dict = json.loads(raw_text)
        req = PredictiveMaintenanceInput.model_validate(payload_dict)
    except Exception as exc:
        err_response = {
            "contractVersion": MODEL4_CONTRACT_VERSION,
            "status": "error",
            "domain": domain.value,
            "limitations": [f"Failed to parse input payload: {exc}"],
            "processingTimeMs": 0.0,
        }
        print(json.dumps(err_response))
        sys.exit(1)

    response = service.forecast(req)
    result_dict = response.to_shared_dict()

    out_json = json.dumps(result_dict, indent=2)
    if not args.output or args.output == "-":
        print(out_json)
    else:
        Path(args.output).write_text(out_json, encoding="utf-8")


if __name__ == "__main__":
    main()
