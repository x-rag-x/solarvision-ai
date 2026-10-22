"""
SolarVision AI — Model 3: Predictive Quality Monitoring Subpackage
"""

from .schemas import (
    MODEL3_CONTRACT_VERSION,
    ConfidenceInterval,
    Model3Manifest,
    ModelDomain,
    PredictiveQualityInput,
    PredictiveQualityResponse,
    PredictiveQualityStatus,
    QualityOutcome,
    RiskFactor,
    RiskLevel,
)
from .feature_extractor import (
    CANONICAL_SOLAR_FEATURES,
    CANONICAL_SOLAR_FEATURE_COUNT,
    CANONICAL_SOLAR_FEATURE_NAMES,
    MODEL3_FEATURE_SCHEMA_VERSION,
    PredictiveQualityFeatureExtractor,
)
from .model_loader import Model3Loader
from .service import PredictiveQualityService, predictive_quality_service
from .api import router as predictive_quality_router

__all__ = [
    "MODEL3_CONTRACT_VERSION",
    "MODEL3_FEATURE_SCHEMA_VERSION",
    "CANONICAL_SOLAR_FEATURES",
    "CANONICAL_SOLAR_FEATURE_COUNT",
    "CANONICAL_SOLAR_FEATURE_NAMES",
    "ConfidenceInterval",
    "Model3Loader",
    "Model3Manifest",
    "ModelDomain",
    "PredictiveQualityFeatureExtractor",
    "PredictiveQualityInput",
    "PredictiveQualityResponse",
    "PredictiveQualityService",
    "PredictiveQualityStatus",
    "QualityOutcome",
    "RiskFactor",
    "RiskLevel",
    "predictive_quality_router",
    "predictive_quality_service",
]
