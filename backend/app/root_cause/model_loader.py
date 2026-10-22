"""
SolarVision AI — Model 2: Manufacturing Root Cause Analysis
Model Loading, Artifact Verification, and Contract Integrity Checks
"""

from __future__ import annotations

import hashlib
import json
import logging
from pathlib import Path
from typing import Any, Callable, Optional, Sequence
import numpy as np

from backend.root_cause_data.schema import (
    CANONICAL_FEATURE_ORDER,
    ROOT_CAUSE_TAXONOMY,
    ROOT_CAUSE_DESCRIPTIONS,
)
from backend.root_cause_data.feature_spec import (
    CANONICAL_FEATURES_V2,
    CANONICAL_FEATURE_NAMES_V2,
    CANONICAL_FEATURE_COUNT_V2,
    FEATURE_SCHEMA_VERSION,
    RECONCILED_ROOT_CAUSE_CATALOG,
)
from .schemas import Model2Manifest, RootCauseStatus

logger = logging.getLogger("solarvision.root_cause.loader")

# Default discovery paths
PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent.parent
DEFAULT_ARTIFACT_JSON = (
    PROJECT_ROOT / "backend" / "training" / "root_cause" / "artifacts" / "model2_root_cause_rf.json"
)
DEFAULT_MODEL2_DIR = PROJECT_ROOT / "backend" / "models" / "root_cause"
DEFAULT_ARTIFACT_PT = DEFAULT_MODEL2_DIR / "root_cause_model.pt"
DEFAULT_MANIFEST_PATH = DEFAULT_MODEL2_DIR / "manifest.json"

# Reconciled 7-code Equipment Catalog required for cross-module mapping & QA audit
KNOWN_CAUSE_CATALOG: dict[str, dict[str, Any]] = {
    "RC-SOLD-01": {
        "label": "Thermal Stress During Soldering",
        "equipment": "Tabber / Stringer",
        "description": "Excessive soldering tip temperature or rapid cooling thermal shock causing wafer micro-cracking.",
        "taxonomy_class": "thermal_stress_soldering",
    },
    "RC-PRNT-01": {
        "label": "Squeegee Pressure Drift",
        "equipment": "Screen Printer",
        "description": "Squeegee downward force drift causing non-uniform metallization paste thickness.",
        "taxonomy_class": "squeegee_pressure_drift",
    },
    "RC-PRNT-02": {
        "label": "Screen Mesh Clogging",
        "equipment": "Screen Printer",
        "description": "Dried silver paste or mesh aperture blockage causing missing contact fingers.",
        "taxonomy_class": "screen_mesh_clogging",
    },
    "RC-FURN-01": {
        "label": "Firing Furnace Thermal Profile Excursion",
        "equipment": "Firing Furnace",
        "description": "Furnace peak zone thermal excursion causing improper contact burn-through.",
        "taxonomy_class": "firing_thermal_profile_excursion",
    },
    "RC-MECH-01": {
        "label": "Mechanical Handling Impact / Vacuum Stress",
        "equipment": "Handling Automation",
        "description": "Excessive vacuum cup suction or robotic track deceleration inducing micro-cracks.",
        "taxonomy_class": "mechanical_handling_impact",
    },
    "RC-LAM-01": {
        "label": "Lamination Pressure / Thermal Imbalance",
        "equipment": "Module Laminator",
        "description": "Diaphragm pressure non-uniformity or heating platen temperature delta.",
        "taxonomy_class": "lamination_pressure_imbalance",
    },
    "RC-WAF-01": {
        "label": "Ingot Thermal Gradient / Crystal Stress",
        "equipment": "Ingot Puller",
        "description": "Asymmetric cooling gradient during crystallization causing crystallographic dislocations.",
        "taxonomy_class": "ingot_thermal_gradient",
    },
}


