// Preconfigured storage helpers for Manus WebDev templates
// Uploads via Forge Server presigned URL to S3 (PUT direct).
// Downloads return /manus-storage/{key} paths served via 307 redirect.

import { existsSync, realpathSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join, relative, resolve, isAbsolute } from "node:path";
import { ENV } from "./_core/env";

export function getUploadsDir(): string {
  return process.env.UPLOADS_DIR
    ? resolve(process.env.UPLOADS_DIR)
    : resolve(process.cwd(), "uploads");
}

const UPLOADS_DIR = getUploadsDir();

function getForgeConfig() {
  const forgeUrl = ENV.forgeApiUrl;
  const forgeKey = ENV.forgeApiKey;

  if (!forgeUrl || !forgeKey) {
    return null;
  }

  return { forgeUrl: forgeUrl.replace(/\/+$/, ""), forgeKey };
}

/**
 * Validates and canonicalizes a relative storage key against directory traversal,
 * absolute paths, null-byte injection, URL-encoded escapes, and symlink breakouts.
 */
export function safeCanonicalKey(relKey: string): { key: string; absolutePath: string } {
  if (!relKey || typeof relKey !== "string") {
    throw new Error("Invalid storage key: key must be a non-empty string.");
  }

  // 1. Poison Null Byte Check
  if (relKey.includes("\0") || relKey.includes("%00")) {
    throw new Error("Invalid storage key: null byte injection detected.");
  }

  // 2. Multi-pass URI Decoding to prevent %2e%2e%2f and double-encoding bypasses
  let decoded = relKey;
  let prev = "";
  let passes = 0;
  while (decoded !== prev && passes < 3) {
    prev = decoded;
    try {
      if (decoded.includes("%")) {
        decoded = decodeURIComponent(decoded);
      }
    } catch {
      break;
    }
    passes++;
  }

  if (decoded.includes("\0")) {
    throw new Error("Invalid storage key: null byte injection detected.");
  }

  // 3. Strip Windows drive letters (C:) and UNC network prefixes (\\)
  let clean = decoded.replace(/^[a-zA-Z]:[/\\]+/, "").replace(/^[/\\]+/, "");

  // 4. Normalize all slashes to forward slashes
  clean = clean.replace(/\\/g, "/");

  // 5. Sanitize and eliminate relative traversal segments (.., .)
  const segments = clean
    .split("/")
    .map(s => s.trim())
    .filter(seg => seg.length > 0 && seg !== "." && seg !== "..");

  if (segments.length === 0) {
    throw new Error("Invalid storage key: path resolves to empty or root path.");
  }

  const sanitizedKey = segments.join("/");
  const candidatePath = resolve(UPLOADS_DIR, sanitizedKey);

  // 6. Canonical path containment check against trusted root
  const relFromRoot = relative(UPLOADS_DIR, candidatePath);
  if (relFromRoot.startsWith("..") || isAbsolute(relFromRoot)) {
    throw new Error("Storage security violation: key escapes authorized storage root.");
  }

  // 7. Symlink Escape Verification for existing paths
  if (existsSync(candidatePath)) {
    try {
      const realCandidate = realpathSync(candidatePath);
      const realRoot = realpathSync(UPLOADS_DIR);
      const realRel = relative(realRoot, realCandidate);
      if (realRel.startsWith("..") || isAbsolute(realRel)) {
        throw new Error("Storage security violation: symlink escapes authorized storage root.");
      }
    } catch (symlinkErr: any) {
      if (symlinkErr.message?.includes("Storage security violation")) {
        throw symlinkErr;
      }
    }
  }

  return { key: sanitizedKey, absolutePath: candidatePath };
}

function normalizeKey(relKey: string): string {
  return safeCanonicalKey(relKey).key;
}

function appendHashSuffix(relKey: string): string {
  const hash = crypto.randomUUID().replace(/-/g, "").slice(0, 8);
  const lastDot = relKey.lastIndexOf(".");
  if (lastDot === -1) return `${relKey}_${hash}`;
  return `${relKey.slice(0, lastDot)}_${hash}${relKey.slice(lastDot)}`;
}

export async function storagePut(
  relKey: string,
  data: Buffer | Uint8Array | string,
  contentType = "application/octet-stream",
): Promise<{ key: string; url: string }> {
  const { key: safeKey } = safeCanonicalKey(relKey);
  const hashedKey = appendHashSuffix(safeKey);

  // Re-verify the hashed key to ensure no boundary escapes
  const filePath = resolve(UPLOADS_DIR, hashedKey);
  const relFromRoot = relative(UPLOADS_DIR, filePath);
  if (relFromRoot.startsWith("..") || isAbsolute(relFromRoot)) {
    throw new Error("Storage security violation: destination path escapes authorized storage root.");
  }

  const forgeConfig = getForgeConfig();
  if (!forgeConfig) {
    await mkdir(dirname(filePath), { recursive: true });
    const buffer = typeof data === "string" ? Buffer.from(data) : Buffer.from(data as any);
    await writeFile(filePath, buffer);
    return { key: hashedKey, url: `/uploads/${hashedKey.replace(/\\/g, "/")}` };
  }

  const { forgeUrl, forgeKey } = forgeConfig;

  // 1. Get presigned PUT URL from Forge
  const presignUrl = new URL("v1/storage/presign/put", forgeUrl + "/");
  presignUrl.searchParams.set("path", hashedKey);

  const presignResp = await fetch(presignUrl, {
    headers: { Authorization: `Bearer ${forgeKey}` },
  });

  if (!presignResp.ok) {
    const msg = await presignResp.text().catch(() => presignResp.statusText);
    throw new Error(`Storage presign failed (${presignResp.status}): ${msg}`);
  }

  const { url: s3Url } = (await presignResp.json()) as { url: string };
  if (!s3Url) throw new Error("Forge returned empty presign URL");

  // 2. PUT file directly to S3
  const blob =
    typeof data === "string"
      ? new Blob([data], { type: contentType })
      : new Blob([data as any], { type: contentType });

  const uploadResp = await fetch(s3Url, {
    method: "PUT",
    headers: { "Content-Type": contentType },
    body: blob,
  });

  if (!uploadResp.ok) {
    throw new Error(`Storage upload to S3 failed (${uploadResp.status})`);
  }

  return { key: hashedKey, url: `/manus-storage/${hashedKey}` };
}

export async function storageGet(relKey: string): Promise<{ key: string; url: string }> {
  const { key: safeKey } = safeCanonicalKey(relKey);
  const forgeConfig = getForgeConfig();
  if (!forgeConfig) {
    return { key: safeKey, url: `/uploads/${safeKey.replace(/\\/g, "/")}` };
  }
  return { key: safeKey, url: `/manus-storage/${safeKey}` };
}

export async function storageGetSignedUrl(relKey: string): Promise<string> {
  const { key: safeKey } = safeCanonicalKey(relKey);
  const forgeConfig = getForgeConfig();
  if (!forgeConfig) {
    return `/uploads/${safeKey.replace(/\\/g, "/")}`;
  }
  const { forgeUrl, forgeKey } = forgeConfig;

  const getUrl = new URL("v1/storage/presign/get", forgeUrl + "/");
  getUrl.searchParams.set("path", safeKey);

  const resp = await fetch(getUrl, {
    headers: { Authorization: `Bearer ${forgeKey}` },
  });

  if (!resp.ok) {
    const msg = await resp.text().catch(() => resp.statusText);
    throw new Error(`Storage signed URL failed (${resp.status}): ${msg}`);
  }

  const { url } = (await resp.json()) as { url: string };
  return url;
}
