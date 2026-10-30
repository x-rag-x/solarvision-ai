import { format, isValid } from "date-fns";

/**
 * SolarVision AI — Centralized Date & Timestamp Formatting Helper
 *
 * Requirements:
 * 1. Convert valid Date instances into human-readable strings (e.g. "30 Oct 2026, 8:42 PM").
 * 2. Support ISO 8601 strings and other date formats returned by SQLite, tRPC, and APIs.
 * 3. Preserve correct local timezone handling.
 * 4. Gracefully handle null, undefined, empty, and invalid timestamps without throwing.
 * 5. Never expose "[object Date]" or "Invalid Date" to users.
 * 6. Preserve original values used for storage and API contracts.
 */

/**
 * Formats a Date object, ISO string, or timestamp into human-readable format.
 * Example output: "30 Oct 2026, 8:42 PM"
 */
export function formatInspectionDate(
  dateInput: Date | string | number | null | undefined,
  fallback: string = "—"
): string {
  if (dateInput === null || dateInput === undefined || dateInput === "") {
    return fallback;
  }

  let dateObj: Date;

  if (dateInput instanceof Date) {
    dateObj = dateInput;
  } else if (typeof dateInput === "number") {
    if (isNaN(dateInput) || !isFinite(dateInput)) {
      return fallback;
    }
    // Differentiate between second-based UNIX timestamps (< 1e11) and millisecond timestamps
    const ms = dateInput < 1e11 ? dateInput * 1000 : dateInput;
    dateObj = new Date(ms);
  } else if (typeof dateInput === "string") {
    const trimmed = dateInput.trim();
    if (!trimmed) return fallback;

    // Check if numeric string
    if (/^\d+$/.test(trimmed)) {
      const num = Number(trimmed);
      if (!isNaN(num) && isFinite(num)) {
        const ms = num < 1e11 ? num * 1000 : num;
        dateObj = new Date(ms);
      } else {
        return fallback;
      }
    } else {
      dateObj = new Date(trimmed);
    }
  } else {
    return fallback;
  }

  if (!isValid(dateObj) || isNaN(dateObj.getTime())) {
    return fallback;
  }

  try {
    return format(dateObj, "d MMM yyyy, h:mm a");
  } catch {
    return fallback;
  }
}

/**
 * Formats a Date object into a shorter date/time string for compact table rows.
 * Example output: "30 Oct 2026, 20:42" or "30 Oct, 8:42 PM"
 */
export function formatInspectionDateShort(
  dateInput: Date | string | number | null | undefined,
  fallback: string = "—"
): string {
  if (dateInput === null || dateInput === undefined || dateInput === "") {
    return fallback;
  }

  const formatted = formatInspectionDate(dateInput, fallback);
  return formatted;
}

/**
 * Checks whether an input value represents a valid date or timestamp.
 */
export function isValidDateInput(
  dateInput: Date | string | number | null | undefined
): boolean {
  if (dateInput === null || dateInput === undefined || dateInput === "") {
    return false;
  }

  let dateObj: Date;
  if (dateInput instanceof Date) {
    dateObj = dateInput;
  } else if (typeof dateInput === "number") {
    if (isNaN(dateInput) || !isFinite(dateInput)) return false;
    const ms = dateInput < 1e11 ? dateInput * 1000 : dateInput;
    dateObj = new Date(ms);
  } else if (typeof dateInput === "string") {
    const trimmed = dateInput.trim();
    if (!trimmed) return false;
    if (/^\d+$/.test(trimmed)) {
      const num = Number(trimmed);
      const ms = num < 1e11 ? num * 1000 : num;
      dateObj = new Date(ms);
    } else {
      dateObj = new Date(trimmed);
    }
  } else {
    return false;
  }

  return isValid(dateObj) && !isNaN(dateObj.getTime());
}
