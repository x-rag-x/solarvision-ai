"""
SolarVision AI — Model 2: Manufacturing Root Cause Analysis
Feature Extraction, Alignment, and Normalization Pipeline
Provides unified Schema Version 2.0.0 (48 canonical dimensions),
legacy 40-feature mapping, and 88-dimensional online multi-modal serving features.
"""

from __future__ import annotations

from datetime import datetime, timezone
import math
from typing import Any, Optional, Sequence
import numpy as np

from backend.root_cause_data.schema import (
    CANONICAL_FEATURE_ORDER,
    ROOT_CAUSE_TAXONOMY,
    ROOT_CAUSE_DESCRIPTIONS,
    SENSOR_UNIT_REGISTRY,
)
from backend.root_cause_data.feature_spec import (
    CANONICAL_FEATURES_V2,
    CANONICAL_FEATURE_NAMES_V2,
    CANONICAL_FEATURE_COUNT_V2,
    FEATURE_SCHEMA_VERSION,
    RECONCILED_ROOT_CAUSE_CATALOG,
    FeatureDomain,
    MissingValuePolicy,
    FeatureDefinition,
    RootCauseClassMapping,
)
from .schemas import (
    BatchInput,
    DefectInput,
    MachineInput,
    ProductionEventInput,
    RootCauseAnalysisInput,
    SensorMeasurementInput,
)

# Standardized SolarVision 9 defect classes from Model 1
STANDARD_DEFECT_CLASSES = (
    "crack",
    "finger_interruption",
    "busbar_defect",
    "soldering_defect",
    "microcrack",
    "hotspot",
    "cell_breakage",
    "foreign_material",
    "anti_reflective_coating",
)

# Known manufacturing machine types in photovoltaic module fabrication
STANDARD_MACHINE_TYPES = (
    "stringer",
    "tabber",
    "laminator",
    "soldering_station",
    "wafer_saw",
    "laser_cutter",
    "coating_chamber",
)

# Key sensor telemetry types monitored in solar cell line
STANDARD_SENSOR_GROUPS = (
    "laminator_temp",
    "laminator_pressure",
    "soldering_temp",
    "flux_flow_rate",
    "conveyor_speed",
    "chamber_vacuum",
    "ambient_humidity",
)

# Physical sensor boundaries for anomaly validation & clipping
SENSOR_BOUNDS: dict[str, tuple[float, float]] = {
    "laminator_temp": (20.0, 220.0),       # °C
    "laminator_pressure": (0.0, 10.0),      # bar
    "soldering_temp": (150.0, 450.0),       # °C
    "flux_flow_rate": (0.0, 50.0),          # ml/min
    "conveyor_speed": (0.0, 5.0),           # m/s
    "chamber_vacuum": (0.0, 1200.0),        # mbar
    "ambient_humidity": (0.0, 100.0),       # %
}

# Nominal sensor baselines for mean/std normalization
SENSOR_NOMINALS: dict[str, tuple[float, float]] = {
    "laminator_temp": (145.0, 15.0),
    "laminator_pressure": (1.0, 0.25),
    "soldering_temp": (320.0, 30.0),
    "flux_flow_rate": (15.0, 5.0),
    "conveyor_speed": (1.2, 0.3),
    "chamber_vacuum": (50.0, 20.0),
    "ambient_humidity": (45.0, 10.0),
}


class FeatureExtractionResult:
    def __init__(
        self,
        feature_vector: np.ndarray,
        feature_dict: dict[str, float],
        feature_names: list[str],
        missing_fields: list[str],
        has_sufficient_process_data: bool,
        canonical_vector: Optional[np.ndarray] = None,
        canonical_v2_vector: Optional[np.ndarray] = None,
        schema_version: str = FEATURE_SCHEMA_VERSION,
        canonical_v2_names: Optional[list[str]] = None,
    ) -> None:
        self.feature_vector = feature_vector
        self.feature_dict = feature_dict
        self.feature_names = feature_names
        self.missing_fields = missing_fields
        self.has_sufficient_process_data = has_sufficient_process_data
        self.canonical_vector = canonical_vector
        self.canonical_v2_vector = canonical_v2_vector
        self.schema_version = schema_version
        self.canonical_v2_names = canonical_v2_names or list(CANONICAL_FEATURE_NAMES_V2)


