"""
SolarVision AI — Model 3: Sandia Solar Electrical Performance Prediction
Model Loading, Dynamic Schema Ingestion, and Inference Engine
"""

from __future__ import annotations

import hashlib
import json
import logging
from pathlib import Path
from typing import Any, Callable, Dict, List, Optional, Tuple, Union
import numpy as np

try:
    import pandas as pd
except ImportError:
    pd = None

try:
    import joblib
except ImportError:
    joblib = None

from ..config import settings
from .artifact_fetcher import (
    EXPECTED_SANDIA_SHA256,
    calculate_file_sha256,
    download_and_verify_artifact,
)
from .schemas import (
    FeatureSchemaManifest,
    FeatureSpec,
    SandiaPredictionInput,
    SandiaPredictionItem,
    TargetDefinitionManifest,
)

logger = logging.getLogger("solarvision.sandia_performance.loader")


class SandiaModelLoader:
    """Manages discovery, dynamic schema validation, scikit-learn .joblib pipeline loading, and inference execution."""

    def __init__(
        self,
        artifact_path: Optional[Union[Path, str]] = None,
        schema_path: Optional[Union[Path, str]] = None,
        sample_input_path: Optional[Union[Path, str]] = None,
        target_path: Optional[Union[Path, str]] = None,
        allow_mock: bool = False,
    ) -> None:
        self.artifact_path = Path(artifact_path or settings.sandia_model_path)
        self.schema_path = Path(schema_path or settings.sandia_schema_path)
        self.sample_input_path = Path(sample_input_path or settings.sandia_sample_input_path)
        self.target_path = Path(target_path or settings.sandia_target_path)
        self.allow_mock = allow_mock

        self.artifact_name: str = self.artifact_path.name
        self._pipeline: Any = None
        self._is_ready: bool = False
        self._is_mock: bool = False
        self._unavailability_reason: str = "Sandia model artifact has not been initialized."
        self._model_version: str = "none"
        self._manifest_meta: Dict[str, Any] = {}

        self._feature_schema: Optional[FeatureSchemaManifest] = None
        self._sample_input: Optional[Dict[str, Any]] = None
        self._target_definition: Optional[TargetDefinitionManifest] = None
        self._expected_dim: Optional[int] = None

        # Test predictor override hook for isolated mock testing
        self._mock_predictor: Optional[
            Callable[[np.ndarray, List[str]], Tuple[Any, Optional[str], Optional[float], Optional[float]]]
        ] = None

        self.load()

    @property
    def is_ready(self) -> bool:
        return self._is_ready

    @property
    def is_mock(self) -> bool:
        return self._is_mock

    @property
    def unavailability_reason(self) -> str:
        return self._unavailability_reason

    @property
    def model_version(self) -> str:
        return self._model_version

    @property
    def feature_schema(self) -> Optional[FeatureSchemaManifest]:
        return self._feature_schema

    @property
    def sample_input(self) -> Optional[Dict[str, Any]]:
        return self._sample_input

    @property
    def target_definition(self) -> Optional[TargetDefinitionManifest]:
        return self._target_definition

    @property
    def expected_dim(self) -> Optional[int]:
        return self._expected_dim

    def set_mock_predictor(
        self,
        mock_fn: Callable[[np.ndarray, List[str]], Tuple[Any, Optional[str], Optional[float], Optional[float]]],
        model_version: str = "mock-1.0.0",
        expected_dim: Optional[int] = None,
    ) -> None:
        """Injects an isolated mock predictor for automated unit/integration tests only."""
        self._mock_predictor = mock_fn
        self._is_mock = True
        self._is_ready = True
        self._model_version = model_version
        self._unavailability_reason = ""
        if expected_dim is not None:
            self._expected_dim = expected_dim
        logger.info("Mock predictor active on SandiaModelLoader (is_mock=True, version=%s)", model_version)

    def clear_mock(self) -> None:
        """Removes mock predictor and reloads from disk artifacts."""
        self._mock_predictor = None
        self._is_mock = False
        self.load()

    def load_schema(self) -> bool:
        """Loads and parses feature_schema.json if provided by the model trainer."""
        if not self.schema_path.exists():
            self._feature_schema = None
            return False

        try:
            with open(self.schema_path, "r", encoding="utf-8") as f:
                data = json.load(f)
            self._feature_schema = FeatureSchemaManifest(**data)
            self._expected_dim = len(self._feature_schema.features)
            logger.info(
                "Loaded feature_schema.json with %d features from %s",
                self._expected_dim,
                self.schema_path.name,
            )
            return True
        except Exception as exc:
            logger.warning("Failed to parse feature_schema.json: %s", exc)
            self._feature_schema = None
            return False

    def load_sample_input(self) -> bool:
        """Loads sample_input.json if provided by the model trainer."""
        if not self.sample_input_path.exists():
            self._sample_input = None
            return False

        try:
            with open(self.sample_input_path, "r", encoding="utf-8") as f:
                self._sample_input = json.load(f)
            logger.info("Loaded sample_input.json")
            return True
        except Exception as exc:
            logger.warning("Failed to parse sample_input.json: %s", exc)
            self._sample_input = None
            return False

    def load_target_definition(self) -> bool:
        """Loads target_definition.json dynamically if provided by the model trainer."""
        if not self.target_path.exists():
            self._target_definition = None
            return False

        try:
            with open(self.target_path, "r", encoding="utf-8") as f:
                data = json.load(f)
            self._target_definition = TargetDefinitionManifest(**data)
            logger.info("Loaded target_definition.json (target=%s)", self._target_definition.target_name)
            return True
        except Exception as exc:
            logger.warning("Failed to parse target_definition.json: %s", exc)
            self._target_definition = None
            return False

    def load(self) -> bool:
        """Discovers and loads the scikit-learn .joblib pipeline artifact and accompanying trainer schemas."""
        self.load_schema()
        self.load_sample_input()
        self.load_target_definition()

        # If an automated test mock predictor is active, retain mock readiness
        if self._mock_predictor is not None:
            self._is_ready = True
            self._is_mock = True
            return True

        self._is_ready = False
        self._is_mock = False
        self._pipeline = None

        if not self.artifact_path.exists():
            # Attempt secure download and verification from configured artifact storage location
            download_and_verify_artifact(target_path=self.artifact_path)

        if not self.artifact_path.exists():
            self._unavailability_reason = (
                f"Sandia solar performance model artifact ({self.artifact_name}) not found. "
                "Scikit-learn .joblib pipeline training is pending dataset preparation by trainer."
            )
            self._model_version = "none"
            logger.info(self._unavailability_reason)
            return False

        if joblib is None:
            self._unavailability_reason = (
                "joblib dependency is not installed in the python environment. "
                "Install joblib and scikit-learn to enable Sandia model inference."
            )
            logger.error(self._unavailability_reason)
            return False

        try:
            # Determine expected SHA-256 checksum
            expected_sha = EXPECTED_SANDIA_SHA256
            manifest_path = self.artifact_path.parent / "manifest.json"
            if manifest_path.exists():
                try:
                    with open(manifest_path, "r", encoding="utf-8") as mf:
                        self._manifest_meta = json.load(mf)
                    manifest_sha = self._manifest_meta.get("sha256")
                    if manifest_sha:
                        expected_sha = manifest_sha
                    self._model_version = str(self._manifest_meta.get("version", "1.0.0"))
                except Exception as m_exc:
                    logger.warning("Failed to parse manifest: %s", m_exc)

            # Strict SHA-256 cryptographic verification BEFORE deserialization
            computed_sha = calculate_file_sha256(self.artifact_path)
            if computed_sha.lower() != expected_sha.lower():
                self._unavailability_reason = (
                    "Model artifact integrity verification failed: SHA-256 checksum mismatch."
                )
                logger.error(
                    "SECURITY ALERT: Sandia model artifact SHA-256 mismatch: computed '%s', expected '%s'. "
                    "Deserialization rejected.",
                    computed_sha,
                    expected_sha,
                )
                return False

            # Load the complete trained pipeline via joblib
            loaded_obj = joblib.load(self.artifact_path)
            if not hasattr(loaded_obj, "predict") or not callable(loaded_obj.predict):
                self._unavailability_reason = (
                    "Loaded artifact does not provide a callable 'predict' method. "
                    "Expected a valid scikit-learn Pipeline or Estimator."
                )
                logger.error(self._unavailability_reason)
                return False

            self._pipeline = loaded_obj

            # Determine expected dimensions
            if hasattr(loaded_obj, "n_features_in_"):
                self._expected_dim = int(loaded_obj.n_features_in_)
            elif self._feature_schema and len(self._feature_schema.features) > 0:
                self._expected_dim = len(self._feature_schema.features)

            if self._model_version == "none":
                self._model_version = "1.0.0-trained"

            self._is_ready = True
            self._unavailability_reason = ""
            logger.info(
                "Sandia solar performance scikit-learn pipeline loaded successfully (dim=%s, version=%s)",
                self._expected_dim,
                self._model_version,
            )
            return True

        except Exception as exc:
            self._unavailability_reason = "Failed to load Sandia model pipeline artifact. Check artifact integrity."
            logger.error("Failed to load Sandia pipeline at %s: %s", self.artifact_path, exc, exc_info=True)
            self._is_ready = False
            return False

    def extract_features(
        self,
        input_data: SandiaPredictionInput,
    ) -> Tuple[Union[np.ndarray, Any], List[str], List[str]]:
        """
        Validates named input features strictly against trainer feature_schema.json.
        Rejects missing required features and unexpected features.
        Preserves trained pipeline preprocessing for missing optional values (np.nan).
        Returns: (feature_data, feature_names_used, list_of_warnings)
        """
        warnings: List[str] = []

        if self._feature_schema is None or len(self._feature_schema.features) == 0:
            # If schema has not yet been delivered by trainer, reject prediction until schema is supplied
            raise ValueError(
                "Trainer feature_schema.json is not yet available. "
                "Model cannot validate input features without the trainer's feature specification."
            )

        ordered_specs = self._feature_schema.features
        expected_names = [spec.name for spec in ordered_specs]
        expected_set = set(expected_names)
        input_keys = set(input_data.features.keys())

        # 1. Reject unexpected features
        unexpected = input_keys - expected_set
        if unexpected:
            raise ValueError(
                f"Unexpected feature(s) received: {sorted(list(unexpected))}. "
                f"Input features must strictly match trainer feature_schema.json."
            )

        # 2. Reject missing required features
        missing = [spec.name for spec in ordered_specs if spec.required and spec.name not in input_data.features]
        if missing:
            raise ValueError(
                f"Missing required feature(s): {missing}. "
                f"All required features specified in trainer feature_schema.json must be provided."
            )

        row_dict: Dict[str, Any] = {}
        mock_row: List[float] = []

        for spec in ordered_specs:
            is_present = spec.name in input_data.features
            raw_val = input_data.features.get(spec.name) if is_present else None

            if not is_present or raw_val is None:
                if spec.required:
                    raise ValueError(
                        f"Missing required feature(s): ['{spec.name}']. "
                        f"All required features specified in trainer feature_schema.json must be provided and non-null."
                    )
                # Missing optional feature (e.g. Total_Exposure)
                # Preserve model's trained missing-value preprocessing (np.nan for numerical, None for categorical)
                if spec.type in ("float", "int", "number"):
                    row_dict[spec.name] = np.nan
                    mock_row.append(0.0)
                else:
                    row_dict[spec.name] = None
                    mock_row.append(0.0)
                continue

            if spec.type in ("float", "int", "number"):
                try:
                    float_val = float(raw_val)
                except (TypeError, ValueError) as err:
                    raise ValueError(
                        f"Feature '{spec.name}' value '{raw_val}' could not be converted to float: {err}"
                    ) from err

                # Physical range boundaries (non-fatal telemetry warnings)
                if spec.min_value is not None and float_val < spec.min_value:
                    warnings.append(
                        f"Feature '{spec.name}' value {float_val} is below physical minimum {spec.min_value} {spec.unit or ''}".strip()
                    )
                if spec.max_value is not None and float_val > spec.max_value:
                    warnings.append(
                        f"Feature '{spec.name}' value {float_val} exceeds physical maximum {spec.max_value} {spec.unit or ''}".strip()
                    )
                row_dict[spec.name] = float_val
                mock_row.append(float_val)
            else:
                str_val = str(raw_val)
                row_dict[spec.name] = str_val
                try:
                    mock_row.append(float(str_val))
                except (TypeError, ValueError):
                    mock_row.append(0.0)

        # For mock predictor compatibility, return a numeric 2D array if mock is active
        if self._mock_predictor is not None:
            feature_matrix = np.array([mock_row], dtype=np.float64)
            return feature_matrix, expected_names, warnings

        # For real pipeline execution:
        # Build pandas DataFrame with named columns when pandas is available
        if pd is not None:
            df = pd.DataFrame([row_dict], columns=expected_names)
            return df, expected_names, warnings

        feature_matrix = np.array([mock_row], dtype=np.float64)
        return feature_matrix, expected_names, warnings

    def predict(self, input_data: SandiaPredictionInput) -> SandiaPredictionItem:
        """Executes inference using either isolated test mock predictor or loaded scikit-learn pipeline."""
        if not self._is_ready:
            raise RuntimeError(self._unavailability_reason)

        X, feature_names, warnings = self.extract_features(input_data)

        target_name: Optional[str] = (
            self._target_definition.target_name if self._target_definition else None
        )
        target_unit: Optional[str] = (
            self._target_definition.target_unit if self._target_definition else None
        )

        # Isolated mock execution (automated tests only)
        if self._mock_predictor is not None:
            pred_val, label, conf, uncert = self._mock_predictor(X, feature_names)
            return SandiaPredictionItem(
                module_id=input_data.module_id,
                prediction=pred_val,
                prediction_label=label,
                target_name=target_name,
                target_unit=target_unit,
                confidence=conf,
                uncertainty=uncert,
                features_used=feature_names,
                is_mock=True,
                warnings=warnings,
            )

        # Real scikit-learn pipeline execution
        # If pipeline expects named columns (feature_names_in_), supply DataFrame directly.
        # If pipeline was fitted on pure numpy array, convert DataFrame to numpy array.
        if pd is not None and isinstance(X, pd.DataFrame):
            if not hasattr(self._pipeline, "feature_names_in_"):
                try:
                    pipeline_input = X.to_numpy(dtype=np.float64)
                except Exception:
                    pipeline_input = X
            else:
                pipeline_input = X
        else:
            pipeline_input = X

        raw_pred = self._pipeline.predict(pipeline_input)

        # Extract scalar if single regression output
        if isinstance(raw_pred, np.ndarray):
            if raw_pred.size == 1:
                prediction_val: Union[float, int, List[float]] = float(raw_pred.item())
            else:
                prediction_val = [float(x) for x in raw_pred.flatten()]
        elif isinstance(raw_pred, (int, float)):
            prediction_val = raw_pred
        else:
            prediction_val = list(raw_pred)

        # Zero fabrication: confidence and uncertainty are None unless supported by pipeline
        confidence: Optional[float] = None
        uncertainty: Optional[float] = None
        prediction_label: Optional[str] = None

        if hasattr(self._pipeline, "predict_uncertainty"):
            try:
                uncertainty = float(self._pipeline.predict_uncertainty(pipeline_input)[0])
            except Exception:
                uncertainty = None

        return SandiaPredictionItem(
            module_id=input_data.module_id,
            prediction=prediction_val,
            prediction_label=prediction_label,
            target_name=target_name,
            target_unit=target_unit,
            confidence=confidence,
            uncertainty=uncertainty,
            features_used=feature_names,
            is_mock=False,
            warnings=warnings,
        )
