"""
SolarVision AI — Model 2: Manufacturing Root Cause Analysis Package
"""

from backend.root_cause_data.schema import (
    CANONICAL_FEATURE_ORDER,
    ROOT_CAUSE_TAXONOMY,
    ROOT_CAUSE_DESCRIPTIONS,
    SENSOR_UNIT_REGISTRY,
)
from backend.root_cause_data.feature_spec import (
    CANONICAL_FEATURES_V2,
    CANONICAL_FEATURE_NAMES_V2,
    CANONICAL_FEATURE_COUNT_V2,
    FEATURE_SCHEMA_VERSION,
    RECONCILED_ROOT_CAUSE_CATALOG,
)
from .schemas import (
    BatchInput,
    DefectInput,
    MachineInput,
    Model2Manifest,
    ProbableCause,
    ProductionEventInput,
    RootCauseAnalysisInput,
    RootCauseAnalysisResponse,
    RootCauseStatus,
    SensorMeasurementInput,
)
from .feature_extractor import (
    FeatureExtractor,
    FeatureExtractionResult,
    STANDARD_DEFECT_CLASSES,
    STANDARD_MACHINE_TYPES,
    STANDARD_SENSOR_GROUPS,
    SENSOR_BOUNDS,
    SENSOR_NOMINALS,
)
from .model_loader import Model2Loader, KNOWN_CAUSE_CATALOG
from .service import RootCauseService, root_cause_service

__all__ = [
    "CANONICAL_FEATURE_ORDER",
    "CANONICAL_FEATURES_V2",
    "CANONICAL_FEATURE_NAMES_V2",
    "CANONICAL_FEATURE_COUNT_V2",
    "FEATURE_SCHEMA_VERSION",
    "RECONCILED_ROOT_CAUSE_CATALOG",
    "ROOT_CAUSE_TAXONOMY",
    "ROOT_CAUSE_DESCRIPTIONS",
    "SENSOR_UNIT_REGISTRY",
    "BatchInput",
    "DefectInput",
    "MachineInput",
    "Model2Manifest",
    "ProbableCause",
    "ProductionEventInput",
    "RootCauseAnalysisInput",
    "RootCauseAnalysisResponse",
    "RootCauseStatus",
    "SensorMeasurementInput",
    "FeatureExtractor",
    "FeatureExtractionResult",
    "Model2Loader",
    "KNOWN_CAUSE_CATALOG",
    "RootCauseService",
    "root_cause_service",
    "STANDARD_DEFECT_CLASSES",
    "STANDARD_MACHINE_TYPES",
    "STANDARD_SENSOR_GROUPS",
    "SENSOR_BOUNDS",
    "SENSOR_NOMINALS",
]