class FeatureExtractor:
    """
    Safely parses, normalizes, and aligns multi-modal manufacturing inputs.
    Outputs the 88-dimensional online serving feature vector, canonical 40-feature mapping,
    and unified 48-feature canonical vector for Schema Version 2.0.0.
    """

    def __init__(self) -> None:
        self._feature_names = self._build_feature_name_registry()

    @property
    def feature_names(self) -> list[str]:
        return list(self._feature_names)

    @property
    def canonical_feature_names(self) -> list[str]:
        return list(CANONICAL_FEATURE_ORDER)

    @property
    def canonical_features_v2(self) -> list[str]:
        return list(CANONICAL_FEATURE_NAMES_V2)

    @property
    def canonical_feature_count_v2(self) -> int:
        return CANONICAL_FEATURE_COUNT_V2

    @property
    def schema_version(self) -> str:
        return FEATURE_SCHEMA_VERSION

    def _build_feature_name_registry(self) -> list[str]:
        names: list[str] = []
        # 1. Defect class counts and statistics (15)
        for c in STANDARD_DEFECT_CLASSES:
            names.append(f"defect_count_{c}")
        names.extend([
            "defect_total_count",
            "defect_avg_confidence",
            "defect_max_confidence",
            "defect_edge_ratio",
            "defect_center_ratio",
            "defect_total_area_fraction",
        ])

        # 2. Machine features (12)
        for mt in STANDARD_MACHINE_TYPES:
            names.append(f"machine_is_{mt}")
        names.extend([
            "machine_status_operational",
            "machine_status_maintenance_required",
            "machine_status_error",
            "machine_days_since_maintenance",
            "machine_maintenance_overdue",
        ])

        # 3. Batch features (5)
        names.extend([
            "batch_is_monocrystalline",
            "batch_is_polycrystalline",
            "batch_is_perc",
            "batch_is_topcon",
            "batch_progress_ratio",
        ])

        # 4. Sensor telemetry features (50)
        for sg in STANDARD_SENSOR_GROUPS:
            names.extend([
                f"sensor_{sg}_mean_norm",
                f"sensor_{sg}_min_norm",
                f"sensor_{sg}_max_norm",
                f"sensor_{sg}_std_norm",
                f"sensor_{sg}_anomaly_count",
                f"sensor_{sg}_max_anomaly_score",
                f"sensor_{sg}_is_missing",
            ])
        names.extend(["sensor_other_anomalies_total"])

        # 5. Production events features (6)
        names.extend([
            "events_total_count",
            "events_critical_count",
            "events_high_count",
            "events_thermal_flag",
            "events_mechanical_flag",
            "events_operator_override_flag",
        ])
        return names

    def extract(self, data: RootCauseAnalysisInput) -> FeatureExtractionResult:
        features: dict[str, float] = {}
        missing_fields: list[str] = []

        # ---------------------------------------------------------------------
        # 1. Extract Defect Features
        # ---------------------------------------------------------------------
        detections = [d for d in data.detections if d.confidence >= data.confidence_threshold]
        class_counts = {c: 0 for c in STANDARD_DEFECT_CLASSES}
        confidences: list[float] = []
        edge_defects = 0
        center_defects = 0
        total_area = 0.0

        for d in detections:
            norm_type = self._normalize_defect_type(d.defect_type)
            if norm_type in class_counts:
                class_counts[norm_type] += 1
            confidences.append(d.confidence)

            # Spatial location metrics (normalized bbox coordinates 0.0 to 1.0 or pixel scaled)
            cx = (d.x1 + d.x2) / 2.0
            cy = (d.y1 + d.y2) / 2.0
            if cx > 1.0 or cy > 1.0:
                cx = min(max(cx / 1024.0, 0.0), 1.0)
                cy = min(max(cy / 1024.0, 0.0), 1.0)

            dist_from_center = math.sqrt((cx - 0.5) ** 2 + (cy - 0.5) ** 2)
            if dist_from_center > 0.35:
                edge_defects += 1
            else:
                center_defects += 1

            w = max(0.0, d.x2 - d.x1)
            h = max(0.0, d.y2 - d.y1)
            if w > 1.0 or h > 1.0:
                w /= 1024.0
                h /= 1024.0
            total_area += min(w * h, 1.0)

        for c in STANDARD_DEFECT_CLASSES:
            features[f"defect_count_{c}"] = float(class_counts[c])

        total_det = len(detections)
        features["defect_total_count"] = float(total_det)
        features["defect_avg_confidence"] = float(np.mean(confidences)) if confidences else 0.0
        features["defect_max_confidence"] = float(max(confidences)) if confidences else 0.0
        features["defect_edge_ratio"] = float(edge_defects / total_det) if total_det > 0 else 0.0
        features["defect_center_ratio"] = float(center_defects / total_det) if total_det > 0 else 0.0
        features["defect_total_area_fraction"] = float(min(total_area, 1.0))

        # ---------------------------------------------------------------------
        # 2. Extract Machine Features
        # ---------------------------------------------------------------------
        machine = data.machine
        for mt in STANDARD_MACHINE_TYPES:
            features[f"machine_is_{mt}"] = 0.0
        features["machine_status_operational"] = 1.0
        features["machine_status_maintenance_required"] = 0.0
        features["machine_status_error"] = 0.0
        features["machine_days_since_maintenance"] = 0.0
        features["machine_maintenance_overdue"] = 0.0

        if machine is not None:
            m_type = machine.machine_type.lower().strip()
            for mt in STANDARD_MACHINE_TYPES:
                if mt in m_type:
                    features[f"machine_is_{mt}"] = 1.0

            status = (machine.status or "operational").lower().strip()
            features["machine_status_operational"] = 1.0 if status == "operational" else 0.0
            features["machine_status_maintenance_required"] = 1.0 if "maintenance" in status else 0.0
            features["machine_status_error"] = 1.0 if status in ("error", "offline") else 0.0

            now = datetime.now(timezone.utc)
            if machine.last_maintenance_at:
                try:
                    last_m = self._parse_iso(machine.last_maintenance_at)
                    days = max(0.0, (now - last_m).total_seconds() / 86400.0)
                    features["machine_days_since_maintenance"] = float(min(days, 365.0))
                except Exception:
                    missing_fields.append("machine.last_maintenance_at_parse_error")
            else:
                missing_fields.append("machine.last_maintenance_at")
        else:
            missing_fields.append("machine")

        # ---------------------------------------------------------------------
        # 3. Extract Batch Features
        # ---------------------------------------------------------------------
        batch = data.batch
        features["batch_is_monocrystalline"] = 1.0
        features["batch_is_polycrystalline"] = 0.0
        features["batch_is_perc"] = 0.0
        features["batch_is_topcon"] = 0.0
        features["batch_progress_ratio"] = 0.5

        if batch is not None:
            w_type = (batch.wafer_type or "monocrystalline").lower().strip()
            features["batch_is_monocrystalline"] = 1.0 if "mono" in w_type else 0.0
            features["batch_is_polycrystalline"] = 1.0 if "poly" in w_type or "multi" in w_type else 0.0
            features["batch_is_perc"] = 1.0 if "perc" in w_type else 0.0
            features["batch_is_topcon"] = 1.0 if "topcon" in w_type else 0.0

            if batch.target_quantity and batch.target_quantity > 0:
                act = batch.actual_quantity if batch.actual_quantity is not None else 0
                features["batch_progress_ratio"] = float(min(max(act / batch.target_quantity, 0.0), 2.0))
        else:
            missing_fields.append("batch")

        # ---------------------------------------------------------------------
        # 4. Extract Sensor Telemetry Features (Serving 50 features)
        # ---------------------------------------------------------------------
        sensors_by_group: dict[str, list[SensorMeasurementInput]] = {sg: [] for sg in STANDARD_SENSOR_GROUPS}
        other_anomalies = 0

        for m in data.sensor_measurements:
            grp = self._match_sensor_group(m.sensor_type)
            if grp in sensors_by_group:
                sensors_by_group[grp].append(m)
            elif m.is_anomaly:
                other_anomalies += 1

        for sg in STANDARD_SENSOR_GROUPS:
            items = sensors_by_group[sg]
            if items:
                features[f"sensor_{sg}_is_missing"] = 0.0
                values: list[float] = []
                anomaly_count = 0
                max_anomaly_score = 0.0

                b_min, b_max = SENSOR_BOUNDS.get(sg, (-1000.0, 10000.0))
                nom_mean, nom_std = SENSOR_NOMINALS.get(sg, (0.0, 1.0))

                for m in items:
                    val = min(max(m.measurement_value, b_min), b_max)
                    values.append(val)
                    if m.is_anomaly:
                        anomaly_count += 1
                        if m.anomaly_score is not None:
                            max_anomaly_score = max(max_anomaly_score, m.anomaly_score)

                v_arr = np.array(values, dtype=np.float64)
                features[f"sensor_{sg}_mean_norm"] = float((np.mean(v_arr) - nom_mean) / (nom_std + 1e-7))
                features[f"sensor_{sg}_min_norm"] = float((np.min(v_arr) - nom_mean) / (nom_std + 1e-7))
                features[f"sensor_{sg}_max_norm"] = float((np.max(v_arr) - nom_mean) / (nom_std + 1e-7))
                features[f"sensor_{sg}_std_norm"] = float(np.std(v_arr) / (nom_std + 1e-7))
                features[f"sensor_{sg}_anomaly_count"] = float(anomaly_count)
                features[f"sensor_{sg}_max_anomaly_score"] = float(max_anomaly_score)
            else:
                features[f"sensor_{sg}_is_missing"] = 1.0
                features[f"sensor_{sg}_mean_norm"] = 0.0
                features[f"sensor_{sg}_min_norm"] = 0.0
                features[f"sensor_{sg}_max_norm"] = 0.0
                features[f"sensor_{sg}_std_norm"] = 0.0
                features[f"sensor_{sg}_anomaly_count"] = 0.0
                features[f"sensor_{sg}_max_anomaly_score"] = 0.0
                missing_fields.append(f"sensors.{sg}")

        features["sensor_other_anomalies_total"] = float(other_anomalies)

        # ---------------------------------------------------------------------
        # 5. Extract Production Event Features
        # ---------------------------------------------------------------------
        events = data.production_events
        crit_count = 0
        high_count = 0
        thermal_flag = 0.0
        mech_flag = 0.0
        override_flag = 0.0

        for ev in events:
            sev = (ev.severity or "info").lower().strip()
            if sev in ("critical", "high"):
                if sev == "critical":
                    crit_count += 1
                else:
                    high_count += 1

            etype = (ev.event_type or "").lower().strip()
            if any(term in etype for term in ("temp", "thermal", "heat", "cool")):
                thermal_flag = 1.0
            if any(term in etype for term in ("jam", "tension", "feeder", "vacuum", "motor", "conveyor")):
                mech_flag = 1.0
            if any(term in etype for term in ("override", "manual", "stop", "bypass")):
                override_flag = 1.0

        features["events_total_count"] = float(len(events))
        features["events_critical_count"] = float(crit_count)
        features["events_high_count"] = float(high_count)
        features["events_thermal_flag"] = thermal_flag
        features["events_mechanical_flag"] = mech_flag
        features["events_operator_override_flag"] = override_flag

        if not events:
            missing_fields.append("production_events")

        # ---------------------------------------------------------------------
        # Assemble 88-dimensional Vector in Strict Registry Order
        # ---------------------------------------------------------------------
        vector = np.zeros(len(self._feature_names), dtype=np.float32)
        for idx, fname in enumerate(self._feature_names):
            val = features.get(fname, 0.0)
            if math.isnan(val) or math.isinf(val):
                val = 0.0
            vector[idx] = float(np.clip(val, -50.0, 50.0))

        # Check sufficiency of process data
        has_sensors = len(data.sensor_measurements) > 0
        has_machine = data.machine is not None
        has_batch = data.batch is not None
        has_events = len(data.production_events) > 0
        has_sufficient_process_data = bool(has_sensors or has_machine or has_batch or has_events)

        # Build canonical 40-feature mapping for legacy compatibility
        canonical_vector = self.to_canonical_40(data, detections, confidences)

        # Build canonical 48-feature mapping for Schema Version 2.0.0
        canonical_v2_vector = self.to_canonical_48(data, detections, confidences, features)

        return FeatureExtractionResult(
            feature_vector=vector,
            feature_dict=features,
            feature_names=self._feature_names,
            missing_fields=missing_fields,
            has_sufficient_process_data=has_sufficient_process_data,
            canonical_vector=canonical_vector,
            canonical_v2_vector=canonical_v2_vector,
            schema_version=FEATURE_SCHEMA_VERSION,
            canonical_v2_names=list(CANONICAL_FEATURE_NAMES_V2),
        )

    def to_canonical_48(
        self,
        data: RootCauseAnalysisInput,
        detections: list[DefectInput],
        confidences: list[float],
        features: dict[str, float],
    ) -> np.ndarray:
        """
        Maps features strictly into the 48-feature CANONICAL_FEATURES_V2
        defined in backend.root_cause_data.feature_spec for Schema Version 2.0.0.
        Enforces identical ordering, names, units, nominal baselines, and missing-value policies.
        """
        c48 = np.zeros(CANONICAL_FEATURE_COUNT_V2, dtype=np.float32)

        # 1. Defect features (indices 0 - 14) from computed features dict
        for idx in range(15):
            fname = CANONICAL_FEATURE_NAMES_V2[idx]
            c48[idx] = float(features.get(fname, 0.0))

        # 2. Machine context (indices 15 - 26) from computed features dict
        for idx in range(15, 27):
            fname = CANONICAL_FEATURE_NAMES_V2[idx]
            c48[idx] = float(features.get(fname, 0.0))

        # 3. Batch metadata (indices 27 - 31) from computed features dict
        for idx in range(27, 32):
            fname = CANONICAL_FEATURE_NAMES_V2[idx]
            c48[idx] = float(features.get(fname, 0.0))

        # 4. Sensor telemetry (indices 32 - 41) - normalized via nominal mean & std
        sensor_map: dict[str, list[float]] = {}
        anomaly_count = 0
        for s in data.sensor_measurements:
            st = s.sensor_type.lower().strip().replace("-", "_").replace(" ", "_")
            sensor_map.setdefault(st, []).append(float(s.measurement_value))
            if s.is_anomaly or (s.anomaly_score is not None and s.anomaly_score >= 0.5):
                anomaly_count += 1

        def _calc_sensor_norm(keys: tuple[str, ...], nominal_mean: float, nominal_std: float) -> float:
            vals: list[float] = []
            for k in keys:
                for sk, sv in sensor_map.items():
                    if k in sk or sk in k:
                        vals.extend(sv)
            if not vals:
                return 0.0  # missing_policy = NOMINAL_BASELINE (0.0 z-score)
            mean_val = float(np.mean(vals))
            return float(np.clip((mean_val - nominal_mean) / (nominal_std + 1e-7), -5.0, 5.0))

        c48[32] = _calc_sensor_norm(("soldering_temp_top", "solder_top", "soldering_temp"), 225.0, 15.0)
        c48[33] = _calc_sensor_norm(("soldering_temp_bottom", "solder_bottom"), 220.0, 15.0)
        c48[34] = _calc_sensor_norm(("ribbon_tension", "ribbon"), 1.2, 0.3)
        c48[35] = _calc_sensor_norm(("squeegee_pressure", "squeegee"), 18.0, 3.0)
        c48[36] = _calc_sensor_norm(("firing_peak_temp", "firing_temp", "furnace"), 840.0, 20.0)
        c48[37] = _calc_sensor_norm(("lamination_temp", "laminator_temp", "lamination"), 148.0, 8.0)
        c48[38] = _calc_sensor_norm(("lamination_pressure", "laminator_pressure"), 0.9, 0.15)
        c48[39] = _calc_sensor_norm(("chamber_vacuum", "lamination_vacuum", "vacuum"), 0.8, 0.2)
        c48[40] = _calc_sensor_norm(("gripper_vacuum", "gripper"), -75.0, 10.0)
        c48[41] = float(min(anomaly_count, 20.0))

        # 5. Production events (indices 42 - 47) from computed features dict
        for idx in range(42, 48):
            fname = CANONICAL_FEATURE_NAMES_V2[idx]
            c48[idx] = float(features.get(fname, 0.0))

        # Boundary checks & clipping according to CANONICAL_FEATURES_V2 definitions
        for idx, fdef in enumerate(CANONICAL_FEATURES_V2):
            val = c48[idx]
            if math.isnan(val) or math.isinf(val):
                c48[idx] = 0.0
            else:
                c48[idx] = float(np.clip(val, fdef.min_valid, fdef.max_valid))

        return c48

    def extract_canonical_v2(self, data: RootCauseAnalysisInput) -> np.ndarray:
        """Direct extraction of the canonical 48-dimensional feature vector."""
        res = self.extract(data)
        if res.canonical_v2_vector is None:
            raise RuntimeError("Canonical v2 vector extraction failed.")
        return res.canonical_v2_vector

    @staticmethod
    def validate_feature_vector(vector: np.ndarray, expected_dim: int = CANONICAL_FEATURE_COUNT_V2) -> None:
        """
        Validates feature vector length against expected dimensions.
        Rejects mismatched vectors without silent padding or truncation.
        """
        actual_dim = len(vector) if hasattr(vector, "__len__") else 0
        if actual_dim != expected_dim:
            raise ValueError(
                f"Feature vector dimension mismatch: expected {expected_dim} features, "
                f"got {actual_dim}. Silent padding and truncation are strictly prohibited "
                f"under Model 2 Schema Version {FEATURE_SCHEMA_VERSION}."
            )

    def to_canonical_40(
        self,
        data: RootCauseAnalysisInput,
        detections: list[DefectInput],
        confidences: list[float],
    ) -> np.ndarray:
        """
        Maps features strictly into the 40-feature CANONICAL_FEATURE_ORDER
        defined in backend.root_cause_data.schema for training pipeline parity.
        """
        c_dict: dict[str, float] = {}

        # 1. Defect features
        c_dict["feat_defect_count"] = float(len(detections))
        c_dict["feat_max_detection_conf"] = float(max(confidences)) if confidences else 0.0
        c_dict["feat_mean_detection_conf"] = float(np.mean(confidences)) if confidences else 0.0

        total_area = 0.0
        for d in detections:
            w = max(0.0, d.x2 - d.x1)
            h = max(0.0, d.y2 - d.y1)
            if w > 1.0 or h > 1.0:
                w /= 1024.0
                h /= 1024.0
            total_area += min(w * h, 1.0)
        c_dict["feat_defect_area_ratio"] = float(min(total_area, 1.0))

        defect_names = [d.defect_type.lower() for d in detections]
        c_dict["feat_is_crack"] = 1.0 if any("crack" in s and "star" not in s for s in defect_names) else 0.0
        c_dict["feat_is_star_crack"] = 1.0 if any("star" in s for s in defect_names) else 0.0
        c_dict["feat_is_finger"] = 1.0 if any("finger" in s for s in defect_names) else 0.0
        c_dict["feat_is_thick_line"] = 1.0 if any("thick" in s or "busbar" in s for s in defect_names) else 0.0
        c_dict["feat_is_black_core"] = 1.0 if any("black_core" in s for s in defect_names) else 0.0
        c_dict["feat_is_dislocation"] = 1.0 if any("dislocation" in s for s in defect_names) else 0.0
        c_dict["feat_is_printing_error"] = 1.0 if any("printing" in s or "coating" in s for s in defect_names) else 0.0
        c_dict["feat_is_short_circuit"] = 1.0 if any("short" in s or "solder" in s for s in defect_names) else 0.0

        # 2. Sensors with nominal targets
        sensor_lookup: dict[str, list[float]] = {}
        for s in data.sensor_measurements:
            st = s.sensor_type.lower().strip()
            sensor_lookup.setdefault(st, []).append(s.measurement_value)

        def get_stat(name: str, nominal: float) -> dict[str, float]:
            vals = sensor_lookup.get(name, [])
            if not vals:
                return {"mean": nominal, "std": 0.0, "max": nominal, "delta": 0.0, "drift": 0.0}
            arr = np.array(vals, dtype=np.float64)
            return {
                "mean": float(np.mean(arr)),
                "std": float(np.std(arr)) if len(arr) > 1 else 0.0,
                "max": float(np.max(arr)),
                "delta": float(np.mean(arr) - nominal),
                "drift": float(arr[-1] - arr[0]) if len(arr) > 1 else 0.0,
            }

        s_top = get_stat("soldering_temp_top_c", 225.0)
        s_bot = get_stat("soldering_temp_bottom_c", 220.0)
        c_dict["soldering_temp_top_mean_w15"] = s_top["mean"]
        c_dict["soldering_temp_top_std_w15"] = s_top["std"]
        c_dict["soldering_temp_top_max_w15"] = s_top["max"]
        c_dict["soldering_temp_delta_mean_w15"] = s_top["mean"] - s_bot["mean"]

        rib = get_stat("ribbon_tension_n", 1.2)
        c_dict["ribbon_tension_mean_w15"] = rib["mean"]
        c_dict["ribbon_tension_std_w15"] = rib["std"]

        sq_p = get_stat("squeegee_pressure_n_cm2", 18.0)
        c_dict["squeegee_pressure_mean_w15"] = sq_p["mean"]
        c_dict["squeegee_pressure_drift_w60"] = sq_p["drift"]
        c_dict["squeegee_speed_mean_w15"] = get_stat("squeegee_speed_mm_s", 250.0)["mean"]
        c_dict["screen_snapoff_mean_w15"] = get_stat("screen_snapoff_mm", 1.8)["mean"]
        c_dict["paste_temp_mean_w15"] = get_stat("paste_temperature_c", 23.0)["mean"]
        c_dict["paste_viscosity_mean_w15"] = get_stat("paste_viscosity_pa_s", 240.0)["mean"]

        fir_p = get_stat("firing_peak_temp_c", 860.0)
        c_dict["firing_peak_temp_mean_w15"] = fir_p["mean"]
        c_dict["firing_peak_temp_delta_target"] = fir_p["delta"]
        c_dict["firing_belt_speed_mean_w15"] = get_stat("firing_belt_speed_m_min", 5.8)["mean"]
        c_dict["firing_exhaust_pressure_mean_w15"] = get_stat("firing_exhaust_pressure_pa", -35.0)["mean"]

        c_dict["lamination_temp_mean_w15"] = get_stat("lamination_temp_c", 148.0)["mean"]
        c_dict["lamination_vacuum_mean_w15"] = get_stat("lamination_vacuum_mbar", 0.8)["mean"]
        c_dict["lamination_pressure_mean_w15"] = get_stat("lamination_pressure_bar", 0.9)["mean"]

        c_dict["gripper_vacuum_mean_w15"] = get_stat("gripper_vacuum_kpa", -75.0)["mean"]
        c_dict["transfer_accel_peak_w15"] = get_stat("transfer_accel_max_g", 0.45)["max"]

        c_dict["voc_v"] = get_stat("voc_v", 0.685)["mean"]
        c_dict["isc_a"] = get_stat("isc_a", 10.85)["mean"]
        c_dict["fill_factor_pct"] = get_stat("fill_factor_pct", 81.5)["mean"]
        c_dict["series_resistance_mohm"] = get_stat("series_resistance_mohm", 1.15)["mean"]
        c_dict["shunt_resistance_ohm"] = get_stat("shunt_resistance_ohm", 650.0)["mean"]

        c_dict["event_count_recent_1h"] = float(len(data.production_events))
        c_dict["has_warning_recent_1h"] = 1.0 if any(
            (ev.severity or "").lower() in ("warning", "high", "critical") for ev in data.production_events
        ) else 0.0

        c_arr = np.zeros(len(CANONICAL_FEATURE_ORDER), dtype=np.float32)
        for i, f_name in enumerate(CANONICAL_FEATURE_ORDER):
            c_arr[i] = float(c_dict.get(f_name, 0.0))
        return c_arr

    def _normalize_defect_type(self, raw_name: str) -> str:
        s = raw_name.lower().strip().replace("-", "_").replace(" ", "_")
        for std in STANDARD_DEFECT_CLASSES:
            if std in s or s in std:
                return std
        return s

    def _match_sensor_group(self, sensor_type: str) -> str:
        st = sensor_type.lower().strip().replace("-", "_").replace(" ", "_")
        if "laminat" in st and "press" in st:
            return "laminator_pressure"
        if "laminat" in st or ("temp" in st and "chamber" in st):
            return "laminator_temp"
        if "solder" in st or "iron" in st:
            return "soldering_temp"
        if "flux" in st or "flow" in st:
            return "flux_flow_rate"
        if "conveyor" in st or "speed" in st:
            return "conveyor_speed"
        if "vacuum" in st or "mbar" in st:
            return "chamber_vacuum"
        if "humid" in st or "ambient" in st:
            return "ambient_humidity"
        return "other"

    def _parse_iso(self, ts: str) -> datetime:
        clean = ts.replace("Z", "+00:00")
        return datetime.fromisoformat(clean)
