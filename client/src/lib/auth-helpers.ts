import { UNAUTHED_ERR_MSG } from "@shared/const";
import { TRPCClientError } from "@trpc/client";

/**
 * Maximum safe binary upload limit in megabytes.
 * Reconciled with backend transport limits:
 * - Express JSON body parser: 50MB
 * - Zod schema base64 string constraint: 50,000,000 characters
 * 35 MB binary converts to ~46.7 MB base64 string, leaving headroom for JSON metadata.
 */
export const BACKEND_TRANSPORT_MAX_MB = 35;

/**
 * Determines if an error represents an unauthenticated, unauthorized, or session-expired response.
 */
export function isUnauthorizedError(error: unknown): boolean {
  if (!error) return false;
  if (error instanceof TRPCClientError) {
    if (
      error.data?.code === "UNAUTHORIZED" ||
      error.data?.httpStatus === 401 ||
      (error.shape as any)?.data?.code === "UNAUTHORIZED"
    ) {
      return true;
    }
  }

  const message = (
    error instanceof Error
      ? error.message
      : typeof error === "object" && error !== null && "message" in error
      ? String((error as any).message)
      : String(error)
  ).toLowerCase();

  return (
    message === UNAUTHED_ERR_MSG.toLowerCase() ||
    message.includes("10001") ||
    message.includes("unauthorized") ||
    message.includes("please login") ||
    message.includes("unauthenticated") ||
    message.includes("session expired")
  );
}

/**
 * Validates file size against client preferences and backend transport ceilings.
 */
export function validateUploadFileSize(
  file: File,
  configuredLimitMb?: number,
): { valid: boolean; error?: string } {
  const maxMb = Math.min(configuredLimitMb ?? BACKEND_TRANSPORT_MAX_MB, BACKEND_TRANSPORT_MAX_MB);
  const maxBytes = maxMb * 1024 * 1024;
  const fileMb = (file.size / (1024 * 1024)).toFixed(1);

  if (file.size > maxBytes) {
    return {
      valid: false,
      error: `File size (${fileMb} MB) exceeds maximum allowed upload limit of ${maxMb} MB. High-resolution EL/NIR frames must be under ${BACKEND_TRANSPORT_MAX_MB} MB to comply with server transport constraints.`,
    };
  }

  return { valid: true };
}
