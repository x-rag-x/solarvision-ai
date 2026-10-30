#!/usr/bin/env bash
# ==============================================================================
# SolarVision AI — Render Staging Deployment Process Supervisor
#
# Runs both Python FastAPI (127.0.0.1:8000) and Node.js Web Application
# inside the same container under strict process supervision and signal handling.
# ==============================================================================

set -eo pipefail

echo "=============================================================================="
echo " SolarVision AI — Staging Deployment Container Initializing"
echo " Time: $(date -u '+%Y-%m-%dT%H:%M:%SZ')"
echo "=============================================================================="

# 1. Environment & Network Configuration
export PORT="${PORT:-3000}"
export NODE_ENV="${NODE_ENV:-production}"
export PYTHON_EXECUTABLE="${PYTHON_EXECUTABLE:-python3}"
export PYTHONUNBUFFERED=1
export SQLITE_DB_PATH="${SQLITE_DB_PATH:-/app/data/solarvision.db}"
export UPLOADS_DIR="${UPLOADS_DIR:-/app/data/uploads}"
export SANDIA_MODEL_PATH="${SANDIA_MODEL_PATH:-/app/backend/models/sandia/pipeline.joblib}"
export SANDIA_API_URL="http://127.0.0.1:8000"
export PYTHON_BACKEND_URL="http://127.0.0.1:8000"
export FASTAPI_URL="http://127.0.0.1:8000"
export REQUIRE_SANDIA_MODEL="${REQUIRE_SANDIA_MODEL:-true}"

# Configurable FastAPI readiness timeout (default: 120s, staging recommended 120-180s)
export FASTAPI_READINESS_TIMEOUT_SECS="${FASTAPI_READINESS_TIMEOUT_SECS:-120}"

# Model 1 YOLO lazy loading configuration (default: true to avoid blocking container boot)
export YOLO_LAZY_LOAD="${YOLO_LAZY_LOAD:-true}"

# Memory, GC, and PyTorch CPU thread optimization for co-located container stability
export TORCH_NUM_THREADS="${TORCH_NUM_THREADS:-1}"
export OMP_NUM_THREADS="${OMP_NUM_THREADS:-1}"
export MKL_NUM_THREADS="${MKL_NUM_THREADS:-1}"
export OPENBLAS_NUM_THREADS="${OPENBLAS_NUM_THREADS:-1}"
export NUMEXPR_NUM_THREADS="${NUMEXPR_NUM_THREADS:-1}"
export VECLIB_MAXIMUM_THREADS="${VECLIB_MAXIMUM_THREADS:-1}"
export MALLOC_ARENA_MAX="${MALLOC_ARENA_MAX:-2}"
export NODE_OPTIONS="${NODE_OPTIONS:---max-old-space-size=256}"

# Production JWT Secret Configuration
if [ -z "$JWT_SECRET" ]; then
  echo "[STAGING:SECURITY] Notice: JWT_SECRET was not supplied in environment."
  echo "                   Generating ephemeral 256-bit container session secret."
  echo "                   For session persistence across restarts, configure JWT_SECRET in your Render dashboard."
  export JWT_SECRET="$("$PYTHON_EXECUTABLE" -c "import secrets; print(secrets.token_urlsafe(32))")"
fi

echo "[STAGING:CONFIG] Node Web Application Port:      $PORT (Exposed publicly via Render)"
echo "[STAGING:CONFIG] FastAPI Internal Binding:       127.0.0.1:8000 (Internal loopback only)"
echo "[STAGING:CONFIG] FastAPI Readiness Timeout:     ${FASTAPI_READINESS_TIMEOUT_SECS}s"
echo "[STAGING:CONFIG] YOLO Lazy Loading:             $YOLO_LAZY_LOAD"
echo "[STAGING:CONFIG] PyTorch/OpenMP Thread Limit:   $TORCH_NUM_THREADS"
echo "[STAGING:CONFIG] SQLite Database Path:           $SQLITE_DB_PATH"
echo "[STAGING:CONFIG] Uploads Storage Directory:      $UPLOADS_DIR"
echo "[STAGING:CONFIG] Sandia Pipeline Path:           $SANDIA_MODEL_PATH"
echo "[STAGING:CONFIG] Require Sandia Model:           $REQUIRE_SANDIA_MODEL"

