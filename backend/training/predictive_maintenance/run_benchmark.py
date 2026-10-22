"""
SolarVision AI — Model 4: Predictive Maintenance Benchmark Runner
Executes training on UCI AI4I 2020 dataset, evaluates both Stratified 70/15/15
and Reconciled 80/20 splits across 4 models, and serializes the verified artifact.
"""

from __future__ import annotations

import json
import logging
from pathlib import Path
import sys
import time

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("run_model4_benchmark")

project_root = Path(__file__).resolve().parent.parent.parent.parent
if str(project_root) not in sys.path:
    sys.path.insert(0, str(project_root))

from backend.training.predictive_maintenance.trainer import PredictiveMaintenanceTrainer


def format_table(results: dict, strategy_name: str) -> str:
    models = results["models_evaluated"]
    lines = []
    lines.append("\n=======================================================================================================================")
    lines.append(f" MODEL 4 EVALUATION BENCHMARK: {strategy_name.upper()}")
    lines.append(" Dataset: UCI AI4I 2020 Predictive Maintenance (10,000 samples, 6 features, 339 failures, 28.5:1 imbalance)")
    lines.append("=======================================================================================================================")
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
            f"{opt['recall_failure']*100:6.1f}% | "
            f"{opt['precision_failure']*100:7.1f}% | "
            f"{opt['f1_failure']:6.3f} | "
            f"{opt['macro_f1']:6.3f} | "
            f"{opt['roc_auc']:7.3f} | "
            f"{opt['pr_auc']:6.3f} | "
            f"{ece_raw:8.4f} | "
            f"{ece_cal:8.4f} | "
            f"{th:6.2f}"
        )

    lines.append("=" * 135)
    return "\n".join(lines)


def main():
    print("\n" + "#" * 90)
    print(" SOLARVISION AI — MODEL 4: PREDICTIVE MAINTENANCE BENCHMARK TRAINING")
    print(" Genuine Supervised Benchmark Training on UCI AI4I 2020 Dataset (CC-BY 4.0)")
    print("#" * 90)

    trainer = PredictiveMaintenanceTrainer()
    benchmark_report = {}

    # 1. Stratified 70/15/15 Benchmark
    t0 = time.perf_counter()
    res_strat_70 = trainer.run_benchmark(split_strategy="stratified_random")
    t_strat_70 = time.perf_counter() - t0
    print(format_table(res_strat_70, "Stratified Random Split (70/15/15 Protocol)"))
    print(f"Elapsed: {t_strat_70:.2f}s")
    benchmark_report["stratified_70_15_15"] = res_strat_70

    # 2. Stratified Reconciled 80/20 Benchmark
    t0 = time.perf_counter()
    res_strat_80 = trainer.run_benchmark(split_strategy="stratified_80_20")
    t_strat_80 = time.perf_counter() - t0
    print(format_table(res_strat_80, "Stratified Reconciled Split (80/20 Protocol: 64 Train / 16 Val / 20 Test)"))
    print(f"Elapsed: {t_strat_80:.2f}s")
    benchmark_report["stratified_80_20"] = res_strat_80

    # 3. Save Final Canonical Benchmark Artifact
    res_canonical = trainer.run_benchmark(
        split_strategy="stratified_random",
        export_model_name="Gradient_Boosting",
    )
    benchmark_report["canonical_artifact"] = {
        "artifact_path": res_canonical["artifact_path"],
        "sha256_hash": res_canonical["sha256_hash"],
        "optimal_threshold": res_canonical["models_evaluated"]["Gradient_Boosting"]["optimal_threshold_value"],
        "output_feature_count": res_canonical["preprocessing"]["output_features"],
    }

    report_file = trainer.output_dir / "benchmark_summary.json"
    report_file.write_text(json.dumps(benchmark_report, indent=2, default=str), encoding="utf-8")
    print(f"\nComprehensive benchmark summary written to: {report_file}")
    print(f"Canonical production artifact written to: {res_canonical['artifact_path']}")
    print(f"Artifact SHA-256 Hash: {res_canonical['sha256_hash']}")
    print(f"Artifact Output Feature Dimensions: {res_canonical['preprocessing']['output_features']}-D")
    print(f"Artifact Optimal Decision Threshold: {res_canonical['models_evaluated']['Gradient_Boosting']['optimal_threshold_value']}")


if __name__ == "__main__":
    main()
