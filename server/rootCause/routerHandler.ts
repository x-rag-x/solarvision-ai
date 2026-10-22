/**
 * SolarVision AI — Model 2: Manufacturing Root Cause Analysis
 * Authenticated tRPC Router & Endpoint Handlers
 */

import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { UNAUTHED_ERR_MSG } from "@shared/const";
import { publicProcedure, router } from "../_core/trpc";
import { getInspectionById } from "../db";
import { analyzeRootCause, getModel2Status } from "./service";
import {
  persistRootCauseResponse,
  getManufacturingBatches,
  getManufacturingBatchById,
  getManufacturingMachines,
  getManufacturingMachineById,
  getSensorHistory,
  getProductionEvents,
  getConfirmedRootCauseAnnotations,
  getAllConfirmedRootCauseAnnotations,
  saveConfirmedRootCauseAnnotation,
  getRootCausePredictionHistory,
  getRootCauseReadinessSummary,
} from "./dbContract";
import {
  validateAndPreviewCsv,
  commitImportCsv,
  linkInspectionToBatch,
  ImportEntityType,
} from "./csvImport";
import {
  CANONICAL_FEATURES_V2,
  CANONICAL_FEATURE_COUNT_V2,
  FEATURE_SCHEMA_VERSION,
  RECONCILED_ROOT_CAUSE_CATALOG,
} from "./featureContract";
import type { RootCauseAnalysisInput } from "./types";

/**
 * Enforces authenticated operator identity on root-cause procedures.
 */
const authenticatedProcedure = publicProcedure.use(async ({ ctx, next }) => {
  if (!ctx.user) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: UNAUTHED_ERR_MSG });
  }

  return next({
    ctx: {
      ...ctx,
      user: ctx.user,
    },
  });
});

export const defectInputSchema = z.object({
  defectType: z.string().min(1),
  confidence: z.number().min(0).max(1),
  x1: z.number(),
  y1: z.number(),
  x2: z.number(),
  y2: z.number(),
  classId: z.number().optional(),
});

export const sensorMeasurementInputSchema = z.object({
  sensorType: z.string().min(1),
  measurementValue: z.number(),
  unit: z.string().optional(),
  isAnomaly: z.boolean().optional(),
  anomalyScore: z.number().min(0).max(1).optional(),
  recordedAt: z.string().optional(),
});

export const productionEventInputSchema = z.object({
  eventType: z.string().min(1),
  severity: z.enum(["info", "low", "medium", "high", "critical"]).optional(),
  message: z.string().optional(),
  startedAt: z.string().optional(),
  resolvedAt: z.string().optional(),
});

export const batchInfoInputSchema = z.object({
  batchId: z.string().min(1),
  batchNumber: z.string().optional(),
  waferType: z.string().optional(),
  cellLine: z.string().optional(),
  targetQuantity: z.number().int().positive().optional(),
  actualQuantity: z.number().int().nonnegative().optional(),
  status: z.string().optional(),
});

export const machineInfoInputSchema = z.object({
  machineId: z.string().min(1),
  machineCode: z.string().optional(),
  machineType: z.string().optional(),
  lineId: z.string().optional(),
  status: z.string().optional(),
  lastMaintenanceAt: z.string().optional(),
  nextMaintenanceDue: z.string().optional(),
});

export const rootCauseAnalysisInputSchema = z.object({
  inspectionId: z.string().min(1),
  batchId: z.string().optional(),
  machineId: z.string().optional(),
  operatorId: z.string().optional(),
  detections: z.array(defectInputSchema).default([]),
  batch: batchInfoInputSchema.optional(),
  machine: machineInfoInputSchema.optional(),
  sensorMeasurements: z.array(sensorMeasurementInputSchema).default([]),
  productionEvents: z.array(productionEventInputSchema).default([]),
  confidenceThreshold: z.number().min(0).max(1).optional(),
});

/**
 * Authenticated tRPC Router for Model 2 Root Cause Analysis
 */
