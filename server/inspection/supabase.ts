import type { RequesterContext } from "../sqlite";

export type SupabaseConfig = {
  url: string;
  apiKey: string;
  bucket: string;
  canUpload: boolean;
};

export type SupabaseDetection = {
  id?: string;
  inspection_id: string;
  defect_type: string;
  confidence: number;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  created_at?: string;
};

export type SupabaseInspection = {
  id?: string;
  inspection_id: string;
  user_id?: string | null;
  source_filename: string;
  model_name: string;
  status: "completed" | "failed";
  processing_time_ms: number;
  input_image_url: string | null;
  annotated_image_url: string | null;
  detections_count: number;
  persistence_status: string;
  created_at: string;
};

export function getConfig(): SupabaseConfig | null {
  const url = process.env.SUPABASE_URL;
  const apiKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
  if (!url || !apiKey) return null;
  return {
    url: url.replace(/\/+$/, ""),
    apiKey,
    bucket: process.env.SUPABASE_STORAGE_BUCKET || "solarvision-images",
    canUpload: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY),
  };
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const config = getConfig();
  if (!config) throw new Error("Supabase is not configured");
  const response = await fetch(`${config.url}${path}`, {
    ...init,
    headers: {
      apikey: config.apiKey,
      Authorization: `Bearer ${config.apiKey}`,
      ...(init?.headers || {}),
    },
  });
  if (!response.ok) {
    const errorText = await response.text().catch(() => "");
    throw new Error(`Supabase request failed (${response.status}): ${errorText || response.statusText}`);
  }
  return response.json() as Promise<T>;
}

function inspectionQuery(limit: number, requester?: RequesterContext) {
  let filter = "";
  if (requester?.userId && requester.role !== "admin") {
    filter = `&user_id=eq.${encodeURIComponent(requester.userId)}`;
  } else if (!requester?.userId && requester?.role !== "admin") {
    filter = `&user_id=is.null`;
  }
  return `?select=id,inspection_id,user_id,source_filename,model_name,status,processing_time_ms,input_image_url,annotated_image_url,detections_count,persistence_status,created_at${filter}&order=created_at.desc&limit=${Math.max(
    1,
    Math.min(limit, 5000),
  )}`;
}

/**
 * Extracts storage object key from a full URL, signed URL, or relative path.
 */
export function extractStorageKey(urlOrKey: string, bucketName: string): string | null {
  if (!urlOrKey) return null;
  const clean = urlOrKey.trim();
  if (clean.startsWith("data:") || clean.startsWith("/uploads/") || clean.startsWith("/manus-storage/")) {
    return null;
  }
  // If it's already a relative path like "inspections/uuid/annotated.jpg"
  if (!clean.startsWith("http://") && !clean.startsWith("https://")) {
    return clean.replace(new RegExp(`^${bucketName}/`), "").replace(/^\/+/, "");
  }
  try {
    const parsed = new URL(clean);
    // Patterns:
    // /storage/v1/object/public/{bucket}/{key}
    // /storage/v1/object/sign/{bucket}/{key}?token=...
    // /storage/v1/object/authenticated/{bucket}/{key}
    const match = parsed.pathname.match(
      new RegExp(`/storage/v1/object/(?:public|sign|authenticated)/${bucketName}/(.+)$`),
    );
    if (match?.[1]) {
      return decodeURIComponent(match[1]);
    }
  } catch {
    // URL parse failed, return null
  }
  return null;
}

/**
 * Creates an authorized expiring signed URL for a private Supabase Storage object.
 * Default expiration is 1 hour (3,600 seconds).
 */
