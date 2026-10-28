"""
SolarVision AI — Model 3: Sandia Solar Electrical Performance Prediction
Backend Module Package
"""

from .schemas import (
    MAX_BATCH_SIZE,
    SANDIA_CONTRACT_VERSION,
    SandiaModelStatus,
    FeatureSpec,
    FeatureSchemaManifest,
    TargetDefinitionManifest,
    SandiaPredictionInput,
    SandiaBatchPredictionInput,
    SandiaPredictionItem,
    SandiaPredictionResponse,
    SandiaBatchPredictionResponse,
    SandiaModelStatusResponse,
)
from .model_loader import SandiaModelLoader
from .service import SandiaPerformanceService, sandia_performance_service

__all__ = [
    "MAX_BATCH_SIZE",
    "SANDIA_CONTRACT_VERSION",
    "SandiaModelStatus",
    "FeatureSpec",
    "FeatureSchemaManifest",
    "TargetDefinitionManifest",
    "SandiaPredictionInput",
    "SandiaBatchPredictionInput",
    "SandiaPredictionItem",
    "SandiaPredictionResponse",
    "SandiaBatchPredictionResponse",
    "SandiaModelStatusResponse",
    "SandiaModelLoader",
    "SandiaPerformanceService",
    "sandia_performance_service",
]
