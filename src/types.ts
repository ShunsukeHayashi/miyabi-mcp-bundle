/**
 * Miyabi MCP Bundle - Type Definitions
 *
 * Central type definitions for the MCP server.
 */

// ========== Error Codes ==========
export type ErrorCode =
  | 'NOT_FOUND'
  | 'INVALID_INPUT'
  | 'EXECUTION_FAILED'
  | 'TIMEOUT'
  | 'PERMISSION_DENIED'
  | 'NOT_INSTALLED'
  | 'VALIDATION_FAILED'
  | 'PATH_TRAVERSAL'
  | 'COMMAND_INJECTION';

// ========== Tool Error ==========
export interface ToolError {
  error: string;
  code?: ErrorCode;
  suggestion?: string;
  details?: Record<string, unknown>;
}

// ========== Tool Result ==========
export type ToolResult = Record<string, unknown> | ToolError;

// ========== Tool Arguments ==========
export type ToolArgs = Record<string, unknown>;

// ========== Tool Handler ==========
export type ToolHandler = (args: ToolArgs) => Promise<ToolResult>;

// ========== Cache Entry ==========
export interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
}

// ========== Cache Config ==========
export interface CacheConfig {
  maxSize: number;
  defaultTTL: number;
}

// ========== Git Types ==========
export interface GitStatusResult {
  modified: string[];
  staged: string[];
  untracked: string[];
  ahead?: number;
  behind?: number;
}

export interface GitLogEntry {
  hash: string;
  date: string;
  message: string;
  author_name: string;
  author_email: string;
}

export interface GitBranchInfo {
  name: string;
  current: boolean;
  tracking?: string;
}

// ========== Process Types ==========
export interface ProcessInfo {
  pid: number;
  name: string;
  cpu: number;
  mem: number;
  command?: string;
}

// ========== Network Types ==========
export interface NetworkInterface {
  iface: string;
  ip4: string;
  ip6: string;
  mac: string;
  internal: boolean;
}

export interface DnsLookupResult {
  hostname: string;
  address: { address: string; family: number } | null;
  ipv4: string[];
  ipv6: string[];
}

// ========== File Types ==========
export interface FileStats {
  path: string;
  size: number;
  modified: Date;
  created: Date;
  isDirectory: boolean;
}

export interface FileDuplicate {
  hash: string;
  files: string[];
}

// ========== GitHub Types ==========
export interface GitHubIssue {
  number: number;
  title: string;
  state: string;
  body?: string;
  labels: string[];
  assignees: string[];
  created_at: string;
  updated_at: string;
}

export interface GitHubPullRequest {
  number: number;
  title: string;
  state: string;
  body?: string;
  head: { ref: string };
  base: { ref: string };
  mergeable?: boolean;
  merged: boolean;
  created_at: string;
  updated_at: string;
}

// ========== Health Check Types ==========
export interface HealthCheckResult {
  status: 'healthy' | 'degraded' | 'unhealthy';
  checks: {
    git: boolean;
    github: boolean;
    tmux: boolean;
    system: boolean;
  };
  details: Record<string, unknown>;
}
