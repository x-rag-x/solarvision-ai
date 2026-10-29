import { describe, it, expect, vi, beforeEach, afterEach, afterAll } from "vitest";
import axios from "axios";
import { randomUUID } from "node:crypto";
import { runInspection, getInspection } from "./inspection/service";
import { getRecentInspections } from "./db";
import { getSqliteDb } from "./sqlite";

describe("Model 1 YOLO Defect Detection — FastAPI HTTP Bridge & Regression Suite", () => {
  const trackedInspectionIds: string[] = [];

  // Minimal 1x1 transparent PNG byte payload for testing
  const dummyBase64 =
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";

  const cleanupDatabase = () => {
    try {
      const db = getSqliteDb();
      for (const id of trackedInspectionIds) {
        db.prepare("DELETE FROM detections WHERE inspectionId = ?").run(id);
        db.prepare("DELETE FROM inspections WHERE inspectionId = ?").run(id);
      }
      trackedInspectionIds.length = 0;
    } catch (err) {
      // Ignore cleanup error
    }
  };

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  afterAll(() => {
    cleanupDatabase();
  });

  it("1. Successful Detection: calls internal FastAPI HTTP endpoint, maps response contract, and persists detections", async () => {
    const postSpy = vi.spyOn(axios, "post").mockResolvedValueOnce({
      status: 200,
      data: {
        inspection_id: "fastapi-run-001",
        status: "completed",
        source_filename: "panel_el_sample.jpg",
        model_name: "YOLO26n",
        processing_time_ms: 124.6,
        summary: {
          total_detections: 2,
          average_confidence: 0.88,
          highest_confidence: 0.94,
        },
        detections: [
          {
            defect_type: "crack",
            confidence: 0.94,
            x1: 120.5,
            y1: 200.0,
            x2: 340.0,
            y2: 450.5,
            class_id: 0,
            near_image_boundary: false,
          },
          {
            defect_type: "hotspot",
            confidence: 0.82,
            x1: 510.0,
            y1: 600.0,
            x2: 620.0,
            y2: 710.0,
            class_id: 1,
            near_image_boundary: true,
          },
        ],
        original_image_url: "/storage/input.jpg",
        annotated_image_url: "/storage/annotated.jpg",
        annotated_image_data_url: "data:image/jpeg;base64,/9j/4AAQSkZJRg==",
        persistence: "fastapi_memory",
        inference_configuration: {
          confidence_threshold: 0.3,
          iou_threshold: 0.45,
          image_size: 1024,
          class_names: ["crack", "hotspot", "delamination"],
        },
      },
    });

    const result = await runInspection({
      filename: "panel_el_sample.jpg",
      mimeType: "image/jpeg",
      base64Data: dummyBase64,
      confidence: 0.3,
      imageSize: 1024,
      diagnostic: true,
      userId: "operator-alice",
      operatorId: "OP-42",
    });

    trackedInspectionIds.push(result.inspectionId);

    // Verify axios call parameters
    expect(postSpy).toHaveBeenCalledTimes(1);
    const [callUrl, callData, callConfig] = postSpy.mock.calls[0];
    expect(callUrl).toContain("/api/inspections");
    expect(callData).toBeInstanceOf(FormData);
    expect(callConfig?.params).toEqual({
      confidence: 0.3,
      image_size: 1024,
      diagnostic: true,
    });
    expect(callConfig?.timeout).toBe(90000);

    // Verify mapped response contract for frontend
    expect(result.inspectionId).toBeDefined();
    expect(result.sourceFilename).toBe("panel_el_sample.jpg");
    expect(result.modelName).toBe("YOLO26n");
    expect(result.processingTimeMs).toBe(124.6);
    expect(result.detections.length).toBe(2);
    expect(result.detections[0]).toEqual({
      defect_type: "crack",
      confidence: 0.94,
      x1: 120.5,
      y1: 200.0,
      x2: 340.0,
      y2: 450.5,
      class_id: 0,
      near_image_boundary: false,
    });
    expect(result.annotatedImageDataUrl).toBe("data:image/jpeg;base64,/9j/4AAQSkZJRg==");
    expect(result.inferenceConfiguration).toEqual({
      confidence_threshold: 0.3,
      iou_threshold: 0.45,
      image_size: 1024,
      class_names: ["crack", "hotspot", "delamination"],
    });

    // Verify database persistence
    const saved = await getInspection(result.inspectionId, {
      userId: "operator-alice",
      role: "user",
    });
    expect(saved).not.toBeNull();
    expect(saved?.inspection.inspectionId).toBe(result.inspectionId);
    expect(saved?.inspection.status).toBe("completed");
    expect(saved?.inspection.detectionsCount).toBe(2);
    expect(saved?.detections.length).toBe(2);
    expect(saved?.detections[0].defectType).toBe("crack");
  });

  it("2. Zero Detections: gracefully maps zero defects without errors", async () => {
    vi.spyOn(axios, "post").mockResolvedValueOnce({
      status: 200,
      data: {
        inspection_id: "fastapi-clean-panel",
        status: "completed",
        source_filename: "pristine_module.jpg",
        model_name: "YOLO26n",
        processing_time_ms: 85.2,
        summary: {
          total_detections: 0,
          average_confidence: null,
          highest_confidence: null,
        },
        detections: [],
        annotated_image_data_url: null,
        persistence: "fastapi_memory",
        inference_configuration: {
          confidence_threshold: 0.25,
          image_size: 640,
        },
      },
    });

    const result = await runInspection({
      filename: "pristine_module.jpg",
      mimeType: "image/jpeg",
      base64Data: dummyBase64,
      userId: "operator-alice",
    });

    trackedInspectionIds.push(result.inspectionId);

    expect(result.detections.length).toBe(0);
    expect(result.processingTimeMs).toBe(85.2);
    expect(result.annotatedImageDataUrl).toBeNull();

    // Verify saved as completed with 0 detections
    const saved = await getInspection(result.inspectionId, {
      userId: "operator-alice",
      role: "user",
    });
    expect(saved).not.toBeNull();
    expect(saved?.inspection.status).toBe("completed");
    expect(saved?.inspection.detectionsCount).toBe(0);
    expect(saved?.detections.length).toBe(0);
  });

  it("3. FastAPI Failure (503 Service Unavailable): sanitizes error and logs failed audit record", async () => {
    const error503 = new Error("Request failed with status code 503");
    (error503 as any).response = {
      status: 503,
      data: {
        detail: "YOLO model checkpoint loading failed or is unready.",
      },
    };
    vi.spyOn(axios, "post").mockRejectedValueOnce(error503);

    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = "production";

    try {
      await expect(
        runInspection({
          filename: "defective_cell.jpg",
          mimeType: "image/jpeg",
          base64Data: dummyBase64,
          userId: "operator-bob",
        })
      ).rejects.toThrow("Inference execution failed: YOLO model checkpoint loading failed or is unready.");

      // Check SQLite for recorded failed audit
      const db = getSqliteDb();
      const failedRows = db
        .prepare("SELECT * FROM inspections WHERE userId = ? AND status = 'failed' ORDER BY createdAt DESC LIMIT 1")
        .all("operator-bob") as any[];

      expect(failedRows.length).toBe(1);
      expect(failedRows[0].status).toBe("failed");
      expect(failedRows[0].persistenceStatus).toContain("failed_inference:YOLO model checkpoint loading failed");
      trackedInspectionIds.push(failedRows[0].inspectionId);
    } finally {
      process.env.NODE_ENV = originalEnv;
    }
  });

  it("4. Inference Timeout (ECONNABORTED): rejects cleanly after configured timeout and writes failed audit record", async () => {
    const timeoutErr = new Error("timeout of 90000ms exceeded");
    (timeoutErr as any).code = "ECONNABORTED";
    const postSpy = vi.spyOn(axios, "post").mockRejectedValueOnce(timeoutErr);

    await expect(
      runInspection({
        filename: "large_cold_start.jpg",
        mimeType: "image/jpeg",
        base64Data: dummyBase64,
        userId: "operator-timeout-user",
      })
    ).rejects.toThrow("Inference process timed out after 90000ms");

    // Axios called only once (no infinite retries)
    expect(postSpy).toHaveBeenCalledTimes(1);

    // Verify failed audit record in database
    const db = getSqliteDb();
    const timeoutRows = db
      .prepare("SELECT * FROM inspections WHERE userId = ? AND status = 'failed' ORDER BY createdAt DESC LIMIT 1")
      .all("operator-timeout-user") as any[];

    expect(timeoutRows.length).toBe(1);
    expect(timeoutRows[0].status).toBe("failed");
    expect(timeoutRows[0].persistenceStatus).toBe("failed_inference:timeout");
    trackedInspectionIds.push(timeoutRows[0].inspectionId);
  });

  it("5. Configurable Timeout: INFERENCE_TIMEOUT_MS overrides default 90,000ms", async () => {
    const originalTimeout = process.env.INFERENCE_TIMEOUT_MS;
    process.env.INFERENCE_TIMEOUT_MS = "45000";

    try {
      const postSpy = vi.spyOn(axios, "post").mockResolvedValueOnce({
        status: 200,
        data: {
          inspection_id: "fastapi-custom-timeout",
          status: "completed",
          source_filename: "timeout_test.jpg",
          model_name: "YOLO26n",
          processing_time_ms: 50.0,
          summary: { total_detections: 0, average_confidence: null, highest_confidence: null },
          detections: [],
          persistence: "memory",
        },
      });

      const res = await runInspection({
        filename: "timeout_test.jpg",
        mimeType: "image/jpeg",
        base64Data: dummyBase64,
      });

      trackedInspectionIds.push(res.inspectionId);

      const [, , config] = postSpy.mock.calls[0];
      expect(config?.timeout).toBe(45000);
    } finally {
      if (originalTimeout !== undefined) {
        process.env.INFERENCE_TIMEOUT_MS = originalTimeout;
      } else {
        delete process.env.INFERENCE_TIMEOUT_MS;
      }
    }
  });

  it("6. Production Guard: in production NODE_ENV, ECONNREFUSED does NOT spawn duplicate CLI subprocess", async () => {
    const connRefused = new Error("connect ECONNREFUSED 127.0.0.1:8000");
    (connRefused as any).code = "ECONNREFUSED";
    vi.spyOn(axios, "post").mockRejectedValueOnce(connRefused);

    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = "production";

    try {
      await expect(
        runInspection({
          filename: "no_cli_in_prod.jpg",
          mimeType: "image/jpeg",
          base64Data: dummyBase64,
          userId: "prod-safety-user",
        })
      ).rejects.toThrow("Inference execution failed: connect ECONNREFUSED 127.0.0.1:8000");

      // Verify audit record created
      const db = getSqliteDb();
      const rows = db
        .prepare("SELECT * FROM inspections WHERE userId = ? AND status = 'failed' ORDER BY createdAt DESC LIMIT 1")
        .all("prod-safety-user") as any[];

      expect(rows.length).toBe(1);
      expect(rows[0].status).toBe("failed");
      trackedInspectionIds.push(rows[0].inspectionId);
    } finally {
      process.env.NODE_ENV = originalEnv;
    }
  });

  it("7. History Persistence & Access Control: verifies ownership enforcement and recent inspections retrieval", async () => {
    vi.spyOn(axios, "post").mockResolvedValueOnce({
      status: 200,
      data: {
        inspection_id: "fastapi-history-check",
        status: "completed",
        source_filename: "history_module.jpg",
        model_name: "YOLO26n",
        processing_time_ms: 110.0,
        summary: { total_detections: 1, average_confidence: 0.91, highest_confidence: 0.91 },
        detections: [
          {
            defect_type: "crack",
            confidence: 0.91,
            x1: 200,
            y1: 300,
            x2: 400,
            y2: 500,
          },
        ],
        persistence: "fastapi_memory",
      },
    });

    const res = await runInspection({
      filename: "history_module.jpg",
      mimeType: "image/jpeg",
      base64Data: dummyBase64,
      userId: "user-history-owner",
      operatorId: "OP-HIST",
    });

    trackedInspectionIds.push(res.inspectionId);

    // 1. Owner can access
    const ownerRecord = await getInspection(res.inspectionId, {
      userId: "user-history-owner",
      role: "user",
    });
    expect(ownerRecord).not.toBeNull();
    expect(ownerRecord?.inspection.inspectionId).toBe(res.inspectionId);
    expect(ownerRecord?.detections.length).toBe(1);

    // 2. Cross-user caller is denied (returns null)
    const crossUserRecord = await getInspection(res.inspectionId, {
      userId: "different-user-charlie",
      role: "user",
    });
    expect(crossUserRecord).toBeNull();

    // 3. Admin can access
    const adminRecord = await getInspection(res.inspectionId, {
      userId: "admin-superuser",
      role: "admin",
    });
    expect(adminRecord).not.toBeNull();
    expect(adminRecord?.inspection.inspectionId).toBe(res.inspectionId);

    // 4. Recent inspections retrieval includes the record for owner
    const recentInspections = await getRecentInspections(10, {
      userId: "user-history-owner",
      role: "user",
    });
    const found = recentInspections.some(r => r.inspectionId === res.inspectionId);
    expect(found).toBe(true);
  });
});
