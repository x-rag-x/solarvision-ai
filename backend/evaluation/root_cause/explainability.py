"""Explainability and diagnostic factor attribution for Root Cause predictions."""

from __future__ import annotations

from typing import Any, Dict, List, Optional
import numpy as np

from backend.root_cause_data.schema import (
    CANONICAL_FEATURE_ORDER,
    SENSOR_UNIT_REGISTRY,
)

RECOMMENDED_ACTIONS: Dict[str, str] = {
    "thermal_stress_soldering": (
        "Halt stringer feed. Inspect upper/lower heating element thermocouples. Recalibrate preheating ramp profile to keep gradient < 10 C/cm."
    ),
    "squeegee_pressure_drift": (
        "Perform squeegee leveling audit. Measure blade durometer hardness; replace squeegee if wear exceeds 0.2mm. Recalibrate pneumatic force sensor."
    ),
    "screen_mesh_clogging": (
        "Initiate automatic wet-wipe and vacuum cleaning cycle. Inspect emulsion stencil under microscope for pinholes. Check paste viscosity."
    ),
    "firing_thermal_profile_excursion": (
        "Verify zone 3 fast-firing pyrometer calibration. Adjust furnace belt speed by -0.2 m/min. Check chimney exhaust negative pressure."
    ),
    "mechanical_handling_impact": (
        "Check robotic transfer track decelerations. Inspect vacuum suction cups on wafer transfer arm for micro-cracks or silicone degradation."
    ),
    "lamination_pressure_imbalance": (
        "Inspect silicone diaphragm for pinhole leaks or uneven clamping. Verify chamber vacuum pulls below 1.0 mbar within 120 seconds."
    ),
    "ingot_thermal_gradient": (
        "Quarantine current wafer lot. Notify ingot pulling foundry of dislocation density threshold violation. Audit wire saw thickness variation."
    ),
    "chemical_texturing_contamination": (
        "Test texturing bath KOH/IPA concentration and etch depth. Drain and recharge chemical bath if metal ion contamination exceeds 5 ppm."
    ),
    "nominal_process_variation": (
        "Process is operating within standard 3-sigma statistical control limits. Log inspection for statistical process control (SPC) monitoring."
    ),
}


class RootCauseExplainer:
    """Calculates feature attributions and generates operator-facing recommendations."""

    def __init__(self, global_feature_importances: Dict[str, float]):
        self.global_importances = global_feature_importances

    def explain_prediction(
        self,
        predicted_cause: str,
        feature_vector: List[float] | np.ndarray,
        confidence: float,
        top_k: int = 5,
    ) -> Dict[str, Any]:
        """
        Calculates local feature attribution for an individual prediction.
        Identifies which features drove the classification based on departure from nominal and global weight.
        """
        feats = np.asarray(feature_vector, dtype=np.float32)

        contributions: List[Dict[str, Any]] = []
        for idx, feat_name in enumerate(CANONICAL_FEATURE_ORDER):
            val = float(feats[idx]) if idx < len(feats) else 0.0
            global_weight = self.global_importances.get(feat_name, 0.01)

            # Check deviation from target if it is a sensor feature
            deviation = 0.0
            unit = ""
            for s_name, s_def in SENSOR_UNIT_REGISTRY.items():
                if s_name in feat_name:
                    nominal = s_def.nominal_target
                    span = max(1.0, s_def.max_valid - s_def.min_valid)
                    deviation = abs(val - nominal) / span
                    unit = s_def.unit
                    break

            # Local impact score combines global tree importance with local excursion magnitude
            local_impact = global_weight * (1.0 + deviation * 3.0)

            contributions.append({
                "feature": feat_name,
                "measured_value": round(val, 3),
                "unit": unit,
                "impact_score": round(float(local_impact), 4),
            })

        contributions.sort(key=lambda x: x["impact_score"], reverse=True)
        top_factors = contributions[:top_k]

        action = RECOMMENDED_ACTIONS.get(
            predicted_cause,
            "Notify line supervisor for manual metallurgical failure analysis."
        )

        return {
            "predicted_cause": predicted_cause,
            "confidence": round(float(confidence), 4),
            "top_contributing_factors": top_factors,
            "feature_importance_summary": {f["feature"]: f["impact_score"] for f in top_factors},
            "recommended_action": action,
        }
