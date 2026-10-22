# SolarVision AI — Model 1 Evaluation Report

## Status: **VALIDATION BLOCKED (DATASET UNAVAILABLE)**

> [!WARNING]
> No independent ground-truth test dataset is present in the repository.
> In strict accordance with engineering integrity principles, **no simulated or fabricated accuracy metrics are generated**.
> Metrics can only be certified against real labeled EL/NIR solar cell test images.

## Verified Checkpoint Provenance

- **Model Checkpoint**: `D:\Apps\Programs\SolarVisionAI\solarvision-ai\backend\models\best.pt`
- **Checksum (SHA-256)**: `59650dafe43c178e89af3d439b283ebf1c3e4abe6239aaa111c62afa41b7a7c6`
- **Architecture**: YOLO26n / YOLOv8n DetectionModel (2,507,310 parameters)
- **Training Epochs**: 50
- **Training Date**: 2026-09-08T07:17:05.711761+00:00
- **Original Dataset Configuration Reference**: `/content/solar_dataset/data.yaml`

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
data/dataset/images/test/
data/dataset/labels/test/
```
Then re-run evaluation:
```bash
backend/.venv/Scripts/python -m backend.evaluation.evaluate --split test
```
