"""
SolarVision AI — Model 3: Predictive Quality Monitoring
High-Level Orchestration Service with Strict Domain Segregation
"""

from __future__ import annotations

import logging
import time
from typing import Any, Dict, List, Optional
import numpy as np

from .feature_extractor import PredictiveQualityFeatureExtractor
from .model_loader import Model3Loader, SECOM_RAW_FEATURE_COUNT
from .schemas import (
    ConfidenceInterval,
    ModelDomain,
    PredictiveQualityInput,
    PredictiveQualityResponse,
    PredictiveQualityStatus,
    QualityOutcome,
    RiskFactor,
    RiskLevel,
)

logger = logging.getLogger("solarvision.predictive_quality.service")


class PredictiveQualityService:
    """Orchestrates feature extraction, artifact checks, and quality outcome predictions."""

    def __init__(
        self,
        solar_loader: Optional[Model3Loader] = None,
        benchmark_loader: Optional[Model3Loader] = None,
    ) -> None:
        self.solar_loader = solar_loader or Model3Loader(domain=ModelDomain.SOLAR_CELL_MANUFACTURING)
        self.benchmark_loader = benchmark_loader or Model3Loader(domain=ModelDomain.SEMICONDUCTOR_BENCHMARK)

        self.solar_extractor = PredictiveQualityFeatureExtractor(ModelDomain.SOLAR_CELL_MANUFACTURING)
        self.benchmark_extractor = PredictiveQualityFeatureExtractor(ModelDomain.SEMICONDUCTOR_BENCHMARK)

    @property
    def loader(self) -> Model3Loader:
        """Default loader property (solar domain for backward compatibility)."""
        return self.solar_loader

    def get_loader_for_domain(self, domain: ModelDomain) -> Model3Loader:
        if domain == ModelDomain.SEMICONDUCTOR_BENCHMARK:
            return self.benchmark_loader
        return self.solar_loader

    def forecast(self, req: PredictiveQualityInput) -> PredictiveQualityResponse:
        start_time = time.perf_counter()
        domain = req.domain
        active_loader = self.get_loader_for_domain(domain)
        extractor = self.benchmark_extractor if domain == ModelDomain.SEMICONDUCTOR_BENCHMARK else self.solar_extractor

        # 1. Check feature presence
        if not extractor.has_sufficient_features(req):
            elapsed = round((time.perf_counter() - start_time) * 1000, 2)
            action = (
                "Insufficient semiconductor process telemetry. Provide 590-dimensional SECOM feature vector."
                if domain == ModelDomain.SEMICONDUCTOR_BENCHMARK
                else "Insufficient manufacturing telemetry provided. Ingest inline flash test or SCADA sensor parameters."
            )
            return PredictiveQualityResponse(
                status=PredictiveQualityStatus.MISSING_FEATURES,
                domain=domain,
                batch_id=req.batch_id,
                machine_id=req.machine_id,
                quality_outcome=QualityOutcome.UNKNOWN,
                risk_level=RiskLevel.UNKNOWN,
                probabilities={},
                confidence=None,
                is_calibrated=False,
                calibration_method="none",
                predicted_defect_rate=None,
                predicted_yield=None,
                confidence_interval=None,
                top_risk_factors=[],
                recommended_action=action,
                model_version=active_loader.model_version,
                model_metadata=active_loader.manifest,
                limitations=[
                    "Missing manufacturing process telemetry.",
                    "Predictive quality forecast requires at least one of: flash-test electrical parameters, process sensors, defect counts, or direct feature vector."
                    if domain == ModelDomain.SOLAR_CELL_MANUFACTURING
                    else "Semiconductor benchmark requires a valid 590-feature vector.",
                ],
                processing_time_ms=elapsed,
            )

        # 2. Check model readiness (Zero-Fabrication Enforcement)
        if not active_loader.is_ready:
            elapsed = round((time.perf_counter() - start_time) * 1000, 2)
            limitations = [
                f"Model 3 ({domain.value}) is not ready for inference: {active_loader.unavailability_reason}",
                "Zero synthetic forecasts or fabricated confidence values are returned.",
            ]
            if domain == ModelDomain.SEMICONDUCTOR_BENCHMARK:
                limitations.append("Domain requested: semiconductor benchmark. Benchmark artifact is unavailable.")
            else:
                limitations.append("Domain requested: solar cell manufacturing. Factory yield training dataset is currently pending.")

            return PredictiveQualityResponse(
                status=PredictiveQualityStatus.NOT_TRAINED,
                domain=domain,
                batch_id=req.batch_id,
                machine_id=req.machine_id,
                quality_outcome=QualityOutcome.UNKNOWN,
                risk_level=RiskLevel.UNKNOWN,
                probabilities={},
                confidence=None,
                is_calibrated=False,
                calibration_method=active_loader.calibration_method,
                predicted_defect_rate=None,
                predicted_yield=None,
                confidence_interval=None,
                top_risk_factors=[],
                recommended_action=None,
                model_version=active_loader.model_version,
                model_metadata=active_loader.manifest,
                limitations=limitations,
                processing_time_ms=elapsed,
            )

        # 3. Extract features
        try:
            feat_vec, feat_names, raw_map = extractor.extract(req)
        except Exception as exc:
            elapsed = round((time.perf_counter() - start_time) * 1000, 2)
            return PredictiveQualityResponse(
                status=PredictiveQualityStatus.ERROR,
                domain=domain,
                batch_id=req.batch_id,
                machine_id=req.machine_id,
                limitations=[f"Feature extraction failed: {exc}"],
                processing_time_ms=elapsed,
            )

        # 4. Predict using genuine model artifact
        try:
            outcome, risk, probs, conf, ci, top_factors = active_loader.predict(feat_vec, domain=domain)
        except Exception as exc:
            elapsed = round((time.perf_counter() - start_time) * 1000, 2)
            return PredictiveQualityResponse(
                status=PredictiveQualityStatus.ERROR,
                domain=domain,
                batch_id=req.batch_id,
                machine_id=req.machine_id,
                limitations=[f"Inference execution failed: {exc}"],
                processing_time_ms=elapsed,
            )

        # 5. Formulate yield estimates and actions
        pass_prob = probs.get("pass", 0.0)
        fail_prob = probs.get("fail", 0.0)
        warn_prob = probs.get("warning", 0.0)

        predicted_defect_rate = round(fail_prob + 0.3 * warn_prob, 4)
        predicted_yield = round(max(0.0, min(100.0, 95.0 * pass_prob + 80.0 * warn_prob)), 2)

        recommended_action = None
        if domain == ModelDomain.SEMICONDUCTOR_BENCHMARK:
            if outcome == QualityOutcome.FAIL:
                recommended_action = "SECOM Benchmark Excursion: Simulated wafer scrap risk exceeding calibrated threshold (tau=0.07)."
            else:
                recommended_action = "SECOM Benchmark In-Spec: Simulated wafer fabrication parameters within nominal limits."
        else:
            if outcome == QualityOutcome.FAIL:
                recommended_action = "High scrap risk: Quarantine batch for review and inspect top deviating process tools."
            elif outcome == QualityOutcome.WARNING:
                recommended_action = "Marginal yield warning: Inspect screen printing alignment and furnace thermal profile."
            else:
                recommended_action = "Nominal yield: Proceed to next manufacturing station."

        limitations = []
        if domain == ModelDomain.SEMICONDUCTOR_BENCHMARK:
            limitations.append(
                "GENERAL SEMICONDUCTOR QUALITY BENCHMARK (UCI SECOM). NOT A SOLAR-CELL FACTORY VALIDATION."
            )
            limitations.append(
                "Notice: Prediction generated using external semiconductor benchmark weights. "
                "This benchmark model is designed for microelectronics baseline comparison and not for solar fab line control."
            )
        else:
            limitations.append("Predictions apply specifically to crystalline silicon solar cell manufacturing lines.")

        if not active_loader.is_calibrated:
            limitations.append("Probabilities represent empirical ensemble frequencies; no validation calibration was applied.")

        elapsed = round((time.perf_counter() - start_time) * 1000, 2)
        return PredictiveQualityResponse(
            status=PredictiveQualityStatus.READY,
            domain=domain,
            batch_id=req.batch_id,
            machine_id=req.machine_id,
            quality_outcome=outcome,
            risk_level=risk,
            probabilities=probs,
            confidence=round(conf, 4),
            is_calibrated=active_loader.is_calibrated,
            calibration_method=active_loader.calibration_method,
            predicted_defect_rate=predicted_defect_rate,
            predicted_yield=predicted_yield,
            confidence_interval=ci,
            top_risk_factors=top_factors,
            recommended_action=recommended_action,
            model_version=active_loader.model_version,
            model_metadata=active_loader.manifest,
            limitations=limitations,
            processing_time_ms=elapsed,
        )

    def benchmark_predict(self, feature_vector: List[float], batch_id: Optional[str] = None) -> PredictiveQualityResponse:
        """Dedicated execution endpoint for UCI SECOM benchmark inference."""
        req = PredictiveQualityInput(
            batch_id=batch_id,
            domain=ModelDomain.SEMICONDUCTOR_BENCHMARK,
            feature_vector=feature_vector,
        )
        return self.forecast(req)


predictive_quality_service = PredictiveQualityService()
