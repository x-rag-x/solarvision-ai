/**
 * SolarVision AI — System Health & Live Application Console
 * Authenticated tRPC Router Handlers
 */

import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { UNAUTHED_ERR_MSG } from "@shared/const";
import { publicProcedure, router } from "../_core/trpc";
import { systemHealthService } from "./service";
import { appLogger } from "./logger";

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

export const systemHealthRouter = router({
  /**
   * Comprehensive System Health & Database Readiness Overview
   */
  overview: publicProcedure.query(async () => {
    try {
      return await systemHealthService.getSystemHealthOverview();
    } catch (err: any) {
      appLogger.error("SYSTEM", `Failed to generate health overview: ${err?.message || "Unknown error"}`);
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to evaluate system health.",
      });
    }
  }),

  /**
   * Refreshes health status for an individual model card
   */
  checkModel: publicProcedure
    .input(z.object({ modelId: z.enum(["model1", "model2", "model3", "model4"]) }))
    .mutation(async ({ input }) => {
      switch (input.modelId) {
        case "model1":
          return await systemHealthService.checkModel1Health();
        case "model2":
          return await systemHealthService.checkModel2Health();
        case "model3":
          return await systemHealthService.checkModel3Health();
        case "model4":
          return await systemHealthService.checkModel4Health();
      }
    }),

  /**
   * Executes safe, lightweight self-test on certified reference inputs
   */
  selfTest: authenticatedProcedure
    .input(z.object({ modelId: z.enum(["model1", "model2", "model3", "model4"]) }))
    .mutation(async ({ input, ctx }) => {
      appLogger.info("SYSTEM", `Operator '${ctx.user.openId || ctx.user.id}' initiated self-test for ${input.modelId}`);
      return await systemHealthService.runSelfTest(input.modelId);
    }),

  /**
   * Live Application Console: Queries bounded in-memory diagnostic logs
   * Deeply sanitized across tokens, cookies, passwords, and base64 binaries.
   */
  logs: publicProcedure
    .input(
      z
        .object({
          level: z.enum(["ALL", "DEBUG", "INFO", "WARN", "ERROR"]).optional(),
          service: z
            .enum(["ALL", "SYSTEM", "DATABASE", "FASTAPI", "MODEL 1", "MODEL 2", "MODEL 3", "MODEL 4", "API", "AUTH"])
            .optional(),
          search: z.string().max(100).optional(),
          limit: z.number().int().min(1).max(500).default(250).optional(),
          sinceTimestamp: z.string().optional(),
        })
        .optional()
    )
    .query(async ({ input }) => {
      // Opportunistically sync latest FastAPI terminal logs
      await systemHealthService.syncFastApiTerminalLogs();

      const entries = appLogger.getLogs({
        level: input?.level,
        service: input?.service,
        search: input?.search,
        limit: input?.limit ?? 250,
        sinceTimestamp: input?.sinceTimestamp,
      });
      return {
        entries,
        totalBuffered: appLogger.size,
      };
    }),

  /**
   * Clears the server-side in-memory log buffer (restricted to operators)
   */
  clearLogs: authenticatedProcedure.mutation(({ ctx }) => {
    appLogger.info("SYSTEM", `Log buffer cleared by operator '${ctx.user.openId || ctx.user.id}'`);
    appLogger.clear();
    return { success: true, timestamp: new Date().toISOString() };
  }),
});
