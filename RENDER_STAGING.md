# SolarVision AI — Render Staging Deployment Guide

This guide details the exact configuration, environment variables, security constraints, and deployment procedure for the **SolarVision AI Staging Environment** on Render, running on branch `agent/model3-render-staging`.

---

## 1. Architecture Overview

In this staging configuration, the entire SolarVision AI platform runs inside a **single unified Docker container** (`Dockerfile.render-staging`) designed for high operational fidelity, low cost, and minimal network latency:

```
                      Inbound HTTPS Traffic
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│ Docker Container (Render Staging Web Service)                   │
│                                                                 │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │ PID 1: dumb-init                                          │  │
│  │   └── /app/scripts/staging-entrypoint.sh (Supervisor)     │  │
│  │         ├── Node.js Server (Port: $PORT, 0.0.0.0)         │  │
│  │         │    ├─ React 19 Operator Console                 │  │
│  │         │    ├─ Authenticated tRPC Procedures             │  │
│  │         │    ├─ Staging Readiness Check (/healthz)        │  │
│  │         │    └─ SQLite Persistence Layer (/app/data)      │  │
│  │         │                                                 │  │
│  │         │    Internal Loopback HTTP                       │  │
│  │         │    http://127.0.0.1:8000                        │  │
│  │         │          │                                      │  │
│  │         │          ▼                                      │  │
│  │         └── Python FastAPI Engine (127.0.0.1:8000)        │  │
│  │              ├─ Model 1: YOLO26n Defect Detection         │  │
│  │              ├─ Model 2: Root Cause Contract Engine       │  │
│  │              ├─ Model 3: Sandia Performance (pipeline)    │  │
│  │              └─ Model 4: Predictive Maintenance AI4I      │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                 │
│  Persistent Disk (/app/data):                                   │
│  ├── solarvision.db (SQLite database)                           │
│  └── uploads/ (Inspection captures)                             │
└─────────────────────────────────────────────────────────────────┘
```

### Architectural Guarantees:
1. **Public Port Isolation & Early Port Binding:** Only the Node.js application listens on the external `0.0.0.0:$PORT` provided by Render. Node starts immediately at container boot so Render can detect the listening port without timeout.
2. **True Readiness Gate (/healthz):** While Python FastAPI and machine learning pipelines initialize, Node's `/healthz` returns `HTTP 503` (Service Unavailable). It transitions to `HTTP 200` only when SQLite, storage, FastAPI, and Sandia Model 3 are fully operational.
3. **Internal Loopback Binding:** Python FastAPI binds strictly to `127.0.0.1:8000` (inaccessible from outside the container). Node communicates internally via `http://127.0.0.1:8000`.
4. **Process Supervision & Mutual Termination:** `dumb-init` and `staging-entrypoint.sh` trap `SIGTERM`/`SIGINT`, orchestrate graceful shutdown across child processes, and terminate both services immediately if either process crashes or fails during startup.
5. **Configurable Readiness Timeout:** Staging boots with a configurable FastAPI readiness timeout (`FASTAPI_READINESS_TIMEOUT_SECS`, default 120s, recommended 120–180s) to comfortably accommodate Python ML runtime initialization.
6. **Thread-Safe YOLO Lazy Loading:** Model 1 (YOLO26n defect detection) loads lazily on first inspection request by default (`YOLO_LAZY_LOAD=true`), eliminating blocking cold-start latency and conserving memory.
7. **Minimal Public Health Surface:** Responses on `/healthz` and `/health` reveal strictly overall status and generic component states (`"ok"`, `"unready"`, `"error"`). Filesystem paths, internal URLs, environment variables, and stack traces are never exposed to public callers.

---

## 2. FastAPI Startup Lifecycle, Lazy Loading & Memory Optimization

### Startup Log Stages
The container startup lifecycle outputs structured log markers distinguishing each subsystem:

1. **Python Import Timing:** `[TIMING:IMPORT] Python backend modules imported and routes mounted in <ms>`
2. **FastAPI Lifespan Startup:** `[TIMING:LIFESPAN] Starting SolarVision AI Inference API lifespan startup...`
3. **Model 3 Sandia Verification:** `[STARTUP:SANDIA] Genuine Model 3 Sandia pipeline verified and ready in <ms>`
4. **Model 1 YOLO State:** `[STARTUP:YOLO] YOLO model checkpoint present. Lazy-loading active (deferred to first inference request).`
5. **Lifespan HTTP Readiness:** `[TIMING:LIFESPAN] FastAPI lifespan startup completed in <ms>. Server listening on loopback.`
6. **Supervisor Readiness Polling:** `[STAGING:READINESS] Waiting for Python FastAPI readiness on 127.0.0.1:8000 (timeout: 120s)...`
7. **Full Platform Health:** `[STAGING:READINESS] Node /healthz returned HTTP 200. All runtime components confirmed healthy.`

