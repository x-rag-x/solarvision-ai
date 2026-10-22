# SolarVision AI

SolarVision AI is an evidence-first, zero-fabrication smart-manufacturing platform for photovoltaic (PV) solar-cell quality inspection and manufacturing intelligence.

The application combines a modern React 19 operator console, typed Node.js/tRPC server procedures, a high-throughput Python FastAPI inference engine, and a strictly domain-segregated 4-model machine learning architecture.

---

## The Four-Model Machine Learning Architecture

SolarVision AI strictly enforces engineering integrity and scientific domain segregation. Each of the four models reflects transparent, truthful operational readiness without synthetic claims or fabricated readiness metrics.

| Model Module | Domain / Benchmark | Current Status | Architecture / Dataset | Primary Task |
| :--- | :--- | :--- | :--- | :--- |
| **Model 1: Defect Detection** | Authentic EL/NIR Solar Cells | **DEPLOYED & EVALUATED** | Ultralytics YOLO26n (2.5M params)<br>Trained on 9 defect categories | Computer vision detection of micro-cracks, finger breaks, shunts, and dislocations |
| **Model 2: Root-Cause Analysis** | Solar Factory Multimodal | **DATASET INCOMPLETE<br>(Training Quarantined)** | 48-feature multimodal contract<br>Random Forest prototype | Rule-based telemetry validation, CSV data onboarding, and expert review |
| **Model 3: Predictive Quality** | UCI SECOM Benchmark<br>*(Semiconductor Wafer)* | **BENCHMARK EVALUATED<br>(Solar Factory Untrained)** | Gradient Boosted Classifier<br>590 raw features / 744 engineered | Wafer quality defect prediction on 1,567 chronological semiconductor runs |
| **Model 4: Predictive Maintenance** | UCI AI4I 2020 Benchmark<br>*(Synthetic Milling Machine)* | **BENCHMARK EVALUATED<br>(Solar Factory Untrained)** | Gradient Boosted Classifier<br>6 canonical physical measurements | Machine failure risk scoring & physical failure mode attribution (TWF/HDF/PWF/OSF) |

> [!IMPORTANT]
> **Domain Segregation Notice**:
> - **Model 1** is trained and evaluated on authentic solar-cell electroluminescence (EL) and near-infrared (NIR) imagery.
> - **Model 2** genuine supervised training is strictly quarantined (`DATASET_INCOMPLETE`) until authentic factory IoT sensor-defect pairs are supplied.
> - **Model 3** is evaluated on the UCI SECOM semiconductor wafer benchmark. It is **NOT** a solar-cell manufacturing quality model.
> - **Model 4** is evaluated on the UCI AI4I 2020 synthetic milling machine benchmark. It is **NOT** certified for solar factory machinery (tabbers, stringers, laminators).

---

## Detailed Model Provenance & Evaluation Metrics

### Model 1: Solar-Cell EL/NIR Defect Detection
- **Checkpoint Location:** `backend/models/best.pt`
- **Integrity (SHA-256):** `59650dafe43c178e89af3d439b283ebf1c3e4abe6239aaa111c62afa41b7a7c6`
- **Model Architecture:** YOLO26n / YOLOv8n DetectionModel (2,507,310 parameters)
- **9 Target Classes:** `crack`, `finger`, `black_core`, `thick_line`, `star_crack`, `horizontal_dislocation`, `vertical_dislocation`, `printing_error`, `short_circuit`.
- **Recorded Training Validation Metrics (50 Epochs):**
  - **mAP@50:** `91.87%` (0.91869)
  - **mAP@50–95:** `66.38%` (0.66376)
  - **Precision:** `90.45%` (0.90452)
  - **Recall:** `88.15%` (0.88149)
- **Operating Confidence Threshold:** Strictly set to `0.25` (empirically confirmed to eliminate crystal grain background noise while retaining sub-millimeter micro-crack sensitivity).