# 2. Directory Creation & Permissions Check
mkdir -p "$(dirname "$SQLITE_DB_PATH")"
mkdir -p "$UPLOADS_DIR"
mkdir -p "$(dirname "$SANDIA_MODEL_PATH")"

# 3. Model 3 Artifact Verification & Download
echo "[STAGING:SANDIA] Checking Model 3 Sandia pipeline artifact integrity..."
FETCH_ARGS=(--target "$SANDIA_MODEL_PATH")
if [ "$REQUIRE_SANDIA_MODEL" = "true" ] || [ "$REQUIRE_SANDIA_MODEL" = "1" ]; then
  FETCH_ARGS+=(--require)
fi

FETCH_START=$(date +%s)
if ! "$PYTHON_EXECUTABLE" -m backend.app.sandia_performance.artifact_fetcher "${FETCH_ARGS[@]}"; then
  echo "[FATAL] Sandia model artifact verification failed."
  echo "        Staging deployment cannot proceed without a verified genuine checkpoint."
  exit 1
fi
FETCH_END=$(date +%s)
echo "[STAGING:SANDIA] Sandia model artifact successfully verified in $((FETCH_END - FETCH_START))s."

# 4. Process PIDs
FASTAPI_PID=""
FASTAPI_LOG_PID=""
NODE_PID=""

# 5. Signal Trap for Graceful Shutdown
shutdown() {
  echo ""
  echo "[STAGING:SIGNAL] Received termination signal. Initiating graceful shutdown..."
  
  if [ -n "$FASTAPI_LOG_PID" ] && kill -0 "$FASTAPI_LOG_PID" 2>/dev/null; then
    kill -TERM "$FASTAPI_LOG_PID" 2>/dev/null || true
  fi

  if [ -n "$NODE_PID" ] && kill -0 "$NODE_PID" 2>/dev/null; then
    echo "[STAGING:SIGNAL] Stopping Node.js process (PID $NODE_PID)..."
    kill -TERM "$NODE_PID" 2>/dev/null || true
  fi

  if [ -n "$FASTAPI_PID" ] && kill -0 "$FASTAPI_PID" 2>/dev/null; then
    echo "[STAGING:SIGNAL] Stopping Python FastAPI process (PID $FASTAPI_PID)..."
    kill -TERM "$FASTAPI_PID" 2>/dev/null || true
  fi

  # Wait up to 10 seconds for graceful exit
  local wait_count=0
  while ( [ -n "$NODE_PID" ] && kill -0 "$NODE_PID" 2>/dev/null ) || \
        ( [ -n "$FASTAPI_PID" ] && kill -0 "$FASTAPI_PID" 2>/dev/null ); do
    sleep 0.5
    wait_count=$((wait_count + 1))
    if [ "$wait_count" -ge 20 ]; then
      echo "[WARNING] Processes did not exit within grace period. Sending SIGKILL..."
      [ -n "$NODE_PID" ] && kill -KILL "$NODE_PID" 2>/dev/null || true
      [ -n "$FASTAPI_PID" ] && kill -KILL "$FASTAPI_PID" 2>/dev/null || true
      break
    fi
  done

  echo "[STAGING:SIGNAL] All services stopped cleanly. Exiting."
  exit 0
}

trap shutdown SIGTERM SIGINT SIGHUP SIGQUIT

# 6. Start Node.js Web Application Early (Phase 1)
# Starting Node early allows Render to detect the configured external port immediately,
# avoiding deployment timeouts caused by "no open ports detected".
# Express /healthz will return HTTP 503 until FastAPI and Sandia are genuinely ready.
echo "[$(date -u '+%Y-%m-%dT%H:%M:%SZ')] [STAGING:PHASE:1] Spawning Node.js Web Application on port $PORT..."
node dist/index.js &
NODE_PID=$!
echo "[STAGING:NODE] Node.js process started (PID $NODE_PID). Port $PORT open for Render detection."

# 7. Start Python FastAPI (Phase 2)
echo "[$(date -u '+%Y-%m-%dT%H:%M:%SZ')] [STAGING:PHASE:2] Spawning Python FastAPI on 127.0.0.1:8000..."
echo "[STAGING:FASTAPI] Executable: $PYTHON_EXECUTABLE"
echo "[STAGING:FASTAPI] Settings: YOLO_LAZY_LOAD=$YOLO_LAZY_LOAD, TORCH_NUM_THREADS=$TORCH_NUM_THREADS, OMP_NUM_THREADS=$OMP_NUM_THREADS"