### Lazy vs. Eager YOLO Loading
- **Default (Lazy):** `YOLO_LAZY_LOAD=true`. The heavy PyTorch runtime and YOLO weights are not loaded into memory until an actual image inspection request (`POST /inspect` or `/api/inspections`) is received. A mutex (`threading.Lock`) guarantees thread-safe, single-execution loading on the first request.
- **Eager (Optional):** Setting `YOLO_LAZY_LOAD=false` forces checkpoint loading synchronously inside the FastAPI lifespan before HTTP serving begins. The 120–180s supervisor readiness timeout accommodates eager loading even on limited CPU tiers.

### Memory & Thread Safeguards for Render Starter (512 MB RAM)
When co-locating Node.js 22, FastAPI, PyTorch, and scikit-learn, memory footprint is strictly controlled:
1. **PyTorch & OpenBLAS CPU Thread Limit:** `TORCH_NUM_THREADS=1`, `OMP_NUM_THREADS=1`, `MKL_NUM_THREADS=1`, `OPENBLAS_NUM_THREADS=1`. Prevents worker thread explosions that multiply memory allocations.
2. **Node Old-Space Ceiling:** `NODE_OPTIONS="--max-old-space-size=256"`. Enforces early garbage collection in Node.js before memory limits are reached.
3. **Memory Allocator Fragmentation Guard:** `MALLOC_ARENA_MAX=2`. Restricts glibc allocation arenas to mitigate memory fragmentation in Linux containers.
4. **Compact CPU PyTorch Wheels:** Installed via `--index-url https://download.pytorch.org/whl/cpu --no-deps` to eliminate CUDA overhead.

---

## 3. Machine Learning Environment & Model 3 Sandia Specifications

The container Python runtime is explicitly matched to the model trainer environment:

- **Python Runtime:** 3.11–3.13 in isolated `/opt/venv`
- **scikit-learn:** `1.6.1`
- **pandas:** `2.2.3`
- **NumPy:** `2.2.6` (compatible with trainer `2.1.3`)
- **joblib:** `1.6.0` (or `joblib>=1.4.0`)
- **PyTorch:** Compact CPU build (avoids multi-gigabyte CUDA runtime layers)

### Model 3 Sandia Checkpoint Contract:
- **Model ID:** `model3_sandia_reference_power_v1`
- **Artifact Filename:** `pipeline.joblib`
- **Target File Path:** `/app/backend/models/sandia/pipeline.joblib`
- **Expected SHA-256:** `045f9a15b7981c3e88ac18011dfa1b16821874bf211fa582cf148840e5dbf373`
- **Exact File Size:** `1,246,515` bytes
- **Target Metric:** `power_retention_pct` (reference-normalized PV performance)
- **Benchmark Prediction on Trainer Sample:** `99.50759793687902%` (~`99.5076%`)

---

## 4. Secure Artifact Download & Zero-Leakage Verification

Large model binaries (`pipeline.joblib`) are excluded from Git to prevent repository bloat. At container boot, `backend/app/sandia_performance/artifact_fetcher.py` handles acquisition and verification:

1. **Configurable Location:** Set via `SANDIA_MODEL_URL` (supports HTTP, HTTPS, S3/GCS presigned URLs, or `file://`).
2. **Optional Authorization:** Set via `SANDIA_ARTIFACT_AUTH_TOKEN` (Bearer token or auth header).
3. **Atomic Verification:** The artifact is streamed to a temporary file (`.tmp_<uuid>_pipeline.joblib`). SHA-256 is computed dynamically.
4. **Pre-Deserialization Gate:** The file is atomically renamed to `pipeline.joblib` **ONLY if** the SHA-256 matches `045f9a15b7981c3e88ac18011dfa1b16821874bf211fa582cf148840e5dbf373`.
5. **Rejection & Zero Deserialization:** If the hash mismatches or download fails, the temporary file is purged instantly. Deserialization (`joblib.load`) is **never executed** on unverified bytes.
6. **Zero Credential Exposure:** Query parameters (e.g., presigned AWS signatures) and bearer tokens are masked during logging. Credentials are never written to disk, build layers, public responses, or container logs.

---

## 5. Staging Access Control & Standalone Operator Mode Hardening

