"""
SolarVision AI — Model 3: Predictive Quality Monitoring
Canonical Feature Specification & Extraction Pipeline
"""

from __future__ import annotations

from dataclasses import dataclass
import math
from typing import Any, Dict, List, Optional, Tuple
import numpy as np

from .schemas import (
    ModelDomain,
    PredictiveQualityInput,
)

CANONICAL_SOLAR_FEATURE_COUNT = 32
MODEL3_FEATURE_SCHEMA_VERSION = "1.0.0"


@dataclass(frozen=True)
class FeatureSpec:
    index: int
    name: str
    unit: str
    nominal: float
    min_valid: float
    max_valid: float
    description: str


CANONICAL_SOLAR_FEATURES: List[FeatureSpec] = [
    FeatureSpec(0, "voc_v", "V", 0.685, 0.55, 0.78, "Open circuit voltage from inline flash tester"),
    FeatureSpec(1, "isc_a", "A", 10.85, 8.0, 13.0, "Short circuit current from inline flash tester"),
    FeatureSpec(2, "fill_factor_pct", "%", 81.5, 65.0, 88.0, "I-V curve fill factor percentage"),
    FeatureSpec(3, "series_resistance_mohm", "mOhm", 1.15, 0.4, 5.0, "Calculated internal series resistance"),
    FeatureSpec(4, "shunt_resistance_ohm", "Ohm", 650.0, 10.0, 5000.0, "Calculated cell parallel shunt resistance"),
    FeatureSpec(5, "cell_efficiency_pct", "%", 23.5, 15.0, 26.5, "Photoelectric conversion efficiency"),
    FeatureSpec(6, "soldering_temp_top_c", "C", 225.0, 150.0, 300.0, "Tabber stringer upper soldering head temperature"),
    FeatureSpec(7, "soldering_temp_bottom_c", "C", 220.0, 150.0, 300.0, "Tabber stringer lower preheating bed temperature"),
    FeatureSpec(8, "ribbon_tension_n", "N", 1.2, 0.1, 5.0, "Copper ribbon mechanical feed tension"),
    FeatureSpec(9, "squeegee_pressure_n_cm2", "N/cm2", 18.0, 5.0, 35.0, "Screen printer squeegee contact pressure"),
    FeatureSpec(10, "squeegee_speed_mm_s", "mm/s", 250.0, 100.0, 500.0, "Screen printing squeegee stroke speed"),
    FeatureSpec(11, "screen_snapoff_mm", "mm", 1.8, 0.5, 4.0, "Gap distance between screen mesh and cell"),
    FeatureSpec(12, "paste_temperature_c", "C", 23.0, 15.0, 35.0, "Silver metallization paste reservoir temperature"),
    FeatureSpec(13, "paste_viscosity_pa_s", "Pa*s", 240.0, 100.0, 450.0, "In-line metallization paste rheological viscosity"),
    FeatureSpec(14, "firing_peak_temp_c", "C", 860.0, 750.0, 1000.0, "Metallization fast-firing peak zone temperature"),
    FeatureSpec(15, "firing_belt_speed_m_min", "m/min", 5.8, 3.0, 9.0, "Fast-firing furnace mesh conveyor transit rate"),
    FeatureSpec(16, "firing_exhaust_pressure_pa", "Pa", -35.0, -100.0, 0.0, "Flue exhaust negative pressure draft"),
    FeatureSpec(17, "lamination_temp_c", "C", 148.0, 120.0, 180.0, "EVA encapsulation diaphragm heating temperature"),
    FeatureSpec(18, "lamination_vacuum_mbar", "mbar", 0.8, 0.01, 10.0, "Laminator degassing chamber vacuum level"),
    FeatureSpec(19, "lamination_pressure_bar", "bar", 0.9, 0.2, 2.0, "Encapsulation pressing hydraulic pressure"),
    FeatureSpec(20, "gripper_vacuum_kpa", "kPa", -75.0, -100.0, -20.0, "Wafer transfer arm suction cup vacuum level"),
    FeatureSpec(21, "transfer_accel_max_g", "g", 0.45, 0.01, 3.0, "Wafer transfer robotics peak acceleration vector"),
    FeatureSpec(22, "texturing_bath_temp_c", "C", 80.0, 60.0, 95.0, "Alkaline texturing etching bath temperature"),
    FeatureSpec(23, "texturing_hcl_conc_pct", "%", 2.5, 0.5, 10.0, "Acid clean bath concentration"),
    FeatureSpec(24, "upstream_total_defect_count", "count", 0.0, 0.0, 50.0, "Total upstream Model 1 optical defect detections"),
    FeatureSpec(25, "upstream_crack_count", "count", 0.0, 0.0, 20.0, "Model 1 detected micro-crack and macro-crack count"),
    FeatureSpec(26, "upstream_finger_interruption_count", "count", 0.0, 0.0, 20.0, "Model 1 detected broken finger grid line count"),
    FeatureSpec(27, "upstream_defect_area_ratio", "ratio", 0.0, 0.0, 1.0, "Fraction of cell surface obscured by defects"),
    FeatureSpec(28, "cleanroom_temp_c", "C", 22.0, 18.0, 28.0, "Fabrication facility cleanroom ambient temperature"),
    FeatureSpec(29, "cleanroom_humidity_pct", "%", 45.0, 25.0, 65.0, "Cleanroom relative humidity percentage"),
    FeatureSpec(30, "cleanroom_particulates_pm25", "ug/m3", 5.0, 0.0, 50.0, "Cleanroom airborne fine particulate density"),
    FeatureSpec(31, "batch_progress_ratio", "ratio", 0.5, 0.0, 1.0, "Normalized position of cell within production batch"),
]

