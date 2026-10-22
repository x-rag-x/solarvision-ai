"""Automated data quality reporting for Model 2 root-cause telemetry."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any, Dict, List, Optional

from .schema import (
    ROOT_CAUSE_TAXONOMY,
    SENSOR_UNIT_REGISTRY,
    DataQualityAuditResult,
    ModelReadyFeatureVector,
    SensorReading,
)


class DataQualityAuditor:
    """Audits telemetry and label completeness to produce a formal quality report."""

    @staticmethod
    def audit(
        inspections: List[Dict[str, Any]],
        sensor_readings: List[SensorReading],
        model_vectors: List[ModelReadyFeatureVector],
        duplicates_count: int = 0,
        out_of_bounds_count: int = 0,
    ) -> DataQualityAuditResult:
        total_inspections = len(inspections)
        with_batch = sum(1 for i in inspections if i.get("batch_id") is not None)
        with_machine = sum(1 for i in inspections if i.get("machine_id") is not None)

        present_sensors = sorted(list(set(r.sensor_type for r in sensor_readings)))
        expected_sensors = sorted(list(SENSOR_UNIT_REGISTRY.keys()))
        missing_sensors = sorted(list(set(expected_sensors) - set(present_sensors)))

        labeled_count = sum(1 for v in model_vectors if v.label_cause is not None)
        unlabeled_count = len(model_vectors) - labeled_count

        class_dist: Dict[str, int] = {c: 0 for c in ROOT_CAUSE_TAXONOMY}
        for v in model_vectors:
            if v.label_cause and v.label_cause in class_dist:
                class_dist[v.label_cause] += 1

        blocking_reasons: List[str] = []
        if total_inspections == 0:
            blocking_reasons.append("Zero inspection records available in the manufacturing database.")
        if len(sensor_readings) == 0:
            blocking_reasons.append("Zero sensor telemetry measurements recorded in database or telemetry files.")
        if with_batch == 0 and total_inspections > 0:
            blocking_reasons.append("Inspections lack manufacturing batchId foreign keys, preventing batch-level process joins.")
        if with_machine == 0 and total_inspections > 0:
            blocking_reasons.append("Inspections lack machineId foreign keys, preventing machine-specific telemetry linking.")
        if labeled_count == 0:
            blocking_reasons.append(
                "Zero confirmed root-cause labels available. Model 1 optical defect classes cannot be treated as root causes."
            )
        if len(missing_sensors) > 0 and len(present_sensors) == 0:
            blocking_reasons.append(f"All {len(expected_sensors)} required manufacturing sensor streams are missing.")

        status = "DATASET_BLOCKED" if blocking_reasons else ("READY" if labeled_count >= 50 else "PARTIAL")

        return DataQualityAuditResult(
            total_inspections=total_inspections,
            inspections_with_batch=with_batch,
            inspections_with_machine=with_machine,
            total_sensor_readings=len(sensor_readings),
            sensor_types_present=present_sensors,
            missing_sensor_types=missing_sensors,
            confirmed_root_cause_labels_count=labeled_count,
            unlabeled_inspections_count=unlabeled_count,
            duplicate_telemetry_count=duplicates_count,
            out_of_bounds_sensor_count=out_of_bounds_count,
            class_distribution=class_dist,
            dataset_status=status,
            blocking_reasons=blocking_reasons,
        )

    @staticmethod
    def export_markdown_report(audit: DataQualityAuditResult, output_path: Path | str) -> str:
        """Renders the data quality audit into a detailed Markdown report."""
        path = Path(output_path)
        path.parent.mkdir(parents=True, exist_ok=True)

        lines: List[str] = [
            "# SolarVision AI — Model 2 Root Cause Dataset Quality Report",
            "",
            f"**Audit Status:** `{audit.dataset_status}`  ",
            f"**Total Inspections Evaluated:** `{audit.total_inspections}`  ",
            f"**Inspections Linked to Batch:** `{audit.inspections_with_batch}`  ",
            f"**Inspections Linked to Machine:** `{audit.inspections_with_machine}`  ",
            f"**Total Sensor Measurements:** `{audit.total_sensor_readings}`  ",
            f"**Confirmed Ground-Truth Root Cause Labels:** `{audit.confirmed_root_cause_labels_count}`  ",
            "",
            "---",
            "",
            "## 1. Readiness Assessment",
            "",
        ]

        if audit.dataset_status == "DATASET_BLOCKED":
            lines.extend([
                "> [!CAUTION]",
                "> **DATASET STATUS: DATASET_BLOCKED**",
                "> ",
                "> Training Model 2 on production root causes is currently blocked. The repository does not contain",
                "> confirmed ground-truth root cause labels or linked machine sensor telemetry. In accordance with",
                "> manufacturing AI principles, synthetic data must not be claimed as real production results.",
                "",
                "### Blocking Deficiencies Identified:",
            ])
            for r in audit.blocking_reasons:
                lines.append(f"- **[BLOCKER]** {r}")
            lines.append("")
        else:
            lines.extend([
                f"> [!NOTE]",
                f"> Dataset status is `{audit.dataset_status}` with `{audit.confirmed_root_cause_labels_count}` labeled instances.",
                "",
            ])

        lines.extend([
            "## 2. Sensor Telemetry Inventory",
            "",
            f"- **Sensor Streams Present:** `{len(audit.sensor_types_present)}` / `{len(SENSOR_UNIT_REGISTRY)}`",
            f"- **Out-of-Bounds Sensor Measurements:** `{audit.out_of_bounds_sensor_count}`",
            f"- **Duplicate Sensor Measurements:** `{audit.duplicate_telemetry_count}`",
            "",
            "### Missing Sensor Streams:",
        ])
        if audit.missing_sensor_types:
            for s in audit.missing_sensor_types:
                s_def = SENSOR_UNIT_REGISTRY.get(s)
                unit_str = f" ({s_def.unit})" if s_def else ""
                lines.append(f"- `{s}`{unit_str}")
        else:
            lines.append("- None (all registered sensor streams present)")

        lines.extend([
            "",
            "## 3. Ground-Truth Root Cause Class Distribution",
            "",
            "| Class Name | Count | Percentage |",
            "|---|---|---|",
        ])
        total_lbl = max(1, audit.confirmed_root_cause_labels_count)
        for c, count in audit.class_distribution.items():
            pct = (count / total_lbl) * 100.0 if audit.confirmed_root_cause_labels_count > 0 else 0.0
            lines.append(f"| `{c}` | {count} | {pct:.1f}% |")

        content = "\n".join(lines)
        path.write_text(content, encoding="utf-8")
        return content

    @staticmethod
    def export_json_report(audit: DataQualityAuditResult, output_path: Path | str) -> str:
        """Serializes the data quality audit to JSON."""
        path = Path(output_path)
        path.parent.mkdir(parents=True, exist_ok=True)
        data = {
            "total_inspections": audit.total_inspections,
            "inspections_with_batch": audit.inspections_with_batch,
            "inspections_with_machine": audit.inspections_with_machine,
            "total_sensor_readings": audit.total_sensor_readings,
            "sensor_types_present": audit.sensor_types_present,
            "missing_sensor_types": audit.missing_sensor_types,
            "confirmed_root_cause_labels_count": audit.confirmed_root_cause_labels_count,
            "unlabeled_inspections_count": audit.unlabeled_inspections_count,
            "duplicate_telemetry_count": audit.duplicate_telemetry_count,
            "out_of_bounds_sensor_count": audit.out_of_bounds_sensor_count,
            "class_distribution": audit.class_distribution,
            "dataset_status": audit.dataset_status,
            "blocking_reasons": audit.blocking_reasons,
        }
        content = json.dumps(data, indent=2)
        path.write_text(content, encoding="utf-8")
        return content
