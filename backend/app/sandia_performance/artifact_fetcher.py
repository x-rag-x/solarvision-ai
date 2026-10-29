"""
SolarVision AI — Model 3: Sandia Solar Electrical Performance Prediction
Secure Artifact Fetcher & Pre-Deserialization Cryptographic Verification Engine

Enforces strict SHA-256 integrity verification before any checkpoint can be loaded into memory.
Guarantees zero-credential leakage in logs, build layers, and error messages.
"""

from __future__ import annotations

import argparse
import hashlib
import logging
import os
from pathlib import Path
import re
import shutil
import sys
from typing import Optional
from urllib.parse import urlparse
import uuid

import requests

from ..config import settings

logger = logging.getLogger("solarvision.sandia_performance.artifact_fetcher")

# Canonical Sandia reference power pipeline checkpoint contract
EXPECTED_SANDIA_SHA256: str = "045f9a15b7981c3e88ac18011dfa1b16821874bf211fa582cf148840e5dbf373"
EXPECTED_SANDIA_SIZE_BYTES: int = 1246515


def sanitize_url_for_logging(raw_url: str) -> str:
    """
    Sanitizes URL by stripping query strings, access tokens, and presigned signatures
    to prevent credential exposure in container or deployment logs.
    """
    if not raw_url:
        return "[empty_url]"
    try:
        parsed = urlparse(raw_url)
        # Omit username/password if in netloc
        host = parsed.hostname or "unknown-host"
        port = f":{parsed.port}" if parsed.port else ""
        clean_path = parsed.path
        return f"{parsed.scheme}://{host}{port}{clean_path}"
    except Exception:
        return "[sanitized_url]"


def sanitize_log_message(msg: str, raw_url: Optional[str] = None, token: Optional[str] = None) -> str:
    """
    Sanitizes exception or log messages to prevent credentials, tokens, or
    presigned signature query strings from leaking into container logs.
    """
    clean = str(msg)
    if token and len(token) > 0:
        clean = clean.replace(token, "[REDACTED_AUTH_TOKEN]")
    if raw_url:
        clean_url = sanitize_url_for_logging(raw_url)
        clean = clean.replace(raw_url, clean_url)
    # Strip any query parameters or auth parameters if present
    clean = re.sub(
        r"([?&](?:sig|signature|token|access_token|key|api_key|auth|credential|secret|X-Amz-[^=]+)=)[^&\s'\"]+",
        r"\1[REDACTED]",
        clean,
        flags=re.IGNORECASE,
    )
    return clean


def calculate_file_sha256(file_path: Path, chunk_size: int = 65536) -> str:
    """Calculates SHA-256 hex digest of a local file in memory-efficient chunks."""
    sha256 = hashlib.sha256()
    with open(file_path, "rb") as f:
        while True:
            chunk = f.read(chunk_size)
            if not chunk:
                break
            sha256.update(chunk)
    return sha256.hexdigest()


def verify_file_integrity(
    file_path: Path,
    expected_sha: str = EXPECTED_SANDIA_SHA256,
    expected_size: Optional[int] = EXPECTED_SANDIA_SIZE_BYTES,
) -> bool:
    """
    Validates file existence and verifies that the file matches the expected SHA-256.
    Returns True if valid, False otherwise.
    """
    if not file_path.exists() or not file_path.is_file():
        return False

    actual_size = file_path.stat().st_size
    if expected_size is not None and actual_size != expected_size:
        logger.warning(
            "Artifact at %s size mismatch: %d bytes (expected %d bytes)",
            file_path.name,
            actual_size,
            expected_size,
        )
        return False

    actual_sha = calculate_file_sha256(file_path)
    if actual_sha.lower() != expected_sha.lower():
        logger.warning(
            "Artifact at %s SHA-256 mismatch: computed %s, expected %s",
            file_path.name,
            actual_sha,
            expected_sha,
        )
        return False

    return True


