from __future__ import annotations

from contextlib import asynccontextmanager
import logging
import os
from typing import Any
from pathlib import Path
import time
import uuid

import cv2
from fastapi import FastAPI, File, HTTPException, Query, UploadFile
from fastapi.staticfiles import StaticFiles

from .config import settings
from .inference import image_to_data_url, inference_service, load_image_safely
from .predictive_maintenance.api import router as predictive_maintenance_router
from .predictive_quality.api import router as predictive_quality_router
from .root_cause.api import router as root_cause_router
from .sandia_performance.api import router as sandia_performance_router
from .sandia_performance.service import sandia_performance_service
from .schemas import (
    InferenceConfiguration,
    InspectionDiagnostics,
    InspectionResponse,
    InspectionSummary,
    ModelInfo,
    ThresholdDiagnostic,
)

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] [%(name)s] %(message)s",
)
logger = logging.getLogger("solarvision.api")


@asynccontextmanager
async def lifespan(app: FastAPI):
    settings.ensure_paths()
    logger.info("Initializing SolarVision AI Inference API...")
    logger.info("Configured model path: %s", settings.model_path)
    if settings.model_path.exists():
        try:
            inference_service.load()
            logger.info("YOLO model checkpoint loaded successfully. Readiness verified.")
        except Exception as exc:
            logger.error("Failed to initialize YOLO model checkpoint: %s", exc, exc_info=True)
    else:
        logger.warning(
            "YOLO model checkpoint not found at %s. Inference requests will return 503 until best.pt is provided.",
            settings.model_path,
        )

    if sandia_performance_service.loader.is_ready:
        logger.info("Sandia solar performance model pipeline loaded successfully.")
    else:
        logger.info(
            "Sandia performance model pipeline not loaded (%s). Requests will return 503.",
            sandia_performance_service.loader.unavailability_reason,
        )
    yield
    logger.info("SolarVision AI Inference API shut down cleanly.")


app = FastAPI(
    title="SolarVision AI Inference API",
    version="1.1.0",
    description="Academically Validated EL/NIR Solar Cell Defect Detection Prototype backed by YOLO26n (Evaluated on PVELAD benchmark; not factory-production-certified)",
    lifespan=lifespan,
)

settings.ensure_paths()
app.mount("/storage", StaticFiles(directory=str(settings.storage_dir)), name="storage")
app.include_router(root_cause_router, prefix="/api")
app.include_router(root_cause_router)
app.include_router(predictive_quality_router, prefix="/api")
app.include_router(predictive_quality_router)
app.include_router(predictive_maintenance_router, prefix="/api")
app.include_router(predictive_maintenance_router)
app.include_router(sandia_performance_router, prefix="/api")
app.include_router(sandia_performance_router)


@app.get("/health")
@app.get("/api/health")
def health() -> dict[str, str | bool]:
    return {
        "status": "ok",
        "model_exists": settings.model_path.exists(),
        "model_path": str(settings.model_path),
        "storage_available": settings.storage_dir.exists(),
        "model_ready": inference_service.is_ready(),
    }


@app.get("/health/ready")
@app.get("/api/health/ready")
def health_ready() -> dict[str, Any]:
    require_sandia = os.getenv("REQUIRE_SANDIA_MODEL", "false").lower() in ("true", "1", "yes")
    sandia_ready = sandia_performance_service.loader.is_ready
    is_mock = sandia_performance_service.loader.is_mock

    if require_sandia and (not sandia_ready or is_mock):
        raise HTTPException(
            status_code=503,
            detail=f"Required Sandia model is unavailable: {sandia_performance_service.loader.unavailability_reason}",
        )

    return {
        "status": "ready",
        "sandia_ready": sandia_ready,
        "sandia_mock": is_mock,
        "sandia_model_id": getattr(sandia_performance_service.loader.target_definition, "target_name", "sandia_v1"),
        "yolo_ready": inference_service.is_ready(),
        "storage_available": settings.storage_dir.exists(),
    }


@app.get("/model", response_model=ModelInfo)
@app.get("/api/model", response_model=ModelInfo)
def model_info() -> ModelInfo:
    return ModelInfo(**inference_service.model_info())


