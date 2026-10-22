"""End-to-end dataset preparation and auditing pipeline for Model 2."""

from __future__ import annotations

import json
import logging
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

import numpy as np

from .fixtures import generate_pipeline_test_fixtures
from .ingestion import TelemetryIngestionEngine
from .quality_report import DataQualityAuditor
from .schema import (
    CANONICAL_FEATURE_ORDER,
    ROOT_CAUSE_TAXONOMY,
    DataQualityAuditResult,
    ModelReadyFeatureVector,
    RootCauseGroundTruth,
    SensorReading,
)
from .splitter import LeakageFreeSplitter
from .time_window import TimeWindowFeatureExtractor
from .validator import TelemetryValidator

logger = logging.getLogger("solarvision.root_cause.pipeline")


class RootCauseDatasetPipeline:
    """Orchestrates ingestion, validation, feature extraction, splitting, and quality reporting."""

    def __init__(
        self,
        db_path: Optional[Path | str] = None,
        output_dir: Optional[Path | str] = None,
    ):
        self.db_path = Path(db_path or "data/solarvision.db")
        self.output_dir = Path(output_dir or "backend/root_cause_data/artifacts")
        self.output_dir.mkdir(parents=True, exist_ok=True)

        self.ingestion = TelemetryIngestionEngine(self.db_path)
        self.validator = TelemetryValidator(reject_out_of_bounds=False)
        self.extractor = TimeWindowFeatureExtractor()
        self.splitter = LeakageFreeSplitter()

    def run_pipeline(
        self,
        ground_truth_file: Optional[Path | str] = None,
        telemetry_csv: Optional[Path | str] = None,
        use_test_fixtures_for_verification: bool = False,
    ) -> Dict[str, Any]:
        """
        Executes the full dataset preparation pipeline.
        
        If real ground-truth labels and sensor measurements are not available,
        it sets the dataset status strictly to DATASET_BLOCKED and generates
        a comprehensive data deficiency audit report.
        """
        logger.info("Starting Root Cause Dataset Pipeline...")

        # 1. Ingest from database or test fixtures
        if use_test_fixtures_for_verification:
            logger.info("Using synthetic verification fixtures for pipeline software testing.")
            inspections, readings, ground_truths = generate_pipeline_test_fixtures()
            duplicates_count = 0
            out_of_bounds_count = 0
        else:
            inspections = self.ingestion.load_inspections_with_detections()
            readings = self.ingestion.load_sensor_readings_from_db()

            if telemetry_csv and Path(telemetry_csv).exists():
                logger.info("Loading additional sensor telemetry from %s", telemetry_csv)
                readings.extend(self.ingestion.load_sensor_csv(telemetry_csv))

            ground_truths = self.ingestion.load_ground_truth_labels(ground_truth_file)

            # Audit readings
            audit_raw = self.validator.audit_batch(readings)
            duplicates_count = audit_raw["duplicate_readings"]
            out_of_bounds_count = audit_raw["out_of_bounds_readings"]

        # 2. Extract windowed features for each inspection
        cause_to_idx = {c: i for i, c in enumerate(ROOT_CAUSE_TAXONOMY)}
        feature_vectors: List[ModelReadyFeatureVector] = []

        for insp in inspections:
            insp_id = insp["inspection_id"]
            insp_time = insp["created_at"]

            feat_dict = self.extractor.extract_features_for_inspection(
                inspection_time=insp_time,
                readings=readings,
                events=[],
                defect_metadata=insp,
            )

            ordered_feats = [feat_dict.get(k, 0.0) for k in CANONICAL_FEATURE_ORDER]

            gt = ground_truths.get(insp_id)
            label_cause = gt.confirmed_cause if gt else None
            label_idx = cause_to_idx.get(label_cause) if label_cause else None

            feature_vectors.append(
                ModelReadyFeatureVector(
                    inspection_id=insp_id,
                    timestamp=insp_time,
                    batch_id=insp.get("batch_id"),
                    machine_id=insp.get("machine_id"),
                    features=ordered_feats,
                    feature_names=CANONICAL_FEATURE_ORDER,
                    label_cause=label_cause,
                    label_index=label_idx,
                )
            )

        # 3. Generate Data Quality Audit
        audit_result = DataQualityAuditor.audit(
            inspections=inspections,
            sensor_readings=readings,
            model_vectors=feature_vectors,
            duplicates_count=duplicates_count,
            out_of_bounds_count=out_of_bounds_count,
        )

        # Export audit reports
        report_md_path = self.output_dir / "data_quality_report.md"
        report_json_path = self.output_dir / "data_quality_report.json"
        DataQualityAuditor.export_markdown_report(audit_result, report_md_path)
        DataQualityAuditor.export_json_report(audit_result, report_json_path)

        # 4. Perform Leakage-Free Splitting
        labeled_vectors = [v for v in feature_vectors if v.label_cause is not None]
        train_vecs, val_vecs, test_vecs = self.splitter.batch_group_split(labeled_vectors)

        # 5. Export dataset files if labeled data exists
        dataset_paths: Dict[str, str] = {}
        if labeled_vectors:
            train_path = self.output_dir / "train_features.json"
            val_path = self.output_dir / "val_features.json"
            test_path = self.output_dir / "test_features.json"

            train_path.write_text(json.dumps([v.model_dump(mode="json") for v in train_vecs], indent=2))
            val_path.write_text(json.dumps([v.model_dump(mode="json") for v in val_vecs], indent=2))
            test_path.write_text(json.dumps([v.model_dump(mode="json") for v in test_vecs], indent=2))

            dataset_paths = {
                "train": str(train_path),
                "val": str(val_path),
                "test": str(test_path),
            }

        logger.info(
            "Pipeline finished. Status: %s. Total inspections: %d, Labeled: %d",
            audit_result.dataset_status,
            len(inspections),
            len(labeled_vectors),
        )

        return {
            "status": audit_result.dataset_status,
            "total_inspections": len(inspections),
            "labeled_count": len(labeled_vectors),
            "feature_count": len(CANONICAL_FEATURE_ORDER),
            "feature_names": CANONICAL_FEATURE_ORDER,
            "reports": {
                "markdown": str(report_md_path),
                "json": str(report_json_path),
            },
            "dataset_files": dataset_paths,
            "audit_result": audit_result,
            "splits": {
                "train_count": len(train_vecs),
                "val_count": len(val_vecs),
                "test_count": len(test_vecs),
            },
        }


def run_cli() -> None:
    """CLI execution entrypoint."""
    pipeline = RootCauseDatasetPipeline()
    res = pipeline.run_pipeline()
    print("=" * 60)
    print("SOLARVISION AI — MODEL 2 DATASET PIPELINE")
    print("=" * 60)
    print(f"Status: {res['status']}")
    print(f"Total Inspections: {res['total_inspections']}")
    print(f"Labeled Records: {res['labeled_count']}")
    print(f"Audit Markdown: {res['reports']['markdown']}")
    print(f"Audit JSON: {res['reports']['json']}")
    if res["status"] == "DATASET_BLOCKED":
        print("\nBlocking Deficiencies:")
        for r in res["audit_result"].blocking_reasons:
            print(f"  - {r}")


if __name__ == "__main__":
    run_cli()
