import "dotenv/config";
import express from "express";
import { createServer } from "http";
import { existsSync } from "fs";
import net from "net";
import path from "path";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./oauth";
import { registerStorageProxy } from "./storageProxy";
import { registerRootCauseRestRoutes } from "../rootCause/restHandler";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { serveStatic, setupVite } from "./vite";
import { sdk } from "./sdk";
import { safeCanonicalKey } from "../storage";
import { getInspectionById, getCellScreeningById } from "../db";

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise(resolve => {
    const server = net.createServer();
    server.listen(port, "0.0.0.0", () => {
      server.close(() => resolve(true));
    });
    server.on("error", () => resolve(false));
  });
}

async function findAvailablePort(startPort: number = 3000): Promise<number> {
  for (let port = startPort; port < startPort + 20; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`No available port found starting from ${startPort}`);
}

async function startServer() {
  if (process.env.NODE_ENV === "production" && !process.env.VITEST) {
    const rawSecret = process.env.JWT_SECRET;
    const isExplicitlySet =
      rawSecret &&
      rawSecret.trim().length >= 32 &&
      !rawSecret.includes("replace-with") &&
      rawSecret !== "solarvision-ai-operator-session-secret-key-32chars-min!";

    if (!isExplicitlySet) {
      console.warn(
        "\n==============================================================================\n" +
        "[Security NOTICE] JWT_SECRET was not explicitly configured in production!\n" +
        "SolarVision AI automatically initialized a cryptographically random 256-bit\n" +
        "ephemeral session secret for this container instance.\n" +
        "\n" +
        "To persist operator login sessions across container restarts, set JWT_SECRET\n" +
        "(at least 32 random characters) in your environment variables dashboard (e.g., Render).\n" +
        "==============================================================================\n"
      );
    }
  }


  const app = express();
  const server = createServer(app);
  // Configure body parser with larger size limit for file uploads
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));

  /**
   * Secure, Authenticated & Ownership-Checked Upload Serving
   * Remediates Finding F04 & Task 5:
   * Private inspection images must not be accessible merely because the URL is known.
   */
  app.get("/uploads/*", async (req, res) => {
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
      return res.status(401).json({
        error: "Unauthorized",
        message: "Authentication required to access private inspection images.",
      });
    }

    const rawRelPath = (req.params as Record<string, string>)[0];
    if (!rawRelPath) {
      return res.status(400).send("Missing file path");
    }

    // Boundary check against directory traversal
    let safePath: string;
    try {
      safePath = safeCanonicalKey(rawRelPath).absolutePath;
    } catch (err: any) {
      return res.status(400).send(err.message || "Invalid path");
    }

    if (!existsSync(safePath)) {
      return res.status(404).send("File not found");
    }

    // Inspection ownership scoping for private inspection captures
        // Cell screening ownership scoping for private cell screening captures
    const cellMatch = rawRelPath.match(/^cell-screenings\/([a-zA-Z0-9_-]+)/);
    if (cellMatch && cellMatch[1]) {
      const screeningId = cellMatch[1];
      const requester = {
        userId: user.openId || String(user.id),
        role: user.role,
      };

      const screening = await getCellScreeningById(screeningId, requester);
      if (!screening) {
        const existsGlobally = await getCellScreeningById(screeningId, { role: "admin" });
        if (existsGlobally) {
          return res.status(403).json({
            error: "Forbidden",
            message: "Access denied to private cell screening image.",
          });
        }
        return res.status(404).send("Screening not found");
      }
    }

    const match = rawRelPath.match(/^(?:solarvision|inspections)\/([a-zA-Z0-9_-]+)/);
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
          return res.status(403).json({
            error: "Forbidden",
            message: "Access denied to private inspection image.",
          });
        }
        return res.status(404).send("Inspection not found");
      }
    }

    res.setHeader("Cache-Control", "private, no-cache, no-store, must-revalidate");
    res.sendFile(safePath);
  });

  registerStorageProxy(app);
  registerOAuthRoutes(app);
  registerRootCauseRestRoutes(app);

  // tRPC API
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );

  // development mode uses Vite, production mode uses static files
  if (process.env.NODE_ENV?.trim() === "development" || !process.env.NODE_ENV) {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  const isProd = process.env.NODE_ENV === "production";
  const preferredPort = parseInt(process.env.PORT || "3000", 10);
  const port = isProd ? preferredPort : await findAvailablePort(preferredPort);

  if (!isProd && port !== preferredPort) {
    console.log(`Port ${preferredPort} is busy, using port ${port} instead`);
  }

  server.listen(port, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${port}/ (NODE_ENV=${process.env.NODE_ENV || "development"})`);
  });
}

startServer().catch(console.error);
