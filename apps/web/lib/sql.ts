/**
 * Escape a string value for use in SpacetimeDB SQL queries.
 * Replaces single quotes with doubled single quotes.
 */
export function sqlEscape(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/\0/g, "")
    .replace(/'/g, "''");
}
