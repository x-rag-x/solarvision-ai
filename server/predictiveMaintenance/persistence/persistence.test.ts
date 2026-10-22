/**
 * SolarVision AI — Model 4: Predictive Maintenance
 * Persistence Integration & Validation Test Suite
 *
 * NOTE: All tests run against an ISOLATED in-memory SQLite database
 * to ensure zero pollution of the operational development database.
 */

import { describe, it, expect, beforeEach } from "vitest";
import { createRequire } from "node:module";
import type { DatabaseSync } from "node:sqlite";
import {
  MaintenancePersistenceRepository,
  PersistenceValidationError,
  MachineNotFoundError,
  ensureMaintenanceSchema,
  BENCHMARK_MACHINES,
  DEMO_BENCHMARK_SAMPLES,
} from "./index";

const require = createRequire(import.meta.url);
const { DatabaseSync: DatabaseSyncConstructor } = require("node:sqlite") as {
  DatabaseSync: typeof DatabaseSync;
};

describe("Model 4: Predictive Maintenance Persistence Layer", () => {
  let memoryDb: DatabaseSync;
  let repo: MaintenancePersistenceRepository;

  beforeEach(() => {
    // Create fresh isolated in-memory SQLite database for each test
    memoryDb = new DatabaseSyncConstructor(":memory:");
    ensureMaintenanceSchema(memoryDb);
    repo = new MaintenancePersistenceRepository(memoryDb);

    // Register a valid test factory machine in manufacturing_machines
    const now = new Date().toISOString();
    memoryDb
      .prepare(
        `INSERT INTO manufacturing_machines (
          id, machineCode, machineType, lineId, location, status, createdAt, updatedAt
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        "M-TAB-TEST-01",
        "TABBER-01",
        "tabber_stringer",
        "LINE-A",
        "Bay 3",
        "operational",
        now,
        now
      );
  });

  describe("Task 1 & 2: Equipment Data Contract & Schema Initialization", () => {
    it("initializes additive columns idempotently in memory", () => {
      const cols = memoryDb
        .prepare("PRAGMA table_info(maintenance_predictions)")
        .all() as Array<{ name: string }>;
      const colNames = new Set(cols.map((c) => c.name));

      expect(colNames.has("id")).toBe(true);
      expect(colNames.has("machineId")).toBe(true);
      expect(colNames.has("userId")).toBe(true);
      expect(colNames.has("domain")).toBe(true);
      expect(colNames.has("dataSource")).toBe(true);
      expect(colNames.has("isBenchmark")).toBe(true);
      expect(colNames.has("sensorValues")).toBe(true);
      expect(colNames.has("healthState")).toBe(true);
      expect(colNames.has("failureMode")).toBe(true);
      expect(colNames.has("failureProbability")).toBe(true);
      expect(colNames.has("remainingUsefulLifeHours")).toBe(true);
      expect(colNames.has("urgency")).toBe(true);
      expect(colNames.has("riskFactors")).toBe(true);
      expect(colNames.has("modeProbabilities")).toBe(true);
      expect(colNames.has("recommendedAction")).toBe(true);
    });

    it("saves and retrieves a valid genuine factory assessment with full metadata", async () => {
      const assessment = await repo.saveAssessment(
        {
          machineId: "M-TAB-TEST-01",
          machineCategory: "tabber_stringer",
          componentName: "ribbon_cutter_knife",
          domain: "solar_factory",
          dataSource: "edge_gateway",
          isBenchmark: false,
          measurementTimestamp: "2026-10-22T10:00:00.000Z",
          sensorValues: {
            air_temperature_k: 298.5,
            process_temperature_k: 308.2,
            rotational_speed_rpm: 1520.0,
            torque_nm: 38.5,
            tool_wear_min: 45.0,
            vibration_rms: 0.18,
          },
          healthState: "healthy",
          failureMode: "none",
          failureProbability: 0.045,
          healthyProbability: 0.955,
          remainingUsefulLifeHours: 180.5,
          urgency: "routine",
          confidence: 0.94,
          riskFactors: [
            {
              factor_name: "Cutter Shear Vibration",
              impact_score: 0.08,
              measured_value: 0.18,
              nominal_baseline: 0.15,
              deviation_direction: "nominal",
              description: "Vibration baseline is nominal.",
            },
          ],
          modeProbabilities: {
            none: 0.955,
            tool_wear_failure: 0.025,
            power_failure: 0.02,
          },
          recommendedAction: "Cutter blade within standard parameters. Continue operations.",
        },
        { userId: "operator_alex", role: "user" }
      );

      expect(assessment.id).toMatch(/^pdm_/);
      expect(assessment.machineId).toBe("M-TAB-TEST-01");
      expect(assessment.userId).toBe("operator_alex");
      expect(assessment.domain).toBe("solar_factory");
      expect(assessment.dataSource).toBe("edge_gateway");
      expect(assessment.isBenchmark).toBe(false);
      expect(assessment.failureProbability).toBeCloseTo(0.045);
      expect(assessment.sensorValues?.torque_nm).toBe(38.5);
      expect(assessment.riskFactors?.[0].factor_name).toBe("Cutter Shear Vibration");

      // Verify retrieval by ID
      const fetched = await repo.getAssessmentById(assessment.id, {
        userId: "operator_alex",
        role: "user",
      });
      expect(fetched).not.toBeNull();
      expect(fetched?.id).toBe(assessment.id);
      expect(fetched?.componentName).toBe("ribbon_cutter_knife");
    });
  });

  describe("Task 3: Cross-User Ownership & Isolation", () => {
    it("prevents operator B from retrieving operator A's genuine private assessment", async () => {
      // Save private assessment owned by operator_a
      const saved = await repo.saveAssessment(
        {
          machineId: "M-TAB-TEST-01",
          domain: "solar_factory",
          dataSource: "scada_modbus",
          failureProbability: 0.12,
          remainingUsefulLifeHours: 120.0,
          healthState: "healthy",
        },
        { userId: "operator_a", role: "user" }
      );

      // Operator A can access
      const accessA = await repo.getAssessmentById(saved.id, {
        userId: "operator_a",
        role: "user",
      });
      expect(accessA).not.toBeNull();
      expect(accessA?.id).toBe(saved.id);

      // Operator B is BLOCKED (returns null)
      const accessB = await repo.getAssessmentById(saved.id, {
        userId: "operator_b",
        role: "user",
      });
      expect(accessB).toBeNull();

      // Admin can access
      const accessAdmin = await repo.getAssessmentById(saved.id, {
        userId: "admin_user",
        role: "admin",
      });
      expect(accessAdmin).not.toBeNull();
      expect(accessAdmin?.id).toBe(saved.id);

      // Anonymous is BLOCKED
      const accessAnon = await repo.getAssessmentById(saved.id, {});
      expect(accessAnon).toBeNull();
    });

    it("filters machine history by owner identity", async () => {
      // Operator A saves 2 assessments
      await repo.saveAssessment(
        {
          machineId: "M-TAB-TEST-01",
          domain: "solar_factory",
          dataSource: "scada_modbus",
          failureProbability: 0.1,
          remainingUsefulLifeHours: 100.0,
          healthState: "healthy",
        },
        { userId: "operator_a", role: "user" }
      );
      await repo.saveAssessment(
        {
          machineId: "M-TAB-TEST-01",
          domain: "solar_factory",
          dataSource: "scada_modbus",
          failureProbability: 0.2,
          remainingUsefulLifeHours: 80.0,
          healthState: "healthy",
        },
        { userId: "operator_a", role: "user" }
      );

      // Operator B saves 1 assessment
      await repo.saveAssessment(
        {
          machineId: "M-TAB-TEST-01",
          domain: "solar_factory",
          dataSource: "scada_modbus",
          failureProbability: 0.3,
          remainingUsefulLifeHours: 60.0,
          healthState: "warning",
        },
        { userId: "operator_b", role: "user" }
      );

      // Query as Operator A -> should see 2
      const histA = await repo.getMachineHistory(
        "M-TAB-TEST-01",
        {},
        { userId: "operator_a", role: "user" }
      );
      expect(histA.total).toBe(2);
      expect(histA.records.length).toBe(2);
      expect(histA.records.every((r) => r.userId === "operator_a")).toBe(true);

      // Query as Operator B -> should see 1
      const histB = await repo.getMachineHistory(
        "M-TAB-TEST-01",
        {},
        { userId: "operator_b", role: "user" }
      );
      expect(histB.total).toBe(1);
      expect(histB.records[0].userId).toBe("operator_b");

      // Query as Admin -> should see all 3
      const histAdmin = await repo.getMachineHistory(
        "M-TAB-TEST-01",
        {},
        { userId: "admin", role: "admin" }
      );
      expect(histAdmin.total).toBe(3);
    });
  });

  describe("Task 4: Academic Demonstration Mode Separation", () => {
    it("clearly separates benchmark samples from genuine factory telemetry", async () => {
      // 1. Seed benchmark samples explicitly
      const seedResult = await repo.seedDemoBenchmarkSamples({
        userId: "demo_caller",
        role: "user",
      });
      expect(seedResult.inserted).toBe(DEMO_BENCHMARK_SAMPLES.length);

      // 2. Query readiness counts
      const readiness = await repo.getDatasetReadinessCounts();
      expect(readiness.tableCounts.benchmarkDemoAssessments).toBe(DEMO_BENCHMARK_SAMPLES.length);
      expect(readiness.tableCounts.genuineFactoryAssessments).toBe(0);
      expect(readiness.datasetStatus).toBe("DATASET_BLOCKED");
      expect(readiness.blockingReasons.length).toBeGreaterThan(0);

      // 3. Benchmark samples are visible across operators because isBenchmark = true
      const recent = await repo.getRecentAssessments(
        { isBenchmark: true },
        { userId: "operator_c", role: "user" }
      );
      expect(recent.total).toBe(DEMO_BENCHMARK_SAMPLES.length);
      expect(recent.records.every((r) => r.isBenchmark === true)).toBe(true);
      expect(recent.records.every((r) => r.domain === "ai4i_synthetic_benchmark")).toBe(true);

      // 4. Clear benchmark samples
      const clearResult = await repo.clearDemoBenchmarkSamples();
      expect(clearResult.deleted).toBe(DEMO_BENCHMARK_SAMPLES.length);

      const afterClear = await repo.getRecentAssessments({ isBenchmark: true });
      expect(afterClear.total).toBe(0);
    });
  });

  describe("Task 5: Validation, Bounds & Integrity Constraints", () => {
    it("rejects assessment when machine does not exist in manufacturing_machines (foreign key)", async () => {
      await expect(
        repo.saveAssessment({
          machineId: "NON_EXISTENT_MACHINE_999",
          domain: "solar_factory",
          dataSource: "edge_gateway",
          failureProbability: 0.1,
          remainingUsefulLifeHours: 100.0,
          healthState: "healthy",
        })
      ).rejects.toThrow(MachineNotFoundError);
    });

    it("rejects invalid probability bounds (< 0.0 or > 1.0)", async () => {
      await expect(
        repo.saveAssessment({
          machineId: "M-TAB-TEST-01",
          domain: "solar_factory",
          dataSource: "edge_gateway",
          failureProbability: 1.5, // Invalid > 1.0
          remainingUsefulLifeHours: 100.0,
          healthState: "healthy",
        })
      ).rejects.toThrow(PersistenceValidationError);

      await expect(
        repo.saveAssessment({
          machineId: "M-TAB-TEST-01",
          domain: "solar_factory",
          dataSource: "edge_gateway",
          failureProbability: -0.1, // Invalid < 0.0
          remainingUsefulLifeHours: 100.0,
          healthState: "healthy",
        })
      ).rejects.toThrow(PersistenceValidationError);
    });

    it("rejects invalid remaining useful life (< 0.0)", async () => {
      await expect(
        repo.saveAssessment({
          machineId: "M-TAB-TEST-01",
          domain: "solar_factory",
          dataSource: "edge_gateway",
          failureProbability: 0.5,
          remainingUsefulLifeHours: -10.0, // Invalid negative
          healthState: "failure",
        })
      ).rejects.toThrow(PersistenceValidationError);
    });

    it("rejects sensor values violating physical bounds", async () => {
      await expect(
        repo.saveAssessment({
          machineId: "M-TAB-TEST-01",
          domain: "solar_factory",
          dataSource: "edge_gateway",
          failureProbability: 0.2,
          remainingUsefulLifeHours: 50.0,
          healthState: "healthy",
          sensorValues: {
            air_temperature_k: 500.0, // Impossible ambient air temp (> 350 K)
          },
        })
      ).rejects.toThrow(PersistenceValidationError);

      await expect(
        repo.saveAssessment({
          machineId: "M-TAB-TEST-01",
          domain: "solar_factory",
          dataSource: "edge_gateway",
          failureProbability: 0.2,
          remainingUsefulLifeHours: 50.0,
          healthState: "healthy",
          sensorValues: {
            torque_nm: 800.0, // Exceeds 500 Nm physical limit
          },
        })
      ).rejects.toThrow(PersistenceValidationError);
    });

    it("rejects invalid domain string", async () => {
      await expect(
        repo.saveAssessment({
          machineId: "M-TAB-TEST-01",
          domain: "unauthorized_domain" as any,
          dataSource: "edge_gateway",
          failureProbability: 0.2,
          remainingUsefulLifeHours: 50.0,
          healthState: "healthy",
        })
      ).rejects.toThrow(PersistenceValidationError);
    });

    it("rejects empty data source provenance", async () => {
      await expect(
        repo.saveAssessment({
          machineId: "M-TAB-TEST-01",
          domain: "solar_factory",
          dataSource: "", // Missing provenance
          failureProbability: 0.2,
          remainingUsefulLifeHours: 50.0,
          healthState: "healthy",
        })
      ).rejects.toThrow(PersistenceValidationError);
    });

    it("handles duplicate ID upsert gracefully without crashing", async () => {
      const fixedId = "pdm_fixed_test_id";
      const first = await repo.saveAssessment({
        id: fixedId,
        machineId: "M-TAB-TEST-01",
        domain: "solar_factory",
        dataSource: "edge_gateway",
        failureProbability: 0.25,
        remainingUsefulLifeHours: 100.0,
        healthState: "healthy",
        recommendedAction: "Initial recommendation",
      });
      expect(first.id).toBe(fixedId);
      expect(first.failureProbability).toBeCloseTo(0.25);

      // Re-saving with same ID updates the record
      const updated = await repo.saveAssessment({
        id: fixedId,
        machineId: "M-TAB-TEST-01",
        domain: "solar_factory",
        dataSource: "edge_gateway",
        failureProbability: 0.75,
        remainingUsefulLifeHours: 20.0,
        healthState: "warning",
        recommendedAction: "Updated recommendation",
      });
      expect(updated.id).toBe(fixedId);
      expect(updated.failureProbability).toBeCloseTo(0.75);
      expect(updated.healthState).toBe("warning");

      const fetched = await repo.getAssessmentById(fixedId);
      expect(fetched?.failureProbability).toBeCloseTo(0.75);
      expect(fetched?.healthState).toBe("warning");
    });

    it("supports pagination and sorting across recent assessments", async () => {
      for (let i = 1; i <= 5; i++) {
        await repo.saveAssessment({
          id: `pdm_page_${i}`,
          machineId: "M-TAB-TEST-01",
          domain: "solar_factory",
          dataSource: "edge_gateway",
          failureProbability: i * 0.1,
          remainingUsefulLifeHours: 100.0 - i * 10,
          healthState: "healthy",
          createdAt: new Date(Date.now() + i * 1000).toISOString(),
        });
      }

      // First page of 2
      const page1 = await repo.getRecentAssessments({ limit: 2, offset: 0 });
      expect(page1.total).toBe(5);
      expect(page1.records.length).toBe(2);
      expect(page1.records[0].id).toBe("pdm_page_5"); // newest first
      expect(page1.records[1].id).toBe("pdm_page_4");

      // Second page of 2
      const page2 = await repo.getRecentAssessments({ limit: 2, offset: 2 });
      expect(page2.total).toBe(5);
      expect(page2.records.length).toBe(2);
      expect(page2.records[0].id).toBe("pdm_page_3");
      expect(page2.records[1].id).toBe("pdm_page_2");
    });
  });

  describe("Stabilization Audits: Nullable Metrics, Provenance & Survival", () => {
    it("Task 1: preserves genuine null failureProbability and remainingUsefulLifeHours without false zeros", async () => {
      const assessment = await repo.saveAssessment(
        {
          machineId: "M-TAB-TEST-01",
          domain: "solar_factory",
          dataSource: "edge_gateway",
          healthState: "unknown",
          failureProbability: null, // Untrained / unavailable probability
          healthyProbability: null,
          remainingUsefulLifeHours: null, // RUL uncomputed
          confidence: null,
          recommendedAction: "Awaiting model training on physical factory telemetry.",
        },
        { userId: "op_stabilization", role: "user" }
      );

      expect(assessment.failureProbability).toBeNull();
      expect(assessment.healthyProbability).toBeNull();
      expect(assessment.remainingUsefulLifeHours).toBeNull();
      expect(assessment.confidence).toBeNull();

      const fetched = await repo.getAssessmentById(assessment.id, {
        userId: "op_stabilization",
        role: "user",
      });
      expect(fetched).not.toBeNull();
      // MUST NOT be falsified as 0.0 or 0
      expect(fetched?.failureProbability).toBeNull();
      expect(fetched?.healthyProbability).toBeNull();
      expect(fetched?.remainingUsefulLifeHours).toBeNull();
      expect(fetched?.confidence).toBeNull();
    });

    it("Task 2: enforces strict domain provenance and prevents synthetic contamination", async () => {
      // 1. Synthetic AI4I data cannot claim to be non-benchmark
      await expect(
        repo.saveAssessment({
          machineId: "M-TAB-TEST-01",
          domain: "ai4i_synthetic_benchmark",
          isBenchmark: false, // VIOLATION
          dataSource: "ai4i_synthetic_benchmark_demo",
          healthState: "healthy",
        })
      ).rejects.toThrow(/Domain provenance violation.*cannot be persisted with isBenchmark=false/);

      // 2. Synthetic AI4I data cannot claim live factory edge gateway
      await expect(
        repo.saveAssessment({
          machineId: "M-TAB-TEST-01",
          domain: "ai4i_synthetic_benchmark",
          isBenchmark: true,
          dataSource: "edge_gateway", // VIOLATION: live factory source claimed
          healthState: "healthy",
        })
      ).rejects.toThrow(/Domain provenance violation.*cannot claim live factory data source/);

      // 3. Genuine solar factory records cannot be flagged as benchmark
      await expect(
        repo.saveAssessment({
          machineId: "M-TAB-TEST-01",
          domain: "solar_factory",
          isBenchmark: true, // VIOLATION
          dataSource: "edge_gateway",
          healthState: "healthy",
        })
      ).rejects.toThrow(/Domain provenance violation.*cannot have isBenchmark=true/);

      // 4. Genuine solar factory records cannot use benchmark data sources
      await expect(
        repo.saveAssessment({
          machineId: "M-TAB-TEST-01",
          domain: "solar_factory",
          isBenchmark: false,
          dataSource: "ai4i_synthetic_benchmark_demo", // VIOLATION
          healthState: "healthy",
        })
      ).rejects.toThrow(/Domain provenance violation.*cannot use benchmark data source/);
    });

    it("Task 3: verifies complete persistence survival across process restart / new database connection", async () => {
      const { join } = await import("node:path");
      const { tmpdir } = await import("node:os");
      const { unlinkSync, existsSync } = await import("node:fs");

      const diskDbPath = join(tmpdir(), `test-model4-survival-${Date.now()}-${Math.random().toString(36).slice(2, 6)}.db`);

      try {
        // Step 1: Open connection 1, initialize schema and insert record
        const diskDb1 = new DatabaseSyncConstructor(diskDbPath);
        ensureMaintenanceSchema(diskDb1);
        const diskRepo1 = new MaintenancePersistenceRepository(diskDb1);

        diskDb1
          .prepare(
            `INSERT INTO manufacturing_machines (
              id, machineCode, machineType, lineId, location, status, createdAt, updatedAt
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
          )
          .run(
            "M-DISK-TEST-01",
            "DISK-TABBER",
            "tabber_stringer",
            "LINE-DISK",
            "Bay 9",
            "operational",
            new Date().toISOString(),
            new Date().toISOString()
          );

        const saved = await diskRepo1.saveAssessment(
          {
            machineId: "M-DISK-TEST-01",
            machineCategory: "tabber_stringer",
            componentName: "ultrasonic_solder_horn",
            domain: "solar_factory",
            dataSource: "edge_gateway",
            isBenchmark: false,
            measurementTimestamp: "2026-10-22T12:00:00.000Z",
            sensorValues: {
              ultrasonic_frequency_khz: 40.2,
              transducer_temp_c: 65.4,
              cycle_count: 142000,
            },
            healthState: "warning",
            failureMode: "tool_wear_failure",
            failureProbability: 0.385,
            healthyProbability: 0.615,
            remainingUsefulLifeHours: 42.0,
            urgency: "warning",
            confidence: 0.88,
            riskFactors: [
              {
                factor_name: "Transducer Resonance Drift",
                impact_score: 0.62,
                measured_value: 40.2,
                nominal_baseline: 40.0,
                deviation_direction: "high",
                description: "Resonant frequency drifting due to horn acoustic wear.",
              },
            ],
            modeProbabilities: {
              none: 0.615,
              tool_wear_failure: 0.385,
            },
            recommendedAction: "Schedule horn surface reconditioning during shift handover.",
          },
          { userId: "lead_maintenance_engineer", role: "operator" }
        );

        expect(saved.id).toBeDefined();

        // Step 2: Simulate process crash/exit by closing connection 1
        diskDb1.close();

        // Step 3: Simulate application reboot: open fresh connection 2 to same file
        const diskDb2 = new DatabaseSyncConstructor(diskDbPath);
        const diskRepo2 = new MaintenancePersistenceRepository(diskDb2);

        // Step 4: Retrieve record and assert perfect bit-for-bit fidelity
        const restored = await diskRepo2.getAssessmentById(saved.id, {
          userId: "lead_maintenance_engineer",
          role: "operator",
        });

        expect(restored).not.toBeNull();
        expect(restored?.id).toBe(saved.id);
        expect(restored?.machineId).toBe("M-DISK-TEST-01");
        expect(restored?.machineCategory).toBe("tabber_stringer");
        expect(restored?.componentName).toBe("ultrasonic_solder_horn");
        expect(restored?.domain).toBe("solar_factory");
        expect(restored?.dataSource).toBe("edge_gateway");
        expect(restored?.isBenchmark).toBe(false);
        expect(restored?.failureProbability).toBeCloseTo(0.385);
        expect(restored?.healthyProbability).toBeCloseTo(0.615);
        expect(restored?.remainingUsefulLifeHours).toBeCloseTo(42.0);
        expect(restored?.urgency).toBe("warning");
        expect(restored?.sensorValues?.ultrasonic_frequency_khz).toBe(40.2);
        expect(restored?.riskFactors?.[0].factor_name).toBe("Transducer Resonance Drift");
        expect(restored?.modeProbabilities?.tool_wear_failure).toBeCloseTo(0.385);
        expect(restored?.recommendedAction).toContain("Schedule horn surface reconditioning");

        diskDb2.close();
      } finally {
        if (existsSync(diskDbPath)) {
          try {
            unlinkSync(diskDbPath);
          } catch {
            // Cleanup best-effort
          }
        }
      }
    });

    it("Task 4: upgrades existing legacy database with additive columns non-destructively", async () => {
      // Simulate older SQLite database with legacy column schema
      const legacyDb = new DatabaseSyncConstructor(":memory:");
      legacyDb.exec(`
        CREATE TABLE manufacturing_machines (
          id TEXT PRIMARY KEY,
          machineCode TEXT UNIQUE NOT NULL,
          machineType TEXT NOT NULL,
          lineId TEXT NOT NULL,
          location TEXT,
          status TEXT NOT NULL DEFAULT 'operational',
          lastMaintenanceAt TEXT,
          nextMaintenanceDue TEXT,
          metadata TEXT,
          createdAt TEXT NOT NULL,
          updatedAt TEXT NOT NULL
        );

        CREATE TABLE maintenance_predictions (
          id TEXT PRIMARY KEY,
          machineId TEXT NOT NULL REFERENCES manufacturing_machines(id) ON DELETE CASCADE,
          modelVersionId TEXT,
          component TEXT NOT NULL,
          estimatedRemainingLifeHours REAL,
          failureProbability7Days REAL,
          urgency TEXT NOT NULL DEFAULT 'low',
          recommendedAction TEXT,
          predictedAt TEXT NOT NULL
        );
      `);

      // Add a legacy record
      legacyDb.exec(`
        INSERT INTO manufacturing_machines (id, machineCode, machineType, lineId, status, createdAt, updatedAt)
        VALUES ('M-LEGACY-01', 'LEGACY-STR', 'tabber', 'LINE-1', 'operational', '2026-01-01', '2026-01-01');

        INSERT INTO maintenance_predictions (
          id, machineId, modelVersionId, component, estimatedRemainingLifeHours,
          failureProbability7Days, urgency, recommendedAction, predictedAt
        ) VALUES (
          'maint_legacy_001', 'M-LEGACY-01', 'v1', 'cutter', 150.0, 0.05, 'low', 'Routine inspection', '2026-01-01T00:00:00Z'
        );
      `);

      // Apply ensureMaintenanceSchema to simulate active migration
      ensureMaintenanceSchema(legacyDb);
      const upgradedRepo = new MaintenancePersistenceRepository(legacyDb);

      // Verify the legacy record is still readable and aliased cleanly
      const legacyRecord = await upgradedRepo.getAssessmentById("maint_legacy_001");
      expect(legacyRecord).not.toBeNull();
      expect(legacyRecord?.id).toBe("maint_legacy_001");
      expect(legacyRecord?.componentName).toBe("cutter");
      expect(legacyRecord?.remainingUsefulLifeHours).toBe(150.0);
      expect(legacyRecord?.failureProbability).toBe(0.05);

      // Verify new Model 4 assessment with modern contract can be written to the upgraded DB
      const modernRecord = await upgradedRepo.saveAssessment(
        {
          machineId: "M-LEGACY-01",
          domain: "solar_factory",
          dataSource: "edge_gateway",
          healthState: "healthy",
          failureProbability: null,
          remainingUsefulLifeHours: 200.0,
        },
        { userId: "op_upgraded", role: "user" }
      );

      expect(modernRecord.id).toBeDefined();
      expect(modernRecord.failureProbability).toBeNull();
    });
  });
});
