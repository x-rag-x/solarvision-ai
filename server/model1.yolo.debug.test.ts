import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { runInspection } from "./inspection/service";

describe("Model 1 YOLO Defect Detection Comparison", () => {
  const sample3Path = resolve(process.cwd(), "client/public/samples/sample-el-cell-3.jpg");
  const sample3Buffer = readFileSync(sample3Path);
  const sample3Base64 = sample3Buffer.toString("base64");

  const sample2Path = resolve(process.cwd(), "client/public/samples/sample-el-cell-2.jpg");
  const sample2Buffer = readFileSync(sample2Path);
  const sample2Base64 = sample2Buffer.toString("base64");

  const sampleMultiPath = resolve(process.cwd(), "client/public/samples/sample-el-cell-multi.jpg");

  it("Sample 3 (single-crack) produces expected detections across confidence thresholds (0.25, 0.10, 0.05, 0.01)", async () => {
    const thresholds = [0.25, 0.10, 0.05, 0.01];
    const results: Record<number, any> = {};

    for (const conf of thresholds) {
      const res = await runInspection({
        filename: "sample-el-cell-3.jpg",
        mimeType: "image/jpeg",
        base64Data: sample3Base64,
        confidence: conf,
        userId: "test-operator",
        operatorId: "OP-TEST",
      });

      results[conf] = {
        confidencePassed: conf,
        detectionsCount: res.detections.length,
        detections: res.detections,
        config: res.inferenceConfiguration,
      };

      console.log(`Node tRPC runInspection sample-3 conf=${conf}: count=${res.detections.length}`);
    }

    // Confirm that for 0.25, 0.10, and 0.05, count is exactly 1
    expect(results[0.25].detectionsCount).toBe(1);
    expect(results[0.10].detectionsCount).toBe(1);
    expect(results[0.05].detectionsCount).toBe(1);
    // Confirm that for 0.01, count is 3
    expect(results[0.01].detectionsCount).toBe(3);
    // Confirm the single detection is the bottom-right crack (~0.8063)
    expect(results[0.25].detections[0].defect_type).toBe("crack");
    expect(results[0.25].detections[0].confidence).toBeGreaterThan(0.80);
    expect(results[0.25].detections[0].x1).toBeGreaterThan(800);
    expect(results[0.25].detections[0].y1).toBeGreaterThan(850);
  });

  it("Sample 2 (segmented crack) produces expected detections across thresholds (0.25, 0.10, 0.05, 0.01)", async () => {
    const thresholds = [0.25, 0.10, 0.05, 0.01];
    const results: Record<number, any> = {};

    for (const conf of thresholds) {
      const res = await runInspection({
        filename: "sample-el-cell-2.jpg",
        mimeType: "image/jpeg",
        base64Data: sample2Base64,
        confidence: conf,
        userId: "test-operator",
        operatorId: "OP-TEST",
      });

      results[conf] = {
        detectionsCount: res.detections.length,
        detections: res.detections,
      };

      console.log(`Node tRPC runInspection sample-2 conf=${conf}: count=${res.detections.length}`);
    }

    expect(results[0.25].detectionsCount).toBe(2);
    expect(results[0.10].detectionsCount).toBe(5);
    expect(results[0.05].detectionsCount).toBe(8);
    expect(results[0.01].detectionsCount).toBe(17);

    // Both boxes at 0.25 are labeled crack (ground truth is crack)
    for (const d of results[0.25].detections) {
      expect(d.defect_type).toBe("crack");
    }
  });

  it("Sample Multi-defect (img003781) produces genuine multi-defect detections at conf=0.25", async () => {
    if (!existsSync(sampleMultiPath)) {
      return;
    }

    const multiBuffer = readFileSync(sampleMultiPath);
    const multiBase64 = multiBuffer.toString("base64");

    const res = await runInspection({
      filename: "sample-el-cell-multi.jpg",
      mimeType: "image/jpeg",
      base64Data: multiBase64,
      confidence: 0.25,
      userId: "test-operator",
      operatorId: "OP-TEST",
    });

    expect(res.detections.length).toBe(5);
    const classes = new Set(res.detections.map(d => d.defect_type));
    expect(classes.has("crack")).toBe(true);
    expect(classes.has("finger")).toBe(true);
  });
});