# Ensure log destination exists and spawn FastAPI capturing output
touch /tmp/fastapi.log
"$PYTHON_EXECUTABLE" -u -m uvicorn backend.app.main:app --host 127.0.0.1 --port 8000 --log-level info > /tmp/fastapi.log 2>&1 &
FASTAPI_PID=$!
echo "[STAGING:FASTAPI] Python FastAPI process spawned successfully (PID $FASTAPI_PID)."

# Stream FastAPI log output in background so Render console displays startup and tracebacks immediately
tail -n +1 -f /tmp/fastapi.log &
FASTAPI_LOG_PID=$!

# 8. Wait for FastAPI to report healthy with configurable timeout (Phase 3)
echo "[$(date -u '+%Y-%m-%dT%H:%M:%SZ')] [STAGING:PHASE:3] Waiting for Python FastAPI readiness on 127.0.0.1:8000 (timeout: ${FASTAPI_READINESS_TIMEOUT_SECS}s)..."
READY=0
WAIT_START=$(date +%s)

while true; do
  NOW=$(date +%s)
  ELAPSED=$((NOW - WAIT_START))

  # Fail immediately if Node.js died during startup
  if ! kill -0 "$NODE_PID" 2>/dev/null; then
    wait "$NODE_PID" || NODE_CODE=$?
    echo "[FATAL] Node.js process (PID $NODE_PID) died unexpectedly during startup with exit code ${NODE_CODE:-1}."
    echo "[STAGING] Shutting down FastAPI process..."
    [ -n "$FASTAPI_LOG_PID" ] && kill -TERM "$FASTAPI_LOG_PID" 2>/dev/null || true
    kill -TERM "$FASTAPI_PID" 2>/dev/null || true
    wait "$FASTAPI_PID" 2>/dev/null || true
    exit "${NODE_CODE:-1}"
  fi

  # Fail immediately if FastAPI died during startup
  if ! kill -0 "$FASTAPI_PID" 2>/dev/null; then
    wait "$FASTAPI_PID" || FASTAPI_CODE=$?
    echo "[FATAL] Python FastAPI process (PID $FASTAPI_PID) died unexpectedly during startup with exit code ${FASTAPI_CODE:-1}."
    echo "[STAGING:DIAGNOSTICS] Captured output from /tmp/fastapi.log (last 40 lines):"
    tail -n 40 /tmp/fastapi.log 2>/dev/null || echo "(no logs captured)"
    echo "[STAGING] Shutting down Node.js process..."
    [ -n "$FASTAPI_LOG_PID" ] && kill -TERM "$FASTAPI_LOG_PID" 2>/dev/null || true
    kill -TERM "$NODE_PID" 2>/dev/null || true
    wait "$NODE_PID" 2>/dev/null || true
    exit "${FASTAPI_CODE:-1}"
  fi

  # Probe internal FastAPI /health endpoint
  HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" --max-time 2 "http://127.0.0.1:8000/health" 2>/dev/null || echo "000")
  if [ "$HTTP_STATUS" = "200" ]; then
    READY=1
    echo "[$(date -u '+%Y-%m-%dT%H:%M:%SZ')] [STAGING:READINESS] Python FastAPI is healthy and responding (HTTP 200) after ${ELAPSED}s."
    break
  fi

  if [ "$ELAPSED" -ge "$FASTAPI_READINESS_TIMEOUT_SECS" ]; then
    break
  fi

  if [ $((ELAPSED % 10)) -eq 0 ] && [ "$ELAPSED" -gt 0 ]; then
    MEM_DIAG=""
    if [ -f /proc/meminfo ]; then
      MEM_AVAIL=$(awk '/MemAvailable/ {printf "%.0fMB", $2/1024}' /proc/meminfo 2>/dev/null || true)
      [ -n "$MEM_AVAIL" ] && MEM_DIAG=" | Available RAM: $MEM_AVAIL"
    fi
    echo "[STAGING:READINESS] Waiting for Python FastAPI readiness (elapsed: ${ELAPSED}s / ${FASTAPI_READINESS_TIMEOUT_SECS}s | probe status: HTTP $HTTP_STATUS$MEM_DIAG)..."
  fi

  sleep 1
done

