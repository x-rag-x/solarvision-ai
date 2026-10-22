import type { Express } from "express";
import { ENV } from "./env";
import { sdk } from "./sdk";
import { getInspectionById } from "../db";

export function registerStorageProxy(app: Express) {
  app.get("/manus-storage/*", async (req, res) => {
    const key = (req.params as Record<string, string>)[0];
    if (!key) {
      res.status(400).send("Missing storage key");
      return;
    }

    // 1. Enforce user authentication
    let user: any = null;
    if ((req as any).user) {
      user = (req as any).user;
    } else {
      try {
        user = await sdk.authenticateRequest(req);
      } catch {
        user = null;
      }
    }

    if (!user) {
      res.status(401).json({
        error: "Unauthorized",
        message: "Authentication required to access storage proxy.",
      });
      return;
    }

    // 2. Inspection ownership verification for private inspection images
    const match = key.match(/^(?:solarvision|inspections)\/([a-zA-Z0-9_-]+)/);
    if (match && match[1]) {
      const inspectionId = match[1];
      const requester = {
        userId: user.openId || String(user.id),
        role: user.role,
      };

      const inspection = await getInspectionById(inspectionId, requester);
      if (!inspection) {
        const existsGlobally = await getInspectionById(inspectionId, { role: "admin" });
        if (existsGlobally) {
          res.status(403).json({
            error: "Forbidden",
            message: "Access denied to private inspection image.",
          });
          return;
        }
        res.status(404).send("Inspection not found");
        return;
      }
    }

    if (!ENV.forgeApiUrl || !ENV.forgeApiKey) {
      res.status(500).send("Storage proxy not configured");
      return;
    }

    try {
      const forgeUrl = new URL(
        "v1/storage/presign/get",
        ENV.forgeApiUrl.replace(/\/+$/, "") + "/",
      );
      forgeUrl.searchParams.set("path", key);

      const forgeResp = await fetch(forgeUrl, {
        headers: { Authorization: `Bearer ${ENV.forgeApiKey}` },
      });

      if (!forgeResp.ok) {
        const body = await forgeResp.text().catch(() => "");
        console.error(`[StorageProxy] forge error: ${forgeResp.status} ${body}`);
        res.status(502).send("Storage backend error");
        return;
      }

      const { url } = (await forgeResp.json()) as { url: string };
      if (!url) {
        res.status(502).send("Empty signed URL from backend");
        return;
      }

      res.set("Cache-Control", "no-store");
      res.redirect(307, url);
    } catch (err) {
      console.error("[StorageProxy] failed:", err);
      res.status(502).send("Storage proxy error");
    }
  });
}
