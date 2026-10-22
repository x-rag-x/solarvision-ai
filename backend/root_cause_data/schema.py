"""Data schemas and domain definitions for Model 2 Root Cause Analysis.

Establishes strict types, physical unit definitions, acceptable sensor bounds,
and the confirmed root-cause taxonomy for photovoltaic manufacturing.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timezone
from enum import Enum
from typing import Any, Dict, List, Optional
import uuid
from pydantic import BaseModel, Field, field_validator


# =============================================================================
# 1. ROOT CAUSE TAXONOMY & DESCRIPTIONS
# =============================================================================

class RootCauseCategory(str, Enum):
    THERMAL_STRESS_SOLDERING = "thermal_stress_soldering"
    SQUEEGEE_PRESSURE_DRIFT = "squeegee_pressure_drift"
    SCREEN_MESH_CLOGGING = "screen_mesh_clogging"
    FIRING_THERMAL_EXCURSION = "firing_thermal_profile_excursion"
    MECHANICAL_HANDLING_IMPACT = "mechanical_handling_impact"
    LAMINATION_PRESSURE_IMBALANCE = "lamination_pressure_imbalance"
    INGOT_THERMAL_GRADIENT = "ingot_thermal_gradient"
    CHEMICAL_TEXTURING_CONTAMINATION = "chemical_texturing_contamination"
    NOMINAL_PROCESS_VARIATION = "nominal_process_variation"


ROOT_CAUSE_TAXONOMY: List[str] = [c.value for c in RootCauseCategory]

ROOT_CAUSE_DESCRIPTIONS: Dict[str, str] = {
    RootCauseCategory.THERMAL_STRESS_SOLDERING.value: (
        "Excessive thermal shock or temperature differential during tabber/stringer soldering of ribbons."
    ),
    RootCauseCategory.SQUEEGEE_PRESSURE_DRIFT.value: (
        "Squeegee blade force or speed drift during front/back screen printing causing paste deposition error."
    ),
    RootCauseCategory.SCREEN_MESH_CLOGGING.value: (
        "Dried silver/aluminum paste or emulsion degradation occluding screen mesh openings."
    ),
    RootCauseCategory.FIRING_THERMAL_EXCURSION.value: (
        "Metallization furnace peak temperature or belt speed excursion causing junction punch-through or high contact resistance."
    ),
    RootCauseCategory.MECHANICAL_HANDLING_IMPACT.value: (
        "Cassette vacuum gripper shock, transfer belt deceleration, or mechanical pin misalignment."
    ),
    RootCauseCategory.LAMINATION_PRESSURE_IMBALANCE.value: (
        "Uneven bladder pressure distribution or vacuum leak during EVA encapsulation lamination."
    ),
    RootCauseCategory.INGOT_THERMAL_GRADIENT.value: (
        "Upstream crystal pulling thermal gradient instability or crucible contamination at wafer foundry."
    ),
    RootCauseCategory.CHEMICAL_TEXTURING_CONTAMINATION.value: (
        "Incomplete saw-damage etching or chemical texturing bath contamination altering wafer surface."
    ),
    RootCauseCategory.NOMINAL_PROCESS_VARIATION.value: (
        "Standard statistical baseline process noise without identifiable mechanical/thermal excursion."
    ),
}

# Mapping defect classes (Model 1) to potential root cause associations (prior heuristics)
DEFECT_TO_PLAUSIBLE_CAUSES: Dict[str, List[str]] = {
    "crack": [
        RootCauseCategory.MECHANICAL_HANDLING_IMPACT.value,
        RootCauseCategory.THERMAL_STRESS_SOLDERING.value,
        RootCauseCategory.LAMINATION_PRESSURE_IMBALANCE.value,
    ],
    "star_crack": [
        RootCauseCategory.MECHANICAL_HANDLING_IMPACT.value,
    ],
    "finger": [
        RootCauseCategory.SCREEN_MESH_CLOGGING.value,
        RootCauseCategory.SQUEEGEE_PRESSURE_DRIFT.value,
    ],
    "thick_line": [
        RootCauseCategory.SQUEEGEE_PRESSURE_DRIFT.value,
        RootCauseCategory.SCREEN_MESH_CLOGGING.value,
    ],
    "printing_error": [
        RootCauseCategory.SCREEN_MESH_CLOGGING.value,
        RootCauseCategory.SQUEEGEE_PRESSURE_DRIFT.value,
    ],
    "short_circuit": [
        RootCauseCategory.FIRING_THERMAL_EXCURSION.value,
        RootCauseCategory.CHEMICAL_TEXTURING_CONTAMINATION.value,
    ],
    "black_core": [
        RootCauseCategory.INGOT_THERMAL_GRADIENT.value,
    ],
    "horizontal_dislocation": [
        RootCauseCategory.INGOT_THERMAL_GRADIENT.value,
    ],
    "vertical_dislocation": [
        RootCauseCategory.INGOT_THERMAL_GRADIENT.value,
    ],
}


# =============================================================================
# 2. PHYSICAL SENSOR REGISTRY & PLAUSIBLE BOUNDS
# =============================================================================

@dataclass(frozen=True)
class SensorDefinition:
    sensor_type: str
    unit: str
    machine_type: str
    min_valid: float
    max_valid: float
    nominal_target: float
    description: str


SENSOR_UNIT_REGISTRY: Dict[str, SensorDefinition] = {
    "soldering_temp_top_c": SensorDefinition(
        sensor_type="soldering_temp_top_c",
        unit="C",
        machine_type="stringer",
        min_valid=150.0,
        max_valid=300.0,
        nominal_target=225.0,
        description="Tabber stringer upper soldering head temperature",
    ),
    "soldering_temp_bottom_c": SensorDefinition(
        sensor_type="soldering_temp_bottom_c",
        unit="C",
        machine_type="stringer",
        min_valid=150.0,
        max_valid=300.0,
        nominal_target=220.0,
        description="Tabber stringer lower preheating bed temperature",
    ),
    "ribbon_tension_n": SensorDefinition(
        sensor_type="ribbon_tension_n",
        unit="N",
        machine_type="stringer",
        min_valid=0.1,
        max_valid=5.0,
        nominal_target=1.2,
        description="Copper ribbon mechanical feed tension",
    ),
    "squeegee_pressure_n_cm2": SensorDefinition(
        sensor_type="squeegee_pressure_n_cm2",
        unit="N/cm2",
        machine_type="screen_printer",
        min_valid=5.0,
        max_valid=35.0,
        nominal_target=18.0,
        description="Screen printing squeegee blade downward force",
    ),
    "squeegee_speed_mm_s": SensorDefinition(
        sensor_type="squeegee_speed_mm_s",
        unit="mm/s",
        machine_type="screen_printer",
        min_valid=100.0,
        max_valid=500.0,
        nominal_target=250.0,
        description="Screen printing squeegee traverse velocity",
    ),
    "screen_snapoff_mm": SensorDefinition(
        sensor_type="screen_snapoff_mm",
        unit="mm",
        machine_type="screen_printer",
        min_valid=0.5,
        max_valid=4.0,
        nominal_target=1.8,
        description="Gap distance between screen mesh and cell surface",
    ),
    "paste_temperature_c": SensorDefinition(
        sensor_type="paste_temperature_c",
        unit="C",
        machine_type="screen_printer",
        min_valid=15.0,
        max_valid=35.0,
        nominal_target=23.0,
        description="Silver/aluminum paste reservoir temperature",
    ),
    "paste_viscosity_pa_s": SensorDefinition(
        sensor_type="paste_viscosity_pa_s",
        unit="Pa*s",
        machine_type="screen_printer",
        min_valid=100.0,
        max_valid=450.0,
        nominal_target=240.0,
        description="In-line metallization paste rheological viscosity",
    ),
    "firing_peak_temp_c": SensorDefinition(
        sensor_type="firing_peak_temp_c",
        unit="C",
        machine_type="firing_furnace",
        min_valid=750.0,
        max_valid=1000.0,
        nominal_target=860.0,
        description="Metallization fast-firing peak temperature zone",
    ),
    "firing_belt_speed_m_min": SensorDefinition(
        sensor_type="firing_belt_speed_m_min",
        unit="m/min",
        machine_type="firing_furnace",
        min_valid=3.0,
        max_valid=9.0,
        nominal_target=5.8,
        description="Fast-firing furnace belt transit speed",
    ),
    "firing_exhaust_pressure_pa": SensorDefinition(
        sensor_type="firing_exhaust_pressure_pa",
        unit="Pa",
        machine_type="firing_furnace",
        min_valid=-100.0,
        max_valid=0.0,
        nominal_target=-35.0,
        description="Furnace flue exhaust draft vacuum pressure",
    ),
    "lamination_temp_c": SensorDefinition(
        sensor_type="lamination_temp_c",
        unit="C",
        machine_type="laminator",
        min_valid=120.0,
        max_valid=180.0,
        nominal_target=148.0,
        description="EVA encapsulation heating plate temperature",
    ),
    "lamination_vacuum_mbar": SensorDefinition(
        sensor_type="lamination_vacuum_mbar",
        unit="mbar",
        machine_type="laminator",
        min_valid=0.01,
        max_valid=10.0,
        nominal_target=0.8,
        description="Laminator chamber degassing vacuum level",
    ),
    "lamination_pressure_bar": SensorDefinition(
        sensor_type="lamination_pressure_bar",
        unit="bar",
        machine_type="laminator",
        min_valid=0.2,
        max_valid=2.0,
        nominal_target=0.9,
        description="Encapsulation diaphragm hydraulic pressure",
    ),
    "gripper_vacuum_kpa": SensorDefinition(
        sensor_type="gripper_vacuum_kpa",
        unit="kPa",
        machine_type="handling_robot",
        min_valid=-100.0,
        max_valid=-20.0,
        nominal_target=-75.0,
        description="Robotic handling end-effector vacuum cup suction",
    ),
    "transfer_accel_max_g": SensorDefinition(
        sensor_type="transfer_accel_max_g",
        unit="g",
        machine_type="handling_robot",
        min_valid=0.01,
        max_valid=3.0,
        nominal_target=0.45,
        description="Wafer transfer track peak acceleration vector",
    ),
    "voc_v": SensorDefinition(
        sensor_type="voc_v",
        unit="V",
        machine_type="cell_tester",
        min_valid=0.55,
        max_valid=0.78,
        nominal_target=0.685,
        description="Flash-tester open circuit voltage",
    ),
    "isc_a": SensorDefinition(
        sensor_type="isc_a",
        unit="A",
        machine_type="cell_tester",
        min_valid=8.0,
        max_valid=13.0,
        nominal_target=10.85,
        description="Flash-tester short circuit current",
    ),
    "fill_factor_pct": SensorDefinition(
        sensor_type="fill_factor_pct",
        unit="%",
        machine_type="cell_tester",
        min_valid=65.0,
        max_valid=88.0,
        nominal_target=81.5,
        description="I-V curve fill factor percentage",
    ),
    "series_resistance_mohm": SensorDefinition(
        sensor_type="series_resistance_mohm",
        unit="mOhm",
        machine_type="cell_tester",
        min_valid=0.4,
        max_valid=5.0,
        nominal_target=1.15,
        description="Calculated internal series resistance",
    ),
    "shunt_resistance_ohm": SensorDefinition(
        sensor_type="shunt_resistance_ohm",
        unit="Ohm",
        machine_type="cell_tester",
        min_valid=10.0,
        max_valid=5000.0,
        nominal_target=650.0,
        description="Calculated parallel shunt resistance",
    ),
}


# =============================================================================
# 3. PYDANTIC DATA MODELS
# =============================================================================

class SensorReading(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    machine_id: str
    batch_id: Optional[str] = None
    sensor_type: str
    measurement_value: float
    unit: str
    is_anomaly: bool = False
    anomaly_score: Optional[float] = None
    recorded_at: datetime

    @field_validator("sensor_type")
    @classmethod
    def validate_sensor_type(cls, v: str) -> str:
        if v not in SENSOR_UNIT_REGISTRY:
            raise ValueError(f"Unknown sensor type '{v}'. Must be registered in SENSOR_UNIT_REGISTRY.")
        return v


class ManufacturingBatchRecord(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    batch_id: Optional[str] = None
    batch_number: str = "BATCH-001"
    wafer_type: str = "monocrystalline_m10"
    wafer_supplier: Optional[str] = None
    ingot_type: Optional[str] = None
    cell_line: str = "Line-1"
    target_quantity: int = 1000
    actual_quantity: int = 0
    status: str = "in_production"
    start_time: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    end_time: Optional[datetime] = None
    metadata: Optional[Dict[str, Any]] = None

    def model_post_init(self, __context: Any) -> None:
        if self.batch_id and (not self.batch_number or self.batch_number == "BATCH-001"):
            self.batch_number = self.batch_id
        elif self.batch_number and not self.batch_id:
            self.batch_id = self.batch_number
        if self.ingot_type and (not self.wafer_type or self.wafer_type == "monocrystalline_m10"):
            self.wafer_type = self.ingot_type


ManufacturingBatch = ManufacturingBatchRecord


class MachineRecord(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    machine_id: Optional[str] = None
    machine_code: str = "STR-01"
    machine_type: str
    line_id: str
    location: Optional[str] = None
    status: str = "running"
    last_maintenance_at: Optional[datetime] = None
    next_maintenance_due: Optional[datetime] = None

    def model_post_init(self, __context: Any) -> None:
        if self.machine_id and (not self.machine_code or self.machine_code == "STR-01"):
            self.machine_code = self.machine_id
        elif self.machine_code and not self.machine_id:
            self.machine_id = self.machine_code


Machine = MachineRecord



class ProductionEventRecord(BaseModel):
    id: str
    machine_id: Optional[str] = None
    batch_id: Optional[str] = None
    event_type: str
    severity: str = "info"
    message: str
    details: Optional[Dict[str, Any]] = None
    started_at: datetime
    resolved_at: Optional[datetime] = None


class RootCauseGroundTruth(BaseModel):
    """
    Confirmed manufacturing root cause determined by quality engineers or failure analysis labs.
    Crucial: Defect class is an observable optical effect; root cause is the underlying machine/chemical origin.
    """
    inspection_id: str
    defect_id: Optional[int] = None
    confirmed_cause: str
    confidence_level: str = "confirmed"  # 'confirmed', 'probable', 'heuristic'
    verified_by: Optional[str] = None
    verified_at: Optional[datetime] = None
    investigation_notes: Optional[str] = None

    @field_validator("confirmed_cause")
    @classmethod
    def validate_confirmed_cause(cls, v: str) -> str:
        if v not in ROOT_CAUSE_TAXONOMY:
            raise ValueError(f"Invalid root cause '{v}'. Must be one of {ROOT_CAUSE_TAXONOMY}")
        return v


class JoinedInspectionRecord(BaseModel):
    inspection_id: str
    source_filename: str
    created_at: datetime
    batch_id: Optional[str] = None
    machine_id: Optional[str] = None
    detections_count: int = 0
    primary_defect_type: Optional[str] = None
    max_confidence: Optional[float] = None
    mean_confidence: Optional[float] = None
    defect_area_ratio: float = 0.0
    confirmed_root_cause: Optional[str] = None
    sensor_features: Dict[str, float] = Field(default_factory=dict)


# =============================================================================
# 4. MODEL-READY FEATURE VECTOR SPECIFICATION
# =============================================================================

# Strict ordering of feature names for Model 2 artifact compatibility
CANONICAL_FEATURE_ORDER: List[str] = [
    # --- Optical / Defect Features (from Model 1) ---
    "feat_defect_count",
    "feat_max_detection_conf",
    "feat_mean_detection_conf",
    "feat_defect_area_ratio",
    "feat_is_crack",
    "feat_is_star_crack",
    "feat_is_finger",
    "feat_is_thick_line",
    "feat_is_black_core",
    "feat_is_dislocation",
    "feat_is_printing_error",
    "feat_is_short_circuit",
    # --- Tabber / Soldering Features ---
    "soldering_temp_top_mean_w15",
    "soldering_temp_top_std_w15",
    "soldering_temp_top_max_w15",
    "soldering_temp_delta_mean_w15",
    "ribbon_tension_mean_w15",
    "ribbon_tension_std_w15",
    # --- Screen Printing Features ---
    "squeegee_pressure_mean_w15",
    "squeegee_pressure_drift_w60",
    "squeegee_speed_mean_w15",
    "screen_snapoff_mean_w15",
    "paste_temp_mean_w15",
    "paste_viscosity_mean_w15",
    # --- Firing Furnace Features ---
    "firing_peak_temp_mean_w15",
    "firing_peak_temp_delta_target",
    "firing_belt_speed_mean_w15",
    "firing_exhaust_pressure_mean_w15",
    # --- Lamination Features ---
    "lamination_temp_mean_w15",
    "lamination_vacuum_mean_w15",
    "lamination_pressure_mean_w15",
    # --- Wafer Handling Features ---
    "gripper_vacuum_mean_w15",
    "transfer_accel_peak_w15",
    # --- Electrical Flash Test Features ---
    "voc_v",
    "isc_a",
    "fill_factor_pct",
    "series_resistance_mohm",
    "shunt_resistance_ohm",
    # --- Equipment Event Context ---
    "event_count_recent_1h",
    "has_warning_recent_1h",
]


class ModelReadyFeatureVector(BaseModel):
    sample_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    inspection_id: str
    timestamp: datetime
    batch_id: Optional[str] = None
    machine_id: Optional[str] = None
    defect_types: List[str] = Field(default_factory=list)
    defect_counts: Dict[str, int] = Field(default_factory=dict)
    defect_confidences: Dict[str, float] = Field(default_factory=dict)
    sensor_features: Dict[str, float] = Field(default_factory=dict)
    event_counts: Dict[str, int] = Field(default_factory=dict)
    ground_truth_cause: Optional[str] = None
    split_group: str = "train"
    features: List[float] = Field(default_factory=list)
    feature_names: List[str] = Field(default_factory=list)
    label_cause: Optional[str] = None
    label_index: Optional[int] = None

    def model_post_init(self, __context: Any) -> None:
        if self.ground_truth_cause and not self.label_cause:
            self.label_cause = self.ground_truth_cause
        elif self.label_cause and not self.ground_truth_cause:
            self.ground_truth_cause = self.label_cause



@dataclass
class DataQualityAuditResult:
    total_inspections: int
    inspections_with_batch: int
    inspections_with_machine: int
    total_sensor_readings: int
    sensor_types_present: List[str]
    missing_sensor_types: List[str]
    confirmed_root_cause_labels_count: int
    unlabeled_inspections_count: int
    duplicate_telemetry_count: int
    out_of_bounds_sensor_count: int
    class_distribution: Dict[str, int]
    dataset_status: str  # 'READY', 'PARTIAL', 'DATASET_BLOCKED'
    blocking_reasons: List[str] = field(default_factory=list)


# Re-export Version 2.0.0 Unified Specification for downstream compatibility
from .feature_spec import (
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