export const rootCauseRouter = router({
  /**
   * Run multi-modal root cause analysis for an inspection.
   * Enforces requester inspection ownership to deny cross-user access.
   */
  analyze: authenticatedProcedure
    .input(rootCauseAnalysisInputSchema)
    .mutation(async ({ input, ctx }) => {
      // 1. Guard against cross-user inspection access
      const requester = {
        userId: ctx.user.openId || String(ctx.user.id),
        role: ctx.user.role,
      };

      const existingRecord = await getInspectionById(input.inspectionId, requester);
      if (!existingRecord) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Access denied to inspection record or record does not exist.",
        });
      }

      // 2. Execute root cause analysis
      const response = await analyzeRootCause(input as RootCauseAnalysisInput);

      // 3. Persist predictions if ready
      if (response.status === "ready" && response.probableCauses.length > 0) {
        await persistRootCauseResponse(response);
      }

      return response;
    }),

  /**
   * Query Model 2 readiness, version, and training status.
   */
  status: authenticatedProcedure.query(async () => {
    return getModel2Status();
  }),

  /**
   * Comprehensive data and training readiness forensic report.
   */
  readiness: authenticatedProcedure.query(async () => {
    return getRootCauseReadinessSummary();
  }),

  /**
   * Unified Schema Version 2.0.0 Input Feature Specification & Reconciled Catalog.
   */
  canonicalContract: authenticatedProcedure.query(async () => {
    return {
      schemaVersion: FEATURE_SCHEMA_VERSION,
      featureCount: CANONICAL_FEATURE_COUNT_V2,
      features: CANONICAL_FEATURES_V2,
      taxonomy: RECONCILED_ROOT_CAUSE_CATALOG,
    };
  }),

  /**
   * Retrieve manufacturing batches with status and progress filters.
   */
  batches: authenticatedProcedure
    .input(
      z
        .object({
          status: z.string().optional(),
          waferType: z.string().optional(),
          cellLine: z.string().optional(),
          limit: z.number().int().min(1).max(100).default(50),
          offset: z.number().int().min(0).default(0),
        })
        .optional()
    )
    .query(async ({ input }) => {
      return getManufacturingBatches(input);
    }),

  /**
   * Retrieve a single manufacturing batch by ID.
   */
  batchDetail: authenticatedProcedure
    .input(z.object({ batchId: z.string().min(1) }))
    .query(async ({ input }) => {
      const batch = await getManufacturingBatchById(input.batchId);
      if (!batch) {
        throw new TRPCError({ code: "NOT_FOUND", message: `Batch '${input.batchId}' not found.` });
      }
      return batch;
    }),

  /**
   * Retrieve manufacturing machine equipment list.
   */
  machines: authenticatedProcedure
    .input(
      z
        .object({
          machineType: z.string().optional(),
          lineId: z.string().optional(),
          status: z.string().optional(),
        })
        .optional()
    )
    .query(async ({ input }) => {
      return getManufacturingMachines(input);
    }),

  /**
   * Retrieve a single machine equipment by ID.
   */
  machineDetail: authenticatedProcedure
    .input(z.object({ machineId: z.string().min(1) }))
    .query(async ({ input }) => {
      const machine = await getManufacturingMachineById(input.machineId);
      if (!machine) {
        throw new TRPCError({ code: "NOT_FOUND", message: `Machine '${input.machineId}' not found.` });
      }
      return machine;
    }),

  /**
   * Query sensor history telemetry streams.
   */
  sensorHistory: authenticatedProcedure
    .input(
      z.object({
        machineId: z.string().optional(),
        batchId: z.string().optional(),
        sensorType: z.string().optional(),
        startTime: z.string().optional(),
        endTime: z.string().optional(),
        limit: z.number().int().min(1).max(1000).default(100),
      })
    )
    .query(async ({ input }) => {
      return getSensorHistory(input);
    }),

  /**
   * Query production events recorded on equipment.
   */
  productionEvents: authenticatedProcedure
    .input(
      z.object({
        machineId: z.string().optional(),
        batchId: z.string().optional(),
        severity: z.string().optional(),
        startTime: z.string().optional(),
        endTime: z.string().optional(),
        limit: z.number().int().min(1).max(500).default(100),
      })
    )
    .query(async ({ input }) => {
      return getProductionEvents(input);
    }),

  /**
   * Retrieve confirmed root-cause annotations for an inspection.
   * Enforces inspection ownership to protect confidential quality records.
   */
  annotations: authenticatedProcedure
    .input(z.object({ inspectionId: z.string().min(1) }))
    .query(async ({ input, ctx }) => {
      const requester = {
        userId: ctx.user.openId || String(ctx.user.id),
        role: ctx.user.role,
      };
      const existing = await getInspectionById(input.inspectionId, requester);
      if (!existing) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Access denied to inspection record." });
      }
      return getConfirmedRootCauseAnnotations(input.inspectionId);
    }),

  /**
   * Submit an expert-verified or failure-analysis confirmed root-cause ground truth annotation.
   * Enforces inspection ownership.
   */
  annotate: authenticatedProcedure
    .input(
      z.object({
        inspectionId: z.string().min(1),
        defectId: z.union([z.string(), z.number()]).optional(),
        confirmedCause: z.string().min(1),
        confidenceLevel: z.enum(["confirmed", "probable", "investigative"]),
        investigationNotes: z.string().optional(),
        supportingEvidenceFactors: z.array(z.string()).optional(),
        isCorrection: z.boolean().optional(),
        priorAnnotationId: z.string().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const requester = {
        userId: ctx.user.openId || String(ctx.user.id),
        role: ctx.user.role,
      };
      const existing = await getInspectionById(input.inspectionId, requester);
      if (!existing) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Access denied to inspection record." });
      }

      const verifiedBy = ctx.user.openId || String(ctx.user.id);
      const annotationId = await saveConfirmedRootCauseAnnotation({
        ...input,
        verifiedBy,
      });

      return { success: true, annotationId };
    }),

  /**
   * List confirmed root-cause annotations across inspections for quality reviewers.
   */
  allAnnotations: authenticatedProcedure
    .input(
      z
        .object({
          limit: z.number().int().min(1).max(200).default(50),
          offset: z.number().int().min(0).default(0),
          cause: z.string().optional(),
          confidenceLevel: z.string().optional(),
        })
        .optional()
    )
    .query(async ({ input }) => {
      return getAllConfirmedRootCauseAnnotations(input);
    }),

  /**
   * Retrieve historical root-cause predictions for an inspection.
   * Enforces inspection ownership.
   */
  predictionHistory: authenticatedProcedure
    .input(z.object({ inspectionId: z.string().min(1) }))
    .query(async ({ input, ctx }) => {
      const requester = {
        userId: ctx.user.openId || String(ctx.user.id),
        role: ctx.user.role,
      };
      const existing = await getInspectionById(input.inspectionId, requester);
      if (!existing) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Access denied to inspection record." });
      }

      return getRootCausePredictionHistory(input.inspectionId);
    }),

  /**
   * STAGE 1: Pre-validates incoming manufacturing CSV upload against formal schema and physics.
   * Does NOT write to database.
   */
  importPreview: authenticatedProcedure
    .input(
      z.object({
        entityType: z.enum([
          "batches",
          "machines",
          "sensor_readings",
          "production_events",
          "root_cause_annotations",
          "inspection_batch_links",
        ]),
        csvContent: z.string().min(1, "CSV content cannot be empty").max(10_000_000, "CSV content exceeds 10MB limit"),
        filename: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      return validateAndPreviewCsv(input.entityType as ImportEntityType, input.csvContent, input.filename);
    }),

  /**
   * STAGE 2: Atomically commits validated CSV records into SQLite.
   * Enforces strict validation, transaction rollback, and immutable audit logging.
   */
  importCommit: authenticatedProcedure
    .input(
      z.object({
        entityType: z.enum([
          "batches",
          "machines",
          "sensor_readings",
          "production_events",
          "root_cause_annotations",
          "inspection_batch_links",
        ]),
        csvContent: z.string().min(1).max(10_000_000).optional(),
        rows: z.array(z.record(z.string(), z.any())).optional(),
        filename: z.string().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const contentOrRows = input.csvContent || input.rows;
      if (!contentOrRows) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Either csvContent or rows must be provided for import commit.",
        });
      }

      const operatorName = ctx.user.openId || String(ctx.user.id);
      return commitImportCsv(input.entityType as ImportEntityType, contentOrRows, {
        operatorName,
        filename: input.filename,
      });
    }),

  /**
   * Link an existing inspection to a manufacturing batch and machine.
   * Enforces requester inspection ownership and verifies foreign keys.
   */
  linkInspection: authenticatedProcedure
    .input(
      z.object({
        inspectionId: z.string().min(1, "Inspection ID is required"),
        batchId: z.string().min(1, "Batch ID is required"),
        machineId: z.string().min(1, "Machine ID is required"),
        waferPosition: z.string().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const requester = {
        userId: ctx.user.openId || String(ctx.user.id),
        role: ctx.user.role,
      };

      const existing = await getInspectionById(input.inspectionId, requester);
      if (!existing) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Access denied to inspection record or record does not exist.",
        });
      }

      try {
        return await linkInspectionToBatch(input);
      } catch (err: any) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: err.message || "Failed to link inspection to batch and machine.",
        });
      }
    }),
});
