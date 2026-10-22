"""Comprehensive evaluation runner and report generator for Model 2."""

from __future__ import annotations

from dataclasses import asdict
from datetime import datetime, timezone
import json
import logging
from pathlib import Path
from typing import Any, Dict, List, Optional
import numpy as np

from backend.root_cause_data.schema import CANONICAL_FEATURE_ORDER, ROOT_CAUSE_TAXONOMY
from backend.training.root_cause.contract import Model2ArtifactContract, ModelMetadata
from backend.training.root_cause.tree_model import RandomForestClassifier

from .calibration import CalibrationEvaluator
from .confusion_matrix import ConfusionMatrixCalculator
from .explainability import RootCauseExplainer
from .metrics import RootCauseMetricsCalculator

logger = logging.getLogger("solarvision.root_cause.evaluation")


class Model2Evaluator:
    """Evaluates a serialized Model 2 artifact against a designated test split."""

    def __init__(
        self,
        artifact_path: Path | str,
        output_dir: Optional[Path | str] = None,
    ):
        self.artifact_path = Path(artifact_path)
        self.output_dir = Path(output_dir or "backend/evaluation/root_cause/reports")
        self.output_dir.mkdir(parents=True, exist_ok=True)

        self.metadata, self.model_dict = Model2ArtifactContract.load_artifact(self.artifact_path)
        self.model = RandomForestClassifier.from_dict(self.model_dict)

        self.metrics_calc = RootCauseMetricsCalculator(ROOT_CAUSE_TAXONOMY)
        self.cm_calc = ConfusionMatrixCalculator(ROOT_CAUSE_TAXONOMY)
        self.calib_calc = CalibrationEvaluator(n_bins=10)
        self.explainer = RootCauseExplainer(self.metadata.feature_importances)

    def evaluate_test_set(
        self, test_records: List[Dict[str, Any]]
    ) -> Dict[str, Any]:
        """Runs the full evaluation suite on a test dataset."""
        if not test_records:
            return {"status": "ERROR", "message": "Test dataset is empty."}

        X_test = np.array([r["features"] for r in test_records], dtype=np.float32)
        y_test = np.array([r["label_index"] for r in test_records], dtype=np.int64)

        # Inferences
        y_pred = self.model.predict(X_test)
        y_proba = self.model.predict_proba(X_test)

        # 1. Classification metrics
        metrics = self.metrics_calc.calculate(y_test, y_pred)

        # 2. Confusion matrix
        cm_result = self.cm_calc.calculate(y_test, y_pred)

        # 3. Calibration
        calib_result = self.calib_calc.evaluate_calibration(y_test, y_proba)

        # 4. Top sample explanation
        sample_explanation = self.explainer.explain_prediction(
            predicted_cause=ROOT_CAUSE_TAXONOMY[y_pred[0]],
            feature_vector=X_test[0],
            confidence=float(np.max(y_proba[0])),
        )

        # 5. Gate checks
        passes_gate = (
            metrics.macro_f1 >= 0.70
            and calib_result["is_calibrated"]
            and not self.metadata.is_synthetic_training
        )

        report_data = {
            "evaluation_timestamp": datetime.now(timezone.utc).isoformat(),
            "model_name": self.metadata.model_name,
            "model_version": self.metadata.model_version,
            "artifact_path": str(self.artifact_path),
            "test_sample_count": len(test_records),
            "is_synthetic_dataset": self.metadata.is_synthetic_training,
            "release_gate_status": "PASSED" if passes_gate else "CONDITIONALLY_BLOCKED",
            "summary_metrics": {
                "accuracy": metrics.accuracy,
                "balanced_accuracy": metrics.balanced_accuracy,
                "macro_precision": metrics.macro_precision,
                "macro_recall": metrics.macro_recall,
                "macro_f1": metrics.macro_f1,
                "weighted_f1": metrics.weighted_f1,
                "expected_calibration_error": calib_result["expected_calibration_error_ece"],
                "brier_score": calib_result["brier_score"],
            },
            "per_class_metrics": {k: asdict(v) for k, v in metrics.per_class.items()},
            "confusion_matrix": cm_result,
            "calibration": calib_result,
            "sample_explanation": sample_explanation,
        }

        # Export report files
        report_json_path = self.output_dir / "model2_evaluation_report.json"
        report_md_path = self.output_dir / "model2_evaluation_report.md"

        report_json_path.write_text(json.dumps(report_data, indent=2), encoding="utf-8")
        self._export_markdown(report_data, cm_result, report_md_path)

        return {
            "status": "SUCCESS",
            "report_json": str(report_json_path),
            "report_markdown": str(report_md_path),
            "summary_metrics": report_data["summary_metrics"],
            "release_gate_status": report_data["release_gate_status"],
        }

    def _export_markdown(
        self, report: Dict[str, Any], cm_dict: Dict[str, Any], path: Path
    ) -> None:
        lines: List[str] = [
            "# SolarVision AI — Model 2 Root Cause Evaluation Report",
            "",
            f"**Model Name:** `{report['model_name']}`  ",
            f"**Version:** `{report['model_version']}`  ",
            f"**Evaluation Timestamp:** `{report['evaluation_timestamp']}`  ",
            f"**Release Gate Status:** `{report['release_gate_status']}`  ",
            f"**Test Sample Count:** `{report['test_sample_count']}`  ",
            "",
            "---",
            "",
            "## 1. Summary Performance Metrics",
            "",
            "| Metric | Value | Target Benchmark |",
            "|---|---:|---:|",
            f"| **Accuracy** | {report['summary_metrics']['accuracy'] * 100:.2f}% | >= 80.0% |",
            f"| **Macro F1-Score** | {report['summary_metrics']['macro_f1'] * 100:.2f}% | >= 75.0% |",
            f"| **Balanced Accuracy** | {report['summary_metrics']['balanced_accuracy'] * 100:.2f}% | >= 75.0% |",
            f"| **Expected Calibration Error (ECE)** | {report['summary_metrics']['expected_calibration_error']:.4f} | <= 0.0800 |",
            f"| **Brier Calibration Score** | {report['summary_metrics']['brier_score']:.4f} | <= 0.1500 |",
            "",
            "## 2. Per-Class Category Performance",
            "",
            "| Root Cause Class | Support | Precision | Recall | F1-Score |",
            "|---|---:|---:|---:|---:|",
        ]

        for cls_name, pcm in report["per_class_metrics"].items():
            lines.append(
                f"| `{cls_name}` | {pcm['support']} | {pcm['precision'] * 100:.1f}% | "
                f"{pcm['recall'] * 100:.1f}% | {pcm['f1_score'] * 100:.1f}% |"
            )

        lines.extend([
            "",
            "## 3. Confusion Matrix (Row Normalized %)",
            "",
            self.cm_calc.to_markdown_table(cm_dict, normalized=True),
            "",
            "## 4. Probability Calibration Assessment",
            "",
            f"- **Calibration Status:** `{report['calibration']['calibration_assessment']}`",
            f"- **Expected Calibration Error (ECE):** `{report['summary_metrics']['expected_calibration_error']}`",
            f"- **Maximum Calibration Error (MCE):** `{report['calibration']['max_calibration_error_mce']}`",
            "",
            "## 5. Diagnostic Root Cause Attribution Sample",
            "",
            f"**Predicted Cause:** `{report['sample_explanation']['predicted_cause']}` "
            f"*(Confidence: {report['sample_explanation']['confidence'] * 100:.1f}%)*  ",
            f"**Actionable Recommendation:** *{report['sample_explanation']['recommended_action']}*",
            "",
            "**Top Contributing Process Factors:**",
        ])

        for f in report["sample_explanation"]["top_contributing_factors"]:
            unit_str = f" {f['unit']}" if f["unit"] else ""
            lines.append(f"- **`{f['feature']}`**: value = `{f['measured_value']}{unit_str}` (impact score: `{f['impact_score']}`)")

        path.write_text("\n".join(lines), encoding="utf-8")
