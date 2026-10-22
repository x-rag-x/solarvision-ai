"""
SolarVision AI — Model 2: Manufacturing Root Cause Analysis
Versioned Canonical Feature Specification (Schema Version: 2.0.0)

Resolves the 48-dimension input contract between Agent 1 (Inference) and Agent 3 (Training/Dataset).
Eliminates silent padding and truncation by providing an explicit, mathematically sound,
unified feature representation for multi-modal photovoltaic root-cause analysis.
"""

from __future__ import annotations

from dataclasses import dataclass
from enum import Enum
from typing import Any, Dict, List, Optional, Tuple


class FeatureDomain(str, Enum):
    DEFECT_OPTICAL = "defect_optical"          # Model 1 visual inspection outputs
    MACHINE_CONTEXT = "machine_context"        # Machine configuration & maintenance
    BATCH_MATERIAL = "batch_material"          # Ingot/wafer material & batch progress
    SENSOR_TELEMETRY = "sensor_telemetry"      # Normalized physical sensor telemetry
    PRODUCTION_EVENT = "production_event"      # Alarms, overrides, and equipment events


class MissingValuePolicy(str, Enum):
    ZERO_FILL = "zero_fill"                    # Impute 0.0 (count or flag absent)
    NOMINAL_BASELINE = "nominal_baseline"      # Impute 0.0 z-score (nominal physical setpoint)
    DEFAULT_PROGRESS = "default_progress"      # Impute 0.5 (mid-run assumption)
    OPERATIONAL_DEFAULT = "operational_default" # Impute 1.0 (assume healthy if unflagged)


@dataclass(frozen=True)
class FeatureDefinition:
    index: int
    name: str
    domain: FeatureDomain
    dtype: str
    unit: str
    min_valid: float
    max_valid: float
    nominal_mean: Optional[float]
    nominal_std: Optional[float]
    missing_policy: MissingValuePolicy
    description: str

    def to_dict(self) -> Dict[str, Any]:
        return {
            "index": self.index,
            "name": self.name,
            "domain": self.domain.value,
            "dtype": self.dtype,
            "unit": self.unit,
            "valid_range": [self.min_valid, self.max_valid],
            "nominal_baseline": {
                "mean": self.nominal_mean,
                "std": self.nominal_std,
            } if self.nominal_mean is not None else None,
            "missing_policy": self.missing_policy.value,
            "description": self.description,
        }


# =============================================================================
# CANONICAL 48-DIMENSIONAL FEATURE VECTOR SPECIFICATION (v2.0.0)
# =============================================================================

