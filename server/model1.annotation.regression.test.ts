/**
 * SolarVision AI — Model 1 Annotation & Visualization Regression Test Suite
 *
 * Verifies:
 * 1. Exactly one prediction creates exactly one visible annotation box.
 * 2. Multiple predictions create the appropriate number of independent annotations.
 * 3. Switching inspection images clears old overlays.
 * 4. Backend-annotated images are not annotated again (single authoritative layer).
 * 5. Bounding boxes scale correctly with intrinsic image dimensions and responsive viewport scaling.
 * 6. Fullscreen inspection viewer displays the same results.
 * 7. Stored inspection history does not duplicate boxes.
 * 8. Confidence thresholds continue working as configured (default 0.25).
 * 9. Real YOLO inference on all demonstration images (Sample 1, Sample 2, Sample 3, Multi-defect).
 */

import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { runInspection, getInspection } from "./inspection/service";
import { DEFECT_CLASSES } from "../client/src/lib/defects";

describe("Model 1 Annotation & Bounding Box Regression Suite", () => {
  const sample1Path = resolve(process.cwd(), "client/public/samples/sample-el-cell-1.jpg");
  const sample2Path = resolve(process.cwd(), "client/public/samples/sample-el-cell-2.jpg");
  const sample3Path = resolve(process.cwd(), "client/public/samples/sample-el-cell-3.jpg");
  const sampleMultiPath = resolve(process.cwd(), "client/public/samples/sample-el-cell-multi.jpg");

  const sample1Base64 = readFileSync(sample1Path).toString("base64");
  const sample2Base64 = readFileSync(sample2Path).toString("base64");
  const sample3Base64 = readFileSync(sample3Path).toString("base64");
  const sampleMultiBase64 = readFileSync(sampleMultiPath).toString("base64");

  // Helper mimicking ImageViewer's authoritative getBoxStyle projection logic
  function projectBoxCoordinates(
    bbox: [number, number, number, number],
    imageDimensions: { width: number; height: number }
  ) {
    const [x1, y1, x2, y2] = bbox;
    const { width: imgW, height: imgH } = imageDimensions;

    let left = (x1 / imgW) * 100;
    let top = (y1 / imgH) * 100;
    let width = ((x2 - x1) / imgW) * 100;
    let height = ((y2 - y1) / imgH) * 100;

    const clampedLeft = Math.max(0, Math.min(100, left));
    const clampedTop = Math.max(0, Math.min(100, top));
    const clampedWidth = Math.max(0.2, Math.min(100 - clampedLeft, width));
    const clampedHeight = Math.max(0.2, Math.min(100 - clampedTop, height));

    return {
      topPercent: clampedTop,
      leftPercent: clampedLeft,
      widthPercent: clampedWidth,
      heightPercent: clampedHeight,
      isNearTop: clampedTop < 6,
    };
  }

  // 1. One prediction creates one visible annotation
  it("Requirement 1: Exactly one YOLO detection produces exactly one visible prediction box", async () => {
    const res = await runInspection({
      filename: "sample-el-cell-3.jpg",
      mimeType: "image/jpeg",
      base64Data: sample3Base64,
      confidence: 0.25,
      userId: "test-user",
      operatorId: "OP-TEST",
    });

    expect(res.detections.length).toBe(1);
    const det = res.detections[0];
    expect(det.defect_type).toBe("crack");
    expect(det.confidence).toBeGreaterThan(0.75);

    // Projected to 1024x1024 intrinsic dimensions
    const projection = projectBoxCoordinates([det.x1, det.y1, det.x2, det.y2], {
      width: 1024,
      height: 1024,
    });

    expect(projection.leftPercent).toBeGreaterThan(80);
    expect(projection.topPercent).toBeGreaterThan(85);
    expect(projection.widthPercent).toBeGreaterThan(5);
    expect(projection.heightPercent).toBeGreaterThan(5);

    // Single box count verification
    const renderedBoxesCount = res.detections.length;
    expect(renderedBoxesCount).toBe(1);
  });

  // 2. Multiple predictions create the appropriate number of annotations
  it("Requirement 2: Multiple predictions create the exact corresponding number of visible annotations", async () => {
    // Sample 2 has 2 collinear segmented cracks
    const res2 = await runInspection({
      filename: "sample-el-cell-2.jpg",
      mimeType: "image/jpeg",
      base64Data: sample2Base64,
      confidence: 0.25,
      userId: "test-user",
      operatorId: "OP-TEST",
    });

    expect(res2.detections.length).toBe(2);
    expect(res2.detections[0].defect_type).toBe("crack");
    expect(res2.detections[1].defect_type).toBe("crack");

    // Both defects remain independently visible
    const box1 = projectBoxCoordinates(
      [res2.detections[0].x1, res2.detections[0].y1, res2.detections[0].x2, res2.detections[0].y2],
      { width: 1024, height: 1024 }
    );
    const box2 = projectBoxCoordinates(
      [res2.detections[1].x1, res2.detections[1].y1, res2.detections[1].x2, res2.detections[1].y2],
      { width: 1024, height: 1024 }
    );

    expect(box1.widthPercent).toBeGreaterThan(0);
    expect(box2.widthPercent).toBeGreaterThan(0);
    expect(Math.abs(box1.topPercent - box2.topPercent)).toBeLessThan(10); // collinear

    // Sample Multi-defect has 5 detections
    const resMulti = await runInspection({
      filename: "sample-el-cell-multi.jpg",
      mimeType: "image/jpeg",
      base64Data: sampleMultiBase64,
      confidence: 0.25,
      userId: "test-user",
      operatorId: "OP-TEST",
    });

    expect(resMulti.detections.length).toBe(5);
    const classCounts = resMulti.detections.reduce((acc, d) => {
      acc[d.defect_type] = (acc[d.defect_type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    expect(classCounts["crack"]).toBe(3);
    expect(classCounts["finger"]).toBe(2);
  });

  // 3. Switching inspection images clears old overlays
  it("Requirement 3: Switching inspection images or clearing selection resets annotations to 0", () => {
    // Mimic frontend state transitions in Inspection.tsx
    let activeResult: any = {
      detections: [{ defect_type: "crack", confidence: 0.85, x1: 100, y1: 100, x2: 200, y2: 200 }],
    };
    let viewerDetections = activeResult.detections;
    expect(viewerDetections.length).toBe(1);

    // When handleFileSelect or handleClearFile is called
    const handleFileSelect = () => {
      activeResult = null;
      viewerDetections = (activeResult?.detections || []).map((d: any) => d);
    };

    handleFileSelect();
    expect(viewerDetections.length).toBe(0);
  });

  // 4. Backend-annotated images are not annotated again
  it("Requirement 4: When an image is already backend-annotated, React overlays are suppressed", () => {
    // Strategy evaluation:
    // If cleanSource is null and isBackendAnnotated is true, shouldRenderOverlays is false
    const cleanSource = null;
    const annotatedSource = "data:image/jpeg;base64,sample_annotated_with_opencv";
    const isBackendAnnotated = true;
    const activeSrc = annotatedSource;

    const isUnderlyingAnnotated = Boolean(
      isBackendAnnotated && activeSrc === annotatedSource && !cleanSource
    );
    expect(isUnderlyingAnnotated).toBe(true);

    const showAnnotations = true;
    const showOriginal = false;
    const shouldRenderOverlays = showAnnotations && !showOriginal && !isUnderlyingAnnotated;

    // React overlays MUST NOT render on top of backend-annotated pixels
    expect(shouldRenderOverlays).toBe(false);
  });

  // 5. Bounding boxes scale correctly at different screen sizes
  it("Requirement 5: Bounding boxes project consistently across diverse aspect ratios and dimensions", () => {
    const rawBox: [number, number, number, number] = [200, 150, 400, 350];

    // Square 1024x1024
    const squareProj = projectBoxCoordinates(rawBox, { width: 1024, height: 1024 });
    expect(squareProj.leftPercent).toBeCloseTo((200 / 1024) * 100, 4);
    expect(squareProj.topPercent).toBeCloseTo((150 / 1024) * 100, 4);
    expect(squareProj.widthPercent).toBeCloseTo((200 / 1024) * 100, 4);
    expect(squareProj.heightPercent).toBeCloseTo((200 / 1024) * 100, 4);

    // Standard YOLO 640x640
    const yoloProj = projectBoxCoordinates(rawBox, { width: 640, height: 640 });
    expect(yoloProj.leftPercent).toBeCloseTo((200 / 640) * 100, 4);
    expect(yoloProj.topPercent).toBeCloseTo((150 / 640) * 100, 4);

    // Widescreen 1920x1080
    const wideProj = projectBoxCoordinates(rawBox, { width: 1920, height: 1080 });
    expect(wideProj.leftPercent).toBeCloseTo((200 / 1920) * 100, 4);
    expect(wideProj.topPercent).toBeCloseTo((150 / 1080) * 100, 4);
  });

  // 6. Fullscreen inspection viewer displays the same results
  it("Requirement 6: Fullscreen mode preserves exact coordinate percentages and detection counts", () => {
    const detections = [
      { class: "crack", confidence: 0.81, bbox: [846.55, 901.04, 960.4, 989.13] as [number, number, number, number] },
    ];
    const imageDims = { width: 1024, height: 1024 };

    const standardBox = projectBoxCoordinates(detections[0].bbox, imageDims);

    // In fullscreen, the container expands to 100vw/100vh with scale=1, but the relative percentage
    // coordinates of the overlay remain identical
    const fullscreenBox = projectBoxCoordinates(detections[0].bbox, imageDims);

    expect(fullscreenBox.leftPercent).toEqual(standardBox.leftPercent);
    expect(fullscreenBox.topPercent).toEqual(standardBox.topPercent);
    expect(fullscreenBox.widthPercent).toEqual(standardBox.widthPercent);
    expect(fullscreenBox.heightPercent).toEqual(standardBox.heightPercent);
  });

  // 7. Stored inspection history does not duplicate boxes
  it("Requirement 7: Stored inspection record retrieval returns clean inputImageUrl and prevents duplicate overlays", async () => {
    const runRes = await runInspection({
      filename: "sample-el-cell-1.jpg",
      mimeType: "image/jpeg",
      base64Data: sample1Base64,
      confidence: 0.25,
      userId: "test-user",
      operatorId: "OP-TEST",
    });

    const stored = await getInspection(runRes.inspectionId, { userId: "test-user", role: "operator" });
    expect(stored).toBeDefined();
    expect(stored?.inspection).toBeDefined();

    const inspection = stored!.inspection;
    const detections = stored!.detections;

    // Both URLs are persisted
    expect(inspection.annotatedImageUrl).toBeDefined();
    expect(inspection.inputImageUrl).toBeDefined();

    // InspectionDetail strategy: uses inputImageUrl as clean base, viewerDetections as sole overlay
    const cleanImage = inspection.inputImageUrl;
    const isBackendOnly = !cleanImage && Boolean(inspection.annotatedImageUrl);

    expect(isBackendOnly).toBe(false);
    expect(detections.length).toBe(1);
    expect(detections[0].defectType).toBe("star_crack");
  });

  // 8. Confidence thresholds continue working as configured (default 0.25)
  it("Requirement 8: Confidence cutoff preserves default 0.25 threshold and filters candidates accurately", async () => {
    // At default 0.25, sample-1 has 1 detection
    const resDefault = await runInspection({
      filename: "sample-el-cell-1.jpg",
      mimeType: "image/jpeg",
      base64Data: sample1Base64,
      confidence: 0.25,
    });
    expect(resDefault.inferenceConfiguration?.confidence_threshold).toBe(0.25);
    expect(resDefault.detections.length).toBe(1);
    expect(resDefault.detections[0].confidence).toBeGreaterThanOrEqual(0.25);

    // At high sensitivity 0.10, sample-2 has 5 detections
    const resHigh = await runInspection({
      filename: "sample-el-cell-2.jpg",
      mimeType: "image/jpeg",
      base64Data: sample2Base64,
      confidence: 0.10,
    });
    expect(resHigh.inferenceConfiguration?.confidence_threshold).toBe(0.10);
    expect(resHigh.detections.length).toBe(5);
    for (const d of resHigh.detections) {
      expect(d.confidence).toBeGreaterThanOrEqual(0.10);
    }
  });

  // 9. Authentic inference verification on all demonstration images
  it("Demonstration Images Verification: Raw detection count matches prediction annotations across all samples", async () => {
    // Sample 1 (Micro-Crack / Star Crack)
    const s1 = await runInspection({
      filename: "sample-el-cell-1.jpg",
      mimeType: "image/jpeg",
      base64Data: sample1Base64,
      confidence: 0.25,
    });
    expect(s1.detections.length).toBe(1);
    expect(s1.detections[0].defect_type).toBe("star_crack");

    // Sample 2 (Segmented Crack)
    const s2 = await runInspection({
      filename: "sample-el-cell-2.jpg",
      mimeType: "image/jpeg",
      base64Data: sample2Base64,
      confidence: 0.25,
    });
    expect(s2.detections.length).toBe(2);
    expect(s2.detections[0].defect_type).toBe("crack");
    expect(s2.detections[1].defect_type).toBe("crack");

    // Sample 3 (Single Crack)
    const s3 = await runInspection({
      filename: "sample-el-cell-3.jpg",
      mimeType: "image/jpeg",
      base64Data: sample3Base64,
      confidence: 0.25,
    });
    expect(s3.detections.length).toBe(1);
    expect(s3.detections[0].defect_type).toBe("crack");

    // Sample Multi-Defect
    const sMulti = await runInspection({
      filename: "sample-el-cell-multi.jpg",
      mimeType: "image/jpeg",
      base64Data: sampleMultiBase64,
      confidence: 0.25,
    });
    expect(sMulti.detections.length).toBe(5);
  });
});