When deploying on Render Staging without external OAuth SSO (`OAUTH_SERVER_URL` unset), the application operates in **Standalone Operator Mode**.

To prevent arbitrary public internet visitors from calling `auth.login` and gaining access to protected tRPC procedures:

1. **Enforce `OPERATOR_PASSCODE`:** Configure a strong, secret passcode via the `OPERATOR_PASSCODE` environment variable in the Render Dashboard.
2. **Access Code Verification:** When `OPERATOR_PASSCODE` is set, `auth.login` strictly requires `passcode: "<OPERATOR_PASSCODE>"`.
   - Any login request without the passcode or with an incorrect passcode is rejected with HTTP 401 / `TRPCError({ code: "UNAUTHORIZED", message: "Invalid or missing operator passcode." })`.
3. **Protected Procedures Enforcement:** All sensitive tRPC procedures (`inspection.run`, `inspection.history`, `inspection.detail`, `dashboard.stats`, `analytics.defects`, `sandiaPerformance.predict`, `sandiaPerformance.predictBatch`, `sandiaPerformance.history`, etc.) are guarded by `authenticatedProcedure`.
   - Anonymous visitors attempting to invoke these procedures receive `UNAUTHORIZED: Authentication required`.
4. **Private Uploads Protection:** The `/uploads/*` image endpoint validates requester session token and inspection record ownership. Anonymous visitors receive HTTP 401 Unauthorized.
5. **Operator Console Usage:** Operators accessing the staging UI will see the **Operator Access Passcode** input field in the Operator Login Dialog. Entering the configured passcode unlocks 1-click operator credentials and session establishment.

---

## 6. Complete Environment Variables Checklist

Configure these variables in your Render Staging Web Service Dashboard under **Environment**:

| Variable | Type | Required? | Staging Default / Example | Purpose |
| :--- | :---: | :---: | :--- | :--- |
| `NODE_ENV` | String | **Yes** | `production` | Enforces production bundle serving & security checks |
| `PORT` | Integer | System | *(Assigned by Render, e.g. 10000)* | Port on which Node web application listens |
| `JWT_SECRET` | Secret | **Yes** | *(≥32 random characters)* | Cryptographic key for operator session JWT signing |
| `OPERATOR_PASSCODE` | Secret | **Yes** | *(≥16 random characters)* | Staging access passcode to prevent public visitor login |
| `FASTAPI_READINESS_TIMEOUT_SECS` | Integer | Optional | `120` | Timeout in seconds waiting for FastAPI readiness (120–180s) |
| `YOLO_LAZY_LOAD` | Boolean | Optional | `true` | Defers YOLO model loading to first inference request |
| `TORCH_NUM_THREADS` | Integer | Optional | `1` | CPU threads allocated to PyTorch tensor operations |
| `NODE_OPTIONS` | String | Optional | `--max-old-space-size=256` | Caps Node heap to prevent container OOM killer |
| `SQLITE_DB_PATH` | Path | **Yes** | `/app/data/solarvision.db` | Persistent SQLite database file on mounted disk |
| `UPLOADS_DIR` | Path | **Yes** | `/app/data/uploads` | Persistent directory for private inspection images |
| `SANDIA_API_URL` | URL | **Yes** | `http://127.0.0.1:8000` | Loopback URL for Node -> Python Sandia requests |
| `PYTHON_BACKEND_URL` | URL | **Yes** | `http://127.0.0.1:8000` | Generic loopback URL for Python backend |
| `FASTAPI_URL` | URL | **Yes** | `http://127.0.0.1:8000` | Loopback URL for FastAPI router adapters |
| `SANDIA_MODEL_PATH` | Path | **Yes** | `/app/backend/models/sandia/pipeline.joblib` | Path to genuine scikit-learn pipeline |
| `REQUIRE_SANDIA_MODEL` | Boolean | **Yes** | `true` | Enforces 503 deployment failure if Sandia is unready |
| `SANDIA_MODEL_URL` | Secret URL | Optional* | `https://s3.../pipeline.joblib` | Storage location to download genuine pipeline (*required if not pre-mounted) |
| `SANDIA_ARTIFACT_AUTH_TOKEN` | Secret | Optional | `Bearer eyJ...` | Authentication token for private artifact store |
| `CONFIDENCE_THRESHOLD` | Float | Optional | `0.25` | Default confidence threshold for Model 1 YOLO |
| `IMAGE_SIZE` | Integer | Optional | `640` | Default inference resolution for Model 1 YOLO |

---

