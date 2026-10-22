"""
SolarVision AI — Model 2: Manufacturing Root Cause Analysis
Controlled Demonstration Workflow & End-to-End Pipeline Verification

================================================================================
CRITICAL COMPLIANCE NOTICE:
STATUS: DATASET_BLOCKED (CONTROLLED DEMONSTRATION ONLY)
This script runs strictly on synthetic test fixtures to verify software behavior,
leakage prevention, and artifact generation.
It NEVER claims real-world model accuracy, production certification, or causal validity.
================================================================================
"""

from __future__ import annotations

import json
from pathlib import Path
import sys
import time
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Tuple
import numpy as np

# Ensure repository root is on sys.path
REPO_ROOT = Path(__file__).resolve().parent.parent.parent.parent
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from backend.root_cause_data.schema import (

    ROOT_CAUSE_TAXONOMY,
    ROOT_CAUSE_DESCRIPTIONS,
    ModelReadyFeatureVector,
)
from backend.root_cause_data.feature_spec import (
    CANONICAL_FEATURES_V2,
    CANONICAL_FEATURE_NAMES_V2,
    CANONICAL_FEATURE_COUNT_V2,
    FEATURE_SCHEMA_VERSION,
)
from backend.root_cause_data.fixtures import generate_pipeline_test_fixtures
from backend.root_cause_data.splitter import LeakageFreeSplitter
from backend.root_cause_data.preprocessor import TrainingOnlyFeaturePreprocessor
from backend.training.root_cause.baseline import MajorityClassBaseline, DefectPriorHeuristicBaseline
from backend.training.root_cause.tree_model import RandomForestClassifier
from backend.training.root_cause.contract import Model2ArtifactContract
from backend.evaluation.root_cause.metrics import RootCauseMetricsCalculator
from backend.evaluation.root_cause.confusion_matrix import ConfusionMatrixCalculator
from backend.evaluation.root_cause.calibration import CalibrationEvaluator


ARTIFACTS_DIR = Path(__file__).resolve().parent / "artifacts" / "demo_workflow"


