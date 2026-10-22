"""
SolarVision AI — Model 2: Manufacturing Root Cause Analysis
FastAPI Router Submodule (Isolated & Ready for Mounting)
"""

from __future__ import annotations

from typing import Any
from fastapi import APIRouter, HTTPException, Query, status

from .schemas import (
    RootCauseAnalysisInput,
    RootCauseAnalysisResponse,
)
from .service import root_cause_service
from backend.root_cause_data.feature_spec import (
    CANONICAL_FEATURES_V2,
    CANONICAL_FEATURE_NAMES_V2,
    CANONICAL_FEATURE_COUNT_V2,
    FEATURE_SCHEMA_VERSION,
    RECONCILED_ROOT_CAUSE_CATALOG,
)

router = APIRouter(prefix="/root-cause", tags=["Model 2: Root Cause Analysis"])


@router.post(
    "/analyze",
    response_model=None,
    summary="Execute Model 2 Manufacturing Root Cause Analysis",
    description="Correlates Model 1 defect detections with batch, machine, sensor telemetry, and production events.",
)
async def analyze_root_cause(payload: RootCauseAnalysisInput) -> dict[str, Any]:
    try:
        response: RootCauseAnalysisResponse = root_cause_service.analyze(payload)
        return response.to_shared_dict()
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Root cause service execution failure: {exc}",
        )


@router.get(
    "/status",
    summary="Get Model 2 Readiness & Artifact Status",
    description="Reports whether a verified Model 2 checkpoint is loaded, version info, and training readiness.",
)
async def get_model_status() -> dict[str, Any]:
    loader = root_cause_service.loader
    return {
        "model_name": "SolarVision-RC-Model2",
        "is_ready": loader.is_ready,
        "model_version": loader.model_version,
        "artifact_path": str(loader.artifact_path),
        "manifest": loader.manifest.model_dump() if loader.manifest else None,
        "unavailability_reason": loader.unavailability_reason,
        "expected_dim": loader.expected_dim,
        "schema_version": loader.schema_version,
        "is_calibrated": loader.is_calibrated,
        "calibration_method": loader.calibration_method,
    }


@router.get(
    "/readiness",
    summary="Get Comprehensive Model 2 Training & Dataset Readiness Report",
    description="Provides forensic readiness metrics, schema version, dataset status, and blocking reasons.",
)
async def get_model_readiness() -> dict[str, Any]:
    loader = root_cause_service.loader
    return {
        "model_id": "model-2-root-cause",
        "schema_version": FEATURE_SCHEMA_VERSION,
        "canonical_feature_count": CANONICAL_FEATURE_COUNT_V2,
        "dataset_status": "DATASET_BLOCKED",
        "is_ready": loader.is_ready,
        "model_version": loader.model_version,
        "blocking_reasons": [
            "Production database currently contains 0 linked historical sensor telemetry streams.",
            "Zero confirmed factory failure analysis root-cause ground truth annotations exist in production.",
            "Active artifact is designated as 'validation_prototype' and cannot be deployed to production under zero-fabrication rules.",
        ],
        "prerequisites_to_production": [
            "Import manufacturing batch records via CSV import template or MES connector.",
            "Stream sensor telemetry into sensor_measurements database table.",
            "Quality engineers provide confirmed root-cause labels in root_cause_annotations.",
            "Execute Agent 3 supervised training pipeline on verified non-synthetic data.",
        ],
    }


@router.get(
    "/canonical-contract",
    summary="Get Unified Schema Version 2.0.0 Input Feature Specification",
    description="Returns the exact 48-feature ordered specification with data types, units, and missing value policies.",
)
async def get_canonical_contract() -> dict[str, Any]:
    return {
        "schema_version": FEATURE_SCHEMA_VERSION,
        "feature_count": CANONICAL_FEATURE_COUNT_V2,
        "features": [f.to_dict() for f in CANONICAL_FEATURES_V2],
        "taxonomy": {
            k: {
                "cause_code": v.cause_code,
                "label": v.display_label,
                "equipment": v.responsible_equipment,
                "description": v.description,
                "recommended_action": v.recommended_action,
            }
            for k, v in RECONCILED_ROOT_CAUSE_CATALOG.items()
        },
    }


@router.get(
    "/features",
    summary="Get Model 2 Input Feature Registry",
    description="Lists all normalized feature dimensions expected by the Model 2 architecture.",
)
async def get_feature_registry() -> dict[str, Any]:
    extractor = root_cause_service.extractor
    return {
        "total_serving_dimensions": len(extractor.feature_names),
        "serving_feature_names": extractor.feature_names,
        "canonical_v2_dimensions": CANONICAL_FEATURE_COUNT_V2,
        "canonical_v2_names": list(CANONICAL_FEATURE_NAMES_V2),
        "schema_version": FEATURE_SCHEMA_VERSION,
    }
