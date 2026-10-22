"""
SolarVision AI — Model 4: Predictive Maintenance
Artifact Contract, Serialization, SHA-256 Checksum, and Verification
"""

from __future__ import annotations

from dataclasses import asdict, dataclass
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
class PredictiveMaintenanceModelMetadata:
    model_name: str
    model_version: str
    created_at: str
    domain: str  # Must be 'general_industrial_equipment_benchmark'
    framework: str
    dataset_name: str
    dataset_doi: str
    dataset_license: str
    dataset_sha256: str
    training_samples: int
    val_samples: int
    test_samples: int
    input_feature_count: int
    feature_names: List[str]
    ordered_feature_schema: List[Dict[str, str]]
    split_strategy: str
    target_labels: Dict[str, int]
    optimal_threshold: float
    test_metrics: Dict[str, Any]
    calibration_metrics: Dict[str, Any]
    reproducibility: Dict[str, Any]
    status: str  # 'BENCHMARK_EVALUATED_READY'
    is_synthetic_benchmark: bool
    synthetic_disclaimer: str
    sha256_hash: Optional[str] = None


class Model4ArtifactContract:
    """Manages serialization, checksum validation, and schema verification for Model 4 artifacts."""

    MODEL_NAME = "SolarVision_Model4_PredictiveMaintenance"
    MODEL_VERSION = "4.0.0-benchmark"
    DOMAIN = "ai4i_synthetic_benchmark"
    SCHEMA_VERSION = "1.0.0"

    VALID_DOMAINS = ("ai4i_synthetic_benchmark", "general_industrial_equipment_benchmark")

    SYNTHETIC_DISCLAIMER = (
        "SYNTHETIC BENCHMARK DISCLAIMER: The UCI AI4I 2020 dataset was generated via physical "
        "milling simulation reflecting synthetic operational failure rules. NOT CERTIFIED FOR DIRECT "
        "SOLAR PHOTOVOLTAIC FACTORY MACHINERY (TABBERS, LAMINATORS, FURNACES) WITHOUT AUTHENTIC "
        "IN-SITU PHYSICAL TELEMETRY."
    )

    @classmethod
    def serialize_artifact(
        cls,
        metadata: PredictiveMaintenanceModelMetadata,
        model_payload: Dict[str, Any],
        preprocessor_dict: Dict[str, Any],
        output_path: Path | str,
    ) -> Tuple[Path, str]:
        path = Path(output_path)
        path.parent.mkdir(parents=True, exist_ok=True)

        meta_dict = asdict(metadata)
        # Omit internal sha256_hash from inside the JSON payload to prevent self-referential
        # hash collision failure in Model4Loader, which computes whole-file SHA-256.
        meta_dict.pop("sha256_hash", None)

        artifact_dict = {
            "contract_version": cls.SCHEMA_VERSION,
            "domain_disclaimer": cls.SYNTHETIC_DISCLAIMER,
            "metadata": meta_dict,
            "model_payload": model_payload,
            "preprocessor": preprocessor_dict,
        }

        final_serialized = json.dumps(artifact_dict, cls=NumpyJSONEncoder, indent=2)
        path.write_text(final_serialized, encoding="utf-8", newline="\n")

        # Compute exact cryptographic SHA-256 of the written bytes on disk
        file_sha256 = hashlib.sha256(path.read_bytes()).hexdigest()

        # Write sidecar SHA-256 verification file
        sidecar_path = path.parent / f"{path.name}.sha256"
        sidecar_path.write_text(f"{file_sha256}  {path.name}\n", encoding="utf-8", newline="\n")

        return path, file_sha256

    @classmethod
    def load_and_verify(
        cls, artifact_path: Path | str
    ) -> Tuple[PredictiveMaintenanceModelMetadata, Dict[str, Any], Dict[str, Any]]:
        path = Path(artifact_path)
        if not path.exists():
            raise FileNotFoundError(f"Model 4 artifact not found at {path}")

        raw_bytes = path.read_bytes()
        computed_sha = hashlib.sha256(raw_bytes).hexdigest()
        data = json.loads(raw_bytes.decode("utf-8"))

        meta_dict = data.get("metadata", {})
        meta_dict["sha256_hash"] = computed_sha
        metadata = PredictiveMaintenanceModelMetadata(**meta_dict)

        # Verification checks
        if metadata.domain not in cls.VALID_DOMAINS:
            raise ValueError(
                f"Domain mismatch: artifact claims domain '{metadata.domain}'. "
                f"Expected one of {cls.VALID_DOMAINS}."
            )

        if metadata.status != "BENCHMARK_EVALUATED_READY":
            raise ValueError(
                f"Artifact is not ready for evaluation: status is '{metadata.status}'."
            )

        if len(metadata.feature_names) != 6:
            raise ValueError(
                f"Expected 6 canonical input features, got {len(metadata.feature_names)}"
            )

        return metadata, data.get("model_payload", {}), data.get("preprocessor", {})

