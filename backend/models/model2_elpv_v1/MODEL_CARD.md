# SolarVision Model 2 — ELPV Defectiveness Assessment

Task: classify a **full single-cell EL crop** as visually healthy vs defective, using only confidently judged ELPV labels.

Dataset: ELPV (images CC BY-NC-SA 4.0; separate permission for commercial use). Source: https://github.com/zae-bayern/elpv-dataset.

Input: 300x300-style single-cell grayscale EL image; resize to 224, repeat to 3 channels and apply ImageNet normalization.

Train/validation/test confident counts: 1556 / 359 / 308.

Test macro-F1: 0.6617; ROC-AUC: 0.8029; defective recall: 0.6867.

Brightness-only ROC-AUC diagnostic: 0.6952.

Important: original module IDs are not present. Filename-block and SSIM edge grouping is a leakage mitigation, not proof of module-independent validation. No factory decision, physical defect severity, or root-cause capability.

Threshold tuned on validation only: 0.550. Disclose validation method and class counts alongside metrics.
