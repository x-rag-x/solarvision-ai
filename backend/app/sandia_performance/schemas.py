"""
SolarVision AI — Model 3: Sandia Solar Electrical Performance Prediction
Request & Response Pydantic Schemas and Contract Definitions (Strict Schema Enforcement)
"""

from __future__ import annotations

from enum import Enum
from typing import Any, Dict, List, Optional, Union
from pydantic import BaseModel, Field, field_validator


SANDIA_CONTRACT_VERSION = "1.0.0"
MAX_BATCH_SIZE = 100


class SandiaModelStatus(str, Enum):
    READY = "ready"
    NOT_TRAINED = "not_trained"
    MISSING_FEATURES = "missing_features"
    VALIDATION_ERROR = "validation_error"
    ERROR = "error"


class FeatureSpec(BaseModel):
    name: str = Field(..., description="Canonical feature identifier matching dataset columns")
    type: str = Field(default="float", description="Data type: float, int, string, or category")
    required: bool = Field(default=True, description="Whether this feature is required for inference")
    unit: Optional[str] = Field(default=None, description="Physical engineering unit (e.g. W/m^2, degC, V, A, %)")
    min_value: Optional[float] = Field(default=None, description="Physical lower bound for sensor validation")
    max_value: Optional[float] = Field(default=None, description="Physical upper bound for sensor validation")
    description: Optional[str] = Field(default=None, description="Feature description or sensor provenance")


class FeatureSchemaManifest(BaseModel):
    schema_version: str = Field(default=SANDIA_CONTRACT_VERSION, description="Feature schema specification version")
    dataset_name: Optional[str] = Field(default=None, description="Source training dataset name")
    features: List[FeatureSpec] = Field(default_factory=list, description="Ordered feature definitions from trainer")
    metadata: Dict[str, Any] = Field(default_factory=dict, description="Additional training metadata")


class TargetDefinitionManifest(BaseModel):
    target_name: str = Field(..., description="Target prediction variable name defined by model trainer")
    target_type: str = Field(default="regression", description="Prediction type: regression or classification")
    target_unit: Optional[str] = Field(default=None, description="Target physical or percentage unit")
    description: Optional[str] = Field(default=None, description="Definition of predicted target metric")
    min_value: Optional[float] = Field(default=None, description="Theoretical lower bound of target")
    max_value: Optional[float] = Field(default=None, description="Theoretical upper bound of target")
    metadata: Dict[str, Any] = Field(default_factory=dict, description="Additional target metadata")


class SandiaPredictionInput(BaseModel):
    module_id: Optional[str] = Field(default=None, description="Optional PV module or array identifier")
    timestamp: Optional[str] = Field(default=None, description="Optional ISO timestamp of observation")
    features: Dict[str, Any] = Field(
        ...,
        description="Named feature dictionary. Features must strictly match trainer's feature_schema.json.",
    )
    metadata: Optional[Dict[str, Any]] = Field(
        default=None,
        description="Optional auxiliary contextual metadata (sensor source, weather station, etc.)",
    )

    @field_validator("features")
    @classmethod
    def validate_features_non_empty(cls, v: Dict[str, Any]) -> Dict[str, Any]:
        if not v or len(v) == 0:
            raise ValueError("The 'features' dictionary cannot be empty. Named features must be provided.")
        return v


class SandiaBatchPredictionInput(BaseModel):
    items: List[SandiaPredictionInput] = Field(
        ...,
        min_length=1,
        max_length=MAX_BATCH_SIZE,
        description=f"Batch of inputs to evaluate (1 to {MAX_BATCH_SIZE} items per request)",
    )


class SandiaPredictionItem(BaseModel):
    module_id: Optional[str] = Field(default=None, description="PV module identifier from input")
    prediction: Union[float, int, List[float], Dict[str, Any]] = Field(
        ...,
        description="Predicted electrical performance value from trained scikit-learn pipeline",
    )
    prediction_label: Optional[str] = Field(
        default=None,
        description="Optional classification or performance category label",
    )
    target_name: Optional[str] = Field(
        default=None,
        description="Target variable name read dynamically from target_definition.json",
    )
    target_unit: Optional[str] = Field(
        default=None,
        description="Target variable unit read dynamically from target_definition.json",
    )
    confidence: Optional[float] = Field(
        default=None,
        description="Model confidence (only returned when supported by validated model methodology)",
    )
    uncertainty: Optional[float] = Field(
        default=None,
        description="Prediction uncertainty or standard error (only returned when supported by model pipeline)",
    )
    features_used: List[str] = Field(
        default_factory=list,
        description="Ordered list of feature names consumed by the model pipeline",
    )
    is_mock: bool = Field(
        default=False,
        description="Explicit flag: True if generated by an isolated test mock fixture; False for real pipeline",
    )
    warnings: List[str] = Field(
        default_factory=list,
        description="Sensor range boundary warnings or out-of-distribution telemetry notices",
    )


