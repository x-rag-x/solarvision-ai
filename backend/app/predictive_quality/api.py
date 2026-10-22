"""
SolarVision AI — Model 3: Predictive Quality Monitoring
FastAPI Sub-Router with Dedicated Benchmark Prediction Procedures
"""

from __future__ import annotations

from typing import Any, Dict, List, Optional
from fastapi import APIRouter, HTTPException, Query, status
from pydantic import BaseModel, Field

from .feature_extractor import (
    CANONICAL_SOLAR_FEATURES,
    CANONICAL_SOLAR_FEATURE_COUNT,
    MODEL3_FEATURE_SCHEMA_VERSION,
)
from .model_loader import SECOM_RAW_FEATURE_COUNT
from .schemas import (
    ModelDomain,
    PredictiveQualityInput,
    PredictiveQualityResponse,
)
from .service import predictive_quality_service

router = APIRouter(prefix="/predictive-quality", tags=["Model 3: Predictive Quality Monitoring"])


class BenchmarkPredictPayload(BaseModel):
    features: List[float] = Field(..., description="590 raw SECOM sensor features")
    batch_id: Optional[str] = Field(default=None, description="Optional batch or wafer identifier")


@router.post(
    "/forecast",
    response_model=None,
    summary="Forecast Quality Tier Outcome and Yield Risk",
    description="Classifies expected batch/wafer quality outcome using manufacturing telemetry.",
)
async def forecast_quality(payload: PredictiveQualityInput) -> Dict[str, Any]:
    try:
        response: PredictiveQualityResponse = predictive_quality_service.forecast(payload)
        return response.to_shared_dict()
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Predictive quality forecast service failure: {exc}",
        )


@router.post(
    "/benchmark-predict",
    response_model=None,
    summary="Execute Semiconductor Benchmark Inference",
    description="Runs inference on 590 SECOM signals using the trained GradientBoostedQualityClassifier.",
)
async def benchmark_predict(payload: BenchmarkPredictPayload) -> Dict[str, Any]:
    if len(payload.features) != SECOM_RAW_FEATURE_COUNT:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=(
                f"SECOM benchmark requires exactly {SECOM_RAW_FEATURE_COUNT} input features, "
                f"received {len(payload.features)}."
            ),
        )
    try:
        response: PredictiveQualityResponse = predictive_quality_service.benchmark_predict(
            feature_vector=payload.features,
            batch_id=payload.batch_id,
        )
        return response.to_shared_dict()
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Benchmark prediction failed: {exc}",
        )


@router.get(
    "/status",
    summary="Query Model 3 Deployment and Artifact Readiness",
    description="Reports whether a verified Model 3 checkpoint is deployed for solar and semiconductor benchmark domains.",
)
async def get_model3_status(
    domain: Optional[ModelDomain] = Query(None, description="Optional domain filter"),
) -> Dict[str, Any]:
    solar_loader = predictive_quality_service.solar_loader
    benchmark_loader = predictive_quality_service.benchmark_loader

    if domain == ModelDomain.SEMICONDUCTOR_BENCHMARK:
        loader = benchmark_loader
    else:
        loader = solar_loader

    return {
        "modelName": loader.manifest.model_name if loader.manifest else "SolarVision-PQ-Model3",
        "isReady": loader.is_ready,
        "modelVersion": loader.model_version,
        "domain": loader.domain.value,
        "artifactPath": str(loader.artifact_path),
        "unavailabilityReason": loader.unavailability_reason,
        "expectedDim": loader.expected_dim,
        "schemaVersion": MODEL3_FEATURE_SCHEMA_VERSION,
        "isCalibrated": loader.is_calibrated,
        "calibrationMethod": loader.calibration_method,
        "optimalThreshold": loader.optimal_threshold,
        "manifest": loader.manifest.model_dump() if loader.manifest else None,
        "benchmarkReady": benchmark_loader.is_ready,
        "solarReady": solar_loader.is_ready,
    }


@router.get(
    "/benchmark-metadata",
    summary="Get Detailed UCI SECOM Benchmark Provenance & Metrics",
    description="Returns benchmark evaluation metrics, optimal threshold, ECE, Brier score, and disclaimer.",
)
async def get_benchmark_metadata() -> Dict[str, Any]:
    loader = predictive_quality_service.benchmark_loader
    manifest = loader.manifest

    return {
        "benchmarkName": "UCI SECOM Semiconductor Yield Benchmark",
        "datasetName": "UCI Machine Learning Repository SECOM Dataset",
        "doi": "10.24432/C57G69",
        "license": "Creative Commons Attribution 4.0 International (CC-BY 4.0)",
        "domain": ModelDomain.SEMICONDUCTOR_BENCHMARK.value,
        "targetClasses": ["pass", "fail"],
        "labelMeaning": "0 (Pass): In-spec semiconductor yield, 1 (Fail): Excursion / scrap",
        "inputFeatureCount": SECOM_RAW_FEATURE_COUNT,
        "retainedFeatureCount": 444,
        "transformedFeatureCount": 744,
        "optimalThreshold": loader.optimal_threshold,
        "calibrationMetrics": loader.calibration_metrics,
        "isReady": loader.is_ready,
        "sha256": manifest.sha256 if manifest else None,
        "disclaimer": (
            "GENERAL SEMICONDUCTOR QUALITY BENCHMARK (UCI SECOM). "
            "NOT A SOLAR-CELL FACTORY VALIDATION. "
            "Benchmark predictions are distinct from solar cell manufacturing models and not intended for PV fab control."
        ),
    }


@router.get(
    "/features",
    summary="Get Canonical 32-Dimensional Solar Quality Feature Specification",
    description="Returns ordered feature definitions, valid ranges, and nominal baselines.",
)
async def get_features() -> Dict[str, Any]:
    return {
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


@router.get(
    "/metadata",
    summary="Get Model 3 Source Provenance, Benchmark Differentiation, and Limitations",
    description="Details source datasets, label meaning, and semiconductor benchmark disclaimers.",
)
async def get_metadata(
    domain: ModelDomain = Query(ModelDomain.SOLAR_CELL_MANUFACTURING, description="Target domain"),
) -> Dict[str, Any]:
    if domain == ModelDomain.SEMICONDUCTOR_BENCHMARK:
        return await get_benchmark_metadata()

    return {
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
