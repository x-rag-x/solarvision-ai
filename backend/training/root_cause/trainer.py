"""Training orchestrator and artifact generator for Model 2."""

from __future__ import annotations

from datetime import datetime, timezone
import json
import logging
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple
import numpy as np

from backend.root_cause_data.pipeline import RootCauseDatasetPipeline
from backend.root_cause_data.schema import CANONICAL_FEATURE_ORDER, ROOT_CAUSE_TAXONOMY

from .baseline import DefectPriorHeuristicBaseline, MajorityClassBaseline
from .contract import (
    MODEL2_NAME,
    MODEL2_VERSION,
    Model2ArtifactContract,
    ModelMetadata,
)
from .tree_model import RandomForestClassifier
from .xgb_adapter import XGBoostAdapter

logger = logging.getLogger("solarvision.root_cause.trainer")


class RootCauseModelTrainer:
    """Manages model fitting, evaluation comparison, and artifact serialization."""

    def __init__(
        self,
        output_dir: Optional[Path | str] = None,
        random_state: int = 42,
    ):
        self.output_dir = Path(output_dir or "backend/training/root_cause/artifacts")
        self.output_dir.mkdir(parents=True, exist_ok=True)
        self.random_state = random_state

    def train_from_pipeline(
        self,
        pipeline_result: Dict[str, Any],
        n_estimators: int = 60,
        max_depth: int = 10,
    ) -> Dict[str, Any]:
        """
        Executes training if dataset is ready. If dataset is DATASET_BLOCKED,
        records the blocker and halts without generating deceptive production claims.
        """
        status = pipeline_result.get("status", "DATASET_BLOCKED")
        if status == "DATASET_BLOCKED":
            logger.warning("Training halted: dataset status is DATASET_BLOCKED.")
            return {
                "status": "DATASET_BLOCKED",
                "message": (
                    "Training aborted. Real manufacturing sensor streams and confirmed ground-truth "
                    "root-cause labels are required before Model 2 can be trained."
                ),
                "blockers": pipeline_result.get("audit_result", {}).blocking_reasons
                if hasattr(pipeline_result.get("audit_result", {}), "blocking_reasons")
                else [],
            }

        splits = pipeline_result.get("dataset_files", {})
        if not splits:
            return {"status": "DATASET_BLOCKED", "message": "No feature files emitted by pipeline."}

        train_vecs = json.loads(Path(splits["train"]).read_text(encoding="utf-8"))
        val_vecs = json.loads(Path(splits["val"]).read_text(encoding="utf-8"))

        return self.train_and_evaluate(
            train_records=train_vecs,
            val_records=val_vecs,
            n_estimators=n_estimators,
            max_depth=max_depth,
            is_synthetic=False,
        )

    def train_and_evaluate(
        self,
        train_records: List[Dict[str, Any]],
        val_records: List[Dict[str, Any]],
        n_estimators: int = 60,
        max_depth: int = 10,
        is_synthetic: bool = False,
    ) -> Dict[str, Any]:
        """Fits models, calculates performance comparison, and exports artifact."""
        if not train_records:
            return {"status": "ERROR", "message": "No training records provided."}

        X_train = np.array([r["features"] for r in train_records], dtype=np.float32)
        y_train = np.array([r["label_index"] for r in train_records], dtype=np.int64)
        y_train_names = [r["label_cause"] for r in train_records]

        X_val = np.array([r["features"] for r in val_records], dtype=np.float32)
        y_val = np.array([r["label_index"] for r in val_records], dtype=np.int64)
        y_val_names = [r["label_cause"] for r in val_records]

        # 1. Fit Majority Baseline
        majority_baseline = MajorityClassBaseline().fit(y_train_names)
        maj_preds = majority_baseline.predict(X_val)
        maj_acc = float(np.mean([p == actual for p, actual in zip(maj_preds, y_val_names)]))

        # 2. Fit Random Forest
        rf = RandomForestClassifier(
            n_estimators=n_estimators,
            max_depth=max_depth,
            random_state=self.random_state,
            num_classes=len(ROOT_CAUSE_TAXONOMY),
        )
        rf.fit(X_train, y_train)

        val_preds = rf.predict(X_val)
        val_acc = float(np.mean(val_preds == y_val))
        val_proba = rf.predict_proba(X_val)

        # Compute Brier score (multi-class calibration metric)
        # Sum of squared deviations between predicted probabilities and one-hot true labels
        one_hot_val = np.zeros_like(val_proba)
        for idx, true_cls in enumerate(y_val):
            one_hot_val[idx, true_cls] = 1.0
        brier_score = float(np.mean(np.sum((val_proba - one_hot_val) ** 2, axis=1)))

        # Feature importances mapping
        feat_imp_map: Dict[str, float] = {}
        for feat_name, imp_val in zip(CANONICAL_FEATURE_ORDER, rf.feature_importances_):
            feat_imp_map[feat_name] = round(float(imp_val), 6)

        # Sort feature importances descending
        sorted_imp = dict(sorted(feat_imp_map.items(), key=lambda kv: kv[1], reverse=True))

        metrics = {
            "validation_accuracy": round(val_acc, 4),
            "oob_score": round(rf.oob_score_, 4),
            "brier_calibration_score": round(brier_score, 4),
            "baseline_majority_accuracy": round(maj_acc, 4),
            "samples_train": len(X_train),
            "samples_val": len(X_val),
        }

        # 3. Serialize Artifact
        metadata = ModelMetadata(
            model_name=MODEL2_NAME,
            model_version=MODEL2_VERSION,
            created_at=datetime.now(timezone.utc).isoformat(),
            framework="NumPy_SciPy_RandomForest",
            feature_count=len(CANONICAL_FEATURE_ORDER),
            feature_names=CANONICAL_FEATURE_ORDER,
            num_classes=len(ROOT_CAUSE_TAXONOMY),
            target_classes=ROOT_CAUSE_TAXONOMY,
            hyperparameters={
                "n_estimators": n_estimators,
                "max_depth": max_depth,
                "min_samples_split": 2,
                "min_samples_leaf": 1,
                "max_features": "sqrt",
                "random_state": self.random_state,
            },
            training_samples=len(X_train),
            metrics=metrics,
            feature_importances=sorted_imp,
            calibration_method="normalized_ensemble_frequencies",
            is_synthetic_training=is_synthetic,
            status="validation_prototype" if is_synthetic else "production_ready",
        )

        artifact_path = self.output_dir / "model2_root_cause_rf.json"
        Model2ArtifactContract.serialize_artifact(
            metadata=metadata,
            model_payload=rf.to_dict(),
            output_path=artifact_path,
        )

        logger.info(
            "Model 2 trained successfully. Val Acc: %.2f%%, OOB: %.2f%%, Brier: %.4f. Saved to %s",
            val_acc * 100.0,
            rf.oob_score_ * 100.0,
            brier_score,
            artifact_path,
        )

        return {
            "status": "SUCCESS",
            "artifact_path": str(artifact_path),
            "metrics": metrics,
            "top_features": list(sorted_imp.items())[:10],
            "is_synthetic": is_synthetic,
        }

    def run_dry_run_verification(self) -> Dict[str, Any]:
        """
        Runs a complete end-to-end dry run verification using the synthetic pipeline fixtures
        to verify that when real telemetry is provided, all software components function
        without errors.
        """
        logger.info("Executing dry-run verification with synthetic fixtures...")
        pipe = RootCauseDatasetPipeline(output_dir=self.output_dir / "test_data")
        res = pipe.run_pipeline(use_test_fixtures_for_verification=True)

        splits = res["dataset_files"]
        train_vecs = json.loads(Path(splits["train"]).read_text(encoding="utf-8"))
        val_vecs = json.loads(Path(splits["val"]).read_text(encoding="utf-8"))

        train_res = self.train_and_evaluate(
            train_records=train_vecs,
            val_records=val_vecs,
            n_estimators=30,
            max_depth=8,
            is_synthetic=True,
        )

        return {
            "pipeline_verification": res["status"],
            "training_verification": train_res["status"],
            "artifact_path": train_res.get("artifact_path"),
            "metrics": train_res.get("metrics"),
        }
