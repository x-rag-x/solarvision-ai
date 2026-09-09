type SupabaseConfig = { url: string; serviceRoleKey: string; bucket: string };

type SupabaseDetection = { inspection_id: string; defect_type: string; confidence: number; x1: number; y1: number; x2: number; y2: number };

function getConfig(): SupabaseConfig | null {
  const url = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) return null;
  return { url: url.replace(/\/+$/, ""), serviceRoleKey, bucket: process.env.SUPABASE_STORAGE_BUCKET || "solarvision-images" };
}

export async function uploadToSupabase(key: string, data: Buffer, contentType: string) {
  const config = getConfig();
  if (!config) return null;
  const body = new Uint8Array(data);
  const response = await fetch(`${config.url}/storage/v1/object/${config.bucket}/${key}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${config.serviceRoleKey}`, apikey: config.serviceRoleKey, "Content-Type": contentType, "x-upsert": "true" },
    body: body as unknown as BodyInit,
  });
  if (!response.ok) throw new Error(`Supabase Storage upload failed (${response.status})`);
  return `${config.url}/storage/v1/object/public/${config.bucket}/${key}`;
}

export async function persistToSupabase(payload: Record<string, unknown>, detectionRows: SupabaseDetection[]) {
  const config = getConfig();
  if (!config) return false;
  const headers = { Authorization: `Bearer ${config.serviceRoleKey}`, apikey: config.serviceRoleKey, "Content-Type": "application/json", Prefer: "return=minimal" };
  const inspectionResponse = await fetch(`${config.url}/rest/v1/inspections`, { method: "POST", headers, body: JSON.stringify(payload) });
  if (!inspectionResponse.ok) throw new Error(`Supabase inspection insert failed (${inspectionResponse.status})`);
  if (detectionRows.length > 0) {
    const detectionResponse = await fetch(`${config.url}/rest/v1/detections`, { method: "POST", headers, body: JSON.stringify(detectionRows) });
    if (!detectionResponse.ok) throw new Error(`Supabase detection insert failed (${detectionResponse.status})`);
  }
  return true;
}

export function isSupabaseConfigured() {
  return Boolean(getConfig());
}