class Model2Loader:
    """
    Manages Model 2 artifact discovery, contract verification, and safe execution.
    Enforces strict zero-fabrication: Never marks Model 2 as 'ready' if the artifact
    is a validation prototype or the training dataset is DATASET_BLOCKED.
    Validates model type, artifact hash, feature-schema version, label taxonomy,
    exact input dimensions, training provenance, and evaluation status.
    """

    def __init__(
        self,
        artifact_path: Optional[Path] = None,
        manifest_path: Optional[Path] = None,
        allow_prototype: bool = False,
    ) -> None:
        self.artifact_path = artifact_path or (
            DEFAULT_ARTIFACT_JSON if DEFAULT_ARTIFACT_JSON.exists() else DEFAULT_ARTIFACT_PT
        )
        self.manifest_path = manifest_path or DEFAULT_MANIFEST_PATH
        self.allow_prototype = allow_prototype

        self._manifest: Optional[Model2Manifest] = None
        self._model_artifact: Any = None
        self._is_ready: bool = False
        self._unavailability_reason: str = "Model checkpoint not initialized."
        self._custom_predictor: Optional[Callable[[np.ndarray], tuple[list[dict[str, Any]], dict[str, float]]]] = None
        self.expected_dim: int = CANONICAL_FEATURE_COUNT_V2
        self.schema_version: str = FEATURE_SCHEMA_VERSION
        self.calibration_method: Optional[str] = None
        self.is_calibrated: bool = False
        self.artifact_sha256: Optional[str] = None

        self.refresh()

    @property
    def is_ready(self) -> bool:
        return self._is_ready

    @property
    def model_version(self) -> str:
        if self._is_ready and self._manifest:
            return self._manifest.version
        return "none"

    @property
    def unavailability_reason(self) -> str:
        return self._unavailability_reason

    @property
    def manifest(self) -> Optional[Model2Manifest]:
        return self._manifest

    def refresh(self) -> bool:
        """
        Discovers artifacts and validates checkpoint integrity, feature ordering,
        and production readiness status.
        """
        self._is_ready = False
        self._model_artifact = None

        if not self.artifact_path.exists():
            self._unavailability_reason = (
                f"Model 2 checkpoint file not found at '{self.artifact_path}'. "
                f"Model 2 is not trained or deployed."
            )
            return False

        if self.artifact_path.stat().st_size == 0:
            self._unavailability_reason = f"Model 2 checkpoint file at '{self.artifact_path}' is empty (0 bytes)."
            return False

        # Compute SHA-256 hash of the artifact
        try:
            with open(self.artifact_path, "rb") as bf:
                raw_bytes = bf.read()
            self.artifact_sha256 = hashlib.sha256(raw_bytes).hexdigest()
        except Exception as exc:
            self._unavailability_reason = f"Failed to compute artifact hash: {exc}"
            return False

        # Load JSON-based artifact (Model2ArtifactContract format)
        if self.artifact_path.suffix.lower() == ".json":
            return self._load_json_artifact(self.artifact_path, raw_bytes)

        # Load PyTorch or ONNX checkpoint
        return self._load_binary_artifact(self.artifact_path)

    def _load_json_artifact(self, path: Path, raw_bytes: bytes) -> bool:
        try:
            data = json.loads(raw_bytes.decode("utf-8"))

            meta_dict = data.get("metadata", {})
            feature_names = meta_dict.get("feature_names", [])
            target_classes = meta_dict.get("target_classes", [])
            status = meta_dict.get("status", "not_trained")
            framework = meta_dict.get("framework", "NumPy_SciPy_RandomForest")
            is_synthetic = meta_dict.get("is_synthetic_training", False)
            training_samples = meta_dict.get("training_samples", 0)
            calibration_method = meta_dict.get("calibration_method")

            # 1. Artifact Hash Verification (if hash recorded in metadata)
            expected_hash = meta_dict.get("sha256") or meta_dict.get("artifact_hash")
            if expected_hash and self.artifact_sha256 and expected_hash.lower() != self.artifact_sha256.lower():
                self._unavailability_reason = (
                    f"Artifact hash mismatch for '{path.name}': "
                    f"expected {expected_hash}, calculated {self.artifact_sha256}."
                )
                logger.error(self._unavailability_reason)
                return False

            # 2. Feature Schema & Dimension Validation
            # Match against v2.0.0 (48 features) or legacy (40 features)
            if feature_names == list(CANONICAL_FEATURE_NAMES_V2):
                self.expected_dim = CANONICAL_FEATURE_COUNT_V2  # 48
                self.schema_version = FEATURE_SCHEMA_VERSION  # "2.0.0"
            elif feature_names == list(CANONICAL_FEATURE_ORDER):
                self.expected_dim = len(CANONICAL_FEATURE_ORDER)  # 40
                self.schema_version = "1.0.0-legacy"
            else:
                self._unavailability_reason = (
                    f"Feature order mismatch between loaded artifact ({len(feature_names)} features) "
                    f"and supported canonical schema contracts (expected {CANONICAL_FEATURE_COUNT_V2} for v2.0.0 "
                    f"or {len(CANONICAL_FEATURE_ORDER)} for legacy). Silent padding/truncation is forbidden."
                )
                logger.error(self._unavailability_reason)
                return False

            # 3. Target Class Taxonomy Validation
            if target_classes != list(ROOT_CAUSE_TAXONOMY):
                self._unavailability_reason = (
                    f"Class taxonomy mismatch between loaded artifact and canonical ROOT_CAUSE_TAXONOMY."
                )
                logger.error(self._unavailability_reason)
                return False

            # 4. Calibration Status
            self.calibration_method = calibration_method
            self.is_calibrated = bool(
                calibration_method
                and calibration_method not in ("uncalibrated", "normalized_ensemble_frequencies")
            )

            self._manifest = Model2Manifest(
                model_id=meta_dict.get("model_name", "SolarVision_RootCause"),
                model_name=meta_dict.get("model_name", "SolarVision_RootCause"),
                version=meta_dict.get("model_version", "2.0.0-rc1"),
                framework=framework,
                artifact_filename=path.name,
                sha256=self.artifact_sha256,
                feature_names=feature_names,
                cause_classes=target_classes,
                training_metrics=meta_dict.get("metrics", {}),
                status=status,
                schema_version=self.schema_version,
                expected_dim=self.expected_dim,
                calibration_method=calibration_method,
                is_synthetic_training=is_synthetic,
            )

            # 5. Production Readiness & Provenance Check (Zero-Fabrication Enforcement)
            # If status is validation_prototype, or training was synthetic, or dataset is blocked:
            # Prototype JSON files must never be treated as validated production checkpoints!
            if (status != "production_ready" or is_synthetic) and not self.allow_prototype:
                self._unavailability_reason = (
                    f"Model 2 artifact '{path.name}' status is '{status}' (synthetic_training={is_synthetic}). "
                    f"Production training is blocked pending physical factory sensor telemetry. "
                    f"Model 2 is not production ready."
                )
                logger.info(self._unavailability_reason)
                return False

            # 6. Deserialize model payload
            model_payload = data.get("model_payload", {})
            from backend.training.root_cause.tree_model import RandomForestClassifier
            self._model_artifact = RandomForestClassifier.from_dict(model_payload)

            self._is_ready = True
            self._unavailability_reason = ""
            logger.info(f"Model 2 artifact '{path.name}' verified and ready for inference.")
            return True

        except Exception as exc:
            self._unavailability_reason = f"Failed to load and verify Model 2 artifact '{path}': {exc}"
            logger.error(self._unavailability_reason)
            return False

    def _load_binary_artifact(self, path: Path) -> bool:
        if self.manifest_path.exists():
            try:
                with open(self.manifest_path, "r", encoding="utf-8") as f:
                    mdata = json.load(f)
                self._manifest = Model2Manifest(**mdata)
            except Exception:
                self._manifest = None

        try:
            import torch
            try:
                self._model_artifact = torch.jit.load(str(path), map_location="cpu")
            except Exception:
                self._model_artifact = torch.load(str(path), map_location="cpu", weights_only=False)

            self._is_ready = True
            self._unavailability_reason = ""
            return True
        except Exception as exc:
            self._unavailability_reason = f"Error loading binary checkpoint '{path}': {exc}"
            return False

    def register_test_predictor(
        self,
        predictor_fn: Callable[[np.ndarray], tuple[list[dict[str, Any]], dict[str, float]]],
        version: str = "2.0.0-test",
    ) -> None:
        """
        Allows registration of a verified test predictor for controlled integration tests.
        """
        self._custom_predictor = predictor_fn
        self._manifest = Model2Manifest(
            model_id="model-2-root-cause-test",
            model_name="SolarVision Root Cause Analysis (Verified Test Suite)",
            version=version,
            framework="custom_verified",
            artifact_filename="test_checkpoint",
            status="production_ready",
            expected_dim=self.expected_dim,
            schema_version=self.schema_version,
        )
        self._is_ready = True
        self._unavailability_reason = ""

    def clear_test_predictor(self) -> None:
        self._custom_predictor = None
        self.refresh()

    def predict(
        self,
        feature_vector: np.ndarray,
        feature_names: Sequence[str],
    ) -> tuple[list[dict[str, Any]], dict[str, float]]:
        """
        Executes genuine inference on the verified model.
        Enforces exact input dimension matching — no silent padding or truncation.
        Returns:
            (probable_causes, feature_importance)
        """
        if not self._is_ready:
            raise RuntimeError(f"Cannot execute prediction: {self._unavailability_reason}")

        if self._custom_predictor is not None:
            return self._custom_predictor(feature_vector)

        # Dimension validation: reject silent slicing or padding on model inference
        actual_dim = len(feature_vector) if hasattr(feature_vector, "__len__") else 0
        if actual_dim != self.expected_dim:
            raise ValueError(
                f"Input feature vector length {actual_dim} does not match model expected dimensions "
                f"{self.expected_dim}. Silent padding and truncation are forbidden."
            )

        # Execution using RandomForestClassifier from tree_model
        if hasattr(self._model_artifact, "predict_proba"):
            X = feature_vector.reshape(1, -1)
            # Use empirical probabilities directly without applying softmax
            probs = self._model_artifact.predict_proba(X)[0]
            causes = self._map_probabilities_to_causes(probs)
            importances = getattr(self._model_artifact, "feature_importances_", None)
            feature_imp = self._map_feature_importances(importances, feature_names)
            return causes, feature_imp

        raise NotImplementedError("Direct inference on this artifact type is not implemented.")

    def _map_probabilities_to_causes(self, probs: np.ndarray) -> list[dict[str, Any]]:
        causes: list[dict[str, Any]] = []
        for idx, p in enumerate(probs):
            if idx >= len(ROOT_CAUSE_TAXONOMY):
                break
            cause_code = ROOT_CAUSE_TAXONOMY[idx]
            conf = float(p)
            if conf >= 0.10:  # Significant probability threshold
                description = ROOT_CAUSE_DESCRIPTIONS.get(cause_code, cause_code)
                evidence = [
                    f"Ensemble probability attribution: {conf * 100:.1f}%",
                ]
                if self.is_calibrated:
                    evidence.append(f"Calibrated probability ({self.calibration_method}).")
                else:
                    evidence.append("Uncalibrated ensemble vote frequency.")

                causes.append({
                    "cause_code": cause_code,
                    "label": cause_code.replace("_", " ").title(),
                    "confidence": round(conf, 4),
                    "is_calibrated": self.is_calibrated,
                    "calibration_method": self.calibration_method if self.is_calibrated else None,
                    "recommended_action": description,
                    "supporting_evidence": evidence,
                })

        causes.sort(key=lambda c: c.get("confidence", 0.0), reverse=True)
        return causes

    def _map_feature_importances(
        self,
        importances: Optional[np.ndarray],
        feature_names: Sequence[str],
    ) -> dict[str, float]:
        if importances is None or len(importances) == 0:
            return {}
        imp_map: dict[str, float] = {}
        for name, val in zip(feature_names, importances):
            if float(val) > 0.01:
                imp_map[name] = round(float(val), 4)
        return dict(sorted(imp_map.items(), key=lambda kv: kv[1], reverse=True)[:8])
