"""
SolarVision AI — Model 3: Sandia Solar Electrical Performance Prediction
Unit & Security Verification Tests for Artifact Fetcher & Pre-Deserialization Integrity Verification
"""

import hashlib
import os
from pathlib import Path
import tempfile
import pytest
from unittest.mock import MagicMock, patch

from backend.app.sandia_performance.artifact_fetcher import (
    EXPECTED_SANDIA_SHA256,
    calculate_file_sha256,
    download_and_verify_artifact,
    main as fetcher_main,
    sanitize_log_message,
    sanitize_url_for_logging,
    verify_file_integrity,
)


class TestSandiaArtifactFetcherSecurity:
    """Verifies cryptographic verification, rejection of corrupted checkpoints, and zero-credential leakage."""

    def test_sanitize_url_for_logging_strips_sensitive_query_parameters(self):
        """Ensures presigned S3/GCS signatures, auth tokens and credentials are never logged."""
        raw_url = "https://s3.us-west-2.amazonaws.com/model-bucket/pipeline.joblib?X-Amz-Signature=secret123&token=abc"
        sanitized = sanitize_url_for_logging(raw_url)
        assert "secret123" not in sanitized
        assert "token=abc" not in sanitized
        assert "X-Amz-Signature" not in sanitized
        assert sanitized == "https://s3.us-west-2.amazonaws.com/model-bucket/pipeline.joblib"

    def test_sanitize_log_message_redacts_auth_token_and_query_parameters(self):
        """Ensures exception messages redact bearer tokens, signatures, and raw URLs."""
        raw_url = "https://artifacts.internal/model.joblib?token=supersecret123&sig=abcdef"
        raw_token = "supersecret123"
        raw_msg = (
            "HTTPConnectionPool(host='artifacts.internal', port=443): "
            "Max retries exceeded with url: /model.joblib?token=supersecret123&sig=abcdef "
            "Authorization: Bearer supersecret123"
        )

        sanitized = sanitize_log_message(raw_msg, raw_url=raw_url, token=raw_token)
        assert "supersecret123" not in sanitized
        assert "abcdef" not in sanitized
        assert "[REDACTED_AUTH_TOKEN]" in sanitized or "[REDACTED]" in sanitized

    def test_verify_file_integrity_valid_matches_expected_hash(self):
        """Verifies calculation on genuine content matching expected SHA-256."""
        with tempfile.NamedTemporaryFile(delete=False) as tmp:
            tmp_path = Path(tmp.name)
            # Write dummy data and test with computed SHA
            content = b"solarvision-test-content-for-integrity-verification"
            tmp_path.write_bytes(content)
            expected = hashlib.sha256(content).hexdigest()

        try:
            assert verify_file_integrity(tmp_path, expected_sha=expected, expected_size=len(content)) is True
        finally:
            if tmp_path.exists():
                tmp_path.unlink()

    def test_verify_file_integrity_corrupted_fails(self):
        """Verifies that corrupted bytes or hash mismatches return False."""
        with tempfile.NamedTemporaryFile(delete=False) as tmp:
            tmp_path = Path(tmp.name)
            tmp_path.write_bytes(b"tampered-malicious-payload")

        try:
            assert verify_file_integrity(tmp_path, expected_sha=EXPECTED_SANDIA_SHA256) is False
        finally:
            if tmp_path.exists():
                tmp_path.unlink()

    def test_download_and_verify_artifact_from_file_with_valid_hash(self):
        """Verifies successful atomic fetch and verification from local source."""
        test_content = b"solarvision-pipeline-bytes"
        expected_sha = hashlib.sha256(test_content).hexdigest()

        with tempfile.TemporaryDirectory() as temp_dir:
            src_file = Path(temp_dir) / "source_pipeline.joblib"
            src_file.write_bytes(test_content)

            dest_file = Path(temp_dir) / "target_pipeline.joblib"
            result = download_and_verify_artifact(
                target_path=dest_file,
                source_url=f"file://{src_file.resolve()}",
                expected_sha=expected_sha,
            )

            assert result is True
            assert dest_file.exists()
            assert dest_file.read_bytes() == test_content

    def test_download_and_verify_artifact_rejects_corrupted_payload_and_purges_temp(self):
        """Strict security test: untrusted/tampered payload must be deleted and NOT saved to target."""
        corrupted_content = b"corrupted-or-unverified-payload"

        with tempfile.TemporaryDirectory() as temp_dir:
            src_file = Path(temp_dir) / "source_bad.joblib"
            src_file.write_bytes(corrupted_content)

            dest_file = Path(temp_dir) / "target_pipeline.joblib"
            result = download_and_verify_artifact(
                target_path=dest_file,
                source_url=f"file://{src_file.resolve()}",
                expected_sha=EXPECTED_SANDIA_SHA256,  # Doesn't match corrupted_content
            )

            assert result is False
            assert not dest_file.exists(), "Target file must NEVER exist after integrity check failure."
            # Verify no orphaned temp files
            temp_files = list(Path(temp_dir).glob(".tmp_*"))
            assert len(temp_files) == 0, "All temporary download files must be cleanly purged."

    def test_download_and_verify_artifact_via_mocked_http_stream(self):
        """Verifies streaming HTTP download with auth token and SHA-256 verification."""
        test_content = b"http-downloaded-model-data"
        expected_sha = hashlib.sha256(test_content).hexdigest()

        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.iter_content.return_value = [test_content[:10], test_content[10:]]

        with tempfile.TemporaryDirectory() as temp_dir:
            dest_file = Path(temp_dir) / "http_target.joblib"
            with patch("requests.get", return_value=mock_response) as mock_get:
                result = download_and_verify_artifact(
                    target_path=dest_file,
                    source_url="https://artifacts.example.internal/models/sandia.joblib",
                    auth_token="secret-operator-token-12345",
                    expected_sha=expected_sha,
                )

                assert result is True
                assert dest_file.exists()
                assert dest_file.read_bytes() == test_content
                # Verify request was made with Authorization header
                mock_get.assert_called_once()
                call_headers = mock_get.call_args[1].get("headers", {})
                assert call_headers.get("Authorization") == "Bearer secret-operator-token-12345"

    def test_cli_main_exit_codes(self):
        """Verifies CLI exit codes when artifact is missing and required."""
        with patch.dict(os.environ, {"REQUIRE_SANDIA_MODEL": "true", "SANDIA_MODEL_URL": ""}):
            with tempfile.TemporaryDirectory() as temp_dir:
                non_existent_target = Path(temp_dir) / "non_existent.joblib"
                with patch("sys.argv", ["artifact_fetcher", "--target", str(non_existent_target), "--require"]):
                    exit_code = fetcher_main()
                    assert exit_code == 1