if [ "$READY" -ne 1 ]; then
  echo "[FATAL] Timed out waiting for Python FastAPI to become healthy after ${FASTAPI_READINESS_TIMEOUT_SECS} seconds."
  echo "[STAGING:DIAGNOSTICS] Process status: FastAPI PID $FASTAPI_PID (alive=$(kill -0 "$FASTAPI_PID" 2>/dev/null && echo 'yes' || echo 'no')), Node PID $NODE_PID"
  echo "[STAGING:DIAGNOSTICS] Captured output from /tmp/fastapi.log (last 50 lines):"
  tail -n 50 /tmp/fastapi.log 2>/dev/null || echo "(no logs captured)"
  if [ -f /proc/meminfo ]; then
    echo "[STAGING:DIAGNOSTICS] System memory snapshot:"
    grep -E 'MemTotal|MemFree|MemAvailable|SwapTotal|SwapFree' /proc/meminfo 2>/dev/null || true
  fi
  echo "[STAGING] Terminating child processes..."
  [ -n "$FASTAPI_LOG_PID" ] && kill -TERM "$FASTAPI_LOG_PID" 2>/dev/null || true
  kill -TERM "$FASTAPI_PID" 2>/dev/null || true
  kill -TERM "$NODE_PID" 2>/dev/null || true
  wait "$FASTAPI_PID" 2>/dev/null || true
  wait "$NODE_PID" 2>/dev/null || true
  exit 1
fi

echo "[STAGING:READINESS] Python FastAPI internal service confirmed healthy."

# 9. Verify End-to-End Readiness via Node /healthz (Phase 4)
echo "[$(date -u '+%Y-%m-%dT%H:%M:%SZ')] [STAGING:PHASE:4] Verifying full platform readiness via Node /healthz on port $PORT..."
HEALTHZ_READY=0
for i in $(seq 1 15); do
  HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" --max-time 3 "http://127.0.0.1:${PORT}/healthz" 2>/dev/null || echo "000")
  if [ "$HTTP_CODE" = "200" ]; then
    HEALTHZ_READY=1
    echo "[STAGING:READINESS] Node /healthz returned HTTP 200. All runtime components confirmed healthy."
    break
  fi
  echo "[STAGING:READINESS] Waiting for Node /healthz HTTP 200 (current: $HTTP_CODE)..."
  sleep 1
done

if [ "$HEALTHZ_READY" -ne 1 ]; then
  echo "[WARNING] Node /healthz did not return HTTP 200 within 15s after FastAPI became ready."
  echo "          Process supervisor will continue running; Node will evaluate readiness dynamically."
fi

# 10. Supervise Both Processes (Phase 5)
echo "[$(date -u '+%Y-%m-%dT%H:%M:%SZ')] [STAGING:SUPERVISOR] Process supervisor active: Node (PID $NODE_PID), FastAPI (PID $FASTAPI_PID)."

while true; do
  if ! kill -0 "$NODE_PID" 2>/dev/null; then
    wait "$NODE_PID" || NODE_CODE=$?
    echo "[FATAL] Node.js process terminated with exit code ${NODE_CODE:-1}."
    echo "[STAGING:SUPERVISOR] Shutting down FastAPI companion process..."
    [ -n "$FASTAPI_LOG_PID" ] && kill -TERM "$FASTAPI_LOG_PID" 2>/dev/null || true
    kill -TERM "$FASTAPI_PID" 2>/dev/null || true
    wait "$FASTAPI_PID" 2>/dev/null || true
    exit "${NODE_CODE:-1}"
  fi

  if ! kill -0 "$FASTAPI_PID" 2>/dev/null; then
    wait "$FASTAPI_PID" || FASTAPI_CODE=$?
    echo "[FATAL] Python FastAPI process terminated with exit code ${FASTAPI_CODE:-1}."
    echo "[STAGING:DIAGNOSTICS] Captured output from /tmp/fastapi.log (last 40 lines):"
    tail -n 40 /tmp/fastapi.log 2>/dev/null || echo "(no logs captured)"
    echo "[STAGING:SUPERVISOR] Shutting down Node.js web process..."
    [ -n "$FASTAPI_LOG_PID" ] && kill -TERM "$FASTAPI_LOG_PID" 2>/dev/null || true
    kill -TERM "$NODE_PID" 2>/dev/null || true
    wait "$NODE_PID" 2>/dev/null || true
    exit "${FASTAPI_CODE:-1}"
  fi

  sleep 2
done