def download_and_verify_artifact(
    target_path: Optional[Path] = None,
    source_url: Optional[str] = None,
    auth_token: Optional[str] = None,
    expected_sha: str = EXPECTED_SANDIA_SHA256,
    timeout_seconds: float = 60.0,
) -> bool:
    """
    Securely downloads the genuine pipeline artifact from a configured location (HTTP, HTTPS, or file),
    computes SHA-256 integrity during/after transfer, and atomically saves the artifact
    ONLY if cryptographic verification succeeds.

    If verification fails, the downloaded temporary file is purged immediately,
    and NO unverified bytes are ever deserialized or left at the target path.
    """
    target = Path(target_path or settings.sandia_model_path)
    target.parent.mkdir(parents=True, exist_ok=True)

    # 1. Check if valid artifact already exists at target
    if target.exists():
        if verify_file_integrity(target, expected_sha=expected_sha):
            logger.info("Sandia model artifact already exists and verified at %s", target.name)
            return True
        logger.warning(
            "Existing artifact at %s failed cryptographic integrity check. Purging corrupted file.",
            target.name,
        )
        try:
            target.unlink()
        except OSError as exc:
            logger.error("Failed to remove corrupted artifact %s: %s", target.name, exc)
            return False

    # 2. Resolve source URL
    url = (
        source_url
        or os.getenv("SANDIA_MODEL_URL")
        or os.getenv("SANDIA_ARTIFACT_URL")
        or os.getenv("ARTIFACT_URL")
        or ""
    ).strip()

    if not url:
        logger.info(
            "No artifact download URL configured (SANDIA_MODEL_URL/SANDIA_ARTIFACT_URL/ARTIFACT_URL empty). "
            "Pipeline checkpoint must be mounted or downloaded before inference."
        )
        return False

    token = (auth_token or os.getenv("SANDIA_ARTIFACT_AUTH_TOKEN") or os.getenv("ARTIFACT_AUTH_TOKEN") or "").strip()
    safe_log_url = sanitize_url_for_logging(url)
    logger.info("Initiating secure artifact download from %s to %s", safe_log_url, target.name)

    temp_path = target.parent / f".tmp_{uuid.uuid4().hex}_{target.name}"
    sha256 = hashlib.sha256()
    total_bytes = 0

    try:
        # Support file:// or direct filesystem paths
        if url.startswith("file://") or Path(url).exists():
            local_src = Path(url[7:] if url.startswith("file://") else url)
            if not local_src.exists():
                logger.error("Local artifact source does not exist: %s", local_src.name)
                return False
            with open(local_src, "rb") as f_in, open(temp_path, "wb") as f_out:
                while True:
                    chunk = f_in.read(65536)
                    if not chunk:
                        break
                    sha256.update(chunk)
                    f_out.write(chunk)
                    total_bytes += len(chunk)
        else:
            # Remote HTTP/HTTPS download with sanitized headers
            headers = {
                "Accept": "application/octet-stream, application/x-joblib, */*",
                "User-Agent": "SolarVision-Render-Staging/1.0",
            }
            if token:
                headers["Authorization"] = token if token.lower().startswith("bearer ") else f"Bearer {token}"

            response = requests.get(
                url,
                headers=headers,
                stream=True,
                timeout=timeout_seconds,
                allow_redirects=True,
            )
            if response.status_code != 200:
                logger.error(
                    "Artifact download failed: HTTP status %d from %s",
                    response.status_code,
                    safe_log_url,
                )
                return False

            with open(temp_path, "wb") as f_out:
                for chunk in response.iter_content(chunk_size=65536):
                    if chunk:
                        sha256.update(chunk)
                        f_out.write(chunk)
                        total_bytes += len(chunk)

        computed_sha = sha256.hexdigest().lower()
        if computed_sha != expected_sha.lower():
            logger.error(
                "SECURITY ALERT: Downloaded artifact failed SHA-256 verification! "
                "Computed: '%s', Expected: '%s'. Purging temporary file immediately. "
                "Deserialization rejected.",
                computed_sha,
                expected_sha,
            )
            if temp_path.exists():
                temp_path.unlink()
            return False

        # Atomic replace: guarantee no half-written or corrupt file is visible
        os.replace(temp_path, target)
        try:
            target.chmod(0o644)
        except OSError:
            pass

        logger.info(
            "Sandia model artifact successfully downloaded and verified (%d bytes, SHA-256: %s). "
            "Safe for deserialization.",
            total_bytes,
            computed_sha,
        )
        return True

    except Exception as exc:
        sanitized_exc = sanitize_log_message(str(exc), raw_url=url, token=token)
        logger.error("Artifact download encountered exception: %s", sanitized_exc)
        if temp_path.exists():
            try:
                temp_path.unlink()
            except OSError:
                pass
        return False


def main() -> int:
    """CLI entrypoint for container startup or pre-flight initialization."""
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s [%(levelname)s] [ArtifactFetcher] %(message)s",
    )

    parser = argparse.ArgumentParser(description="SolarVision AI Sandia Artifact Fetcher & Verifier")
    parser.add_argument("--target", type=str, default="", help="Target file path for pipeline.joblib")
    parser.add_argument("--url", type=str, default="", help="Download URL")
    parser.add_argument("--token", type=str, default="", help="Bearer token for download authentication")
    parser.add_argument("--require", action="store_true", help="Fail with exit code 1 if artifact is unavailable")

    args = parser.parse_args()

    target = Path(args.target) if args.target else settings.sandia_model_path
    url = args.url or None
    token = args.token or None

    logger.info("Verifying Sandia model artifact at target: %s", target.name)
    success = download_and_verify_artifact(
        target_path=target,
        source_url=url,
        auth_token=token,
    )

    if success:
        logger.info("Sandia model artifact ready.")
        return 0

    if args.require:
        logger.error("Sandia model artifact is missing or corrupt and --require was specified.")
        return 1

    return 0


if __name__ == "__main__":
    sys.exit(main())
