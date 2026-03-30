const MINUTE = 60_000;
const HOUR = 3_600_000;
const DAY = 86_400_000;

/**
 * Format a timestamp as a relative "time ago" string.
 * Falls back to locale date string for dates older than 7 days.
 */
export function timeAgo(timestamp: number | Date): string {
  const ms = typeof timestamp === "number" ? timestamp : timestamp.getTime();
  const diff = Date.now() - ms;

  if (diff < MINUTE) return "just now";
  if (diff < HOUR) return `${Math.floor(diff / MINUTE)}m ago`;
  if (diff < DAY) return `${Math.floor(diff / HOUR)}h ago`;
  if (diff < DAY * 7) return `${Math.floor(diff / DAY)}d ago`;
  return new Date(ms).toLocaleDateString();
}

/**
 * Format micros timestamp (SpacetimeDB) to relative time.
 */
export function microsAgo(micros: number): string {
  return timeAgo(micros / 1000);
}

/**
 * Format micros timestamp to full locale string (for tooltips).
 */
export function microsToLocale(micros: number): string {
  return new Date(micros / 1000).toLocaleString();
}