async def run_inspection(
    file: UploadFile,
    diagnostic: bool = False,
    confidence: float | None = None,
    image_size: int | None = None,
) -> InspectionResponse:
    # 1. Media type validation
    if not file.content_type or not file.content_type.startswith("image/"):
        logger.warning("Rejected upload with invalid media type: %s", file.content_type)
        raise HTTPException(
            status_code=415,
            detail="Unsupported media type. Please upload a valid EL/NIR image file.",
        )

    # 2. Payload size & empty-file validation
    payload = await file.read()
    if len(payload) == 0:
        logger.warning("Rejected upload: empty payload (0 bytes) for %s", file.filename)
        raise HTTPException(status_code=400, detail="The uploaded image file is empty (0 bytes).")

    if len(payload) > settings.max_upload_size_bytes:
        logger.warning("Rejected upload: payload size %d exceeds limit %d", len(payload), settings.max_upload_size_bytes)
        raise HTTPException(
            status_code=413,
            detail=f"Image exceeds the maximum upload size of {settings.max_upload_size_bytes // (1024 * 1024)} MB.",
        )

    # 3. Image decoding & sanity validation
    try:
        image = load_image_safely(payload)
    except Exception as exc:
        logger.warning("Failed to decode uploaded image '%s': %s", file.filename, exc)
        raise HTTPException(
            status_code=400,
            detail=f"The uploaded file is not a readable image: {exc}",
        ) from exc

    # 4. Model checkpoint verification
    if not settings.model_path.exists():
        logger.error("Inference requested but model checkpoint is missing at %s", settings.model_path)
        raise HTTPException(
            status_code=503,
            detail="YOLO model checkpoint not found. Please place best.pt in the configured model path.",
        )

    inspection_id = str(uuid.uuid4())
    effective_confidence = settings.confidence_threshold if confidence is None else confidence
    effective_image_size = settings.image_size if image_size is None else image_size

    # 5. YOLO inference execution
    started_time = time.perf_counter()
    try:
        detections, annotated, processing_time_ms = inference_service.predict(
            image, confidence=effective_confidence, image_size=effective_image_size
        )
    except Exception as exc:
        logger.error("Inference execution failed for inspection %s: %s", inspection_id, exc, exc_info=True)
        raise HTTPException(
            status_code=503,
            detail=f"Inference execution failed: {exc}",
        ) from exc

    # 6. Storage persistence (local filesystem)
    suffix = Path(file.filename or "image.jpg").suffix or ".jpg"
    output_path = settings.storage_dir / f"{inspection_id}-annotated.jpg"
    input_path = settings.storage_dir / f"{inspection_id}-input{suffix}"
    try:
        cv2.imwrite(str(output_path), annotated)
        input_path.write_bytes(payload)
    except Exception as storage_exc:
        logger.warning("Could not persist image files to local storage for %s: %s", inspection_id, storage_exc)

    confidences = [d.confidence for d in detections]
    summary = InspectionSummary(
        total_detections=len(detections),
        average_confidence=round(sum(confidences) / len(confidences), 6) if confidences else None,
        highest_confidence=round(max(confidences), 6) if confidences else None,
    )

    diagnostic_result = None
    if diagnostic:
        try:
            diagnostic_result = inference_service.diagnostics(
                image, image_size=effective_image_size
            )
        except Exception as diag_exc:
            logger.error("Diagnostic execution failed for inspection %s: %s", inspection_id, diag_exc, exc_info=True)
            raise HTTPException(
                status_code=500,
                detail=f"Diagnostic execution failed: {diag_exc}",
            ) from diag_exc

    total_elapsed_ms = (time.perf_counter() - started_time) * 1000

    logger.info(
        "Inspection %s complete: file=%s, conf=%.2f, detections=%d, inference_ms=%.1f, total_ms=%.1f",
        inspection_id,
        file.filename,
        effective_confidence,
        len(detections),
        processing_time_ms,
        total_elapsed_ms,
    )

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
        persistence="local_filesystem_pending_supabase"
        if not settings.supabase_configured
        else "supabase_adapter_ready",
        inference_configuration=InferenceConfiguration(
            confidence_threshold=effective_confidence,
            iou_threshold=settings.iou_threshold,
            image_size=effective_image_size,
            width=int(image.shape[1]),
            height=int(image.shape[0]),
            class_names=inference_service.class_names(),
        ),
        diagnostics=InspectionDiagnostics(
            pre_nms_raw_prediction_count=diagnostic_result["pre_nms_raw_prediction_count"],
            pre_nms_raw_prediction_status=diagnostic_result["pre_nms_raw_prediction_status"],
            nms_filtered_candidate_count=diagnostic_result["nms_filtered_candidate_count"],
            candidate_confidence=diagnostic_result["candidate_confidence"],
            threshold_comparison=[
                ThresholdDiagnostic(**item) for item in diagnostic_result["threshold_comparison"]
            ],
            image_properties=diagnostic_result["image_properties"],
        )
        if diagnostic_result
        else None,
    )


@app.post("/inspect", response_model=InspectionResponse)
@app.post("/api/inspections", response_model=InspectionResponse)
async def inspect(
    file: UploadFile = File(...),
    diagnostic: bool = Query(False, description="Run diagnostic comparison across threshold ladder"),
    confidence: float | None = Query(
        None,
        ge=0.0,
        le=1.0,
        description="Confidence threshold override (defaults to settings: 0.25)",
    ),
    image_size: int | None = Query(
        None,
        ge=32,
        le=4096,
        description="Inference image resolution override (defaults to settings: 640)",
    ),
) -> InspectionResponse:
    return await run_inspection(
        file, diagnostic=diagnostic, confidence=confidence, image_size=image_size
    )
