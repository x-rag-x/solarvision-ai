"""
SolarVision AI — Model 4: Predictive Maintenance
Request & Response Pydantic Schemas and Contract Specifications
"""

from __future__ import annotations

from enum import Enum
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field, field_validator


MODEL4_CONTRACT_VERSION = "1.0.0"


class Model4Domain(str, Enum):
    AI4I_SYNTHETIC_BENCHMARK = "ai4i_synthetic_benchmark"
    SOLAR_FACTORY = "solar_factory"


class Model4Status(str, Enum):
    READY = "ready"
    NOT_TRAINED = "not_trained"
    MISSING_FEATURES = "missing_features"
    ERROR = "error"


class MachineHealthState(str, Enum):
    HEALTHY = "healthy"
    WARNING = "warning"
    FAILURE = "failure"
    UNKNOWN = "unknown"


class FailureMode(str, Enum):
    NONE = "none"
    TOOL_WEAR_FAILURE = "tool_wear_failure"
    HEAT_DISSIPATION_FAILURE = "heat_dissipation_failure"
    POWER_FAILURE = "power_failure"
    OVERSTRAIN_FAILURE = "overstrain_failure"
    RANDOM_FAILURE = "random_failure"
    UNKNOWN = "unknown"


class RiskFactor(BaseModel):
    factor_name: str
    impact_score: float
    measured_value: Optional[float] = None
    nominal_baseline: Optional[float] = None
    deviation_direction: Optional[str] = None  # "high", "low", "nominal"
    description: Optional[str] = None


class Model4Manifest(BaseModel):
    model_id: str
    model_name: str
    version: str
    framework: str
    domain: Model4Domain
    sha256: str
    schema_version: str = MODEL4_CONTRACT_VERSION
    expected_dim: int = 6
    feature_names: List[str] = Field(default_factory=list)
    target_classes: List[str] = Field(default_factory=lambda: ["healthy", "failure"])
    source_dataset: str
    evaluation_status: str
    is_calibrated: bool = False
    calibration_method: str = "none"
    is_benchmark: bool = True
    limitations: List[str] = Field(default_factory=list)


class PredictiveMaintenanceInput(BaseModel):
    machine_id: Optional[str] = None
    domain: Model4Domain = Model4Domain.AI4I_SYNTHETIC_BENCHMARK
    product_type: Optional[str] = Field(default=None, description="Product type variant: L, M, H")
    air_temperature_k: Optional[float] = Field(default=None, description="Air temperature in Kelvin [295, 305]")
    process_temperature_k: Optional[float] = Field(default=None, description="Process temperature in Kelvin [305, 315]")
    rotational_speed_rpm: Optional[float] = Field(default=None, description="Rotational speed in RPM [1100, 2900]")
    torque_nm: Optional[float] = Field(default=None, description="Torque in Nm [3.0, 80.0]")
    tool_wear_min: Optional[float] = Field(default=None, description="Tool wear time in minutes [0, 260]")
    raw_features: Optional[Dict[str, float]] = None
    feature_vector: Optional[List[float]] = None
    confidence_threshold: float = Field(default=0.50, ge=0.0, le=1.0)

    @field_validator("product_type")
    @classmethod
    def validate_product_type(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return v
        normalized = v.strip().upper()
        if normalized not in ("L", "M", "H"):
            raise ValueError(f"product_type must be one of 'L', 'M', 'H', received '{v}'")
        return normalized


class PredictiveMaintenanceResponse(BaseModel):
    contract_version: str = MODEL4_CONTRACT_VERSION
    status: Model4Status
    domain: Model4Domain
    machine_id: Optional[str] = None
    health_state: MachineHealthState = MachineHealthState.UNKNOWN
    failure_mode: FailureMode = FailureMode.UNKNOWN
    failure_probability: Optional[float] = None
    healthy_probability: Optional[float] = None
    mode_probabilities: Dict[str, float] = Field(default_factory=dict)
    confidence: Optional[float] = None
    is_calibrated: bool = False
    calibration_method: str = "none"
    top_risk_factors: List[RiskFactor] = Field(default_factory=list)
    recommended_action: Optional[str] = None
    model_version: str = "none"
    model_metadata: Optional[Model4Manifest] = None
    limitations: List[str] = Field(default_factory=list)
    processing_time_ms: float = 0.0

    def to_shared_dict(self) -> Dict[str, Any]:
        """Maps to camelCase for Node.js / tRPC / frontend consumption."""
        return {
            "contractVersion": self.contract_version,
            "status": self.status.value,
            "domain": self.domain.value,
            "machineId": self.machine_id,
            "healthState": self.health_state.value,
            "failureMode": self.failure_mode.value,
            "failureProbability": self.failure_probability,
            "healthyProbability": self.healthy_probability,
            "modeProbabilities": self.mode_probabilities,
            "confidence": self.confidence,
            "isCalibrated": self.is_calibrated,
            "calibrationMethod": self.calibration_method,
            "topRiskFactors": [rf.model_dump() for rf in self.top_risk_factors],
            "recommendedAction": self.recommended_action,
            "modelVersion": self.model_version,
            "modelMetadata": self.model_metadata.model_dump() if self.model_metadata else None,
            "limitations": self.limitations,
            "processingTimeMs": self.processing_time_ms,
        }
