"""
SolarVision AI — Model 3: Predictive Quality Benchmark Runner
Executes genuine training on the UCI SECOM dataset, evaluates both Stratified
and Time-Aware Chronological splits, and reports comprehensive metrics.
"""

from __future__ import annotations

import json
import logging
import sys
import time
from pathlib import Path
import numpy as np

# Setup logging
logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("run_benchmark")

# Add project root to sys.path
project_root = Path(__file__).resolve().parent.parent.parent.parent
if str(project_root) not in sys.path:
    sys.path.insert(0, str(project_root))

from backend.predictive_quality_data.loader import SECOMDataLoader
from backend.predictive_quality_data.preprocessor import QualityDataPreprocessor
from backend.predictive_quality_data.splitter import QualityDataSplitter
from backend.evaluation.predictive_quality.metrics import QualityMetricsCalculator
from backend.evaluation.predictive_quality.calibration import (
    ProbabilityCalibrator,
    QualityCalibrationEvaluator,
)
from backend.evaluation.predictive_quality.threshold import ThresholdOptimizer
from backend.training.predictive_quality.trainer import PredictiveQualityTrainer
from backend.training.predictive_quality.logistic_regression import CostSensitiveLogisticRegression
from backend.training.predictive_quality.gradient_boosting import GradientBoostedQualityClassifier


def format_table(results: dict, strategy_name: str) -> str:
    models = results["models_evaluated"]
    lines = []
    lines.append(f"\n=======================================================================================================================")
    lines.append(f" MODEL 3 EVALUATION BENCHMARK: {strategy_name.upper()}")
    lines.append(f" Dataset: UCI SECOM (1567 samples, 590 raw features, 104 fails, 14.1:1 imbalance)")
    lines.append(f"=======================================================================================================================")
    lines.append(f"{'Model':<35} | {'Acc':<6} | {'BalAcc':<6} | {'FailRec':<7} | {'FailPrec':<8} | {'FailF1':<6} | {'MacF1':<6} | {'ROC-AUC':<7} | {'PR-AUC':<6} | {'ECE(raw)':<8} | {'ECE(cal)':<8} | {'Thresh':<6}")
    lines.append("-" * 135)

    for m_name, m_data in models.items():
        opt = m_data["optimal_threshold"]
        th = m_data["optimal_threshold_value"]
        ece_raw = m_data.get("calibration_raw", {}).get("expected_calibration_error_ece", 0.0)
        ece_cal = m_data.get("calibration_calibrated", {}).get("expected_calibration_error_ece", 0.0)
        lines.append(
            f"{m_name:<35} | "
            f"{opt['accuracy']*100:5.1f}% | "
            f"{opt['balanced_accuracy']*100:5.1f}% | "
            f"{opt['recall_fail']*100:6.1f}% | "
            f"{opt['precision_fail']*100:7.1f}% | "
            f"{opt['f1_fail']:6.3f} | "
            f"{opt['macro_f1']:6.3f} | "
            f"{opt['roc_auc']:7.3f} | "
            f"{opt['pr_auc']:6.3f} | "
            f"{ece_raw:8.4f} | "
            f"{ece_cal:8.4f} | "
            f"{th:6.2f}"
        )

    lines.append("=" * 135)
    return "\n".join(lines)


def run_rolling_retraining_benchmark(random_state: int = 42) -> dict:
    """Evaluates time-aware rolling retraining compared to static training."""
    loader = SECOMDataLoader()
    X_raw, y_raw, timestamps = loader.load_raw()

    splits = QualityDataSplitter.chronological_split(
        X_raw, y_raw, timestamps=timestamps, train_ratio=0.70, val_ratio=0.15
    )

    # 1. Static model: Train on 70% (July-Aug), test on 15% (Oct)
    prep_static = QualityDataPreprocessor()
    X_tr = prep_static.fit_transform(splits.X_train)
    X_va = prep_static.transform(splits.X_val)
    X_te = prep_static.transform(splits.X_test)
    y_tr = splits.y_train
    y_va = splits.y_val
    y_te = splits.y_test

    model_static = GradientBoostedQualityClassifier(n_estimators=50, learning_rate=0.08, random_state=random_state)
    model_static.fit(X_tr, y_tr)
    val_probs = model_static.predict_proba(X_va)
    test_probs_static = model_static.predict_proba(X_te)
    opt_th_static, _, _ = ThresholdOptimizer.optimize_threshold(y_va, val_probs, criterion="f1_fail")
    metrics_static = QualityMetricsCalculator.compute(y_te, test_probs_static, threshold=opt_th_static)

    # 2. Rolling Retrained model: Train on 85% (Train + Val, July-Late Sept), test on 15% (Oct)
    X_combined = np.vstack([splits.X_train, splits.X_val])
    y_combined = np.concatenate([y_tr, y_va])
    prep_rolling = QualityDataPreprocessor()
    X_tr_roll = prep_rolling.fit_transform(X_combined)
    X_te_roll = prep_rolling.transform(splits.X_test)

    model_rolling = GradientBoostedQualityClassifier(n_estimators=50, learning_rate=0.08, random_state=random_state)
    model_rolling.fit(X_tr_roll, y_combined)
    test_probs_rolling = model_rolling.predict_proba(X_te_roll)
    # Use same operating threshold for apples-to-apples comparison
    metrics_rolling = QualityMetricsCalculator.compute(y_te, test_probs_rolling, threshold=opt_th_static)

    return {
        "static": metrics_static.to_dict(),
        "rolling": metrics_rolling.to_dict(),
        "threshold": opt_th_static,
    }


