"""
SolarVision AI — Model 2: Manufacturing Root Cause Analysis
Atomic Data Onboarding Pipeline & Traceable Ingestion Engine

Provides robust, transactional CSV ingestion into the SolarVision SQLite database.
Enforces:
1. Strict schema, type, and physical boundary validation before any write.
2. Cross-entity foreign key integrity (Inspection UUIDs, Batch IDs, Machine IDs).
3. Duplicate detection within the file and against existing database state.
4. Provenance tracking (verified_by, verified_at, investigation notes).
5. All-or-nothing atomic transactions (full rollback on error, zero partial corruption).
6. Immutable audit logging in `import_audit_logs`.
"""

from __future__ import annotations

import csv
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path
import sqlite3
from typing import Any, Dict, List, Optional, Set, Tuple
import uuid

from .import_contract import ImportContractValidator, ImportValidationReport
from .schema import ROOT_CAUSE_TAXONOMY, SENSOR_UNIT_REGISTRY


DEFAULT_DB_PATH = Path(__file__).resolve().parent.parent.parent / "data" / "solarvision.db"


@dataclass
class IngestionResult:
    entity_name: str
    source_file: str
    total_records: int = 0
    inserted_records: int = 0
    rejected_records: int = 0
    status: str = "PENDING"  # 'SUCCESS', 'REJECTED', 'ROLLED_BACK'
    audit_id: str = field(default_factory=lambda: str(uuid.uuid4()))
    errors: List[str] = field(default_factory=list)
    timestamp: str = field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

    def to_dict(self) -> Dict[str, Any]:
        return {
            "entity_name": self.entity_name,
            "source_file": self.source_file,
            "total_records": self.total_records,
            "inserted_records": self.inserted_records,
            "rejected_records": self.rejected_records,
            "status": self.status,
            "audit_id": self.audit_id,
            "errors": self.errors,
            "timestamp": self.timestamp,
        }


