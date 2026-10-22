from __future__ import annotations

import json
from pathlib import Path
import tempfile
import cv2
import numpy as np
import pytest
import yaml

from backend.evaluation.validate_dataset import DatasetValidator, EXPECTED_CLASSES
from backend.evaluation.evaluate import ModelEvaluator


def test_validator_missing_yaml() -> None:
    validator = DatasetValidator("non_existent_data.yaml")
    report = validator.validate()
    assert report["status"] == "failed"
    assert any("does not exist" in err for err in report["errors"])


def test_validator_empty_dataset() -> None:
    with tempfile.TemporaryDirectory() as tmp_dir:
        tmp = Path(tmp_dir)
        (tmp / "images" / "test").mkdir(parents=True)
        empty_yaml = tmp / "data.yaml"
        empty_yaml.write_text(
            yaml.dump({
                "path": str(tmp),
                "train": "images/test",
                "val": "images/test",
                "test": "images/test",
                "names": EXPECTED_CLASSES,
            }),
            encoding="utf-8",
        )
        validator = DatasetValidator(empty_yaml)
        report = validator.validate()
        assert report["status"] == "dataset_empty"
        assert report["total_images"] == 0
        assert any("No images found" in w for w in report["warnings"])


def test_validator_class_mismatch() -> None:
    with tempfile.TemporaryDirectory() as tmp_dir:
        tmp = Path(tmp_dir)
        bad_yaml = tmp / "data.yaml"
        bad_yaml.write_text(
            yaml.dump({
                "names": {0: "wrong_class_name", 1: "finger"},
            }),
            encoding="utf-8",
        )
        validator = DatasetValidator(bad_yaml)
        report = validator.validate()
        assert report["status"] == "failed"
        assert any("mismatch" in err.lower() for err in report["errors"])


def test_validator_data_leakage_and_invalid_coords() -> None:
    with tempfile.TemporaryDirectory() as tmp_dir:
        tmp = Path(tmp_dir)
        # Create train and val folders
        (tmp / "images" / "train").mkdir(parents=True)
        (tmp / "images" / "val").mkdir(parents=True)
        (tmp / "labels" / "train").mkdir(parents=True)
        (tmp / "labels" / "val").mkdir(parents=True)

        # Create identical image in both train and val
        sample_img = np.full((100, 100, 3), 120, dtype=np.uint8)
        img_train = tmp / "images" / "train" / "cell1.png"
        img_val = tmp / "images" / "val" / "cell1.png"
        cv2.imwrite(str(img_train), sample_img)
        cv2.imwrite(str(img_val), sample_img)

        # Invalid annotation in train (coordinate > 1.0)
        (tmp / "labels" / "train" / "cell1.txt").write_text("0 1.5 0.5 0.2 0.2\n")
        # Valid annotation in val
        (tmp / "labels" / "val" / "cell1.txt").write_text("0 0.5 0.5 0.2 0.2\n")

        data_yaml = tmp / "data.yaml"
        data_yaml.write_text(
            yaml.dump({
                "path": str(tmp),
                "train": "images/train",
                "val": "images/val",
                "names": EXPECTED_CLASSES,
            }),
            encoding="utf-8",
        )

        validator = DatasetValidator(data_yaml)
        report = validator.validate()

        assert report["status"] == "failed"
        # Should detect leakage between train and val
        assert report["leakage_count"] > 0
        # Should detect invalid coordinate > 1.0
        assert any("out of [0, 1] range" in err for err in report["errors"])


def test_model_evaluator_blocked_on_empty_dataset() -> None:
    with tempfile.TemporaryDirectory() as tmp_dir:
        tmp = Path(tmp_dir)
        (tmp / "images" / "test").mkdir(parents=True)
        empty_yaml = tmp / "data.yaml"
        empty_yaml.write_text(
            yaml.dump({
                "path": str(tmp),
                "test": "images/test",
                "names": EXPECTED_CLASSES,
            }),
            encoding="utf-8",
        )
        evaluator = ModelEvaluator(
            model_path="backend/models/best.pt",
            data_yaml_path=empty_yaml,
            split="test",
            output_dir=tmp_dir,
        )
        report = evaluator.run()
        assert report["evaluation_status"] == "BLOCKED_DATASET_UNAVAILABLE"
        assert report["image_count"] == 0
        assert (Path(tmp_dir) / "evaluation_report.md").exists()
        assert (Path(tmp_dir) / "evaluation_report.json").exists()
