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
1. **Public Port Isolation:** Only the Node.js application listens on the external `0.0.0.0:$PORT` provided by Render.
2. **Internal Loopback Binding:** Python FastAPI binds strictly to `127.0.0.1:8000` (inaccessible from outside the container).
3. **Internal Node API URL:** Node communicates internally via `http://127.0.0.1:8000`.
4. **Process Supervision & Clean Exit:** `dumb-init` and `staging-entrypoint.sh` trap `SIGTERM`/`SIGINT`, orchestrate graceful shutdown across child processes, and terminate the container immediately if either process crashes.
5. **Strict Deployment Gate (/healthz):** Render tests container readiness against `http://0.0.0.0:$PORT/healthz`. If any runtime dependency (SQLite, uploads directory, FastAPI, or Sandia model) is unready, it returns HTTP 503, failing deployment transparently.
6. **Minimal Public Health Surface:** Responses on `/healthz` and `/health` reveal strictly overall status and generic component states (`"ok"`, `"unready"`, `"error"`). Filesystem paths, internal URLs, environment variables, and stack traces are never exposed to public callers.

---

## 2. Machine Learning Environment & Model 3 Sandia Specifications

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

## 3. Secure Artifact Download & Zero-Leakage Verification

Large model binaries (`pipeline.joblib`) are excluded from Git to prevent repository bloat. At container boot, `backend/app/sandia_performance/artifact_fetcher.py` handles acquisition and verification:

1. **Configurable Location:** Set via `SANDIA_MODEL_URL` (supports HTTP, HTTPS, S3/GCS presigned URLs, or `file://`).
2. **Optional Authorization:** Set via `SANDIA_ARTIFACT_AUTH_TOKEN` (Bearer token or auth header).
3. **Atomic Verification:** The artifact is streamed to a temporary file (`.tmp_<uuid>_pipeline.joblib`). SHA-256 is computed dynamically.
4. **Pre-Deserialization Gate:** The file is atomically renamed to `pipeline.joblib` **ONLY if** the SHA-256 matches `045f9a15b7981c3e88ac18011dfa1b16821874bf211fa582cf148840e5dbf373`.
5. **Rejection & Zero Deserialization:** If the hash mismatches or download fails, the temporary file is purged instantly. Deserialization (`joblib.load`) is **never executed** on unverified bytes.
6. **Zero Credential Exposure:** Query parameters (e.g., presigned AWS signatures) and bearer tokens are masked during logging. Credentials are never written to disk, build layers, public responses, or container logs.

---

## 4. Staging Access Control & Standalone Operator Mode Hardening

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

## 5. Complete Environment Variables Checklist

Configure these variables in your Render Staging Web Service Dashboard under **Environment**:

| Variable | Type | Required? | Staging Default / Example | Purpose |
| :--- | :---: | :---: | :--- | :--- |
| `NODE_ENV` | String | **Yes** | `production` | Enforces production bundle serving & security checks |
| `PORT` | Integer | System | *(Assigned by Render, e.g. 10000)* | Port on which Node web application listens |
| `JWT_SECRET` | Secret | **Yes** | *(≥32 random characters)* | Cryptographic key for operator session JWT signing |
| `OPERATOR_PASSCODE` | Secret | **Yes** | *(≥16 random characters)* | Staging access passcode to prevent public visitor login |
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

## 6. Render Staging Deployment Steps

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

### Option 2: Manual Web Service Setup via Render Dashboard

1. Navigate to [dashboard.render.com](https://dashboard.render.com/) and click **New +** -> **Web Service**.
2. Select your repository and choose branch: `agent/model3-render-staging`.
3. Configure service details:
   - **Name:** `solarvision-staging`
   - **Region:** Choose preferred region (e.g., `Oregon (US West)` or `Frankfurt (EU)`)
   - **Runtime:** `Docker`
   - **Dockerfile Path:** `Dockerfile.render-staging`
   - **Docker Context:** `.` (root directory)
   - **Instance Type:** `Starter` (or `Standard` with ≥2 GB RAM)
4. Add Persistent Disk:
   - Click **Disks** -> **Add Disk**
   - **Name:** `solarvision-staging-data`
   - **Mount Path:** `/app/data`
   - **Size:** `5 GB`
5. Configure Health Check:
   - **Health Check Path:** `/healthz`
6. Add Environment Variables according to Section 5.
7. Click **Create Web Service**.

---

## 7. Post-Deployment Verification Runbook

Once the deployment completes and Render indicates **Service is live**:

### 1. Verify Deployment Health Check
Query the public health check endpoint:
```bash
curl -fsS https://<your-render-subdomain>.onrender.com/healthz
```

Expected minimal JSON response (HTTP 200, zero filesystem paths, zero internal URLs):
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

### 2. Verify Access Control Restriction
Verify that unauthenticated visitors cannot access protected procedures:
```bash
# Attempt to query dashboard stats without session -> Must return UNAUTHORIZED
curl -s https://<your-render-subdomain>.onrender.com/api/trpc/dashboard.stats
```
Expected output:
```json
{"error":{"message":"UNAUTHORIZED: Authentication required to access protected SolarVision procedures."}}
```

Attempting login without `OPERATOR_PASSCODE`:
```bash
curl -X POST https://<your-render-subdomain>.onrender.com/api/trpc/auth.login \
  -H "Content-Type: application/json" \
  -d '{"operatorId":"admin","role":"admin"}'
```
Expected output:
```json
{"error":{"message":"Invalid or missing operator passcode. Operator access is restricted."}}
```

### 3. Authenticate with Operator Passcode
```bash
curl -c cookies.txt -X POST https://<your-render-subdomain>.onrender.com/api/trpc/auth.login \
  -H "Content-Type: application/json" \
  -d '{"operatorId":"OP-7701","name":"Alex Rivera","role":"user","passcode":"<YOUR_OPERATOR_PASSCODE>"}'
```
Returns valid session token and sets `solarvision_session` cookie.

### 4. Execute Verification Inference with Trainer Sample
Using the authenticated session cookie:
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

## 8. Troubleshooting & Failure Recovery

| Issue | Symptom | Root Cause | Solution |
| :--- | :--- | :--- | :--- |
| **503 on /healthz** | Render deployment fails or restarts repeatedly | Sandia model missing or unverified | Check `SANDIA_MODEL_URL` in Render settings. Verify the hosted artifact matches hash `045f9a15b798...` |
| **503 on /healthz** | `FastAPI unavailable` | Python syntax or dependency error | Check container logs for uvicorn traceback |
| **401 on /api/trpc/auth.login** | `Invalid or missing operator passcode` | `OPERATOR_PASSCODE` mismatch | Ensure operator supplies the configured `OPERATOR_PASSCODE` set in Render environment variables |
| **SQLite I/O error** | `/app/data permission denied` | Disk mount missing or permissions incorrect | Ensure disk is mounted at `/app/data` with 5GB |
| **SHA-256 Mismatch** | `SECURITY ALERT: SHA-256 mismatch` | Uploaded artifact file corrupted or altered | Re-export `pipeline.joblib` from trusted trainer storage and verify hash with `sha256sum` |
