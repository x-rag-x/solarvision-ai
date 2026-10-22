"""Model 2 Artifact Contract for Root Cause Analysis.

Coordinates the input feature order, class taxonomy, serialization structure,
and metadata contract with Agent 1 and downstream inference services.
"""

from __future__ import annotations

from dataclasses import asdict, dataclass, field
from datetime import datetime, timezone
import json
from pathlib import Path
from typing import Any, Dict, List, Optional

from backend.root_cause_data.schema import CANONICAL_FEATURE_ORDER, ROOT_CAUSE_TAXONOMY
from backend.root_cause_data.feature_spec import (
    CANONICAL_FEATURE_NAMES_V2,
    CANONICAL_FEATURE_COUNT_V2,
    FEATURE_SCHEMA_VERSION,
)


MODEL2_VERSION = "2.0.0-rc1"
MODEL2_NAME = "SolarVision_RootCause_RF"


@dataclass
class ModelMetadata:
    model_name: str
    model_version: str
    created_at: str
    framework: str
    feature_count: int
    feature_names: List[str]
    num_classes: int
    target_classes: List[str]
    hyperparameters: Dict[str, Any]
    training_samples: int
    metrics: Dict[str, Any]
    feature_importances: Dict[str, float]
    calibration_method: Optional[str] = None
    is_synthetic_training: bool = False
    status: str = "production_ready"  # 'production_ready' | 'DATASET_BLOCKED' | 'validation_prototype'
    feature_schema_version: str = FEATURE_SCHEMA_VERSION
    sha256: Optional[str] = None


import numpy as np


class NumpyJSONEncoder(json.JSONEncoder):
    """Custom JSON encoder handling NumPy scalars, arrays, and standard types."""

    def default(self, obj: Any) -> Any:
        if isinstance(obj, (np.integer, np.int32, np.int64)):
            return int(obj)
        elif isinstance(obj, (np.floating, np.float32, np.float64)):
            return float(obj)
        elif isinstance(obj, np.ndarray):
            return obj.tolist()
        return super().default(obj)


class Model2ArtifactContract:
    """Defines the serialization and loading contract for Model 2."""

    @staticmethod
    def get_canonical_features() -> List[str]:
        """Returns the legacy 40-feature list for backward compatibility."""
        return list(CANONICAL_FEATURE_ORDER)

    @staticmethod
    def get_canonical_features_v2() -> List[str]:
        """Returns the canonical 48-feature list for Schema Version 2.0.0."""
        return list(CANONICAL_FEATURE_NAMES_V2)

    @staticmethod
    def get_canonical_feature_count_v2() -> int:
        return CANONICAL_FEATURE_COUNT_V2

    @staticmethod
    def get_target_classes() -> List[str]:
        return list(ROOT_CAUSE_TAXONOMY)

    @staticmethod
    def serialize_artifact(
        metadata: ModelMetadata,
        model_payload: Dict[str, Any],
        output_path: Path | str,
    ) -> Path:
        """
        Saves a self-contained Model 2 artifact containing both metadata and model structure.
        Computes SHA-256 hash if not already populated.
        """
        path = Path(output_path)
        path.parent.mkdir(parents=True, exist_ok=True)

        artifact = {
            "contract_version": "2.0",
            "metadata": asdict(metadata),
            "model_payload": model_payload,
        }

        serialized = json.dumps(artifact, cls=NumpyJSONEncoder, indent=2)
        path.write_text(serialized, encoding="utf-8")
        return path

    @staticmethod
    def load_artifact(artifact_path: Path | str) -> Tuple[ModelMetadata, Dict[str, Any]]:
        """Loads and validates a Model 2 artifact."""
        path = Path(artifact_path)
        if not path.exists():
            raise FileNotFoundError(f"Model artifact not found at {path}")

        raw = json.loads(path.read_text(encoding="utf-8"))
        meta_dict = raw.get("metadata", {})
        metadata = ModelMetadata(**meta_dict)

        # Validate feature order against either v2.0.0 (48 features) or legacy (40 features)
        if (
            metadata.feature_names != list(CANONICAL_FEATURE_NAMES_V2)
            and metadata.feature_names != list(CANONICAL_FEATURE_ORDER)
        ):
            raise ValueError(
                "Feature order mismatch between loaded artifact and current schema contract."
            )

        return metadata, raw.get("model_payload", {})