CANONICAL_FEATURES_V2: List[FeatureDefinition] = [
    # -------------------------------------------------------------------------
    # Group 1: Model 1 Defect Statistics (Indices 0 - 14, 15 dimensions)
    # -------------------------------------------------------------------------
    FeatureDefinition(
        index=0, name="defect_count_crack", domain=FeatureDomain.DEFECT_OPTICAL,
        dtype="float32", unit="count", min_valid=0.0, max_valid=50.0,
        nominal_mean=None, nominal_std=None, missing_policy=MissingValuePolicy.ZERO_FILL,
        description="Detected micro-crack and macro-crack bounding box count",
    ),
    FeatureDefinition(
        index=1, name="defect_count_finger_interruption", domain=FeatureDomain.DEFECT_OPTICAL,
        dtype="float32", unit="count", min_valid=0.0, max_valid=50.0,
        nominal_mean=None, nominal_std=None, missing_policy=MissingValuePolicy.ZERO_FILL,
        description="Broken or interrupted screen-printed front finger grid line count",
    ),
    FeatureDefinition(
        index=2, name="defect_count_busbar_defect", domain=FeatureDomain.DEFECT_OPTICAL,
        dtype="float32", unit="count", min_valid=0.0, max_valid=50.0,
        nominal_mean=None, nominal_std=None, missing_policy=MissingValuePolicy.ZERO_FILL,
        description="Busbar misalignment, soldering blob, or thick paste deposition count",
    ),
    FeatureDefinition(
        index=3, name="defect_count_soldering_defect", domain=FeatureDomain.DEFECT_OPTICAL,
        dtype="float32", unit="count", min_valid=0.0, max_valid=50.0,
        nominal_mean=None, nominal_std=None, missing_policy=MissingValuePolicy.ZERO_FILL,
        description="Cold soldering, ribbon detachment, or flux burn defect count",
    ),
    FeatureDefinition(
        index=4, name="defect_count_microcrack", domain=FeatureDomain.DEFECT_OPTICAL,
        dtype="float32", unit="count", min_valid=0.0, max_valid=50.0,
        nominal_mean=None, nominal_std=None, missing_policy=MissingValuePolicy.ZERO_FILL,
        description="Sub-millimeter crystal lattice fracture count under EL excitation",
    ),
    FeatureDefinition(
        index=5, name="defect_count_hotspot", domain=FeatureDomain.DEFECT_OPTICAL,
        dtype="float32", unit="count", min_valid=0.0, max_valid=50.0,
        nominal_mean=None, nominal_std=None, missing_policy=MissingValuePolicy.ZERO_FILL,
        description="Localized current crowding and severe localized resistive shunting count",
    ),
    FeatureDefinition(
        index=6, name="defect_count_cell_breakage", domain=FeatureDomain.DEFECT_OPTICAL,
        dtype="float32", unit="count", min_valid=0.0, max_valid=20.0,
        nominal_mean=None, nominal_std=None, missing_policy=MissingValuePolicy.ZERO_FILL,
        description="Wafer corner chipping, edge spalling, or structural cell fragmentation count",
    ),
    FeatureDefinition(
        index=7, name="defect_count_foreign_material", domain=FeatureDomain.DEFECT_OPTICAL,
        dtype="float32", unit="count", min_valid=0.0, max_valid=50.0,
        nominal_mean=None, nominal_std=None, missing_policy=MissingValuePolicy.ZERO_FILL,
        description="Dust particles, solder splash, hair, or laminator debris count",
    ),
    FeatureDefinition(
        index=8, name="defect_count_anti_reflective_coating", domain=FeatureDomain.DEFECT_OPTICAL,
        dtype="float32", unit="count", min_valid=0.0, max_valid=20.0,
        nominal_mean=None, nominal_std=None, missing_policy=MissingValuePolicy.ZERO_FILL,
        description="PECVD SiNx anti-reflective coating thickness variation or color stain count",
    ),
    FeatureDefinition(
        index=9, name="defect_total_count", domain=FeatureDomain.DEFECT_OPTICAL,
        dtype="float32", unit="count", min_valid=0.0, max_valid=100.0,
        nominal_mean=None, nominal_std=None, missing_policy=MissingValuePolicy.ZERO_FILL,
        description="Total defect bounding box count across all defect classes",
    ),
    FeatureDefinition(
        index=10, name="defect_avg_confidence", domain=FeatureDomain.DEFECT_OPTICAL,
        dtype="float32", unit="ratio", min_valid=0.0, max_valid=1.0,
        nominal_mean=None, nominal_std=None, missing_policy=MissingValuePolicy.ZERO_FILL,
        description="Mean detection confidence score of active defect detections",
    ),
    FeatureDefinition(
        index=11, name="defect_max_confidence", domain=FeatureDomain.DEFECT_OPTICAL,
        dtype="float32", unit="ratio", min_valid=0.0, max_valid=1.0,
        nominal_mean=None, nominal_std=None, missing_policy=MissingValuePolicy.ZERO_FILL,
        description="Maximum detection confidence score among detected defects",
    ),
    FeatureDefinition(
        index=12, name="defect_edge_ratio", domain=FeatureDomain.DEFECT_OPTICAL,
        dtype="float32", unit="ratio", min_valid=0.0, max_valid=1.0,
        nominal_mean=None, nominal_std=None, missing_policy=MissingValuePolicy.ZERO_FILL,
        description="Proportion of defects located at wafer peripheral edge (>0.35 normalized radius)",
    ),
    FeatureDefinition(
        index=13, name="defect_center_ratio", domain=FeatureDomain.DEFECT_OPTICAL,
        dtype="float32", unit="ratio", min_valid=0.0, max_valid=1.0,
        nominal_mean=None, nominal_std=None, missing_policy=MissingValuePolicy.ZERO_FILL,
        description="Proportion of defects located within central cell region (<=0.35 normalized radius)",
    ),
    FeatureDefinition(
        index=14, name="defect_total_area_fraction", domain=FeatureDomain.DEFECT_OPTICAL,
        dtype="float32", unit="ratio", min_valid=0.0, max_valid=1.0,
        nominal_mean=None, nominal_std=None, missing_policy=MissingValuePolicy.ZERO_FILL,
        description="Cumulative fraction of total cell area obscured by detected defects",
    ),

    # -------------------------------------------------------------------------
    # Group 2: Machine & Maintenance Context (Indices 15 - 26, 12 dimensions)
    # -------------------------------------------------------------------------
    FeatureDefinition(
        index=15, name="machine_is_stringer", domain=FeatureDomain.MACHINE_CONTEXT,
        dtype="float32", unit="binary", min_valid=0.0, max_valid=1.0,
        nominal_mean=None, nominal_std=None, missing_policy=MissingValuePolicy.ZERO_FILL,
        description="One-hot indicator: Inspection occurred downstream of tabber/stringer",
    ),
    FeatureDefinition(
        index=16, name="machine_is_tabber", domain=FeatureDomain.MACHINE_CONTEXT,
        dtype="float32", unit="binary", min_valid=0.0, max_valid=1.0,
        nominal_mean=None, nominal_std=None, missing_policy=MissingValuePolicy.ZERO_FILL,
        description="One-hot indicator: Inspection occurred downstream of tabber ribbon applicator",
    ),
    FeatureDefinition(
        index=17, name="machine_is_laminator", domain=FeatureDomain.MACHINE_CONTEXT,
        dtype="float32", unit="binary", min_valid=0.0, max_valid=1.0,
        nominal_mean=None, nominal_std=None, missing_policy=MissingValuePolicy.ZERO_FILL,
        description="One-hot indicator: Inspection occurred post-lamination encapsulation platen",
    ),
    FeatureDefinition(
        index=18, name="machine_is_soldering_station", domain=FeatureDomain.MACHINE_CONTEXT,
        dtype="float32", unit="binary", min_valid=0.0, max_valid=1.0,
        nominal_mean=None, nominal_std=None, missing_policy=MissingValuePolicy.ZERO_FILL,
        description="One-hot indicator: Inspection occurred at automated cell interconnect station",
    ),
    FeatureDefinition(
        index=19, name="machine_is_wafer_saw", domain=FeatureDomain.MACHINE_CONTEXT,
        dtype="float32", unit="binary", min_valid=0.0, max_valid=1.0,
        nominal_mean=None, nominal_std=None, missing_policy=MissingValuePolicy.ZERO_FILL,
        description="One-hot indicator: Inspection evaluates incoming diamond-wire cut raw wafer",
    ),
    FeatureDefinition(
        index=20, name="machine_is_laser_cutter", domain=FeatureDomain.MACHINE_CONTEXT,
        dtype="float32", unit="binary", min_valid=0.0, max_valid=1.0,
        nominal_mean=None, nominal_std=None, missing_policy=MissingValuePolicy.ZERO_FILL,
        description="One-hot indicator: Inspection occurred post half-cut / shingled cell laser scribe",
    ),
    FeatureDefinition(
        index=21, name="machine_is_coating_chamber", domain=FeatureDomain.MACHINE_CONTEXT,
        dtype="float32", unit="binary", min_valid=0.0, max_valid=1.0,
        nominal_mean=None, nominal_std=None, missing_policy=MissingValuePolicy.ZERO_FILL,
        description="One-hot indicator: Inspection occurred post PECVD passivation/anti-reflective tube",
    ),
    FeatureDefinition(
        index=22, name="machine_status_operational", domain=FeatureDomain.MACHINE_CONTEXT,
        dtype="float32", unit="binary", min_valid=0.0, max_valid=1.0,
        nominal_mean=None, nominal_std=None, missing_policy=MissingValuePolicy.OPERATIONAL_DEFAULT,
        description="Binary flag: Associated equipment was reported in nominal operational state",
    ),
    FeatureDefinition(
        index=23, name="machine_status_maintenance_required", domain=FeatureDomain.MACHINE_CONTEXT,
        dtype="float32", unit="binary", min_valid=0.0, max_valid=1.0,
        nominal_mean=None, nominal_std=None, missing_policy=MissingValuePolicy.ZERO_FILL,
        description="Binary flag: Equipment has pending maintenance ticket or warning",
    ),
    FeatureDefinition(
        index=24, name="machine_status_error", domain=FeatureDomain.MACHINE_CONTEXT,
        dtype="float32", unit="binary", min_valid=0.0, max_valid=1.0,
        nominal_mean=None, nominal_std=None, missing_policy=MissingValuePolicy.ZERO_FILL,
        description="Binary flag: Equipment was actively reporting an error or offline state during cell run",
    ),
    FeatureDefinition(
        index=25, name="machine_days_since_maintenance", domain=FeatureDomain.MACHINE_CONTEXT,
        dtype="float32", unit="days", min_valid=0.0, max_valid=365.0,
        nominal_mean=None, nominal_std=None, missing_policy=MissingValuePolicy.ZERO_FILL,
        description="Elapsed calendar days since last confirmed calibration or preventive maintenance",
    ),
    FeatureDefinition(
        index=26, name="machine_maintenance_overdue", domain=FeatureDomain.MACHINE_CONTEXT,
        dtype="float32", unit="binary", min_valid=0.0, max_valid=1.0,
        nominal_mean=None, nominal_std=None, missing_policy=MissingValuePolicy.ZERO_FILL,
        description="Binary flag: Current timestamp exceeds scheduled preventive maintenance date",
    ),

    # -------------------------------------------------------------------------
    # Group 3: Batch & Material Metadata (Indices 27 - 31, 5 dimensions)
    # -------------------------------------------------------------------------
    FeatureDefinition(
        index=27, name="batch_is_monocrystalline", domain=FeatureDomain.BATCH_MATERIAL,
        dtype="float32", unit="binary", min_valid=0.0, max_valid=1.0,
        nominal_mean=None, nominal_std=None, missing_policy=MissingValuePolicy.OPERATIONAL_DEFAULT,
        description="One-hot indicator: Batch uses monocrystalline p-type or n-type c-Si substrate",
    ),
    FeatureDefinition(
        index=28, name="batch_is_polycrystalline", domain=FeatureDomain.BATCH_MATERIAL,
        dtype="float32", unit="binary", min_valid=0.0, max_valid=1.0,
        nominal_mean=None, nominal_std=None, missing_policy=MissingValuePolicy.ZERO_FILL,
        description="One-hot indicator: Batch uses cast multi-crystalline silicon wafer",
    ),
    FeatureDefinition(
        index=29, name="batch_is_perc", domain=FeatureDomain.BATCH_MATERIAL,
        dtype="float32", unit="binary", min_valid=0.0, max_valid=1.0,
        nominal_mean=None, nominal_std=None, missing_policy=MissingValuePolicy.ZERO_FILL,
        description="One-hot indicator: Cell line utilizes PERC rear passivation architecture",
    ),
    FeatureDefinition(
        index=30, name="batch_is_topcon", domain=FeatureDomain.BATCH_MATERIAL,
        dtype="float32", unit="binary", min_valid=0.0, max_valid=1.0,
        nominal_mean=None, nominal_std=None, missing_policy=MissingValuePolicy.ZERO_FILL,
        description="One-hot indicator: Cell line utilizes n-type TOPCon passivated contact architecture",
    ),
    FeatureDefinition(
        index=31, name="batch_progress_ratio", domain=FeatureDomain.BATCH_MATERIAL,
        dtype="float32", unit="ratio", min_valid=0.0, max_valid=2.0,
        nominal_mean=None, nominal_std=None, missing_policy=MissingValuePolicy.DEFAULT_PROGRESS,
        description="Ratio of actual produced units to target lot quantity (clamped to [0.0, 2.0])",
    ),

    # -------------------------------------------------------------------------
    # Group 4: Physical Sensor Telemetry (Indices 32 - 41, 10 dimensions)
    # Normalized via: z = clip((measurement - nominal_mean) / nominal_std, -5.0, 5.0)
    # -------------------------------------------------------------------------
    FeatureDefinition(
        index=32, name="sensor_soldering_temp_top_norm", domain=FeatureDomain.SENSOR_TELEMETRY,
        dtype="float32", unit="z-score", min_valid=-5.0, max_valid=5.0,
        nominal_mean=225.0, nominal_std=15.0, missing_policy=MissingValuePolicy.NOMINAL_BASELINE,
        description="Normalized stringer upper soldering head temperature (baseline: 225°C, std: 15°C)",
    ),
    FeatureDefinition(
        index=33, name="sensor_soldering_temp_bottom_norm", domain=FeatureDomain.SENSOR_TELEMETRY,
        dtype="float32", unit="z-score", min_valid=-5.0, max_valid=5.0,
        nominal_mean=220.0, nominal_std=15.0, missing_policy=MissingValuePolicy.NOMINAL_BASELINE,
        description="Normalized stringer lower preheating bed temperature (baseline: 220°C, std: 15°C)",
    ),
    FeatureDefinition(
        index=34, name="sensor_ribbon_tension_norm", domain=FeatureDomain.SENSOR_TELEMETRY,
        dtype="float32", unit="z-score", min_valid=-5.0, max_valid=5.0,
        nominal_mean=1.2, nominal_std=0.3, missing_policy=MissingValuePolicy.NOMINAL_BASELINE,
        description="Normalized interconnect ribbon mechanical tension (baseline: 1.2N, std: 0.3N)",
    ),
    FeatureDefinition(
        index=35, name="sensor_squeegee_pressure_norm", domain=FeatureDomain.SENSOR_TELEMETRY,
        dtype="float32", unit="z-score", min_valid=-5.0, max_valid=5.0,
        nominal_mean=18.0, nominal_std=3.0, missing_policy=MissingValuePolicy.NOMINAL_BASELINE,
        description="Normalized screen printing squeegee downward force (baseline: 18 N/cm2, std: 3 N/cm2)",
    ),
    FeatureDefinition(
        index=36, name="sensor_firing_peak_temp_norm", domain=FeatureDomain.SENSOR_TELEMETRY,
        dtype="float32", unit="z-score", min_valid=-5.0, max_valid=5.0,
        nominal_mean=840.0, nominal_std=20.0, missing_policy=MissingValuePolicy.NOMINAL_BASELINE,
        description="Normalized metallization firing furnace peak zone temperature (baseline: 840°C, std: 20°C)",
    ),
    FeatureDefinition(
        index=37, name="sensor_lamination_temp_norm", domain=FeatureDomain.SENSOR_TELEMETRY,
        dtype="float32", unit="z-score", min_valid=-5.0, max_valid=5.0,
        nominal_mean=148.0, nominal_std=8.0, missing_policy=MissingValuePolicy.NOMINAL_BASELINE,
        description="Normalized laminator platen heating temperature (baseline: 148°C, std: 8°C)",
    ),
    FeatureDefinition(
        index=38, name="sensor_lamination_pressure_norm", domain=FeatureDomain.SENSOR_TELEMETRY,
        dtype="float32", unit="z-score", min_valid=-5.0, max_valid=5.0,
        nominal_mean=0.9, nominal_std=0.15, missing_policy=MissingValuePolicy.NOMINAL_BASELINE,
        description="Normalized encapsulation diaphragm hydraulic pressure (baseline: 0.9 bar, std: 0.15 bar)",
    ),
    FeatureDefinition(
        index=39, name="sensor_chamber_vacuum_norm", domain=FeatureDomain.SENSOR_TELEMETRY,
        dtype="float32", unit="z-score", min_valid=-5.0, max_valid=5.0,
        nominal_mean=0.8, nominal_std=0.2, missing_policy=MissingValuePolicy.NOMINAL_BASELINE,
        description="Normalized vacuum chamber degassing level (baseline: 0.8 mbar, std: 0.2 mbar)",
    ),
    FeatureDefinition(
        index=40, name="sensor_gripper_vacuum_norm", domain=FeatureDomain.SENSOR_TELEMETRY,
        dtype="float32", unit="z-score", min_valid=-5.0, max_valid=5.0,
        nominal_mean=-75.0, nominal_std=10.0, missing_policy=MissingValuePolicy.NOMINAL_BASELINE,
        description="Normalized robotic end-effector suction cup vacuum (baseline: -75 kPa, std: 10 kPa)",
    ),
    FeatureDefinition(
        index=41, name="sensor_telemetry_anomaly_total", domain=FeatureDomain.SENSOR_TELEMETRY,
        dtype="float32", unit="count", min_valid=0.0, max_valid=20.0,
        nominal_mean=None, nominal_std=None, missing_policy=MissingValuePolicy.ZERO_FILL,
        description="Total anomalous sensor measurements recorded across the 15-minute operational window",
    ),

    # -------------------------------------------------------------------------
    # Group 5: Production Events & Alarms (Indices 42 - 47, 6 dimensions)
    # -------------------------------------------------------------------------
    FeatureDefinition(
        index=42, name="events_total_count", domain=FeatureDomain.PRODUCTION_EVENT,
        dtype="float32", unit="count", min_valid=0.0, max_valid=50.0,
        nominal_mean=None, nominal_std=None, missing_policy=MissingValuePolicy.ZERO_FILL,
        description="Total equipment events recorded during the 1-hour pre-inspection window",
    ),
    FeatureDefinition(
        index=43, name="events_critical_count", domain=FeatureDomain.PRODUCTION_EVENT,
        dtype="float32", unit="count", min_valid=0.0, max_valid=20.0,
        nominal_mean=None, nominal_std=None, missing_policy=MissingValuePolicy.ZERO_FILL,
        description="Count of severity='critical' equipment events (line stops, thermal trips)",
    ),
    FeatureDefinition(
        index=44, name="events_high_count", domain=FeatureDomain.PRODUCTION_EVENT,
        dtype="float32", unit="count", min_valid=0.0, max_valid=30.0,
        nominal_mean=None, nominal_std=None, missing_policy=MissingValuePolicy.ZERO_FILL,
        description="Count of severity='high' equipment events (speed deviations, tension warnings)",
    ),
    FeatureDefinition(
        index=45, name="events_thermal_flag", domain=FeatureDomain.PRODUCTION_EVENT,
        dtype="float32", unit="binary", min_valid=0.0, max_valid=1.0,
        nominal_mean=None, nominal_std=None, missing_policy=MissingValuePolicy.ZERO_FILL,
        description="Binary flag: At least one temperature/thermal excursion event was logged",
    ),
    FeatureDefinition(
        index=46, name="events_mechanical_flag", domain=FeatureDomain.PRODUCTION_EVENT,
        dtype="float32", unit="binary", min_valid=0.0, max_valid=1.0,
        nominal_mean=None, nominal_std=None, missing_policy=MissingValuePolicy.ZERO_FILL,
        description="Binary flag: At least one feeder jam, tension fault, or vacuum drop was logged",
    ),
    FeatureDefinition(
        index=47, name="events_operator_override_flag", domain=FeatureDomain.PRODUCTION_EVENT,
        dtype="float32", unit="binary", min_valid=0.0, max_valid=1.0,
        nominal_mean=None, nominal_std=None, missing_policy=MissingValuePolicy.ZERO_FILL,
        description="Binary flag: Manual operator override or speed bypass occurred on line",
    ),
]

