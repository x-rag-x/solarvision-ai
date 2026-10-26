import { describe, expect, it, afterAll, beforeEach } from "vitest";
import { randomUUID } from "node:crypto";
import {
  getSqliteDb,
  saveSqliteInspection,
  getSqliteInspectionById,
  getSqliteRecentInspections,
  getSqliteDashboardStats,
  getSqliteDefectAnalytics,
} from "./sqlite";

describe("Database Integration - SQLite Persistence Layer", () => {
  const createdInspectionIds: string[] = [];

  // Cleanup helper
  const cleanup = () => {
    try {
      const db = getSqliteDb();
      for (const id of createdInspectionIds) {
        db.prepare("DELETE FROM detections WHERE inspectionId = ?").run(id);
        db.prepare("DELETE FROM inspections WHERE inspectionId = ?").run(id);
      }
      createdInspectionIds.length = 0;
    } catch (e) {
      console.warn("Cleanup warning:", e);
    }
  };

  afterAll(() => {
    cleanup();
  });

  it("creates an inspection record and retrieves it accurately", () => {
    const inspectionId = randomUUID();
    createdInspectionIds.push(inspectionId);

    const input = {
      inspectionId,
      sourceFilename: "test_cell_01.jpg",
      modelName: "YOLO26n",
      status: "completed" as const,
      processingTimeMs: 42.5,
      inputImageUrl: "/uploads/test_cell_01.jpg",
      annotatedImageUrl: "/uploads/test_cell_01_annotated.jpg",
      detectionsCount: 2,
      persistenceStatus: "database",
      createdAt: new Date("2026-10-21T10:00:00.000Z"),
    };

    const items = [
      {
        inspectionId,
        defectType: "crack",
        confidence: 0.925,
        x1: 100.0,
        y1: 150.0,
        x2: 250.0,
        y2: 300.0,
      },
      {
        inspectionId,
        defectType: "finger",
        confidence: 0.812,
        x1: 50.0,
        y1: 60.0,
        x2: 70.0,
        y2: 220.0,
      },
    ];

    const saved = saveSqliteInspection(input, items);
    expect(saved).toBe(true);

    const retrieved = getSqliteInspectionById(inspectionId);
    expect(retrieved).not.toBeNull();
    expect(retrieved?.inspection.inspectionId).toBe(inspectionId);
    expect(retrieved?.inspection.sourceFilename).toBe("test_cell_01.jpg");
    expect(retrieved?.inspection.modelName).toBe("YOLO26n");
    expect(retrieved?.inspection.status).toBe("completed");
    expect(retrieved?.inspection.processingTimeMs).toBeCloseTo(42.5);
    expect(retrieved?.inspection.detectionsCount).toBe(2);
    expect(retrieved?.inspection.persistenceStatus).toBe("database");

    // Detections checks
    expect(retrieved?.detections).toHaveLength(2);
    const crackDet = retrieved?.detections.find((d: any) => d.defectType === "crack");
    expect(crackDet).toBeDefined();
    expect(crackDet?.confidence).toBeCloseTo(0.925);
    expect(crackDet?.x1).toBeCloseTo(100.0);
    expect(crackDet?.y1).toBeCloseTo(150.0);
    expect(crackDet?.x2).toBeCloseTo(250.0);
    expect(crackDet?.y2).toBeCloseTo(300.0);
  });

  it("handles inspection with zero detections (defect-free cell)", () => {
    const inspectionId = randomUUID();
    createdInspectionIds.push(inspectionId);

    const input = {
      inspectionId,
      sourceFilename: "healthy_cell.jpg",
      modelName: "YOLO26n",
      status: "completed" as const,
      processingTimeMs: 35.0,
      inputImageUrl: "/uploads/healthy.jpg",
      annotatedImageUrl: "/uploads/healthy_ann.jpg",
      detectionsCount: 0,
      persistenceStatus: "database",
      createdAt: new Date(),
    };

    const saved = saveSqliteInspection(input, []);
    expect(saved).toBe(true);

    const retrieved = getSqliteInspectionById(inspectionId);
    expect(retrieved).not.toBeNull();
    expect(retrieved?.inspection.detectionsCount).toBe(0);
    expect(retrieved?.detections).toHaveLength(0);
  });

  it("returns null for non-existent inspectionId", () => {
    const nonExistent = randomUUID();
    const retrieved = getSqliteInspectionById(nonExistent);
    expect(retrieved).toBeNull();
  });

  it("lists recent inspections ordered by date descending with limit parameter", () => {
    const id1 = randomUUID();
    const id2 = randomUUID();
    createdInspectionIds.push(id1, id2);

    const date1 = new Date(Date.now() + 10000);
    const date2 = new Date(Date.now() + 20000);

    saveSqliteInspection(
      {
        inspectionId: id1,
        sourceFilename: "older.jpg",
        modelName: "YOLO26n",
        status: "completed" as const,
        processingTimeMs: 30,
        detectionsCount: 0,
        persistenceStatus: "database",
        createdAt: date1,
      },
      []
    );

    saveSqliteInspection(
      {
        inspectionId: id2,
        sourceFilename: "newer.jpg",
        modelName: "YOLO26n",
        status: "completed" as const,
        processingTimeMs: 40,
        detectionsCount: 1,
        persistenceStatus: "database",
        createdAt: date2,
      },
      []
    );

    const recent = getSqliteRecentInspections(50);
    expect(recent.length).toBeGreaterThanOrEqual(2);

    const indexId2 = recent.findIndex((r: any) => r.inspectionId === id2);
    const indexId1 = recent.findIndex((r: any) => r.inspectionId === id1);
    expect(indexId2).toBeGreaterThanOrEqual(0);
    expect(indexId1).toBeGreaterThanOrEqual(0);
    expect(indexId2).toBeLessThan(indexId1); // newer must appear before older

    // Test limit constraint
    const limited = getSqliteRecentInspections(1);
    expect(limited).toHaveLength(1);
  });

  it("idempotently handles duplicate inspectionId requests via upsert without creating duplicate rows", () => {
    const duplicateId = randomUUID();
    createdInspectionIds.push(duplicateId);

    const input1 = {
      inspectionId: duplicateId,
      sourceFilename: "first_attempt.jpg",
      modelName: "YOLO26n",
      status: "completed" as const,
      processingTimeMs: 25.0,
      detectionsCount: 1,
      persistenceStatus: "database",
      createdAt: new Date(),
    };

    const firstSave = saveSqliteInspection(input1, [
      {
        inspectionId: duplicateId,
        defectType: "crack",
        confidence: 0.8,
        x1: 10,
        y1: 10,
        x2: 20,
        y2: 20,
      },
    ]);
    expect(firstSave).toBe(true);

    // Second request with same inspectionId updates record idempotently
    const input2 = {
      ...input1,
      sourceFilename: "retry_attempt.jpg",
      processingTimeMs: 30.0,
      detectionsCount: 2,
    };

    const secondSave = saveSqliteInspection(input2, [
      {
        inspectionId: duplicateId,
        defectType: "finger",
        confidence: 0.9,
        x1: 30,
        y1: 30,
        x2: 40,
        y2: 40,
      },
      {
        inspectionId: duplicateId,
        defectType: "star_crack",
        confidence: 0.85,
        x1: 50,
        y1: 50,
        x2: 60,
        y2: 60,
      },
    ]);
    expect(secondSave).toBe(true);

    // Verify there is only ONE record in inspections table
    const db = getSqliteDb();
    const rows = db.prepare("SELECT * FROM inspections WHERE inspectionId = ?").all(duplicateId);
    expect(rows).toHaveLength(1);

    const record = getSqliteInspectionById(duplicateId);
    expect(record?.inspection.sourceFilename).toBe("retry_attempt.jpg");
    expect(record?.inspection.processingTimeMs).toBeCloseTo(30.0);
    expect(record?.inspection.detectionsCount).toBe(2);
    expect(record?.detections).toHaveLength(2);
    expect(record?.detections.map(d => d.defectType).sort()).toEqual(["finger", "star_crack"]);
  });

  it("computes accurate dashboard stats from stored records", () => {
    const id = randomUUID();
    createdInspectionIds.push(id);

    saveSqliteInspection(
      {
        inspectionId: id,
        sourceFilename: "stats_test.jpg",
        modelName: "YOLO26n",
        status: "completed" as const,
        processingTimeMs: 50.0,
        detectionsCount: 2,
        persistenceStatus: "database",
        createdAt: new Date(),
      },
      [
        {
          inspectionId: id,
          defectType: "star_crack",
          confidence: 0.88,
          x1: 10,
          y1: 10,
          x2: 20,
          y2: 20,
        },
        {
          inspectionId: id,
          defectType: "thick_line",
          confidence: 0.75,
          x1: 30,
          y1: 30,
          x2: 40,
          y2: 40,
        },
      ]
    );

    const stats = getSqliteDashboardStats();
    expect(stats.configured).toBe(true);
    expect(stats.inspections).toBeGreaterThanOrEqual(1);
    expect(stats.detections).toBeGreaterThanOrEqual(2);
    expect(stats.defectTypes).toBeGreaterThanOrEqual(2);
    expect(stats.avgProcessingTimeMs).toBeGreaterThan(0);
  });

  it("aggregates defect analytics with defect breakdown and trends", () => {
    const id = randomUUID();
    createdInspectionIds.push(id);

    saveSqliteInspection(
      {
        inspectionId: id,
        sourceFilename: "analytics_test.jpg",
        modelName: "YOLO26n",
        status: "completed" as const,
        processingTimeMs: 45.0,
        detectionsCount: 3,
        persistenceStatus: "database",
        createdAt: new Date(),
      },
      [
        {
          inspectionId: id,
          defectType: "crack",
          confidence: 0.9,
          x1: 10,
          y1: 10,
          x2: 20,
          y2: 20,
        },
        {
          inspectionId: id,
          defectType: "crack",
          confidence: 0.8,
          x1: 30,
          y1: 30,
          x2: 40,
          y2: 40,
        },
        {
          inspectionId: id,
          defectType: "short_circuit",
          confidence: 0.95,
          x1: 50,
          y1: 50,
          x2: 60,
          y2: 60,
        },
      ]
    );

    const analytics = getSqliteDefectAnalytics();
    expect(analytics.configured).toBe(true);
    expect(Array.isArray(analytics.byType)).toBe(true);
    expect(Array.isArray(analytics.recentTrend)).toBe(true);

    const crackType = analytics.byType.find((t: any) => t.defectType === "crack");
    expect(crackType).toBeDefined();
    expect(crackType?.count).toBeGreaterThanOrEqual(2);
    expect(crackType?.avgConfidence).toBeGreaterThan(0.2);

    expect(analytics.recentTrend.length).toBeGreaterThanOrEqual(1);
  });

  it("recovers gracefully from corrupt inputs without crashing the process", () => {
    // Malformed input missing required non-null fields
    const invalidInput: any = {
      inspectionId: null,
      sourceFilename: null,
    };

    const result = saveSqliteInspection(invalidInput, []);
    expect(result).toBe(false);
  });
});