## 7. Render Staging Deployment Steps

### Option 1: Blueprint Deployment via `render.yaml` (Recommended)

1. Connect your Git repository to Render.
2. In the Render Dashboard, click **Blueprints** -> **New Blueprint Instance**.
3. Select this repository and specify the branch: `agent/model3-render-staging`.
4. Render will read `render.yaml` and configure:
   - Service Name: `solarvision-staging`
   - Runtime: `Docker`
   - Dockerfile Path: `Dockerfile.render-staging`
   - Health Check Path: `/healthz`
   - Persistent Disk: 5 GB mounted at `/app/data`
5. In the environment setup screen, supply:
   - `JWT_SECRET`: Auto-generated by Render blueprint.
   - `OPERATOR_PASSCODE`: Auto-generated by Render blueprint (copy this for operator login).
   - `SANDIA_MODEL_URL`: Presigned URL or storage location hosting genuine `pipeline.joblib`.
   - `SANDIA_ARTIFACT_AUTH_TOKEN`: If using private bucket/repository.
6. Click **Apply**. Render will build the Docker staging image and verify deployment.

---

## 8. Staging Verification Runbook

### Step 1: Verify Public Readiness Gate
```bash
curl -i https://<your-render-subdomain>.onrender.com/healthz
```
Expected HTTP 200 response:
```json
{
  "status": "healthy",
  "components": {
    "node": { "status": "ok" },
    "database": { "status": "ok" },
    "storage": { "status": "ok" },
    "fastapi": { "status": "ok" },
    "sandia": { "status": "ok" }
  }
}
```

### Step 2: Establish Authenticated Session via Passcode
```bash
curl -X POST https://<your-render-subdomain>.onrender.com/api/trpc/auth.login \
  -H "Content-Type: application/json" \
  -c cookies.txt \
  -d '{"passcode": "<YOUR_OPERATOR_PASSCODE>"}'
```

### Step 3: Verify Sandia Model 3 Live Inference
```bash
curl -X POST https://<your-render-subdomain>.onrender.com/api/trpc/sandiaPerformance.predict \
  -b cookies.txt \
  -H "Content-Type: application/json" \
  -d '{
    "moduleId": "MOD-10085",
    "features": {
      "Total_Exposure": null,
      "Nameplate_Pmp_(W)": 315.0,
      "Nameplate_Isc_(A)": 9.85,
      "Nameplate_Voc_(V)": 40.2,
      "Nameplate_Imp_(A)": 9.35,
      "Nameplate_Vmp_(V)": 33.7,
      "Make": "SunPower",
      "Model": "SPR-X21-345",
      "Cell_Wafer_Type": "Mono-c-Si"
    }
  }'
```

Expected Output:
```json
{
  "prediction": 99.50759793687904,
  "target_name": "power_retention_pct",
  "target_unit": "%",
  "is_mock": false
}
```
Confirmation: Prediction matches trainer benchmark (`~99.5076%`).

---

## 9. Troubleshooting & Failure Recovery

| Issue | Symptom | Root Cause | Solution |
| :--- | :--- | :--- | :--- |
| **FastAPI Startup Timeout** | `[FATAL] Timed out waiting for Python FastAPI to become healthy` | Checkpoint loading or ML library import took longer than readiness window | Increase `FASTAPI_READINESS_TIMEOUT_SECS` to 180s. Ensure `YOLO_LAZY_LOAD=true`. |
| **No open ports detected** | Render times out scanning for port | Node was not listening on `$PORT` | Node now starts early before FastAPI wait loop; verify `PORT` env var is assigned by Render |
| **503 on /healthz** | Render deployment fails or restarts repeatedly | Sandia model missing or unverified | Check `SANDIA_MODEL_URL` in Render settings. Verify the hosted artifact matches hash `045f9a15b798...` |
| **503 on /healthz** | `FastAPI unavailable` | Python syntax or dependency error | Check container logs for uvicorn traceback |
| **401 on /api/trpc/auth.login** | `Invalid or missing operator passcode` | `OPERATOR_PASSCODE` mismatch | Ensure operator supplies the configured `OPERATOR_PASSCODE` set in Render environment variables |
| **SQLite I/O error** | `/app/data permission denied` | Disk mount missing or permissions incorrect | Ensure disk is mounted at `/app/data` with 5GB |
| **SHA-256 Mismatch** | `SECURITY ALERT: SHA-256 mismatch` | Uploaded artifact file corrupted or altered | Re-export `pipeline.joblib` from trusted trainer storage and verify hash with `sha256sum` |
