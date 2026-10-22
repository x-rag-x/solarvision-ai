"""
SolarVision AI — Model 4: Predictive Maintenance
High-Level Orchestration Service with Strict Domain Segregation & Zero Fabrication
"""

from __future__ import annotations

import logging
import time
from typing import Any, Dict, List, Optional
import numpy as np

from .feature_extractor import (
    CANONICAL_MAINTENANCE_FEATURE_COUNT,
    CANONICAL_MAINTENANCE_FEATURE_NAMES,
    PredictiveMaintenanceFeatureExtractor,
)
from .model_loader import Model4Loader
from .schemas import (
    FailureMode,
    MachineHealthState,
    Model4Domain,
    Model4Manifest,
    Model4Status,
    PredictiveMaintenanceInput,
    PredictiveMaintenanceResponse,
    RiskFactor,
)

logger = logging.getLogger("solarvision.predictive_maintenance.service")


class PredictiveMaintenanceService:
    """Orchestrates feature extraction, artifact checks, and machine failure predictions."""

    def __init__(
        self,
        benchmark_loader: Optional[Model4Loader] = None,
        solar_loader: Optional[Model4Loader] = None,
        feature_extractor: Optional[PredictiveMaintenanceFeatureExtractor] = None,
    ) -> None:
        self.benchmark_loader = benchmark_loader or Model4Loader(domain=Model4Domain.AI4I_SYNTHETIC_BENCHMARK)
        self.solar_loader = solar_loader or Model4Loader(domain=Model4Domain.SOLAR_FACTORY)
        self.extractor = feature_extractor or PredictiveMaintenanceFeatureExtractor()

    @property
    def loader(self) -> Model4Loader:
        """Default loader property (benchmark loader)."""
        return self.benchmark_loader

    def get_loader_for_domain(self, domain: Model4Domain) -> Model4Loader:
        if domain == Model4Domain.SOLAR_FACTORY:
            return self.solar_loader
        return self.benchmark_loader

    def forecast(self, req: PredictiveMaintenanceInput) -> PredictiveMaintenanceResponse:
        """Executes predictive maintenance evaluation with strict domain segregation.

        Rules:
        - solar_factory domain: Guaranteed NOT_TRAINED response. Zero synthetic predictions.
        - ai4i_synthetic_benchmark domain: Genuine inference against verified artifact.
        """
        start_time = time.perf_counter()
        domain = req.domain

        # 1. Enforce Zero-Fabrication Pledge for Solar Factory domain
        if domain == Model4Domain.SOLAR_FACTORY:
            elapsed = round((time.perf_counter() - start_time) * 1000, 2)
            return PredictiveMaintenanceResponse(
                status=Model4Status.NOT_TRAINED,
                domain=Model4Domain.SOLAR_FACTORY,
                machine_id=req.machine_id,
                health_state=MachineHealthState.UNKNOWN,
                failure_mode=FailureMode.UNKNOWN,
                failure_probability=None,
                healthy_probability=None,
                mode_probabilities={},
                confidence=None,
                is_calibrated=False,
                calibration_method="none",
                top_risk_factors=[],
                recommended_action=(
                    "Factory model is pending domain adaptation. Operational solar manufacturing "
                    "predictive maintenance model is not yet trained."
                ),
                model_version="none",
                model_metadata=None,
                limitations=[
                    "Solar factory predictive maintenance model is currently not trained.",
                    "AI4I synthetic benchmark weights are strictly segregated and quarantined from solar manufacturing operations.",
                    "Zero synthetic maintenance predictions or fabricated RUL metrics are generated.",
                    "Physical solar line equipment requires empirical SCADA failure telemetry before deployment.",
                ],
                processing_time_ms=elapsed,
            )

        active_loader = self.get_loader_for_domain(domain)

        # 2. Check feature sufficiency
        if not self.extractor.has_sufficient_features(req):
            elapsed = round((time.perf_counter() - start_time) * 1000, 2)
            return PredictiveMaintenanceResponse(
                status=Model4Status.MISSING_FEATURES,
                domain=domain,
                machine_id=req.machine_id,
                health_state=MachineHealthState.UNKNOWN,
                failure_mode=FailureMode.UNKNOWN,
                failure_probability=None,
                healthy_probability=None,
                mode_probabilities={},
                confidence=None,
                is_calibrated=False,
                calibration_method="none",
                top_risk_factors=[],
                recommended_action=(
                    "Insufficient telemetry. Provide all 6 canonical AI4I parameters: "
                    "product_type (L/M/H), air_temperature_k, process_temperature_k, "
                    "rotational_speed_rpm, torque_nm, tool_wear_min."
                ),
                model_version=active_loader.model_version,
                model_metadata=active_loader.manifest,
                limitations=[
                    "Missing machine sensor telemetry.",
                    "Predictive maintenance evaluation requires complete 6-feature physical state.",
                ],
                processing_time_ms=elapsed,
            )

        # 3. Check model artifact readiness
        if not active_loader.is_ready:
            elapsed = round((time.perf_counter() - start_time) * 1000, 2)
            return PredictiveMaintenanceResponse(
                status=Model4Status.NOT_TRAINED,
                domain=domain,
                machine_id=req.machine_id,
                health_state=MachineHealthState.UNKNOWN,
                failure_mode=FailureMode.UNKNOWN,
                failure_probability=None,
                healthy_probability=None,
                mode_probabilities={},
                confidence=None,
                is_calibrated=False,
                calibration_method=active_loader.calibration_method,
                top_risk_factors=[],
                recommended_action=None,
                model_version=active_loader.model_version,
                model_metadata=active_loader.manifest,
                limitations=[
                    f"Model 4 benchmark artifact is unavailable: {active_loader.unavailability_reason}",
                    "Zero synthetic forecasts or fabricated failure predictions are returned.",
                ],
                processing_time_ms=elapsed,
            )

        # 4. Extract features
        try:
            feat_vec, feat_names, raw_map = self.extractor.extract(req)
        except Exception as exc:
            elapsed = round((time.perf_counter() - start_time) * 1000, 2)
            logger.error("Model 4 feature extraction failed: %s", exc)
            return PredictiveMaintenanceResponse(
                status=Model4Status.ERROR,
                domain=domain,
                machine_id=req.machine_id,
                health_state=MachineHealthState.UNKNOWN,
                failure_mode=FailureMode.UNKNOWN,
                limitations=[f"Feature extraction failed: {exc}"],
                processing_time_ms=elapsed,
            )

        # 5. Execute genuine model inference
        try:
            health_state, failure_mode, p_fail, p_healthy, mode_probs, risk_factors = (
                active_loader.predict(feat_vec, domain=domain)
            )
        except Exception as exc:
            elapsed = round((time.perf_counter() - start_time) * 1000, 2)
            logger.error("Model 4 inference execution failed: %s", exc)
            return PredictiveMaintenanceResponse(
                status=Model4Status.ERROR,
                domain=domain,
                machine_id=req.machine_id,
                health_state=MachineHealthState.UNKNOWN,
                failure_mode=FailureMode.UNKNOWN,
                limitations=[f"Inference execution failed: {exc}"],
                processing_time_ms=elapsed,
            )

        # 6. Formulate action recommendations
        recommended_action: str
        if health_state == MachineHealthState.FAILURE:
            if failure_mode == FailureMode.TOOL_WEAR_FAILURE:
                recommended_action = "CRITICAL: Tool wear limit exceeded. Replace cutting insert immediately before continuing production."
            elif failure_mode == FailureMode.HEAT_DISSIPATION_FAILURE:
                recommended_action = "CRITICAL: Heat dissipation failure. Inspect spindle cooling channels and thermal dissipation airflow."
            elif failure_mode == FailureMode.POWER_FAILURE:
                recommended_action = "CRITICAL: Electrical power anomaly. Inspect motor drive inverter, power line harmonics, and spindle bearings."
            elif failure_mode == FailureMode.OVERSTRAIN_FAILURE:
                recommended_action = "CRITICAL: Tool overstrain condition. Reduce cutting feed rate and depth of cut to relieve mechanical load."
            elif failure_mode == FailureMode.RANDOM_FAILURE:
                recommended_action = "CRITICAL: Unclassified machine failure detected. Halt operation and conduct comprehensive mechanical inspection."
            else:
                recommended_action = "CRITICAL: Machine failure predicted. Halt equipment and execute maintenance protocol."
        elif health_state == MachineHealthState.WARNING:
            recommended_action = (
                "WARNING: Operating telemetry approaching critical stress boundary. "
                "Schedule tool wear inspection and monitor spindle torque and temperature."
            )
        else:
            recommended_action = "NORMAL: Equipment telemetry is within nominal operating envelope. Continue scheduled monitoring."

        limitations = [
            "AI4I 2020 SYNTHETIC PREDICTIVE MAINTENANCE BENCHMARK DATASET (Mathes et al., CC BY 4.0). SOFTWARE SIMULATION ONLY.",
            "External synthetic benchmark; not verified against physical solar cell manufacturing machinery.",
        ]
        if not active_loader.is_calibrated:
            limitations.append("Probabilities represent uncalibrated empirical model outputs.")

        confidence = round(max(p_healthy, p_fail), 4)
        elapsed = round((time.perf_counter() - start_time) * 1000, 2)

        return PredictiveMaintenanceResponse(
            status=Model4Status.READY,
            domain=domain,
            machine_id=req.machine_id,
            health_state=health_state,
            failure_mode=failure_mode,
            failure_probability=p_fail,
            healthy_probability=p_healthy,
            mode_probabilities=mode_probs,
            confidence=confidence,
            is_calibrated=active_loader.is_calibrated,
            calibration_method=active_loader.calibration_method,
            top_risk_factors=risk_factors,
            recommended_action=recommended_action,
            model_version=active_loader.model_version,
            model_metadata=active_loader.manifest,
            limitations=limitations,
            processing_time_ms=elapsed,
        )

    def benchmark_predict(
        self,
        product_type: str,
        air_temperature_k: float,
        process_temperature_k: float,
        rotational_speed_rpm: float,
        torque_nm: float,
        tool_wear_min: float,
        machine_id: Optional[str] = None,
        confidence_threshold: float = 0.50,
    ) -> PredictiveMaintenanceResponse:
        """Dedicated execution helper for AI4I benchmark inference."""
        req = PredictiveMaintenanceInput(
            machine_id=machine_id,
            domain=Model4Domain.AI4I_SYNTHETIC_BENCHMARK,
            product_type=product_type,
            air_temperature_k=air_temperature_k,
            process_temperature_k=process_temperature_k,
            rotational_speed_rpm=rotational_speed_rpm,
            torque_nm=torque_nm,
            tool_wear_min=tool_wear_min,
            confidence_threshold=confidence_threshold,
        )
        return self.forecast(req)


predictive_maintenance_service = PredictiveMaintenanceService()
