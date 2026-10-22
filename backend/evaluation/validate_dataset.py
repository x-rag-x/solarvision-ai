from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path
import sys
from typing import Any

import cv2
import yaml

EXPECTED_CLASSES: dict[int, str] = {
    0: "crack",
    1: "finger",
    2: "black_core",
    3: "thick_line",
    4: "star_crack",
    5: "horizontal_dislocation",
    6: "vertical_dislocation",
    7: "printing_error",
    8: "short_circuit",
}

IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".bmp", ".tif", ".tiff", ".webp"}


def compute_sha256(file_path: Path) -> str:
    h = hashlib.sha256()
    with open(file_path, "rb") as f:
        while chunk := f.read(65536):
            h.update(chunk)
    return h.hexdigest()


class DatasetValidator:
    def __init__(self, data_yaml_path: str | Path) -> None:
        self.yaml_path = Path(data_yaml_path).resolve()
        self.root_dir = self.yaml_path.parent
        self.report: dict[str, Any] = {
            "status": "pending",
            "yaml_path": str(self.yaml_path),
            "errors": [],
            "warnings": [],
            "splits": {},
            "duplicate_count": 0,
            "leakage_count": 0,
            "class_distribution": {name: 0 for name in EXPECTED_CLASSES.values()},
            "defect_free_images_count": 0,
            "total_images": 0,
            "total_labels": 0,
        }

    def validate(self) -> dict[str, Any]:
        if not self.yaml_path.exists():
            self.report["status"] = "failed"
            self.report["errors"].append(f"data.yaml does not exist: {self.yaml_path}")
            return self.report

        try:
            with open(self.yaml_path, "r", encoding="utf-8") as f:
                cfg = yaml.safe_load(f)
        except Exception as exc:
            self.report["status"] = "failed"
            self.report["errors"].append(f"Failed to parse YAML file: {exc}")
            return self.report

        # 1. Validate classes mapping
        names = cfg.get("names", {})
        if isinstance(names, list):
            names = {i: name for i, name in enumerate(names)}
        elif not isinstance(names, dict):
            self.report["errors"].append(f"Invalid 'names' entry in YAML: {type(names)}")
            names = {}

        if len(names) != len(EXPECTED_CLASSES):
            self.report["errors"].append(
                f"Class count mismatch. Expected {len(EXPECTED_CLASSES)} classes, got {len(names)}."
            )

        for idx, expected_name in EXPECTED_CLASSES.items():
            actual_name = names.get(idx) or names.get(str(idx))
            if actual_name != expected_name:
                self.report["errors"].append(
                    f"Class ID {idx} mismatch: expected '{expected_name}', got '{actual_name}'."
                )

        # 2. Resolve split paths
        raw_path = cfg.get("path", ".")
        if raw_path in (".", "", None):
            base_path = self.root_dir
        else:
            p = Path(raw_path)
            if p.is_absolute():
                base_path = p
            elif (self.root_dir / p).exists():
                base_path = (self.root_dir / p).resolve()
            elif (Path.cwd() / p).exists():
                base_path = (Path.cwd() / p).resolve()
            else:
                base_path = (self.root_dir / p).resolve()

        splits_cfg = {
            "train": cfg.get("train", "images/train"),
            "val": cfg.get("val", "images/val"),
            "test": cfg.get("test", "images/test"),
        }

        split_hashes: dict[str, dict[str, Path]] = {}

        for split_name, rel_path in splits_cfg.items():
            if not rel_path:
                continue
            split_dir = (base_path / rel_path).resolve() if not Path(rel_path).is_absolute() else Path(rel_path)
            split_info = self._validate_split(split_name, split_dir, base_path)
            self.report["splits"][split_name] = split_info
            split_hashes[split_name] = split_info.get("hashes", {})
            self.report["total_images"] += split_info.get("image_count", 0)
            self.report["total_labels"] += split_info.get("label_count", 0)
            self.report["defect_free_images_count"] += split_info.get("defect_free_count", 0)

        # 3. Detect data leakage across splits
        splits_list = list(split_hashes.keys())
        leakage_detected = []
        for i in range(len(splits_list)):
            for j in range(i + 1, len(splits_list)):
                s1, s2 = splits_list[i], splits_list[j]
                common = set(split_hashes[s1].keys()) & set(split_hashes[s2].keys())
                if common:
                    for chash in common:
                        leakage_detected.append(
                            f"Image duplicate across '{s1}' and '{s2}': {split_hashes[s1][chash].name}"
                        )

        if leakage_detected:
            self.report["leakage_count"] = len(leakage_detected)
            self.report["errors"].extend(leakage_detected)

        # 4. Final status determination
        if self.report["errors"]:
            self.report["status"] = "failed"
        elif self.report["total_images"] == 0:
            self.report["status"] = "dataset_empty"
            self.report["warnings"].append("No images found in any of the configured split directories.")
        else:
            self.report["status"] = "passed"

        return self.report

    def _validate_split(self, split_name: str, images_dir: Path, base_path: Path) -> dict[str, Any]:
        info: dict[str, Any] = {
            "split_name": split_name,
            "images_dir": str(images_dir),
            "exists": images_dir.exists(),
            "image_count": 0,
            "label_count": 0,
            "defect_free_count": 0,
            "corrupt_images": [],
            "missing_labels": [],
            "invalid_annotations": [],
            "hashes": {},
        }

        if not images_dir.exists():
            self.report["warnings"].append(f"Split directory does not exist: {images_dir}")
            return info

        # Derive labels dir
        labels_dir = images_dir.parent.parent / "labels" / images_dir.name
        if not labels_dir.exists():
            labels_dir = base_path / "labels" / images_dir.name

        images = [p for p in images_dir.iterdir() if p.is_file() and p.suffix.lower() in IMAGE_EXTENSIONS]
        info["image_count"] = len(images)

        for img_path in images:
            # Check corrupt or unreadable image
            try:
                img = cv2.imread(str(img_path))
                if img is None or img.size == 0 or img.shape[0] < 8 or img.shape[1] < 8:
                    info["corrupt_images"].append(str(img_path))
                    self.report["errors"].append(f"Corrupt or invalid image: {img_path}")
                    continue
            except Exception as exc:
                info["corrupt_images"].append(f"{img_path}: {exc}")
                self.report["errors"].append(f"Cannot decode image {img_path}: {exc}")
                continue

            # Check duplicate hash
            imghash = compute_sha256(img_path)
            info["hashes"][imghash] = img_path

            # Corresponding label file
            label_file = labels_dir / f"{img_path.stem}.txt"
            if not label_file.exists():
                info["missing_labels"].append(img_path.name)
                # An image without a label file is treated as defect-free with warning
                info["defect_free_count"] += 1
                continue

            info["label_count"] += 1
            content = label_file.read_text(encoding="utf-8").strip()
            if not content:
                info["defect_free_count"] += 1
                continue

            lines = content.splitlines()
            for line_no, line in enumerate(lines, 1):
                parts = line.strip().split()
                if len(parts) != 5:
                    msg = f"{label_file.name}:{line_no}: Expected 5 values (class x y w h), got {len(parts)}"
                    info["invalid_annotations"].append(msg)
                    self.report["errors"].append(msg)
                    continue

                try:
                    cls_id = int(parts[0])
                    coords = [float(v) for v in parts[1:]]
                except ValueError:
                    msg = f"{label_file.name}:{line_no}: Non-numeric value in annotation"
                    info["invalid_annotations"].append(msg)
                    self.report["errors"].append(msg)
                    continue

                if cls_id not in EXPECTED_CLASSES:
                    msg = f"{label_file.name}:{line_no}: Invalid class ID {cls_id}. Must be 0..8."
                    info["invalid_annotations"].append(msg)
                    self.report["errors"].append(msg)
                    continue

                # Coordinate bounds check
                x_center, y_center, w, h = coords
                if not (0.0 <= x_center <= 1.0 and 0.0 <= y_center <= 1.0 and 0.0 < w <= 1.0 and 0.0 < h <= 1.0):
                    msg = f"{label_file.name}:{line_no}: Box coordinates out of [0, 1] range: {coords}"
                    info["invalid_annotations"].append(msg)
                    self.report["errors"].append(msg)
                    continue

                # Accumulate class counts
                class_name = EXPECTED_CLASSES[cls_id]
                self.report["class_distribution"][class_name] += 1

        return info