FEATURE_SCHEMA_VERSION = "2.0.0"
CANONICAL_FEATURE_NAMES_V2 = [f.name for f in CANONICAL_FEATURES_V2]
CANONICAL_FEATURE_COUNT_V2 = len(CANONICAL_FEATURES_V2)  # Exactly 48


# =============================================================================
# RECONCILED ROOT-CAUSE TAXONOMY & BIDIRECTIONAL CODE MAPPING
# =============================================================================

@dataclass(frozen=True)
class RootCauseClassMapping:
    class_index: int
    cause_code: str
    taxonomy_identifier: str
    display_label: str
    responsible_equipment: str
    description: str
    recommended_action: str


RECONCILED_ROOT_CAUSE_CATALOG: Dict[str, RootCauseClassMapping] = {
    "thermal_stress_soldering": RootCauseClassMapping(
        class_index=0,
        cause_code="RC-SOLD-01",
        taxonomy_identifier="thermal_stress_soldering",
        display_label="Thermal Stress During Soldering",
        responsible_equipment="Tabber / Stringer",
        description="Excessive soldering head temperature, rapid thermal cycling, or preheat-to-soldering "
                    "thermal shock causing wafer micro-cracking.",
        recommended_action="Recalibrate stringer soldering tip PID controller and inspect thermocouple bonding.",
    ),
    "squeegee_pressure_drift": RootCauseClassMapping(
        class_index=1,
        cause_code="RC-PRNT-01",
        taxonomy_identifier="squeegee_pressure_drift",
        display_label="Squeegee Pressure Drift",
        responsible_equipment="Screen Printer",
        description="Downward squeegee blade force drift causing non-uniform metallization paste thickness "
                    "and grid line interruptions.",
        recommended_action="Re-level screen printing squeegee blade and calibrate pneumatic pressure regulator.",
    ),
    "screen_mesh_clogging": RootCauseClassMapping(
        class_index=2,
        cause_code="RC-PRNT-02",
        taxonomy_identifier="screen_mesh_clogging",
        display_label="Screen Mesh Clogging / Paste Drying",
        responsible_equipment="Screen Printer",
        description="Partially dried silver paste or emulsion aperture blockage causing missing contact fingers.",
        recommended_action="Execute automated ultrasonic screen wash cycle and verify paste solvent viscosity.",
    ),
    "firing_thermal_profile_excursion": RootCauseClassMapping(
        class_index=3,
        cause_code="RC-FURN-01",
        taxonomy_identifier="firing_thermal_profile_excursion",
        display_label="Firing Furnace Thermal Profile Excursion",
        responsible_equipment="Firing Furnace",
        description="Thermal zone excursion or conveyor belt speed variance causing improper contact burn-through.",
        recommended_action="Perform multi-point thermal profiler pass through furnace and verify belt tachometer.",
    ),
    "mechanical_handling_impact": RootCauseClassMapping(
        class_index=4,
        cause_code="RC-MECH-01",
        taxonomy_identifier="mechanical_handling_impact",
        display_label="Mechanical Handling Impact / Vacuum Stress",
        responsible_equipment="Handling Automation / Robot",
        description="Excessive suction cup vacuum, track deceleration shock, or guide pin impact inducing stress cracks.",
        recommended_action="Inspect robotic end-effector vacuum regulator, reduce suction level, and align guide rails.",
    ),
    "lamination_pressure_imbalance": RootCauseClassMapping(
        class_index=5,
        cause_code="RC-LAM-01",
        taxonomy_identifier="lamination_pressure_imbalance",
        display_label="Lamination Pressure / Thermal Imbalance",
        responsible_equipment="Module Laminator",
        description="Diaphragm pressure non-uniformity or heating platen temperature delta causing encapsulation faults.",
        recommended_action="Check laminator vacuum diaphragm for micro-tears and verify multi-zone platen heating elements.",
    ),
    "ingot_thermal_gradient": RootCauseClassMapping(
        class_index=6,
        cause_code="RC-WAF-01",
        taxonomy_identifier="ingot_thermal_gradient",
        display_label="Ingot Thermal Gradient / Crystal Stress",
        responsible_equipment="Ingot Puller / Wafer Slicer",
        description="Asymmetric cooling gradient during Czochralski crystallization causing crystallographic dislocations.",
        recommended_action="Quarantine wafer lot from current supplier batch and execute incoming EL stress screening.",
    ),
    "chemical_texturing_contamination": RootCauseClassMapping(
        class_index=7,
        cause_code="RC-CHEM-01",
        taxonomy_identifier="chemical_texturing_contamination",
        display_label="Chemical Texturing Bath Contamination",
        responsible_equipment="Wet Chemical Bench",
        description="Alkaline/acid chemical texturing bath contamination or surfactant depletion altering surface reflectivity.",
        recommended_action="Dump and recharge wet bench chemical texturing bath and verify surfactant concentration.",
    ),
    "nominal_process_variation": RootCauseClassMapping(
        class_index=8,
        cause_code="RC-SPC-01",
        taxonomy_identifier="nominal_process_variation",
        display_label="Nominal Process Variation",
        responsible_equipment="All Equipment",
        description="Natural manufacturing statistical variation within 3-sigma process control boundaries.",
        recommended_action="No equipment corrective action required. Continue routine statistical process control monitoring.",
    ),
}
