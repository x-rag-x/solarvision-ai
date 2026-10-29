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
export SQLITE_DB_PATH="${SQLITE_DB_PATH:-/app/data/solarvision.db}"
export UPLOADS_DIR="${UPLOADS_DIR:-/app/data/uploads}"
export SANDIA_MODEL_PATH="${SANDIA_MODEL_PATH:-/app/backend/models/sandia/pipeline.joblib}"
export SANDIA_API_URL="http://127.0.0.1:8000"
export PYTHON_BACKEND_URL="http://127.0.0.1:8000"
export FASTAPI_URL="http://127.0.0.1:8000"
export REQUIRE_SANDIA_MODEL="${REQUIRE_SANDIA_MODEL:-true}"

echo "[STAGING] Node Web Application Port: $PORT (Exposed publicly via Render)"
echo "[STAGING] FastAPI Internal Binding:  127.0.0.1:8000 (Internal loopback only)"
echo "[STAGING] SQLite Database Path:      $SQLITE_DB_PATH"
echo "[STAGING] Uploads Storage Directory: $UPLOADS_DIR"
echo "[STAGING] Sandia Pipeline Path:      $SANDIA_MODEL_PATH"
echo "[STAGING] Require Sandia Model:      $REQUIRE_SANDIA_MODEL"

# 2. Directory Creation & Permissions Check
mkdir -p "$(dirname "$SQLITE_DB_PATH")"
mkdir -p "$UPLOADS_DIR"
mkdir -p "$(dirname "$SANDIA_MODEL_PATH")"

# 3. Model 3 Artifact Verification & Download
echo "[STAGING] Checking Model 3 Sandia pipeline artifact integrity..."
FETCH_ARGS=(--target "$SANDIA_MODEL_PATH")
if [ "$REQUIRE_SANDIA_MODEL" = "true" ] || [ "$REQUIRE_SANDIA_MODEL" = "1" ]; then
  FETCH_ARGS+=(--require)
fi

if ! "$PYTHON_EXECUTABLE" -m backend.app.sandia_performance.artifact_fetcher "${FETCH_ARGS[@]}"; then
  echo "[FATAL] Sandia model artifact verification failed."
  echo "        Staging deployment cannot proceed without a verified genuine checkpoint."
  exit 1
fi

echo "[STAGING] Sandia model artifact successfully verified."

# 4. Process PIDs
FASTAPI_PID=""
NODE_PID=""

# 5. Signal Trap for Graceful Shutdown
shutdown() {
  echo ""
  echo "[STAGING] Received termination signal. Initiating graceful shutdown..."
  
  if [ -n "$NODE_PID" ] && kill -0 "$NODE_PID" 2>/dev/null; then
    echo "[STAGING] Stopping Node.js process (PID $NODE_PID)..."
    kill -TERM "$NODE_PID" 2>/dev/null || true
  fi

  if [ -n "$FASTAPI_PID" ] && kill -0 "$FASTAPI_PID" 2>/dev/null; then
    echo "[STAGING] Stopping Python FastAPI process (PID $FASTAPI_PID)..."
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

  echo "[STAGING] All services stopped cleanly. Exiting."
  exit 0
}

trap shutdown SIGTERM SIGINT SIGHUP SIGQUIT

# 6. Start Python FastAPI
echo "[STAGING] Starting Python FastAPI on 127.0.0.1:8000..."
"$PYTHON_EXECUTABLE" -m uvicorn backend.app.main:app --host 127.0.0.1 --port 8000 &
FASTAPI_PID=$!

# 7. Wait for FastAPI to report healthy
echo "[STAGING] Waiting for Python FastAPI readiness on 127.0.0.1:8000..."
READY=0
for i in $(seq 1 40); do
  if ! kill -0 "$FASTAPI_PID" 2>/dev/null; then
    echo "[FATAL] Python FastAPI process died unexpectedly during startup."
    exit 1
  fi

  if curl -sfS --max-time 1 "http://127.0.0.1:8000/health" >/dev/null 2>&1; then
    READY=1
    break
  fi
  sleep 0.5
done

if [ "$READY" -ne 1 ]; then
  echo "[FATAL] Timed out waiting for Python FastAPI to become healthy."
  kill -TERM "$FASTAPI_PID" 2>/dev/null || true
  exit 1
fi

echo "[STAGING] Python FastAPI service is ready."

# 8. Start Node.js Web Application
echo "[STAGING] Starting Node.js web application on port $PORT..."
node dist/index.js &
NODE_PID=$!

# 9. Supervise Both Processes
echo "[STAGING] Process supervisor active: Node (PID $NODE_PID), FastAPI (PID $FASTAPI_PID)."

while true; do
  if ! kill -0 "$NODE_PID" 2>/dev/null; then
    wait "$NODE_PID" || NODE_CODE=$?
    echo "[FATAL] Node.js process terminated with exit code ${NODE_CODE:-1}."
    echo "[STAGING] Shutting down FastAPI companion process..."
    kill -TERM "$FASTAPI_PID" 2>/dev/null || true
    wait "$FASTAPI_PID" 2>/dev/null || true
    exit "${NODE_CODE:-1}"
  fi

  if ! kill -0 "$FASTAPI_PID" 2>/dev/null; then
    wait "$FASTAPI_PID" || FASTAPI_CODE=$?
    echo "[FATAL] Python FastAPI process terminated with exit code ${FASTAPI_CODE:-1}."
    echo "[STAGING] Shutting down Node.js web process..."
    kill -TERM "$NODE_PID" 2>/dev/null || true
    wait "$NODE_PID" 2>/dev/null || true
    exit "${FASTAPI_CODE:-1}"
  fi

  sleep 2
done
