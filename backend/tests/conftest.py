"""
SolarVision AI — Test Fixtures and Environment Isolation
"""

from __future__ import annotations

from pathlib import Path
import pytest

from backend.app.sandia_performance.service import sandia_performance_service


@pytest.fixture(autouse=True)
def scope_sandia_mock_tests(request):
    """
    Ensures existing mock-only integration tests (TestSandiaBackendIntegration)
    evaluate against a simulated uninitialized / missing artifact environment,
    preserving zero-fabrication 503 and not_trained guarantees without modifying
    the existing mock-only test file or weakening validation.
    """
    if request.node.cls and request.node.cls.__name__ == "TestSandiaBackendIntegration":
        orig_artifact = sandia_performance_service.loader.artifact_path
        orig_schema = sandia_performance_service.loader.schema_path
        orig_sample = sandia_performance_service.loader.sample_input_path
        orig_target = sandia_performance_service.loader.target_path

        # Simulate missing artifact for mock-only test suite
        sandia_performance_service.loader.artifact_path = Path("models/sandia/nonexistent_pipeline.joblib")
        sandia_performance_service.loader.schema_path = Path("models/sandia/nonexistent_schema.json")
        sandia_performance_service.loader.sample_input_path = Path("models/sandia/nonexistent_sample.json")
        sandia_performance_service.loader.target_path = Path("models/sandia/nonexistent_target.json")
        sandia_performance_service.loader.clear_mock()

        yield

        # Restore configured paths
        sandia_performance_service.loader.artifact_path = orig_artifact
        sandia_performance_service.loader.schema_path = orig_schema
        sandia_performance_service.loader.sample_input_path = orig_sample
        sandia_performance_service.loader.target_path = orig_target
        sandia_performance_service.loader.clear_mock()
    else:
        yield
