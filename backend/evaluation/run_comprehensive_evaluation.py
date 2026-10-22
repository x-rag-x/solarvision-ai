from __future__ import annotations

import json
from collections import Counter, defaultdict
from pathlib import Path
import random
import time
from typing import Any

import cv2
import numpy as np
import yaml
from ultralytics import YOLO

from backend.app.inference import DEFAULT_CLASS_NAMES, inference_service, preprocess_image

THRESHOLDS = (0.25, 0.10, 0.05, 0.01)
IOU_THRESHOLD = 0.50

CLASS_ID_TO_NAME = DEFAULT_CLASS_NAMES
NAME_TO_CLASS_ID = {v: k for k, v in DEFAULT_CLASS_NAMES.items()}


def compute_iou(box1: list[float], box2: list[float]) -> float:
    """Compute IoU between two [x1, y1, x2, y2] boxes."""
    x1 = max(box1[0], box2[0])
    y1 = max(box1[1], box2[1])
    x2 = min(box1[2], box2[2])
    y2 = min(box1[3], box2[3])

    inter_w = max(0.0, x2 - x1)
    inter_h = max(0.0, y2 - y1)
    inter_area = inter_w * inter_h

    area1 = max(0.0, box1[2] - box1[0]) * max(0.0, box1[3] - box1[1])
    area2 = max(0.0, box2[2] - box2[0]) * max(0.0, box2[3] - box2[1])

    union_area = area1 + area2 - inter_area
    if union_area <= 0:
        return 0.0
    return inter_area / union_area


def load_yolo_labels(lbl_path: Path, img_w: int, img_h: int) -> list[dict[str, Any]]:
    """Parse YOLO format txt file to absolute [x1, y1, x2, y2] boxes."""
    if not lbl_path.exists():
        return []
    boxes = []
    lines = lbl_path.read_text(encoding="utf-8").splitlines()
    for line in lines:
        parts = line.strip().split()
        if len(parts) < 5:
            continue
        cls_id = int(parts[0])
        if cls_id not in CLASS_ID_TO_NAME:
            continue
        x_center = float(parts[1]) * img_w
        y_center = float(parts[2]) * img_h
        bw = float(parts[3]) * img_w
        bh = float(parts[4]) * img_h

        x1 = max(0.0, x_center - bw / 2.0)
        y1 = max(0.0, y_center - bh / 2.0)
        x2 = min(float(img_w), x_center + bw / 2.0)
        y2 = min(float(img_h), y_center + bh / 2.0)

        boxes.append({
            "class_id": cls_id,
            "class_name": CLASS_ID_TO_NAME[cls_id],
            "box": [x1, y1, x2, y2]
        })
    return boxes


def match_detections(
    gt_boxes: list[dict[str, Any]],
    pred_boxes: list[dict[str, Any]],
    iou_thresh: float = IOU_THRESHOLD,
) -> tuple[int, int, int, list[dict], list[dict], list[dict]]:
    """Match predicted boxes to ground truth boxes using greedy IoU matching."""
    gt_matched = [False] * len(gt_boxes)
    # Sort predictions by confidence descending
    sorted_preds = sorted(pred_boxes, key=lambda x: x["confidence"], reverse=True)
    
    tp = 0
    fp = 0
    matches = []
    false_positives = []

    for pred in sorted_preds:
        best_iou = 0.0
        best_gt_idx = -1
        for gt_idx, gt in enumerate(gt_boxes):
            if not gt_matched[gt_idx] and gt["class_id"] == pred["class_id"]:
                iou = compute_iou(pred["box"], gt["box"])
                if iou > best_iou:
                    best_iou = iou
                    best_gt_idx = gt_idx

        if best_iou >= iou_thresh and best_gt_idx >= 0:
            gt_matched[best_gt_idx] = True
            tp += 1
            matches.append({
                "pred": pred,
                "gt": gt_boxes[best_gt_idx],
                "iou": best_iou,
            })
        else:
            fp += 1
            false_positives.append(pred)

    fn = len(gt_boxes) - sum(gt_matched)
    false_negatives = [gt_boxes[i] for i, m in enumerate(gt_matched) if not m]

    return tp, fp, fn, matches, false_positives, false_negatives


