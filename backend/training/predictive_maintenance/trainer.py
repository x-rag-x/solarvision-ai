"""
SolarVision AI — Model 4: Predictive Maintenance
End-to-End Benchmark Training Orchestrator
"""

from __future__ import annotations

from dataclasses import asdict
from datetime import datetime, timezone
import logging
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple
import numpy as np

from backend.predictive_maintenance_data.loader import AI4IDataLoader, AI4IDatasetMetadata
from backend.predictive_maintenance_data.preprocessor import PredictiveMaintenancePreprocessor
from backend.predictive_maintenance_data.splitter import MaintenanceDataSplitter, MaintenanceDatasetSplits
from backend.evaluation.predictive_maintenance.metrics import MaintenanceMetricsCalculator
from backend.evaluation.predictive_maintenance.calibration import (
    MaintenanceCalibrationEvaluator,
    ProbabilityCalibrator,
)
from backend.evaluation.predictive_maintenance.threshold import ThresholdOptimizer

from .baseline import MajorityDummyMaintenanceClassifier
from .logistic_regression import CostSensitiveLogisticRegression
from .random_forest import BalancedRandomForestMaintenanceClassifier
from .gradient_boosting import GradientBoostedMaintenanceClassifier
from .contract import Model4ArtifactContract, PredictiveMaintenanceModelMetadata

logger = logging.getLogger("solarvision.model4.trainer")


