import { COOKIE_NAME, UNAUTHED_ERR_MSG } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router } from "./_core/trpc";
import { getDashboardStats, getDefectAnalytics, getInspectionById, getRecentInspections } from "./db";
import { runInspection } from "./inspection/service";
import { isSupabaseConfigured } from "./inspection/supabase";
import { rootCauseRouter } from "./rootCause";
import { predictiveQualityRouter } from "./predictiveQuality";
import { predictiveMaintenanceRouter } from "./predictiveMaintenance";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

const inspectionInput = z.object({
  filename: z.string().min(1).max(255),
  mimeType: z.string().startsWith("image/"),
  base64Data: z.string().min(1).max(50_000_000),
  confidence: z.number().min(0.0).max(1.0).optional(),
  diagnostic: z.boolean().optional(),
});

/**
 * Enforces authenticated operator identity on protected procedures.
 * Strictly checks ctx.user without synthetic test harness bypasses.
 * Callers must supply an explicit authenticated session context.
 */
export const authenticatedProcedure = publicProcedure.use(async ({ ctx, next }) => {
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

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),
  dashboard: router({
    stats: authenticatedProcedure.query(({ ctx }) =>
      getDashboardStats({ userId: ctx.user.openId || String(ctx.user.id), role: ctx.user.role })
    ),
  }),
  rootCause: rootCauseRouter,
  predictiveQuality: predictiveQualityRouter,
  predictiveMaintenance: predictiveMaintenanceRouter,
  inspection: router({
    run: authenticatedProcedure.input(inspectionInput).mutation(async ({ input, ctx }) => {
      try {
        const effectiveUserId = ctx.user.openId || String(ctx.user.id);
        return await runInspection({
          ...input,
          userId: effectiveUserId,
          operatorId: effectiveUserId,
        });
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: error instanceof Error ? error.message : "Inspection failed",
        });
      }
    }),
    history: authenticatedProcedure
      .input(z.object({ limit: z.number().int().min(1).max(100).default(25) }).optional())
      .query(({ input, ctx }) =>
        getRecentInspections(
          input?.limit ?? 25,
          { userId: ctx.user.openId || String(ctx.user.id), role: ctx.user.role }
        )
      ),
    detail: authenticatedProcedure
      .input(z.object({ inspectionId: z.string().uuid() }))
      .query(async ({ input, ctx }) => {
        const result = await getInspectionById(
          input.inspectionId,
          { userId: ctx.user.openId || String(ctx.user.id), role: ctx.user.role }
        );
        return result;
      }),
  }),
  analytics: router({
    defects: authenticatedProcedure.query(({ ctx }) =>
      getDefectAnalytics({ userId: ctx.user.openId || String(ctx.user.id), role: ctx.user.role })
    ),
  }),
  model: router({
    status: publicProcedure.query(() => {
      const modelPath = process.env.MODEL_PATH || resolve(process.cwd(), "backend/models/best.pt");
      const exists = existsSync(modelPath);
      return {
        status: exists ? "checkpoint_present_runtime_inference_requires_python" : "model_missing",
        modelPath,
        exists,
        modelName: "YOLO26n",
        classNames: [],
        independentMetricsStatus: "No independent test metrics provided",
        supabaseConfigured: isSupabaseConfigured(),
        confidenceThresholdDefault: 0.25,
      };
    }),
  }),
});

export type AppRouter = typeof appRouter;