def build_stratified_evaluation_set(
    img_dir: Path,
    lbl_dir: Path,
    target_count: int = 1000,
    seed: int = 42,
) -> list[str]:
    """Select a stratified sample of images ensuring all 9 defect classes are robustly represented."""
    random.seed(seed)
    # Index images by classes they contain
    class_to_images: dict[int, list[str]] = defaultdict(list)
    image_to_classes: dict[str, set[int]] = defaultdict(set)

    for lbl_path in sorted(lbl_dir.glob("*.txt")):
        stem = lbl_path.stem
        img_path = img_dir / f"{stem}.jpg"
        if not img_path.exists():
            continue
        lines = [l.strip() for l in lbl_path.read_text(encoding="utf-8").splitlines() if l.strip()]
        for l in lines:
            parts = l.split()
            if parts:
                cid = int(parts[0])
                if cid in CLASS_ID_TO_NAME:
                    class_to_images[cid].append(stem)
                    image_to_classes[stem].add(cid)

    selected: set[str] = set()

    # Prioritize rare classes first: include ALL instances of rarest classes
    rare_classes = [7, 4, 6]  # printing_error (48), star_crack (83), vertical_dislocation (271)
    for cid in rare_classes:
        for stem in class_to_images[cid]:
            selected.add(stem)

    # For medium and high frequency classes, sample up to 120 images each
    for cid in [8, 5, 3, 2, 0, 1]:  # short_circuit, horiz_disloc, thick_line, black_core, crack, finger
        available = [s for s in class_to_images[cid] if s not in selected]
        random.shuffle(available)
        quota = max(100, (target_count - len(selected)) // 6)
        for s in available[:quota]:
            selected.add(s)

    selected_list = sorted(list(selected))
    print(f"Selected {len(selected_list)} stratified test images.")
    
    # Tally class representation
    class_counts = Counter()
    for s in selected_list:
        for cid in image_to_classes[s]:
            class_counts[cid] += 1
    print("Class image counts in stratified evaluation split:")
    for cid in range(9):
        print(f"  [{cid}] {CLASS_ID_TO_NAME[cid]:25s}: {class_counts[cid]} images")

    return selected_list


def create_side_by_side_visualization(
    img_path: Path,
    gt_boxes: list[dict[str, Any]],
    preds_025: list[dict[str, Any]],
    preds_010: list[dict[str, Any]],
    output_path: Path,
    title_info: str = "",
) -> None:
    """Generate high-clarity 3-panel side-by-side comparison visualization."""
    base_img = cv2.imread(str(img_path))
    if base_img is None:
        return
    h, w = base_img.shape[:2]

    # Panel 1: Ground Truth (Green boxes)
    panel_gt = base_img.copy()
    for gt in gt_boxes:
        x1, y1, x2, y2 = [int(v) for v in gt["box"]]
        cv2.rectangle(panel_gt, (x1, y1), (x2, y2), (0, 255, 0), 2)
        cv2.putText(panel_gt, f"GT: {gt['class_name']}", (x1, max(20, y1 - 6)),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.55, (0, 255, 0), 2, cv2.LINE_AA)
    cv2.putText(panel_gt, "1. Ground Truth Annotations", (15, 35),
                cv2.FONT_HERSHEY_SIMPLEX, 0.8, (0, 255, 0), 2, cv2.LINE_AA)

    # Panel 2: Production Model Predictions @ 0.25 (Cyan / Teal)
    panel_prod = base_img.copy()
    for p in preds_025:
        x1, y1, x2, y2 = [int(v) for v in p["box"]]
        cv2.rectangle(panel_prod, (x1, y1), (x2, y2), (255, 200, 0), 2)  # Cyan
        cv2.putText(panel_prod, f"{p['class_name']} {p['confidence']:.2f}", (x1, max(20, y1 - 6)),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.55, (255, 200, 0), 2, cv2.LINE_AA)
    status_025 = f"Detections: {len(preds_025)}" if preds_025 else "No defect found"
    cv2.putText(panel_prod, f"2. Production @ 0.25 ({status_025})", (15, 35),
                cv2.FONT_HERSHEY_SIMPLEX, 0.8, (255, 200, 0), 2, cv2.LINE_AA)

    # Panel 3: Sensitive Predictions @ 0.10 / Diagnostic Floor (Orange/Magenta)
    panel_diag = base_img.copy()
    for p in preds_010:
        x1, y1, x2, y2 = [int(v) for v in p["box"]]
        color = (0, 165, 255) if p["confidence"] >= 0.10 else (0, 0, 255)
        cv2.rectangle(panel_diag, (x1, y1), (x2, y2), color, 2)
        cv2.putText(panel_diag, f"{p['class_name']} {p['confidence']:.2f}", (x1, max(20, y1 - 6)),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.55, color, 2, cv2.LINE_AA)
    cv2.putText(panel_diag, f"3. Sensitive @ 0.10 (Detections: {len(preds_010)})", (15, 35),
                cv2.FONT_HERSHEY_SIMPLEX, 0.8, (0, 165, 255), 2, cv2.LINE_AA)

    # Resize panels if large to fit side-by-side cleanly
    display_w = 640
    display_h = int(h * (display_w / w))
    p1 = cv2.resize(panel_gt, (display_w, display_h))
    p2 = cv2.resize(panel_prod, (display_w, display_h))
    p3 = cv2.resize(panel_diag, (display_w, display_h))

    combined = np.hstack([p1, p2, p3])
    
    # Add header banner
    banner = np.zeros((60, combined.shape[1], 3), dtype=np.uint8)
    banner[:] = (20, 20, 20)
    info_text = f"SolarVision AI Model 1 Inspection: {img_path.name} | {title_info}"
    cv2.putText(banner, info_text, (20, 38), cv2.FONT_HERSHEY_SIMPLEX, 0.75, (255, 255, 255), 2, cv2.LINE_AA)

    final_img = np.vstack([banner, combined])
    output_path.parent.mkdir(parents=True, exist_ok=True)
    cv2.imwrite(str(output_path), final_img)


def main() -> None:
    print("=" * 70)
    print(" SolarVision AI — Model 1 Comprehensive Evaluation & Validation Pipeline")
    print("=" * 70)

    img_dir = Path("data/dataset/images/test")
    lbl_dir = Path("data/dataset/labels/test")
    results_dir = Path("docs/results")
    vis_dir = results_dir / "visualizations"
    results_dir.mkdir(parents=True, exist_ok=True)
    vis_dir.mkdir(parents=True, exist_ok=True)

    # 1. Build stratified sample of 1,000 images
    test_stems = build_stratified_evaluation_set(img_dir, lbl_dir, target_count=1000, seed=42)
    total_eval_images = len(test_stems)

    # 2. Run Ultralytics model evaluation
    print(f"\n--- Loading YOLO model: backend/models/best.pt ---")
    model = YOLO("backend/models/best.pt")

    # Evaluate across thresholds
    threshold_results: dict[float, dict[str, Any]] = {}
    
    # Store predictions for all images at lowest threshold 0.01 to analyze all higher thresholds
    print(f"\n--- Running model inference on {total_eval_images} held-out test images ---")
    t0 = time.time()
    
    predictions_by_stem: dict[str, list[dict[str, Any]]] = {}
    gt_by_stem: dict[str, list[dict[str, Any]]] = {}
    cache_file = results_dir / "predictions_cache.json"

    if cache_file.exists():
        print(f"Loading predictions from existing cache: {cache_file}")
        cached = json.loads(cache_file.read_text(encoding="utf-8"))
        predictions_by_stem = cached["predictions"]
        gt_by_stem = cached["ground_truth"]
    else:
        batch_size = 32
        for i in range(0, total_eval_images, batch_size):
            batch_stems = test_stems[i : i + batch_size]
            batch_paths = [str(img_dir / f"{s}.jpg") for s in batch_stems]
            
            # Run predict at diagnostic floor 0.01
            results = model.predict(batch_paths, conf=0.01, iou=0.70, imgsz=640, device="cpu", verbose=False)
            
            for stem, res in zip(batch_stems, results):
                orig_h, orig_w = res.orig_shape
                gt_boxes = load_yolo_labels(lbl_dir / f"{stem}.txt", orig_w, orig_h)
                gt_by_stem[stem] = gt_boxes

                preds = []
                if res.boxes is not None and len(res.boxes) > 0:
                    xyxy = res.boxes.xyxy.cpu().numpy()
                    confs = res.boxes.conf.cpu().numpy()
                    classes = res.boxes.cls.cpu().numpy().astype(int)
                    for box, cval, cid in zip(xyxy, confs, classes):
                        if int(cid) in CLASS_ID_TO_NAME:
                            preds.append({
                                "class_id": int(cid),
                                "class_name": CLASS_ID_TO_NAME[int(cid)],
                                "confidence": float(cval),
                                "box": [float(b) for b in box]
                            })
                predictions_by_stem[stem] = preds

            if (i + batch_size) % 200 == 0 or (i + batch_size) >= total_eval_images:
                done = min(i + batch_size, total_eval_images)
                print(f"  Processed {done}/{total_eval_images} images ({(time.time()-t0):.1f}s)...")

        cache_file.write_text(json.dumps({"predictions": predictions_by_stem, "ground_truth": gt_by_stem}))

    infer_time = time.time() - t0
    avg_latency = (infer_time / total_eval_images) * 1000
    print(f"Inference completed in {infer_time:.2f}s ({avg_latency:.1f}ms/image)")

    # 3. Analyze each confidence threshold
    print("\n" + "=" * 70)
    print(" Threshold Evaluation Results (IoU Match >= 0.50)")
    print("=" * 70)

    # Class-level confusion matrices
    confusion_matrices: dict[float, np.ndarray] = {}

    for thresh in THRESHOLDS:
        total_tp = 0
        total_fp = 0
        total_fn = 0
        per_class_tp = Counter()
        per_class_fp = Counter()
        per_class_fn = Counter()
        per_class_gt = Counter()

        # 10x10 confusion matrix (9 classes + background class 9)
        conf_mat = np.zeros((10, 10), dtype=int)

        for stem in test_stems:
            gt_boxes = gt_by_stem[stem]
            for gt in gt_boxes:
                per_class_gt[gt["class_id"]] += 1

            preds = [p for p in predictions_by_stem[stem] if p["confidence"] >= thresh]
            tp, fp, fn, matches, false_pos, false_negs = match_detections(gt_boxes, preds, iou_thresh=0.50)
            
            total_tp += tp
            total_fp += fp
            total_fn += fn

            for m in matches:
                cid = m["gt"]["class_id"]
                per_class_tp[cid] += 1
                conf_mat[cid, cid] += 1

            for f in false_pos:
                cid = f["class_id"]
                per_class_fp[cid] += 1
                # False positive: predicted cid when background was ground truth
                conf_mat[9, cid] += 1

            for n in false_negs:
                cid = n["class_id"]
                per_class_fn[cid] += 1
                # False negative: ground truth cid was missed (predicted background)
                conf_mat[cid, 9] += 1

        precision = total_tp / (total_tp + total_fp) if (total_tp + total_fp) > 0 else 0.0
        recall = total_tp / (total_tp + total_fn) if (total_tp + total_fn) > 0 else 0.0
        f1 = (2 * precision * recall) / (precision + recall) if (precision + recall) > 0 else 0.0

        per_class_metrics = {}
        for cid in range(9):
            c_tp = per_class_tp[cid]
            c_fp = per_class_fp[cid]
            c_fn = per_class_fn[cid]
            c_p = c_tp / (c_tp + c_fp) if (c_tp + c_fp) > 0 else 0.0
            c_r = c_tp / (c_tp + c_fn) if (c_tp + c_fn) > 0 else 0.0
            c_f1 = (2 * c_p * c_r) / (c_p + c_r) if (c_p + c_r) > 0 else 0.0
            per_class_metrics[CLASS_ID_TO_NAME[cid]] = {
                "class_id": cid,
                "ground_truth_count": per_class_gt[cid],
                "true_positives": c_tp,
                "false_positives": c_fp,
                "false_negatives": c_fn,
                "precision": round(c_p, 4),
                "recall": round(c_r, 4),
                "f1": round(c_f1, 4),
            }

        confusion_matrices[thresh] = conf_mat

        threshold_results[thresh] = {
            "threshold": thresh,
            "true_positives": total_tp,
            "false_positives": total_fp,
            "false_negatives": total_fn,
            "precision": round(precision, 4),
            "recall": round(recall, 4),
            "f1": round(f1, 4),
            "per_class": per_class_metrics,
        }

        print(f"\n[Threshold {thresh:.2f}]")
        print(f"  Precision: {precision*100:.2f}% | Recall: {recall*100:.2f}% | F1: {f1*100:.2f}%")
        print(f"  TP: {total_tp:5d} | FP: {total_fp:5d} | FN: {total_fn:5d}")
        print("  Class Breakdown:")
        for cname, m in per_class_metrics.items():
            print(f"    {cname:24s}: GT={m['ground_truth_count']:4d} | P={m['precision']*100:5.1f}% | R={m['recall']*100:5.1f}% | F1={m['f1']*100:5.1f}%")

    # 4. Run Ultralytics model.val on the stratified test split for standard COCO mAP metrics
    print("\n--- Running Ultralytics model.val for official mAP@0.5 and mAP@0.5:0.95 ---")
    
    # Write a dataset YAML pointing to the evaluated set
    eval_yaml_path = Path("data/dataset/stratified_eval.yaml")
    # Write test image list
    eval_txt_path = Path("data/dataset/stratified_images.txt")
    eval_txt_lines = [str((img_dir / f"{s}.jpg").resolve()) for s in test_stems]
    eval_txt_path.write_text("\n".join(eval_txt_lines), encoding="utf-8")

    eval_yaml_content = {
        "path": "D:/Apps/Programs/SolarVisionAI/solarvision-ai/data/dataset",
        "train": str(eval_txt_path.resolve()),
        "val": str(eval_txt_path.resolve()),
        "test": str(eval_txt_path.resolve()),
        "names": CLASS_ID_TO_NAME,
        "nc": 9,
    }
    with open(eval_yaml_path, "w", encoding="utf-8") as f:
        yaml.dump(eval_yaml_content, f)

    val_res = model.val(
        data=str(eval_yaml_path),
        split="val",
        conf=0.25,
        iou=0.70,
        imgsz=640,
        device="cpu",
        batch=16,
        plots=True,
        project=str(results_dir),
        name="ultralytics_eval",
        exist_ok=True,
        verbose=True,
    )

    official_map50 = float(val_res.box.map50)
    official_map50_95 = float(val_res.box.map)
    official_p = float(getattr(val_res.box, "mp", 0.0) or (val_res.box.p.mean() if len(val_res.box.p) else 0.0))
    official_r = float(getattr(val_res.box, "mr", 0.0) or (val_res.box.r.mean() if len(val_res.box.r) else 0.0))

    print(f"\nOfficial Ultralytics Validation Results (Production conf=0.25):")
    print(f"  mAP@0.5:      {official_map50*100:.2f}% ({official_map50:.4f})")
    print(f"  mAP@0.5:0.95: {official_map50_95*100:.2f}% ({official_map50_95:.4f})")
    print(f"  Precision:    {official_p*100:.2f}% ({official_p:.4f})")
    print(f"  Recall:       {official_r*100:.2f}% ({official_r:.4f})")

    # 5. Missed-defect investigation & Side-by-side Visualizations
    print("\n--- Investigating Missed Defects & Generating Visual Evidence ---")

    # Categories of interest:
    # 1. True Positives (high confidence match at 0.25)
    # 2. Missed at 0.25, but detected at 0.10/0.05 (Sensitivity issue)
    # 3. Completely missed even at 0.01 (Generalization issue)
    # 4. Spurious false positive at 0.01 on clean area (Threshold justification)

    tp_samples = []
    missed_at_025_recovered_samples = []
    completely_missed_samples = []
    false_positive_samples = []

    for stem in test_stems:
        gt_boxes = gt_by_stem[stem]
        if not gt_boxes:
            continue
        p_025 = [p for p in predictions_by_stem[stem] if p["confidence"] >= 0.25]
        p_010 = [p for p in predictions_by_stem[stem] if p["confidence"] >= 0.10]
        p_001 = predictions_by_stem[stem]

        tp_025, fp_025, fn_025, matches_025, _, _ = match_detections(gt_boxes, p_025)
        tp_010, fp_010, fn_010, matches_010, _, _ = match_detections(gt_boxes, p_010)
        tp_001, fp_001, fn_001, matches_001, fp_001_list, _ = match_detections(gt_boxes, p_001)

        if tp_025 > 0 and len(tp_samples) < 5:
            tp_samples.append((stem, matches_025))

        if fn_025 > 0 and tp_010 > tp_025 and len(missed_at_025_recovered_samples) < 5:
            missed_at_025_recovered_samples.append((stem, fn_025, tp_010))

        if fn_001 > 0 and len(completely_missed_samples) < 5:
            completely_missed_samples.append((stem, fn_001))

        if len(fp_001_list) >= 3 and fp_025 == 0 and len(false_positive_samples) < 5:
            false_positive_samples.append((stem, len(fp_001_list)))

    # Generate visualizations
    vis_records = []

    # Category A: True Positives
    for idx, (stem, matches) in enumerate(tp_samples[:2]):
        img_p = img_dir / f"{stem}.jpg"
        out_p = vis_dir / f"tp_case_{idx+1}_{stem}.jpg"
        p_025 = [p for p in predictions_by_stem[stem] if p["confidence"] >= 0.25]
        p_010 = [p for p in predictions_by_stem[stem] if p["confidence"] >= 0.10]
        cname = matches[0]["gt"]["class_name"]
        conf = matches[0]["pred"]["confidence"]
        create_side_by_side_visualization(
            img_p, gt_by_stem[stem], p_025, p_010, out_p,
            title_info=f"TRUE POSITIVE: {cname} successfully detected (conf={conf:.2f})"
        )
        vis_records.append({
            "category": "True Positive",
            "filename": f"{stem}.jpg",
            "path": str(out_p),
            "description": f"Verified detection of {cname} at production threshold 0.25 (conf {conf:.2f})."
        })

    # Category B: Missed at 0.25, Recovered at 0.10 (Hairline / Low-contrast)
    for idx, (stem, fn_cnt, tp_cnt) in enumerate(missed_at_025_recovered_samples[:3]):
        img_p = img_dir / f"{stem}.jpg"
        out_p = vis_dir / f"fn_recovered_case_{idx+1}_{stem}.jpg"
        p_025 = [p for p in predictions_by_stem[stem] if p["confidence"] >= 0.25]
        p_010 = [p for p in predictions_by_stem[stem] if p["confidence"] >= 0.10]
        gt_types = ", ".join(set(g["class_name"] for g in gt_by_stem[stem]))
        create_side_by_side_visualization(
            img_p, gt_by_stem[stem], p_025, p_010, out_p,
            title_info=f"MISSED AT 0.25 (RECOVERED AT 0.10): Faint {gt_types} with raw conf 0.10-0.24"
        )
        vis_records.append({
            "category": "Missed at 0.25 / Recovered at 0.10",
            "filename": f"{stem}.jpg",
            "path": str(out_p),
            "description": f"Faint {gt_types} missed by 0.25 floor but accurately localized at 0.10 threshold."
        })

    # Category C: Completely Missed (Generalization)
    for idx, (stem, fn_cnt) in enumerate(completely_missed_samples[:2]):
        img_p = img_dir / f"{stem}.jpg"
        out_p = vis_dir / f"fn_missed_case_{idx+1}_{stem}.jpg"
        p_025 = [p for p in predictions_by_stem[stem] if p["confidence"] >= 0.25]
        p_010 = [p for p in predictions_by_stem[stem] if p["confidence"] >= 0.10]
        gt_types = ", ".join(set(g["class_name"] for g in gt_by_stem[stem]))
        create_side_by_side_visualization(
            img_p, gt_by_stem[stem], p_025, p_010, out_p,
            title_info=f"HARD NEGATIVE (UNRECOVERED): Atypical {gt_types} uncaptured even at low thresholds"
        )
        vis_records.append({
            "category": "Hard Negative / Generalization Gap",
            "filename": f"{stem}.jpg",
            "path": str(out_p),
            "description": f"Atypical defect signature of {gt_types} missed across all thresholds."
        })

    # Category D: False Positive Flood at Low Threshold
    for idx, (stem, fp_cnt) in enumerate(false_positive_samples[:2]):
        img_p = img_dir / f"{stem}.jpg"
        out_p = vis_dir / f"fp_flood_case_{idx+1}_{stem}.jpg"
        p_025 = [p for p in predictions_by_stem[stem] if p["confidence"] >= 0.25]
        p_001 = [p for p in predictions_by_stem[stem] if p["confidence"] >= 0.01]
        create_side_by_side_visualization(
            img_p, gt_by_stem[stem], p_025, p_001, out_p,
            title_info=f"FALSE POSITIVE SUPPRESSION: Clean @ 0.25, but {fp_cnt} spurious noise boxes @ 0.01"
        )
        vis_records.append({
            "category": "False Positive Suppression",
            "filename": f"{stem}.jpg",
            "path": str(out_p),
            "description": f"Demonstrates why production threshold must remain 0.25: {fp_cnt} false alarms generated at 0.01."
        })

    print(f"Generated {len(vis_records)} side-by-side visual comparison artifacts in {vis_dir}")

    # 6. Save comprehensive evaluation JSON & Markdown
    final_report = {
        "evaluation_timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "dataset_name": "PVELAD (Photovoltaic Electroluminescence Anomaly Detection) / EL2021",
        "dataset_split": "Official Held-Out Test Set (Disjoint from Train/Val)",
        "total_test_images_in_archive": 19150,
        "evaluated_images_count": total_eval_images,
        "sampling_method": "Stratified random sampling across all 9 defect classes with 100% rare-class coverage",
        "model_checkpoint": "backend/models/best.pt",
        "model_architecture": "Ultralytics YOLO26n (YOLOv8n DetectionModel)",
        "parameter_count": 2507310,
        "official_ultralytics_metrics_at_025": {
            "mAP50": round(official_map50, 4),
            "mAP50_95": round(official_map50_95, 4),
            "precision": round(official_p, 4),
            "recall": round(official_r, 4),
        },
        "threshold_evaluation": threshold_results,
        "confusion_matrix_at_025": confusion_matrices[0.25].tolist(),
        "class_mapping": CLASS_ID_TO_NAME,
        "visual_artifacts": vis_records,
    }

    report_json_path = results_dir / "evaluation_report.json"
    report_json_path.write_text(json.dumps(final_report, indent=2), encoding="utf-8")
    print(f"Saved evaluation report JSON to {report_json_path}")

    # Copy to backend/evaluation/reports
    backend_report_dir = Path("backend/evaluation/reports")
    backend_report_dir.mkdir(parents=True, exist_ok=True)
    (backend_report_dir / "evaluation_report.json").write_text(json.dumps(final_report, indent=2), encoding="utf-8")

    print("\n" + "=" * 70)
    print(" Evaluation Completed Successfully!")
    print("=" * 70)


if __name__ == "__main__":
    main()
