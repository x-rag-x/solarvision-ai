"""
SolarVision AI — Model 4: Predictive Maintenance Package
"""

from .api import router
from .feature_extractor import (
    CANONICAL_FEATURE_SPECS,
    CANONICAL_MAINTENANCE_FEATURE_COUNT,
    CANONICAL_MAINTENANCE_FEATURE_NAMES,
    MaintenanceFeatureSpec,
    PredictiveMaintenanceFeatureExtractor,
)
from .model_loader import Model4Loader
from .schemas import (
    FailureMode,
    MachineHealthState,
    Model4Domain,
    Model4Manifest,
    Model4Status,
    PredictiveMaintenanceInput,
    PredictiveMaintenanceResponse,
    RiskFactor,
    MODEL4_CONTRACT_VERSION,
)
from .service import PredictiveMaintenanceService, predictive_maintenance_service

__all__ = [
    "MODEL4_CONTRACT_VERSION",
    "Model4Domain",
    "Model4Status",
    "MachineHealthState",
    "FailureMode",
    "RiskFactor",
    "Model4Manifest",
    "PredictiveMaintenanceInput",
    "PredictiveMaintenanceResponse",
    "MaintenanceFeatureSpec",
    "CANONICAL_FEATURE_SPECS",
    "CANONICAL_MAINTENANCE_FEATURE_COUNT",
    "CANONICAL_MAINTENANCE_FEATURE_NAMES",
    "PredictiveMaintenanceFeatureExtractor",
    "Model4Loader",
    "PredictiveMaintenanceService",
    "predictive_maintenance_service",
    "router",
]
