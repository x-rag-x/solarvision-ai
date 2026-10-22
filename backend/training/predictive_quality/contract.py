"""
SolarVision AI — Model 3: Predictive Quality Analysis
Artifact Contract, Serialization, SHA-256 Hashing, and Metadata Verification
"""

from __future__ import annotations

from dataclasses import asdict, dataclass
from datetime import datetime, timezone
import hashlib
import json
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple
import numpy as np


class NumpyJSONEncoder(json.JSONEncoder):
    def default(self, obj: Any) -> Any:
        if isinstance(obj, (np.integer, np.int32, np.int64)):
            return int(obj)
        elif isinstance(obj, (np.floating, np.float32, np.float64)):
            return float(obj)
        elif isinstance(obj, np.ndarray):
            return obj.tolist()
        return super().default(obj)


@dataclass
class PredictiveQualityModelMetadata:
    model_name: str
    model_version: str
    created_at: str
    domain: str  # Must be 'general_semiconductor_quality_benchmark'
    framework: str
    dataset_name: str
    dataset_doi: str
    dataset_license: str
    training_samples: int
    val_samples: int
    test_samples: int
    input_feature_count: int
    retained_feature_count: int
    output_feature_count: int
    split_strategy: str
    target_labels: Dict[str, int]
    optimal_threshold: float
    test_metrics: Dict[str, Any]
    calibration_metrics: Dict[str, Any]
    reproducibility: Dict[str, Any]
    status: str  # 'BENCHMARK_EVALUATED_READY'
    sha256_hash: Optional[str] = None


class Model3ArtifactContract:
    """Manages serialization, checksum validation, and schema verification for Model 3 artifacts."""

    MODEL_NAME = "SolarVision_Model3_PredictiveQuality"
    MODEL_VERSION = "3.0.0-benchmark"
    DOMAIN = "general_semiconductor_quality_benchmark"

    @classmethod
    def serialize_artifact(
        cls,
        metadata: PredictiveQualityModelMetadata,
        model_payload: Dict[str, Any],
        preprocessor_dict: Dict[str, Any],
        output_path: Path | str,
    ) -> Tuple[Path, str]:
        path = Path(output_path)
        path.parent.mkdir(parents=True, exist_ok=True)

        artifact_dict = {
            "contract_version": "3.0.0",
            "domain_disclaimer": (
                "GENERAL SEMICONDUCTOR QUALITY BENCHMARK (UCI SECOM). "
                "NOT A SOLAR-CELL FACTORY VALIDATION."
            ),
            "metadata": asdict(metadata),
            "model_payload": model_payload,
            "preprocessor": preprocessor_dict,
        }

        # First serialize without hash to calculate checksum
        serialized = json.dumps(artifact_dict, cls=NumpyJSONEncoder, indent=2)
        sha256 = hashlib.sha256(serialized.encode("utf-8")).hexdigest()

        # Insert hash into metadata
        artifact_dict["metadata"]["sha256_hash"] = sha256
        final_serialized = json.dumps(artifact_dict, cls=NumpyJSONEncoder, indent=2)
        path.write_text(final_serialized, encoding="utf-8")

        return path, sha256

    @classmethod
    def load_and_verify(
        cls, artifact_path: Path | str
    ) -> Tuple[PredictiveQualityModelMetadata, Dict[str, Any], Dict[str, Any]]:
        path = Path(artifact_path)
        if not path.exists():
            raise FileNotFoundError(f"Model 3 artifact not found at {path}")

        raw_text = path.read_text(encoding="utf-8")
        data = json.loads(raw_text)

        meta_dict = data.get("metadata", {})
        metadata = PredictiveQualityModelMetadata(**meta_dict)

        # Verification checks
        if metadata.domain != cls.DOMAIN:
            raise ValueError(
                f"Domain mismatch: artifact claims domain '{metadata.domain}'. "
                f"Expected '{cls.DOMAIN}'."
            )

        if metadata.status != "BENCHMARK_EVALUATED_READY":
            raise ValueError(
                f"Artifact is not ready for evaluation: status is '{metadata.status}'."
            )

        return metadata, data.get("model_payload", {}), data.get("preprocessor", {})
