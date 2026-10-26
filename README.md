# SolarVision AI

SolarVision AI is an evidence-first, zero-fabrication smart-manufacturing platform for photovoltaic (PV) solar-cell quality inspection and manufacturing intelligence.

The application combines a modern React 19 operator console, typed Node.js/tRPC server procedures, a high-throughput Python FastAPI inference engine, and a strictly domain-segregated 4-model machine learning architecture.

---

## The Four-Model Machine Learning Architecture

SolarVision AI strictly enforces engineering integrity and scientific domain segregation. Each of the four models reflects transparent, truthful operational readiness without synthetic claims or fabricated readiness metrics.

| Model Module | Domain / Benchmark | Current Status | Architecture / Dataset | Primary Task |
| :--- | :--- | :--- | :--- | :--- |
| **Model 1: Defect Detection** | Authentic EL/NIR Solar Cells | **ACADEMIC PROTOTYPE<br>(PVELAD Benchmark)** | Ultralytics YOLO26n (2.5M params)<br>Trained on 9 defect categories | Computer vision detection of micro-cracks, finger breaks, shunts, and dislocations |
| **Model 2: Root-Cause Analysis** | Solar Factory Multimodal | **DATASET INCOMPLETE<br>(Training Quarantined)** | 48-feature multimodal contract v2.0.0<br>Random Forest prototype | Rule-based telemetry validation, CSV data onboarding, and expert review |
| **Model 3: Predictive Quality** | UCI SECOM Benchmark<br>*(Semiconductor Wafer)* | **BENCHMARK EVALUATED<br>(Solar Factory Untrained)** | Gradient Boosted Classifier (LogitBoost)<br>590 raw features / 744 engineered | Wafer quality defect prediction on 1,567 chronological semiconductor runs |
| **Model 4: Predictive Maintenance** | UCI AI4I 2020 Benchmark<br>*(Synthetic Milling Machine)* | **BENCHMARK EVALUATED<br>(Solar Factory Untrained)** | Platt-Calibrated Gradient Boosting<br>6 canonical physical measurements | Machine failure risk scoring & physical failure mode attribution (TWF/HDF/PWF/OSF) |

> [!IMPORTANT]
> **Domain Segregation & Engineering Integrity Notice**:
> - **Model 1** is an **academically validated research prototype** evaluated against the held-out PVELAD benchmark. It is **not factory-production-certified** for automated real-time lines without site-specific camera calibration and in-situ lighting normalization.
> - **Model 2** genuine supervised training is strictly quarantined (`DATASET_INCOMPLETE`) until authentic factory IoT sensor-defect pairs are supplied.
> - **Model 3** is evaluated on the UCI SECOM semiconductor wafer benchmark. The decision threshold ($\tau = 0.07$) is calibrated for SECOM's 6.64% baseline fail rate. It is **NOT** a solar-cell manufacturing quality model.
> - **Model 4** is evaluated on the UCI AI4I 2020 synthetic milling machine benchmark. It is **NOT** certified for solar factory machinery (tabbers, stringers, laminators).

---

## Detailed Model Provenance & Evaluation Metrics

### Model 1: Solar-Cell EL/NIR Defect Detection
- **Status:** Academically Validated Prototype (Not Factory-Production-Certified).
- **Checkpoint Location:** `backend/models/best.pt`
- **Integrity (SHA-256):** `59650dafe43c178e89af3d439b283ebf1c3e4abe6239aaa111c62afa41b7a7c6`
- **Model Architecture:** YOLO26n / YOLOv8n DetectionModel (2,507,310 parameters)
- **9 Target Classes:** `crack`, `finger`, `black_core`, `thick_line`, `star_crack`, `horizontal_dislocation`, `vertical_dislocation`, `printing_error`, `short_circuit`.
- **Empirical Validation Performance (Held-Out PVELAD Benchmark, 77 images, 230 defect instances):**
  - **Single Crack Alignment (img003717):** Ground truth `[847, 899, 963, 991]`, prediction `[846.55, 901.04, 960.40, 989.13]` with **93.26% exact IoU** (Intersection: 9,989.41 px², Union: 10,711.64 px², min-area overlap: 99.60%).
  - **Baseline Production Setting (`imgsz=640, conf=0.25`):** Recall `72.17%`, Precision `63.36%`, F1 `0.6748`, mAP@50 `0.5483`, Clean cell false alarms `0/10` (100% specificity).
  - **Operating Sensitivity:** Standard baseline set to `0.25`; optional sensitive presets at `0.10` and `0.05` available in operator console.