class SandiaPredictionResponse(BaseModel):
    contract_version: str = Field(default=SANDIA_CONTRACT_VERSION, description="API contract version")
    status: SandiaModelStatus = Field(..., description="Inference execution status")
    model_name: str = Field(
        default="SolarVision-Sandia-Performance-Model3",
        description="Canonical model identifier",
    )
    model_version: str = Field(default="none", description="Trained model artifact version")
    is_mock: bool = Field(
        default=False,
        description="True if response was produced by an isolated test mock",
    )
    prediction: Optional[SandiaPredictionItem] = Field(
        default=None,
        description="Prediction result item",
    )
    limitations: List[str] = Field(
        default_factory=list,
        description="Operational constraints and caveats",
    )
    processing_time_ms: float = Field(default=0.0, description="Execution latency in milliseconds")

    def to_dict(self) -> Dict[str, Any]:
        return self.model_dump(by_alias=True)


class SandiaBatchPredictionResponse(BaseModel):
    contract_version: str = Field(default=SANDIA_CONTRACT_VERSION, description="API contract version")
    status: SandiaModelStatus = Field(..., description="Batch execution status")
    model_name: str = Field(
        default="SolarVision-Sandia-Performance-Model3",
        description="Canonical model identifier",
    )
    model_version: str = Field(default="none", description="Trained model artifact version")
    is_mock: bool = Field(
        default=False,
        description="True if batch response includes mock fixture predictions",
    )
    predictions: List[SandiaPredictionItem] = Field(
        default_factory=list,
        description="List of predictions corresponding to input items",
    )
    total_items: int = Field(default=0, description="Total number of evaluated items")
    limitations: List[str] = Field(
        default_factory=list,
        description="Operational constraints and caveats",
    )
    processing_time_ms: float = Field(default=0.0, description="Batch execution latency in milliseconds")

    def to_dict(self) -> Dict[str, Any]:
        return self.model_dump(by_alias=True)


class SandiaModelStatusResponse(BaseModel):
    model_name: str = Field(
        default="SolarVision-Sandia-Performance-Model3",
        description="Model identifier",
    )
    model_version: str = Field(default="none", description="Artifact model version")
    contract_version: str = Field(default=SANDIA_CONTRACT_VERSION, description="API contract version")
    is_ready: bool = Field(..., description="Whether a valid trained pipeline artifact is loaded and ready")
    status: SandiaModelStatus = Field(..., description="Model status enum")
    artifact_name: str = Field(default="pipeline.joblib", description="Model artifact filename")
    unavailability_reason: Optional[str] = Field(
        default=None,
        description="Clean, sanitized reason if the model pipeline is not ready for inference",
    )
    feature_schema_loaded: bool = Field(
        default=False,
        description="Whether trainer feature_schema.json has been discovered and loaded",
    )
    feature_schema: Optional[Dict[str, Any]] = Field(
        default=None,
        description="Parsed trainer feature schema specification",
    )
    sample_input_loaded: bool = Field(
        default=False,
        description="Whether sample_input.json provided by trainer has been discovered and loaded",
    )
    sample_input: Optional[Dict[str, Any]] = Field(
        default=None,
        description="Sample input conforming to the feature schema",
    )
    target_definition_loaded: bool = Field(
        default=False,
        description="Whether target_definition.json provided by trainer has been discovered and loaded",
    )
    target_definition: Optional[Dict[str, Any]] = Field(
        default=None,
        description="Target variable specification read dynamically from target_definition.json",
    )
    is_mock: bool = Field(
        default=False,
        description="True if running in automated test mock mode",
    )
    trainer_handoff_pending: bool = Field(
        default=True,
        description="True if waiting on model trainer to deliver trained joblib pipeline and schemas",
    )
    expected_dim: Optional[int] = Field(
        default=None,
        description="Expected number of input features (from schema or fitted pipeline)",
    )

    def to_dict(self) -> Dict[str, Any]:
        return self.model_dump(by_alias=True)
