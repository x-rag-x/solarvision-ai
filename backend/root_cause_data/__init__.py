"""SolarVision AI — Model 2 Root Cause Dataset Engineering Package.

This package provides data models, ingestion, validation, time-window feature
extraction, leakage-free splitting, and data quality reporting for Model 2
(Manufacturing Root Cause Analysis).
"""

from .schema import (
    ROOT_CAUSE_TAXONOMY,
    ROOT_CAUSE_DESCRIPTIONS,
    SENSOR_UNIT_REGISTRY,
    SensorReading,
    ManufacturingBatchRecord,
    MachineRecord,
    ProductionEventRecord,
    RootCauseGroundTruth,
    JoinedInspectionRecord,
    ModelReadyFeatureVector,
    DataQualityAuditResult,
)
from .feature_spec import (
    CANONICAL_FEATURES_V2,
    CANONICAL_FEATURE_NAMES_V2,
    CANONICAL_FEATURE_COUNT_V2,
    FEATURE_SCHEMA_VERSION,
    RECONCILED_ROOT_CAUSE_CATALOG,
    FeatureDomain,
    MissingValuePolicy,
    FeatureDefinition,
    RootCauseClassMapping,
)
from .import_contract import (
    ImportContractValidator,
    ImportValidationReport,
    TEMPLATES_DIR,
)
from .validator import TelemetryValidator
from .time_window import TimeWindowFeatureExtractor
from .ingestion import TelemetryIngestionEngine
from .splitter import LeakageFreeSplitter
from .quality_report import DataQualityAuditor
from .pipeline import RootCauseDatasetPipeline

__all__ = [
    "ROOT_CAUSE_TAXONOMY",
    "ROOT_CAUSE_DESCRIPTIONS",
    "SENSOR_UNIT_REGISTRY",
    "SensorReading",
    "ManufacturingBatchRecord",
    "MachineRecord",
    "ProductionEventRecord",
    "RootCauseGroundTruth",
    "JoinedInspectionRecord",
    "ModelReadyFeatureVector",
    "DataQualityAuditResult",
    "CANONICAL_FEATURES_V2",
    "CANONICAL_FEATURE_NAMES_V2",
    "CANONICAL_FEATURE_COUNT_V2",
    "FEATURE_SCHEMA_VERSION",
    "RECONCILED_ROOT_CAUSE_CATALOG",
    "FeatureDomain",
    "MissingValuePolicy",
    "FeatureDefinition",
    "RootCauseClassMapping",
    "ImportContractValidator",
    "ImportValidationReport",
    "TEMPLATES_DIR",
    "TelemetryValidator",
    "TimeWindowFeatureExtractor",
    "TelemetryIngestionEngine",
    "LeakageFreeSplitter",
    "DataQualityAuditor",
    "RootCauseDatasetPipeline",
]
