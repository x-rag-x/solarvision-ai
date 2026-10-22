"""Multi-source ingestion engine for manufacturing telemetry and inspection records."""

from __future__ import annotations

import csv
from datetime import datetime, timezone
import json
import logging
from pathlib import Path
import sqlite3
from typing import Any, Dict, List, Optional, Tuple

from .schema import (
    JoinedInspectionRecord,
    MachineRecord,
    ManufacturingBatchRecord,
    ProductionEventRecord,
    RootCauseGroundTruth,
    SensorReading,
)

logger = logging.getLogger("solarvision.root_cause.ingestion")


class TelemetryIngestionEngine:
    """Ingests data from the application database, external CSV/JSON files, or data streams."""

    def __init__(self, db_path: Optional[Path | str] = None):
        self.db_path = Path(db_path or "data/solarvision.db")

    def inspect_database_inventory(self) -> Dict[str, Any]:
        """Audits existing records in the SQLite database to check feature/label feasibility."""
        if not self.db_path.exists():
            return {
                "db_exists": False,
                "path": str(self.db_path),
                "tables": {},
            }

        inventory: Dict[str, Any] = {"db_exists": True, "path": str(self.db_path), "tables": {}}
        try:
            with sqlite3.connect(self.db_path) as conn:
                cursor = conn.cursor()
                tables = [
                    r[0]
                    for r in cursor.execute(
                        "SELECT name FROM sqlite_master WHERE type='table'"
                    ).fetchall()
                ]

                for table in tables:
                    try:
                        count = cursor.execute(f"SELECT COUNT(*) FROM {table}").fetchone()[0]
                        inventory["tables"][table] = count
                    except Exception as e:
                        inventory["tables"][table] = f"Error: {e}"

                # Detailed check on inspections
                cursor.execute("SELECT COUNT(*) FROM inspections WHERE batchId IS NOT NULL")
                inventory["inspections_with_batchId"] = cursor.fetchone()[0]

                cursor.execute("SELECT COUNT(*) FROM inspections WHERE machineId IS NOT NULL")
                inventory["inspections_with_machineId"] = cursor.fetchone()[0]

        except Exception as exc:
            logger.error("Failed to query database inventory at %s: %s", self.db_path, exc)
            inventory["error"] = str(exc)

        return inventory

    def load_sensor_readings_from_db(
        self,
        since: Optional[datetime] = None,
        until: Optional[datetime] = None,
    ) -> List[SensorReading]:
        """Loads sensor measurements from the local SQLite database."""
        if not self.db_path.exists():
            return []

        readings: List[SensorReading] = []
        try:
            with sqlite3.connect(self.db_path) as conn:
                cursor = conn.cursor()
                query = "SELECT id, machineId, batchId, sensorType, measurementValue, unit, isAnomaly, anomalyScore, recordedAt FROM sensor_measurements"
                params: List[Any] = []
                clauses: List[str] = []

                if since:
                    clauses.append("recordedAt >= ?")
                    params.append(since.isoformat())
                if until:
                    clauses.append("recordedAt <= ?")
                    params.append(until.isoformat())

                if clauses:
                    query += " WHERE " + " AND ".join(clauses)
                query += " ORDER BY recordedAt ASC"

                for row in cursor.execute(query, params):
                    try:
                        rec_time = datetime.fromisoformat(row[8].replace("Z", "+00:00"))
                        readings.append(
                            SensorReading(
                                id=str(row[0]),
                                machine_id=str(row[1]),
                                batch_id=str(row[2]) if row[2] else None,
                                sensor_type=str(row[3]),
                                measurement_value=float(row[4]),
                                unit=str(row[5]),
                                is_anomaly=bool(row[6]),
                                anomaly_score=float(row[7]) if row[7] is not None else None,
                                recorded_at=rec_time,
                            )
                        )
                    except Exception as parse_err:
                        logger.warning("Could not parse sensor row %s: %s", row[0], parse_err)
        except Exception as e:
            logger.error("Error reading sensor_measurements: %s", e)

        return readings

    def load_inspections_with_detections(self) -> List[Dict[str, Any]]:
        """Loads inspections along with their Model 1 optical defect detections."""
        if not self.db_path.exists():
            return []

        inspections: List[Dict[str, Any]] = []
        try:
            with sqlite3.connect(self.db_path) as conn:
                conn.row_factory = sqlite3.Row
                cursor = conn.cursor()
                rows = cursor.execute("SELECT * FROM inspections ORDER BY createdAt ASC").fetchall()

                for row in rows:
                    insp_id = row["inspectionId"]
                    # Get associated detections
                    det_rows = cursor.execute(
                        "SELECT * FROM detections WHERE inspectionId = ?", (insp_id,)
                    ).fetchall()

                    detections = [dict(d) for d in det_rows]
                    primary_defect = detections[0]["defectType"] if detections else None
                    confidences = [d["confidence"] for d in detections]
                    max_conf = max(confidences) if confidences else 0.0
                    mean_conf = sum(confidences) / len(confidences) if confidences else 0.0

                    # Calculate total defect bounding box area ratio
                    area_sum = 0.0
                    for d in detections:
                        dx = max(0.0, float(d["x2"]) - float(d["x1"]))
                        dy = max(0.0, float(d["y2"]) - float(d["y1"]))
                        area_sum += (dx * dy)
                    # Normalizing against typical 1024x1024 sensor area
                    area_ratio = min(1.0, area_sum / (1024.0 * 1024.0))

                    created_str = row["createdAt"]
                    try:
                        created_dt = datetime.fromisoformat(created_str.replace("Z", "+00:00"))
                    except Exception:
                        created_dt = datetime.now(timezone.utc)

                    inspections.append({
                        "inspection_id": insp_id,
                        "source_filename": row["sourceFilename"],
                        "created_at": created_dt,
                        "batch_id": row["batchId"] if "batchId" in row.keys() else None,
                        "machine_id": row["machineId"] if "machineId" in row.keys() else None,
                        "detections_count": int(row["detectionsCount"]),
                        "detections": detections,
                        "primary_defect_type": primary_defect,
                        "max_confidence": max_conf,
                        "mean_confidence": mean_conf,
                        "defect_area_ratio": area_ratio,
                    })
        except Exception as e:
            logger.error("Error reading inspections and detections: %s", e)

        return inspections

    def load_sensor_csv(self, file_path: Path | str) -> List[SensorReading]:
        """Loads sensor measurements from a CSV export."""
        path = Path(file_path)
        if not path.exists():
            raise FileNotFoundError(f"Sensor CSV file not found at {path}")

        readings: List[SensorReading] = []
        with open(path, mode="r", encoding="utf-8") as f:
            reader = csv.DictReader(f)
            for i, row in enumerate(reader):
                try:
                    rec_time = datetime.fromisoformat(row["recorded_at"].replace("Z", "+00:00"))
                    readings.append(
                        SensorReading(
                            id=row.get("id", f"csv_{i}"),
                            machine_id=row["machine_id"],
                            batch_id=row.get("batch_id"),
                            sensor_type=row["sensor_type"],
                            measurement_value=float(row["measurement_value"]),
                            unit=row["unit"],
                            is_anomaly=row.get("is_anomaly", "").lower() in ("true", "1", "yes"),
                            anomaly_score=float(row["anomaly_score"]) if row.get("anomaly_score") else None,
                            recorded_at=rec_time,
                        )
                    )
                except Exception as e:
                    logger.warning("Failed to parse row %d in %s: %s", i, path, e)

        return readings

    def load_ground_truth_labels(
        self, file_path: Optional[Path | str] = None
    ) -> Dict[str, RootCauseGroundTruth]:
        """
        Loads confirmed ground-truth root causes from a designated JSON or CSV file.
        Returns a dictionary mapping inspection_id -> RootCauseGroundTruth.
        """
        labels: Dict[str, RootCauseGroundTruth] = {}
        if not file_path:
            return labels

        path = Path(file_path)
        if not path.exists():
            logger.info("No external ground truth file found at %s", path)
            return labels

        try:
            if path.suffix.lower() == ".json":
                data = json.loads(path.read_text(encoding="utf-8"))
                for item in data:
                    gt = RootCauseGroundTruth(**item)
                    labels[gt.inspection_id] = gt
            elif path.suffix.lower() == ".csv":
                with open(path, mode="r", encoding="utf-8") as f:
                    reader = csv.DictReader(f)
                    for row in reader:
                        gt = RootCauseGroundTruth(
                            inspection_id=row["inspection_id"],
                            confirmed_cause=row["confirmed_cause"],
                            confidence_level=row.get("confidence_level", "confirmed"),
                            verified_by=row.get("verified_by"),
                            investigation_notes=row.get("investigation_notes"),
                        )
                        labels[gt.inspection_id] = gt
        except Exception as e:
            logger.error("Failed to load ground truth labels from %s: %s", path, e)

        return labels