class PredictiveMaintenanceTrainer:
    """
    Orchestrates full benchmark training, validation-based threshold optimization,
    Platt probability calibration, held-out evaluation, and artifact serialization.
    """

    ARTIFACTS_DIR = Path(__file__).resolve().parent / "artifacts"

    ORDERED_SCHEMA: List[Dict[str, str]] = [
        {"index": "0", "name": "type", "type": "categorical", "values": "L, M, H", "description": "Product quality tier (Low 50%, Med 30%, High 20%)"},
        {"index": "1", "name": "air_temperature_k", "type": "float", "unit": "Kelvin", "description": "Ambient air temperature (295.3 - 304.5 K)"},
        {"index": "2", "name": "process_temperature_k", "type": "float", "unit": "Kelvin", "description": "Component process temperature (305.7 - 313.8 K)"},
        {"index": "3", "name": "rotational_speed_rpm", "type": "float", "unit": "RPM", "description": "Spindle rotational speed (1168 - 2886 rpm)"},
        {"index": "4", "name": "torque_nm", "type": "float", "unit": "Nm", "description": "Spindle torque output (3.8 - 76.6 Nm)"},
        {"index": "5", "name": "tool_wear_min", "type": "float", "unit": "Minutes", "description": "Cumulative tool wear time (0 - 253 min)"},
    ]

    def __init__(
        self,
        output_dir: Optional[Path | str] = None,
        random_state: int = 42,
    ) -> None:
        self.output_dir = Path(output_dir or self.ARTIFACTS_DIR)
        self.output_dir.mkdir(parents=True, exist_ok=True)
        self.random_state = int(random_state)

    def run_benchmark(
        self,
        split_strategy: str = "stratified_random",
        export_model_name: Optional[str] = "Gradient_Boosting",
    ) -> Dict[str, Any]:
        """
        Runs complete benchmark training across all 4 architectures.
        Split strategies:
          - 'stratified_random' (70/15/15)
          - 'stratified_80_20' (64/16/20)
        """
        logger.info("Initializing UCI AI4I 2020 benchmark (strategy=%s)...", split_strategy)
        loader = AI4IDataLoader()
        X_raw, y_raw, modes, raw_records = loader.load_raw()
        meta = loader.get_provenance_metadata()

        # 1. Split Data
        if split_strategy == "stratified_80_20":
            splits = MaintenanceDataSplitter.stratified_split_80_20(
                X_raw, y_raw, modes=modes, random_state=self.random_state
            )
        else:
            splits = MaintenanceDataSplitter.stratified_split(
                X_raw, y_raw, modes=modes, train_ratio=0.70, val_ratio=0.15, random_state=self.random_state
            )

        # 2. Fit Preprocessor Strictly on D_train (Zero Leakage)
        preprocessor = PredictiveMaintenancePreprocessor(clip_zscore=5.0)
        X_train = preprocessor.fit_transform(splits.X_train)
        X_val = preprocessor.transform(splits.X_val)
        X_test = preprocessor.transform(splits.X_test)

        y_train = splits.y_train
        y_val = splits.y_val
        y_test = splits.y_test

        models: Dict[str, Any] = {
            "Majority_Baseline": MajorityDummyMaintenanceClassifier(),
            "CostSensitive_LogisticRegression": CostSensitiveLogisticRegression(
                learning_rate=0.02,
                weight_decay=0.01,
                max_epochs=150,
                random_state=self.random_state,
            ),
            "Balanced_RandomForest": BalancedRandomForestMaintenanceClassifier(
                n_estimators=50,
                max_depth=7,
                min_samples_split=4,
                majority_ratio=2.0,
                random_state=self.random_state,
            ),
            "Gradient_Boosting": GradientBoostedMaintenanceClassifier(
                n_estimators=60,
                learning_rate=0.08,
                random_state=self.random_state,
            ),
        }

        cal_eval = MaintenanceCalibrationEvaluator(n_bins=10)
        results: Dict[str, Any] = {}
        fitted_calibrators: Dict[str, Optional[ProbabilityCalibrator]] = {}
        best_model_name = "Gradient_Boosting"
        best_macro_f1 = -1.0

        for name, model in models.items():
            logger.info("Fitting model: %s", name)
            model.fit(X_train, y_train)

            val_probs = model.predict_proba(X_val)
            test_probs = model.predict_proba(X_test)

            if name == "Majority_Baseline":
                opt_thresh = 0.50
                calibrator = None
                cal_metrics_raw = cal_eval.evaluate(y_test, test_probs)
                cal_metrics_cal = cal_metrics_raw
            else:
                opt_thresh, _, _ = ThresholdOptimizer.optimize_threshold(
                    y_val_true=y_val,
                    y_val_prob=val_probs,
                    criterion="f1_failure",
                )
                # Fit calibrator strictly on validation probabilities
                calibrator = ProbabilityCalibrator(method="platt").fit(val_probs, y_val)
                test_probs_cal = calibrator.calibrate(test_probs)

                cal_metrics_raw = cal_eval.evaluate(y_test, test_probs)
                cal_metrics_cal = cal_eval.evaluate(y_test, test_probs_cal)

            fitted_calibrators[name] = calibrator

            metrics_default = MaintenanceMetricsCalculator.compute(y_test, test_probs, threshold=0.50)
            metrics_optimal = MaintenanceMetricsCalculator.compute(y_test, test_probs, threshold=opt_thresh)

            results[name] = {
                "default_threshold_0_50": metrics_default.to_dict(),
                "optimal_threshold": metrics_optimal.to_dict(),
                "optimal_threshold_value": opt_thresh,
                "calibration_raw": cal_metrics_raw,
                "calibration_calibrated": cal_metrics_cal,
            }

            if metrics_optimal.macro_f1 > best_macro_f1 and name != "Majority_Baseline":
                best_macro_f1 = metrics_optimal.macro_f1
                best_model_name = name

        # 3. Determine Model to Export
        target_export_name = export_model_name or best_model_name
        export_model = models[target_export_name]
        export_info = results[target_export_name]
        export_calibrator = fitted_calibrators.get(target_export_name)

        model_metadata = PredictiveMaintenanceModelMetadata(
            model_name=f"SolarVision_{target_export_name}",
            model_version=Model4ArtifactContract.MODEL_VERSION,
            created_at=datetime.now(timezone.utc).isoformat(),
            domain=Model4ArtifactContract.DOMAIN,
            framework="PyTorch_NumPy_SciPy",
            dataset_name=meta.dataset_name,
            dataset_doi=meta.doi,
            dataset_license=meta.license,
            dataset_sha256=meta.sha256_hash,
            training_samples=len(X_train),
            val_samples=len(X_val),
            test_samples=len(X_test),
            input_feature_count=preprocessor.n_input_features,
            feature_names=list(preprocessor.CANONICAL_FEATURE_NAMES),
            ordered_feature_schema=list(self.ORDERED_SCHEMA),
            split_strategy=split_strategy,
            target_labels={"healthy": 0, "failure": 1},
            optimal_threshold=export_info["optimal_threshold_value"],
            test_metrics=export_info["optimal_threshold"],
            calibration_metrics=export_info["calibration_calibrated"],
            reproducibility={
                "random_state": self.random_state,
                "features_used": 6,
                "features_excluded": ["UDI", "Product ID", "Machine failure", "TWF", "HDF", "PWF", "OSF", "RNF"],
            },
            status="BENCHMARK_EVALUATED_READY",
            is_synthetic_benchmark=True,
            synthetic_disclaimer=Model4ArtifactContract.SYNTHETIC_DISCLAIMER,
        )

        model_dict = export_model.to_dict()
        if export_calibrator is not None:
            model_dict["calibrator"] = export_calibrator.to_dict()

        artifact_file = self.output_dir / "model4_predictive_maintenance.json"
        artifact_path, sha256_hash = Model4ArtifactContract.serialize_artifact(
            metadata=model_metadata,
            model_payload=model_dict,
            preprocessor_dict=preprocessor.to_dict(),
            output_path=artifact_file,
        )

        logger.info(
            "Model 4 Benchmark complete. Exported: %s (Test Macro-F1: %.4f). Saved to %s (SHA256: %s)",
            target_export_name,
            export_info["optimal_threshold"]["macro_f1"],
            artifact_path,
            sha256_hash[:12],
        )

        return {
            "dataset_metadata": asdict(meta),
            "splits": {
                "train": asdict(splits.train_summary),
                "val": asdict(splits.val_summary),
                "test": asdict(splits.test_summary),
            },
            "preprocessing": {
                "input_features": preprocessor.n_input_features,
                "output_features": preprocessor.n_output_features,
                "feature_names": preprocessor.CANONICAL_FEATURE_NAMES,
            },
            "models_evaluated": results,
            "best_model_name": best_model_name,
            "exported_model_name": target_export_name,
            "artifact_path": str(artifact_path),
            "sha256_hash": sha256_hash,
        }
