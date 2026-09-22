/**
 * Enterprise Date & Time Formatter
 * Standardizes all date representations to dd/mm/yyyy in Asia/Bangkok timezone.
 */

const BANGKOK_TZ = "Asia/Bangkok";

/**
 * Format a date string or timestamp to dd/mm/yyyy (e.g. 15/09/2026) in Asia/Bangkok.
 */
export function formatDate(dateInput?: string | Date | number | null): string {
  if (!dateInput) return "-";
  const date = new Date(dateInput);
  if (isNaN(date.getTime())) return "-";

  try {
    const parts = new Intl.DateTimeFormat("en-GB", {
      timeZone: BANGKOK_TZ,
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    }).formatToParts(date);

    const day = parts.find((p) => p.type === "day")?.value || "";
    const month = parts.find((p) => p.type === "month")?.value || "";
    const year = parts.find((p) => p.type === "year")?.value || "";
    return `${day}/${month}/${year}`;
  } catch {
    return "-";
  }
}

/**
 * Format a date string or timestamp to dd/mm/yyyy HH:mm:ss (or HH:mm) in Asia/Bangkok.
 */
export function formatDateTime(
  dateInput?: string | Date | number | null,
  includeSeconds = true
): string {
  if (!dateInput) return "-";
  const date = new Date(dateInput);
  if (isNaN(date.getTime())) return "-";

  try {
    const parts = new Intl.DateTimeFormat("en-GB", {
      timeZone: BANGKOK_TZ,
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    }).formatToParts(date);

    const day = parts.find((p) => p.type === "day")?.value || "";
    const month = parts.find((p) => p.type === "month")?.value || "";
    const year = parts.find((p) => p.type === "year")?.value || "";
    const hour = parts.find((p) => p.type === "hour")?.value || "00";
    const minute = parts.find((p) => p.type === "minute")?.value || "00";
    const second = parts.find((p) => p.type === "second")?.value || "00";

    const datePart = `${day}/${month}/${year}`;
    const timePart = includeSeconds ? `${hour}:${minute}:${second}` : `${hour}:${minute}`;
    return `${datePart} ${timePart}`;
  } catch {
    return "-";
  }
}

/**
 * Format time only to HH:mm (24-hour) in Asia/Bangkok.
 */
export function formatTime(dateInput?: string | Date | number | null): string {
  if (!dateInput) return "-";
  const date = new Date(dateInput);
  if (isNaN(date.getTime())) return "-";

  try {
    const parts = new Intl.DateTimeFormat("en-GB", {
      timeZone: BANGKOK_TZ,
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).formatToParts(date);

    const hour = parts.find((p) => p.type === "hour")?.value || "00";
    const minute = parts.find((p) => p.type === "minute")?.value || "00";
    return `${hour}:${minute}`;
  } catch {
    return "-";
  }
}
