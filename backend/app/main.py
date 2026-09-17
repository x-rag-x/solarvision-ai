from __future__ import annotations

import uuid
from pathlib import Path

import cv2
import numpy as np
from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.staticfiles import StaticFiles

from .config import settings
from .inference import inference_service, image_to_data_url
from .schemas import InferenceConfiguration, InspectionDiagnostics, InspectionResponse, InspectionSummary, ModelInfo, ThresholdDiagnostic

app = FastAPI(title="SolarVision AI Inference API", version="1.1.0")

settings.ensure_paths()
app.mount("/storage", StaticFiles(directory=str(settings.storage_dir)), name="storage")


@app.on_event("startup")
def verify_model() -> None:
    if not settings.model_path.exists():
        raise RuntimeError("YOLO model not found. Please place best.pt in the configured model path.")


@app.get("/health")
@app.get("/api/health")
def health() -> dict[str, str | bool]:
    return {"status": "ok", "model_exists": settings.model_path.exists(), "model_path": str(settings.model_path), "storage_available": settings.storage_dir.exists()}


@app.get("/model", response_model=ModelInfo)
@app.get("/api/model", response_model=ModelInfo)
def model_info() -> ModelInfo:
    return ModelInfo(**inference_service.model_info())


async def run_inspection(file: UploadFile, diagnostic: bool = False) -> InspectionResponse:
    if not file.content_type or not file.content_type.startswith("image/"):
        raise HTTPException(status_code=415, detail="Please upload an EL/NIR image file.")
    payload = await file.read()
    max_bytes = 50 * 1024 * 1024
    if len(payload) > max_bytes:
        raise HTTPException(status_code=413, detail="Image exceeds the 50 MB maximum upload size.")
    image = cv2.imdecode(np.frombuffer(payload, dtype=np.uint8), cv2.IMREAD_COLOR)
    if image is None:
        raise HTTPException(status_code=400, detail="The uploaded file is not a readable image.")
    inspection_id = str(uuid.uuid4())
    try:
        detections, annotated, processing_time_ms = inference_service.predict(image)
    except Exception as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    suffix = Path(file.filename or "image.jpg").suffix or ".jpg"
    output_path = settings.storage_dir / f"{inspection_id}-annotated.jpg"
    input_path = settings.storage_dir / f"{inspection_id}-input{suffix}"
    cv2.imwrite(str(output_path), annotated)
    input_path.write_bytes(payload)
    confidences = [d.confidence for d in detections]
    summary = InspectionSummary(
        total_detections=len(detections),
        average_confidence=round(sum(confidences) / len(confidences), 6) if confidences else None,
        highest_confidence=round(max(confidences), 6) if confidences else None,
    )
    diagnostic_result = inference_service.diagnostics(image) if diagnostic else None
    return InspectionResponse(
        inspection_id=inspection_id,
        status="completed",
        source_filename=file.filename or "uploaded-image",
        model_name="YOLO26n",
        processing_time_ms=round(processing_time_ms, 2),
        summary=summary,
        detections=detections,
        original_image_url=f"/storage/{input_path.name}",
        annotated_image_url=f"/storage/{output_path.name}",
        annotated_image_data_url=image_to_data_url(annotated),
        persistence="local_filesystem_pending_supabase" if not settings.supabase_configured else "supabase_adapter_ready",
        inference_configuration=InferenceConfiguration(confidence_threshold=settings.confidence_threshold, iou_threshold=settings.iou_threshold, image_size=settings.image_size, width=int(image.shape[1]), height=int(image.shape[0]), class_names=inference_service.class_names()),
        diagnostics=InspectionDiagnostics(pre_nms_raw_prediction_count=diagnostic_result["pre_nms_raw_prediction_count"], pre_nms_raw_prediction_status=diagnostic_result["pre_nms_raw_prediction_status"], nms_filtered_candidate_count=diagnostic_result["nms_filtered_candidate_count"], candidate_confidence=diagnostic_result["candidate_confidence"], threshold_comparison=[ThresholdDiagnostic(**item) for item in diagnostic_result["threshold_comparison"]]) if diagnostic_result else None,
    )


@app.post("/inspect", response_model=InspectionResponse)
@app.post("/api/inspections", response_model=InspectionResponse)
async def inspect(file: UploadFile = File(...), diagnostic: bool = False) -> InspectionResponse:
    return await run_inspection(file, diagnostic=diagnostic)
