/**
 * Miyabi MCP Bundle - Constants
 *
 * Central configuration for limits, timeouts, and defaults.
 * All magic numbers should be defined here.
 */

// ========== Input Size Limits ==========
export const MAX_QUERY_LENGTH = 1000;
export const MAX_PATH_LENGTH = 4096;
export const MAX_HOSTNAME_LENGTH = 253;

// ========== DNS Limits ==========
export const DNS_HOSTNAME_MAX = 253;

// ========== Process Limits ==========
export const LINUX_MAX_PID = 4194304;
export const PROCESS_LIST_MAX = 200;
export const PROCESS_TOP_DEFAULT = 10;

// ========== File Limits ==========
export const FILE_READ_MAX_BYTES = 100 * 1024;        // 100KB
export const FILE_HASH_MAX_BYTES = 100 * 1024 * 1024; // 100MB
export const FILE_DUPLICATES_MAX = 100;

// ========== Tmux Limits ==========
export const TMUX_PANE_LINES_MAX = 10000;
export const TMUX_PANE_LINES_DEFAULT = 1000;

// ========== Log Limits ==========
export const LOG_MINUTES_MAX = 10080;  // 7 days
export const LOG_MINUTES_DEFAULT = 60;
export const LOG_LINES_MAX = 1000;
export const LOG_LINES_DEFAULT = 50;
export const LOG_SEARCH_MAX = 100;

// ========== Network Limits ==========
export const NETWORK_TIMEOUT_MS = 30000;
export const NETWORK_PING_COUNT_MAX = 10;
export const NETWORK_PING_COUNT_DEFAULT = 3;

// ========== GitHub Limits ==========
export const GITHUB_PER_PAGE_MAX = 100;
export const GITHUB_PER_PAGE_DEFAULT = 30;

// ========== Git Limits ==========
export const GIT_LOG_MAX = 100;
export const GIT_LOG_DEFAULT = 20;
export const GIT_CONTRIBUTORS_MAX = 100;
export const GIT_CONTRIBUTORS_DEFAULT = 10;

// ========== Claude Limits ==========
export const CLAUDE_LOG_LINES_MAX = 1000;
export const CLAUDE_LOG_LINES_DEFAULT = 100;

// ========== Cache TTLs (ms) ==========
export const CACHE_TTL = {
  cpu: 2000,           // 2 seconds
  memory: 2000,        // 2 seconds
  disk: 10000,         // 10 seconds
  network_stats: 2000, // 2 seconds
  processes: 3000,     // 3 seconds
  interfaces: 30000,   // 30 seconds
  default: 5000,       // 5 seconds
} as const;

// ========== Cache Config ==========
export const CACHE_MAX_SIZE = 100;
