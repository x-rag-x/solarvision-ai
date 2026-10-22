"""Confusion matrix calculation and error pair analysis for root cause predictions."""

from __future__ import annotations

from typing import Any, Dict, List, Optional, Tuple
import numpy as np

from backend.root_cause_data.schema import ROOT_CAUSE_TAXONOMY


class ConfusionMatrixCalculator:
    """Computes raw and row-normalized confusion matrices and pinpoints major misclassification pairs."""

    def __init__(self, class_names: Optional[List[str]] = None):
        self.class_names = class_names or list(ROOT_CAUSE_TAXONOMY)
        self.num_classes = len(self.class_names)

    def calculate(
        self, y_true: np.ndarray, y_pred: np.ndarray
    ) -> Dict[str, Any]:
        y_true = np.asarray(y_true, dtype=np.int64)
        y_pred = np.asarray(y_pred, dtype=np.int64)

        cm = np.zeros((self.num_classes, self.num_classes), dtype=np.int32)
        for t, p in zip(y_true, y_pred):
            if 0 <= t < self.num_classes and 0 <= p < self.num_classes:
                cm[t, p] += 1

        # Normalized by row (true class support)
        row_sums = cm.sum(axis=1, keepdims=True)
        cm_norm = np.divide(
            cm.astype(np.float32),
            row_sums,
            out=np.zeros_like(cm, dtype=np.float32),
            where=row_sums > 0,
        )

        # Identify top off-diagonal confusion pairs
        confusing_pairs: List[Dict[str, Any]] = []
        for i in range(self.num_classes):
            for j in range(self.num_classes):
                if i != j and cm[i, j] > 0:
                    confusing_pairs.append({
                        "true_class": self.class_names[i],
                        "predicted_class": self.class_names[j],
                        "error_count": int(cm[i, j]),
                        "normalized_rate": round(float(cm_norm[i, j]), 4),
                    })

        confusing_pairs.sort(key=lambda x: x["error_count"], reverse=True)

        return {
            "class_names": self.class_names,
            "raw_matrix": cm.tolist(),
            "normalized_matrix": [[round(float(v), 4) for v in row] for row in cm_norm],
            "top_confusion_pairs": confusing_pairs[:10],
        }

    def to_markdown_table(self, cm_dict: Dict[str, Any], normalized: bool = True) -> str:
        """Renders the matrix into a clean GitHub-style Markdown table."""
        matrix = cm_dict["normalized_matrix"] if normalized else cm_dict["raw_matrix"]
        names = cm_dict["class_names"]

        # Header
        lines = [
            "| Actual \\ Predicted | " + " | ".join(f"`{n[:12]}`" for n in names) + " |",
            "|---|" + "|".join("---:" for _ in names) + "|",
        ]

        for i, row in enumerate(matrix):
            row_str = " | ".join(f"{v:.2f}" if normalized else str(v) for v in row)
            lines.append(f"| `{names[i][:18]}` | {row_str} |")

        return "\n".join(lines)
