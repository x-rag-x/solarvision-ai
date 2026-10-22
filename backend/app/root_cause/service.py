"""
SolarVision AI — Model 2: Manufacturing Root Cause Analysis
Inference Service & Multi-Modal Attribution Orchestrator
"""

from __future__ import annotations

import logging
import time
from typing import Any, Optional

from .feature_extractor import FeatureExtractor, FeatureExtractionResult
from .model_loader import Model2Loader
from .schemas import (
    ProbableCause,
    RootCauseAnalysisInput,
    RootCauseAnalysisResponse,
    RootCauseStatus,
)
from backend.root_cause_data.schema import CANONICAL_FEATURE_ORDER

logger = logging.getLogger("solarvision.root_cause.service")


class RootCauseService:
    """
    Main orchestration service for Model 2.
    Enforces strict truthfulness: Never fabricates causes, confidence scores,
    or explanations when a model is untrained or process data is absent.
    Enforces exact dimension alignment between extractor and loader.
    """

    def __init__(
        self,
        loader: Optional[Model2Loader] = None,
        extractor: Optional[FeatureExtractor] = None,
    ) -> None:
        self.loader = loader or Model2Loader()
        self.extractor = extractor or FeatureExtractor()

    def analyze(self, data: RootCauseAnalysisInput) -> RootCauseAnalysisResponse:
        t0 = time.perf_counter()

        # 1. Feature Extraction and Data Assessment
        try:
            extraction: FeatureExtractionResult = self.extractor.extract(data)
        except Exception as exc:
            logger.error(f"Feature extraction failed for inspection '{data.inspection_id}': {exc}", exc_info=True)
            elapsed_ms = (time.perf_counter() - t0) * 1000.0
            return RootCauseAnalysisResponse(
                inspection_id=data.inspection_id,
                batch_id=data.batch_id,
                machine_id=data.machine_id,
                status=RootCauseStatus.ERROR,
                probable_causes=[],
                model_version=self.loader.model_version,
                limitations=[f"Feature extraction error: {exc}"],
                processing_time_ms=elapsed_ms,
            )

        # 2. Check for Process Data Sufficiency
        # If no sensors, no machine info, no batch info, and no production events exist,
        # we cannot attribute root causes to manufacturing equipment!
        if not extraction.has_sufficient_process_data:
            elapsed_ms = (time.perf_counter() - t0) * 1000.0
            return RootCauseAnalysisResponse(
                inspection_id=data.inspection_id,
                batch_id=data.batch_id,
                machine_id=data.machine_id,
                status=RootCauseStatus.MISSING_PROCESS_DATA,
                probable_causes=[],
                model_version=self.loader.model_version,
                limitations=[
                    "Missing manufacturing process telemetry. Root cause attribution requires linked "
                    "sensor measurements, machine telemetry, or batch metadata to correlate with defect patterns.",
                    f"Missing fields: {', '.join(extraction.missing_fields[:5])}",
                ],
                feature_summary=self._select_feature_summary(extraction.feature_dict),
                processing_time_ms=elapsed_ms,
            )

        # 3. Check Model Availability & Training Status
        # Under strict zero-fabrication rules: Never pretend an untrained model is functional!
        if not self.loader.is_ready:
            elapsed_ms = (time.perf_counter() - t0) * 1000.0
            return RootCauseAnalysisResponse(
                inspection_id=data.inspection_id,
                batch_id=data.batch_id,
                machine_id=data.machine_id,
                status=RootCauseStatus.NOT_TRAINED,
                probable_causes=[],
                model_version="none",
                limitations=[
                    "Model 2 (Manufacturing Root Cause Analysis) checkpoint is not trained or deployed.",
                    self.loader.unavailability_reason,
                    "Process data and defect features were extracted and validated successfully, "
                    "awaiting trained Model 2 artifact deployment.",
                ],
                feature_summary=self._select_feature_summary(extraction.feature_dict),
                processing_time_ms=elapsed_ms,
            )

        # 4. Valid Model Exists & Process Data Present -> Execute Actual Inference
        try:
            # Match exact input dimensions to the model's expected dimension contract
            # NO silent padding or truncation
            if self.loader.expected_dim == 48 and extraction.canonical_v2_vector is not None:
                vector_to_predict = extraction.canonical_v2_vector
                names_to_predict = extraction.canonical_v2_names
            elif self.loader.expected_dim == 40 and extraction.canonical_vector is not None:
                vector_to_predict = extraction.canonical_vector
                names_to_predict = list(CANONICAL_FEATURE_ORDER)
            elif self.loader.expected_dim == len(extraction.feature_vector):
                vector_to_predict = extraction.feature_vector
                names_to_predict = extraction.feature_names
            else:
                raise ValueError(
                    f"Contract mismatch: Model expects {self.loader.expected_dim} dimensions, "
                    f"but extractor produced {len(extraction.feature_vector)} serving, "
                    f"{len(extraction.canonical_vector) if extraction.canonical_vector is not None else 0} legacy, "
                    f"{len(extraction.canonical_v2_vector) if extraction.canonical_v2_vector is not None else 0} v2."
                )

            raw_causes, feature_importance = self.loader.predict(
                vector_to_predict,
                names_to_predict,
            )

            # Synthesize contextual supporting evidence
            causes: list[ProbableCause] = []
            for item in raw_causes:
                code = item.get("cause_code", "UNKNOWN")
                evidence = self._compile_supporting_evidence(code, data, extraction)
                if "supporting_evidence" in item:
                    evidence.extend(item["supporting_evidence"])

                causes.append(
                    ProbableCause(
                        cause_code=code,
                        label=item.get("label", code),
                        confidence=item.get("confidence"),
                        is_calibrated=item.get("is_calibrated", False),
                        calibration_method=item.get("calibration_method"),
                        supporting_evidence=evidence,
                        recommended_action=item.get("recommended_action"),
                        contributing_factors=item.get("contributing_factors"),
                        feature_importance=feature_importance,
                    )
                )

            # Document any non-fatal telemetry gaps as limitations
            limitations: list[str] = []
            if extraction.missing_fields:
                unmonitored = [f.replace("sensors.", "") for f in extraction.missing_fields if f.startswith("sensors.")]
                if unmonitored:
                    limitations.append(f"Unmonitored sensor channels: {', '.join(unmonitored[:4])} (nominal baselines used).")
                if "machine.last_maintenance_at" in extraction.missing_fields:
                    limitations.append("Machine maintenance log unavailable; maintenance delta assumed nominal.")

            elapsed_ms = (time.perf_counter() - t0) * 1000.0
            return RootCauseAnalysisResponse(
                inspection_id=data.inspection_id,
                batch_id=data.batch_id,
                machine_id=data.machine_id,
                status=RootCauseStatus.READY,
                probable_causes=causes,
                model_version=self.loader.model_version,
                limitations=limitations,
                feature_summary=self._select_feature_summary(extraction.feature_dict),
                processing_time_ms=elapsed_ms,
            )

        except Exception as exc:
            logger.error(f"Model 2 inference execution failed for inspection '{data.inspection_id}': {exc}", exc_info=True)
            elapsed_ms = (time.perf_counter() - t0) * 1000.0
            return RootCauseAnalysisResponse(
                inspection_id=data.inspection_id,
                batch_id=data.batch_id,
                machine_id=data.machine_id,
                status=RootCauseStatus.ERROR,
                probable_causes=[],
                model_version=self.loader.model_version,
                limitations=[f"Root cause prediction error: {exc}"],
                processing_time_ms=elapsed_ms,
            )

    def _compile_supporting_evidence(
        self,
        cause_code: str,
        data: RootCauseAnalysisInput,
        extraction: FeatureExtractionResult,
    ) -> list[str]:
        evidence: list[str] = []
        d = extraction.feature_dict

        # Measured defect evidence from Model 1
        if d.get("defect_count_crack", 0) > 0 or d.get("feat_is_crack", 0) > 0:
            evidence.append("Model 1 detected structural crack/microcrack defect(s).")
        if d.get("defect_count_finger_interruption", 0) > 0 or d.get("feat_is_finger", 0) > 0:
            evidence.append("Model 1 detected finger interruption defect(s).")
        if d.get("defect_count_soldering_defect", 0) > 0 or d.get("feat_is_short_circuit", 0) > 0:
            evidence.append("Model 1 detected soldering/thermal short-circuit anomaly.")
        if d.get("defect_total_count", 0) > 0:
            evidence.append(f"Model 1 detected {int(d['defect_total_count'])} defect(s) with max confidence {d.get('defect_max_confidence', 0.0):.2f}.")

        # Measured sensor telemetry evidence
        for s in data.sensor_measurements:
            if s.is_anomaly or (s.anomaly_score is not None and s.anomaly_score >= 0.5):
                score_str = f" (anomaly score: {s.anomaly_score:.2f})" if s.anomaly_score is not None else ""
                unit_str = f" {s.unit}" if s.unit else ""
                evidence.append(f"Measured {s.sensor_type}: {s.measurement_value}{unit_str}{score_str}.")

        # Measured production event evidence
        for ev in data.production_events:
            sev = (ev.severity or "info").lower().strip()
            if sev in ("critical", "high", "warning"):
                evidence.append(f"Recorded event [{ev.severity.upper()}]: {ev.event_type} — {ev.message}")

        return evidence[:6]

    def _select_feature_summary(self, full_dict: dict[str, float]) -> dict[str, float]:
        """Filters down to key summary features from the canonical feature order."""
        keys_of_interest = [
            "defect_total_count",
            "defect_max_confidence",
            "defect_avg_confidence",
            "defect_total_area_fraction",
            "soldering_temp_top_mean_w15",
            "lamination_temp_mean_w15",
            "firing_peak_temp_mean_w15",
            "events_total_count",
            "events_high_count",
            "feat_defect_count",
            "feat_max_detection_conf",
            "feat_mean_detection_conf",
            "feat_defect_area_ratio",
        ]
        return {k: round(full_dict.get(k, 0.0), 3) for k in keys_of_interest if k in full_dict}


# Global singleton instance ready for FastAPI / CLI usage
root_cause_service = RootCauseService()
