# SolarVision AI — Model 2 Root Cause Dataset Quality Report

**Audit Status:** `DATASET_BLOCKED`  
**Total Inspections Evaluated:** `478`  
**Inspections Linked to Batch:** `2`  
**Inspections Linked to Machine:** `2`  
**Total Sensor Measurements:** `1`  
**Confirmed Ground-Truth Root Cause Labels:** `0`  

---

## 1. Readiness Assessment

> [!CAUTION]
> **DATASET STATUS: DATASET_BLOCKED**
> 
> Training Model 2 on production root causes is currently blocked. The repository does not contain
> confirmed ground-truth root cause labels or linked machine sensor telemetry. In accordance with
> manufacturing AI principles, synthetic data must not be claimed as real production results.

### Blocking Deficiencies Identified:
- **[BLOCKER]** Zero confirmed root-cause labels available. Model 1 optical defect classes cannot be treated as root causes.

## 2. Sensor Telemetry Inventory

- **Sensor Streams Present:** `1` / `21`
- **Out-of-Bounds Sensor Measurements:** `0`
- **Duplicate Sensor Measurements:** `0`

### Missing Sensor Streams:
- `fill_factor_pct` (%)
- `firing_belt_speed_m_min` (m/min)
- `firing_exhaust_pressure_pa` (Pa)
- `firing_peak_temp_c` (C)
- `gripper_vacuum_kpa` (kPa)
- `isc_a` (A)
- `lamination_pressure_bar` (bar)
- `lamination_temp_c` (C)
- `lamination_vacuum_mbar` (mbar)
- `paste_temperature_c` (C)
- `paste_viscosity_pa_s` (Pa*s)
- `ribbon_tension_n` (N)
- `screen_snapoff_mm` (mm)
- `series_resistance_mohm` (mOhm)
- `shunt_resistance_ohm` (Ohm)
- `soldering_temp_bottom_c` (C)
- `squeegee_pressure_n_cm2` (N/cm2)
- `squeegee_speed_mm_s` (mm/s)
- `transfer_accel_max_g` (g)
- `voc_v` (V)

## 3. Ground-Truth Root Cause Class Distribution

| Class Name | Count | Percentage |
|---|---|---|
| `thermal_stress_soldering` | 0 | 0.0% |
| `squeegee_pressure_drift` | 0 | 0.0% |
| `screen_mesh_clogging` | 0 | 0.0% |
| `firing_thermal_profile_excursion` | 0 | 0.0% |
| `mechanical_handling_impact` | 0 | 0.0% |
| `lamination_pressure_imbalance` | 0 | 0.0% |
| `ingot_thermal_gradient` | 0 | 0.0% |
| `chemical_texturing_contamination` | 0 | 0.0% |
| `nominal_process_variation` | 0 | 0.0% |