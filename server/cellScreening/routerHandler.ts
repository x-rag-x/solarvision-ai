/**
 * SolarVision AI — Model 2: ELPV Cell Defectiveness Screening
 * Authenticated tRPC Router Handlers
 */

import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { UNAUTHED_ERR_MSG } from "@shared/const";
import { publicProcedure, router } from "../_core/trpc";
import {
  getModel2ScreeningStatus,
  runCellScreening,
  getCellScreeningHistory,
  getCellScreeningRecord,
} from "./service";

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

const screeningInputSchema = z.object({
  filename: z.string().min(1).max(255),
  mimeType: z.string().min(1).max(64),
  base64Data: z.string().min(1).max(15_000_000), // Max ~11MB base64 for 8MB image
});

export const cellScreeningRouter = router({
  status: publicProcedure.query(() => {
    return getModel2ScreeningStatus();
  }),

  predict: authenticatedProcedure
    .input(screeningInputSchema)
    .mutation(async ({ input, ctx }) => {
      try {
        const effectiveUserId = ctx.user.openId || String(ctx.user.id);
        return await runCellScreening(input, effectiveUserId);
      } catch (err) {
        if (err instanceof TRPCError) throw err;
        const msg = err instanceof Error ? err.message : "Cell screening failed";
        if (msg.includes("Unsupported image format") || msg.includes("too small")) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: msg,
          });
        }
        if (msg.includes("checkpoint not found")) {
          throw new TRPCError({
            code: "PRECONDITION_FAILED",
            message: msg,
          });
        }
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: msg,
        });
      }
    }),

  history: authenticatedProcedure
    .input(z.object({ limit: z.number().int().min(1).max(100).default(25) }).optional())
    .query(async ({ input, ctx }) => {
      const requester = {
        userId: ctx.user.openId || String(ctx.user.id),
        role: ctx.user.role,
      };
      return await getCellScreeningHistory(input?.limit ?? 25, requester);
    }),

  detail: authenticatedProcedure
    .input(z.object({ screeningId: z.string().min(1) }))
    .query(async ({ input, ctx }) => {
      const requester = {
        userId: ctx.user.openId || String(ctx.user.id),
        role: ctx.user.role,
      };
      const record = await getCellScreeningRecord(input.screeningId, requester);
      if (!record) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: `Cell screening record '${input.screeningId}' not found.`,
        });
      }
      return record;
    }),
});