export async function createSupabaseSignedUrl(
  pathOrKey: string,
  expiresInSeconds = 3600,
): Promise<string | null> {
  const config = getConfig();
  if (!config) return null;

  const key = extractStorageKey(pathOrKey, config.bucket) || pathOrKey.replace(/^\/+/, "");
  if (!key) return null;

  try {
    const response = await fetch(`${config.url}/storage/v1/object/sign/${config.bucket}/${key}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        apikey: config.apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ expiresIn: expiresInSeconds }),
    });

    if (!response.ok) {
      console.warn(`[Supabase Storage] Failed to generate signed URL for key "${key}" (${response.status})`);
      return null;
    }

    const data = (await response.json()) as { signedURL?: string };
    if (!data.signedURL) return null;

    if (data.signedURL.startsWith("http://") || data.signedURL.startsWith("https://")) {
      return data.signedURL;
    }
    const cleanPath = data.signedURL.startsWith("/") ? data.signedURL : `/${data.signedURL}`;
    // If the path already has /storage/v1 prefix
    if (cleanPath.startsWith("/storage/v1/")) {
      return `${config.url}${cleanPath}`;
    }
    return `${config.url}/storage/v1${cleanPath}`;
  } catch (error) {
    console.warn(`[Supabase Storage] createSupabaseSignedUrl error for key "${key}":`, error);
    return null;
  }
}

/**
 * Resolves an image URL to a secure, accessible link.
 * If the image is stored in a private Supabase bucket, generates an authorized signed URL.
 * Never exposes service role keys or requires changing private buckets to public.
 */
export async function resolveSecureImageUrl(urlOrKey: string | null): Promise<string | null> {
  if (!urlOrKey) return null;
  const config = getConfig();
  if (!config) return urlOrKey;

  // Local storage or data URLs do not need Supabase signing
  if (
    urlOrKey.startsWith("data:") ||
    urlOrKey.startsWith("/uploads/") ||
    urlOrKey.startsWith("/manus-storage/")
  ) {
    return urlOrKey;
  }

  // Check if it's a Supabase storage URL or key
  const key = extractStorageKey(urlOrKey, config.bucket);
  if (key) {
    const signed = await createSupabaseSignedUrl(key);
    if (signed) return signed;
  }

  return urlOrKey;
}

export async function uploadToSupabase(
  key: string,
  data: Buffer,
  contentType: string,
): Promise<string | null> {
  const config = getConfig();
  if (!config?.canUpload) return null;
  const body = new Uint8Array(data);
  const response = await fetch(`${config.url}/storage/v1/object/${config.bucket}/${key}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      apikey: config.apiKey,
      "Content-Type": contentType,
      "x-upsert": "true",
    },
    body: body as unknown as BodyInit,
  });

  if (!response.ok) {
    const errText = await response.text().catch(() => "");
    throw new Error(`Supabase Storage upload failed (${response.status}): ${errText || response.statusText}`);
  }

  // Generate a secure expiring signed URL instead of an unauthorized public URL for private buckets
  const signedUrl = await createSupabaseSignedUrl(key);
  if (signedUrl) {
    return signedUrl;
  }

  // Fallback to authenticated path identifier if sign endpoint is unavailable
  return `${config.url}/storage/v1/object/authenticated/${config.bucket}/${key}`;
}

export async function getSupabaseRecentInspections(limit = 25, requester?: RequesterContext) {
  if (!getConfig()) return null;
  const rows = await request<SupabaseInspection[]>(`/rest/v1/inspections${inspectionQuery(limit, requester)}`);
  
  // Resolve signed URLs for each inspection row
  return Promise.all(
    rows.map(async row => ({
      inspectionId: row.inspection_id,
      userId: row.user_id ? String(row.user_id) : null,
      sourceFilename: row.source_filename,
      modelName: row.model_name,
      status: row.status,
      processingTimeMs: row.processing_time_ms,
      inputImageUrl: await resolveSecureImageUrl(row.input_image_url),
      annotatedImageUrl: await resolveSecureImageUrl(row.annotated_image_url),
      detectionsCount: row.detections_count,
      persistenceStatus: row.persistence_status,
      createdAt: new Date(row.created_at),
    })),
  );
}

export async function getSupabaseInspectionById(inspectionId: string, requester?: RequesterContext) {
  if (!getConfig()) return null;
  const encodedId = encodeURIComponent(inspectionId);
  const inspectionRows = await request<SupabaseInspection[]>(
    `/rest/v1/inspections?inspection_id=eq.${encodedId}&limit=1`,
  );
  const row = inspectionRows[0];
  if (!row) return null;

  // Enforce requester ownership check
  if (row.user_id) {
    const isOwner = requester?.userId && requester.userId === row.user_id;
    const isAdmin = requester?.role === "admin";
    if (!isOwner && !isAdmin) {
      // Cross-user access denied
      return null;
    }
  }

  const detectionRows = await request<SupabaseDetection[]>(
    `/rest/v1/detections?inspection_id=eq.${encodedId}&order=confidence.desc&limit=200`,
  );

  const [inputImageUrl, annotatedImageUrl] = await Promise.all([
    resolveSecureImageUrl(row.input_image_url),
    resolveSecureImageUrl(row.annotated_image_url),
  ]);

  return {
    inspection: {
      id: row.id,
      inspectionId: row.inspection_id,
      userId: row.user_id ? String(row.user_id) : null,
      sourceFilename: row.source_filename,
      modelName: row.model_name,
      status: row.status,
      processingTimeMs: Number(row.processing_time_ms),
      inputImageUrl,
      annotatedImageUrl,
      detectionsCount: Number(row.detections_count),
      persistenceStatus: row.persistence_status,
      createdAt: new Date(row.created_at),
    },
    detections: detectionRows.map(d => ({
      id: d.id,
      inspectionId: d.inspection_id,
      defectType: d.defect_type,
      confidence: Number(d.confidence),
      x1: Number(d.x1),
      y1: Number(d.y1),
      x2: Number(d.x2),
      y2: Number(d.y2),
      createdAt: d.created_at ? new Date(d.created_at) : new Date(row.created_at),
    })),
  };
}

