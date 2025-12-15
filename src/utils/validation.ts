/**
 * Miyabi MCP Bundle - Validation Utilities
 *
 * General-purpose validation and transformation functions.
 */

// ========== Number Clamping ==========

/**
 * Clamp a value to a range with a default fallback
 * Replaces 37+ repeated Math.min(Math.max(...)) patterns
 *
 * @example
 * // Before: const limit = Math.min(Math.max((args.limit as number) || 20, 1), 100);
 * // After:  const limit = clampRange(args.limit, 1, 100, 20);
 */
export function clampRange(
  value: unknown,
  min: number,
  max: number,
  defaultValue: number
): number {
  const num = typeof value === 'number' && !isNaN(value) ? value : defaultValue;
  return Math.min(Math.max(num, min), max);
}

/**
 * Parse and clamp an integer value
 */
export function clampInt(
  value: unknown,
  min: number,
  max: number,
  defaultValue: number
): number {
  const parsed = typeof value === 'number' ? Math.floor(value) : defaultValue;
  return Math.min(Math.max(parsed, min), max);
}

// ========== String Parsing ==========

/**
 * Parse lines from command output
 * Replaces 8+ repeated stdout.trim().split('\n').filter(Boolean) patterns
 */
export function parseLines(stdout: string): string[] {
  return stdout.trim().split('\n').filter(Boolean);
}

/**
 * Parse first line from command output
 */
export function parseFirstLine(stdout: string): string {
  return stdout.trim().split('\n')[0] || '';
}

/**
 * Safe string conversion
 */
export function toString(value: unknown): string {
  if (typeof value === 'string') return value;
  if (value === null || value === undefined) return '';
  return String(value);
}

/**
 * Safe optional string extraction
 */
export function toOptionalString(value: unknown): string | undefined {
  if (value === null || value === undefined) return undefined;
  return String(value);
}

// ========== Boolean Parsing ==========

/**
 * Parse boolean from various input types
 */
export function toBoolean(value: unknown, defaultValue: boolean = false): boolean {
  if (typeof value === 'boolean') return value;
  if (value === 'true' || value === '1') return true;
  if (value === 'false' || value === '0') return false;
  return defaultValue;
}

// ========== Array Utilities ==========

/**
 * Ensure value is an array
 */
export function toArray<T>(value: T | T[] | undefined | null): T[] {
  if (value === null || value === undefined) return [];
  return Array.isArray(value) ? value : [value];
}

/**
 * Limit array to first N items
 */
export function limitArray<T>(arr: T[], limit: number): T[] {
  return arr.slice(0, Math.max(0, limit));
}

// ========== Object Utilities ==========

/**
 * Check if value is a non-null object
 */
export function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Safe property access with default
 */
export function getProp<T>(
  obj: Record<string, unknown>,
  key: string,
  defaultValue: T
): T {
  const value = obj[key];
  return value !== undefined && value !== null ? (value as T) : defaultValue;
}