def main() -> None:
    parser = argparse.ArgumentParser(description="SolarVision AI Dataset Validator")
    parser.add_argument("--data", default="data/dataset/data.yaml", help="Path to data.yaml")
    parser.add_argument("--json", default=None, help="Save report to JSON file")
    args = parser.parse_args()

    validator = DatasetValidator(args.data)
    report = validator.validate()

    print("=" * 60)
    print("SOLARVISION AI — DATASET VALIDATION REPORT")
    print("=" * 60)
    print(f"Status:       {report['status'].upper()}")
    print(f"Total Images: {report['total_images']}")
    print(f"Total Labels: {report['total_labels']}")
    print(f"Defect-free:  {report['defect_free_images_count']}")
    print(f"Errors:       {len(report['errors'])}")
    print(f"Warnings:     {len(report['warnings'])}")
    print("-" * 60)

    if report["splits"]:
        print("SPLIT DETAILS:")
        for sname, sinfo in report["splits"].items():
            print(f"  • {sname:5s}: {sinfo.get('image_count', 0)} images, {sinfo.get('label_count', 0)} labels")

    print("-" * 60)
    print("CLASS DISTRIBUTION:")
    for cname, count in report["class_distribution"].items():
        print(f"  • {cname:24s}: {count}")

    if report["errors"]:
        print("-" * 60)
        print("FAILURES / ERRORS:")
        for err in report["errors"][:10]:
            print(f"  [ERROR] {err}")
        if len(report["errors"]) > 10:
            print(f"  ... and {len(report['errors']) - 10} more errors.")

    if report["warnings"]:
        print("-" * 60)
        print("WARNINGS:")
        for w in report["warnings"]:
            print(f"  [WARN] {w}")

    print("=" * 60)

    if args.json:
        out_path = Path(args.json)
        out_path.parent.mkdir(parents=True, exist_ok=True)
        # Remove Path objects from report before serializing
        serializable = {
            k: (
                {sk: {ssk: ssv for ssk, ssv in sv.items() if ssk != "hashes"} for sk, sv in v.items()}
                if k == "splits"
                else v
            )
            for k, v in report.items()
        }
        out_path.write_text(json.dumps(serializable, indent=2), encoding="utf-8")
        print(f"Machine-readable report written to: {out_path}")

    sys.exit(0 if report["status"] in ("passed", "dataset_empty") else 1)


if __name__ == "__main__":
    main()
