"""
SolarVision AI — Model 2: Manufacturing Root Cause Analysis
Data Import Contract & Schema Template Verification Engine

Validates incoming factory CSV files against formal Model 2 schemas.
Enforces required column presence, data types, physical constraints,
and confirmed root-cause taxonomy matching.
"""

from __future__ import annotations

import csv
from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional, Set, Tuple

from .schema import ROOT_CAUSE_TAXONOMY, SENSOR_UNIT_REGISTRY


TEMPLATES_DIR = Path(__file__).resolve().parent / "templates"


@dataclass
class ImportValidationReport:
    template_name: str
    file_path: str
    total_rows: int = 0
    valid_rows: int = 0
    invalid_rows: int = 0
    missing_required_columns: List[str] = field(default_factory=list)
    unexpected_columns: List[str] = field(default_factory=list)
    row_errors: List[str] = field(default_factory=list)
    is_valid: bool = False


class ImportContractValidator:
    """Validates external factory data files against official import templates."""

    REQUIRED_COLUMNS: Dict[str, List[str]] = {
        "batches": [
            "batch_id", "batch_number", "cell_line", "target_quantity", "start_time", "status",
        ],
        "machines": [
            "machine_id", "machine_code", "machine_type", "line_id", "status",
        ],
        "sensor_readings": [
            "id", "machine_id", "sensor_type", "measurement_value", "unit", "recorded_at",
        ],
        "production_events": [
            "id", "machine_id", "event_type", "severity", "message", "started_at",
        ],
        "root_cause_annotations": [
            "id", "inspection_id", "confirmed_cause", "confidence_level", "verified_by", "verified_at",
        ],
        "inspection_batch_links": [
            "inspection_id", "batch_id", "machine_id", "recorded_at",
        ],
    }

    ALL_COLUMNS: Dict[str, List[str]] = {
        "batches": [
            "batch_id", "batch_number", "wafer_supplier", "ingot_type", "cell_line",
            "target_quantity", "actual_quantity", "start_time", "end_time", "status",
        ],
        "machines": [
            "machine_id", "machine_code", "machine_type", "line_id", "location",
            "status", "last_maintenance_at", "next_maintenance_due",
        ],
        "sensor_readings": [
            "id", "machine_id", "batch_id", "sensor_type", "measurement_value", "unit",
            "is_anomaly", "anomaly_score", "recorded_at",
        ],
        "production_events": [
            "id", "machine_id", "batch_id", "event_type", "severity", "message",
            "started_at", "resolved_at",
        ],
        "root_cause_annotations": [
            "id", "inspection_id", "defect_id", "confirmed_cause", "confidence_level",
            "verified_by", "verified_at", "investigation_notes",
        ],
        "inspection_batch_links": [
            "inspection_id", "batch_id", "machine_id", "wafer_position", "recorded_at",
        ],
    }

    @classmethod
    def get_template_path(cls, entity_name: str) -> Path:
        filename = f"{entity_name}_template.csv"
        return TEMPLATES_DIR / filename

    @classmethod
    def validate_csv(cls, entity_name: str, csv_path: Path | str) -> ImportValidationReport:
        path = Path(csv_path)
        report = ImportValidationReport(template_name=entity_name, file_path=str(path))

        if not path.exists():
            report.row_errors.append(f"File not found: {path}")
            return report

        req_cols = cls.REQUIRED_COLUMNS.get(entity_name)
        if not req_cols:
            report.row_errors.append(f"Unknown entity type '{entity_name}'")
            return report

        all_cols = set(cls.ALL_COLUMNS.get(entity_name, []))

        with open(path, "r", encoding="utf-8-sig") as f:
            lines = [l for l in f if not l.strip().startswith("#")]
            if not lines:
                report.row_errors.append("File is empty or contains only comments")
                return report

            reader = csv.DictReader(lines)
            if reader.fieldnames is None:
                report.row_errors.append("CSV has no header line")
                return report

            fieldnames = [fn.strip() for fn in reader.fieldnames]
            missing_req = [c for c in req_cols if c not in fieldnames]
            if missing_req:
                report.missing_required_columns = missing_req

            unexpected = [c for c in fieldnames if c not in all_cols]
            if unexpected:
                report.unexpected_columns = unexpected

            row_num = 1
            for row in reader:
                row_num += 1
                report.total_rows += 1
                row_errs: List[str] = []

                # Verify required fields non-empty
                for req in req_cols:
                    val = row.get(req, "").strip()
                    if not val:
                        row_errs.append(f"Row {row_num}: missing required field '{req}'")

                # Entity-specific validation
                if entity_name == "sensor_readings":
                    st = row.get("sensor_type", "").strip()
                    if st and st not in SENSOR_UNIT_REGISTRY:
                        row_errs.append(f"Row {row_num}: unknown sensor_type '{st}'")
                    val_str = row.get("measurement_value", "").strip()
                    if val_str:
                        try:
                            float(val_str)
                        except ValueError:
                            row_errs.append(f"Row {row_num}: measurement_value '{val_str}' is not a float")

                elif entity_name == "root_cause_annotations":
                    cause = row.get("confirmed_cause", "").strip()
                    if cause and cause not in ROOT_CAUSE_TAXONOMY:
                        row_errs.append(
                            f"Row {row_num}: confirmed_cause '{cause}' is not in confirmed taxonomy"
                        )

                if row_errs:
                    report.invalid_rows += 1
                    if len(report.row_errors) < 20:
                        report.row_errors.extend(row_errs)
                else:
                    report.valid_rows += 1

        report.is_valid = (
            len(report.missing_required_columns) == 0 and report.invalid_rows == 0
        )
        return report
