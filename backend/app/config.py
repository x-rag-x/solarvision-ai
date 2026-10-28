from dataclasses import dataclass
import os
from pathlib import Path


BASE_DIR = Path(__file__).resolve().parent.parent


@dataclass(frozen=True)
class Settings:
    model_path: Path = Path(
        os.getenv("MODEL_PATH", str(BASE_DIR / "models" / "best.pt"))
    )
    storage_dir: Path = Path(
        os.getenv("LOCAL_STORAGE_DIR", str(BASE_DIR / "storage"))
    )
    confidence_threshold: float = float(os.getenv("CONFIDENCE_THRESHOLD", "0.25"))
    iou_threshold: float = float(os.getenv("IOU_THRESHOLD", "0.7"))
    image_size: int = int(os.getenv("IMAGE_SIZE", "640"))
    supabase_url: str | None = os.getenv("SUPABASE_URL")
    supabase_service_role_key: str | None = os.getenv(
        "SUPABASE_SERVICE_ROLE_KEY"
    )
    supabase_bucket: str = os.getenv(
        "SUPABASE_STORAGE_BUCKET",
        "solarvision-images",
    )
    max_upload_size_bytes: int = int(
        os.getenv("MAX_UPLOAD_SIZE_BYTES", str(50 * 1024 * 1024))
    )
    request_timeout_seconds: float = float(
        os.getenv("REQUEST_TIMEOUT_SECONDS", "60.0")
    )
    sandia_model_dir: Path = Path(
        os.getenv("SANDIA_MODEL_DIR", str(BASE_DIR / "models" / "sandia"))
    )
    sandia_model_path: Path = Path(
        os.getenv("SANDIA_MODEL_PATH", str(BASE_DIR / "models" / "sandia" / "pipeline.joblib"))
    )
    sandia_schema_path: Path = Path(
        os.getenv("SANDIA_SCHEMA_PATH", str(BASE_DIR / "models" / "sandia" / "feature_schema.json"))
    )
    sandia_sample_input_path: Path = Path(
        os.getenv("SANDIA_SAMPLE_INPUT_PATH", str(BASE_DIR / "models" / "sandia" / "sample_input.json"))
    )
    sandia_target_path: Path = Path(
        os.getenv("SANDIA_TARGET_PATH", str(BASE_DIR / "models" / "sandia" / "target_definition.json"))
    )

    def ensure_paths(self) -> None:
        self.storage_dir.mkdir(parents=True, exist_ok=True)
        self.sandia_model_dir.mkdir(parents=True, exist_ok=True)

    @property
    def supabase_configured(self) -> bool:
        return bool(
            self.supabase_url and self.supabase_service_role_key
        )


settings = Settings()
