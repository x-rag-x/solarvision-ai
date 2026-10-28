# Model 3: Sandia Solar Electrical Performance Prediction — Artifact Directory

This directory hosts the trained machine learning pipeline and schema artifacts for Model 3 (Sandia Solar Electrical Performance Prediction).

## Contract Specification

- **Model ID:** `model3_sandia_reference_power_v1`
- **Algorithm:** Random Forest Regressor (`n_estimators=300`, `min_samples_leaf=3`, `random_state=42`) with `ColumnTransformer` preprocessing
- **Target:** `power_retention_pct` (Current measured PV module electrical power retention relative to the initial reference curve)
- **Output:** `predicted_power_retention_pct`
- **Target Unit:** `%` (prediction value represents a percentage)
- **Error Unit:** `percentage_points` (residuals and evaluation metrics such as MAE and RMSE are measured in percentage points)
- **Benchmark Evaluation Metrics:**
  - Test MAE: `0.7927` percentage points
  - Test RMSE: `1.1070` percentage points
  - Test R²: `0.5806`
- **Features (Strict Order):**
  1. `Total_Exposure` (float, optional; null values imputed via trained median imputer)
  2. `Nameplate_Pmp_(W)` (float, required)
  3. `Nameplate_Isc_(A)` (float, required)
  4. `Nameplate_Voc_(V)` (float, required)
  5. `Nameplate_Imp_(A)` (float, required)
  6. `Nameplate_Vmp_(V)` (float, required)
  7. `Make` (string, required)
  8. `Model` (string, required)
  9. `Cell_Wafer_Type` (string, required)

## Artifact Files

1. **`pipeline.joblib`** (Configured by `SANDIA_MODEL_PATH`, default `backend/models/sandia/pipeline.joblib`)
   - Fitted scikit-learn pipeline saved via `joblib.dump()`.
   - Encapsulates numeric imputation/scaling, categorical imputation/one-hot encoding, and random forest regression.
   - Accepts pandas `DataFrame` with exact feature column names.
   - Large binary artifact (~1.2MB): excluded from git repository by `.gitignore`.

2. **`feature_schema.json`** (Configured by `SANDIA_SCHEMA_PATH`)
   - Structured JSON specification conforming to `FeatureSchemaManifest`.
   - Dynamically loaded; contains feature names, types, and required flags.

3. **`target_definition.json`** (Configured by `SANDIA_TARGET_PATH`)
   - Dynamic target metric definition (`power_retention_pct`, unit `%`, error unit `percentage_points`).

4. **`sample_input.json`** (Configured by `SANDIA_SAMPLE_INPUT_PATH`)
   - Valid sample JSON input object conforming strictly to `feature_schema.json`.

5. **`manifest.json`**
   - SHA-256 integrity checksum manifest and training provenance.
   - Expected SHA-256: `045f9a15b7981c3e88ac18011dfa1b16821874bf211fa582cf148840e5dbf373`
   - File size: `1,246,515` bytes.

## Architectural Segregation

- **Tabular Foundation Model:** Active production pipeline (`model3_sandia_pipeline.joblib`).
- **Multimodal Head (`model3_sandia_multimodal_head.joblib`):** Research prototype fusing Model 1 EL-NIR defect detection embeddings with telemetry. Kept strictly separate from the tabular inference pathway.
- **Next-Observation Forecaster (`model3_sandia_next_observation_forecast.joblib`):** Sequential temporal model for dynamic yield transients. Kept strictly separate from reference-power regression.

## Reproducible Local Installation Process

To install the trained pipeline locally from trainer exports:

```bash
# 1. Copy the trusted joblib pipeline to the configured backend directory
cp /path/to/extracted/model3_sandia_pipeline.joblib backend/models/sandia/pipeline.joblib

# 2. Verify SHA-256 integrity against manifest.json
python -c "
import hashlib, json
expected = json.load(open('backend/models/sandia/manifest.json'))['sha256']
actual = hashlib.sha256(open('backend/models/sandia/pipeline.joblib', 'rb').read()).hexdigest()
assert actual == expected, f'Checksum mismatch: {actual} != {expected}'
print('Pipeline SHA-256 integrity verified successfully.')
"

# 3. Validate real inference against trainer sample prediction
python -c "
import json
from backend.app.sandia_performance.model_loader import SandiaModelLoader
from backend.app.sandia_performance.schemas import SandiaPredictionInput
loader = SandiaModelLoader()
sample = json.load(open('backend/models/sandia/sample_input.json'))
pred = loader.predict(SandiaPredictionInput(**sample))
print('Predicted Power Retention:', pred.prediction, '%')
assert abs(pred.prediction - 99.50759793687902) < 1e-4
print('Inference validation PASSED.')
"
```

## Deployment Artifact Requirements

In containerized or cloud environments (Docker, Kubernetes, CI/CD):
1. **Model Storage:** The large binary `pipeline.joblib` should be stored in S3/GCS or model registry and fetched during container startup or build stage into `/app/backend/models/sandia/pipeline.joblib`.
2. **Environment Variables:**
   - `SANDIA_MODEL_PATH`: Override if mounted in custom volume (e.g. `/mnt/models/pipeline.joblib`).
   - `SANDIA_SCHEMA_PATH`: Override if schema is hosted externally.
3. **Zero-Fabrication Guarantee:** When `pipeline.joblib` is absent, the backend returns HTTP 503 Service Unavailable with a clean, sanitized explanation instead of fabricating predictions.
