import { z } from "zod";
import { notifyOwner } from "./notification";
import { adminProcedure, publicProcedure, router } from "./trpc";
import { isRootCauseEnabled, setRootCauseEnabled } from "../sqlite";

export const systemRouter = router({
  health: publicProcedure
    .input(
      z.object({
        timestamp: z.number().min(0, "timestamp cannot be negative"),
      })
    )
    .query(() => ({
      ok: true,
    })),

  notifyOwner: adminProcedure
    .input(
      z.object({
        title: z.string().min(1, "title is required"),
        content: z.string().min(1, "content is required"),
      })
    )
    .mutation(async ({ input }) => {
      const delivered = await notifyOwner(input);
      return {
        success: delivered,
      } as const;
    }),

  getSettings: publicProcedure.query(() => {
    return {
      enableRootCause: isRootCauseEnabled(),
    };
  }),

  updateSettings: adminProcedure
    .input(
      z.object({
        enableRootCause: z.boolean(),
      })
    )
    .mutation(({ input }) => {
      setRootCauseEnabled(input.enableRootCause);
      return {
        success: true,
        enableRootCause: input.enableRootCause,
      };
    }),
});