def main():
    print("\n" + "#" * 90)
    print(" SOLARVISION AI — MODEL 3: SCIENTIFIC PREDICTIVE QUALITY BENCHMARK")
    print(" Rigorous Validation on UCI SECOM Dataset (CC-BY 4.0)")
    print("#" * 90)

    trainer = PredictiveQualityTrainer()
    benchmark_report = {}

    # 1. Stratified 70/15/15 Benchmark
    t0 = time.perf_counter()
    res_strat_70 = trainer.run_benchmark(split_strategy="stratified_random")
    t_strat_70 = time.perf_counter() - t0
    print(format_table(res_strat_70, "Stratified Split (70/15/15 Protocol)"))
    print(f"Elapsed: {t_strat_70:.2f}s")
    benchmark_report["stratified_70_15_15"] = res_strat_70

    # 2. Stratified Reconciled 80/20 Benchmark (64% train, 16% val, 20% test)
    t0 = time.perf_counter()
    res_strat_80 = trainer.run_benchmark(split_strategy="stratified_80_20")
    t_strat_80 = time.perf_counter() - t0
    print(format_table(res_strat_80, "Stratified Reconciled Split (80/20 Protocol: 64 Train / 16 Val / 20 Test)"))
    print(f"Elapsed: {t_strat_80:.2f}s")
    benchmark_report["stratified_80_20"] = res_strat_80

    # 3. Time-Aware Chronological 70/15/15 Benchmark
    t0 = time.perf_counter()
    res_chrono_70 = trainer.run_benchmark(split_strategy="time_aware_chronological")
    t_chrono_70 = time.perf_counter() - t0
    print(format_table(res_chrono_70, "Time-Aware Chronological Split (70/15/15 Protocol)"))
    print(f"Elapsed: {t_chrono_70:.2f}s")
    benchmark_report["chronological_70_15_15"] = res_chrono_70

    # 4. Time-Aware Chronological 80/20 Benchmark
    t0 = time.perf_counter()
    res_chrono_80 = trainer.run_benchmark(split_strategy="chronological_80_20")
    t_chrono_80 = time.perf_counter() - t0
    print(format_table(res_chrono_80, "Time-Aware Chronological Split (80/20 Protocol: 64 Train / 16 Val / 20 Test)"))
    print(f"Elapsed: {t_chrono_80:.2f}s")
    benchmark_report["chronological_80_20"] = res_chrono_80

    # 5. Rolling Retraining Analysis
    print("\n" + "=" * 90)
    print(" TEMPORAL DRIFT & ROLLING RETRAINING ANALYSIS (Gradient Boosting)")
    print("=" * 90)
    roll_res = run_rolling_retraining_benchmark()
    m_stat = roll_res["static"]
    m_roll = roll_res["rolling"]
    print(f"{'Metric':<25} | {'Static Model (70% Train)':<26} | {'Rolling Retrained (85% Train)':<28} | {'Relative Delta':<15}")
    print("-" * 105)
    print(f"{'ROC-AUC':<25} | {m_stat['roc_auc']:26.4f} | {m_roll['roc_auc']:28.4f} | {m_roll['roc_auc'] - m_stat['roc_auc']:+15.4f}")
    print(f"{'PR-AUC':<25} | {m_stat['pr_auc']:26.4f} | {m_roll['pr_auc']:28.4f} | {m_roll['pr_auc'] - m_stat['pr_auc']:+15.4f}")
    print(f"{'Failure Recall':<25} | {m_stat['recall_fail']*100:25.1f}% | {m_roll['recall_fail']*100:27.1f}% | {(m_roll['recall_fail']-m_stat['recall_fail'])*100:+14.1f}%")
    print(f"{'Failure Precision':<25} | {m_stat['precision_fail']*100:25.1f}% | {m_roll['precision_fail']*100:27.1f}% | {(m_roll['precision_fail']-m_stat['precision_fail'])*100:+14.1f}%")
    print(f"{'Failure F1':<25} | {m_stat['f1_fail']:26.4f} | {m_roll['f1_fail']:28.4f} | {m_roll['f1_fail'] - m_stat['f1_fail']:+15.4f}")
    print(f"{'Macro F1':<25} | {m_stat['macro_f1']:26.4f} | {m_roll['macro_f1']:28.4f} | {m_roll['macro_f1'] - m_stat['macro_f1']:+15.4f}")
    print("=" * 105)
    benchmark_report["rolling_analysis"] = roll_res

    # 6. Ensure Final Exported Canonical Production Benchmark Artifact
    res_canonical = trainer.run_benchmark(
        split_strategy="time_aware_chronological",
        export_model_name="Gradient_Boosting",
    )
    benchmark_report["canonical_artifact"] = {
        "artifact_path": res_canonical["artifact_path"],
        "sha256_hash": res_canonical["sha256_hash"],
        "optimal_threshold": res_canonical["models_evaluated"]["Gradient_Boosting"]["optimal_threshold_value"],
        "output_feature_count": res_canonical["preprocessing"]["output_feature_count"],
    }

    # Save summary report to JSON in output_dir
    report_file = trainer.output_dir / "benchmark_summary.json"
    report_file.write_text(json.dumps(benchmark_report, indent=2, default=str), encoding="utf-8")
    print(f"\nComprehensive benchmark summary written to: {report_file}")
    print(f"Canonical production artifact written to: {res_canonical['artifact_path']}")
    print(f"Artifact SHA-256 Hash: {res_canonical['sha256_hash']}")
    print(f"Artifact Output Feature Dimensions: {res_canonical['preprocessing']['output_feature_count']}-D")
    print(f"Artifact Optimal Decision Threshold: {res_canonical['models_evaluated']['Gradient_Boosting']['optimal_threshold_value']}")


if __name__ == "__main__":
    main()
