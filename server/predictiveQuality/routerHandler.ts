/**
 * SolarVision AI — Model 3: Predictive Quality Monitoring
 * Authenticated tRPC Router & Endpoint Handlers
 */

import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { UNAUTHED_ERR_MSG } from "@shared/const";
import { publicProcedure, router } from "../_core/trpc";
import {
  forecastPredictiveQuality,
  getModel3Status,
  predictBenchmarkQuality,
  getBenchmarkMetadata,
  BENCHMARK_RAW_FEATURE_COUNT,
} from "./service";
import {
  persistQualityForecast,
  getQualityForecasts,
  getQualityForecastById,
  getQualityReadinessSummary,
} from "./dbContract";
import {
  CANONICAL_SOLAR_FEATURES,
  CANONICAL_SOLAR_FEATURE_COUNT,
  MODEL3_CONTRACT_VERSION,
} from "./featureContract";
import type { PredictiveQualityInput } from "./types";

/**
 * Enforces authenticated operator identity on predictive-quality procedures.
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

export const sensorMeasurementInputSchema = z.object({
  sensorType: z.string().min(1),
  measurementValue: z.number(),
  unit: z.string().optional(),
  recordedAt: z.string().optional(),
});

export const defectSummaryInputSchema = z.object({
  totalDefectCount: z.number().int().nonnegative().optional(),
  crackCount: z.number().int().nonnegative().optional(),
  fingerInterruptionCount: z.number().int().nonnegative().optional(),
  busbarDefectCount: z.number().int().nonnegative().optional(),
  defectAreaRatio: z.number().min(0).max(1).optional(),
  meanConfidence: z.number().min(0).max(1).optional(),
});

export const electricalParametersInputSchema = z.object({
  voc_v: z.number().optional(),
  isc_a: z.number().optional(),
  fillFactorPct: z.number().optional(),
  seriesResistanceMohm: z.number().optional(),
  shuntResistanceOhm: z.number().optional(),
  cellEfficiencyPct: z.number().optional(),
});

export const environmentalContextInputSchema = z.object({
  cleanroomTempC: z.number().optional(),
  cleanroomHumidityPct: z.number().optional(),
  cleanroomParticulatesPm25: z.number().optional(),
  batchProgressRatio: z.number().min(0).max(1).optional(),
});

export const predictiveQualityInputSchema = z.object({
  batchId: z.string().optional(),
  machineId: z.string().optional(),
  waferId: z.string().optional(),
  domain: z.enum(["solar_cell_manufacturing", "semiconductor_benchmark"]).default("solar_cell_manufacturing"),
  featureVector: z.array(z.number()).optional(),
  rawFeatures: z.record(z.string(), z.number()).optional(),
  sensorMeasurements: z.array(sensorMeasurementInputSchema).optional(),
  defectSummary: defectSummaryInputSchema.optional(),
  electricalParameters: electricalParametersInputSchema.optional(),
  environmentalContext: environmentalContextInputSchema.optional(),
  confidenceThreshold: z.number().min(0).max(1).default(0.5),
});

export const benchmarkPredictInputSchema = z.object({
  features: z.array(z.number()),
  batchId: z.string().optional(),
  waferId: z.string().optional(),
});

/**
 * Isolated Authenticated tRPC Router for Model 3 Predictive Quality Monitoring
 */
export const predictiveQualityRouter = router({
  /**
   * Forecast quality outcome (pass, warning, fail) and yield loss risk.
   */
  forecast: authenticatedProcedure
    .input(predictiveQualityInputSchema)
    .mutation(async ({ input, ctx }) => {
      const response = await forecastPredictiveQuality(input as PredictiveQualityInput);

      // Persist if forecast succeeded with ready status
      if (response.status === "ready") {
        try {
          await persistQualityForecast(response, {
            userId: ctx.user.openId,
            role: ctx.user.role,
            inputReference: input.waferId || input.batchId || "solar_feature_input",
            waferId: input.waferId,
          });
        } catch (err: any) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: `Failed to persist quality forecast: ${err.message || String(err)}`,
          });
        }
      }

      return {
        ...response,
        persistedId: (response as any).persistedId,
      };
    }),

  /**
   * Query Model 3 status, version, and training readiness.
   */
  status: authenticatedProcedure
    .input(z.object({ domain: z.enum(["solar_cell_manufacturing", "semiconductor_benchmark"]).optional() }).optional())
    .query(async ({ input }) => {
      return getModel3Status(input?.domain);
    }),

  /**
   * Dedicated authenticated procedure for UCI SECOM semiconductor benchmark inference.
   * Strictly enforces 590 feature dimensions and locks model paths.
   * Persists successful benchmark forecasts with authenticated operator attribution.
   */
  benchmarkPredict: authenticatedProcedure
    .input(benchmarkPredictInputSchema)
    .mutation(async ({ input, ctx }) => {
      if (input.features.length !== BENCHMARK_RAW_FEATURE_COUNT) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `SECOM semiconductor benchmark requires exactly ${BENCHMARK_RAW_FEATURE_COUNT} input features, received ${input.features.length}.`,
        });
      }
      const response = await predictBenchmarkQuality(input);

      // Persist successful benchmark evaluation
      if (response.status === "ready") {
        try {
          await persistQualityForecast(response, {
            userId: ctx.user.openId,
            role: ctx.user.role,
            inputReference: input.waferId || input.batchId || `secom_590_${Date.now()}`,
            waferId: input.waferId,
          });
        } catch (err: any) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: `Failed to persist benchmark quality prediction: ${err.message || String(err)}`,
          });
        }
      }

      return {
        ...response,
        persistedId: (response as any).persistedId,
      };
    }),

  /**
   * Comprehensive data readiness forensic report for Model 3.
   */
  readiness: authenticatedProcedure.query(async () => {
    return getQualityReadinessSummary();
  }),

  /**
   * Canonical 32-dimensional feature contract and schema specification.
   */
  canonicalContract: publicProcedure.query(async () => {
    return {
      schemaVersion: MODEL3_CONTRACT_VERSION,
      featureCount: CANONICAL_SOLAR_FEATURE_COUNT,
      features: CANONICAL_SOLAR_FEATURES,
    };
  }),

  /**
   * Query historical forecasts with pagination, domain filtering, and user isolation.
   */
  history: authenticatedProcedure
    .input(
      z
        .object({
          batchId: z.string().optional(),
          riskLevel: z.string().optional(),
          domain: z.enum(["solar_cell_manufacturing", "semiconductor_benchmark"]).optional(),
          isBenchmark: z.boolean().optional(),
          limit: z.number().int().min(1).max(100).default(50),
          offset: z.number().int().min(0).default(0),
        })
        .optional()
    )
    .query(async ({ input, ctx }) => {
      return getQualityForecasts(input, {
        userId: ctx.user.openId,
        role: ctx.user.role,
      });
    }),

  /**
   * Query a single forecast detail by ID with multi-tenant access control.
   */
  detail: authenticatedProcedure
    .input(z.object({ id: z.string().min(1) }))
    .query(async ({ input, ctx }) => {
      const forecast = await getQualityForecastById(input.id, {
        userId: ctx.user.openId,
        role: ctx.user.role,
      });
      if (!forecast) {
        throw new TRPCError({ code: "NOT_FOUND", message: `Forecast '${input.id}' not found.` });
      }
      return forecast;
    }),

  /**
   * External semiconductor benchmark dataset metadata & distinction disclaimers.
   */
  benchmarkMetadata: publicProcedure.query(async () => {
    return getBenchmarkMetadata();
  }),
});
