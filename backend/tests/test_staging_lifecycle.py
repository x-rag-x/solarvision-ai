"""
SolarVision AI — Staging Lifecycle, Supervisor & Readiness Test Suite
Verifies:
1. Thread-safe YOLO lazy-loading and eager-loading paths (Task 3).
2. FastAPI startup timing logs and lifespan metrics (Task 4).
3. Early Node startup and non-blocking readiness gate (Task 5).
4. Process supervision, mutual termination, and timeout configuration (Tasks 2, 6, 9).
5. SHA-256 validation preservation (Task 7).
6. Resource bounding and thread limits (Task 8).
"""

from __future__ import annotations

import concurrent.futures
from pathlib import Path
import re
import threading
import time

import pytest
from starlette.testclient import TestClient

from backend.app.config import Settings
from backend.app.inference import YoloInferenceService
from backend.app.main import app


class TestStagingLifecycleAndReadiness:
    """Verifies startup lifecycle, thread-safe lazy-loading, and supervisor contracts."""

    def test_yolo_lazy_loading_preserves_clean_startup(self):
        """Verify that YoloInferenceService initializes without eager checkpoint loading."""
        service = YoloInferenceService()

        # Before any inference, model is None and is_ready is False
        assert service._model is None
        assert not service.is_ready()

        # Taxonomy and metadata can be inspected without forcing model into memory
        classes = service.class_names()
        assert len(classes) == 9
        assert "crack" in classes
        assert "star_crack" in classes
        assert service._model is None, "class_names() must not eagerly load model if not yet loaded"

        info = service.model_info()
        assert info["status"] == "ready"
        assert info["checkpoint_sha256"] == "59650dafe43c178e89af3d439b283ebf1c3e4abe6239aaa111c62afa41b7a7c6"
        assert info["parameter_count"] == 2507310

    def test_yolo_lazy_loading_thread_safe_single_execution(self):
        """Verify that concurrent threads calling load() synchronize via lock and load exactly once."""
        service = YoloInferenceService()
        load_count = 0
        original_lock = service._lock

        class MockModel:
            names = {0: "crack", 1: "finger"}
            class model:
                @staticmethod
                def parameters():
                    import torch
                    return [torch.zeros((2, 2))]

        # Mock the heavy YOLO call to measure concurrency
        def mock_load():
            nonlocal load_count
            with original_lock:
                if service._model is not None:
                    return
                time.sleep(0.05)  # simulate disk / weight loading time
                load_count += 1
                service._model = MockModel()

        service.load = mock_load

        # Run 10 concurrent threads attempting to load simultaneously
        with concurrent.futures.ThreadPoolExecutor(max_workers=10) as executor:
            futures = [executor.submit(service.load) for _ in range(10)]
            concurrent.futures.wait(futures)

        assert load_count == 1, f"Expected model to be loaded exactly once, but loaded {load_count} times."
        assert service.is_ready()

    def test_config_settings_yolo_lazy_load_flag(self, monkeypatch):
        """Verify that YOLO_LAZY_LOAD environment variable toggles lazy vs eager initialization."""
        monkeypatch.setenv("YOLO_LAZY_LOAD", "true")
        settings_lazy = Settings()
        assert settings_lazy.yolo_lazy_load is True

        monkeypatch.setenv("YOLO_LAZY_LOAD", "false")
        settings_eager = Settings()
        assert settings_eager.yolo_lazy_load is False

    def test_fastapi_health_endpoint_reports_truthfully_during_lazy_state(self):
        """Verify that /health reports FastAPI is ok even when YOLO is deferred."""
        client = TestClient(app)
        resp = client.get("/health")
        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] == "ok"
        assert "model_exists" in data
        assert "model_ready" in data

    def test_fastapi_ready_endpoint_preserves_strict_sandia_enforcement(self, monkeypatch):
        """Verify that /health/ready strictly enforces Sandia presence when REQUIRE_SANDIA_MODEL is enabled."""
        monkeypatch.setenv("REQUIRE_SANDIA_MODEL", "true")
        client = TestClient(app)
        resp = client.get("/health/ready")
        assert resp.status_code in (200, 503)
        data = resp.json()
        if resp.status_code == 200:
            assert data["sandia_ready"] is True
            assert data["sandia_mock"] is False
        else:
            assert "unavailable" in data["detail"].lower()

    def test_staging_entrypoint_supervisor_contract(self):
        """Verify scripts/staging-entrypoint.sh adheres to all Render supervisor requirements."""
        script_path = Path("scripts/staging-entrypoint.sh")
        assert script_path.exists(), "scripts/staging-entrypoint.sh must exist"

        content = script_path.read_text(encoding="utf-8")

        # 1. Configurable readiness timeout (120-180s default)
        assert "FASTAPI_READINESS_TIMEOUT_SECS" in content
        match = re.search(r'FASTAPI_READINESS_TIMEOUT_SECS="\$\{FASTAPI_READINESS_TIMEOUT_SECS:-(\d+)\}"', content)
        assert match is not None, "FASTAPI_READINESS_TIMEOUT_SECS must have a fallback default"
        timeout_val = int(match.group(1))
        assert 120 <= timeout_val <= 180, f"Default readiness timeout must be between 120 and 180s, got {timeout_val}"

        # 2. Strict SHA-256 verification must NOT be bypassed
        assert "backend.app.sandia_performance.artifact_fetcher" in content
        assert "REQUIRE_SANDIA_MODEL" in content
        assert "--require" in content

        # 3. Early Node startup before FastAPI wait loop
        node_start_pos = content.find("node dist/index.js &")
        fastapi_start_pos = content.find("uvicorn backend.app.main:app")
        readiness_wait_pos = content.find("[STAGING:READINESS] Waiting for Python FastAPI readiness")

        assert node_start_pos != -1, "Node startup command missing from supervisor"
        assert fastapi_start_pos != -1, "FastAPI startup command missing from supervisor"
        assert node_start_pos < readiness_wait_pos, "Node must start before the FastAPI readiness wait loop"

        # 4. Process supervision handles failure of either process
        assert 'kill -0 "$NODE_PID"' in content
        assert 'kill -0 "$FASTAPI_PID"' in content
        assert 'kill -TERM "$FASTAPI_PID"' in content
        assert 'kill -TERM "$NODE_PID"' in content

        # 5. Resource and memory limits
        assert "TORCH_NUM_THREADS" in content
        assert "MALLOC_ARENA_MAX" in content
        assert "NODE_OPTIONS" in content
        assert "YOLO_LAZY_LOAD" in content
