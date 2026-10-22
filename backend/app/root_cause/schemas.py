"""
SolarVision AI — Model 2: Manufacturing Root Cause Analysis
Schemas and Input/Output Contracts
"""

from __future__ import annotations

from enum import Enum
from typing import Any, Optional
from pydantic import BaseModel, Field, ConfigDict


class RootCauseStatus(str, Enum):
    READY = "ready"
    NOT_TRAINED = "not_trained"
    MISSING_PROCESS_DATA = "missing_process_data"
    ERROR = "error"


class DefectInput(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    defect_type: str = Field(..., alias="defectType", description="Model 1 defect class name")
    confidence: float = Field(..., ge=0.0, le=1.0, description="Model 1 detection confidence")
    x1: float = Field(..., description="Normalized or pixel bounding box x1")
    y1: float = Field(..., description="Normalized or pixel bounding box y1")
    x2: float = Field(..., description="Normalized or pixel bounding box x2")
    y2: float = Field(..., description="Normalized or pixel bounding box y2")
    class_id: Optional[int] = Field(None, alias="classId")


class SensorMeasurementInput(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    sensor_type: str = Field(..., alias="sensorType", description="Type of sensor, e.g. laminator_temp, soldering_temp, pressure")
    measurement_value: float = Field(..., alias="measurementValue", description="Measured numerical value")
    unit: str = Field(default="", description="Engineering unit (°C, bar, mm/s, etc.)")
    is_anomaly: bool = Field(default=False, alias="isAnomaly", description="Whether telemetry flagged this as an anomaly")
    anomaly_score: Optional[float] = Field(default=None, ge=0.0, le=1.0, alias="anomalyScore")
    recorded_at: Optional[str] = Field(default=None, alias="recordedAt", description="ISO-8601 timestamp")


class ProductionEventInput(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    event_type: str = Field(..., alias="eventType", description="e.g. thermal_drift, wire_tension_error, feeder_jam")
    severity: str = Field(default="info", description="Severity: info, low, medium, high, critical")
    message: str = Field(default="", description="Event log description")
    details: Optional[dict[str, Any]] = None
    started_at: Optional[str] = Field(default=None, alias="startedAt")
    resolved_at: Optional[str] = Field(default=None, alias="resolvedAt")


class BatchInput(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    batch_id: str = Field(..., alias="batchId")
    batch_number: Optional[str] = Field(None, alias="batchNumber")
    wafer_type: str = Field(default="monocrystalline", alias="waferType")
    cell_line: str = Field(default="Line-1", alias="cellLine")
    target_quantity: Optional[int] = Field(None, alias="targetQuantity")
    actual_quantity: Optional[int] = Field(None, alias="actualQuantity")
    status: Optional[str] = Field(default="in_progress")


class MachineInput(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    machine_id: str = Field(..., alias="machineId")
    machine_code: Optional[str] = Field(None, alias="machineCode")
    machine_type: str = Field(default="stringer", alias="machineType", description="e.g. stringer, tabber, laminator, soldering_station")
    line_id: Optional[str] = Field(None, alias="lineId")
    status: Optional[str] = Field(default="operational")
    last_maintenance_at: Optional[str] = Field(None, alias="lastMaintenanceAt")
    next_maintenance_due: Optional[str] = Field(None, alias="nextMaintenanceDue")


class RootCauseAnalysisInput(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    inspection_id: str = Field(..., alias="inspectionId", description="Model 1 inspection UUID or identifier")
    batch_id: Optional[str] = Field(None, alias="batchId")
    machine_id: Optional[str] = Field(None, alias="machineId")
    operator_id: Optional[str] = Field(None, alias="operatorId")
    detections: list[DefectInput] = Field(default_factory=list, description="Model 1 defect detections")
    batch: Optional[BatchInput] = None
    machine: Optional[MachineInput] = None
    sensor_measurements: list[SensorMeasurementInput] = Field(default_factory=list, alias="sensorMeasurements")
    production_events: list[ProductionEventInput] = Field(default_factory=list, alias="productionEvents")
    confidence_threshold: float = Field(default=0.25, ge=0.0, le=1.0, alias="confidenceThreshold")


class ProbableCause(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    cause_code: str = Field(..., alias="causeCode", description="Standardized root cause identifier code (e.g. RC-SOLD-01)")
    label: str = Field(..., description="Human-readable root cause explanation")
    confidence: Optional[float] = Field(None, ge=0.0, le=1.0, description="Model confidence score / empirical probability")
    is_calibrated: bool = Field(default=False, alias="isCalibrated", description="Whether probability is mathematically calibrated")
    calibration_method: Optional[str] = Field(default=None, alias="calibrationMethod", description="Calibration algorithm if applied")
    supporting_evidence: list[str] = Field(default_factory=list, alias="supportingEvidence", description="Empirical evidence points linking detections and process data")
    recommended_action: Optional[str] = Field(None, alias="recommendedAction", description="Suggested corrective or preventative maintenance action")
    contributing_factors: Optional[dict[str, float]] = Field(default=None, alias="contributingFactors", description="Factor contribution breakdown")
    feature_importance: Optional[dict[str, float]] = Field(default=None, alias="featureImportance", description="Key input feature weights")


class RootCauseAnalysisResponse(BaseModel):
    """
    Standard Model 2 Shared Response Contract:
    - inspectionId: string
    - batchId: string | null
    - machineId: string | null
    - status: 'ready' | 'not_trained' | 'missing_process_data' | 'error'
    - probableCauses: array of cause codes, labels, optional calibrated confidence, and supporting evidence
    - modelVersion: string
    - limitations: string[]
    """
    model_config = ConfigDict(populate_by_name=True)

    inspection_id: str = Field(..., alias="inspectionId")
    batch_id: Optional[str] = Field(None, alias="batchId")
    machine_id: Optional[str] = Field(None, alias="machineId")
    status: RootCauseStatus
    probable_causes: list[ProbableCause] = Field(default_factory=list, alias="probableCauses")
    model_version: str = Field(..., alias="modelVersion")
    limitations: list[str] = Field(default_factory=list)
    feature_summary: Optional[dict[str, float]] = Field(default=None, alias="featureSummary")
    model_name: str = Field(default="SolarVision-RC-Model2", alias="modelName")
    processing_time_ms: float = Field(default=0.0, alias="processingTimeMs")

    def to_shared_dict(self) -> dict[str, Any]:
        """Serializes strictly into the shared response contract camelCase shape."""
        return {
            "inspectionId": self.inspection_id,
            "batchId": self.batch_id,
            "machineId": self.machine_id,
            "status": self.status.value,
            "probableCauses": [
                {
                    "causeCode": c.cause_code,
                    "label": c.label,
                    **( {"confidence": c.confidence} if c.confidence is not None else {} ),
                    "isCalibrated": c.is_calibrated,
                    **( {"calibrationMethod": c.calibration_method} if c.calibration_method else {} ),
                    "supportingEvidence": c.supporting_evidence,
                    **( {"recommendedAction": c.recommended_action} if c.recommended_action else {} ),
                    **( {"contributingFactors": c.contributing_factors} if c.contributing_factors else {} ),
                    **( {"featureImportance": c.feature_importance} if c.feature_importance else {} ),
                }
                for c in self.probable_causes
            ],
            "modelVersion": self.model_version,
            "limitations": self.limitations,
            "featureSummary": self.feature_summary,
            "modelName": self.model_name,
            "processingTimeMs": round(self.processing_time_ms, 2),
        }


class Model2Manifest(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    model_id: str = Field(default="model-2-root-cause", alias="modelId")
    model_name: str = Field(default="SolarVision Root Cause Analysis", alias="modelName")
    version: str = Field(default="0.0.0", alias="version")
    framework: str = Field(default="torch/onnx", alias="framework")
    artifact_filename: str = Field(default="root_cause_model.pt", alias="artifactFilename")
    sha256: Optional[str] = None
    feature_names: list[str] = Field(default_factory=list, alias="featureNames")
    cause_classes: list[str] = Field(default_factory=list, alias="causeClasses")
    training_metrics: dict[str, float] = Field(default_factory=dict, alias="trainingMetrics")
    status: str = Field(default="not_trained", alias="status")
    description: Optional[str] = None
    schema_version: str = Field(default="2.0.0", alias="schemaVersion")
    expected_dim: int = Field(default=48, alias="expectedDim")
    calibration_method: Optional[str] = Field(default=None, alias="calibrationMethod")
    is_synthetic_training: bool = Field(default=False, alias="isSyntheticTraining")