def run_controlled_demonstration() -> Dict[str, Any]:
    print("\n" + "=" * 80)
    print(" SOLARVISION AI — MODEL 2 CONTROLLED DEMONSTRATION WORKFLOW")
    print(" STATUS: DATASET_BLOCKED — SOFTWARE PIPELINE VERIFICATION ONLY")
    print("=" * 80)

    ARTIFACTS_DIR.mkdir(parents=True, exist_ok=True)
    t0 = time.perf_counter()

    # 1. Generate Synthetic Test Fixtures (Strictly marked synthetic)
    print("\n[Step 1/8] Generating synthetic test fixtures (is_synthetic=True)...")
    inspections, readings, ground_truths = generate_pipeline_test_fixtures(
        n_batches=8,
        wafers_per_batch=25,
        samples_per_sensor=15,
        seed=42,
    )
    print(f"  • Generated {len(inspections)} synthetic inspection events")
    print(f"  • Generated {len(readings)} synthetic sensor readings")
    print(f"  • Generated {len(ground_truths)} synthetic ground truth labels")

    # 2. Extract Feature Vectors conforming to Canonical 48-D Schema
    print("\n[Step 2/8] Assembling canonical 48-dimensional feature vectors...")
    rng = np.random.RandomState(42)
    n_samples = len(inspections)
    n_features = CANONICAL_FEATURE_COUNT_V2

    feature_matrix = np.zeros((n_samples, n_features), dtype=np.float32)
    labels: List[str] = [ground_truths[insp["inspection_id"]].confirmed_cause for insp in inspections]
    label_indices = np.array([ROOT_CAUSE_TAXONOMY.index(c) for c in labels], dtype=np.int64)


    # Populate synthetic signal
    for i in range(n_samples):
        # Defect count
        feature_matrix[i, 0] = float(rng.poisson(1.5))
        feature_matrix[i, 9] = feature_matrix[i, 0]
        # Machine one-hot (stringer default)
        feature_matrix[i, 15] = 1.0
        feature_matrix[i, 22] = 1.0  # operational
        feature_matrix[i, 27] = 1.0  # monocrystalline
        # Synthetic sensor signals correlated with causes
        c_idx = label_indices[i]
        if c_idx == 0:  # thermal stress soldering
            feature_matrix[i, 32] = float(rng.normal(2.5, 0.5))  # High soldering head temp
        elif c_idx == 1:  # squeegee pressure drift
            feature_matrix[i, 35] = float(rng.normal(-2.2, 0.4))  # Low squeegee pressure
        elif c_idx == 4:  # mechanical handling
            feature_matrix[i, 40] = float(rng.normal(-3.0, 0.3))  # Extreme gripper vacuum

    # 3. Create ModelReadyFeatureVector instances and execute Temporal Split
    print("\n[Step 3/8] Executing temporal split (70% Train, 15% Val, 15% Test)...")
    base_time = datetime(2026, 1, 1, 0, 0, 0, tzinfo=timezone.utc)
    records = [
        ModelReadyFeatureVector(
            sample_id=f"demo-sample-{i:04d}",
            inspection_id=inspections[i]["inspection_id"],
            batch_id=inspections[i]["batch_id"],
            machine_id=inspections[i]["machine_id"],
            timestamp=inspections[i]["created_at"],
            features=feature_matrix[i].tolist(),
            feature_names=list(CANONICAL_FEATURE_NAMES_V2),
            ground_truth_cause=labels[i],
            label_index=int(label_indices[i]),
        )
        for i in range(n_samples)
    ]

    train_recs, val_recs, test_recs = LeakageFreeSplitter.temporal_split(
        records, train_ratio=0.70, val_ratio=0.15
    )
    print(f"  • Train split: {len(train_recs)} records (max_t: {max(r.timestamp for r in train_recs).isoformat()})")
    print(f"  • Val split:   {len(val_recs)} records (min_t: {min(r.timestamp for r in val_recs).isoformat()})")
    print(f"  • Test split:  {len(test_recs)} records (min_t: {min(r.timestamp for r in test_recs).isoformat()})")

    X_train_raw = np.array([r.features for r in train_recs], dtype=np.float32)
    y_train = np.array([r.label_index for r in train_recs], dtype=np.int64)

    X_val_raw = np.array([r.features for r in val_recs], dtype=np.float32)
    y_val = np.array([r.label_index for r in val_recs], dtype=np.int64)

    X_test_raw = np.array([r.features for r in test_recs], dtype=np.float32)
    y_test = np.array([r.label_index for r in test_recs], dtype=np.int64)

    # 4. Fit Training-Only Preprocessor (Zero Leakage)
    print("\n[Step 4/8] Fitting preprocessor strictly on training split...")
    preprocessor = TrainingOnlyFeaturePreprocessor(clip_zscore=5.0)
    X_train_scaled, mask_train = preprocessor.fit_transform(X_train_raw)
    X_val_scaled, mask_val = preprocessor.transform(X_val_raw)
    X_test_scaled, mask_test = preprocessor.transform(X_test_raw)

    scaler_path = ARTIFACTS_DIR / "demo_scaler_params.json"
    preprocessor.save(scaler_path)
    print(f"  • Preprocessor parameters saved to: {scaler_path}")

    # 5. Evaluate Baselines
    print("\n[Step 5/8] Fitting benchmark baselines...")
    maj_baseline = MajorityClassBaseline()
    maj_baseline.fit(y_train)
    maj_probs = maj_baseline.predict_proba(X_val_scaled)
    maj_preds = np.argmax(maj_probs, axis=1)
    maj_acc = float(np.mean(maj_preds == y_val))
    print(f"  • Majority Class Baseline Val Accuracy: {maj_acc * 100:.2f}%")

    # 6. Train Random Forest Classifier
    print("\n[Step 6/8] Training Random Forest ensemble (50 trees, max_depth=8)...")
    rf = RandomForestClassifier(
        n_estimators=50,
        max_depth=8,
        min_samples_split=3,
        random_state=42,
        num_classes=len(ROOT_CAUSE_TAXONOMY),
    )
    rf.fit(X_train_scaled, y_train)
    print(f"  • Out-of-Bag (OOB) Accuracy: {rf.oob_score_ * 100:.2f}%")

    val_probs = rf.predict_proba(X_val_scaled)
    val_preds = np.argmax(val_probs, axis=1)
    val_acc = float(np.mean(val_preds == y_val))
    print(f"  • Validation Set Accuracy:   {val_acc * 100:.2f}%")

    # 7. Independent Test Evaluation
    print("\n[Step 7/8] Evaluating on held-out test split...")
    test_probs = rf.predict_proba(X_test_scaled)
    test_preds = np.argmax(test_probs, axis=1)

    metrics_calc = RootCauseMetricsCalculator(class_names=ROOT_CAUSE_TAXONOMY)
    metrics = metrics_calc.calculate(y_test, test_preds)
    cm_calc = ConfusionMatrixCalculator(class_names=ROOT_CAUSE_TAXONOMY)
    cm_results = cm_calc.calculate(y_test, test_preds)
    cal_eval = CalibrationEvaluator(n_bins=5)
    cal_results = cal_eval.evaluate_calibration(y_test, test_probs)

    print(f"  • Test Accuracy:        {metrics.accuracy * 100:.2f}%")
    print(f"  • Test Macro-F1:        {metrics.macro_f1 * 100:.2f}%")
    print(f"  • Test Expected Calib:  {cal_results['expected_calibration_error_ece']:.4f} (ECE)")

    # 8. Serialize Demo Artifacts & Report
    print("\n[Step 8/8] Serializing demonstration artifacts...")
    model_json_path = ARTIFACTS_DIR / "demo_random_forest.json"
    with open(model_json_path, "w", encoding="utf-8") as f:
        json.dump(rf.to_dict(), f, indent=2)

    manifest_path = ARTIFACTS_DIR / "demo_manifest.json"
    manifest_data = {
        "model_id": "model-2-root-cause-demo",
        "model_name": "SolarVision Model 2 (Demonstration Prototype)",
        "version": "2.0.0-demo",
        "status": "DATASET_BLOCKED_DEMONSTRATION_ONLY",
        "is_production_ready": False,
        "framework": "numpy_vectorized_random_forest",
        "feature_schema_version": FEATURE_SCHEMA_VERSION,
        "input_dimensions": CANONICAL_FEATURE_COUNT_V2,
        "target_classes": ROOT_CAUSE_TAXONOMY,
        "test_metrics": {
            "synthetic_macro_f1": round(float(metrics.macro_f1), 4),
            "synthetic_accuracy": round(float(metrics.accuracy), 4),
            "synthetic_ece": round(float(cal_results["expected_calibration_error_ece"]), 4),
        },
        "disclaimer": "SYNTHETIC FIXTURE DEMONSTRATION ONLY. NOT VALID FOR PRODUCTION INFERENCE.",
        "generated_at": datetime.now(timezone.utc).isoformat(),
    }
    with open(manifest_path, "w", encoding="utf-8") as f:
        json.dump(manifest_data, f, indent=2)

    report_md_path = ARTIFACTS_DIR / "demo_workflow_report.md"
    report_content = f"""# SolarVision AI — Model 2 Controlled Demonstration Report
**Status:** `DATASET_BLOCKED_DEMONSTRATION_ONLY`  
**Execution Date:** `{datetime.now(timezone.utc).isoformat()}`  
**Elapsed Execution Time:** `{(time.perf_counter() - t0):.2f}s`  

> [!CAUTION]
> **Controlled Demonstration Notice**
> The metrics in this document were generated using synthetic software fixtures to verify the end-to-end data pipeline, feature extraction, temporal splitting, and artifact contracts.
> They DO NOT represent production accuracy on real solar cell manufacturing equipment. Real Model 2 status remains **DATASET_BLOCKED**.

## Verification Summary
- **Synthetic Records Processed:** {n_samples}
- **Feature Vector Dimensions:** {CANONICAL_FEATURE_COUNT_V2} (Schema v{FEATURE_SCHEMA_VERSION})
- **Temporal Partitions:** Train={len(train_recs)}, Val={len(val_recs)}, Test={len(test_recs)}
- **Leakage Prevention:** Strict chronological ordering enforced.
- **Preprocessing:** Normalization statistics fit strictly on training data (D_train).
- **Out-of-Bag (OOB) Accuracy:** {rf.oob_score_ * 100:.2f}%
- **Held-out Test Macro-F1:** {metrics.macro_f1 * 100:.2f}%
- **Expected Calibration Error (ECE):** {cal_results['expected_calibration_error_ece']:.4f}
"""

    with open(report_md_path, "w", encoding="utf-8") as f:
        f.write(report_content)

    print(f"\n[Complete] Demonstration workflow finished in {time.perf_counter() - t0:.2f}s.")
    print(f"Artifacts saved to: {ARTIFACTS_DIR}")
    return manifest_data


if __name__ == "__main__":
    run_controlled_demonstration()
