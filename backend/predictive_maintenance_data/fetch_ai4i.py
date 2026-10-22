"""
SolarVision AI — Model 4: Predictive Maintenance
Automated Dataset Fetcher and Integrity Verifier for UCI AI4I 2020 Dataset
"""

from __future__ import annotations

import hashlib
import io
import logging
from pathlib import Path
import urllib.request
import zipfile

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("fetch_ai4i")

UCI_AI4I_ZIP_URL = "https://archive.ics.uci.edu/static/public/601/ai4i+2020+predictive+maintenance+dataset.zip"
EXPECTED_CSV_SHA256 = "dc6630cd9b1f0f853922fad78a1b6436570d3f1ec863f1dd5c4340ac56bc8a8e"

DATA_DIR = Path(__file__).resolve().parent / "raw"
TARGET_CSV_PATH = DATA_DIR / "ai4i2020.csv"


def fetch_and_verify_ai4i() -> Path:
    DATA_DIR.mkdir(parents=True, exist_ok=True)

    if TARGET_CSV_PATH.exists():
        current_hash = hashlib.sha256(TARGET_CSV_PATH.read_bytes()).hexdigest()
        if current_hash == EXPECTED_CSV_SHA256:
            logger.info("UCI AI4I 2020 dataset already present and verified at: %s", TARGET_CSV_PATH)
            return TARGET_CSV_PATH
        logger.warning("Existing ai4i2020.csv has hash mismatch (%s != %s), re-downloading...", current_hash, EXPECTED_CSV_SHA256)

    logger.info("Downloading official UCI AI4I 2020 dataset from: %s", UCI_AI4I_ZIP_URL)
    req = urllib.request.Request(UCI_AI4I_ZIP_URL, headers={"User-Agent": "Mozilla/5.0 (SolarVisionAI-Agent3)"})
    with urllib.request.urlopen(req, timeout=30) as resp:
        zip_bytes = resp.read()

    logger.info("Downloaded %d bytes. Extracting ai4i2020.csv...", len(zip_bytes))
    zf = zipfile.ZipFile(io.BytesIO(zip_bytes))
    csv_bytes = zf.read("ai4i2020.csv")

    computed_hash = hashlib.sha256(csv_bytes).hexdigest()
    if computed_hash != EXPECTED_CSV_SHA256:
        raise ValueError(
            f"Checksum verification failed for downloaded ai4i2020.csv!\n"
            f"Expected: {EXPECTED_CSV_SHA256}\n"
            f"Computed: {computed_hash}"
        )

    TARGET_CSV_PATH.write_bytes(csv_bytes)
    logger.info("Successfully verified and saved ai4i2020.csv (SHA-256: %s)", computed_hash)
    return TARGET_CSV_PATH


if __name__ == "__main__":
    fetch_and_verify_ai4i()
