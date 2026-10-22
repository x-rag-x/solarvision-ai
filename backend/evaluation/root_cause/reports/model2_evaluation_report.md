# SolarVision AI — Model 2 Root Cause Evaluation Report

**Model Name:** `SolarVision_RootCause_RF`  
**Version:** `2.0.0-rc1`  
**Evaluation Timestamp:** `2026-10-22T04:18:56.148142+00:00`  
**Release Gate Status:** `CONDITIONALLY_BLOCKED`  
**Test Sample Count:** `15`  

---

## 1. Summary Performance Metrics

| Metric | Value | Target Benchmark |
|---|---:|---:|
| **Accuracy** | 20.00% | >= 80.0% |
| **Macro F1-Score** | 14.44% | >= 75.0% |
| **Balanced Accuracy** | 16.67% | >= 75.0% |
| **Expected Calibration Error (ECE)** | 0.1607 | <= 0.0800 |
| **Brier Calibration Score** | 0.8497 | <= 0.1500 |

## 2. Per-Class Category Performance

| Root Cause Class | Support | Precision | Recall | F1-Score |
|---|---:|---:|---:|---:|
| `thermal_stress_soldering` | 1 | 0.0% | 0.0% | 0.0% |
| `squeegee_pressure_drift` | 1 | 0.0% | 0.0% | 0.0% |
| `screen_mesh_clogging` | 2 | 0.0% | 0.0% | 0.0% |
| `firing_thermal_profile_excursion` | 2 | 50.0% | 50.0% | 50.0% |
| `mechanical_handling_impact` | 2 | 66.7% | 100.0% | 80.0% |
| `lamination_pressure_imbalance` | 2 | 0.0% | 0.0% | 0.0% |
| `ingot_thermal_gradient` | 2 | 0.0% | 0.0% | 0.0% |
| `chemical_texturing_contamination` | 2 | 0.0% | 0.0% | 0.0% |
| `nominal_process_variation` | 1 | 0.0% | 0.0% | 0.0% |

## 3. Confusion Matrix (Row Normalized %)

| Actual \ Predicted | `thermal_stre` | `squeegee_pre` | `screen_mesh_` | `firing_therm` | `mechanical_h` | `lamination_p` | `ingot_therma` | `chemical_tex` | `nominal_proc` |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| `thermal_stress_sol` | 0.00 | 0.00 | 0.00 | 0.00 | 1.00 | 0.00 | 0.00 | 0.00 | 0.00 |
| `squeegee_pressure_` | 0.00 | 0.00 | 0.00 | 1.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 |
| `screen_mesh_cloggi` | 0.00 | 1.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 |
| `firing_thermal_pro` | 0.00 | 0.50 | 0.00 | 0.50 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 |
| `mechanical_handlin` | 0.00 | 0.00 | 0.00 | 0.00 | 1.00 | 0.00 | 0.00 | 0.00 | 0.00 |
| `lamination_pressur` | 0.00 | 1.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 |
| `ingot_thermal_grad` | 0.00 | 0.50 | 0.50 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 |
| `chemical_texturing` | 0.00 | 0.50 | 0.00 | 0.00 | 0.00 | 0.50 | 0.00 | 0.00 | 0.00 |
| `nominal_process_va` | 0.00 | 1.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 |

## 4. Probability Calibration Assessment

- **Calibration Status:** `Confidence values exhibit over/under-confidence drift (ECE > 0.08). Temperature scaling or Platt scaling recommended.`
- **Expected Calibration Error (ECE):** `0.1607`
- **Maximum Calibration Error (MCE):** `0.6`

## 5. Diagnostic Root Cause Attribution Sample

**Predicted Cause:** `squeegee_pressure_drift` *(Confidence: 28.9%)*  
**Actionable Recommendation:** *Perform squeegee leveling audit. Measure blade durometer hardness; replace squeegee if wear exceeds 0.2mm. Recalibrate pneumatic force sensor.*

**Top Contributing Process Factors:**
- **`feat_max_detection_conf`**: value = `0.834` (impact score: `0.1379`)
- **`feat_defect_area_ratio`**: value = `0.017` (impact score: `0.1187`)
- **`feat_mean_detection_conf`**: value = `0.699` (impact score: `0.0942`)
- **`feat_is_crack`**: value = `0.0` (impact score: `0.069`)
- **`fill_factor_pct`**: value = `81.594 %` (impact score: `0.0502`)