CANONICAL_SOLAR_FEATURE_NAMES: List[str] = [f.name for f in CANONICAL_SOLAR_FEATURES]
SOLAR_FEATURE_LOOKUP: Dict[str, FeatureSpec] = {f.name: f for f in CANONICAL_SOLAR_FEATURES}


class PredictiveQualityFeatureExtractor:
    """Extracts, normalizes, and validates feature vectors for Model 3."""

    def __init__(self, domain: ModelDomain = ModelDomain.SOLAR_CELL_MANUFACTURING) -> None:
        self.domain = domain

    def extract(self, req: PredictiveQualityInput) -> Tuple[np.ndarray, List[str], Dict[str, float]]:
        """
        Extracts ordered, scaled feature array and raw feature dictionary.
        Returns: (feature_array, feature_names, raw_feature_dict)
        """
        if req.domain == ModelDomain.SEMICONDUCTOR_BENCHMARK:
            return self._extract_benchmark(req)
        return self._extract_solar(req)

    def _extract_solar(self, req: PredictiveQualityInput) -> Tuple[np.ndarray, List[str], Dict[str, float]]:
        raw_map: Dict[str, float] = {}

        # 1. Direct raw features if provided
        if req.raw_features:
            for k, v in req.raw_features.items():
                if v is not None:
                    raw_map[k] = float(v)

        # 2. Electrical parameters
        if req.electrical_parameters:
            ep = req.electrical_parameters
            if ep.voc_v is not None: raw_map["voc_v"] = ep.voc_v
            if ep.isc_a is not None: raw_map["isc_a"] = ep.isc_a
            if ep.fill_factor_pct is not None: raw_map["fill_factor_pct"] = ep.fill_factor_pct
            if ep.series_resistance_mohm is not None: raw_map["series_resistance_mohm"] = ep.series_resistance_mohm
            if ep.shunt_resistance_ohm is not None: raw_map["shunt_resistance_ohm"] = ep.shunt_resistance_ohm
            if ep.cell_efficiency_pct is not None: raw_map["cell_efficiency_pct"] = ep.cell_efficiency_pct

        # 3. Model 1 optical defect summary
        if req.defect_summary:
            ds = req.defect_summary
            raw_map["upstream_total_defect_count"] = float(ds.total_defect_count)
            raw_map["upstream_crack_count"] = float(ds.crack_count)
            raw_map["upstream_finger_interruption_count"] = float(ds.finger_interruption_count)
            raw_map["upstream_defect_area_ratio"] = float(ds.defect_area_ratio)

        # 4. Cleanroom environmental context
        if req.environmental_context:
            ec = req.environmental_context
            if ec.cleanroom_temp_c is not None: raw_map["cleanroom_temp_c"] = ec.cleanroom_temp_c
            if ec.cleanroom_humidity_pct is not None: raw_map["cleanroom_humidity_pct"] = ec.cleanroom_humidity_pct
            if ec.cleanroom_particulates_pm25 is not None: raw_map["cleanroom_particulates_pm25"] = ec.cleanroom_particulates_pm25
            if ec.batch_progress_ratio is not None: raw_map["batch_progress_ratio"] = ec.batch_progress_ratio

        # 5. Sensor measurements
        if req.sensor_measurements:
            for sm in req.sensor_measurements:
                st = sm.sensor_type.strip().lower()
                val = float(sm.measurement_value)
                if st in SOLAR_FEATURE_LOOKUP:
                    raw_map[st] = val

        # 6. Override from direct feature vector if provided and exact match
        if req.feature_vector and len(req.feature_vector) == CANONICAL_SOLAR_FEATURE_COUNT:
            for idx, val in enumerate(req.feature_vector):
                raw_map[CANONICAL_SOLAR_FEATURE_NAMES[idx]] = float(val)

        # Assemble canonical 32-D vector
        vec = np.zeros(CANONICAL_SOLAR_FEATURE_COUNT, dtype=np.float32)
        for idx, spec in enumerate(CANONICAL_SOLAR_FEATURES):
            if spec.name in raw_map:
                val = raw_map[spec.name]
                # Clamp within physical valid range
                val = max(spec.min_valid, min(spec.max_valid, val))
                vec[idx] = val
            else:
                # Use nominal baseline
                vec[idx] = spec.nominal
                raw_map[spec.name] = spec.nominal

        return vec, CANONICAL_SOLAR_FEATURE_NAMES, raw_map

    def _extract_benchmark(self, req: PredictiveQualityInput) -> Tuple[np.ndarray, List[str], Dict[str, float]]:
        """Handles external semiconductor benchmark (e.g. SECOM 590 or reduced dimensions)."""
        if req.feature_vector is not None and len(req.feature_vector) > 0:
            dim = len(req.feature_vector)
            names = [f"secom_signal_{i:03d}" for i in range(dim)]
            raw_map = {names[i]: float(req.feature_vector[i]) for i in range(dim)}
            arr = np.array(req.feature_vector, dtype=np.float32)
            return arr, names, raw_map

        if req.raw_features:
            names = sorted(req.raw_features.keys())
            arr = np.array([float(req.raw_features[k]) for k in names], dtype=np.float32)
            return arr, names, {k: float(v) for k, v in req.raw_features.items()}

        raise ValueError("Semiconductor benchmark domain requires non-empty feature_vector or raw_features.")

    def has_sufficient_features(self, req: PredictiveQualityInput) -> bool:
        """Determines if the request provides sufficient measurement signals."""
        if req.feature_vector and len(req.feature_vector) > 0:
            return True
        if req.raw_features and len(req.raw_features) > 0:
            return True
        if req.electrical_parameters is not None:
            ep = req.electrical_parameters
            if any(v is not None for v in [ep.voc_v, ep.isc_a, ep.fill_factor_pct, ep.cell_efficiency_pct]):
                return True
        if req.sensor_measurements and len(req.sensor_measurements) > 0:
            return True
        if req.defect_summary is not None and req.defect_summary.total_defect_count > 0:
            return True
        return False
