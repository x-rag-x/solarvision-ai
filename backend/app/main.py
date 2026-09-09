from __future__ import annotations

import uuid
from pathlib import Path

import cv2
import numpy as np
from fastapi import FastAPI, File, HTTPException, UploadFile

from .config import settings
from .inference import inference_service, image_to_data_url
from .schemas import InspectionResponse, ModelInfo

app = FastAPI(title="SolarVision AI Inference API", version="1.0.0")


@app.on_event("startup")
def verify_model() -> None:
    settings.ensure_paths()
    if not settings.model_path.exists():
        raise RuntimeError("YOLO model not found. Please place best.pt in the configured model path.")


@app.get("/health")
def health() -> dict[str, str | bool]:
    return {"status": "ok", "model_exists": settings.model_path.exists(), "model_path": str(settings.model_path)}


@app.get("/model", response_model=ModelInfo)
def model_info() -> ModelInfo:
    return ModelInfo(**inference_service.model_info())


@app.post("/inspect", response_model=InspectionResponse)
async def inspect(file: UploadFile = File(...)) -> InspectionResponse:
    if not file.content_type or not file.content_type.startswith("image/"):
        raise HTTPException(status_code=415, detail="Please upload an EL/NIR image file.")
    payload = await file.read()
    image = cv2.imdecode(np.frombuffer(payload, dtype=np.uint8), cv2.IMREAD_COLOR)
    if image is None:
        raise HTTPException(status_code=400, detail="The uploaded file is not a readable image.")
    inspection_id = str(uuid.uuid4())
    try:
        detections, annotated, processing_time_ms = inference_service.predict(image)
    except Exception as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    output_path = Path(settings.storage_dir) / f"{inspection_id}-annotated.jpg"
    cv2.imwrite(str(output_path), annotated)
    input_path = Path(settings.storage_dir) / f"{inspection_id}-input{Path(file.filename or 'image.jpg').suffix or '.jpg'}"
    input_path.write_bytes(payload)
    return InspectionResponse(
        inspection_id=inspection_id,
        status="completed",
        source_filename=file.filename or "uploaded-image",
        model_name="YOLO26n",
        processing_time_ms=round(processing_time_ms, 2),
        detections=detections,
        annotated_image_url=None,
        annotated_image_data_url=image_to_data_url(annotated),
        persistence="local_filesystem_pending_supabase" if not settings.supabase_configured else "supabase_adapter_ready",
    )
