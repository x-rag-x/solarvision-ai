"""
SolarVision AI — Model 3: Predictive Quality Monitoring
Request & Response Pydantic Schemas and Contract Definitions
"""

from __future__ import annotations

from enum import Enum
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field, field_validator


MODEL3_CONTRACT_VERSION = "1.0.0"


class PredictiveQualityStatus(str, Enum):
    READY = "ready"
    NOT_TRAINED = "not_trained"
    MISSING_FEATURES = "missing_features"
    ERROR = "error"


class QualityOutcome(str, Enum):
    PASS = "pass"
    WARNING = "warning"
    FAIL = "fail"
    UNKNOWN = "unknown"


class RiskLevel(str, Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"
    UNKNOWN = "unknown"


class ModelDomain(str, Enum):
    SOLAR_CELL_MANUFACTURING = "solar_cell_manufacturing"
    SEMICONDUCTOR_BENCHMARK = "semiconductor_benchmark"


class SensorReadingInput(BaseModel):
    sensor_type: str
    measurement_value: float
    unit: Optional[str] = None
    recorded_at: Optional[str] = None


class DefectSummaryInput(BaseModel):
    total_defect_count: int = 0
    crack_count: int = 0
    finger_interruption_count: int = 0
    busbar_defect_count: int = 0
    defect_area_ratio: float = 0.0
    mean_confidence: float = 0.0


class ElectricalParametersInput(BaseModel):
    voc_v: Optional[float] = None
    isc_a: Optional[float] = None
    fill_factor_pct: Optional[float] = None
    series_resistance_mohm: Optional[float] = None
    shunt_resistance_ohm: Optional[float] = None
    cell_efficiency_pct: Optional[float] = None


class EnvironmentalContextInput(BaseModel):
    cleanroom_temp_c: Optional[float] = None
    cleanroom_humidity_pct: Optional[float] = None
    cleanroom_particulates_pm25: Optional[float] = None
    batch_progress_ratio: Optional[float] = None


class PredictiveQualityInput(BaseModel):
    batch_id: Optional[str] = None
    machine_id: Optional[str] = None
    wafer_id: Optional[str] = None
    domain: ModelDomain = ModelDomain.SOLAR_CELL_MANUFACTURING
    feature_vector: Optional[List[float]] = None
    raw_features: Optional[Dict[str, float]] = None
    sensor_measurements: Optional[List[SensorReadingInput]] = None
    defect_summary: Optional[DefectSummaryInput] = None
    electrical_parameters: Optional[ElectricalParametersInput] = None
    environmental_context: Optional[EnvironmentalContextInput] = None
    confidence_threshold: float = Field(default=0.5, ge=0.0, le=1.0)

    @field_validator("confidence_threshold")
    @classmethod
    def validate_threshold(cls, v: float) -> float:
        if not 0.0 <= v <= 1.0:
            raise ValueError("confidence_threshold must be between 0.0 and 1.0")
        return v


class RiskFactor(BaseModel):
    factor_name: str
    impact_score: float
    measured_value: Optional[float] = None
    nominal_baseline: Optional[float] = None
    deviation_direction: Optional[str] = None  # "high", "low", "nominal"
    description: Optional[str] = None


class ConfidenceInterval(BaseModel):
    low: float
    high: float


class Model3Manifest(BaseModel):
    model_id: str
    model_name: str
    version: str
    framework: str
    domain: ModelDomain
    sha256: str
    schema_version: str = MODEL3_CONTRACT_VERSION
    expected_dim: int
    feature_names: List[str]
    target_classes: List[str]
    source_dataset: str
    label_meaning: str
    evaluation_status: str
    calibration_method: str = "none"
    is_calibrated: bool = False
    is_benchmark: bool = False
    limitations: List[str] = Field(default_factory=list)


class PredictiveQualityResponse(BaseModel):
    contract_version: str = MODEL3_CONTRACT_VERSION
    status: PredictiveQualityStatus
    domain: ModelDomain
    batch_id: Optional[str] = None
    machine_id: Optional[str] = None
    quality_outcome: QualityOutcome = QualityOutcome.UNKNOWN
    risk_level: RiskLevel = RiskLevel.UNKNOWN
    probabilities: Dict[str, float] = Field(default_factory=dict)
    confidence: Optional[float] = None
    is_calibrated: bool = False
    calibration_method: str = "none"
    predicted_defect_rate: Optional[float] = None
    predicted_yield: Optional[float] = None
    confidence_interval: Optional[ConfidenceInterval] = None
    top_risk_factors: List[RiskFactor] = Field(default_factory=list)
    recommended_action: Optional[str] = None
    model_version: str = "none"
    model_metadata: Optional[Model3Manifest] = None
    limitations: List[str] = Field(default_factory=list)
    processing_time_ms: float = 0.0

    def to_shared_dict(self) -> Dict[str, Any]:
        return {
            "contractVersion": self.contract_version,
            "status": self.status.value,
            "domain": self.domain.value,
            "batchId": self.batch_id,
            "machineId": self.machine_id,
            "qualityOutcome": self.quality_outcome.value,
            "riskLevel": self.risk_level.value,
            "probabilities": self.probabilities,
            "confidence": self.confidence,
            "isCalibrated": self.is_calibrated,
            "calibrationMethod": self.calibration_method,
            "predictedDefectRate": self.predictedDefectRate if hasattr(self, "predictedDefectRate") else self.predicted_defect_rate,
            "predictedYield": self.predicted_yield,
            "confidenceInterval": self.confidence_interval.model_dump() if self.confidence_interval else None,
            "topRiskFactors": [rf.model_dump() for rf in self.top_risk_factors],
            "recommendedAction": self.recommended_action,
            "modelVersion": self.model_version,
            "modelMetadata": self.model_metadata.model_dump() if self.model_metadata else None,
            "limitations": self.limitations,
            "processingTimeMs": self.processing_time_ms,
        }

