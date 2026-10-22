"""
SolarVision AI — Model 3: Predictive Quality Analysis
End-to-End Benchmark Training Orchestrator
"""

from __future__ import annotations

from datetime import datetime, timezone
import json
import logging
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple
import numpy as np

from backend.predictive_quality_data.loader import SECOMDataLoader, SECOMDatasetMetadata
from backend.predictive_quality_data.preprocessor import QualityDataPreprocessor
from backend.predictive_quality_data.splitter import DatasetSplits, QualityDataSplitter
from backend.evaluation.predictive_quality.metrics import QualityMetricsCalculator, QualityMetricsResult
from backend.evaluation.predictive_quality.calibration import (
    ProbabilityCalibrator,
    QualityCalibrationEvaluator,
)
from backend.evaluation.predictive_quality.threshold import ThresholdOptimizer

from .baseline import MajorityDummyQualityClassifier
from .logistic_regression import CostSensitiveLogisticRegression
from .random_forest import BalancedRandomForestQualityClassifier
from .gradient_boosting import GradientBoostedQualityClassifier
from .contract import Model3ArtifactContract, PredictiveQualityModelMetadata

logger = logging.getLogger("solarvision.model3.trainer")


class PredictiveQualityTrainer:
    """
    Orchestrates full benchmark training, hyperparameter fitting, threshold tuning,
    evaluation on held-out test data, and artifact export.
    """

    ARTIFACTS_DIR = Path(__file__).resolve().parent / "artifacts"

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
        Executes end-to-end benchmark comparison across all models.
        Split strategies:
          - 'stratified_random' (70/15/15)
          - 'time_aware_chronological' (70/15/15)
          - 'stratified_80_20' (64/16/20)
          - 'chronological_80_20' (64/16/20)
        """
        logger.info("Initializing SECOM dataset benchmark (strategy=%s)...", split_strategy)
        loader = SECOMDataLoader()
        X_raw, y_raw, timestamps = loader.load_raw()
        meta = loader.get_provenance_metadata()

        # 1. Split Data
        if split_strategy == "time_aware_chronological":
            splits = QualityDataSplitter.chronological_split(
                X_raw, y_raw, timestamps=timestamps, train_ratio=0.70, val_ratio=0.15
            )
        elif split_strategy == "stratified_80_20":
            splits = QualityDataSplitter.stratified_split_80_20(
                X_raw, y_raw, random_state=self.random_state, timestamps=timestamps
            )
        elif split_strategy == "chronological_80_20":
            splits = QualityDataSplitter.chronological_split_80_20(
                X_raw, y_raw, timestamps=timestamps
            )
        else:
            splits = QualityDataSplitter.stratified_split(
                X_raw, y_raw, train_ratio=0.70, val_ratio=0.15, random_state=self.random_state, timestamps=timestamps
            )

        # 2. Fit Preprocessor Strictly on Training Split (Zero Leakage)
        preprocessor = QualityDataPreprocessor(
            max_missing_ratio=0.50,
            clip_zscore=5.0,
            add_missing_indicators=True,
        )
        X_train = preprocessor.fit_transform(splits.X_train)
        X_val = preprocessor.transform(splits.X_val)
        X_test = preprocessor.transform(splits.X_test)

        y_train = splits.y_train
        y_val = splits.y_val
        y_test = splits.y_test

        models: Dict[str, Any] = {
            "Majority_Baseline": MajorityDummyQualityClassifier(),
            "CostSensitive_LogisticRegression": CostSensitiveLogisticRegression(
                learning_rate=0.01,
                weight_decay=0.02,
                max_epochs=150,
                random_state=self.random_state,
            ),
            "Balanced_RandomForest": BalancedRandomForestQualityClassifier(
                n_estimators=45,
                max_depth=7,
                min_samples_split=4,
                majority_ratio=2.0,
                random_state=self.random_state,
            ),
            "Gradient_Boosting": GradientBoostedQualityClassifier(
                n_estimators=50,
                learning_rate=0.08,
                random_state=self.random_state,
            ),
        }

        cal_eval = QualityCalibrationEvaluator(n_bins=8)
        results: Dict[str, Any] = {}
        fitted_calibrators: Dict[str, Optional[ProbabilityCalibrator]] = {}
        best_model_name = "CostSensitive_LogisticRegression"
        best_macro_f1 = -1.0

        for name, model in models.items():
            logger.info("Fitting model: %s", name)
            model.fit(X_train, y_train)

            # Predict raw probabilities
            val_probs = model.predict_proba(X_val)
            test_probs = model.predict_proba(X_test)

            # Optimize threshold on validation set
            if name == "Majority_Baseline":
                opt_thresh = 0.50
                calibrator = None
                cal_metrics_raw = cal_eval.evaluate(y_test, test_probs)
                cal_metrics_cal = cal_metrics_raw
            else:
                opt_thresh, _, _ = ThresholdOptimizer.optimize_threshold(
                    y_val_true=y_val,
                    y_val_prob=val_probs,
                    criterion="f1_fail",
                )
                # Fit calibrator strictly on validation probabilities (zero test-set leakage)
                calibrator = ProbabilityCalibrator(method="platt").fit(val_probs, y_val)
                test_probs_cal = calibrator.calibrate(test_probs)

                cal_metrics_raw = cal_eval.evaluate(y_test, test_probs)
                cal_metrics_cal = cal_eval.evaluate(y_test, test_probs_cal)

            fitted_calibrators[name] = calibrator

            # Compute test set performance at standard 0.50 threshold and optimal threshold
            metrics_default = QualityMetricsCalculator.compute(y_test, test_probs, threshold=0.50)
            metrics_optimal = QualityMetricsCalculator.compute(y_test, test_probs, threshold=opt_thresh)

            results[name] = {
                "default_threshold_0_50": metrics_default.to_dict(),
                "optimal_threshold": metrics_optimal.to_dict(),
                "optimal_threshold_value": opt_thresh,
                "calibration_raw": cal_metrics_raw,
                "calibration_calibrated": cal_metrics_cal,
                "calibration": cal_metrics_cal,  # Calibrated evaluator for downstream consumers
            }

            if metrics_optimal.macro_f1 > best_macro_f1 and name != "Majority_Baseline":
                best_macro_f1 = metrics_optimal.macro_f1
                best_model_name = name

        # 3. Determine Model to Export
        target_export_name = export_model_name or best_model_name
        export_model = models[target_export_name]
        export_info = results[target_export_name]
        export_calibrator = fitted_calibrators.get(target_export_name)

        model_metadata = PredictiveQualityModelMetadata(
            model_name=f"SolarVision_{target_export_name}",
            model_version=Model3ArtifactContract.MODEL_VERSION,
            created_at=datetime.now(timezone.utc).isoformat(),
            domain=Model3ArtifactContract.DOMAIN,
            framework="PyTorch_NumPy_SciPy",
            dataset_name=meta.dataset_name,
            dataset_doi=meta.doi,
            dataset_license=meta.license,
            training_samples=len(X_train),
            val_samples=len(X_val),
            test_samples=len(X_test),
            input_feature_count=preprocessor.n_input_features,
            retained_feature_count=len(preprocessor.retained_feature_indices),
            output_feature_count=preprocessor.n_output_features,
            split_strategy=split_strategy,
            target_labels={"Pass": 0, "Fail": 1},
            optimal_threshold=export_info["optimal_threshold_value"],
            test_metrics=export_info["optimal_threshold"],
            calibration_metrics=export_info["calibration_calibrated"],
            reproducibility={
                "random_state": self.random_state,
                "constant_features_dropped": len(preprocessor.constant_feature_indices),
                "high_missing_features_dropped": len(preprocessor.high_missing_feature_indices),
            },
            status="BENCHMARK_EVALUATED_READY",
        )

        # Build model payload including calibrator
        model_dict = export_model.to_dict()
        if export_calibrator is not None:
            model_dict["calibrator"] = export_calibrator.to_dict()

        artifact_file = self.output_dir / "model3_predictive_quality.json"
        artifact_path, sha256_hash = Model3ArtifactContract.serialize_artifact(
            metadata=model_metadata,
            model_payload=model_dict,
            preprocessor_dict=preprocessor.to_dict(),
            output_path=artifact_file,
        )

        logger.info(
            "Benchmark complete. Exported model: %s (Test Macro-F1: %.4f). Saved to %s (SHA256: %s)",
            target_export_name,
            export_info["optimal_threshold"]["macro_f1"],
            artifact_path,
            sha256_hash[:12],
        )

        return {
            "dataset_metadata": meta,
            "splits": {
                "train": splits.train_summary,
                "val": splits.val_summary,
                "test": splits.test_summary,
            },
            "preprocessing": {
                "input_features": preprocessor.n_input_features,
                "dropped_constant_count": len(preprocessor.constant_feature_indices),
                "dropped_high_missing_count": len(preprocessor.high_missing_feature_indices),
                "retained_feature_count": len(preprocessor.retained_feature_indices),
                "output_feature_count": preprocessor.n_output_features,
            },
            "models_evaluated": results,
            "best_model_name": best_model_name,
            "exported_model_name": target_export_name,
            "artifact_path": str(artifact_path),
            "sha256_hash": sha256_hash,
        }