### Model 2: Multimodal Root Cause Analysis
- **Status:** `DATASET_INCOMPLETE` — Supervised training is quarantined.
- **Specification:** Version 2.0.0 Unified 48-Feature Specification (`backend/root_cause_data/artifacts/canonical_feature_specification_v2.json`).
- **Operational Features:**
  - Automated 2-stage CSV ingestion engine with transactional rollback and physical bounds checks.
  - Inspection-to-equipment linking (lot/batch tracking, machine association, wafer position).
  - Expert engineering review workflow with verifiable provenance.
  - Zero-fabrication guarantee: When genuine machine learning checkpoints are absent, the system truthfully returns `not_trained` without generating synthetic root causes.

### Model 3: Predictive Quality Analysis (SECOM Benchmark)
- **Dataset Reference:** UCI SECOM Dataset (DOI: [10.24432/C57G69](https://doi.org/10.24432/C57G69), CC-BY 4.0).
- **Split Strategy:** Time-Aware Chronological Split (70% Train: 1,096; 15% Validation: 235; 15% Test: 236).
- **Zero-Leakage Guarantee:** Preprocessor fitted strictly on training data; probability calibrator fitted strictly on validation predictions.
- **Decision Threshold Reconciliation (Audit Finding F08):**
  - **Raw Validation-Optimal Threshold ($\tau_{\text{raw}} = 0.07$):**
    - Confusion Matrix (Test Set): **TP = 4, FP = 31, TN = 196, FN = 5**
    - Accuracy: `84.75%`, Precision: `11.43%`, Recall: `44.44%`, F1-Fail: `0.1818`, Macro-F1: `0.5489`
  - **Monotonic Calibrated Validation Threshold ($\tau_{\text{cal}} = 0.0800$):**
    - Confusion Matrix (Test Set): **TP = 4, FP = 24, TN = 203, FN = 5**
    - Accuracy: `87.71%`, Precision: `14.29%`, Recall: `44.44%`, F1-Fail: `0.2162`, Macro-F1: `0.5748`
  - **Production Serving Decision Rule ($p_{\text{cal}} \ge 0.0700$):**
    - Confusion Matrix (Test Set): **TP = 5, FP = 88, TN = 139, FN = 4**
    - Precision: `5.38%`, Recall: `55.56%`, F1-Fail: `0.0980`, Macro-F1: `0.4247`

### Model 4: Predictive Maintenance (AI4I Benchmark)
- **Dataset Reference:** UCI AI4I 2020 Predictive Maintenance Dataset (DOI: [10.24432/C5HS5C](https://doi.org/10.24432/C5HS5C), CC-BY 4.0).
- **Split Strategy:** Stratified Random Split (70% Train: 6,999; 15% Validation: 1,499; 15% Test: 1,502).
- **6 Physical Measurements:** Product Type, Air Temperature [K], Process Temperature [K], Rotational Speed [RPM], Torque [Nm], Tool Wear [min].
- **Decision Threshold Reconciliation (Audit Finding F08):**
  - **Raw Validation-Optimal Threshold ($\tau_{\text{raw}} = 0.1981$):**
    - Confusion Matrix (Test Set): **TP = 25, FP = 23, TN = 1427, FN = 27**
    - Accuracy: `96.67%`, Precision: `52.08%`, Recall: `48.08%`, F1-Failure: `0.5000`, Macro-F1: `0.7414`, ROC-AUC: `0.9307`
  - **Monotonic Calibrated Validation Threshold ($\tau_{\text{cal}} = 0.3664 \approx \text{Calibrator}(0.1981) = 0.3591$):**
    - Confusion Matrix (Test Set): **TP = 25, FP = 23, TN = 1427, FN = 27**
    - Precision: `52.08%`, Recall: `48.08%`, F1-Failure: `0.5000`, Macro-F1: `0.7414`
    - *Preserves the exact same classification decisions as the raw threshold due to the strictly monotonic property of Platt calibration.*
  - **Production Serving Decision Rule ($p_{\text{cal}} \ge 0.1981 \iff p_{\text{raw}} \ge 0.1317$):**
    - Shifted operating point favoring higher sensitivity: **TP = 33, FP = 66, TN = 1384, FN = 19**
    - Precision: `33.33%`, Recall: `63.46%`, F1-Failure: `0.4371`, Macro-F1: `0.7036`

---

## Installation & Clean Setup Guide

### 1. Prerequisites
- **Node.js**: `>= 20.x`
- **pnpm**: `>= 9.x`
- **Python**: `>= 3.10` (Python 3.11–3.13 supported)

### 2. Environment Configuration
Clone the repository and copy the environment template:
```bash
cp .env.example .env
```

Review `.env` settings:
- On Windows: set `PYTHON_EXECUTABLE=backend\.venv\Scripts\python.exe`
- On Linux/macOS: set `PYTHON_EXECUTABLE=backend/.venv/bin/python`
- For local zero-dependency development, leave `DATABASE_URL` empty to use the built-in SQLite persistence layer (`data/solarvision.db`).

### 3. Python Virtual Environment Setup
```bash
# Create virtual environment inside backend/
python -m venv backend/.venv

# Activate virtual environment
# Windows:
backend\.venv\Scripts\activate
# Linux/macOS:
source backend/.venv/bin/activate

# Install required dependencies
pip install -r backend/requirements.txt
```

### 4. Node Dependencies
```bash
pnpm install
```

### 5. Database Initialization
The application automatically initializes its SQLite database schema on first launch. If using MySQL or Supabase PostgreSQL, synchronize the Drizzle schema:
```bash
pnpm db:push
```

---

## Running the Application

### Development Mode (Concurrent Web & Backend)
```bash
pnpm dev
```
Starts:
- Vite Frontend Dev Server at `http://localhost:5173`
- Express / tRPC Backend API Server at `http://localhost:3000`

### Standalone FastAPI Inference Service (Optional Dedicated Microservice)
```bash
# From repository root
python -m uvicorn backend.app.main:app --host 0.0.0.0 --port 8000
```

### Production Build
```bash
pnpm run build
```
Generates production client assets in `dist/public/` and bundles the Express server in `dist/index.js`.

---

## Verification & Test Suites

SolarVision AI includes comprehensive unit, regression, and E2E verification suites:

### Full Backend Python Test Suite (231 tests)
```bash
# Run all Python unit, contract, and parity tests
pytest backend/tests/ -v
```

### Server Vitest Integration Suite (188 tests)
```bash
# Run all tRPC contract, SQLite persistence, and security regression tests
pnpm test
```

### Dedicated Serving/Evaluation Parity Tests
```bash
# Verify Model 3 & Model 4 threshold calibration and serving parity
pytest backend/tests/test_serving_evaluation_parity.py -v
```

### Forensic Database Invariant Audit
```bash
# Verify that all database records have authentic lineage or isolated test flags
pytest backend/tests/test_model2_provenance_audit.py -v
```

---

## Scientific Domain & Data Licensing Disclaimers

1. **Solar-Cell Defect Detection (Model 1):** Trained on authentic electroluminescence and near-infrared solar-cell images under academic research permissions.
2. **UCI SECOM Benchmark (Model 3):** Sourced from the UC Irvine Machine Learning Repository. Donated by Michael McCann and Al Johnston. Licensed under Creative Commons Attribution 4.0 International (CC-BY 4.0).
3. **UCI AI4I 2020 Benchmark (Model 4):** Sourced from the UC Irvine Machine Learning Repository. Generated by Stephan Matzka (HTW Berlin). Licensed under Creative Commons Attribution 4.0 International (CC-BY 4.0).
4. **Zero-Fabrication Guarantee:** This application never fabricates synthetic root cause predictions or claims production deployment on hardware environments for which authentic telemetry has not been acquired.
