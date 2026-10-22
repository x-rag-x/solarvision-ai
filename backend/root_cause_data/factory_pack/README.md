# SolarVision AI — Factory Data Handoff Pack

**Version:** 2.0.0  
**Target Audience:** Manufacturing Process Engineers, MES/SCADA System Integrators, Quality & Failure Analysis Lab Technicians  
**Module:** Model 2 — Manufacturing Root Cause Analysis  

---

## 1. PURPOSE

This package provides everything required for a photovoltaic manufacturing facility to integrate real SCADA process telemetry, equipment metadata, production events, and laboratory failure analysis (FA) labels into SolarVision AI.

By supplying real-world data conforming to these contracts, the facility unblocks supervised training of **Model 2 (Root Cause Analysis)** and enables automated, closed-loop causal diagnostics on wafer inspection anomalies.

---

## 2. PACKAGE CONTENTS

| Artifact | File | Purpose |
|:---|:---|:---|
| **Sensor Dictionary** | `sensor_dictionary.json` | 20+ sensor channel names, physical units, acceptable validation ranges, nominal baselines, and sampling rates. |
| **Root Cause Taxonomy** | `root_cause_taxonomy.json` | 9 SEMI root-cause categories, engineering codes (`RC-*`), physical mechanisms, and FA laboratory verification protocols. |
| **Manufacturing Batches Template** | `templates/batches_template.csv` | Ingot type, wafer substrate dimensions, target yield, and line routing. |
| **Machine Registry Template** | `templates/machines_template.csv` | Equipment serials, types (stringer, printer, furnace, etc.), and maintenance tracking. |
| **Continuous Telemetry Template** | `templates/sensor_readings_template.csv` | High-frequency physical readings (1 Hz) linked to equipment and batches. |
| **Production Events Template** | `templates/production_events_template.csv` | Process deviations, maintenance alarms, operator overrides, and recipe changes. |
| **Inspection-Batch Link Template** | `templates/inspection_batch_links_template.csv` | Maps wafer optical inspection UUIDs to manufacturing lots and machines. |
| **Confirmed FA Labels Template** | `templates/root_cause_annotations_template.csv` | Ground-truth root-cause labels certified by quality engineering and FA labs. |

---

## 3. QUICK ONBOARDING STEPS

1. **Synchronize Clocks:** Ensure all PLC, SCADA, and inspection systems synchronize to an NTP time server (UTC ISO-8601 timestamps).
2. **Configure MES/SCADA Exporters:** Set up automated CSV exports matching the column headers and units in `templates/`.
3. **Execute Ingestion CLI:** Run the transactional import CLI:
   ```bash
   python backend/root_cause_data/import_cli.py --file factory_data/batches.csv --entity batches
   python backend/root_cause_data/import_cli.py --file factory_data/machines.csv --entity machines
   python backend/root_cause_data/import_cli.py --file factory_data/sensors.csv --entity sensor_readings
   python backend/root_cause_data/import_cli.py --file factory_data/annotations.csv --entity root_cause_annotations
   ```
4. **Audit Import Logs:** Check `python backend/root_cause_data/import_cli.py --audit-history` to ensure 0 validation errors.

See [`docs/phase3/FACTORY_DATA_ONBOARDING_GUIDE.md`](file:///d:/Apps/Programs/SolarVisionAI/solarvision-ai/docs/phase3/FACTORY_DATA_ONBOARDING_GUIDE.md) for the full operational guide.
