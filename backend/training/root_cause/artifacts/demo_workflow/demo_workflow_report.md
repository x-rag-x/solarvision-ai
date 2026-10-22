# SolarVision AI — Model 2 Controlled Demonstration Report
**Status:** `DATASET_BLOCKED_DEMONSTRATION_ONLY`  
**Execution Date:** `2026-10-22T05:31:11.086910+00:00`  
**Elapsed Execution Time:** `0.24s`  

> [!CAUTION]
> **Controlled Demonstration Notice**
> The metrics in this document were generated using synthetic software fixtures to verify the end-to-end data pipeline, feature extraction, temporal splitting, and artifact contracts.
> They DO NOT represent production accuracy on real solar cell manufacturing equipment. Real Model 2 status remains **DATASET_BLOCKED**.

## Verification Summary
- **Synthetic Records Processed:** 200
- **Feature Vector Dimensions:** 48 (Schema v2.0.0)
- **Temporal Partitions:** Train=140, Val=30, Test=30
- **Leakage Prevention:** Strict chronological ordering enforced.
- **Preprocessing:** Normalization statistics fit strictly on training data (D_train).
- **Out-of-Bag (OOB) Accuracy:** 37.14%
- **Held-out Test Macro-F1:** 40.56%
- **Expected Calibration Error (ECE):** 0.3227
