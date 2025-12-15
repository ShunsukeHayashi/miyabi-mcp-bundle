/**
 * Miyabi MCP Bundle - Error Utilities
 *
 * Standardized error handling and formatting.
 */

import { ErrorCode, ToolError, ToolResult } from '../types.js';

// ========== Error Creation ==========

/**
 * Create a standardized tool error
 */
export function createError(
  message: string,
  code?: ErrorCode,
  suggestion?: string,
  details?: Record<string, unknown>
): ToolError {
  const error: ToolError = { error: message };
  if (code) error.code = code;
  if (suggestion) error.suggestion = suggestion;
  if (details) error.details = details;
  return error;
}

/**
 * Create error from caught exception
 */
export function createErrorFromException(
  error: unknown,
  code?: ErrorCode,
  suggestion?: string
): ToolError {
  const message = error instanceof Error ? error.message : String(error);
  return createError(message, code, suggestion);
}

// ========== Common Error Factories ==========

/**
 * Create "not found" error
 */
export function notFoundError(resource: string, identifier?: string): ToolError {
  const message = identifier
    ? `${resource} '${identifier}' not found`
    : `${resource} not found`;
  return createError(message, 'NOT_FOUND');
}

/**
 * Create "not installed" error
 */
export function notInstalledError(command: string, installHint?: string): ToolError {
  const suggestion = installHint
    ? `Install with: ${installHint}`
    : `Please install ${command} to use this tool`;
  return createError(`${command} is not installed`, 'NOT_INSTALLED', suggestion);
}

/**
 * Create "invalid input" error
 */
export function invalidInputError(field: string, reason: string): ToolError {
  return createError(`Invalid ${field}: ${reason}`, 'INVALID_INPUT');
}

/**
 * Create "validation failed" error
 */
export function validationError(message: string): ToolError {
  return createError(message, 'VALIDATION_FAILED');
}

/**
 * Create "execution failed" error
 */
export function executionError(operation: string, details?: string): ToolError {
  const message = details
    ? `Failed to ${operation}: ${details}`
    : `Failed to ${operation}`;
  return createError(message, 'EXECUTION_FAILED');
}

/**
 * Create "timeout" error
 */
export function timeoutError(operation: string, timeoutMs: number): ToolError {
  return createError(
    `${operation} timed out after ${timeoutMs}ms`,
    'TIMEOUT',
    'Try again or increase timeout'
  );
}

/**
 * Create "permission denied" error
 */
export function permissionError(resource: string): ToolError {
  return createError(
    `Permission denied for ${resource}`,
    'PERMISSION_DENIED',
    'Check file/directory permissions'
  );
}

// ========== Result Helpers ==========

/**
 * Check if result is an error
 */
export function isToolError(result: ToolResult): result is ToolError {
  return 'error' in result && typeof (result as ToolError).error === 'string';
}

/**
 * Wrap async operation with standardized error handling
 */
export async function wrapAsync<T>(
  operation: () => Promise<T>,
  errorCode?: ErrorCode,
  suggestion?: string
): Promise<T | ToolError> {
  try {
    return await operation();
  } catch (error) {
    return createErrorFromException(error, errorCode, suggestion);
  }
}

/**
 * Execute handler with try-catch and return standardized result
 */
export async function safeExecute<T extends ToolResult>(
  handler: () => Promise<T>
): Promise<T | ToolError> {
  try {
    return await handler();
  } catch (error) {
    return createErrorFromException(error, 'EXECUTION_FAILED');
  }
}
