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
    confidence_threshold: float = float(
        os.getenv("CONFIDENCE_THRESHOLD", "0.25")
    )
    image_size: int = int(os.getenv("IMAGE_SIZE", "640"))
    supabase_url: str | None = os.getenv("SUPABASE_URL")
    supabase_service_role_key: str | None = os.getenv(
        "SUPABASE_SERVICE_ROLE_KEY"
    )
    supabase_bucket: str = os.getenv(
        "SUPABASE_STORAGE_BUCKET",
        "solarvision-images",
    )

    def ensure_paths(self) -> None:
        self.storage_dir.mkdir(parents=True, exist_ok=True)

    @property
    def supabase_configured(self) -> bool:
        return bool(
            self.supabase_url and self.supabase_service_role_key
        )


settings = Settings()