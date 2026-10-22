from __future__ import annotations

import argparse
import os
from pathlib import Path
import random
import sys
from typing import Any

import numpy as np
import yaml

from backend.evaluation.validate_dataset import DatasetValidator


def set_seed(seed: int = 42) -> None:
    random.seed(seed)
    np.random.seed(seed)
    os.environ["PYTHONHASHSEED"] = str(seed)
    try:
        import torch
        torch.manual_seed(seed)
        if torch.cuda.is_available():
            torch.cuda.manual_seed_all(seed)
            torch.backends.cudnn.deterministic = True
            torch.backends.cudnn.benchmark = False
    except ImportError:
        pass


def check_training_prerequisites(data_yaml_path: Path) -> tuple[bool, str]:
    if not data_yaml_path.exists():
        return False, f"Dataset configuration file not found: {data_yaml_path}"

    validator = DatasetValidator(data_yaml_path)
    res = validator.validate()

    train_info = res.get("splits", {}).get("train", {})
    train_images = train_info.get("image_count", 0)

    if train_images == 0:
        return False, (
            "No training images found in 'data/dataset/images/train/'. "
            "Please supply labeled solar cell images and annotations before training."
        )

    val_info = res.get("splits", {}).get("val", {})
    val_images = val_info.get("image_count", 0)
    if val_images == 0:
        return False, (
            "No validation images found in 'data/dataset/images/val/'. "
            "A validation split is required to monitor overfitting and evaluate candidate checkpoints."
        )

    if res.get("errors"):
        return False, f"Dataset validation errors found: {'; '.join(res['errors'][:5])}"

    return True, "Dataset ready for training."


def train_model(
    data_yaml: str | Path = "data/dataset/data.yaml",
    weights: str | Path = "backend/models/best.pt",
    epochs: int = 50,
    batch_size: int = 16,
    imgsz: int = 640,
    learning_rate: float = 0.01,
    seed: int = 42,
    device: str = "",
    project: str | Path = "backend/models/candidates",
    run_name: str = "candidate_run",
) -> dict[str, Any]:
    """Train or fine-tune candidate YOLO model on solar defect dataset."""
    data_path = Path(data_yaml).resolve()
    weights_path = Path(weights).resolve()
    project_path = Path(project).resolve()
    project_path.mkdir(parents=True, exist_ok=True)

    set_seed(seed)

    print("=" * 70)
    print("SOLARVISION AI — MODEL 1 TRAINING PIPELINE")
    print("=" * 70)
    print(f"Data configuration: {data_path}")
    print(f"Base weights:       {weights_path}")
    print(f"Target epochs:      {epochs}")
    print(f"Batch size:         {batch_size}")
    print(f"Image size:         {imgsz}")
    print(f"Seed:               {seed}")
    print(f"Output directory:   {project_path / run_name}")
    print("-" * 70)

    ready, msg = check_training_prerequisites(data_path)
    if not ready:
        print(f"[TRAINING BLOCKED] {msg}")
        print("Adhering to engineering integrity: Training cannot proceed without real ground-truth data.")
        return {
            "status": "BLOCKED_PREREQUISITES_MISSING",
            "message": msg,
            "baseline_weights": str(weights_path),
            "candidate_path": None,
        }

    try:
        from ultralytics import YOLO

        print(f"Initializing YOLO model from base weights: {weights_path}")
        model = YOLO(str(weights_path))

        print("Starting model training...")
        train_args = {
            "data": str(data_path),
            "epochs": epochs,
            "batch": batch_size,
            "imgsz": imgsz,
            "lr0": learning_rate,
            "seed": seed,
            "project": str(project_path),
            "name": run_name,
            "exist_ok": True,
            "verbose": True,
        }
        if device:
            train_args["device"] = device

        results = model.train(**train_args)

        candidate_ckpt = project_path / run_name / "weights" / "best.pt"
        print(f"\nTraining completed! Candidate checkpoint saved to: {candidate_ckpt}")

        return {
            "status": "COMPLETED",
            "message": "Candidate training completed successfully.",
            "candidate_path": str(candidate_ckpt),
            "baseline_weights": str(weights_path),
            "results": str(results),
        }

    except Exception as exc:
        print(f"Training failed with error: {exc}")
        return {
            "status": "ERROR",
            "message": str(exc),
            "candidate_path": None,
            "baseline_weights": str(weights_path),
        }


def main() -> None:
    parser = argparse.ArgumentParser(description="SolarVision AI Model 1 Training Pipeline")
    parser.add_argument("--data", default="data/dataset/data.yaml", help="Path to data.yaml")
    parser.add_argument("--weights", default="backend/models/best.pt", help="Baseline weights to fine-tune")
    parser.add_argument("--epochs", type=int, default=50, help="Training epochs")
    parser.add_argument("--batch", type=int, default=16, help="Batch size")
    parser.add_argument("--imgsz", type=int, default=640, help="Image resolution")
    parser.add_argument("--lr", type=float, default=0.01, help="Initial learning rate")
    parser.add_argument("--seed", type=int, default=42, help="Random seed for reproducibility")
    parser.add_argument("--device", default="", help="Device (cpu, cuda:0, etc.)")
    parser.add_argument("--project", default="backend/models/candidates", help="Output project folder")
    parser.add_argument("--name", default="candidate_run", help="Experiment name")
    args = parser.parse_args()

    result = train_model(
        data_yaml=args.data,
        weights=args.weights,
        epochs=args.epochs,
        batch_size=args.batch,
        imgsz=args.imgsz,
        learning_rate=args.lr,
        seed=args.seed,
        device=args.device,
        project=args.project,
        run_name=args.name,
    )

    sys.exit(0 if result["status"] == "COMPLETED" else (2 if "BLOCKED" in result["status"] else 1))


if __name__ == "__main__":
    main()
