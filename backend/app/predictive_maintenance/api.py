"""
SolarVision AI — Model 4: Predictive Maintenance
FastAPI Sub-Router with Dedicated Benchmark Prediction Procedures
"""

from __future__ import annotations

from typing import Any, Dict, List, Optional
from fastapi import APIRouter, HTTPException, Query, status
from pydantic import BaseModel, Field

from .feature_extractor import (
    CANONICAL_FEATURE_SPECS,
    CANONICAL_MAINTENANCE_FEATURE_COUNT,
    CANONICAL_MAINTENANCE_FEATURE_NAMES,
)
from .schemas import (
    MODEL4_CONTRACT_VERSION,
    Model4Domain,
    PredictiveMaintenanceInput,
    PredictiveMaintenanceResponse,
)
from .service import predictive_maintenance_service

router = APIRouter(prefix="/predictive-maintenance", tags=["Model 4: Predictive Maintenance"])


class BenchmarkPredictPayload(BaseModel):
    product_type: str = Field(..., description="Product quality type: 'L', 'M', or 'H'")
    air_temperature_k: float = Field(..., description="Air temperature in Kelvin [295, 305]")
    process_temperature_k: float = Field(..., description="Process temperature in Kelvin [305, 315]")
    rotational_speed_rpm: float = Field(..., description="Rotational speed in RPM [1100, 2900]")
    torque_nm: float = Field(..., description="Torque in Nm [3.0, 80.0]")
    tool_wear_min: float = Field(..., description="Tool wear time in minutes [0, 260]")
    machine_id: Optional[str] = Field(default=None, description="Optional machine identifier")
    confidence_threshold: float = Field(default=0.50, ge=0.0, le=1.0, description="Decision threshold")


@router.post(
    "/forecast",
    response_model=None,
    summary="Forecast Machine Health State and Failure Risk",
    description="Evaluates machine operational telemetry and failure risk. Strictly segregates solar factory from AI4I benchmark.",
)
async def forecast_maintenance(payload: PredictiveMaintenanceInput) -> Dict[str, Any]:
    try:
        response: PredictiveMaintenanceResponse = predictive_maintenance_service.forecast(payload)
        return response.to_shared_dict()
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Predictive maintenance forecast service failure: {exc}",
        )


@router.post(
    "/benchmark-predict",
    response_model=None,
    summary="Execute AI4I Benchmark Predictive Maintenance Inference",
    description="Runs inference on 6 AI4I raw physical features using verified benchmark model artifact.",
)
async def benchmark_predict(payload: BenchmarkPredictPayload) -> Dict[str, Any]:
    try:
        req = PredictiveMaintenanceInput(
            machine_id=payload.machine_id,
            domain=Model4Domain.AI4I_SYNTHETIC_BENCHMARK,
            product_type=payload.product_type,
            air_temperature_k=payload.air_temperature_k,
            process_temperature_k=payload.process_temperature_k,
            rotational_speed_rpm=payload.rotational_speed_rpm,
            torque_nm=payload.torque_nm,
            tool_wear_min=payload.tool_wear_min,
            confidence_threshold=payload.confidence_threshold,
        )
        response: PredictiveMaintenanceResponse = predictive_maintenance_service.forecast(req)
        return response.to_shared_dict()
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Benchmark maintenance prediction failed: {exc}",
        )


@router.get(
    "/status",
    summary="Query Model 4 Deployment and Artifact Readiness",
    description="Reports whether a verified Model 4 checkpoint is deployed for benchmark and solar domains.",
)
async def get_model4_status(
    domain: Optional[Model4Domain] = Query(None, description="Optional domain filter"),
) -> Dict[str, Any]:
    benchmark_loader = predictive_maintenance_service.benchmark_loader
    solar_loader = predictive_maintenance_service.solar_loader

    loader = solar_loader if domain == Model4Domain.SOLAR_FACTORY else benchmark_loader

    return {
        "modelName": loader.manifest.model_name if loader.manifest else "SolarVision-PM-Model4",
        "isReady": loader.is_ready,
        "modelVersion": loader.model_version,
        "domain": loader.domain.value,
        "artifactPath": str(loader.artifact_path),
        "unavailabilityReason": loader.unavailability_reason,
        "expectedDim": loader.expected_dim,
        "schemaVersion": MODEL4_CONTRACT_VERSION,
        "isCalibrated": loader.is_calibrated,
        "calibrationMethod": loader.calibration_method,
        "manifest": loader.manifest.model_dump() if loader.manifest else None,
        "benchmarkReady": benchmark_loader.is_ready,
        "solarReady": solar_loader.is_ready,
    }


@router.get(
    "/benchmark-metadata",
    summary="Query AI4I Benchmark Provenance and Metadata",
    description="Returns metadata, academic citation, source dataset license, and physical failure modes for AI4I 2020.",
)
async def get_benchmark_metadata() -> Dict[str, Any]:
    loader = predictive_maintenance_service.benchmark_loader
    return {
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
        "isCalibrated": loader.is_calibrated,
        "calibrationMethod": loader.calibration_method,
        "calibrationMetrics": loader.calibration_metrics,
        "limitations": [
            "External synthetic milling machine benchmark (Mathes et al., CC BY 4.0).",
            "Simulated physical process; not verified against crystalline solar cell manufacturing tools.",
            "Strictly segregated from solar factory domain.",
            "Zero synthetic solar factory predictions are returned.",
        ],
    }


@router.get(
    "/features",
    summary="Query Model 4 Canonical Feature Specification",
    description="Returns the 6 canonical AI4I input features, physical boundaries, and units.",
)
async def get_feature_specification() -> Dict[str, Any]:
    return {
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


@router.get(
    "/readiness",
    summary="Query Model 4 Operational Readiness Summary",
    description="Compares benchmark operational readiness against solar factory domain readiness.",
)
async def get_readiness_summary() -> Dict[str, Any]:
    benchmark_loader = predictive_maintenance_service.benchmark_loader
    solar_loader = predictive_maintenance_service.solar_loader

    return {
        "contractVersion": MODEL4_CONTRACT_VERSION,
        "ai4iSyntheticBenchmark": {
            "status": "ready" if benchmark_loader.is_ready else "not_trained",
            "isOperational": benchmark_loader.is_ready,
            "version": benchmark_loader.model_version,
            "artifactPresent": benchmark_loader.artifact_path.exists(),
            "unavailabilityReason": benchmark_loader.unavailability_reason if not benchmark_loader.is_ready else None,
            "isCalibrated": benchmark_loader.is_calibrated,
            "calibrationMethod": benchmark_loader.calibration_method,
        },
        "solarFactory": {
            "status": "not_trained",
            "isOperational": False,
            "version": "none",
            "artifactPresent": solar_loader.artifact_path.exists(),
            "unavailabilityReason": (
                "Factory model is pending domain adaptation. Crystalline solar fab SCADA maintenance "
                "telemetry collection is required before training."
            ),
            "quarantined": True,
            "zeroFabricationPledge": True,
        },
    }
