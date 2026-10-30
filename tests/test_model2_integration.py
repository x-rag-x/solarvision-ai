"""Run with PYTHONPATH=backend python -m pytest tests/test_model2_integration.py -v"""
import io
import json
from pathlib import Path
import pytest
from PIL import Image
from fastapi.testclient import TestClient
from app.main import app as main_app
from app.quality_screening.predictor import Model2ScreeningPredictor, InvalidCellImage, MODEL_DIR
from app.quality_screening.router import router


def test_sample_matches_exported_prediction():
    sample = (MODEL_DIR / 'model2_sample_elpv_cell.png').read_bytes()
    expected = json.loads((MODEL_DIR / 'model2_sample_prediction.json').read_text())
    actual = Model2ScreeningPredictor().predict_bytes(sample)
    assert actual['predicted_class'] == expected['predicted_class']
    assert abs(actual['defective_probability'] - expected['defective_probability']) < 1e-5
    assert actual['requires_manual_review'] is True
    assert actual['decision'] == 'screening_only'
    assert actual['review_status'] == 'pending'
    assert actual['threshold'] == 0.55


def test_main_app_mounts_model2_routes():
    client = TestClient(main_app)
    status_resp = client.get('/api/model2/elpv/status')
    assert status_resp.status_code == 200
    status_data = status_resp.json()
    assert status_data['model_id'] == 'solarvision_m2_elpv_binary_v1'
    assert status_data['artifacts_present'] is True


def test_router_rejects_invalid_media_and_empty():
    client = TestClient(main_app)
    # 1. Invalid MIME
    bad_mime = client.post(
        '/api/model2/elpv/predict',
        files={'image': ('fake.txt', b'not an image', 'text/plain')}
    )
    assert bad_mime.status_code == 415

    # 2. Empty payload
    empty_resp = client.post(
        '/api/model2/elpv/predict',
        files={'image': ('empty.png', b'', 'image/png')}
    )
    assert empty_resp.status_code == 400


def test_router_rejects_image_too_small():
    client = TestClient(main_app)
    tiny_img = Image.new('L', (32, 32), color=128)
    buf = io.BytesIO()
    tiny_img.save(buf, format='PNG')
    resp = client.post(
        '/api/model2/elpv/predict',
        files={'image': ('tiny.png', buf.getvalue(), 'image/png')}
    )
    assert resp.status_code == 422
    assert 'too small' in resp.json()['detail'].lower()


def test_router_successful_prediction_via_main_app():
    client = TestClient(main_app)
    image = (MODEL_DIR / 'model2_sample_elpv_cell.png').read_bytes()
    resp = client.post(
        '/api/model2/elpv/predict',
        files={'image': ('cell.png', image, 'image/png')}
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data['decision'] == 'screening_only'
    assert data['predicted_class'] in ('healthy', 'defective')
    assert data['requires_manual_review'] is True
    assert 0.0 <= data['defective_probability'] <= 1.0


def test_fail_closed_on_missing_checkpoint(tmp_path):
    # Empty directory with no checkpoint
    with pytest.raises(FileNotFoundError):
        Model2ScreeningPredictor(model_dir=tmp_path)
