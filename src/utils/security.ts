/**
 * Miyabi MCP Bundle - Security Utilities
 *
 * Functions for input sanitization and security validation.
 */

import { resolve } from 'path';
import { realpathSync, existsSync } from 'fs';
import { MAX_QUERY_LENGTH, MAX_PATH_LENGTH, MAX_HOSTNAME_LENGTH, LINUX_MAX_PID } from '../constants.js';

// ========== Shell Argument Sanitization ==========

/**
 * Sanitize shell argument to prevent command injection
 * Removes dangerous characters that could be used for injection attacks
 */
export function sanitizeShellArg(arg: string): string {
  if (!arg) return '';
  return arg.replace(/[;&|`$(){}[\]<>\\!#*?~\n\r]/g, '');
}

// ========== Path Sanitization ==========

/**
 * Validate and sanitize path to prevent traversal and symlink attacks
 * @throws Error if path traversal or symlink attack detected
 */
export function sanitizePath(basePath: string, userPath: string): string {
  const resolved = resolve(basePath, userPath);
  const normalizedBase = resolve(basePath);

  if (!resolved.startsWith(normalizedBase)) {
    throw new Error('Path traversal detected');
  }

  // Symlink attack protection: resolve real path if file exists
  if (existsSync(resolved)) {
    const realPath = realpathSync(resolved);
    if (!realPath.startsWith(normalizedBase)) {
      throw new Error('Symlink traversal detected');
    }
    return realPath;
  }

  return resolved;
}

// ========== Input Validation ==========

/**
 * Validate input string length
 * @returns Error message if validation fails, null if valid
 */
export function validateInputLength(
  value: string,
  maxLength: number,
  fieldName: string
): string | null {
  if (value && value.length > maxLength) {
    return `${fieldName} exceeds maximum length of ${maxLength} characters`;
  }
  return null;
}

/**
 * Validate query string (length check)
 */
export function validateQuery(query: string): string | null {
  return validateInputLength(query, MAX_QUERY_LENGTH, 'Query');
}

/**
 * Validate path string (length check)
 */
export function validatePath(path: string): string | null {
  return validateInputLength(path, MAX_PATH_LENGTH, 'Path');
}

/**
 * Validate hostname string (length check)
 */
export function validateHostnameLength(hostname: string): string | null {
  return validateInputLength(hostname, MAX_HOSTNAME_LENGTH, 'Hostname');
}

// ========== Hostname Validation ==========

/**
 * Validate hostname format (DNS-compatible)
 * Allows: alphanumeric, hyphens, dots, IPv4 addresses
 */
export function isValidHostname(hostname: string): boolean {
  if (!hostname || hostname.length > MAX_HOSTNAME_LENGTH) return false;

  // Allow IPv4 addresses
  const ipv4Regex = /^(\d{1,3}\.){3}\d{1,3}$/;
  if (ipv4Regex.test(hostname)) {
    const parts = hostname.split('.').map(Number);
    return parts.every((p) => p >= 0 && p <= 255);
  }

  // Validate hostname format
  const hostnameRegex = /^[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?)*$/;
  return hostnameRegex.test(hostname);
}

// ========== PID Validation ==========

/**
 * Validate process ID (PID)
 */
export function isValidPid(pid: unknown): boolean {
  if (typeof pid !== 'number') return false;
  if (!Number.isInteger(pid)) return false;
  if (pid < 1) return false;
  if (pid > LINUX_MAX_PID) return false;
  return true;
}

// ========== Command Existence Check ==========

/**
 * Check if a command exists on the system
 * Uses 'which' on Unix-like systems, 'where' on Windows
 */
export async function commandExists(
  cmd: string,
  execAsync: (cmd: string) => Promise<{ stdout: string }>
): Promise<boolean> {
  const platform = process.platform;
  try {
    const which = platform === 'win32' ? 'where' : 'which';
    await execAsync(`${which} ${sanitizeShellArg(cmd)}`);
    return true;
  } catch {
    return false;
  }
}
