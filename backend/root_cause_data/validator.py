"""Validation engine for manufacturing sensor streams, batches, and root-cause labels."""

from __future__ import annotations

from datetime import datetime, timezone
import logging
from typing import Any, Dict, List, Optional, Set, Tuple

from .schema import (
    ROOT_CAUSE_TAXONOMY,
    SENSOR_UNIT_REGISTRY,
    RootCauseGroundTruth,
    SensorReading,
)

logger = logging.getLogger("solarvision.root_cause.validator")


class TelemetryValidator:
    """Validates raw sensor records, bounds, physical consistency, and ground truth labels."""

    def __init__(self, reject_out_of_bounds: bool = False):
        self.reject_out_of_bounds = reject_out_of_bounds
        self.seen_signatures: Set[Tuple[str, str, str]] = set()

    def validate_reading(self, reading: SensorReading) -> Tuple[bool, Optional[str]]:
        """
        Validates an individual sensor reading for:
        1. Known sensor type in registry
        2. Expected physical engineering unit
        3. Plausible physical bounds
        4. Timestamp sanity (not in the distant future)
        """
        sensor_def = SENSOR_UNIT_REGISTRY.get(reading.sensor_type)
        if not sensor_def:
            return False, f"Unknown sensor_type '{reading.sensor_type}' not in registry"

        # Unit verification
        if reading.unit.strip().lower() != sensor_def.unit.strip().lower():
            return False, (
                f"Unit mismatch for '{reading.sensor_type}': expected '{sensor_def.unit}', "
                f"got '{reading.unit}'"
            )

        # Range bounds
        val = reading.measurement_value
        if val < sensor_def.min_valid or val > sensor_def.max_valid:
            msg = (
                f"Value {val} {reading.unit} for '{reading.sensor_type}' outside valid physical "
                f"range [{sensor_def.min_valid}, {sensor_def.max_valid}]"
            )
            if self.reject_out_of_bounds:
                return False, msg
            logger.warning(msg)

        # Timestamp sanity (not > 24h into the future)
        now_utc = datetime.now(timezone.utc)
        rec_time = reading.recorded_at
        if rec_time.tzinfo is None:
            rec_time = rec_time.replace(tzinfo=timezone.utc)
        if (rec_time - now_utc).total_seconds() > 86400:
            return False, f"Timestamp {reading.recorded_at} is more than 24h in the future"

        return True, None

    def check_duplicate(self, reading: SensorReading) -> bool:
        """
        Detects duplicate sensor telemetry events based on (machine_id, sensor_type, timestamp).
        Returns True if duplicate, False if unique.
        """
        sig = (reading.machine_id, reading.sensor_type, reading.recorded_at.isoformat())
        if sig in self.seen_signatures:
            return True
        self.seen_signatures.add(sig)
        return False

    def validate_cause_label(self, label: str) -> Tuple[bool, Optional[str]]:
        """Validates that a root cause label belongs to the official taxonomy."""
        if not label or not isinstance(label, str):
            return False, "Root cause label must be a non-empty string"
        if label not in ROOT_CAUSE_TAXONOMY:
            return False, (
                f"Label '{label}' is not in the confirmed root cause taxonomy. "
                f"Must be one of {ROOT_CAUSE_TAXONOMY}"
            )
        return True, None

    def audit_batch(
        self, readings: List[SensorReading]
    ) -> Dict[str, Any]:
        """Audits a collection of readings and returns a structured summary."""
        valid_count = 0
        invalid_count = 0
        duplicate_count = 0
        out_of_bounds_count = 0
        error_samples: List[str] = []

        for r in readings:
            if self.check_duplicate(r):
                duplicate_count += 1
                continue

            sensor_def = SENSOR_UNIT_REGISTRY.get(r.sensor_type)
            if sensor_def:
                if r.measurement_value < sensor_def.min_valid or r.measurement_value > sensor_def.max_valid:
                    out_of_bounds_count += 1

            is_valid, err = self.validate_reading(r)
            if is_valid:
                valid_count += 1
            else:
                invalid_count += 1
                if len(error_samples) < 10 and err:
                    error_samples.append(err)

        return {
            "total_evaluated": len(readings),
            "valid_readings": valid_count,
            "invalid_readings": invalid_count,
            "duplicate_readings": duplicate_count,
            "out_of_bounds_readings": out_of_bounds_count,
            "error_samples": error_samples,
        }
