/**
 * SolarVision AI — Model 4: Predictive Maintenance
 * Authenticated tRPC Router & Endpoint Handlers
 */

import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { UNAUTHED_ERR_MSG } from "@shared/const";
import { publicProcedure, router } from "../_core/trpc";
import {
  forecastPredictiveMaintenance,
  getModel4Status,
  predictBenchmarkMaintenance,
  getBenchmarkMetadata,
  getModel4ReadinessSummary,
} from "./service";
import {
  getMaintenanceAssessmentById,
  getMaintenanceHistory,
  getRecentMaintenanceAssessments,
  getMaintenanceReadinessSummary as getDbReadinessSummary,
  seedMaintenanceDemoSamples,
} from "./persistence";
import {
  CANONICAL_FEATURE_SPECS,
  CANONICAL_MAINTENANCE_FEATURE_COUNT,
  MODEL4_CONTRACT_VERSION,
} from "./featureContract";
import type { PredictiveMaintenanceInput } from "./types";

/**
 * Enforces authenticated operator identity on predictive-maintenance procedures.
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

export const predictiveMaintenanceInputSchema = z.object({
  machineId: z.string().optional(),
  domain: z
    .enum(["ai4i_synthetic_benchmark", "solar_factory"])
    .default("ai4i_synthetic_benchmark"),
  productType: z.enum(["L", "M", "H"]).or(z.string()).optional(),
  airTemperatureK: z.number().optional(),
  processTemperatureK: z.number().optional(),
  rotationalSpeedRpm: z.number().optional(),
  torqueNm: z.number().optional(),
  toolWearMin: z.number().optional(),
  rawFeatures: z.record(z.string(), z.number()).optional(),
  featureVector: z.array(z.number()).optional(),
  confidenceThreshold: z.number().min(0).max(1).default(0.5),
});

export const benchmarkPredictInputSchema = z.object({
  productType: z.enum(["L", "M", "H"]).or(z.string()),
  airTemperatureK: z.number(),
  processTemperatureK: z.number(),
  rotationalSpeedRpm: z.number(),
  torqueNm: z.number(),
  toolWearMin: z.number(),
  machineId: z.string().optional(),
  confidenceThreshold: z.number().min(0).max(1).default(0.5),
});

export const historyQuerySchema = z.object({
  machineId: z.string().min(1),
  domain: z.enum(["ai4i_synthetic_benchmark", "solar_factory"]).optional(),
  isBenchmark: z.boolean().optional(),
  healthState: z.enum(["healthy", "warning", "failure", "unknown"]).optional(),
  limit: z.number().int().min(1).max(200).default(50),
  offset: z.number().int().min(0).default(0),
});

export const recentQuerySchema = z.object({
  domain: z.enum(["ai4i_synthetic_benchmark", "solar_factory"]).optional(),
  isBenchmark: z.boolean().optional(),
  limit: z.number().int().min(1).max(200).default(20),
  offset: z.number().int().min(0).default(0),
});

export const assessmentByIdSchema = z.object({
  id: z.string().min(1),
});

export const seedDemoSchema = z.object({
  count: z.number().int().min(1).max(50).default(10),
});

/**
 * Isolated Authenticated tRPC Router for Model 4 Predictive Maintenance
 */
export const predictiveMaintenanceRouter = router({
  /**
   * Deployment and readiness status query.
   */
  status: publicProcedure
    .input(
      z
        .object({
          domain: z.enum(["ai4i_synthetic_benchmark", "solar_factory"]).optional(),
        })
        .optional()
    )
    .query(async ({ input }) => {
      return getModel4Status(input?.domain);
    }),

  /**
   * AI4I benchmark citation, CC BY 4.0 license, and physical failure modes metadata.
   */
  modelMetadata: publicProcedure.query(async () => {
    return getBenchmarkMetadata();
  }),

  /**
   * Canonical 6-D AI4I feature definitions, physical limits, and nominal baselines.
   */
  canonicalContract: publicProcedure.query(() => {
    return {
      contractVersion: MODEL4_CONTRACT_VERSION,
      canonicalFeatureCount: CANONICAL_MAINTENANCE_FEATURE_COUNT,
      features: CANONICAL_FEATURE_SPECS,
    };
  }),

  /**
   * Full maintenance forecast procedure with strict domain segregation.
   */
  forecast: authenticatedProcedure
    .input(predictiveMaintenanceInputSchema)
    .mutation(async ({ ctx, input }) => {
      const requester = {
        userId: ctx.user.id != null ? String(ctx.user.id) : undefined,
        role: (ctx.user as any).role,
      };

      const result = await forecastPredictiveMaintenance(
        input as PredictiveMaintenanceInput,
        requester
      );
      return result;
    }),

  /**
   * Dedicated benchmark inference procedure.
   */
  benchmarkPredict: authenticatedProcedure
    .input(benchmarkPredictInputSchema)
    .mutation(async ({ ctx, input }) => {
      const requester = {
        userId: ctx.user.id != null ? String(ctx.user.id) : undefined,
        role: (ctx.user as any).role,
      };

      const result = await predictBenchmarkMaintenance(
        {
          ...input,
          productType: input.productType || "L",
        },
        requester
      );
      return result;
    }),

  /**
   * Operational readiness summary across benchmark and solar domains.
   */
  readiness: authenticatedProcedure.query(async ({ ctx }) => {
    const requester = {
      userId: ctx.user.id != null ? String(ctx.user.id) : undefined,
      role: (ctx.user as any).role,
    };

    const serviceReadiness = await getModel4ReadinessSummary();
    let dbReadiness = null;
    try {
      dbReadiness = await getDbReadinessSummary(requester);
    } catch {
      // Non-critical if database is unseeded
    }

    return {
      service: serviceReadiness,
      database: dbReadiness,
    };
  }),

  /**
   * Historical assessments for a specific machine ID.
   */
  history: authenticatedProcedure
    .input(historyQuerySchema)
    .query(async ({ ctx, input }) => {
      const requester = {
        userId: ctx.user.id != null ? String(ctx.user.id) : undefined,
        role: (ctx.user as any).role,
      };

      return getMaintenanceHistory(input.machineId, input, requester);
    }),

  /**
   * Recent assessments across machines.
   */
  recent: authenticatedProcedure
    .input(recentQuerySchema)
    .query(async ({ ctx, input }) => {
      const requester = {
        userId: ctx.user.id != null ? String(ctx.user.id) : undefined,
        role: (ctx.user as any).role,
      };

      return getRecentMaintenanceAssessments(input, requester);
    }),

  /**
   * Assessment by ID with ownership verification.
   */
  getById: authenticatedProcedure
    .input(assessmentByIdSchema)
    .query(async ({ ctx, input }) => {
      const requester = {
        userId: ctx.user.id != null ? String(ctx.user.id) : undefined,
        role: (ctx.user as any).role,
      };

      const record = await getMaintenanceAssessmentById(input.id, requester);
      if (!record) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: `Maintenance assessment '${input.id}' not found or access denied.`,
        });
      }
      return record;
    }),

  /**
   * Seeds benchmark demonstration samples.
   */
  seedDemoSamples: authenticatedProcedure
    .input(seedDemoSchema)
    .mutation(async ({ ctx, input }) => {
      const requester = {
        userId: ctx.user.id != null ? String(ctx.user.id) : undefined,
        role: (ctx.user as any).role,
      };

      return seedMaintenanceDemoSamples(requester, input.count);
    }),
});
