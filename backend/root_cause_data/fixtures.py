"""Synthetic verification fixtures strictly for unit-testing the Model 2 data engineering pipeline.

IMPORTANT:
These fixtures are strictly for verifying the software correctness of the data
pipeline and training scripts. They are explicitly marked with
`is_synthetic_test_fixture=True` and must NEVER be reported or claimed as
genuine production manufacturing results.
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Dict, List, Tuple
import numpy as np

from .schema import (
    ROOT_CAUSE_TAXONOMY,
    SENSOR_UNIT_REGISTRY,
    RootCauseCategory,
    RootCauseGroundTruth,
    SensorReading,
)


def generate_pipeline_test_fixtures(
    n_batches: int = 4,
    wafers_per_batch: int = 15,
    samples_per_sensor: int = 60,
    seed: int = 42,
) -> Tuple[
    List[Dict[str, Any]],
    List[SensorReading],
    Dict[str, RootCauseGroundTruth],
]:
    """
    Generates a coherent synthetic verification scenario to test the ingestion,
    windowing, splitting, training, and evaluation software modules.
    """
    rng = np.random.RandomState(seed)
    base_time = datetime(2026, 10, 20, 8, 0, 0, tzinfo=timezone.utc)

    inspections: List[Dict[str, Any]] = []
    readings: List[SensorReading] = []
    ground_truths: Dict[str, RootCauseGroundTruth] = {}

    sensor_names = list(SENSOR_UNIT_REGISTRY.keys())
    causes = ROOT_CAUSE_TAXONOMY

    reading_idx = 0
    insp_idx = 0

    for b in range(n_batches):
        batch_id = f"BATCH_2026_{b+1:03d}"
        batch_start = base_time + timedelta(hours=b * 4)

        # Simulate ongoing background sensor readings every 1 minute
        for t_step in range(samples_per_sensor):
            t_curr = batch_start + timedelta(minutes=t_step)
            for s_name in sensor_names:
                s_def = SENSOR_UNIT_REGISTRY[s_name]
                # Gaussian noise around nominal target
                span = s_def.max_valid - s_def.min_valid
                val = float(np.clip(
                    rng.normal(s_def.nominal_target, span * 0.04),
                    s_def.min_valid,
                    s_def.max_valid,
                ))

                readings.append(
                    SensorReading(
                        id=f"test_sensor_{reading_idx}",
                        machine_id=f"M_{s_def.machine_type}_01",
                        batch_id=batch_id,
                        sensor_type=s_name,
                        measurement_value=val,
                        unit=s_def.unit,
                        is_anomaly=False,
                        anomaly_score=0.01,
                        recorded_at=t_curr,
                    )
                )
                reading_idx += 1

        # Simulate wafer inspections toward the end of the batch
        for w in range(wafers_per_batch):
            insp_time = batch_start + timedelta(minutes=samples_per_sensor - 5 + (w * 0.2))
            insp_id = f"test_insp_{b}_{w:03d}"
            assigned_cause = causes[(b + w) % len(causes)]

            # Plausible defect associations
            defect_type = "crack" if "soldering" in assigned_cause or "handling" in assigned_cause else "finger"

            inspections.append({
                "inspection_id": insp_id,
                "source_filename": f"synthetic_cell_{b}_{w}.jpg",
                "created_at": insp_time,
                "batch_id": batch_id,
                "machine_id": "M_line1_inspection",
                "detections_count": 1,
                "primary_defect_type": defect_type,
                "max_confidence": float(rng.uniform(0.70, 0.95)),
                "mean_confidence": float(rng.uniform(0.65, 0.90)),
                "defect_area_ratio": float(rng.uniform(0.01, 0.05)),
                "is_synthetic_test_fixture": True,
            })

            ground_truths[insp_id] = RootCauseGroundTruth(
                inspection_id=insp_id,
                confirmed_cause=assigned_cause,
                confidence_level="test_fixture",
                verified_by="QA_AUTOMATED_FIXTURE",
                investigation_notes="Synthetic fixture strictly for pipeline code verification",
            )
            insp_idx += 1

    return inspections, readings, ground_truths
