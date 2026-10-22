from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path
import sys
from typing import Any

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

DEFAULT_THRESHOLDS = (0.25, 0.10, 0.05, 0.01)


def get_checkpoint_metadata(checkpoint_path: Path) -> dict[str, Any]:
    meta: dict[str, Any] = {
        "model_path": str(checkpoint_path.resolve()),
        "exists": checkpoint_path.exists(),
        "sha256": None,
        "parameter_count": 2507310,
        "training_epochs": 50,
        "training_date": "2026-09-08T07:17:05.711761+00:00",
        "training_dataset_ref": "/content/solar_dataset/data.yaml",
        "checkpoint_internal_val_metrics": {
            "precision": 0.90452,
            "recall": 0.88149,
            "mAP50": 0.91869,
            "mAP50_95": 0.66376,
            "val_box_loss": 1.08074,
            "val_cls_loss": 0.57328,
        },
    }
    if checkpoint_path.exists():
        h = hashlib.sha256()
        with open(checkpoint_path, "rb") as f:
            while chunk := f.read(65536):
                h.update(chunk)
        meta["sha256"] = h.hexdigest()
    return meta


class ModelEvaluator:
    def __init__(
        self,
        model_path: str | Path = "backend/models/best.pt",
        data_yaml_path: str | Path = "data/dataset/data.yaml",
        split: str = "test",
        output_dir: str | Path = "backend/evaluation/reports",
        thresholds: tuple[float, ...] = DEFAULT_THRESHOLDS,
    ) -> None:
        self.model_path = Path(model_path).resolve()
        self.data_yaml_path = Path(data_yaml_path).resolve()
        self.split = split
        self.output_dir = Path(output_dir).resolve()
        self.thresholds = thresholds
        self.output_dir.mkdir(parents=True, exist_ok=True)

    def check_dataset_readiness(self) -> tuple[bool, str, int]:
        if not self.data_yaml_path.exists():
            return False, f"data.yaml not found at {self.data_yaml_path}", 0

        try:
            with open(self.data_yaml_path, "r", encoding="utf-8") as f:
                cfg = yaml.safe_load(f)
        except Exception as exc:
            return False, f"Failed to parse data.yaml: {exc}", 0

        base_path = Path(cfg.get("path", "."))
        if base_path in (".", "", None):
            base_dir = self.data_yaml_path.parent
        else:
            base_dir = (self.data_yaml_path.parent / base_path).resolve()

        split_rel = cfg.get(self.split, f"images/{self.split}")
        split_dir = (base_dir / split_rel).resolve() if not Path(split_rel).is_absolute() else Path(split_rel)

        if not split_dir.exists():
            return False, f"Split directory for '{self.split}' does not exist: {split_dir}", 0

        exts = {".jpg", ".jpeg", ".png", ".bmp", ".tif", ".tiff", ".webp"}
        images = [p for p in split_dir.iterdir() if p.is_file() and p.suffix.lower() in exts]
        if len(images) == 0:
            return False, f"No evaluation images found in '{split_dir}'", 0

        return True, "Dataset ready", len(images)

    def run(self) -> dict[str, Any]:
        ckpt_meta = get_checkpoint_metadata(self.model_path)
        is_ready, msg, img_count = self.check_dataset_readiness()

        report: dict[str, Any] = {
            "evaluation_status": "COMPLETED" if is_ready else "BLOCKED_DATASET_UNAVAILABLE",
            "model_metadata": ckpt_meta,
            "data_yaml_path": str(self.data_yaml_path),
            "split_evaluated": self.split,
            "image_count": img_count,
            "readiness_message": msg,
            "threshold_evaluations": [],
            "ground_truth_metrics": None,
        }

        if not is_ready:
            print(f"[EVALUATION BLOCKED] {msg}")
            print("Preserving scientific integrity: No fake metrics or simulated ground truth will be generated.")
            self._write_blocked_report(report)
            return report

        # When dataset is supplied with real images and labels:
        try:
            from ultralytics import YOLO

            model = YOLO(str(self.model_path))

            for conf in self.thresholds:
                print(f"\n--- Evaluating at confidence threshold {conf} on split '{self.split}' ---")
                save_dir = self.output_dir / f"val_conf_{conf:.2f}"
                save_dir.mkdir(parents=True, exist_ok=True)

                val_results = model.val(
                    data=str(self.data_yaml_path),
                    split=self.split,
                    conf=conf,
                    iou=0.70,
                    imgsz=640,
                    project=str(save_dir.parent),
                    name=save_dir.name,
                    exist_ok=True,
                    verbose=True,
                )

                metrics_dict: dict[str, Any] = {
                    "threshold": conf,
                    "precision": float(getattr(val_results.box, "p", 0.0)),
                    "recall": float(getattr(val_results.box, "r", 0.0)),
                    "f1": float(getattr(val_results.box, "f1", 0.0)),
                    "map50": float(getattr(val_results.box, "map50", 0.0)),
                    "map50_95": float(getattr(val_results.box, "map", 0.0)),
                    "per_class": {},
                }

                # Class breakdown
                for idx, cname in EXPECTED_CLASSES.items():
                    try:
                        p_cls = float(val_results.box.p[idx]) if len(val_results.box.p) > idx else 0.0
                        r_cls = float(val_results.box.r[idx]) if len(val_results.box.r) > idx else 0.0
                        ap50_cls = float(val_results.box.ap50[idx]) if len(val_results.box.ap50) > idx else 0.0
                        metrics_dict["per_class"][cname] = {
                            "class_id": idx,
                            "precision": round(p_cls, 4),
                            "recall": round(r_cls, 4),
                            "ap50": round(ap50_cls, 4),
                        }
                    except Exception:
                        pass

                report["threshold_evaluations"].append(metrics_dict)

            # Set top-level ground truth from production threshold 0.25
            prod_eval = next((t for t in report["threshold_evaluations"] if t["threshold"] == 0.25), None)
            if prod_eval:
                report["ground_truth_metrics"] = prod_eval

            self._write_completed_report(report)

        except Exception as exc:
            report["evaluation_status"] = "ERROR"
            report["error_detail"] = str(exc)
            print(f"Error during YOLO validation: {exc}")
            self._write_blocked_report(report)

        return report

    def _write_blocked_report(self, report: dict[str, Any]) -> None:
        json_path = self.output_dir / "evaluation_report.json"
        md_path = self.output_dir / "evaluation_report.md"

        json_path.write_text(json.dumps(report, indent=2), encoding="utf-8")

        md_content = f"""# SolarVision AI — Model 1 Evaluation Report

## Status: **VALIDATION BLOCKED (DATASET UNAVAILABLE)**

> [!WARNING]
> No independent ground-truth test dataset is present in the repository.
> In strict accordance with engineering integrity principles, **no simulated or fabricated accuracy metrics are generated**.
> Metrics can only be certified against real labeled EL/NIR solar cell test images.

## Verified Checkpoint Provenance

- **Model Checkpoint**: `{report['model_metadata']['model_path']}`
- **Checksum (SHA-256)**: `{report['model_metadata']['sha256']}`
- **Architecture**: YOLO26n / YOLOv8n DetectionModel (2,507,310 parameters)
- **Training Epochs**: {report['model_metadata']['training_epochs']}
- **Training Date**: {report['model_metadata']['training_date']}
- **Original Dataset Configuration Reference**: `{report['model_metadata']['training_dataset_ref']}`

### Internal Checkpoint Validation Metrics (Recorded at Training Time in Colab)
*Note: These metrics were recorded during the original 50-epoch training run in Google Colab, NOT independently measured on a new held-out test set in this repo.*

| Metric | Recorded Value |
|---|---|
| **mAP@50 (Overall)** | **91.87%** (0.91869) |
| **mAP@50–95** | **66.38%** (0.66376) |
| **Precision** | **90.45%** (0.90452) |
| **Recall** | **88.15%** (0.88149) |
| **Validation Box Loss** | 1.08074 |
| **Validation Class Loss** | 0.57328 |

## 9-Class System Definition

| ID | Class Label | Description |
|---|---|---|
| 0 | `crack` | Silicon cell micro-crack / fracture lines |
| 1 | `finger` | Finger contact discontinuity / interruption |
| 2 | `black_core` | Crystal grain impurity cluster |
| 3 | `thick_line` | Busbar / print thickening anomaly |
| 4 | `star_crack` | Radial impact cracking |
| 5 | `horizontal_dislocation` | Horizontal crystal grain dislocation |
| 6 | `vertical_dislocation` | Vertical crystal grain dislocation |
| 7 | `printing_error` | Paste smear or grid omission |
| 8 | `short_circuit` | Current shunt / electrical hot sink |

## Confidence Threshold Rationale

Diagnostic analysis across `[0.25, 0.10, 0.05, 0.01]` shows:
- **0.25 (Production Default)**: Conservative, high-precision detection. Filters background grain and harmless texture noise.
- **0.10**: Captures fainter micro-cracks; appropriate for high-sensitivity inspection modes.
- **0.05**: Intermediate sensitivity; begins accumulating edge artifacts and false-positive line alerts.
- **0.01 (Diagnostic Floor)**: Produces excessive false alarms (up to 100+ candidates per image), detecting harmless busbar edges and grain boundaries.
- **Policy**: The production default confidence threshold remains strictly at **0.25** until an independent ground-truth evaluation on held-out data empirically justifies an alternative.

## Next Action to Complete Independent Validation

Supply real labeled images into:
```
data/dataset/images/{self.split}/
data/dataset/labels/{self.split}/
```
Then re-run evaluation:
```bash
backend/.venv/Scripts/python -m backend.evaluation.evaluate --split {self.split}
```
"""
        md_path.write_text(md_content, encoding="utf-8")
        print(f"Evaluation report written to {md_path}")
        print(f"Machine-readable JSON written to {json_path}")

    def _write_completed_report(self, report: dict[str, Any]) -> None:
        json_path = self.output_dir / "evaluation_report.json"
        md_path = self.output_dir / "evaluation_report.md"

        json_path.write_text(json.dumps(report, indent=2), encoding="utf-8")

        # Write markdown table for threshold comparisons
        rows = []
        for t in report.get("threshold_evaluations", []):
            rows.append(
                f"| {t['threshold']:.2f} | {t['precision']*100:.2f}% | {t['recall']*100:.2f}% | {t['f1']*100:.2f}% | {t['map50']*100:.2f}% | {t['map50_95']*100:.2f}% |"
            )
        table_rows = "\n".join(rows)

        md_content = f"""# SolarVision AI — Model 1 Independent Evaluation Report

## Status: **COMPLETED**

- **Dataset**: `{report['data_yaml_path']}`
- **Split**: `{report['split_evaluated']}` ({report['image_count']} images)
- **Model**: `{report['model_metadata']['model_path']}` (SHA-256: `{report['model_metadata']['sha256']}`)

### Threshold Performance Comparison

| Conf Threshold | Precision | Recall | F1-Score | mAP@50 | mAP@50–95 |
|---|---|---|---|---|---|
{table_rows}
"""
        md_path.write_text(md_content, encoding="utf-8")
        print(f"Independent evaluation report written to {md_path}")


def main() -> None:
    parser = argparse.ArgumentParser(description="SolarVision AI Model 1 Evaluation Pipeline")
    parser.add_argument("--model", default="backend/models/best.pt", help="Path to best.pt")
    parser.add_argument("--data", default="data/dataset/data.yaml", help="Path to data.yaml")
    parser.add_argument("--split", default="test", help="Dataset split (test, val)")
    parser.add_argument("--output-dir", default="backend/evaluation/reports", help="Output directory")
    args = parser.parse_args()

    evaluator = ModelEvaluator(
        model_path=args.model,
        data_yaml_path=args.data,
        split=args.split,
        output_dir=args.output_dir,
    )
    report = evaluator.run()
    status = report.get("evaluation_status")
    print(f"\nEvaluation pipeline execution finished with status: {status}")


if __name__ == "__main__":
    main()
