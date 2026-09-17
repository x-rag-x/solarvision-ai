from pydantic import BaseModel, Field


class Detection(BaseModel):
    defect_type: str
    confidence: float = Field(ge=0, le=1)
    x1: float
    y1: float
    x2: float
    y2: float
    near_image_boundary: bool | None = None


class InspectionSummary(BaseModel):
    total_detections: int
    average_confidence: float | None = None
    highest_confidence: float | None = None


class InferenceConfiguration(BaseModel):
    confidence_threshold: float
    iou_threshold: float
    image_size: int
    width: int
    height: int
    class_names: list[str]


class ThresholdDiagnostic(BaseModel):
    threshold: float
    detection_count: int
    detections: list[Detection]
    processing_time_ms: float


class InspectionDiagnostics(BaseModel):
    pre_nms_raw_prediction_count: int | None
    pre_nms_raw_prediction_status: str
    nms_filtered_candidate_count: int
    candidate_confidence: float
    threshold_comparison: list[ThresholdDiagnostic]


class InspectionResponse(BaseModel):
    inspection_id: str
    status: str
    source_filename: str
    model_name: str
    processing_time_ms: float
    summary: InspectionSummary
    detections: list[Detection]
    original_image_url: str | None = None
    annotated_image_url: str | None = None
    annotated_image_data_url: str | None = None
    persistence: str
    inference_configuration: InferenceConfiguration | None = None
    diagnostics: InspectionDiagnostics | None = None


class ModelInfo(BaseModel):
    status: str
    model_path: str
    exists: bool
    model_name: str
    class_names: list[str] = []
    confidence_threshold: float
    iou_threshold: float
    image_size: int
    independent_metrics_status: str
