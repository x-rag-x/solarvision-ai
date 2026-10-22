"""
SolarVision AI — Model 4: Predictive Maintenance
Model Loader, SHA-256 Verification, Preprocessing Restoration & Real Inference
"""

from __future__ import annotations

import hashlib
import json
import logging
from pathlib import Path
from typing import Any, Callable, Dict, List, Optional, Tuple
import numpy as np

from .feature_extractor import (
    CANONICAL_MAINTENANCE_FEATURE_COUNT,
    CANONICAL_MAINTENANCE_FEATURE_NAMES,
    PredictiveMaintenanceFeatureExtractor,
)
from .schemas import (
    FailureMode,
    MachineHealthState,
    Model4Domain,
    Model4Manifest,
    RiskFactor,
)

logger = logging.getLogger("solarvision.predictive_maintenance.loader")

PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent.parent
DEFAULT_BENCHMARK_ARTIFACT_JSON = (
    PROJECT_ROOT / "backend" / "training" / "predictive_maintenance" / "artifacts" / "model4_predictive_maintenance.json"
)
DEFAULT_SOLAR_ARTIFACT_JSON = (
    PROJECT_ROOT / "backend" / "models" / "predictive_maintenance" / "model4_predictive_maintenance.json"
)


class Model4Loader:
    """Manages secure artifact discovery, SHA-256 integrity verification, and inference execution."""

    def __init__(
        self,
        artifact_path: Optional[Path | str] = None,
        domain: Model4Domain = Model4Domain.AI4I_SYNTHETIC_BENCHMARK,
        allow_prototype: bool = False,
    ) -> None:
        self.domain = domain
        self.allow_prototype = allow_prototype

        if artifact_path is not None:
            self.artifact_path = Path(artifact_path)
        elif self.domain == Model4Domain.AI4I_SYNTHETIC_BENCHMARK:
            self.artifact_path = DEFAULT_BENCHMARK_ARTIFACT_JSON
        else:
            self.artifact_path = DEFAULT_SOLAR_ARTIFACT_JSON

        self._is_ready: bool = False
        self._unavailability_reason: str = "Model 4 artifact has not been initialized."
        self._manifest: Optional[Model4Manifest] = None
        self._model_payload: Any = None
        self._scaler_means: Optional[np.ndarray] = None
        self._scaler_stds: Optional[np.ndarray] = None
        self._clip_zscore: float = 5.0
        self._platt_a: float = 1.0
        self._platt_b: float = 0.0
        self._optimal_threshold: float = 0.50
        self.expected_dim: int = CANONICAL_MAINTENANCE_FEATURE_COUNT
        self.model_version: str = "none"
        self.is_calibrated: bool = False
        self.calibration_method: str = "none"
        self.calibration_metrics: Dict[str, Any] = {}

        # Test predictor override hook
        self._test_predictor: Optional[
            Callable[[np.ndarray], Tuple[str, str, float, float, Dict[str, float]]]
        ] = None

        self.load()

    @property
    def is_ready(self) -> bool:
        return self._is_ready

    @property
    def unavailability_reason(self) -> str:
        return self._unavailability_reason

    @property
    def manifest(self) -> Optional[Model4Manifest]:
        return self._manifest

    @property
    def optimal_threshold(self) -> float:
        return self._optimal_threshold

    def load(self) -> bool:
        """Loads and verifies the Model 4 artifact."""
        self._is_ready = False

        # Domain isolation gate: Solar factory model is strictly NOT_TRAINED
        if self.domain == Model4Domain.SOLAR_FACTORY:
            self._unavailability_reason = (
                "Model 4 solar factory checkpoint not found. Training is blocked pending authentic "
                "in-situ IoT edge sensor telemetry from operational solar cell manufacturing lines."
            )
            logger.info(self._unavailability_reason)
            return False

        if not self.artifact_path.exists():
            self._unavailability_reason = (
                f"Model 4 predictive maintenance artifact not found at '{self.artifact_path}'."
            )
            logger.info(self._unavailability_reason)
            return False

        try:
            # 1. Compute SHA-256 checksum
            sha256_hash = hashlib.sha256()
            with open(self.artifact_path, "rb") as f:
                for chunk in iter(lambda: f.read(65536), b""):
                    sha256_hash.update(chunk)
            computed_sha = sha256_hash.hexdigest()

            # 2. Parse JSON artifact
            with open(self.artifact_path, "r", encoding="utf-8") as f:
                data = json.load(f)

            meta = data.get("metadata", {})

            # 2a. Verify SHA-256 checksum from sidecar or metadata
            expected_sha = meta.get("sha256") or meta.get("sha256_hash")
            if not expected_sha:
                sidecar_path = self.artifact_path.parent / f"{self.artifact_path.name}.sha256"
                if sidecar_path.exists():
                    try:
                        content = sidecar_path.read_text(encoding="utf-8").strip()
                        expected_sha = content.split()[0]
                    except Exception as e:
                        logger.warning("Failed to read sidecar sha256: %s", e)

            if expected_sha and expected_sha != computed_sha and not self.allow_prototype:
                self._unavailability_reason = (
                    f"SHA-256 integrity verification failed: expected '{expected_sha}', computed '{computed_sha}'."
                )
                logger.error(self._unavailability_reason)
                return False

            contract_ver = data.get("contract_version") or meta.get("schema_version", "")
            if contract_ver != "1.0.0":
                self._unavailability_reason = (
                    f"Model 4 artifact contract_version '{contract_ver}' does not match expected '1.0.0'."
                )
                logger.error(self._unavailability_reason)
                return False

            artifact_domain_str = meta.get("domain", "")
            if artifact_domain_str != "ai4i_synthetic_benchmark" and not self.allow_prototype:
                self._unavailability_reason = (
                    f"Domain mismatch: artifact claims domain '{artifact_domain_str}', expected 'ai4i_synthetic_benchmark'."
                )
                logger.error(self._unavailability_reason)
                return False

            eval_status = meta.get("status") or meta.get("evaluation_status", "not_trained")
            if eval_status in ("not_trained", "validation_prototype", "demo_only") and not self.allow_prototype:
                self._unavailability_reason = (
                    f"Model 4 artifact evaluation_status is '{eval_status}'. Production inference is blocked."
                )
                logger.info(self._unavailability_reason)
                return False

            expected_dim = int(meta.get("expected_dim", CANONICAL_MAINTENANCE_FEATURE_COUNT))
            self.expected_dim = expected_dim
            feature_names = meta.get("feature_names", CANONICAL_MAINTENANCE_FEATURE_NAMES)
            if len(feature_names) != CANONICAL_MAINTENANCE_FEATURE_COUNT:
                self._unavailability_reason = (
                    f"Dimension mismatch: artifact specifies {len(feature_names)} features, expected {CANONICAL_MAINTENANCE_FEATURE_COUNT}."
                )
                logger.error(self._unavailability_reason)
                return False

            model_name = meta.get("model_name", "AI4I_Predictive_Maintenance_Classifier")
            self.model_version = meta.get("model_version", "4.0.0-benchmark")
            self._optimal_threshold = float(meta.get("optimal_threshold", 0.35))

            calib_metrics = meta.get("calibration_metrics", {})
            self.calibration_metrics = calib_metrics
            self.is_calibrated = bool(calib_metrics.get("is_calibrated", meta.get("is_calibrated", True)))
            self.calibration_method = meta.get("calibration_method", "platt") if self.is_calibrated else "none"

            # Preprocessor parameters
            preproc = data.get("preprocessor", {})
            if "means" in preproc and "stds" in preproc:
                self._scaler_means = np.array(preproc["means"], dtype=np.float32)
                self._scaler_stds = np.array(preproc["stds"], dtype=np.float32)
            self._clip_zscore = float(preproc.get("clip_zscore", 5.0))

            self._model_payload = data.get("model_payload", {})
            cal_data = self._model_payload.get("calibrator", {})
            if cal_data.get("is_fitted"):
                self._platt_a = float(cal_data.get("platt_a", 1.0))
                self._platt_b = float(cal_data.get("platt_b", 0.0))
                self.is_calibrated = True
                self.calibration_method = cal_data.get("method", "platt")

            self._manifest = Model4Manifest(
                model_id=meta.get("model_id", "solarvision-model4-pdm"),
                model_name=model_name,
                version=self.model_version,
                framework=meta.get("framework", "scikit-learn / NumPy"),
                domain=self.domain,
                sha256=meta.get("sha256_hash", computed_sha),
                schema_version=contract_ver,
                expected_dim=expected_dim,
                feature_names=feature_names,
                target_classes=meta.get("target_classes", ["healthy", "failure"]),
                source_dataset=meta.get("dataset_name", "UCI AI4I 2020 Predictive Maintenance Dataset"),
                evaluation_status=eval_status,
                calibration_method=self.calibration_method,
                is_calibrated=self.is_calibrated,
                is_benchmark=True,
                limitations=[
                    "SYNTHETIC BENCHMARK DATASET (AI4I 2020). NOT VERIFIED FOR PV FACTORY EQUIPMENT.",
                    "Notice: Predictions reflect physics-based synthetic milling benchmark signals, not solar fab machinery.",
                ],
            )

            self._is_ready = True
            self._unavailability_reason = ""

            # Minimal valid inference verification call (smoke test)
            if self.domain == Model4Domain.AI4I_SYNTHETIC_BENCHMARK:
                try:
                    dummy_features = np.zeros(self.expected_dim, dtype=np.float32)
                    test_state, test_mode, test_fail_prob, test_healthy_prob, _, _ = self.predict(dummy_features)
                    if test_state not in (MachineHealthState.HEALTHY, MachineHealthState.WARNING, MachineHealthState.FAILURE):
                        raise RuntimeError(f"Unexpected smoke test health state: {test_state}")
                except Exception as smoke_exc:
                    self._unavailability_reason = f"Model 4 minimal validation inference failed: {smoke_exc}"
                    logger.error(self._unavailability_reason)
                    self._is_ready = False
                    return False

            logger.info("Model 4 benchmark artifact loaded and verified successfully.")
            return True

        except Exception as exc:
            self._unavailability_reason = f"Failed to load Model 4 artifact: {exc}"
            logger.error(self._unavailability_reason, exc_info=True)
            return False

    def predict(
        self,
        features: np.ndarray,
        domain: Optional[Model4Domain] = None,
    ) -> Tuple[MachineHealthState, FailureMode, float, float, Dict[str, float], List[RiskFactor]]:
        """
        Executes genuine inference on the canonical 6-D feature array.
        Returns: (health_state, failure_mode, failure_probability, healthy_probability, mode_probabilities, top_risk_factors)
        """
        target_domain = domain or self.domain

        if target_domain == Model4Domain.SOLAR_FACTORY:
            raise RuntimeError(
                "Domain segregation violation: Model 4 solar factory domain is strictly not_trained. "
                "Synthetic AI4I benchmark weights must never be evaluated for operational solar factory equipment."
            )

        if not self._is_ready and self._test_predictor is None:
            raise RuntimeError(f"Model 4 is not ready for inference: {self._unavailability_reason}")

        features_flat = np.asarray(features, dtype=np.float32).ravel()
        if len(features_flat) != self.expected_dim:
            raise ValueError(
                f"Feature vector dimensionality mismatch: expected {self.expected_dim}, got {len(features_flat)}. "
                f"Silent padding or truncation is strictly forbidden."
            )

        # Use test predictor hook if registered
        if self._test_predictor is not None:
            h_state_str, mode_str, p_fail, p_healthy, mode_probs = self._test_predictor(features_flat)
            h_state = MachineHealthState(h_state_str)
            f_mode = FailureMode(mode_str)
            return h_state, f_mode, p_fail, p_healthy, mode_probs, []

        # 1. Genuine Model Inference
        # Standardize features using restored preprocessor parameters
        if self._scaler_means is not None and self._scaler_stds is not None:
            stds = np.where(self._scaler_stds == 0, 1.0, self._scaler_stds)
            x_norm = np.clip(
                (features_flat - self._scaler_means) / stds,
                -self._clip_zscore,
                self._clip_zscore,
            )
        else:
            x_norm = features_flat

        p_fail = 0.0339  # AI4I prior base failure incidence
        if isinstance(self._model_payload, dict):
            if "stumps" in self._model_payload:
                # GradientBoostedMaintenanceClassifier
                f_val = float(self._model_payload.get("initial_log_odds", -3.3510138421327))
                lr = float(self._model_payload.get("learning_rate", 0.08))
                for stump in self._model_payload.get("stumps", []):
                    idx = int(stump["feature_idx"])
                    thresh = float(stump["threshold"])
                    val = float(x_norm[idx]) if idx < len(x_norm) else 0.0
                    f_val += lr * (float(stump["left_val"]) if val <= thresh else float(stump["right_val"]))

                raw_p = float(1.0 / (1.0 + np.exp(-np.clip(f_val, -20.0, 20.0))))

                # Platt probability calibration if calibrator is fitted
                if self.is_calibrated:
                    eps = 1e-6
                    p_c = np.clip(raw_p, eps, 1.0 - eps)
                    logits = np.log(p_c / (1.0 - p_c))
                    z = self._platt_a * logits + self._platt_b
                    p_fail = float(1.0 / (1.0 + np.exp(-np.clip(z, -20.0, 20.0))))
                else:
                    p_fail = raw_p

            elif "weights" in self._model_payload:
                w = np.array(self._model_payload["weights"], dtype=np.float32)
                intercept = float(self._model_payload.get("intercept", -3.35))
                score = intercept + float(np.dot(x_norm[:len(w)], w))
                p_fail = float(1.0 / (1.0 + np.exp(-np.clip(score, -15.0, 15.0))))

        p_fail = float(np.clip(p_fail, 0.0, 1.0))
        p_healthy = float(round(1.0 - p_fail, 4))
        p_fail = float(round(p_fail, 4))

        # 2. Classify health state using calibrated threshold
        is_failure = p_fail >= self._optimal_threshold
        is_warning = (not is_failure) and (p_fail >= 0.5 * self._optimal_threshold)

        if is_failure:
            health_state = MachineHealthState.FAILURE
        elif is_warning:
            health_state = MachineHealthState.WARNING
        else:
            health_state = MachineHealthState.HEALTHY

        # 3. Attribute failure mode using physical mechanism rules
        p_type = features_flat[0]
        air_t = features_flat[1]
        proc_t = features_flat[2]
        rpm = features_flat[3]
        torque = features_flat[4]
        tool_wear = features_flat[5]

        delta_t = proc_t - air_t
        power_w = torque * (rpm * (2.0 * np.pi / 60.0))
        strain = tool_wear * torque

        twf_cond = tool_wear >= 200.0
        hdf_cond = (delta_t < 8.6) and (rpm < 1380.0)
        pwf_cond = (power_w < 3500.0) or (power_w > 9000.0)
        osf_thresh = 11000.0 if p_type == 0.0 else (12000.0 if p_type == 1.0 else 13000.0)
        osf_cond = strain >= osf_thresh

        # Zero Fabrication: Do NOT convert a binary failure probability into unsupported per-mode probabilities.
        # Since no separately evaluated multi-mode ML model exists, mode_probabilities remains empty.
        mode_probs: Dict[str, float] = {}

        if not is_failure and not is_warning:
            failure_mode = FailureMode.NONE
        elif twf_cond:
            failure_mode = FailureMode.TOOL_WEAR_FAILURE
        elif hdf_cond:
            failure_mode = FailureMode.HEAT_DISSIPATION_FAILURE
        elif pwf_cond:
            failure_mode = FailureMode.POWER_FAILURE
        elif osf_cond:
            failure_mode = FailureMode.OVERSTRAIN_FAILURE
        elif is_failure:
            failure_mode = FailureMode.RANDOM_FAILURE
        else:
            failure_mode = FailureMode.NONE

        # 5. Extract top physical risk factors
        risk_factors: List[RiskFactor] = []
        # Torque check
        if torque > 55.0:
            risk_factors.append(
                RiskFactor(
                    factor_name="torque_nm",
                    impact_score=round((torque - 40.0) / 40.0, 3),
                    measured_value=round(float(torque), 2),
                    nominal_baseline=40.0,
                    deviation_direction="high",
                    description=f"Elevated drive torque ({torque:.1f} Nm vs 40.0 Nm nominal)",
                )
            )
        # Tool wear check
        if tool_wear > 150.0:
            risk_factors.append(
                RiskFactor(
                    factor_name="tool_wear_min",
                    impact_score=round(tool_wear / 250.0, 3),
                    measured_value=round(float(tool_wear), 1),
                    nominal_baseline=0.0,
                    deviation_direction="high",
                    description=f"Cumulative tool wear duration high ({tool_wear:.0f} min)",
                )
            )
        # Thermal check
        if delta_t < 8.6:
            risk_factors.append(
                RiskFactor(
                    factor_name="delta_t_k",
                    impact_score=round((8.6 - delta_t) / 8.6, 3),
                    measured_value=round(float(delta_t), 2),
                    nominal_baseline=10.0,
                    deviation_direction="low",
                    description=f"Low temperature dissipation gradient ({delta_t:.2f} K)",
                )
            )
        # Power check
        if power_w < 3500.0 or power_w > 9000.0:
            risk_factors.append(
                RiskFactor(
                    factor_name="power_w",
                    impact_score=round(abs(power_w - 6000.0) / 6000.0, 3),
                    measured_value=round(float(power_w), 1),
                    nominal_baseline=6000.0,
                    deviation_direction="low" if power_w < 3500.0 else "high",
                    description=f"Mechanical drive power outside nominal envelope ({power_w:.0f} W)",
                )
            )

        risk_factors.sort(key=lambda rf: rf.impact_score, reverse=True)
        return health_state, failure_mode, p_fail, p_healthy, mode_probs, risk_factors[:4]

    def register_test_predictor(
        self,
        predictor_fn: Callable[[np.ndarray], Tuple[str, str, float, float, Dict[str, float]]],
        version: str = "4.0.0-test",
    ) -> None:
        """Registers a mock predictor for test harness execution without production fabrication."""
        self._test_predictor = predictor_fn
        self.model_version = version
        self._is_ready = True
        self._unavailability_reason = ""
