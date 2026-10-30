"""Run with PYTHONPATH=backend python -m pytest tests/test_model2_integration.py -q"""
import json
from pathlib import Path
from fastapi import FastAPI
from fastapi.testclient import TestClient
from app.quality_screening.predictor import Model2ScreeningPredictor, MODEL_DIR
from app.quality_screening.router import router

def test_sample_matches_exported_prediction():
    sample = (MODEL_DIR/'model2_sample_elpv_cell.png').read_bytes()
    expected = json.loads((MODEL_DIR/'model2_sample_prediction.json').read_text())
    actual = Model2ScreeningPredictor().predict_bytes(sample)
    assert actual['predicted_class'] == expected['predicted_class']
    assert abs(actual['defective_probability']-expected['defective_probability']) < 1e-6
    assert actual['requires_manual_review'] is True

def test_router_rejects_invalid_and_predicts():
    app = FastAPI()
    app.include_router(router)
    client = TestClient(app)
    bad = client.post('/api/model2/elpv/predict',
                      files={'image':('fake.txt', b'not an image', 'text/plain')})
    assert bad.status_code == 415
    image = (MODEL_DIR/'model2_sample_elpv_cell.png').read_bytes()
    okay = client.post('/api/model2/elpv/predict',
                       files={'image':('cell.png', image, 'image/png')})
    assert okay.status_code == 200
    assert okay.json()['decision'] == 'screening_only'