### Model 2: Multimodal Root Cause Analysis
- **Status:** `DATASET_INCOMPLETE` — Supervised training is quarantined.
- **Specification:** Version 2.0.0 Unified 48-Feature Specification (`backend/root_cause_data/artifacts/canonical_feature_specification_v2.json`).
- **Operational Features:**
  - Automated 2-stage CSV ingestion engine with transactional rollback and physical bounds checks.
  - Inspection-to-equipment linking (lot/batch tracking, machine association, wafer position).
  - Expert engineering review workflow with verifiable provenance.
  - Zero-fabrication guarantee: When genuine machine learning checkpoints are absent, the system truthfully returns `missing_process_data` or `not_trained` without generating synthetic root causes.

### Model 3: Predictive Quality Analysis (SECOM Benchmark)
- **Dataset Reference:** UCI SECOM Dataset (DOI: [10.24432/C57G69](https://doi.org/10.24432/C57G69), CC-BY 4.0).
- **Split Strategy:** Time-Aware Chronological Split (70% Train: 1,096; 15% Validation: 235; 15% Test: 236).
- **Class Mapping:** `Pass = 0` (93.36%, 1,463 wafers), `Fail = 1` (6.64%, 104 wafers), severe 14.07:1 imbalance.
- **Calibrated Threshold Logic:**
  - Because baseline wafer scrap occurs in only 6.64% of runs, a standard 0.50 threshold fails to detect defective wafers.
  - Decision boundary is calibrated to $\tau = 0.0700$ (7.0%).
  - When $P(\text{Fail}) \ge 0.0700$, the system classifies the wafer as `FAIL` with `HIGH` risk (or `CRITICAL` if $P(\text{Fail}) \ge 0.20$).

### Model 4: Predictive Maintenance (AI4I Benchmark)
- **Dataset Reference:** UCI AI4I 2020 Predictive Maintenance Dataset (DOI: [10.24432/C5HS5C](https://doi.org/10.24432/C5HS5C), CC-BY 4.0).
- **Split Strategy:** Stratified Random Split (70% Train: 6,999; 15% Validation: 1,499; 15% Test: 1,502).
- **6 Physical Measurements:** Product Type, Air Temperature [K], Process Temperature [K], Rotational Speed [RPM], Torque [Nm], Tool Wear [min].
- **Calibration:** Platt probability calibration maps raw gradient boosting scores to true posterior failure probabilities.

---

## Production Deployment Guide

### Option A: Docker Deployment (Recommended)

1. **Build and Run with Docker Compose:**
   ```bash
   # Create production environment configuration
   cp .env.example .env

   # Set a secure random 32+ character JWT_SECRET
   # Example: export JWT_SECRET="your-ultra-secure-random-jwt-secret-key-32chars-min!"

   # Build and start container with persistent storage
   docker compose up --build -d
   ```

2. **Run with Docker CLI Directly:**
   ```bash
   # Build the container image
   docker build -t solarvision-ai:latest .

   # Run container with persistent volume
   docker run -d \
     --name solarvision-ai \
     -p 3000:3000 \
     -e NODE_ENV=production \
     -e PORT=3000 \
     -e JWT_SECRET="your-ultra-secure-random-jwt-secret-key-32chars-min!" \
     -e SQLITE_DB_PATH=/app/data/solarvision.db \
     -e UPLOADS_DIR=/app/data/uploads \
     -v solarvision-data:/app/data \
     solarvision-ai:latest
   ```

3. **Verify Deployment Health:**
   ```bash
   curl -s http://localhost:3000/api/trpc/model.status
   ```

---

### Option B: Bare-Metal / Host Deployment

1. **Prerequisites:**
   - **Node.js**: `>= 20.x`
   - **pnpm**: `>= 9.x`
   - **Python**: `>= 3.10` (Python 3.11–3.13)

2. **Setup Python Virtual Environment:**
   ```bash
   python -m venv backend/.venv
   # Windows:
   backend\venv\Scripts\activate
   # Linux/macOS:
   source backend/.venv/bin/activate

   pip install -r backend/requirements.txt
   ```

3. **Install Node Dependencies & Build:**
   ```bash
   pnpm install
   pnpm run build
   ```

4. **Launch Production Server:**
   ```bash
   export NODE_ENV=production
   export PORT=3000
   export JWT_SECRET="your-ultra-secure-random-jwt-secret-key-32chars-min!"
   node dist/index.js
   ```

---

## Production Environment Variable Checklist

| Variable | Required? | Default / Example | Purpose |
| :--- | :---: | :--- | :--- |
| `NODE_ENV` | Yes | `production` | Enables production bundle serving and security checks |
| `PORT` | Yes | `3000` | Port on which the HTTP server listens (binds to 0.0.0.0) |
| `JWT_SECRET` | **YES (Strict)** | *(Must be ≥32 random characters)* | Cryptographic key for operator session tokens (rejects startup if default/short) |
| `PYTHON_EXECUTABLE` | Optional | `python3` (Docker) or `backend/.venv/bin/python` | Path to Python runtime with PyTorch and OpenCV headless |
| `SQLITE_DB_PATH` | Optional | `data/solarvision.db` | Path to persistent SQLite database file |
| `UPLOADS_DIR` | Optional | `data/uploads` | Path to persistent storage directory for uploaded inspection imagery |
| `MODEL_PATH` | Optional | `backend/models/best.pt` | Path to Model 1 YOLO checkpoint weights |
| `CONFIDENCE_THRESHOLD` | Optional | `0.25` | Default confidence threshold for Model 1 inference |
| `IMAGE_SIZE` | Optional | `640` | Default inference resolution for Model 1 YOLO |

---

## Verification & Automated Test Suites

SolarVision AI maintains 100% test pass rates across all verification tiers:

```bash
# 1. Python Backend ML & Parity Test Suite (233 tests)
pytest backend/tests/ -v

# 2. Node Server Contract, Access Control & Persistence Suite (202 tests)
pnpm test

# 3. Client Frontend UI & Transport Tests (89 tests)
pnpm vitest run --config client/vitest.config.ts

# 4. TypeScript Typecheck
pnpm check

# 5. Production Build
pnpm run build
```

---

## Scientific Domain & Data Licensing Disclaimers

1. **Solar-Cell Defect Detection (Model 1):** Academically evaluated prototype on PVELAD benchmark images. Not certified for factory line deployment without localized calibration.
2. **UCI SECOM Benchmark (Model 3):** Sourced from the UC Irvine Machine Learning Repository. Donated by Michael McCann and Al Johnston. Licensed under Creative Commons Attribution 4.0 International (CC-BY 4.0).
3. **UCI AI4I 2020 Benchmark (Model 4):** Sourced from the UC Irvine Machine Learning Repository. Generated by Stephan Matzka (HTW Berlin). Licensed under Creative Commons Attribution 4.0 International (CC-BY 4.0).
4. **Zero-Fabrication Guarantee:** This application never fabricates synthetic root cause predictions or claims production deployment on hardware environments for which authentic telemetry has not been acquired.
