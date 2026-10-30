from __future__ import annotations

import time
_import_start_time = time.perf_counter()

from contextlib import asynccontextmanager
import logging
import os
from typing import Any
from pathlib import Path
import time
import uuid

import asyncio
import cv2
import numpy as np
from fastapi import FastAPI, File, HTTPException, Query, UploadFile
from fastapi.staticfiles import StaticFiles
from starlette.concurrency import run_in_threadpool

from .config import settings
from .inference import image_to_data_url, inference_service, load_image_safely
from .predictive_maintenance.api import router as predictive_maintenance_router
from .predictive_quality.api import router as predictive_quality_router
from .quality_screening.router import router as model2_elpv_router
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
    lifespan_start = time.perf_counter()
    settings.ensure_paths()
    logger.info("[TIMING:LIFESPAN] Starting SolarVision AI Inference API lifespan startup...")
    logger.info("Configured YOLO model path: %s (lazy_load=%s)", settings.model_path, settings.yolo_lazy_load)

    # 1. Sandia Model 3 status check
    t_sandia_0 = time.perf_counter()
    sandia_ready = sandia_performance_service.loader.is_ready
    is_mock = sandia_performance_service.loader.is_mock
    sandia_time_ms = (time.perf_counter() - t_sandia_0) * 1000
    if sandia_ready and not is_mock:
        logger.info(
            "[STARTUP:SANDIA] Genuine Model 3 Sandia pipeline verified and ready in %.1f ms (target=%s, dim=%s).",
            sandia_time_ms,
            getattr(sandia_performance_service.loader.target_definition, "target_name", "sandia_v1"),
            sandia_performance_service.loader.expected_dim,
        )
    elif sandia_ready and is_mock:
        logger.warning(
            "[STARTUP:SANDIA] Sandia model loaded in MOCK mode (synthetic predictor). Genuine checkpoint required for production."
        )
    else:
        logger.warning(
            "[STARTUP:SANDIA] Sandia performance model pipeline not loaded (%s). Requests will return 503.",
            sandia_performance_service.loader.unavailability_reason,
        )

    # 2. YOLO Model 1 initialization check (lazy vs eager)
    if settings.model_path.exists():
        if settings.yolo_lazy_load:
            logger.info(
                "[STARTUP:YOLO] YOLO model checkpoint present at %s. Lazy-loading active (deferred to first inference request).",
                settings.model_path,
            )
        else:
            logger.info("[STARTUP:YOLO] Eager loading YOLO model checkpoint from %s...", settings.model_path)
            t_yolo_0 = time.perf_counter()
            try:
                inference_service.load()
                yolo_time_ms = (time.perf_counter() - t_yolo_0) * 1000
                logger.info(
                    "[STARTUP:YOLO] YOLO model checkpoint loaded eagerly in %.1f ms. Readiness verified.",
                    yolo_time_ms,
                )
            except Exception as exc:
                logger.error("[STARTUP:YOLO] Failed to eagerly initialize YOLO model checkpoint: %s", exc, exc_info=True)
    else:
        logger.warning(
            "[STARTUP:YOLO] YOLO model checkpoint not found at %s. Inference requests will return 503 until best.pt is provided.",
            settings.model_path,
        )

    total_lifespan_ms = (time.perf_counter() - lifespan_start) * 1000
    logger.info(
        "[TIMING:LIFESPAN] FastAPI lifespan startup completed in %.1f ms. Server listening on loopback.",
        total_lifespan_ms,
    )
    yield
    logger.info("[SHUTDOWN] SolarVision AI Inference API shut down cleanly.")

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
app.include_router(model2_elpv_router)

_import_elapsed_ms = (time.perf_counter() - _import_start_time) * 1000
logger.info("[TIMING:IMPORT] Python backend modules imported and routes mounted in %.1f ms", _import_elapsed_ms)



def get_process_rss_mb() -> float | None:
    try:
        import psutil
        return round(psutil.Process().memory_info().rss / (1024 * 1024), 2)
    except Exception:
        return None


