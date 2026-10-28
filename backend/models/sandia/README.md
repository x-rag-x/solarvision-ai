# Model 3: Sandia Solar Electrical Performance Prediction — Artifact Directory

This directory hosts the trained machine learning pipeline and schema artifacts for Model 3 (Sandia Solar Electrical Performance Prediction).

## Required Artifacts from Model Trainer

Once dataset preparation and training are complete, the model trainer must place the following artifacts in this directory (or configure alternative locations via environment variables):

1. **`pipeline.joblib`** (or path set by `SANDIA_MODEL_PATH`)
   - Fitted scikit-learn pipeline saved via `joblib.dump()`.
   - The pipeline should encapsulate all feature preprocessing (e.g., standard scaling, quantile transformations, polynomial features) and regression estimators.
   - Accepts 2D feature matrices and implements `.predict(X)`.

2. **`feature_schema.json`** (or path set by `SANDIA_SCHEMA_PATH`)
   - Complete schema specification containing feature names, data types, required flags, min/max bounds, and units.
   - **Important:** The backend dynamically loads all features, ordering, and validation rules from this file. Features are never hardcoded.
   - Example format:
     ```json
     {
       "schema_version": "1.0.0",
       "dataset_name": "Sandia PV Performance Telemetry",
       "features": [
         {
           "name": "effective_irradiance",
           "type": "float",
           "required": true,
           "unit": "W/m^2",
           "min_value": 0.0,
           "max_value": 1500.0,
           "description": "Plane-of-array effective solar irradiance"
         },
         {
           "name": "cell_temperature_c",
           "type": "float",
           "required": true,
           "unit": "degC",
           "min_value": -40.0,
           "max_value": 100.0,
           "description": "Back-of-module / PV cell temperature"
         }
       ],
       "metadata": {}
     }
     ```

3. **`target_definition.json`** (or path set by `SANDIA_TARGET_PATH`)
   - Specification of the target prediction metric, units, and valid range.
   - Target name, unit, and definition are loaded dynamically (e.g. power retention percentage, maximum power, etc.).
   - Example format:
     ```json
     {
       "target_name": "power_retention_pct",
       "target_type": "regression",
       "target_unit": "%",
       "description": "Relative electrical power retention percentage relative to STC rating",
       "min_value": 0.0,
       "max_value": 120.0,
       "metadata": {}
     }
     ```

4. **`sample_input.json`** (or path set by `SANDIA_SAMPLE_INPUT_PATH`)
   - Valid sample JSON input object conforming strictly to `feature_schema.json`.

5. **`manifest.json`** *(Recommended)*
   - Metadata containing SHA-256 integrity hash of `pipeline.joblib`, version, scikit-learn version, and training evaluation metrics.
   - Example:
     ```json
     {
       "version": "1.0.0",
       "sha256": "abcdef...",
       "framework": "scikit-learn",
       "training_date": "2026-10-28T00:00:00Z"
     }
     ```
