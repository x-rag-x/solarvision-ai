/**
 * SolarVision AI — Model 3: Sandia Solar Electrical Performance Prediction
 * Strongly Typed tRPC Router & Endpoint Handlers
 */

import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { UNAUTHED_ERR_MSG } from "@shared/const";
import { publicProcedure, router } from "../_core/trpc";
import { SandiaApiError, sanitizeErrorMessage } from "./apiClient";
import { sandiaPerformanceService } from "./service";
import { MAX_SANDIA_BATCH_SIZE } from "./types";

/**
 * Enforces authenticated operator identity on protected Sandia procedures.
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

/**
 * Converts internal errors or SandiaApiErrors into standard TRPC errors
 * without leaking internal filesystem paths or tokens.
 */
function toTrpcError(err: any): TRPCError {
  if (err instanceof TRPCError) {
    return err;
  }

  const cleanMessage = sanitizeErrorMessage(
    err?.detail || err?.message || String(err)
  );

  if (err instanceof SandiaApiError) {
    if (err.statusCode === 422 || err.code === "BAD_REQUEST") {
      return new TRPCError({
        code: "BAD_REQUEST",
        message: cleanMessage,
      });
    }
    if (
      err.statusCode === 503 ||
      err.code === "PRECONDITION_FAILED" ||
      err.code === "SERVICE_UNAVAILABLE"
    ) {
      return new TRPCError({
        code: "PRECONDITION_FAILED",
        message: cleanMessage,
      });
    }
    if (err.statusCode === 504 || err.code === "TIMEOUT") {
      return new TRPCError({
        code: "TIMEOUT",
        message: cleanMessage,
      });
    }
    if (err.statusCode === 404 || err.code === "NOT_FOUND") {
      return new TRPCError({
        code: "NOT_FOUND",
        message: cleanMessage,
      });
    }
  }

  return new TRPCError({
    code: "INTERNAL_SERVER_ERROR",
    message:
      cleanMessage ||
      "An internal error occurred during prediction processing.",
  });
}

/**
 * Single prediction input schema with dynamically supplied features.
 * Features are never hardcoded.
 */
export const sandiaPredictionInputSchema = z.object({
  moduleId: z.string().min(1).max(128).optional(),
  timestamp: z.string().optional(),
  features: z
    .record(z.string(), z.any())
    .refine(f => f && Object.keys(f).length > 0, {
      message:
        "Features dictionary cannot be empty. Named telemetry features must be provided.",
    }),
  metadata: z.record(z.string(), z.any()).optional(),
});

/**
 * Batch prediction input schema supporting up to MAX_SANDIA_BATCH_SIZE (100) items.
 */
export const sandiaBatchPredictionInputSchema = z.object({
  items: z
    .array(sandiaPredictionInputSchema)
    .min(1, "Batch must contain at least 1 prediction item.")
    .max(
      MAX_SANDIA_BATCH_SIZE,
      `Batch cannot exceed maximum limit of ${MAX_SANDIA_BATCH_SIZE} items.`
    ),
});

/**
 * Paginated prediction history query schema.
 */
export const sandiaHistoryQuerySchema = z.object({
  limit: z.number().int().min(1).max(100).default(25),
  offset: z.number().int().min(0).default(0),
  moduleId: z.string().min(1).max(128).optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
});

/**
 * Detail query schema by prediction record ID.
 */
export const sandiaDetailQuerySchema = z.object({
  id: z.string().min(1, "Prediction ID is required."),
});

/**
 * Strongly typed tRPC router for Sandia Solar Electrical Performance Prediction
 */
export const sandiaPerformanceRouter = router({
  /**
   * Probes Sandia model readiness, training status, and loaded schemas.
   */
  status: publicProcedure.query(async () => {
    try {
      return await sandiaPerformanceService.getStatus();
    } catch (err) {
      throw toTrpcError(err);
    }
  }),

  /**
   * Returns the dynamic feature schema delivered by model trainer.
   */
  schema: publicProcedure.query(async () => {
    try {
      return await sandiaPerformanceService.getSchema();
    } catch (err) {
      throw toTrpcError(err);
    }
  }),

  /**
   * Returns target prediction variable definition (units, bounds, description).
   */
  targetDefinition: publicProcedure.query(async () => {
    try {
      return await sandiaPerformanceService.getTargetDefinition();
    } catch (err) {
      throw toTrpcError(err);
    }
  }),

  /**
   * Returns sample input payload conforming to the active trainer schema.
   */
  sampleInput: publicProcedure.query(async () => {
    try {
      return await sandiaPerformanceService.getSampleInput();
    } catch (err) {
      throw toTrpcError(err);
    }
  }),

  /**
   * Returns complete provenance, Sandia attribution, and operational constraints.
   */
  metadata: publicProcedure.query(async () => {
    try {
      return await sandiaPerformanceService.getMetadata();
    } catch (err) {
      throw toTrpcError(err);
    }
  }),

  /**
   * Returns combined service readiness and database storage summary.
   */
  readiness: publicProcedure.query(async ({ ctx }) => {
    const requester = ctx.user
      ? {
          userId:
            ctx.user.openId ||
            (ctx.user.id != null ? String(ctx.user.id) : null),
          role: ctx.user.role,
        }
      : undefined;

    return sandiaPerformanceService.getReadinessSummary(requester);
  }),

  /**
   * Executes single prediction with dynamic features and persists real production results.
   */
  predict: authenticatedProcedure
    .input(sandiaPredictionInputSchema)
    .mutation(async ({ input, ctx }) => {
      const requester = {
        userId:
          ctx.user.openId || (ctx.user.id != null ? String(ctx.user.id) : null),
        role: ctx.user.role,
      };

      try {
        return await sandiaPerformanceService.predict(input, requester);
      } catch (err) {
        throw toTrpcError(err);
      }
    }),

  /**
   * Executes batch prediction across multiple PV module telemetry observations.
   */
  predictBatch: authenticatedProcedure
    .input(sandiaBatchPredictionInputSchema)
    .mutation(async ({ input, ctx }) => {
      const requester = {
        userId:
          ctx.user.openId || (ctx.user.id != null ? String(ctx.user.id) : null),
        role: ctx.user.role,
      };

      try {
        return await sandiaPerformanceService.predictBatch(input, requester);
      } catch (err) {
        throw toTrpcError(err);
      }
    }),

  /**
   * Queries paginated prediction history with user isolation and role-based access.
   */
  history: authenticatedProcedure
    .input(sandiaHistoryQuerySchema.optional())
    .query(async ({ input, ctx }) => {
      const requester = {
        userId:
          ctx.user.openId || (ctx.user.id != null ? String(ctx.user.id) : null),
        role: ctx.user.role,
      };

      return sandiaPerformanceService.getHistory(input, requester);
    }),

  /**
   * Queries a specific prediction by ID with ownership verification.
   */
  detail: authenticatedProcedure
    .input(sandiaDetailQuerySchema)
    .query(async ({ input, ctx }) => {
      const requester = {
        userId:
          ctx.user.openId || (ctx.user.id != null ? String(ctx.user.id) : null),
        role: ctx.user.role,
      };

      const record = sandiaPerformanceService.getById(input.id, requester);
      if (!record) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: `Sandia prediction record '${input.id}' not found or access denied.`,
        });
      }

      return record;
    }),
});

export type SandiaPerformanceRouter = typeof sandiaPerformanceRouter;
