import { and, desc, eq, isNull, or, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { detections, inspections, InsertUser, users } from "../drizzle/schema";
import { ENV } from "./_core/env";
import {
  getSupabaseDashboardStats,
  getSupabaseDefectAnalytics,
  getSupabaseInspectionById,
  getSupabaseRecentInspections,
} from "./inspection/supabase";
import {
  getSqliteDashboardStats,
  getSqliteDefectAnalytics,
  getSqliteInspectionById,
  getSqliteRecentInspections,
  saveSqliteInspection,
  setSqliteDbPath,
  resetSqliteDb,
  getSqliteDbPath,
  RequesterContext,
} from "./sqlite";

export { setSqliteDbPath, resetSqliteDb, getSqliteDbPath };
export type { RequesterContext };

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) throw new Error("User openId is required for upsert");
  const db = await getDb();
  if (!db) return;
  const values: InsertUser = { openId: user.openId };
  const updateSet: Record<string, unknown> = {};
  const textFields = ["name", "email", "loginMethod"] as const;
  for (const field of textFields) {
    if (user[field] !== undefined) {
      values[field] = user[field] ?? null;
      updateSet[field] = user[field] ?? null;
    }
  }
  if (user.lastSignedIn !== undefined) {
    values.lastSignedIn = user.lastSignedIn;
    updateSet.lastSignedIn = user.lastSignedIn;
  }
  if (user.role !== undefined) {
    values.role = user.role;
    updateSet.role = user.role;
  } else if (user.openId === ENV.ownerOpenId) {
    values.role = "admin";
    updateSet.role = "admin";
  }
  values.lastSignedIn ??= new Date();
  updateSet.lastSignedIn ??= new Date();
  await db.insert(users).values(values).onDuplicateKeyUpdate({ set: updateSet });
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result[0];
}

/**
 * Persists an inspection run and its defects atomically.
 * Uses MySQL transactions if configured, else delegates to SQLite transaction.
 */
export async function saveInspection(
  input: typeof inspections.$inferInsert,
  items: Array<typeof detections.$inferInsert>,
) {
  const db = await getDb();
  if (!db) {
    return saveSqliteInspection(input, items);
  }

  try {
    return await db.transaction(async tx => {
      await tx.insert(inspections).values(input).onDuplicateKeyUpdate({ set: input });
      if (items.length > 0) {
        await tx.insert(detections).values(items);
      }
      return true;
    });
  } catch (error) {
    console.error("[MySQL] saveInspection transaction failed:", error);
    // Fallback to SQLite persistence to prevent data loss
    return saveSqliteInspection(input, items);
  }
}

/**
 * Returns recent inspection runs with priority: Supabase -> MySQL -> SQLite fallback.
 * Enforces authenticated requester scoping:
 * - Admin: sees all records
 * - User: sees only their own inspections
 * - Anonymous: sees only unowned/anonymous records
 */
export async function getRecentInspections(limit = 25, requester?: RequesterContext) {
  if (process.env.SUPABASE_URL && (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY)) {
    try {
      const rows = await getSupabaseRecentInspections(limit, requester);
      if (rows && rows.length > 0) return rows;
    } catch (error) {
      console.warn("[Supabase] Falling back to local history:", error);
    }
  }

  const db = await getDb();
  if (!db) return getSqliteRecentInspections(limit, requester);

  try {
    let query = db.select().from(inspections);

    if (requester?.role === "admin") {
      // Admin global visibility
      return await query.orderBy(desc(inspections.createdAt)).limit(limit);
    } else if (requester?.userId) {
      // User-scoped visibility
      return await query
        .where(
          or(
            eq(inspections.userId, requester.userId),
            eq(inspections.operatorId, requester.userId),
          ),
        )
        .orderBy(desc(inspections.createdAt))
        .limit(limit);
    } else {
      // Unauthenticated caller: only unowned records
      return await query
        .where(and(isNull(inspections.userId), isNull(inspections.operatorId)))
        .orderBy(desc(inspections.createdAt))
        .limit(limit);
    }
  } catch (mysqlError) {
    console.warn("[MySQL] getRecentInspections fallback to SQLite:", mysqlError);
    return getSqliteRecentInspections(limit, requester);
  }
}

/**
 * Retrieves a detailed inspection record and its associated defects by ID.
 * Unifies storage source retrieval: checks Supabase first when configured, then MySQL, then SQLite.
 * Enforces ownership: cross-user and unauthorized access are strictly denied.
 */
export async function getInspectionById(inspectionId: string, requester?: RequesterContext) {
  // 1. Supabase retrieval
  if (process.env.SUPABASE_URL && (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY)) {
    try {
      const supabaseResult = await getSupabaseInspectionById(inspectionId, requester);
      if (supabaseResult) return supabaseResult;
    } catch (error) {
      console.warn("[Supabase] getInspectionById fallback:", error);
    }
  }

  // 2. MySQL retrieval
  const db = await getDb();
  if (db) {
    try {
      const inspection = (
        await db.select().from(inspections).where(eq(inspections.inspectionId, inspectionId)).limit(1)
      )[0];

      if (inspection) {
        // Enforce requester ownership
        const owner = inspection.userId || inspection.operatorId;
        if (owner) {
          const isOwner = requester?.userId && requester.userId === owner;
          const isAdmin = requester?.role === "admin";
          if (!isOwner && !isAdmin) {
            // Access denied
            return null;
          }
        }

        const items = await db.select().from(detections).where(eq(detections.inspectionId, inspectionId)).limit(200);
        return { inspection, detections: items };
      }
    } catch (mysqlError) {
      console.warn("[MySQL] getInspectionById error:", mysqlError);
    }
  }

  // 3. SQLite fallback
  return getSqliteInspectionById(inspectionId, requester);
}

