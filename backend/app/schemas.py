from pydantic import BaseModel, Field


class Detection(BaseModel):
    defect_type: str
    confidence: float = Field(ge=0, le=1)
    x1: float
    y1: float
    x2: float
    y2: float


class InspectionResponse(BaseModel):
    inspection_id: str
    status: str
    source_filename: str
    model_name: str
    processing_time_ms: float
    detections: list[Detection]
    annotated_image_url: str | None = None
    annotated_image_data_url: str | None = None
    persistence: str


class ModelInfo(BaseModel):
    status: str
    model_path: str
    exists: bool
    model_name: str
    class_names: list[str] = []
    independent_metrics_status: str
