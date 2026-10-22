"""
SolarVision AI — Model 4: Predictive Maintenance
Canonical AI4I Feature Extractor, Normalization & Physical Engineering Features
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Dict, List, Optional, Tuple
import numpy as np

from .schemas import Model4Domain, PredictiveMaintenanceInput


CANONICAL_MAINTENANCE_FEATURE_COUNT = 6

CANONICAL_MAINTENANCE_FEATURE_NAMES = [
    "product_type",
    "air_temperature_k",
    "process_temperature_k",
    "rotational_speed_rpm",
    "torque_nm",
    "tool_wear_min",
]


@dataclass(frozen=True)
class MaintenanceFeatureSpec:
    index: int
    name: str
    unit: str
    min_valid: float
    max_valid: float
    nominal: float
    description: str


CANONICAL_FEATURE_SPECS: List[MaintenanceFeatureSpec] = [
    MaintenanceFeatureSpec(0, "product_type", "encoded", 0.0, 2.0, 0.0, "Product quality variant (L=0, M=1, H=2)"),
    MaintenanceFeatureSpec(1, "air_temperature_k", "K", 295.0, 305.0, 300.0, "Ambient air temperature in Kelvin"),
    MaintenanceFeatureSpec(2, "process_temperature_k", "K", 305.0, 315.0, 310.0, "Process component temperature in Kelvin"),
    MaintenanceFeatureSpec(3, "rotational_speed_rpm", "rpm", 1100.0, 2900.0, 1538.0, "Spindle drive rotational speed in RPM"),
    MaintenanceFeatureSpec(4, "torque_nm", "Nm", 3.0, 80.0, 40.0, "Motor drive torque feedback in Nm"),
    MaintenanceFeatureSpec(5, "tool_wear_min", "min", 0.0, 260.0, 0.0, "Cumulative tool usage execution time in minutes"),
]

TYPE_MAPPING = {"L": 0.0, "M": 1.0, "H": 2.0}
INV_TYPE_MAPPING = {0.0: "L", 1.0: "M", 2.0: "H"}


class PredictiveMaintenanceFeatureExtractor:
    """Extracts, validates, and engineers physical features for Model 4 predictive maintenance."""

    def __init__(self, domain: Model4Domain = Model4Domain.AI4I_SYNTHETIC_BENCHMARK) -> None:
        self.domain = domain

    def has_sufficient_features(self, req: PredictiveMaintenanceInput) -> bool:
        """Determines whether sufficient operational telemetry is supplied."""
        if req.feature_vector is not None and len(req.feature_vector) > 0:
            return True
        if req.raw_features is not None and len(req.raw_features) > 0:
            return True

        # Check direct physical parameter presence (all 5 continuous physical measurements required)
        continuous_provided = sum(
            1 for val in [
                req.air_temperature_k,
                req.process_temperature_k,
                req.rotational_speed_rpm,
                req.torque_nm,
                req.tool_wear_min,
            ]
            if val is not None
        )
        return continuous_provided == 5

    def extract(self, req: PredictiveMaintenanceInput) -> Tuple[np.ndarray, List[str], Dict[str, float]]:
        """
        Extracts 6 canonical raw features and returns (feature_vector, feature_names, raw_dict).
        Enforces strict dimension checks and boundary validation.
        """
        raw_map: Dict[str, float] = {}

        # 1. Direct 6-D vector input
        if req.feature_vector is not None:
            if len(req.feature_vector) != CANONICAL_MAINTENANCE_FEATURE_COUNT:
                raise ValueError(
                    f"Predictive maintenance requires exactly {CANONICAL_MAINTENANCE_FEATURE_COUNT} features, "
                    f"received {len(req.feature_vector)}. Silent padding or truncation is forbidden."
                )
            vec = np.array(req.feature_vector, dtype=np.float32)
            raw_map = {
                CANONICAL_MAINTENANCE_FEATURE_NAMES[i]: float(vec[i])
                for i in range(CANONICAL_MAINTENANCE_FEATURE_COUNT)
            }
            return vec, CANONICAL_MAINTENANCE_FEATURE_NAMES, raw_map

        # 2. Extract from named fields and raw_features dict
        if req.raw_features:
            for k, v in req.raw_features.items():
                k_clean = k.strip().lower()
                if k_clean in CANONICAL_MAINTENANCE_FEATURE_NAMES:
                    raw_map[k_clean] = float(v)

        if req.product_type is not None:
            raw_map["product_type"] = TYPE_MAPPING.get(req.product_type.upper(), 0.0)
        elif "product_type" not in raw_map:
            raw_map["product_type"] = 0.0  # Default to 'L'

        if req.air_temperature_k is not None:
            raw_map["air_temperature_k"] = float(req.air_temperature_k)
        if req.process_temperature_k is not None:
            raw_map["process_temperature_k"] = float(req.process_temperature_k)
        if req.rotational_speed_rpm is not None:
            raw_map["rotational_speed_rpm"] = float(req.rotational_speed_rpm)
        if req.torque_nm is not None:
            raw_map["torque_nm"] = float(req.torque_nm)
        if req.tool_wear_min is not None:
            raw_map["tool_wear_min"] = float(req.tool_wear_min)

        # Assemble canonical 6-D vector and impute nominal baselines for missing attributes
        vec = np.zeros(CANONICAL_MAINTENANCE_FEATURE_COUNT, dtype=np.float32)
        for spec in CANONICAL_FEATURE_SPECS:
            if spec.name in raw_map:
                val = raw_map[spec.name]
                # Clamp within physical valid boundary
                clamped_val = max(spec.min_valid, min(spec.max_valid, val))
                vec[spec.index] = clamped_val
                raw_map[spec.name] = clamped_val
            else:
                vec[spec.index] = spec.nominal
                raw_map[spec.name] = spec.nominal

        return vec, CANONICAL_MAINTENANCE_FEATURE_NAMES, raw_map

    @staticmethod
    def compute_engineered_features(raw_6d: np.ndarray) -> np.ndarray:
        """
        Derives physical engineered features from the canonical 6-D vector:
        - delta_t = process_temp - air_temp [K]
        - power_w = torque * (rpm * 2 * pi / 60) [W]
        - strain = tool_wear * torque [min * Nm]
        Returns 9-D vector: [type_H, type_L, type_M, air_temp, proc_temp, rpm, torque, tool_wear, delta_t, power, strain]
        """
        p_type = raw_6d[0]
        air_t = raw_6d[1]
        proc_t = raw_6d[2]
        rpm = raw_6d[3]
        torque = raw_6d[4]
        tool_wear = raw_6d[5]

        # One-hot encoding
        type_l = 1.0 if abs(p_type - 0.0) < 0.5 else 0.0
        type_m = 1.0 if abs(p_type - 1.0) < 0.5 else 0.0
        type_h = 1.0 if abs(p_type - 2.0) < 0.5 else 0.0

        delta_t = proc_t - air_t
        power_w = torque * (rpm * (2.0 * np.pi / 60.0))
        strain = tool_wear * torque

        return np.array(
            [type_h, type_l, type_m, air_t, proc_t, rpm, torque, tool_wear, delta_t, power_w, strain],
            dtype=np.float32,
        )

    @classmethod
    def compute_engineered_dict(cls, raw_6d: np.ndarray) -> Dict[str, float]:
        """Returns engineered physical features as a named key dictionary."""
        p_type = raw_6d[0]
        air_t = float(raw_6d[1])
        proc_t = float(raw_6d[2])
        rpm = float(raw_6d[3])
        torque = float(raw_6d[4])
        tool_wear = float(raw_6d[5])

        return {
            "product_type_L": 1.0 if abs(p_type - 0.0) < 0.5 else 0.0,
            "product_type_M": 1.0 if abs(p_type - 1.0) < 0.5 else 0.0,
            "product_type_H": 1.0 if abs(p_type - 2.0) < 0.5 else 0.0,
            "air_temperature_k": air_t,
            "process_temperature_k": proc_t,
            "rotational_speed_rpm": rpm,
            "torque_nm": torque,
            "tool_wear_min": tool_wear,
            "temp_diff_k": proc_t - air_t,
            "mechanical_power_w": torque * (rpm * (2.0 * np.pi / 60.0)),
            "tool_wear_strain": tool_wear * torque,
        }
