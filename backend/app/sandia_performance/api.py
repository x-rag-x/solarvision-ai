"""
SolarVision AI — Model 3: Sandia Solar Electrical Performance Prediction
FastAPI Sub-Router with Dedicated Sandia Inference Procedures
"""

from __future__ import annotations

import logging
from typing import Any, Dict
from fastapi import APIRouter, HTTPException, status

from .schemas import (
    MAX_BATCH_SIZE,
    SandiaBatchPredictionInput,
    SandiaModelStatus,
    SandiaPredictionInput,
    SandiaPredictionResponse,
)
from .service import sandia_performance_service

logger = logging.getLogger("solarvision.sandia_performance.api")

router = APIRouter(prefix="/sandia-performance", tags=["Model 3: Sandia Solar Electrical Performance"])


@router.get(
    "/status",
    summary="Query Sandia Performance Model Status & Artifact Readiness",
    description="Reports whether the trained scikit-learn .joblib pipeline and trainer schemas are deployed and ready.",
)
async def get_sandia_status() -> Dict[str, Any]:
    return sandia_performance_service.get_status().to_dict()


@router.post(
    "/predict",
    summary="Execute Sandia Solar Electrical Performance Inference",
    description="Predicts electrical performance parameters using the scikit-learn pipeline and trainer feature schema.",
)
async def predict_sandia_performance(payload: SandiaPredictionInput) -> Dict[str, Any]:
    loader = sandia_performance_service.loader
    if not loader.is_ready:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=loader.unavailability_reason,
        )

    response: SandiaPredictionResponse = sandia_performance_service.predict(payload)
    if response.status == SandiaModelStatus.VALIDATION_ERROR:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="; ".join(response.limitations),
        )
    if response.status == SandiaModelStatus.ERROR:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Inference execution encountered an internal error.",
        )

    return response.to_dict()


@router.post(
    "/predict-batch",
    summary="Execute Batch Sandia Electrical Performance Inference",
    description="Runs inference across multiple sets of PV module operating conditions in a single batch request.",
)
async def predict_batch_sandia_performance(payload: SandiaBatchPredictionInput) -> Dict[str, Any]:
    if len(payload.items) > MAX_BATCH_SIZE:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Batch size {len(payload.items)} exceeds maximum limit of {MAX_BATCH_SIZE} items.",
        )

    loader = sandia_performance_service.loader
    if not loader.is_ready:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=loader.unavailability_reason,
        )

    response = sandia_performance_service.predict_batch(payload)
    if response.status == SandiaModelStatus.VALIDATION_ERROR:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="; ".join(response.limitations),
        )
    if response.status == SandiaModelStatus.ERROR:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Batch inference execution encountered an internal error.",
        )

    return response.to_dict()


@router.get(
    "/schema",
    summary="Get Trainer Feature Schema Specification",
    description="Returns the feature schema provided by the trainer, or handoff pending status if awaiting training completion.",
)
async def get_sandia_schema() -> Dict[str, Any]:
    return sandia_performance_service.get_schema()


@router.get(
    "/sample-input",
    summary="Get Sample Input Conforming to Trainer Schema",
    description="Returns sample input JSON provided by the trainer or sample baseline template.",
)
async def get_sandia_sample_input() -> Dict[str, Any]:
    return sandia_performance_service.get_sample_input()


@router.get(
    "/target-definition",
    summary="Get Target Variable Definition",
    description="Returns target name, units, and description dynamically loaded from target_definition.json.",
)
async def get_sandia_target_definition() -> Dict[str, Any]:
    return sandia_performance_service.get_target_definition()


@router.get(
    "/metadata",
    summary="Get Sandia Model Provenance & Architecture Metadata",
    description="Returns framework details, Sandia dataset attribution, operational limits, and zero-fabrication guarantees.",
)
async def get_sandia_metadata() -> Dict[str, Any]:
    return sandia_performance_service.get_metadata()
