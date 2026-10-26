import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { runInspection } from "./inspection/service";

describe("Model 1 YOLO Defect Detection Comparison", () => {
  const samplePath = resolve(process.cwd(), "client/public/samples/sample-el-cell-3.jpg");
  const imageBuffer = readFileSync(samplePath);
  const base64Data = imageBuffer.toString("base64");

  it("produces expected detections across confidence thresholds (0.25, 0.10, 0.05, 0.01)", async () => {
    const thresholds = [0.25, 0.10, 0.05, 0.01];
    const results: Record<number, any> = {};

    for (const conf of thresholds) {
      const res = await runInspection({
        filename: "sample-el-cell-3.jpg",
        mimeType: "image/jpeg",
        base64Data,
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

      console.log(`Node tRPC runInspection conf=${conf}: count=${res.detections.length}`);
      for (const d of res.detections) {
        console.log(`  [${d.defect_type}] conf=${d.confidence.toFixed(4)}, coords=(${d.x1}, ${d.y1}, ${d.x2}, ${d.y2})`);
      }
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
});