export async function getSupabaseDashboardStats(requester?: RequesterContext) {
  if (!getConfig()) return null;
  const userFilter =
    requester?.userId && requester.role !== "admin"
      ? `&user_id=eq.${encodeURIComponent(requester.userId)}`
      : "";
  const inspectionRows = await request<Pick<SupabaseInspection, "processing_time_ms" | "detections_count">[]>(
    `/rest/v1/inspections?select=processing_time_ms,detections_count${userFilter}&limit=5000`,
  );
  const detectionRows = await request<Pick<SupabaseDetection, "defect_type">[]>(
    `/rest/v1/detections?select=defect_type&limit=5000`,
  );
  const totalTime = inspectionRows.reduce((sum, row) => sum + Number(row.processing_time_ms), 0);
  return {
    configured: true,
    inspections: inspectionRows.length,
    detections: inspectionRows.reduce((sum, row) => sum + Number(row.detections_count), 0),
    avgProcessingTimeMs: inspectionRows.length ? totalTime / inspectionRows.length : null,
    defectTypes: new Set(detectionRows.map(row => row.defect_type)).size,
  };
}

export async function getSupabaseDefectAnalytics(requester?: RequesterContext) {
  if (!getConfig()) return null;
  const userFilter =
    requester?.userId && requester.role !== "admin"
      ? `&user_id=eq.${encodeURIComponent(requester.userId)}`
      : "";
  const detectionRows = await request<Pick<SupabaseDetection, "defect_type" | "confidence">[]>(
    `/rest/v1/detections?select=defect_type,confidence&limit=5000`,
  );
  const byTypeMap = new Map<string, { count: number; confidenceTotal: number }>();
  for (const row of detectionRows) {
    const current = byTypeMap.get(row.defect_type) ?? { count: 0, confidenceTotal: 0 };
    current.count += 1;
    current.confidenceTotal += Number(row.confidence);
    byTypeMap.set(row.defect_type, current);
  }
  const byType = Array.from(byTypeMap.entries())
    .map(([defectType, values]) => ({
      defectType,
      count: values.count,
      avgConfidence: values.count ? values.confidenceTotal / values.count : 0,
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 50);

  const inspectionRows = await request<Pick<SupabaseInspection, "created_at" | "detections_count">[]>(
    `/rest/v1/inspections?select=created_at,detections_count${userFilter}&order=created_at.desc&limit=5000`,
  );
  const trendMap = new Map<string, { inspections: number; detections: number }>();
  for (const row of inspectionRows) {
    const day = new Date(row.created_at).toISOString().slice(0, 10);
    const current = trendMap.get(day) ?? { inspections: 0, detections: 0 };
    current.inspections += 1;
    current.detections += Number(row.detections_count);
    trendMap.set(day, current);
  }
  const recentTrend = Array.from(trendMap.entries())
    .sort((a, b) => b[0].localeCompare(a[0]))
    .slice(0, 14)
    .map(([day, values]) => ({ day, ...values }));
  return { configured: true, byType, recentTrend };
}

export async function persistToSupabase(
  payload: Record<string, unknown>,
  detectionRows: SupabaseDetection[],
) {
  const config = getConfig();
  if (!config) return false;

  const headers = {
    Authorization: `Bearer ${config.apiKey}`,
    apikey: config.apiKey,
    "Content-Type": "application/json",
    Prefer: "return=minimal,resolution=merge-duplicates",
  };

  // 1. Insert inspection record
  const inspectionResponse = await fetch(`${config.url}/rest/v1/inspections`, {
    method: "POST",
    headers,
    body: JSON.stringify(payload),
  });

  if (!inspectionResponse.ok) {
    const errText = await inspectionResponse.text().catch(() => "");
    throw new Error(`Supabase inspection insert failed (${inspectionResponse.status}): ${errText || inspectionResponse.statusText}`);
  }

  // 2. Insert detection records with rollback on failure to prevent orphaned records
  if (detectionRows.length > 0) {
    try {
      const detectionResponse = await fetch(`${config.url}/rest/v1/detections`, {
        method: "POST",
        headers,
        body: JSON.stringify(detectionRows),
      });

      if (!detectionResponse.ok) {
        const errText = await detectionResponse.text().catch(() => "");
        throw new Error(`Supabase detection insert failed (${detectionResponse.status}): ${errText || detectionResponse.statusText}`);
      }
    } catch (detError) {
      // Rollback the created inspection to guarantee transaction atomicity and prevent orphaned inspection
      const inspectionId = String(payload.inspection_id || "");
      if (inspectionId) {
        console.warn(`[Supabase] Rolling back inspection "${inspectionId}" after detection insert failure`);
        try {
          await fetch(`${config.url}/rest/v1/inspections?inspection_id=eq.${encodeURIComponent(inspectionId)}`, {
            method: "DELETE",
            headers: {
              Authorization: `Bearer ${config.apiKey}`,
              apikey: config.apiKey,
            },
          });
        } catch (rollbackError) {
          console.error(`[Supabase] Rollback failed for inspection "${inspectionId}":`, rollbackError);
        }
      }
      throw detError;
    }
  }

  return true;
}

export function isSupabaseConfigured() {
  return Boolean(getConfig());
}
