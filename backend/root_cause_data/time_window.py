"""Time-window feature extraction for manufacturing sensor telemetry streams."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Dict, List, Optional
import numpy as np

from .schema import (
    CANONICAL_FEATURE_ORDER,
    SENSOR_UNIT_REGISTRY,
    ProductionEventRecord,
    SensorReading,
)


class TimeWindowFeatureExtractor:
    """
    Extracts rolling window statistical aggregates from high-frequency sensor streams
    preceding each cell inspection timestamp.
    """

    def __init__(
        self,
        primary_window_minutes: int = 15,
        trend_window_minutes: int = 60,
    ):
        self.primary_window = timedelta(minutes=primary_window_minutes)
        self.trend_window = timedelta(minutes=trend_window_minutes)

    def extract_features_for_inspection(
        self,
        inspection_time: datetime,
        readings: List[SensorReading],
        events: Optional[List[ProductionEventRecord]] = None,
        defect_metadata: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, float]:
        """
        Computes the complete canonical feature vector for an inspection timestamp.
        """
        if inspection_time.tzinfo is None:
            inspection_time = inspection_time.replace(tzinfo=timezone.utc)

        t_start_primary = inspection_time - self.primary_window
        t_start_trend = inspection_time - self.trend_window

        # Filter readings to the relevant time window strictly before inspection (prevent leakage)
        # T - trend <= t <= T
        window_readings: Dict[str, List[SensorReading]] = {}
        for r in readings:
            rec_time = r.recorded_at
            if rec_time.tzinfo is None:
                rec_time = rec_time.replace(tzinfo=timezone.utc)

            # Strictly enforce temporal causality: only readings PRIOR to inspection
            if t_start_trend <= rec_time <= inspection_time:
                window_readings.setdefault(r.sensor_type, []).append(r)

        features: Dict[str, float] = {}

        # 1. Optical / Defect metadata features (from Model 1 output)
        def_meta = defect_metadata or {}
        defect_count = float(def_meta.get("detections_count", 0))
        features["feat_defect_count"] = defect_count
        features["feat_max_detection_conf"] = float(def_meta.get("max_confidence", 0.0))
        features["feat_mean_detection_conf"] = float(def_meta.get("mean_confidence", 0.0))
        features["feat_defect_area_ratio"] = float(def_meta.get("defect_area_ratio", 0.0))

        primary_defect = str(def_meta.get("primary_defect_type", "")).lower()
        features["feat_is_crack"] = 1.0 if "crack" in primary_defect and "star" not in primary_defect else 0.0
        features["feat_is_star_crack"] = 1.0 if "star_crack" in primary_defect else 0.0
        features["feat_is_finger"] = 1.0 if "finger" in primary_defect else 0.0
        features["feat_is_thick_line"] = 1.0 if "thick_line" in primary_defect else 0.0
        features["feat_is_black_core"] = 1.0 if "black_core" in primary_defect else 0.0
        features["feat_is_dislocation"] = 1.0 if "dislocation" in primary_defect else 0.0
        features["feat_is_printing_error"] = 1.0 if "printing_error" in primary_defect else 0.0
        features["feat_is_short_circuit"] = 1.0 if "short_circuit" in primary_defect else 0.0

        # Helper to compute window stats
        def get_stats(sensor_name: str, in_primary: bool = True) -> Dict[str, float]:
            sensor_def = SENSOR_UNIT_REGISTRY.get(sensor_name)
            nominal = sensor_def.nominal_target if sensor_def else 0.0

            series = window_readings.get(sensor_name, [])
            if in_primary:
                cutoff = t_start_primary
                vals = [r.measurement_value for r in series if r.recorded_at >= cutoff]
            else:
                vals = [r.measurement_value for r in series]

            if not vals:
                return {
                    "mean": nominal,
                    "std": 0.0,
                    "max": nominal,
                    "min": nominal,
                    "delta_target": 0.0,
                    "drift": 0.0,
                }

            arr = np.array(vals, dtype=np.float64)
            mean_val = float(np.mean(arr))
            std_val = float(np.std(arr)) if len(arr) > 1 else 0.0
            max_val = float(np.max(arr))
            min_val = float(np.min(arr))
            delta_target = mean_val - nominal
            drift = float(arr[-1] - arr[0]) if len(arr) > 1 else 0.0

            return {
                "mean": mean_val,
                "std": std_val,
                "max": max_val,
                "min": min_val,
                "delta_target": delta_target,
                "drift": drift,
            }

        # 2. Soldering (Stringer) stats
        sold_top = get_stats("soldering_temp_top_c", in_primary=True)
        sold_bot = get_stats("soldering_temp_bottom_c", in_primary=True)
        ribbon = get_stats("ribbon_tension_n", in_primary=True)

        features["soldering_temp_top_mean_w15"] = sold_top["mean"]
        features["soldering_temp_top_std_w15"] = sold_top["std"]
        features["soldering_temp_top_max_w15"] = sold_top["max"]
        features["soldering_temp_delta_mean_w15"] = sold_top["mean"] - sold_bot["mean"]
        features["ribbon_tension_mean_w15"] = ribbon["mean"]
        features["ribbon_tension_std_w15"] = ribbon["std"]

        # 3. Screen Printing stats
        squeegee_p = get_stats("squeegee_pressure_n_cm2", in_primary=True)
        squeegee_p_trend = get_stats("squeegee_pressure_n_cm2", in_primary=False)
        squeegee_v = get_stats("squeegee_speed_mm_s", in_primary=True)
        snapoff = get_stats("screen_snapoff_mm", in_primary=True)
        paste_t = get_stats("paste_temperature_c", in_primary=True)
        paste_visc = get_stats("paste_viscosity_pa_s", in_primary=True)

        features["squeegee_pressure_mean_w15"] = squeegee_p["mean"]
        features["squeegee_pressure_drift_w60"] = squeegee_p_trend["drift"]
        features["squeegee_speed_mean_w15"] = squeegee_v["mean"]
        features["screen_snapoff_mean_w15"] = snapoff["mean"]
        features["paste_temp_mean_w15"] = paste_t["mean"]
        features["paste_viscosity_mean_w15"] = paste_visc["mean"]

        # 4. Firing Furnace stats
        firing_p = get_stats("firing_peak_temp_c", in_primary=True)
        firing_v = get_stats("firing_belt_speed_m_min", in_primary=True)
        firing_exh = get_stats("firing_exhaust_pressure_pa", in_primary=True)

        features["firing_peak_temp_mean_w15"] = firing_p["mean"]
        features["firing_peak_temp_delta_target"] = firing_p["delta_target"]
        features["firing_belt_speed_mean_w15"] = firing_v["mean"]
        features["firing_exhaust_pressure_mean_w15"] = firing_exh["mean"]

        # 5. Lamination stats
        lam_t = get_stats("lamination_temp_c", in_primary=True)
        lam_vac = get_stats("lamination_vacuum_mbar", in_primary=True)
        lam_p = get_stats("lamination_pressure_bar", in_primary=True)

        features["lamination_temp_mean_w15"] = lam_t["mean"]
        features["lamination_vacuum_mean_w15"] = lam_vac["mean"]
        features["lamination_pressure_mean_w15"] = lam_p["mean"]

        # 6. Wafer Handling stats
        grip_vac = get_stats("gripper_vacuum_kpa", in_primary=True)
        trans_acc = get_stats("transfer_accel_max_g", in_primary=True)

        features["gripper_vacuum_mean_w15"] = grip_vac["mean"]
        features["transfer_accel_peak_w15"] = trans_acc["max"]

        # 7. Electrical Flash Test (point-in-time measurements)
        features["voc_v"] = get_stats("voc_v", in_primary=True)["mean"]
        features["isc_a"] = get_stats("isc_a", in_primary=True)["mean"]
        features["fill_factor_pct"] = get_stats("fill_factor_pct", in_primary=True)["mean"]
        features["series_resistance_mohm"] = get_stats("series_resistance_mohm", in_primary=True)["mean"]
        features["shunt_resistance_ohm"] = get_stats("shunt_resistance_ohm", in_primary=True)["mean"]

        # 8. Equipment Events in the preceding 60 minutes
        event_count = 0
        has_warning = 0.0
        if events:
            for ev in events:
                ev_time = ev.started_at
                if ev_time.tzinfo is None:
                    ev_time = ev_time.replace(tzinfo=timezone.utc)
                if t_start_trend <= ev_time <= inspection_time:
                    event_count += 1
                    if ev.severity.lower() in ("warning", "error", "critical"):
                        has_warning = 1.0

        features["event_count_recent_1h"] = float(event_count)
        features["has_warning_recent_1h"] = has_warning

        return features

    def vector_to_ordered_array(
        self, feature_dict: Dict[str, float]
    ) -> np.ndarray:
        """Flattens feature dictionary strictly according to CANONICAL_FEATURE_ORDER."""
        return np.array([feature_dict.get(k, 0.0) for k in CANONICAL_FEATURE_ORDER], dtype=np.float32)