# Bounded concurrency: allow at most 1 heavy YOLO inference at a time to prevent CPU/RAM exhaustion
_inference_semaphore: asyncio.Semaphore | None = None

def get_inference_semaphore() -> asyncio.Semaphore:
    global _inference_semaphore
    if _inference_semaphore is None:
        max_concurrent = int(os.getenv("MAX_CONCURRENT_INFERENCES", "1"))
        _inference_semaphore = asyncio.Semaphore(max_concurrent)
    return _inference_semaphore


def _save_inspection_artifacts(
    output_path: Path, input_path: Path, annotated: np.ndarray, payload: bytes
) -> None:
    try:
        cv2.imwrite(str(output_path), annotated)
        input_path.write_bytes(payload)
    except Exception as storage_exc:
        logger.warning("Could not persist image files to local storage: %s", storage_exc)


@app.get("/health")
@app.get("/api/health")
async def health() -> dict[str, str | bool]:
    return {
        "status": "ok",
        "model_exists": settings.model_path.exists(),
        "storage_available": settings.storage_dir.exists(),
        "model_ready": inference_service.is_ready(),
    }


@app.get("/health/ready")
@app.get("/api/health/ready")
async def health_ready() -> dict[str, Any]:
    require_sandia = os.getenv("REQUIRE_SANDIA_MODEL", "false").lower() in ("true", "1", "yes")
    sandia_ready = sandia_performance_service.loader.is_ready
    is_mock = sandia_performance_service.loader.is_mock

    if require_sandia and (not sandia_ready or is_mock):
        logger.warning(
            "Sandia model unavailable for ready check: %s",
            sandia_performance_service.loader.unavailability_reason,
        )
        raise HTTPException(
            status_code=503,
            detail="Required Sandia performance model is unavailable.",
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
async def model_info() -> ModelInfo:
    return ModelInfo(**inference_service.model_info())


async def run_inspection(
    file: UploadFile,
    diagnostic: bool = False,
    confidence: float | None = None,
    image_size: int | None = None,
) -> InspectionResponse:
    t_start = time.perf_counter()
    rss_start = get_process_rss_mb()

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
        logger.warning(
            "Rejected upload: payload size %d exceeds limit %d",
            len(payload),
            settings.max_upload_size_bytes,
        )
        raise HTTPException(
            status_code=413,
            detail=f"Image exceeds the maximum upload size of {settings.max_upload_size_bytes // (1024 * 1024)} MB.",
        )

    # 3. Model checkpoint verification
    if not settings.model_path.exists():
        logger.error("Inference requested but model checkpoint is missing at %s", settings.model_path)
        raise HTTPException(
            status_code=503,
            detail="YOLO model checkpoint not found. Please place best.pt in the configured model path.",
        )

    inspection_id = str(uuid.uuid4())
    semaphore = get_inference_semaphore()

    # Bounded concurrency: serialize heavy YOLO inference to protect container CPU/RAM
    async with semaphore:
        t_queue_wait_ms = (time.perf_counter() - t_start) * 1000

        # A. Offload image decoding to threadpool
        t_prep_0 = time.perf_counter()
        try:
            image = await run_in_threadpool(load_image_safely, payload)
        except Exception as exc:
            logger.warning("Failed to decode uploaded image '%s': %s", file.filename, exc)
            raise HTTPException(
                status_code=400,
                detail=f"The uploaded file is not a readable image: {exc}",
            ) from exc
        prep_ms = (time.perf_counter() - t_prep_0) * 1000
        rss_after_prep = get_process_rss_mb()

        # B. Offload lazy model loading to threadpool if needed
        t_load_0 = time.perf_counter()
        model_was_ready = inference_service.is_ready()
        if not model_was_ready:
            logger.info("[YOLO:LAZY] Checkpoint loading triggered by inspection %s", inspection_id)
            try:
                await run_in_threadpool(inference_service.load)
            except Exception as exc:
                logger.error("Failed to load YOLO model: %s", exc, exc_info=True)
                raise HTTPException(
                    status_code=503,
                    detail=f"Failed to load YOLO model checkpoint: {exc}",
                ) from exc
            load_ms = (time.perf_counter() - t_load_0) * 1000
        else:
            load_ms = 0.0
        rss_after_load = get_process_rss_mb()

        # C. Offload YOLO inference forward pass to threadpool
        effective_confidence = settings.confidence_threshold if confidence is None else confidence
        effective_image_size = settings.image_size if image_size is None else image_size
        t_infer_0 = time.perf_counter()
        try:
            detections, annotated, internal_infer_ms = await run_in_threadpool(
                inference_service.predict,
                image,
                confidence=effective_confidence,
                image_size=effective_image_size,
            )
        except Exception as exc:
            logger.error("Inference execution failed for inspection %s: %s", inspection_id, exc, exc_info=True)
            raise HTTPException(
                status_code=503,
                detail=f"Inference execution failed: {exc}",
            ) from exc
        infer_wall_ms = (time.perf_counter() - t_infer_0) * 1000
        rss_after_infer = get_process_rss_mb()

        # D. Offload diagnostics to threadpool if requested
        diagnostic_result = None
        diag_ms = 0.0
        if diagnostic:
            t_diag_0 = time.perf_counter()
            try:
                diagnostic_result = await run_in_threadpool(
                    inference_service.diagnostics,
                    image,
                    image_size=effective_image_size,
                )
            except Exception as diag_exc:
                logger.error("Diagnostic execution failed for inspection %s: %s", inspection_id, diag_exc, exc_info=True)
                raise HTTPException(
                    status_code=500,
                    detail=f"Diagnostic execution failed: {diag_exc}",
                ) from diag_exc
            diag_ms = (time.perf_counter() - t_diag_0) * 1000

        # E. Offload file persistence to threadpool
        suffix = Path(file.filename or "image.jpg").suffix or ".jpg"
        output_path = settings.storage_dir / f"{inspection_id}-annotated.jpg"
        input_path = settings.storage_dir / f"{inspection_id}-input{suffix}"
        await run_in_threadpool(_save_inspection_artifacts, output_path, input_path, annotated, payload)

        # F. Offload base64 data URL serialization to threadpool
        t_serial_0 = time.perf_counter()
        annotated_data_url = await run_in_threadpool(image_to_data_url, annotated)
        serial_ms = (time.perf_counter() - t_serial_0) * 1000
        rss_end = get_process_rss_mb()

        total_elapsed_ms = (time.perf_counter() - t_start) * 1000
        peak_rss = max(filter(None, [rss_start, rss_after_prep, rss_after_load, rss_after_infer, rss_end]), default=0.0)
        delta_rss = round((rss_end or 0.0) - (rss_start or 0.0), 2)

        logger.info(
            "[TIMING:INSPECTION] id=%s file='%s' conf=%.2f dets=%d | prep=%.1fms load=%.1fms infer=%.1fms diag=%.1fms serial=%.1fms total=%.1fms | queue_wait=%.1fms | rss_start=%.1fMB peak=%.1fMB end=%.1fMB (delta=%+.1fMB)",
            inspection_id,
            file.filename,
            effective_confidence,
            len(detections),
            prep_ms,
            load_ms,
            infer_wall_ms,
            diag_ms,
            serial_ms,
            total_elapsed_ms,
            t_queue_wait_ms,
            rss_start or 0.0,
            peak_rss,
            rss_end or 0.0,
            delta_rss,
        )

        confidences = [d.confidence for d in detections]
        summary = InspectionSummary(
            total_detections=len(detections),
            average_confidence=round(sum(confidences) / len(confidences), 6) if confidences else None,
            highest_confidence=round(max(confidences), 6) if confidences else None,
        )

        return InspectionResponse(
            inspection_id=inspection_id,
            status="completed",
            source_filename=file.filename or "uploaded-image",
            model_name="YOLO26n",
            processing_time_ms=round(internal_infer_ms, 2),
            summary=summary,
            detections=detections,
            original_image_url=f"/storage/{input_path.name}",
            annotated_image_url=f"/storage/{output_path.name}",
            annotated_image_data_url=annotated_data_url,
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
