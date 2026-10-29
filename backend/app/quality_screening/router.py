"""Add with: app.include_router(model2_elpv_router).

These endpoints are NOT an authentication layer. Expose through your existing
authenticated Node/tRPC service in production, or apply existing FastAPI auth.
"""
from functools import lru_cache
from fastapi import APIRouter, File, HTTPException, UploadFile
from .predictor import InvalidCellImage, Model2ScreeningPredictor

router = APIRouter(prefix='/api/model2/elpv', tags=['model2-elpv'])
MAX_BYTES = 8 * 1024 * 1024
ALLOWED_MIME = {'image/png', 'image/jpeg', 'image/tiff', 'image/bmp', 'image/webp'}

@lru_cache(maxsize=1)
def get_predictor():
    return Model2ScreeningPredictor()

@router.get('/status')
def status():
    # Do not eagerly load large models here just for a health check.
    from .predictor import MODEL_DIR
    needed = ('model2_efficientnet_b0.pt', 'model2_preprocessing.json')
    files_ready = all((MODEL_DIR / f).is_file() for f in needed)
    return {'model_id':'solarvision_m2_elpv_binary_v1',
            'artifacts_present': files_ready,
            'inference_verified': False,
            'note':'File presence only; use a separate smoke test for inference readiness.'}

@router.post('/predict')
async def predict(image: UploadFile = File(...)):
    if image.content_type not in ALLOWED_MIME:
        raise HTTPException(415, 'Unsupported image format')
    data = await image.read(MAX_BYTES + 1)
    if not data:
        raise HTTPException(400, 'Image is empty')
    if len(data) > MAX_BYTES:
        raise HTTPException(413, 'Image too large (8 MiB max)')
    try:
        result = get_predictor().predict_bytes(data)
    except InvalidCellImage as exc:
        raise HTTPException(422, str(exc)) from exc
    # Unexpected model failures should propagate to server error monitoring;
    # never disguise them as "healthy" predictions.
    return result