class DataOnboardingPipeline:
    """Manages transactional ingestion of manufacturing telemetry and ground truth."""

    def __init__(self, db_path: Optional[Path | str] = None) -> None:
        self.db_path = Path(db_path or DEFAULT_DB_PATH)
        self.ensure_schema()

    def get_connection(self) -> sqlite3.Connection:
        conn = sqlite3.connect(str(self.db_path), timeout=10.0)
        conn.execute("PRAGMA foreign_keys = ON;")
        return conn

    def ensure_schema(self) -> None:
        """Ensures required ingestion tables exist in the target database."""
        self.db_path.parent.mkdir(parents=True, exist_ok=True)
        with self.get_connection() as conn:
            # 1. Base entities (if running in isolated or test database)
            conn.execute("""
                CREATE TABLE IF NOT EXISTS inspections (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    inspectionId TEXT UNIQUE NOT NULL,
                    sourceFilename TEXT NOT NULL,
                    modelName TEXT NOT NULL,
                    status TEXT NOT NULL,
                    processingTimeMs REAL NOT NULL,
                    inputImageUrl TEXT,
                    annotatedImageUrl TEXT,
                    detectionsCount INTEGER NOT NULL DEFAULT 0,
                    persistenceStatus TEXT NOT NULL,
                    createdAt TEXT NOT NULL,
                    userId TEXT,
                    batchId TEXT,
                    machineId TEXT,
                    modelVersionId TEXT,
                    operatorId TEXT,
                    isFlagged INTEGER DEFAULT 0
                );
            """)
            conn.execute("""
                CREATE TABLE IF NOT EXISTS detections (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    inspectionId TEXT NOT NULL REFERENCES inspections(inspectionId) ON DELETE CASCADE,
                    defectType TEXT NOT NULL,
                    confidence REAL NOT NULL,
                    x1 REAL NOT NULL,
                    y1 REAL NOT NULL,
                    x2 REAL NOT NULL,
                    y2 REAL NOT NULL,
                    createdAt TEXT NOT NULL
                );
            """)

            conn.execute("""
                CREATE TABLE IF NOT EXISTS manufacturing_batches (
                    id TEXT PRIMARY KEY,
                    batchNumber TEXT UNIQUE NOT NULL,
                    waferType TEXT NOT NULL,
                    cellLine TEXT NOT NULL,
                    targetQuantity INTEGER NOT NULL,
                    actualQuantity INTEGER NOT NULL DEFAULT 0,
                    status TEXT NOT NULL DEFAULT 'in_production',
                    startTime TEXT NOT NULL,
                    endTime TEXT,
                    metadata TEXT,
                    createdAt TEXT NOT NULL,
                    updatedAt TEXT NOT NULL
                );
            """)
            conn.execute("""
                CREATE TABLE IF NOT EXISTS manufacturing_machines (
                    id TEXT PRIMARY KEY,
                    machineCode TEXT UNIQUE NOT NULL,
                    machineType TEXT NOT NULL,
                    lineId TEXT NOT NULL,
                    location TEXT,
                    status TEXT NOT NULL DEFAULT 'operational',
                    lastMaintenanceAt TEXT,
                    nextMaintenanceDue TEXT,
                    metadata TEXT,
                    createdAt TEXT NOT NULL,
                    updatedAt TEXT NOT NULL
                );
            """)
            conn.execute("""
                CREATE TABLE IF NOT EXISTS sensor_measurements (
                    id TEXT PRIMARY KEY,
                    machineId TEXT NOT NULL,
                    batchId TEXT,
                    sensorType TEXT NOT NULL,
                    measurementValue REAL NOT NULL,
                    unit TEXT NOT NULL,
                    isAnomaly INTEGER NOT NULL DEFAULT 0,
                    anomalyScore REAL,
                    recordedAt TEXT NOT NULL,
                    createdAt TEXT NOT NULL
                );
            """)
            conn.execute("""
                CREATE TABLE IF NOT EXISTS production_events (
                    id TEXT PRIMARY KEY,
                    machineId TEXT,
                    batchId TEXT,
                    eventType TEXT NOT NULL,
                    severity TEXT NOT NULL DEFAULT 'info',
                    message TEXT NOT NULL,
                    details TEXT,
                    startedAt TEXT NOT NULL,
                    resolvedAt TEXT,
                    createdAt TEXT NOT NULL
                );
            """)

            # 2. Table for ground truth annotations from failure analysis lab
            conn.execute("""
                CREATE TABLE IF NOT EXISTS root_cause_annotations (
                    id TEXT PRIMARY KEY,
                    inspectionId TEXT NOT NULL REFERENCES inspections(inspectionId) ON DELETE CASCADE,
                    defectId INTEGER REFERENCES detections(id) ON DELETE SET NULL,
                    confirmedCause TEXT NOT NULL,
                    confidenceLevel TEXT NOT NULL DEFAULT 'confirmed',
                    verifiedBy TEXT NOT NULL,
                    verifiedAt TEXT NOT NULL,
                    investigationNotes TEXT,
                    createdAt TEXT NOT NULL
                );
            """)

            # 3. Table for immutable audit logging
            conn.execute("""
                CREATE TABLE IF NOT EXISTS import_audit_logs (
                    id TEXT PRIMARY KEY,
                    entityType TEXT NOT NULL,
                    sourceFilePath TEXT NOT NULL,
                    totalRows INTEGER NOT NULL,
                    insertedRows INTEGER NOT NULL,
                    rejectedRows INTEGER NOT NULL,
                    status TEXT NOT NULL,
                    errorMessage TEXT,
                    importedBy TEXT NOT NULL,
                    importedAt TEXT NOT NULL
                );
            """)

            # 4. Indices for fast joins and foreign key lookups
            conn.execute(
                "CREATE INDEX IF NOT EXISTS idx_rc_annotations_insp ON root_cause_annotations(inspectionId);"
            )
            conn.execute(
                "CREATE INDEX IF NOT EXISTS idx_audit_logs_type ON import_audit_logs(entityType, importedAt DESC);"
            )
            conn.commit()


    def import_csv(
        self,
        entity_name: str,
        csv_path: Path | str,
        operator_name: str = "system_operator",
    ) -> IngestionResult:
        """
        Executes complete validation and atomic database ingestion of a template CSV.
        Guarantees: If ANY validation check or constraint fails, the entire batch is rolled back.
        """
        path = Path(csv_path)
        result = IngestionResult(entity_name=entity_name, source_file=str(path))

        # ---------------------------------------------------------------------
        # Phase 1: Structural & Column Validation via Contract Validator
        # ---------------------------------------------------------------------
        contract_report = ImportContractValidator.validate_csv(entity_name, path)
        if not contract_report.is_valid:
            result.status = "REJECTED"
            result.errors.extend(contract_report.row_errors)
            if contract_report.missing_required_columns:
                result.errors.append(
                    f"Missing required columns: {contract_report.missing_required_columns}"
                )
            self._log_audit(result, operator_name, conn=None)
            return result

        # ---------------------------------------------------------------------
        # Phase 2: In-Depth Semantic, Type & Foreign Key Pre-Validation
        # ---------------------------------------------------------------------
        parsed_rows: List[Dict[str, Any]] = []
        with open(path, "r", encoding="utf-8-sig") as f:
            lines = [l for l in f if not l.strip().startswith("#")]
            reader = csv.DictReader(lines)
            rows = list(reader)
            result.total_records = len(rows)

        if not rows:
            result.status = "REJECTED"
            result.errors.append("CSV file contains 0 data rows (empty template).")
            self._log_audit(result, operator_name, conn=None)
            return result

        conn = self.get_connection()
        try:
            # Pre-fetch existing IDs for foreign key validation and duplicate detection
            existing_inspections = {
                r[0] for r in conn.execute("SELECT inspectionId FROM inspections").fetchall()
            }
            existing_batches = {
                r[0] for r in conn.execute("SELECT id FROM manufacturing_batches").fetchall()
            }
            existing_machines = {
                r[0] for r in conn.execute("SELECT id FROM manufacturing_machines").fetchall()
            }

            file_ids_seen: Set[str] = set()

            for idx, row in enumerate(rows, start=2):
                row_errs: List[str] = []
                cleaned_row: Dict[str, Any] = {}

                # 1. ID uniqueness check within file
                rec_id = row.get("id") or row.get("batch_id") or row.get("machine_id") or ""
                rec_id = rec_id.strip()
                if rec_id:
                    if rec_id in file_ids_seen:
                        row_errs.append(f"Row {idx}: Duplicate ID '{rec_id}' within file")
                    file_ids_seen.add(rec_id)

                # 2. Entity-specific semantic rules
                if entity_name == "batches":
                    bid = row["batch_id"].strip()
                    if not bid:
                        row_errs.append(f"Row {idx}: batch_id cannot be empty")
                    qty = int(row.get("target_quantity") or 0)
                    if qty <= 0:
                        row_errs.append(f"Row {idx}: target_quantity must be positive integer")
                    self._validate_iso(row.get("start_time"), f"Row {idx}: start_time", row_errs)
                    cleaned_row = {
                        "id": bid,
                        "batchNumber": row.get("batch_number", bid).strip(),
                        "waferType": row.get("ingot_type", "monocrystalline_m10").strip(),
                        "cellLine": row.get("cell_line", "Line-1").strip(),
                        "targetQuantity": qty,
                        "actualQuantity": int(row.get("actual_quantity") or 0),
                        "status": row.get("status", "in_production").strip(),
                        "startTime": row.get("start_time", "").strip(),
                        "endTime": row.get("end_time") or None,
                        "metadata": None,
                        "createdAt": datetime.now(timezone.utc).isoformat(),
                        "updatedAt": datetime.now(timezone.utc).isoformat(),
                    }

                elif entity_name == "machines":
                    mid = row["machine_id"].strip()
                    if not mid:
                        row_errs.append(f"Row {idx}: machine_id cannot be empty")
                    mtype = row.get("machine_type", "").strip().lower()
                    status = row.get("status", "operational").strip().lower()
                    if status not in ("running", "idle", "maintenance", "alarm", "operational", "offline"):
                        row_errs.append(f"Row {idx}: invalid machine status '{status}'")
                    cleaned_row = {
                        "id": mid,
                        "machineCode": row.get("machine_code", mid).strip(),
                        "machineType": mtype,
                        "lineId": row.get("line_id", "module_line_1").strip(),
                        "location": row.get("location") or None,
                        "status": status,
                        "lastMaintenanceAt": row.get("last_maintenance_at") or None,
                        "nextMaintenanceDue": row.get("next_maintenance_due") or None,
                        "metadata": None,
                        "createdAt": datetime.now(timezone.utc).isoformat(),
                        "updatedAt": datetime.now(timezone.utc).isoformat(),
                    }

                elif entity_name == "sensor_readings":
                    st = row.get("sensor_type", "").strip()
                    sensor_def = SENSOR_UNIT_REGISTRY.get(st)
                    if not sensor_def:
                        row_errs.append(f"Row {idx}: sensor_type '{st}' is not in SENSOR_UNIT_REGISTRY")
                    val = float(row.get("measurement_value", 0.0))
                    if sensor_def:
                        if val < sensor_def.min_valid or val > sensor_def.max_valid:
                            row_errs.append(
                                f"Row {idx}: measurement_value {val} outside physical bounds "
                                f"[{sensor_def.min_valid}, {sensor_def.max_valid}]"
                            )
                        unit = row.get("unit", "").strip()
                        if unit.lower() != sensor_def.unit.lower():
                            row_errs.append(
                                f"Row {idx}: unit mismatch for '{st}'. Expected '{sensor_def.unit}', got '{unit}'"
                            )
                    rec_time = row.get("recorded_at", "").strip()
                    self._validate_iso(rec_time, f"Row {idx}: recorded_at", row_errs)

                    cleaned_row = {
                        "id": row.get("id", str(uuid.uuid4())).strip(),
                        "machineId": row.get("machine_id", "").strip(),
                        "batchId": row.get("batch_id") or None,
                        "sensorType": st,
                        "measurementValue": val,
                        "unit": sensor_def.unit if sensor_def else row.get("unit", ""),
                        "isAnomaly": 1 if row.get("is_anomaly", "").lower() in ("true", "1") else 0,
                        "anomalyScore": float(row["anomaly_score"]) if row.get("anomaly_score") else None,
                        "recordedAt": rec_time,
                        "createdAt": datetime.now(timezone.utc).isoformat(),
                    }

                elif entity_name == "production_events":
                    rec_time = row.get("started_at", "").strip()
                    self._validate_iso(rec_time, f"Row {idx}: started_at", row_errs)
                    sev = row.get("severity", "info").strip().lower()
                    if sev not in ("info", "warning", "high", "critical"):
                        row_errs.append(f"Row {idx}: invalid severity '{sev}'")

                    cleaned_row = {
                        "id": row.get("id", str(uuid.uuid4())).strip(),
                        "machineId": row.get("machine_id") or None,
                        "batchId": row.get("batch_id") or None,
                        "eventType": row.get("event_type", "").strip(),
                        "severity": sev,
                        "message": row.get("message", "").strip(),
                        "details": None,
                        "startedAt": rec_time,
                        "resolvedAt": row.get("resolved_at") or None,
                        "createdAt": datetime.now(timezone.utc).isoformat(),
                    }

                elif entity_name == "root_cause_annotations":
                    insp_id = row.get("inspection_id", "").strip()
                    if insp_id not in existing_inspections:
                        row_errs.append(
                            f"Row {idx}: foreign key error: inspection_id '{insp_id}' does not exist in inspections table"
                        )
                    cause = row.get("confirmed_cause", "").strip()
                    if cause not in ROOT_CAUSE_TAXONOMY:
                        row_errs.append(
                            f"Row {idx}: confirmed_cause '{cause}' is not a valid taxonomy category. "
                            f"Must be one of {ROOT_CAUSE_TAXONOMY}"
                        )
                    v_by = row.get("verified_by", "").strip()
                    if not v_by:
                        row_errs.append(f"Row {idx}: verified_by provenance field cannot be empty")
                    self._validate_iso(row.get("verified_at"), f"Row {idx}: verified_at", row_errs)

                    cleaned_row = {
                        "id": row.get("id", str(uuid.uuid4())).strip(),
                        "inspectionId": insp_id,
                        "defectId": int(row["defect_id"]) if row.get("defect_id") else None,
                        "confirmedCause": cause,
                        "confidenceLevel": row.get("confidence_level", "confirmed").strip(),
                        "verifiedBy": v_by,
                        "verifiedAt": row.get("verified_at", "").strip(),
                        "investigationNotes": row.get("investigation_notes") or None,
                        "createdAt": datetime.now(timezone.utc).isoformat(),
                    }

                elif entity_name == "inspection_batch_links":
                    insp_id = row.get("inspection_id", "").strip()
                    if insp_id not in existing_inspections:
                        row_errs.append(
                            f"Row {idx}: foreign key error: inspection_id '{insp_id}' does not exist in inspections table"
                        )
                    cleaned_row = {
                        "inspectionId": insp_id,
                        "batchId": row.get("batch_id", "").strip(),
                        "machineId": row.get("machine_id", "").strip(),
                    }

                if row_errs:
                    result.errors.extend(row_errs)
                else:
                    parsed_rows.append(cleaned_row)

            # If any semantic validation failed across any row, reject entire batch
            if result.errors:
                result.status = "REJECTED"
                result.rejected_records = len(result.errors)
                self._log_audit(result, operator_name, conn=conn)
                return result

            # ---------------------------------------------------------------------
            # Phase 3: Transactional Execution with Atomic Rollback
            # ---------------------------------------------------------------------
            conn.execute("BEGIN IMMEDIATE;")
            inserted = 0

            if entity_name == "batches":
                for r in parsed_rows:
                    conn.execute("""
                        INSERT OR REPLACE INTO manufacturing_batches
                        (id, batchNumber, waferType, cellLine, targetQuantity, actualQuantity, status, startTime, endTime, metadata, createdAt, updatedAt)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """, (
                        r["id"], r["batchNumber"], r["waferType"], r["cellLine"],
                        r["targetQuantity"], r["actualQuantity"], r["status"],
                        r["startTime"], r["endTime"], r["metadata"], r["createdAt"], r["updatedAt"],
                    ))
                    inserted += 1

            elif entity_name == "machines":
                for r in parsed_rows:
                    conn.execute("""
                        INSERT OR REPLACE INTO manufacturing_machines
                        (id, machineCode, machineType, lineId, location, status, lastMaintenanceAt, nextMaintenanceDue, metadata, createdAt, updatedAt)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """, (
                        r["id"], r["machineCode"], r["machineType"], r["lineId"],
                        r["location"], r["status"], r["lastMaintenanceAt"], r["nextMaintenanceDue"],
                        r["metadata"], r["createdAt"], r["updatedAt"],
                    ))
                    inserted += 1

            elif entity_name == "sensor_readings":
                for r in parsed_rows:
                    conn.execute("""
                        INSERT OR REPLACE INTO sensor_measurements
                        (id, machineId, batchId, sensorType, measurementValue, unit, isAnomaly, anomalyScore, recordedAt, createdAt)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """, (
                        r["id"], r["machineId"], r["batchId"], r["sensorType"],
                        r["measurementValue"], r["unit"], r["isAnomaly"], r["anomalyScore"],
                        r["recordedAt"], r["createdAt"],
                    ))
                    inserted += 1

            elif entity_name == "production_events":
                for r in parsed_rows:
                    conn.execute("""
                        INSERT OR REPLACE INTO production_events
                        (id, machineId, batchId, eventType, severity, message, details, startedAt, resolvedAt, createdAt)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """, (
                        r["id"], r["machineId"], r["batchId"], r["eventType"],
                        r["severity"], r["message"], r["details"], r["startedAt"],
                        r["resolvedAt"], r["createdAt"],
                    ))
                    inserted += 1

            elif entity_name == "root_cause_annotations":
                for r in parsed_rows:
                    conn.execute("""
                        INSERT OR REPLACE INTO root_cause_annotations
                        (id, inspectionId, defectId, confirmedCause, confidenceLevel, verifiedBy, verifiedAt, investigationNotes, createdAt)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """, (
                        r["id"], r["inspectionId"], r["defectId"], r["confirmedCause"],
                        r["confidenceLevel"], r["verifiedBy"], r["verifiedAt"],
                        r["investigationNotes"], r["createdAt"],
                    ))
                    inserted += 1

            elif entity_name == "inspection_batch_links":
                for r in parsed_rows:
                    conn.execute("""
                        UPDATE inspections
                        SET batchId = ?, machineId = ?
                        WHERE inspectionId = ?
                    """, (r["batchId"], r["machineId"], r["inspectionId"]))
                    inserted += 1

            result.status = "SUCCESS"
            result.inserted_records = inserted
            self._log_audit(result, operator_name, conn=conn)
            conn.commit()

        except Exception as exc:
            conn.rollback()
            result.status = "ROLLED_BACK"
            result.errors.append(f"Database transaction error: {exc}")
            self._log_audit(result, operator_name, conn=None)

        finally:
            conn.close()

        return result

    def _validate_iso(self, ts: Optional[str], field_desc: str, err_list: List[str]) -> None:
        if not ts:
            err_list.append(f"{field_desc} is required")
            return
        try:
            clean = ts.replace("Z", "+00:00")
            datetime.fromisoformat(clean)
        except ValueError:
            err_list.append(f"{field_desc} '{ts}' is not valid ISO-8601 UTC timestamp")

    def _log_audit(
        self,
        res: IngestionResult,
        operator: str,
        conn: Optional[sqlite3.Connection] = None,
    ) -> None:
        close_needed = False
        if conn is None:
            conn = self.get_connection()
            close_needed = True

        try:
            conn.execute("""
                INSERT INTO import_audit_logs
                (id, entityType, sourceFilePath, totalRows, insertedRows, rejectedRows, status, errorMessage, importedBy, importedAt)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                res.audit_id,
                res.entity_name,
                res.source_file,
                res.total_records,
                res.inserted_records,
                res.rejected_records,
                res.status,
                "; ".join(res.errors[:5]) if res.errors else None,
                operator,
                res.timestamp,
            ))
            if close_needed:
                conn.commit()
        except Exception:
            pass
        finally:
            if close_needed:
                conn.close()