export async function getDashboardStats(requester?: RequesterContext) {
  if (process.env.SUPABASE_URL && (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY)) {
    try {
      const stats = await getSupabaseDashboardStats(requester);
      if (stats) return stats;
    } catch (error) {
      console.warn("[Supabase] Falling back to local dashboard stats:", error);
    }
  }

  const db = await getDb();
  if (!db) return getSqliteDashboardStats(requester);

  try {
    let whereCondition = undefined;
    if (requester?.userId && requester.role !== "admin") {
      whereCondition = or(
        eq(inspections.userId, requester.userId),
        eq(inspections.operatorId, requester.userId),
      );
    }

    const [inspectionCount] = whereCondition
      ? await db.select({ value: sql<number>`count(*)` }).from(inspections).where(whereCondition)
      : await db.select({ value: sql<number>`count(*)` }).from(inspections);

    const [avgTime] = whereCondition
      ? await db
          .select({ value: sql<number | null>`avg(${inspections.processingTimeMs})` })
          .from(inspections)
          .where(whereCondition)
      : await db.select({ value: sql<number | null>`avg(${inspections.processingTimeMs})` }).from(inspections);

    const [detectionCount] = await db.select({ value: sql<number>`count(*)` }).from(detections);
    const [typeCount] = await db.select({ value: sql<number>`count(distinct ${detections.defectType})` }).from(detections);

    return {
      configured: true,
      inspections: Number(inspectionCount?.value ?? 0),
      detections: Number(detectionCount?.value ?? 0),
      avgProcessingTimeMs: avgTime?.value == null ? null : Number(avgTime.value),
      defectTypes: Number(typeCount?.value ?? 0),
    };
  } catch (error) {
    console.warn("[MySQL] getDashboardStats fallback to SQLite:", error);
    return getSqliteDashboardStats(requester);
  }
}

export async function getDefectAnalytics(requester?: RequesterContext) {
  if (process.env.SUPABASE_URL && (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY)) {
    try {
      const analytics = await getSupabaseDefectAnalytics(requester);
      if (analytics) return analytics;
    } catch (error) {
      console.warn("[Supabase] Falling back to local defect analytics:", error);
    }
  }

  const db = await getDb();
  if (!db) return getSqliteDefectAnalytics(requester);

  try {
    let whereCondition = undefined;
    if (requester?.userId && requester.role !== "admin") {
      whereCondition = or(
        eq(inspections.userId, requester.userId),
        eq(inspections.operatorId, requester.userId),
      );
    }

    const detectionRows = await db
      .select({ defectType: detections.defectType, confidence: detections.confidence })
      .from(detections)
      .limit(5000);

    const byTypeMap = new Map<string, { count: number; confidenceTotal: number }>();
    for (const row of detectionRows) {
      const current = byTypeMap.get(row.defectType) ?? { count: 0, confidenceTotal: 0 };
      current.count += 1;
      current.confidenceTotal += Number(row.confidence);
      byTypeMap.set(row.defectType, current);
    }
    const byType = Array.from(byTypeMap.entries())
      .map(([defectType, values]) => ({
        defectType,
        count: values.count,
        avgConfidence: values.count ? values.confidenceTotal / values.count : 0,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 50);

    const inspectionRows = whereCondition
      ? await db
          .select({ createdAt: inspections.createdAt, detectionsCount: inspections.detectionsCount })
          .from(inspections)
          .where(whereCondition)
          .orderBy(desc(inspections.createdAt))
          .limit(5000)
      : await db
          .select({ createdAt: inspections.createdAt, detectionsCount: inspections.detectionsCount })
          .from(inspections)
          .orderBy(desc(inspections.createdAt))
          .limit(5000);

    const trendMap = new Map<string, { inspections: number; detections: number }>();
    for (const row of inspectionRows) {
      const day = new Date(row.createdAt).toISOString().slice(0, 10);
      const current = trendMap.get(day) ?? { inspections: 0, detections: 0 };
      current.inspections += 1;
      current.detections += Number(row.detectionsCount);
      trendMap.set(day, current);
    }
    const recentTrend = Array.from(trendMap.entries())
      .sort((a, b) => b[0].localeCompare(a[0]))
      .slice(0, 14)
      .map(([day, values]) => ({ day, ...values }));

    return { configured: true, byType, recentTrend };
  } catch (error) {
    console.warn("[MySQL] getDefectAnalytics fallback to SQLite:", error);
    return getSqliteDefectAnalytics(requester);
  }
}
