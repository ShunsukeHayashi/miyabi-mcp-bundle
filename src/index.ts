#!/usr/bin/env node
/**
 * Miyabi MCP Bundle - All-in-One Monitoring and Control Server
 *
 * A comprehensive MCP server with 172 tools across 21 categories:
 * - Git Inspector (19 tools)
 * - Tmux Monitor (10 tools)
 * - Log Aggregator (7 tools)
 * - Resource Monitor (10 tools)
 * - Network Inspector (15 tools)
 * - Process Inspector (14 tools)
 * - File Watcher (10 tools)
 * - Claude Code Monitor (8 tools)
 * - GitHub Integration (21 tools)
 * - Linux systemd (3 tools)
 * - Windows (2 tools)
 * - Docker (10 tools)
 * - Docker Compose (4 tools)
 * - Kubernetes (6 tools)
 * - Spec-Kit (9 tools) - Spec-Driven Development
 * - MCP Tool Discovery (3 tools) - Search and discover tools
 * - Database Foundation (6 tools) - SQLite/PostgreSQL/MySQL
 * - Time Tools (4 tools) - Timezone, formatting, diff
 * - Calculator Tools (3 tools) - Math, units, statistics
 * - Sequential Thinking (3 tools) - Structured reasoning
 * - Generator Tools (4 tools) - UUID, random, hash, password
 * + System Health (1 tool)
 *
 * @version 3.6.0
 * @author Shunsuke Hayashi
 * @license MIT
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool
} from '@modelcontextprotocol/sdk/types.js';
import { simpleGit, SimpleGit } from 'simple-git';
import { Octokit } from '@octokit/rest';
import * as si from 'systeminformation';
import { glob } from 'glob';
import { readFile, readdir, stat } from 'fs/promises';
import { realpathSync, existsSync } from 'fs';
import { join, resolve } from 'path';
import { homedir, platform } from 'os';
import { exec } from 'child_process';
import { promisify } from 'util';
import { createHash } from 'crypto';
import * as dns from 'dns';

const execAsync = promisify(exec);
const dnsLookup = promisify(dns.lookup);
const dnsResolve4 = promisify(dns.resolve4);
const dnsResolve6 = promisify(dns.resolve6);

// ========== Security Helpers ==========

// Input size limits to prevent DoS attacks
const MAX_QUERY_LENGTH = 1000;
const MAX_PATH_LENGTH = 4096;
const MAX_HOSTNAME_LENGTH = 253;

/**
 * Validate input string length
 */
function validateInputLength(value: string, maxLength: number, fieldName: string): string | null {
  if (value && value.length > maxLength) {
    return `${fieldName} exceeds maximum length of ${maxLength} characters`;
  }
  return null;
}

/**
 * Sanitize shell argument to prevent command injection
 */
function sanitizeShellArg(arg: string): string {
  if (!arg) return '';
  return arg.replace(/[;&|`$(){}[\]<>\\!#*?~\n\r]/g, '');
}

/**
 * Validate and sanitize path to prevent traversal and symlink attacks
 */
function sanitizePath(basePath: string, userPath: string): string {
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

/**
 * Check if command exists on the system
 */
async function commandExists(cmd: string): Promise<boolean> {
  try {
    const which = platform() === 'win32' ? 'where' : 'which';
    await execAsync(`${which} ${sanitizeShellArg(cmd)}`);
    return true;
  } catch {
    return false;
  }
}

/**
 * Validate hostname format
 */
function isValidHostname(hostname: string): boolean {
  if (!hostname || hostname.length > 253) return false;
  return /^[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/.test(hostname);
}

/**
 * Validate PID
 */
function isValidPid(pid: unknown): pid is number {
  return typeof pid === 'number' && Number.isInteger(pid) && pid > 0 && pid < 4194304;
}

// ========== Caching System ==========
interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
}

class SimpleCache {
  private cache = new Map<string, CacheEntry<unknown>>();

  get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;
    if (Date.now() - entry.timestamp > entry.ttl) {
      this.cache.delete(key);
      return null;
    }
    return entry.data as T;
  }

  set<T>(key: string, data: T, ttlMs: number = 5000): void {
    this.cache.set(key, { data, timestamp: Date.now(), ttl: ttlMs });
  }

  clear(): void {
    this.cache.clear();
  }
}

const cache = new SimpleCache();

// ========== Environment Configuration ==========
const MIYABI_REPO_PATH = process.env.MIYABI_REPO_PATH || process.cwd();
const MIYABI_LOG_DIR = process.env.MIYABI_LOG_DIR || MIYABI_REPO_PATH;
const MIYABI_WATCH_DIR = process.env.MIYABI_WATCH_DIR || MIYABI_REPO_PATH;

const CLAUDE_CONFIG_DIR = platform() === 'darwin'
  ? join(homedir(), 'Library/Application Support/Claude')
  : platform() === 'win32'
    ? join(process.env.APPDATA || '', 'Claude')
    : join(homedir(), '.config/claude');

const CLAUDE_CONFIG_FILE = join(CLAUDE_CONFIG_DIR, 'claude_desktop_config.json');
const CLAUDE_LOGS_DIR = platform() === 'darwin'
  ? join(homedir(), 'Library/Logs/Claude')
  : join(CLAUDE_CONFIG_DIR, 'logs');

const GITHUB_TOKEN = process.env.GITHUB_TOKEN || '';
const GITHUB_DEFAULT_OWNER = process.env.GITHUB_DEFAULT_OWNER || '';
const GITHUB_DEFAULT_REPO = process.env.GITHUB_DEFAULT_REPO || '';

// ========== Initialize Clients ==========
const git: SimpleGit = simpleGit(MIYABI_REPO_PATH);
const octokit = GITHUB_TOKEN ? new Octokit({ auth: GITHUB_TOKEN }) : null;

// ========== Tool Definitions ==========
const tools: Tool[] = [
  // === Git Inspector (19 tools) ===
  { name: 'git_status', description: 'Get current git status (modified, staged, untracked files)', inputSchema: { type: 'object', properties: {} } },
  { name: 'git_branch_list', description: 'List all branches with remote tracking info', inputSchema: { type: 'object', properties: {} } },
  { name: 'git_current_branch', description: 'Get current branch name', inputSchema: { type: 'object', properties: {} } },
  { name: 'git_log', description: 'Get commit history', inputSchema: { type: 'object', properties: { limit: { type: 'number', description: 'Number of commits (default: 20)' } } } },
  { name: 'git_worktree_list', description: 'List all git worktrees', inputSchema: { type: 'object', properties: {} } },
  { name: 'git_diff', description: 'Get diff of unstaged changes', inputSchema: { type: 'object', properties: { file: { type: 'string', description: 'Specific file to diff' } } } },
  { name: 'git_staged_diff', description: 'Get diff of staged changes', inputSchema: { type: 'object', properties: {} } },
  { name: 'git_remote_list', description: 'List all remotes', inputSchema: { type: 'object', properties: {} } },
  { name: 'git_branch_ahead_behind', description: 'Check commits ahead/behind origin', inputSchema: { type: 'object', properties: { branch: { type: 'string', description: 'Branch name (default: current branch)' } } } },
  { name: 'git_file_history', description: 'Get commit history for a file', inputSchema: { type: 'object', properties: { file: { type: 'string', description: 'File path to get history for' }, limit: { type: 'number', description: 'Number of commits (default: 10)' } }, required: ['file'] } },
  { name: 'git_stash_list', description: 'List all stashes', inputSchema: { type: 'object', properties: {} } },
  { name: 'git_blame', description: 'Get blame info for a file', inputSchema: { type: 'object', properties: { file: { type: 'string', description: 'File path to get blame for' }, startLine: { type: 'number', description: 'Starting line number (1-indexed)' }, endLine: { type: 'number', description: 'Ending line number (1-indexed)' } }, required: ['file'] } },
  { name: 'git_show', description: 'Show commit details', inputSchema: { type: 'object', properties: { commit: { type: 'string', description: 'Commit hash (default: HEAD)' } } } },
  { name: 'git_tag_list', description: 'List all tags', inputSchema: { type: 'object', properties: {} } },
  { name: 'git_contributors', description: 'List contributors with commit counts', inputSchema: { type: 'object', properties: { limit: { type: 'number' } } } },
  { name: 'git_conflicts', description: 'Detect merge conflicts in current worktree', inputSchema: { type: 'object', properties: {} } },
  { name: 'git_submodule_status', description: 'List submodule status', inputSchema: { type: 'object', properties: {} } },
  { name: 'git_lfs_status', description: 'Get Git LFS status (requires git-lfs)', inputSchema: { type: 'object', properties: {} } },
  { name: 'git_hooks_list', description: 'List git hooks in repository', inputSchema: { type: 'object', properties: {} } },

  // === Tmux Monitor (10 tools) ===
  { name: 'tmux_list_sessions', description: 'List all tmux sessions', inputSchema: { type: 'object', properties: {} } },
  { name: 'tmux_list_windows', description: 'List windows in a session', inputSchema: { type: 'object', properties: { session: { type: 'string', description: 'Session name (optional, lists all if omitted)' } } } },
  { name: 'tmux_list_panes', description: 'List panes in a window', inputSchema: { type: 'object', properties: { session: { type: 'string', description: 'Session name (optional)' } } } },
  { name: 'tmux_send_keys', description: 'Send keys to a pane', inputSchema: { type: 'object', properties: { target: { type: 'string', description: 'Target pane (e.g., session:window.pane or %id)' }, keys: { type: 'string', description: 'Keys/text to send' } }, required: ['target', 'keys'] } },
  { name: 'tmux_pane_capture', description: 'Capture pane content', inputSchema: { type: 'object', properties: { target: { type: 'string', description: 'Target pane (e.g., session:window.pane or %id)' }, lines: { type: 'number', description: 'Number of lines to capture (default: all)' } } } },
  { name: 'tmux_pane_search', description: 'Search pane content', inputSchema: { type: 'object', properties: { target: { type: 'string', description: 'Target pane (optional)' }, pattern: { type: 'string', description: 'Search pattern (substring match)' } }, required: ['pattern'] } },
  { name: 'tmux_pane_tail', description: 'Get last N lines from pane', inputSchema: { type: 'object', properties: { target: { type: 'string', description: 'Target pane' }, lines: { type: 'number', description: 'Number of lines to retrieve' } } } },
  { name: 'tmux_pane_is_busy', description: 'Check if pane is busy', inputSchema: { type: 'object', properties: { target: { type: 'string', description: 'Target pane' } } } },
  { name: 'tmux_pane_current_command', description: 'Get current command in pane', inputSchema: { type: 'object', properties: { target: { type: 'string', description: 'Target pane' } } } },
  { name: 'tmux_session_info', description: 'Get detailed session info', inputSchema: { type: 'object', properties: { session: { type: 'string', description: 'Session name' } }, required: ['session'] } },

  // === Log Aggregator (7 tools) ===
  { name: 'log_sources', description: 'List all log sources', inputSchema: { type: 'object', properties: {} } },
  { name: 'log_get_recent', description: 'Get recent log entries', inputSchema: { type: 'object', properties: { source: { type: 'string', description: 'Log source name (partial match)' }, limit: { type: 'number', description: 'Max entries to return' }, minutes: { type: 'number', description: 'Only logs from last N minutes' } } } },
  { name: 'log_search', description: 'Search logs for a pattern', inputSchema: { type: 'object', properties: { query: { type: 'string', description: 'Search query (case-insensitive)' }, source: { type: 'string', description: 'Filter by log source' } }, required: ['query'] } },
  { name: 'log_get_errors', description: 'Get error-level logs', inputSchema: { type: 'object', properties: { minutes: { type: 'number', description: 'Only errors from last N minutes' } } } },
  { name: 'log_get_warnings', description: 'Get warning-level logs', inputSchema: { type: 'object', properties: { minutes: { type: 'number', description: 'Only warnings from last N minutes' } } } },
  { name: 'log_tail', description: 'Tail a specific log file', inputSchema: { type: 'object', properties: { source: { type: 'string', description: 'Log source name' }, lines: { type: 'number', description: 'Number of lines to retrieve' } }, required: ['source'] } },
  { name: 'log_stats', description: 'Get log file statistics', inputSchema: { type: 'object', properties: {} } },

  // === Resource Monitor (10 tools) ===
  { name: 'resource_cpu', description: 'Get CPU usage (overall and per-core)', inputSchema: { type: 'object', properties: {} } },
  { name: 'resource_memory', description: 'Get memory usage (RAM and swap)', inputSchema: { type: 'object', properties: {} } },
  { name: 'resource_disk', description: 'Get disk usage for mounted filesystems', inputSchema: { type: 'object', properties: { path: { type: 'string', description: 'Specific mount point to check' } } } },
  { name: 'resource_load', description: 'Get system load average (1, 5, 15 min)', inputSchema: { type: 'object', properties: {} } },
  { name: 'resource_overview', description: 'Get comprehensive resource overview (CPU, memory, disk, processes)', inputSchema: { type: 'object', properties: {} } },
  { name: 'resource_processes', description: 'Get process list sorted by resource', inputSchema: { type: 'object', properties: { sort: { type: 'string', enum: ['cpu', 'memory'], description: 'Sort by cpu or memory' }, limit: { type: 'number', description: 'Max processes to return (default: 10)' } } } },
  { name: 'resource_uptime', description: 'Get system uptime and boot time', inputSchema: { type: 'object', properties: {} } },
  { name: 'resource_network_stats', description: 'Get network interface statistics (RX/TX)', inputSchema: { type: 'object', properties: {} } },
  { name: 'resource_battery', description: 'Get battery status (laptops)', inputSchema: { type: 'object', properties: {} } },
  { name: 'resource_temperature', description: 'Get CPU/system temperature', inputSchema: { type: 'object', properties: {} } },

  // === Network Inspector (15 tools) ===
  { name: 'network_interfaces', description: 'List network interfaces with IP addresses', inputSchema: { type: 'object', properties: {} } },
  { name: 'network_connections', description: 'List active network connections', inputSchema: { type: 'object', properties: {} } },
  { name: 'network_listening_ports', description: 'List listening ports (TCP/UDP)', inputSchema: { type: 'object', properties: { protocol: { type: 'string', enum: ['tcp', 'udp', 'all'], description: 'Filter by protocol (default: all)' } } } },
  { name: 'network_stats', description: 'Get network statistics (RX/TX bytes, packets)', inputSchema: { type: 'object', properties: {} } },
  { name: 'network_gateway', description: 'Get default gateway information', inputSchema: { type: 'object', properties: {} } },
  { name: 'network_ping', description: 'Ping a host to check reachability', inputSchema: { type: 'object', properties: { host: { type: 'string', description: 'Hostname or IP address' }, count: { type: 'number', description: 'Number of pings (default: 4)' } }, required: ['host'] } },
  { name: 'network_bandwidth', description: 'Get current bandwidth usage (bytes/sec)', inputSchema: { type: 'object', properties: {} } },
  { name: 'network_overview', description: 'Get comprehensive network overview', inputSchema: { type: 'object', properties: {} } },
  { name: 'network_dns_lookup', description: 'DNS lookup for a hostname', inputSchema: { type: 'object', properties: { hostname: { type: 'string', description: 'Hostname to resolve' } }, required: ['hostname'] } },
  { name: 'network_port_check', description: 'Check if a port is open on a host', inputSchema: { type: 'object', properties: { host: { type: 'string', description: 'Target host' }, port: { type: 'number', description: 'Port number to check' } }, required: ['host', 'port'] } },
  { name: 'network_public_ip', description: 'Get public IP address', inputSchema: { type: 'object', properties: {} } },
  { name: 'network_wifi_info', description: 'Get WiFi connection info (macOS/Linux)', inputSchema: { type: 'object', properties: {} } },
  { name: 'network_route_table', description: 'Show routing table', inputSchema: { type: 'object', properties: {} } },
  { name: 'network_ssl_check', description: 'Check SSL certificate for a host', inputSchema: { type: 'object', properties: { host: { type: 'string', description: 'Hostname to check' }, port: { type: 'number', description: 'Port (default: 443)' } }, required: ['host'] } },
  { name: 'network_traceroute', description: 'Traceroute to a host', inputSchema: { type: 'object', properties: { host: { type: 'string', description: 'Target host' }, maxHops: { type: 'number', description: 'Max hops (default: 30)' } }, required: ['host'] } },

  // === Process Inspector (14 tools) ===
  { name: 'process_info', description: 'Get process details by PID', inputSchema: { type: 'object', properties: { pid: { type: 'number', description: 'Process ID' } }, required: ['pid'] } },
  { name: 'process_list', description: 'List all processes', inputSchema: { type: 'object', properties: { sort: { type: 'string', description: 'Sort by: cpu, memory, pid, name' }, limit: { type: 'number', description: 'Max processes to return' } } } },
  { name: 'process_search', description: 'Search processes by name or command', inputSchema: { type: 'object', properties: { query: { type: 'string', description: 'Search query (name or command)' } }, required: ['query'] } },
  { name: 'process_tree', description: 'Get process tree (parent-child relationships)', inputSchema: { type: 'object', properties: {} } },
  { name: 'process_file_descriptors', description: 'Get file descriptors for process (requires lsof)', inputSchema: { type: 'object', properties: { pid: { type: 'number', description: 'Process ID' } }, required: ['pid'] } },
  { name: 'process_environment', description: 'Get environment variables for process', inputSchema: { type: 'object', properties: { pid: { type: 'number', description: 'Process ID' } }, required: ['pid'] } },
  { name: 'process_children', description: 'Get child processes of a process', inputSchema: { type: 'object', properties: { pid: { type: 'number', description: 'Parent process ID' } }, required: ['pid'] } },
  { name: 'process_top', description: 'Get top processes by CPU/memory', inputSchema: { type: 'object', properties: { limit: { type: 'number', description: 'Number of top processes (default: 10)' } } } },
  { name: 'process_kill', description: 'Kill a process by PID (requires confirmation)', inputSchema: { type: 'object', properties: { pid: { type: 'number', description: 'Process ID to kill' }, signal: { type: 'string', enum: ['SIGTERM', 'SIGKILL', 'SIGINT'], description: 'Signal to send (default: SIGTERM)' }, confirm: { type: 'boolean', description: 'Must be true to confirm kill' } }, required: ['pid', 'confirm'] } },
  { name: 'process_ports', description: 'Get ports used by a process', inputSchema: { type: 'object', properties: { pid: { type: 'number', description: 'Process ID' } }, required: ['pid'] } },
  { name: 'process_cpu_history', description: 'Get CPU usage history for process', inputSchema: { type: 'object', properties: { pid: { type: 'number', description: 'Process ID' } }, required: ['pid'] } },
  { name: 'process_memory_detail', description: 'Get detailed memory info for process', inputSchema: { type: 'object', properties: { pid: { type: 'number', description: 'Process ID' } }, required: ['pid'] } },
  { name: 'process_threads', description: 'List threads for a process', inputSchema: { type: 'object', properties: { pid: { type: 'number', description: 'Process ID' } }, required: ['pid'] } },
  { name: 'process_io_stats', description: 'Get I/O statistics for a process (Linux)', inputSchema: { type: 'object', properties: { pid: { type: 'number', description: 'Process ID' } }, required: ['pid'] } },

  // === File Watcher (10 tools) ===
  { name: 'file_stats', description: 'Get file/directory stats (size, modified, permissions)', inputSchema: { type: 'object', properties: { path: { type: 'string', description: 'File or directory path' } }, required: ['path'] } },
  { name: 'file_recent_changes', description: 'Get recently changed files', inputSchema: { type: 'object', properties: { directory: { type: 'string', description: 'Directory to search' }, minutes: { type: 'number', description: 'Only files changed in last N minutes' }, limit: { type: 'number', description: 'Max files to return' }, pattern: { type: 'string', description: 'Glob pattern to filter (e.g., *.ts)' } } } },
  { name: 'file_search', description: 'Search files by glob pattern', inputSchema: { type: 'object', properties: { pattern: { type: 'string', description: 'Glob pattern (e.g., **/*.json)' }, directory: { type: 'string', description: 'Directory to search in' } }, required: ['pattern'] } },
  { name: 'file_tree', description: 'Get directory tree structure', inputSchema: { type: 'object', properties: { directory: { type: 'string', description: 'Root directory' }, depth: { type: 'number', description: 'Max depth (default: 3)' } } } },
  { name: 'file_compare', description: 'Compare two files (size, modified, content)', inputSchema: { type: 'object', properties: { path1: { type: 'string', description: 'First file path' }, path2: { type: 'string', description: 'Second file path' } }, required: ['path1', 'path2'] } },
  { name: 'file_changes_since', description: 'Get files changed since timestamp', inputSchema: { type: 'object', properties: { since: { type: 'string', description: 'ISO timestamp (e.g., 2025-01-01T00:00:00Z)' }, directory: { type: 'string', description: 'Directory to search' }, pattern: { type: 'string', description: 'Glob pattern to filter' } }, required: ['since'] } },
  { name: 'file_read', description: 'Read file contents (text, max 100KB)', inputSchema: { type: 'object', properties: { path: { type: 'string', description: 'File path to read' }, encoding: { type: 'string', description: 'Encoding (default: utf-8)' }, maxLines: { type: 'number', description: 'Max lines to read' } }, required: ['path'] } },
  { name: 'file_checksum', description: 'Calculate file checksum', inputSchema: { type: 'object', properties: { path: { type: 'string', description: 'File path' }, algorithm: { type: 'string', enum: ['md5', 'sha256', 'sha512'], description: 'Hash algorithm (default: sha256)' } }, required: ['path'] } },
  { name: 'file_size_summary', description: 'Get directory size summary', inputSchema: { type: 'object', properties: { directory: { type: 'string', description: 'Directory to analyze' } } } },
  { name: 'file_duplicates', description: 'Find duplicate files by checksum', inputSchema: { type: 'object', properties: { directory: { type: 'string', description: 'Directory to search' }, pattern: { type: 'string', description: 'Glob pattern to filter' } } } },

  // === Claude Code Monitor (8 tools) ===
  { name: 'claude_config', description: 'Get Claude Desktop configuration (MCP servers, preferences)', inputSchema: { type: 'object', properties: {} } },
  { name: 'claude_mcp_status', description: 'Get MCP server connection status', inputSchema: { type: 'object', properties: {} } },
  { name: 'claude_session_info', description: 'Get Claude Code session info (processes, CPU, memory)', inputSchema: { type: 'object', properties: {} } },
  { name: 'claude_logs', description: 'Get recent Claude Code logs', inputSchema: { type: 'object', properties: { lines: { type: 'number', description: 'Number of lines (default: 50)' } } } },
  { name: 'claude_log_search', description: 'Search Claude Code logs', inputSchema: { type: 'object', properties: { query: { type: 'string', description: 'Search query' } }, required: ['query'] } },
  { name: 'claude_log_files', description: 'List all Claude Code log files', inputSchema: { type: 'object', properties: {} } },
  { name: 'claude_background_shells', description: 'Get info about background shell processes', inputSchema: { type: 'object', properties: {} } },
  { name: 'claude_status', description: 'Get comprehensive Claude status (config, MCP, session, logs)', inputSchema: { type: 'object', properties: {} } },

  // === GitHub Integration (21 tools) ===
  { name: 'github_list_issues', description: 'List GitHub issues', inputSchema: { type: 'object', properties: { state: { type: 'string', enum: ['open', 'closed', 'all'], description: 'Issue state filter (default: open)' }, labels: { type: 'string', description: 'Comma-separated label names to filter' }, per_page: { type: 'number', description: 'Results per page (max 100)' } } } },
  { name: 'github_get_issue', description: 'Get issue details', inputSchema: { type: 'object', properties: { issue_number: { type: 'number', description: 'Issue number' } }, required: ['issue_number'] } },
  { name: 'github_create_issue', description: 'Create new GitHub issue with title, body, and labels', inputSchema: { type: 'object', properties: { title: { type: 'string', description: 'Issue title' }, body: { type: 'string', description: 'Issue body (markdown supported)' }, labels: { type: 'array', items: { type: 'string' }, description: 'Array of label names' } }, required: ['title'] } },
  { name: 'github_update_issue', description: 'Update issue', inputSchema: { type: 'object', properties: { issue_number: { type: 'number', description: 'Issue number to update' }, title: { type: 'string', description: 'New title' }, body: { type: 'string', description: 'New body' }, state: { type: 'string', description: 'New state (open/closed)' } }, required: ['issue_number'] } },
  { name: 'github_add_comment', description: 'Add comment to issue/PR', inputSchema: { type: 'object', properties: { issue_number: { type: 'number', description: 'Issue or PR number' }, body: { type: 'string', description: 'Comment body (markdown supported)' } }, required: ['issue_number', 'body'] } },
  { name: 'github_list_prs', description: 'List pull requests', inputSchema: { type: 'object', properties: { state: { type: 'string', enum: ['open', 'closed', 'all'], description: 'PR state filter' }, per_page: { type: 'number', description: 'Results per page' } } } },
  { name: 'github_get_pr', description: 'Get PR details', inputSchema: { type: 'object', properties: { pull_number: { type: 'number', description: 'Pull request number' } }, required: ['pull_number'] } },
  { name: 'github_create_pr', description: 'Create pull request', inputSchema: { type: 'object', properties: { title: { type: 'string', description: 'PR title' }, head: { type: 'string', description: 'Source branch' }, base: { type: 'string', description: 'Target branch (default: main)' }, body: { type: 'string', description: 'PR description' } }, required: ['title', 'head'] } },
  { name: 'github_merge_pr', description: 'Merge pull request', inputSchema: { type: 'object', properties: { pull_number: { type: 'number' }, merge_method: { type: 'string', enum: ['merge', 'squash', 'rebase'] } }, required: ['pull_number'] } },
  { name: 'github_list_labels', description: 'List repository labels', inputSchema: { type: 'object', properties: {} } },
  { name: 'github_add_labels', description: 'Add labels to issue/PR', inputSchema: { type: 'object', properties: { issue_number: { type: 'number' }, labels: { type: 'array', items: { type: 'string' } } }, required: ['issue_number', 'labels'] } },
  { name: 'github_list_milestones', description: 'List milestones', inputSchema: { type: 'object', properties: { state: { type: 'string', enum: ['open', 'closed', 'all'] } } } },
  { name: 'github_list_workflows', description: 'List GitHub Actions workflows', inputSchema: { type: 'object', properties: { per_page: { type: 'number' } } } },
  { name: 'github_list_workflow_runs', description: 'List workflow runs', inputSchema: { type: 'object', properties: { workflow_id: { type: 'string' }, status: { type: 'string', enum: ['queued', 'in_progress', 'completed'] }, per_page: { type: 'number' } } } },
  { name: 'github_repo_info', description: 'Get repository information', inputSchema: { type: 'object', properties: {} } },
  { name: 'github_list_releases', description: 'List releases', inputSchema: { type: 'object', properties: { per_page: { type: 'number' } } } },
  { name: 'github_list_branches', description: 'List branches with protection status', inputSchema: { type: 'object', properties: { per_page: { type: 'number' } } } },
  { name: 'github_compare_commits', description: 'Compare two commits/branches', inputSchema: { type: 'object', properties: { base: { type: 'string' }, head: { type: 'string' } }, required: ['base', 'head'] } },
  { name: 'github_list_pr_reviews', description: 'List reviews for a pull request', inputSchema: { type: 'object', properties: { pull_number: { type: 'number' } }, required: ['pull_number'] } },
  { name: 'github_create_review', description: 'Create a review for a pull request', inputSchema: { type: 'object', properties: { pull_number: { type: 'number' }, body: { type: 'string' }, event: { type: 'string', enum: ['APPROVE', 'REQUEST_CHANGES', 'COMMENT'] }, comments: { type: 'array', items: { type: 'object' } } }, required: ['pull_number'] } },
  { name: 'github_submit_review', description: 'Submit a pending review', inputSchema: { type: 'object', properties: { pull_number: { type: 'number' }, review_id: { type: 'number' }, body: { type: 'string' }, event: { type: 'string', enum: ['APPROVE', 'REQUEST_CHANGES', 'COMMENT'] } }, required: ['pull_number', 'review_id', 'event'] } },

  // === System Health (1 tool) ===
  { name: 'health_check', description: 'Comprehensive system health check', inputSchema: { type: 'object', properties: {} } },

  // === Linux systemd (3 tools) ===
  { name: 'linux_systemd_units', description: 'List systemd units (Linux only)', inputSchema: { type: 'object', properties: { type: { type: 'string', enum: ['service', 'timer', 'socket', 'mount', 'target'], description: 'Filter by unit type' }, state: { type: 'string', enum: ['running', 'failed', 'inactive'], description: 'Filter by state' } } } },
  { name: 'linux_systemd_status', description: 'Get status of a systemd unit (Linux only)', inputSchema: { type: 'object', properties: { unit: { type: 'string', description: 'Unit name (e.g., nginx.service)' } }, required: ['unit'] } },
  { name: 'linux_journal_search', description: 'Search systemd journal (Linux only)', inputSchema: { type: 'object', properties: { unit: { type: 'string', description: 'Filter by unit name' }, priority: { type: 'string', enum: ['emerg', 'alert', 'crit', 'err', 'warning', 'notice', 'info', 'debug'], description: 'Filter by priority level' }, since: { type: 'string', description: 'Show entries since (e.g., 1h ago, today)' }, lines: { type: 'number', description: 'Number of lines to show' } } } },

  // === Windows (2 tools) ===
  { name: 'windows_service_status', description: 'Get Windows service status (Windows only)', inputSchema: { type: 'object', properties: { service: { type: 'string', description: 'Service name' } } } },
  { name: 'windows_eventlog_search', description: 'Search Windows Event Log (Windows only)', inputSchema: { type: 'object', properties: { log: { type: 'string', enum: ['Application', 'System', 'Security'], description: 'Event log name' }, level: { type: 'string', enum: ['Error', 'Warning', 'Information'], description: 'Event level' }, source: { type: 'string', description: 'Event source name' }, maxEvents: { type: 'number', description: 'Max events to return' } } } },

  // === Docker (10 tools) ===
  { name: 'docker_ps', description: 'List Docker containers', inputSchema: { type: 'object', properties: { all: { type: 'boolean', description: 'Show all containers (default shows running)' }, limit: { type: 'number', description: 'Limit output' } } } },
  { name: 'docker_images', description: 'List Docker images', inputSchema: { type: 'object', properties: { all: { type: 'boolean', description: 'Show all images (default: only tagged)' }, dangling: { type: 'boolean', description: 'Show only dangling images' } } } },
  { name: 'docker_logs', description: 'Get container logs', inputSchema: { type: 'object', properties: { container: { type: 'string', description: 'Container name or ID' }, tail: { type: 'number', description: 'Number of lines from end (e.g., 100)' }, since: { type: 'string', description: 'Show logs since (e.g., 10m, 1h, 2024-01-01)' }, timestamps: { type: 'boolean', description: 'Show timestamps' } }, required: ['container'] } },
  { name: 'docker_inspect', description: 'Get container or image details', inputSchema: { type: 'object', properties: { target: { type: 'string', description: 'Container/image name or ID' }, type: { type: 'string', enum: ['container', 'image'], description: 'Target type' } }, required: ['target'] } },
  { name: 'docker_stats', description: 'Get container resource usage', inputSchema: { type: 'object', properties: { container: { type: 'string', description: 'Container name/id (optional, all if omitted)' }, noStream: { type: 'boolean' } } } },
  { name: 'docker_exec', description: 'Execute command in container (read-only recommended)', inputSchema: { type: 'object', properties: { container: { type: 'string' }, command: { type: 'string' }, user: { type: 'string' } }, required: ['container', 'command'] } },
  { name: 'docker_start', description: 'Start a stopped container', inputSchema: { type: 'object', properties: { container: { type: 'string' } }, required: ['container'] } },
  { name: 'docker_stop', description: 'Stop a running container', inputSchema: { type: 'object', properties: { container: { type: 'string' }, timeout: { type: 'number' } }, required: ['container'] } },
  { name: 'docker_restart', description: 'Restart a container', inputSchema: { type: 'object', properties: { container: { type: 'string' }, timeout: { type: 'number' } }, required: ['container'] } },
  { name: 'docker_build', description: 'Build Docker image from Dockerfile', inputSchema: { type: 'object', properties: { path: { type: 'string' }, tag: { type: 'string' }, dockerfile: { type: 'string' }, noCache: { type: 'boolean' } } } },

  // === Docker Compose (4 tools) ===
  { name: 'compose_ps', description: 'List Compose services', inputSchema: { type: 'object', properties: { path: { type: 'string', description: 'Path to docker-compose.yml' }, all: { type: 'boolean', description: 'Show all services' } } } },
  { name: 'compose_up', description: 'Start Compose services', inputSchema: { type: 'object', properties: { path: { type: 'string', description: 'Path to docker-compose.yml' }, services: { type: 'array', items: { type: 'string' }, description: 'Specific services to start' }, detach: { type: 'boolean', description: 'Run in background' }, build: { type: 'boolean', description: 'Build images before starting' } } } },
  { name: 'compose_down', description: 'Stop Compose services', inputSchema: { type: 'object', properties: { path: { type: 'string', description: 'Path to docker-compose.yml' }, volumes: { type: 'boolean', description: 'Remove volumes' }, removeOrphans: { type: 'boolean', description: 'Remove orphan containers' } } } },
  { name: 'compose_logs', description: 'Get Compose service logs', inputSchema: { type: 'object', properties: { path: { type: 'string', description: 'Path to docker-compose.yml' }, services: { type: 'array', items: { type: 'string' }, description: 'Specific services' }, tail: { type: 'number', description: 'Number of lines from end' }, timestamps: { type: 'boolean', description: 'Show timestamps' } } } },

  // === Kubernetes (6 tools) ===
  { name: 'k8s_get_pods', description: 'List Kubernetes pods', inputSchema: { type: 'object', properties: { namespace: { type: 'string', description: 'Namespace (default: default)' }, allNamespaces: { type: 'boolean', description: 'List across all namespaces' }, selector: { type: 'string', description: 'Label selector (e.g., app=nginx)' } } } },
  { name: 'k8s_get_deployments', description: 'List Kubernetes deployments', inputSchema: { type: 'object', properties: { namespace: { type: 'string', description: 'Namespace (default: default)' }, allNamespaces: { type: 'boolean', description: 'List across all namespaces' } } } },
  { name: 'k8s_logs', description: 'Get pod logs', inputSchema: { type: 'object', properties: { pod: { type: 'string', description: 'Pod name' }, namespace: { type: 'string', description: 'Namespace' }, container: { type: 'string', description: 'Container name (for multi-container pods)' }, tail: { type: 'number', description: 'Lines from end' }, since: { type: 'string', description: 'Show logs since (e.g., 1h, 30m)' } }, required: ['pod'] } },
  { name: 'k8s_describe', description: 'Describe Kubernetes resource', inputSchema: { type: 'object', properties: { resource: { type: 'string', enum: ['pod', 'deployment', 'service', 'configmap', 'secret', 'node'], description: 'Resource type' }, name: { type: 'string', description: 'Resource name' }, namespace: { type: 'string', description: 'Namespace' } }, required: ['resource', 'name'] } },
  { name: 'k8s_apply', description: 'Apply Kubernetes manifest (use with caution)', inputSchema: { type: 'object', properties: { file: { type: 'string', description: 'Path to YAML manifest' }, namespace: { type: 'string', description: 'Namespace' }, dryRun: { type: 'boolean', description: 'Dry run only (no changes)' } }, required: ['file'] } },
  { name: 'k8s_delete', description: 'Delete Kubernetes resource (use with caution)', inputSchema: { type: 'object', properties: { resource: { type: 'string', description: 'Resource type (e.g., pod, deployment)' }, name: { type: 'string', description: 'Resource name' }, namespace: { type: 'string', description: 'Namespace' }, dryRun: { type: 'boolean', description: 'Dry run only' } }, required: ['resource', 'name'] } },

  // === Spec-Kit (9 tools) - Spec-Driven Development ===
  { name: 'speckit_init', description: 'Initialize Spec-Kit in project (creates .speckit/ directory)', inputSchema: { type: 'object', properties: { path: { type: 'string', description: 'Project path (default: current)' } } } },
  { name: 'speckit_status', description: 'Get Spec-Kit project status', inputSchema: { type: 'object', properties: { path: { type: 'string' } } } },
  { name: 'speckit_constitution', description: 'Read or update project constitution (principles)', inputSchema: { type: 'object', properties: { path: { type: 'string' }, content: { type: 'string', description: 'New constitution content (omit to read)' } } } },
  { name: 'speckit_specify', description: 'Create feature specification from description', inputSchema: { type: 'object', properties: { feature: { type: 'string', description: 'Feature description' }, path: { type: 'string' } }, required: ['feature'] } },
  { name: 'speckit_plan', description: 'Generate implementation plan for a feature', inputSchema: { type: 'object', properties: { feature: { type: 'string', description: 'Feature name/id' }, path: { type: 'string' } }, required: ['feature'] } },
  { name: 'speckit_tasks', description: 'Generate task list from plan', inputSchema: { type: 'object', properties: { feature: { type: 'string' }, path: { type: 'string' } }, required: ['feature'] } },
  { name: 'speckit_checklist', description: 'Create implementation checklist', inputSchema: { type: 'object', properties: { feature: { type: 'string' }, path: { type: 'string' } }, required: ['feature'] } },
  { name: 'speckit_analyze', description: 'Analyze project for consistency', inputSchema: { type: 'object', properties: { path: { type: 'string' } } } },
  { name: 'speckit_list_features', description: 'List all features in project', inputSchema: { type: 'object', properties: { path: { type: 'string' } } } },

  // === MCP Tool Discovery (3 tools) ===
  { name: 'mcp_search_tools', description: 'Search MCP tools by name or description', inputSchema: { type: 'object', properties: { query: { type: 'string', description: 'Search query (matches name or description)' }, category: { type: 'string', description: 'Filter by category prefix (git, tmux, docker, etc)' } } } },
  { name: 'mcp_list_categories', description: 'List all tool categories with counts', inputSchema: { type: 'object', properties: {} } },
  { name: 'mcp_get_tool_info', description: 'Get detailed information about a specific tool', inputSchema: { type: 'object', properties: { tool: { type: 'string', description: 'Tool name' } }, required: ['tool'] } },

  // === Database Foundation (6 tools) ===
  { name: 'db_connect', description: 'Test database connection', inputSchema: { type: 'object', properties: { type: { type: 'string', enum: ['sqlite', 'postgresql', 'mysql'], description: 'Database type' }, connection: { type: 'string', description: 'Connection string or file path (SQLite)' }, host: { type: 'string' }, port: { type: 'number' }, database: { type: 'string' }, user: { type: 'string' }, password: { type: 'string' } }, required: ['type'] } },
  { name: 'db_tables', description: 'List all tables in database', inputSchema: { type: 'object', properties: { type: { type: 'string', enum: ['sqlite', 'postgresql', 'mysql'] }, connection: { type: 'string' }, host: { type: 'string' }, port: { type: 'number' }, database: { type: 'string' }, user: { type: 'string' }, password: { type: 'string' } }, required: ['type'] } },
  { name: 'db_schema', description: 'Get schema for a table', inputSchema: { type: 'object', properties: { type: { type: 'string', enum: ['sqlite', 'postgresql', 'mysql'] }, table: { type: 'string', description: 'Table name' }, connection: { type: 'string' }, host: { type: 'string' }, port: { type: 'number' }, database: { type: 'string' }, user: { type: 'string' }, password: { type: 'string' } }, required: ['type', 'table'] } },
  { name: 'db_query', description: 'Execute read-only SQL query (SELECT only)', inputSchema: { type: 'object', properties: { type: { type: 'string', enum: ['sqlite', 'postgresql', 'mysql'] }, query: { type: 'string', description: 'SQL SELECT query' }, connection: { type: 'string' }, host: { type: 'string' }, port: { type: 'number' }, database: { type: 'string' }, user: { type: 'string' }, password: { type: 'string' }, limit: { type: 'number', description: 'Max rows (default 100)' } }, required: ['type', 'query'] } },
  { name: 'db_explain', description: 'Explain query execution plan', inputSchema: { type: 'object', properties: { type: { type: 'string', enum: ['sqlite', 'postgresql', 'mysql'] }, query: { type: 'string', description: 'SQL query to analyze' }, connection: { type: 'string' }, host: { type: 'string' }, port: { type: 'number' }, database: { type: 'string' }, user: { type: 'string' }, password: { type: 'string' } }, required: ['type', 'query'] } },
  { name: 'db_health', description: 'Check database health and stats', inputSchema: { type: 'object', properties: { type: { type: 'string', enum: ['sqlite', 'postgresql', 'mysql'] }, connection: { type: 'string' }, host: { type: 'string' }, port: { type: 'number' }, database: { type: 'string' }, user: { type: 'string' }, password: { type: 'string' } }, required: ['type'] } },

  // === Time Tools (4 tools) ===
  { name: 'time_current', description: 'Get current time in specified timezone', inputSchema: { type: 'object', properties: { timezone: { type: 'string', description: 'Timezone (e.g., Asia/Tokyo, America/New_York, UTC)' }, format: { type: 'string', enum: ['iso', 'unix', 'human'], description: 'Output format' } } } },
  { name: 'time_convert', description: 'Convert time between timezones', inputSchema: { type: 'object', properties: { time: { type: 'string', description: 'Time to convert (ISO8601 or unix timestamp)' }, from: { type: 'string', description: 'Source timezone' }, to: { type: 'string', description: 'Target timezone' } }, required: ['time', 'to'] } },
  { name: 'time_format', description: 'Format datetime string', inputSchema: { type: 'object', properties: { time: { type: 'string', description: 'Time to format' }, format: { type: 'string', description: 'Format string (e.g., YYYY-MM-DD HH:mm:ss)' }, timezone: { type: 'string' } }, required: ['time', 'format'] } },
  { name: 'time_diff', description: 'Calculate difference between two times', inputSchema: { type: 'object', properties: { start: { type: 'string', description: 'Start time' }, end: { type: 'string', description: 'End time (default: now)' }, unit: { type: 'string', enum: ['seconds', 'minutes', 'hours', 'days', 'weeks'], description: 'Output unit' } }, required: ['start'] } },

  // === Calculator Tools (3 tools) ===
  { name: 'calc_expression', description: 'Evaluate mathematical expression safely', inputSchema: { type: 'object', properties: { expression: { type: 'string', description: 'Math expression (e.g., 2+2, sqrt(16), sin(PI/2))' }, precision: { type: 'number', description: 'Decimal precision (default: 10)' } }, required: ['expression'] } },
  { name: 'calc_unit_convert', description: 'Convert between units', inputSchema: { type: 'object', properties: { value: { type: 'number', description: 'Value to convert' }, from: { type: 'string', description: 'Source unit (e.g., km, miles, kg, lb, celsius, fahrenheit)' }, to: { type: 'string', description: 'Target unit' } }, required: ['value', 'from', 'to'] } },
  { name: 'calc_statistics', description: 'Calculate statistics for a dataset', inputSchema: { type: 'object', properties: { data: { type: 'array', items: { type: 'number' }, description: 'Array of numbers' }, metrics: { type: 'array', items: { type: 'string', enum: ['mean', 'median', 'mode', 'stddev', 'variance', 'min', 'max', 'sum', 'count'] }, description: 'Metrics to calculate' } }, required: ['data'] } },

  // === Sequential Thinking Tools (3 tools) ===
  { name: 'think_step', description: 'Record a thinking step in sequential reasoning', inputSchema: { type: 'object', properties: { thought: { type: 'string', description: 'The thought content' }, type: { type: 'string', enum: ['observation', 'hypothesis', 'analysis', 'conclusion', 'question'], description: 'Type of thought' }, confidence: { type: 'number', description: 'Confidence level 0-1' }, sessionId: { type: 'string', description: 'Session ID to continue previous chain' } }, required: ['thought'] } },
  { name: 'think_branch', description: 'Create a branch in thinking process for exploring alternatives', inputSchema: { type: 'object', properties: { sessionId: { type: 'string', description: 'Session ID' }, branchName: { type: 'string', description: 'Name for this branch' }, fromStep: { type: 'number', description: 'Step number to branch from' } }, required: ['sessionId', 'branchName'] } },
  { name: 'think_summarize', description: 'Summarize a thinking session', inputSchema: { type: 'object', properties: { sessionId: { type: 'string', description: 'Session ID to summarize' }, includeAlternatives: { type: 'boolean', description: 'Include alternative branches' } }, required: ['sessionId'] } },

  // === Generator Tools (4 tools) ===
  { name: 'gen_uuid', description: 'Generate UUID', inputSchema: { type: 'object', properties: { version: { type: 'number', enum: [1, 4], description: 'UUID version (default: 4)' }, count: { type: 'number', description: 'Number of UUIDs to generate (max 100)' } } } },
  { name: 'gen_random', description: 'Generate random numbers', inputSchema: { type: 'object', properties: { min: { type: 'number', description: 'Minimum value (default: 0)' }, max: { type: 'number', description: 'Maximum value (default: 100)' }, count: { type: 'number', description: 'Number of values (max 1000)' }, type: { type: 'string', enum: ['integer', 'float'], description: 'Number type' } }, required: [] } },
  { name: 'gen_hash', description: 'Generate hash of input', inputSchema: { type: 'object', properties: { input: { type: 'string', description: 'String to hash' }, algorithm: { type: 'string', enum: ['md5', 'sha1', 'sha256', 'sha512'], description: 'Hash algorithm (default: sha256)' }, encoding: { type: 'string', enum: ['hex', 'base64'], description: 'Output encoding' } }, required: ['input'] } },
  { name: 'gen_password', description: 'Generate secure password', inputSchema: { type: 'object', properties: { length: { type: 'number', description: 'Password length (8-128, default: 16)' }, uppercase: { type: 'boolean', description: 'Include uppercase letters' }, lowercase: { type: 'boolean', description: 'Include lowercase letters' }, numbers: { type: 'boolean', description: 'Include numbers' }, symbols: { type: 'boolean', description: 'Include symbols' }, excludeSimilar: { type: 'boolean', description: 'Exclude similar characters (0O1lI)' } } } },
];

// ========== Tool Handlers ==========
async function handleTool(name: string, args: Record<string, unknown>): Promise<unknown> {
  try {
    // Git Inspector
    if (name === 'git_status') {
      return await git.status();
    }
    if (name === 'git_branch_list') {
      return await git.branch(['-a', '-v']);
    }
    if (name === 'git_current_branch') {
      const branch = await git.revparse(['--abbrev-ref', 'HEAD']);
      return { branch: branch.trim() };
    }
    if (name === 'git_log') {
      const limit = Math.min(Math.max((args.limit as number) || 20, 1), 100);
      return await git.log({ maxCount: limit });
    }
    if (name === 'git_worktree_list') {
      const { stdout } = await execAsync('git worktree list --porcelain', { cwd: MIYABI_REPO_PATH });
      return { worktrees: stdout };
    }
    if (name === 'git_diff') {
      const file = args.file as string | undefined;
      const diff = file ? await git.diff([sanitizeShellArg(file)]) : await git.diff();
      return { diff };
    }
    if (name === 'git_staged_diff') {
      return { diff: await git.diff(['--staged']) };
    }
    if (name === 'git_remote_list') {
      return { remotes: await git.getRemotes(true) };
    }
    if (name === 'git_branch_ahead_behind') {
      const branch = sanitizeShellArg((args.branch as string) || 'HEAD');
      try {
        const { stdout } = await execAsync(`git rev-list --left-right --count origin/${branch}...${branch}`, { cwd: MIYABI_REPO_PATH });
        const [behind, ahead] = stdout.trim().split('\t').map(Number);
        return { ahead, behind };
      } catch {
        return { error: 'Could not determine ahead/behind count' };
      }
    }
    if (name === 'git_file_history') {
      const file = sanitizeShellArg(args.file as string);
      const limit = Math.min(Math.max((args.limit as number) || 10, 1), 50);
      return await git.log({ file, maxCount: limit });
    }
    if (name === 'git_stash_list') {
      const stashList = await git.stashList();
      return { stashes: stashList.all };
    }
    if (name === 'git_blame') {
      const file = sanitizeShellArg(args.file as string);
      const startLine = args.startLine as number | undefined;
      const endLine = args.endLine as number | undefined;
      let cmd = `git blame --line-porcelain "${file}"`;
      if (startLine && endLine && startLine > 0 && endLine >= startLine) {
        cmd = `git blame --line-porcelain -L ${startLine},${endLine} "${file}"`;
      }
      const { stdout } = await execAsync(cmd, { cwd: MIYABI_REPO_PATH });
      return { blame: stdout };
    }
    if (name === 'git_show') {
      const commit = sanitizeShellArg((args.commit as string) || 'HEAD');
      const { stdout } = await execAsync(`git show --stat "${commit}"`, { cwd: MIYABI_REPO_PATH });
      return { show: stdout };
    }
    if (name === 'git_tag_list') {
      const tags = await git.tags();
      return { tags: tags.all };
    }
    if (name === 'git_contributors') {
      const limit = Math.min(Math.max((args.limit as number) || 10, 1), 50);
      const { stdout } = await execAsync(`git shortlog -sn --no-merges HEAD | head -${limit}`, { cwd: MIYABI_REPO_PATH });
      return { contributors: stdout.trim().split('\n').filter(Boolean) };
    }
    if (name === 'git_conflicts') {
      try {
        const { stdout } = await execAsync('git diff --name-only --diff-filter=U', { cwd: MIYABI_REPO_PATH });
        const conflicts = stdout.trim().split('\n').filter(Boolean);
        return { hasConflicts: conflicts.length > 0, files: conflicts };
      } catch {
        return { hasConflicts: false, files: [] };
      }
    }
    if (name === 'git_submodule_status') {
      try {
        const { stdout } = await execAsync('git submodule status --recursive', { cwd: MIYABI_REPO_PATH });
        const lines = stdout.trim().split('\n').filter(Boolean);
        const submodules = lines.map(line => {
          const match = line.match(/^([+-U ]?)([a-f0-9]+)\s+(\S+)(?:\s+\((.+)\))?/);
          if (match) {
            return {
              status: match[1] === '+' ? 'modified' : match[1] === '-' ? 'uninitialized' : match[1] === 'U' ? 'conflict' : 'ok',
              commit: match[2],
              path: match[3],
              describe: match[4] || null
            };
          }
          return { raw: line };
        });
        return { submodules };
      } catch {
        return { submodules: [], message: 'No submodules or git submodule not available' };
      }
    }
    if (name === 'git_lfs_status') {
      const hasLfs = await commandExists('git-lfs');
      if (!hasLfs) {
        return { error: 'git-lfs is not installed', installed: false };
      }
      try {
        const { stdout: statusOut } = await execAsync('git lfs status', { cwd: MIYABI_REPO_PATH });
        const { stdout: envOut } = await execAsync('git lfs env', { cwd: MIYABI_REPO_PATH });
        return { installed: true, status: statusOut.trim(), env: envOut.trim() };
      } catch (error) {
        return { installed: true, error: error instanceof Error ? error.message : String(error) };
      }
    }
    if (name === 'git_hooks_list') {
      const hooksDir = join(MIYABI_REPO_PATH, '.git', 'hooks');
      try {
        const files = await readdir(hooksDir);
        const hooks = files
          .filter(f => !f.endsWith('.sample'))
          .map(async (f) => {
            const hookPath = join(hooksDir, f);
            const hookStat = await stat(hookPath);
            return {
              name: f,
              executable: (hookStat.mode & 0o111) !== 0,
              size: hookStat.size
            };
          });
        return { hooks: await Promise.all(hooks) };
      } catch {
        return { hooks: [], message: 'No hooks directory or not a git repository' };
      }
    }

    // Category handlers
    if (name.startsWith('tmux_')) return await handleTmuxTool(name, args);
    if (name.startsWith('log_')) return await handleLogTool(name, args);
    if (name.startsWith('resource_')) return await handleResourceTool(name, args);
    if (name.startsWith('network_')) return await handleNetworkTool(name, args);
    if (name.startsWith('process_')) return await handleProcessTool(name, args);
    if (name.startsWith('file_')) return await handleFileTool(name, args);
    if (name.startsWith('claude_')) return await handleClaudeTool(name, args);
    if (name.startsWith('github_')) return await handleGitHubTool(name, args);
    if (name === 'health_check') return await handleHealthCheck();
    if (name.startsWith('linux_')) return await handleLinuxTool(name, args);
    if (name.startsWith('windows_')) return await handleWindowsTool(name, args);
    if (name.startsWith('docker_')) return await handleDockerTool(name, args);
    if (name.startsWith('compose_')) return await handleComposeTool(name, args);
    if (name.startsWith('k8s_')) return await handleK8sTool(name, args);
    if (name.startsWith('speckit_')) return await handleSpeckitTool(name, args);
    if (name.startsWith('mcp_')) return await handleMcpTool(name, args);
    if (name.startsWith('db_')) return await handleDbTool(name, args);
    if (name.startsWith('time_')) return await handleTimeTool(name, args);
    if (name.startsWith('calc_')) return await handleCalcTool(name, args);
    if (name.startsWith('think_')) return await handleThinkTool(name, args);
    if (name.startsWith('gen_')) return await handleGenTool(name, args);

    return { error: `Unknown tool: ${name}` };
  } catch (error) {
    return { error: error instanceof Error ? error.message : String(error) };
  }
}

// ========== Category Handlers ==========
async function handleTmuxTool(name: string, args: Record<string, unknown>): Promise<unknown> {
  const hasTmux = await commandExists('tmux');
  if (!hasTmux) {
    return { error: 'tmux is not installed' };
  }

  const target = sanitizeShellArg((args.target as string) || '');
  const session = sanitizeShellArg((args.session as string) || '');

  if (name === 'tmux_list_sessions') {
    try {
      const { stdout } = await execAsync('tmux list-sessions -F "#{session_name}:#{session_windows}:#{session_attached}:#{session_created}"');
      return { sessions: stdout.trim().split('\n').filter(Boolean) };
    } catch {
      return { sessions: [], message: 'No tmux sessions' };
    }
  }
  if (name === 'tmux_list_windows') {
    const cmd = session ? `tmux list-windows -t "${session}" -F "#{window_index}:#{window_name}:#{window_active}"` : 'tmux list-windows -F "#{window_index}:#{window_name}:#{window_active}"';
    const { stdout } = await execAsync(cmd);
    return { windows: stdout.trim().split('\n').filter(Boolean) };
  }
  if (name === 'tmux_list_panes') {
    const cmd = session
      ? `tmux list-panes -t "${session}" -F "#{pane_id}:#{pane_current_command}:#{pane_pid}:#{pane_active}"`
      : 'tmux list-panes -a -F "#{session_name}:#{pane_id}:#{pane_current_command}:#{pane_active}"';
    const { stdout } = await execAsync(cmd);
    return { panes: stdout.trim().split('\n').filter(Boolean) };
  }
  if (name === 'tmux_send_keys') {
    const keys = sanitizeShellArg(args.keys as string);
    if (!target) return { error: 'Target pane required' };
    await execAsync(`tmux send-keys -t "${target}" "${keys}" Enter`);
    return { success: true };
  }
  if (name === 'tmux_pane_capture') {
    const lines = Math.min(Math.max((args.lines as number) || 100, 1), 10000);
    const { stdout } = await execAsync(`tmux capture-pane -t "${target}" -p -S -${lines}`);
    return { content: stdout };
  }
  if (name === 'tmux_pane_search') {
    const pattern = sanitizeShellArg(args.pattern as string);
    const { stdout } = await execAsync(`tmux capture-pane -t "${target}" -p | grep -i "${pattern}" || true`);
    return { matches: stdout.trim().split('\n').filter(Boolean) };
  }
  if (name === 'tmux_pane_tail') {
    const lines = Math.min(Math.max((args.lines as number) || 20, 1), 1000);
    const { stdout } = await execAsync(`tmux capture-pane -t "${target}" -p | tail -n ${lines}`);
    return { content: stdout };
  }
  if (name === 'tmux_pane_is_busy') {
    const { stdout } = await execAsync(`tmux display-message -t "${target}" -p "#{pane_current_command}"`);
    const cmd = stdout.trim();
    return { busy: !['bash', 'zsh', 'fish', 'sh', 'dash'].includes(cmd), command: cmd };
  }
  if (name === 'tmux_pane_current_command') {
    const { stdout } = await execAsync(`tmux display-message -t "${target}" -p "#{pane_current_command}"`);
    return { command: stdout.trim() };
  }
  if (name === 'tmux_session_info') {
    if (!session) return { error: 'Session name required' };
    const { stdout } = await execAsync(`tmux display-message -t "${session}" -p "name:#{session_name},windows:#{session_windows},attached:#{session_attached},created:#{session_created}"`);
    return { info: stdout.trim() };
  }
  return { error: `Unknown tmux tool: ${name}` };
}

async function handleLogTool(name: string, args: Record<string, unknown>): Promise<unknown> {
  if (name === 'log_sources') {
    const files = await glob('**/*.log', { cwd: MIYABI_LOG_DIR, ignore: ['node_modules/**', '.git/**'] });
    return { sources: files };
  }
  if (name === 'log_get_recent' || name === 'log_get_errors' || name === 'log_get_warnings') {
    const minutes = Math.min(Math.max((args.minutes as number) || 60, 1), 10080);
    const source = sanitizeShellArg((args.source as string) || '*.log');
    const { stdout } = await execAsync(`find "${MIYABI_LOG_DIR}" -name "${source}" -mmin -${minutes} -exec tail -n 100 {} \\; 2>/dev/null || true`);
    return { logs: stdout };
  }
  if (name === 'log_search') {
    const query = args.query as string;
    const lengthError = validateInputLength(query, MAX_QUERY_LENGTH, 'Query');
    if (lengthError) return { error: lengthError };
    const safeQuery = sanitizeShellArg(query);
    const { stdout } = await execAsync(`grep -riF "${safeQuery}" "${MIYABI_LOG_DIR}" --include="*.log" 2>/dev/null | head -100 || true`);
    return { results: stdout.trim().split('\n').filter(Boolean) };
  }
  if (name === 'log_tail') {
    const source = args.source as string;
    if (!source) {
      return { error: 'Source file is required' };
    }
    const pathError = validateInputLength(source, MAX_PATH_LENGTH, 'Source path');
    if (pathError) return { error: pathError };
    const lines = Math.min(Math.max((args.lines as number) || 50, 1), 1000);
    const safePath = sanitizePath(MIYABI_LOG_DIR, source);
    const { stdout } = await execAsync(`tail -n ${lines} "${safePath}"`);
    return { content: stdout };
  }
  if (name === 'log_stats') {
    const files = await glob('**/*.log', { cwd: MIYABI_LOG_DIR, ignore: ['node_modules/**'] });
    const stats = await Promise.all(files.slice(0, 20).map(async (f) => {
      const s = await stat(join(MIYABI_LOG_DIR, f));
      return { file: f, size: s.size, modified: s.mtime };
    }));
    return { files: stats, total: files.length };
  }
  return { error: `Unknown log tool: ${name}` };
}

async function handleResourceTool(name: string, args: Record<string, unknown>): Promise<unknown> {
  if (name === 'resource_cpu') {
    const cached = cache.get<si.Systeminformation.CurrentLoadData>('cpu');
    if (cached) return { cpu: cached.currentLoad, cores: cached.cpus };
    const cpu = await si.currentLoad();
    cache.set('cpu', cpu, 2000);
    return { cpu: cpu.currentLoad, cores: cpu.cpus };
  }
  if (name === 'resource_memory') {
    const cached = cache.get<si.Systeminformation.MemData>('memory');
    if (cached) {
      return {
        total: cached.total,
        used: cached.used,
        free: cached.free,
        available: cached.available,
        usedPercent: (cached.used / cached.total) * 100,
        swapTotal: cached.swaptotal,
        swapUsed: cached.swapused
      };
    }
    const mem = await si.mem();
    cache.set('memory', mem, 2000);
    return {
      total: mem.total,
      used: mem.used,
      free: mem.free,
      available: mem.available,
      usedPercent: (mem.used / mem.total) * 100,
      swapTotal: mem.swaptotal,
      swapUsed: mem.swapused
    };
  }
  if (name === 'resource_disk') {
    const cached = cache.get<si.Systeminformation.FsSizeData[]>('disk');
    if (cached) return { disks: cached };
    const disks = await si.fsSize();
    cache.set('disk', disks, 10000);
    return { disks };
  }
  if (name === 'resource_load') {
    const cached = cache.get<si.Systeminformation.CurrentLoadData>('load');
    if (cached) return { avgLoad: cached.avgLoad, currentLoad: cached.currentLoad };
    const load = await si.currentLoad();
    cache.set('load', load, 2000);
    return { avgLoad: load.avgLoad, currentLoad: load.currentLoad };
  }
  if (name === 'resource_overview') {
    const [cpu, mem, disk] = await Promise.all([
      si.currentLoad(),
      si.mem(),
      si.fsSize()
    ]);
    return {
      cpu: { load: cpu.currentLoad, avgLoad: cpu.avgLoad },
      memory: { usedPercent: (mem.used / mem.total) * 100, freeGb: mem.free / 1024 / 1024 / 1024 },
      disk: disk.map(d => ({ mount: d.mount, usedPercent: d.use, freeGb: d.available / 1024 / 1024 / 1024 })),
    };
  }
  if (name === 'resource_processes') {
    const processes = await si.processes();
    const limit = Math.min(Math.max((args.limit as number) || 10, 1), 100);
    const sort = (args.sort as string) || 'cpu';
    const sorted = processes.list.sort((a, b) => sort === 'memory' ? b.mem - a.mem : b.cpu - a.cpu).slice(0, limit);
    return { processes: sorted };
  }
  if (name === 'resource_uptime') {
    const time = await si.time();
    return { uptime: time.uptime, timezone: time.timezone, current: time.current };
  }
  if (name === 'resource_network_stats') {
    const stats = await si.networkStats();
    return { stats };
  }
  if (name === 'resource_battery') {
    const battery = await si.battery();
    return { battery };
  }
  if (name === 'resource_temperature') {
    const temp = await si.cpuTemperature();
    return { temperature: temp };
  }
  return { error: `Unknown resource tool: ${name}` };
}

async function handleNetworkTool(name: string, args: Record<string, unknown>): Promise<unknown> {
  if (name === 'network_interfaces') {
    const cached = cache.get<si.Systeminformation.NetworkInterfacesData[]>('network_interfaces');
    if (cached) return { interfaces: cached };
    const interfaces = await si.networkInterfaces();
    cache.set('network_interfaces', interfaces, 30000); // 30 seconds - interfaces rarely change
    return { interfaces };
  }
  if (name === 'network_connections') {
    const connections = await si.networkConnections();
    return { connections: connections.slice(0, 100) };
  }
  if (name === 'network_listening_ports') {
    const connections = await si.networkConnections();
    const protocol = (args.protocol as string) || 'all';
    let listening = connections.filter(c => c.state === 'LISTEN');
    if (protocol !== 'all') {
      listening = listening.filter(c => c.protocol.toLowerCase() === protocol);
    }
    return { ports: listening };
  }
  if (name === 'network_stats') {
    const cached = cache.get<si.Systeminformation.NetworkStatsData[]>('network_stats');
    if (cached) return { stats: cached };
    const stats = await si.networkStats();
    cache.set('network_stats', stats, 2000); // 2 seconds
    return { stats };
  }
  if (name === 'network_gateway') {
    const gateway = await si.networkGatewayDefault();
    return { gateway };
  }
  if (name === 'network_ping') {
    const host = args.host as string;
    const lengthError = validateInputLength(host, MAX_HOSTNAME_LENGTH, 'Hostname');
    if (lengthError) return { error: lengthError };
    if (!isValidHostname(host)) {
      return { error: 'Invalid hostname format' };
    }
    const count = Math.min(Math.max((args.count as number) || 3, 1), 10);
    const pingFlag = platform() === 'win32' ? '-n' : '-c';
    const { stdout } = await execAsync(`ping ${pingFlag} ${count} "${host}"`, { timeout: 30000 });
    return { result: stdout };
  }
  if (name === 'network_bandwidth') {
    const stats = await si.networkStats();
    return { bandwidth: stats };
  }
  if (name === 'network_overview') {
    const [interfaces, stats, gateway] = await Promise.all([
      si.networkInterfaces(),
      si.networkStats(),
      si.networkGatewayDefault()
    ]);
    return { interfaces, stats, gateway };
  }
  if (name === 'network_dns_lookup') {
    const hostname = args.hostname as string;
    const lengthError = validateInputLength(hostname, MAX_HOSTNAME_LENGTH, 'Hostname');
    if (lengthError) return { error: lengthError };
    if (!isValidHostname(hostname)) {
      return { error: 'Invalid hostname format' };
    }
    try {
      const [address, ipv4, ipv6] = await Promise.allSettled([
        dnsLookup(hostname),
        dnsResolve4(hostname),
        dnsResolve6(hostname)
      ]);
      return {
        hostname,
        address: address.status === 'fulfilled' ? address.value : null,
        ipv4: ipv4.status === 'fulfilled' ? ipv4.value : [],
        ipv6: ipv6.status === 'fulfilled' ? ipv6.value : []
      };
    } catch (error) {
      return { error: error instanceof Error ? error.message : 'DNS lookup failed' };
    }
  }
  if (name === 'network_port_check') {
    const host = args.host as string;
    const port = args.port as number;
    if (!isValidHostname(host)) return { error: 'Invalid hostname' };
    if (!Number.isInteger(port) || port < 1 || port > 65535) return { error: 'Invalid port' };
    try {
      const { stdout } = await execAsync(`nc -z -w 3 "${host}" ${port} 2>&1 && echo "open" || echo "closed"`, { timeout: 5000 });
      return { host, port, status: stdout.trim().includes('open') ? 'open' : 'closed' };
    } catch {
      return { host, port, status: 'closed' };
    }
  }
  if (name === 'network_public_ip') {
    try {
      const { stdout } = await execAsync('curl -s --max-time 5 https://api.ipify.org');
      return { publicIp: stdout.trim() };
    } catch {
      return { error: 'Could not determine public IP' };
    }
  }
  if (name === 'network_wifi_info') {
    if (platform() === 'darwin') {
      try {
        const { stdout } = await execAsync('/System/Library/PrivateFrameworks/Apple80211.framework/Versions/Current/Resources/airport -I');
        return { wifi: stdout };
      } catch {
        return { error: 'Could not get WiFi info' };
      }
    }
    return { error: 'WiFi info only available on macOS' };
  }
  if (name === 'network_route_table') {
    const cmd = platform() === 'win32' ? 'route print' : 'netstat -rn';
    try {
      const { stdout } = await execAsync(cmd);
      return { routes: stdout };
    } catch {
      return { error: 'Could not get routing table' };
    }
  }
  if (name === 'network_ssl_check') {
    const host = sanitizeShellArg(args.host as string);
    if (!isValidHostname(host)) return { error: 'Invalid hostname' };
    const port = Math.min(Math.max((args.port as number) || 443, 1), 65535);
    try {
      const { stdout } = await execAsync(
        `echo | openssl s_client -connect "${host}:${port}" -servername "${host}" 2>/dev/null | openssl x509 -noout -dates -subject -issuer`,
        { timeout: 10000 }
      );
      const lines = stdout.trim().split('\n');
      const result: Record<string, string> = {};
      for (const line of lines) {
        const [key, ...value] = line.split('=');
        if (key && value.length) result[key.trim()] = value.join('=').trim();
      }
      return { host, port, certificate: result };
    } catch (error) {
      return { error: error instanceof Error ? error.message : 'SSL check failed' };
    }
  }
  if (name === 'network_traceroute') {
    const host = sanitizeShellArg(args.host as string);
    if (!isValidHostname(host)) return { error: 'Invalid hostname' };
    const maxHops = Math.min(Math.max((args.maxHops as number) || 15, 1), 30);
    const cmd = platform() === 'win32'
      ? `tracert -h ${maxHops} "${host}"`
      : `traceroute -m ${maxHops} "${host}" 2>&1`;
    try {
      const { stdout } = await execAsync(cmd, { timeout: 60000 });
      return { host, maxHops, trace: stdout };
    } catch (error) {
      return { error: error instanceof Error ? error.message : 'Traceroute failed' };
    }
  }
  return { error: `Unknown network tool: ${name}` };
}

async function handleProcessTool(name: string, args: Record<string, unknown>): Promise<unknown> {
  if (name === 'process_info') {
    const pid = args.pid;
    if (!isValidPid(pid)) return { error: 'Invalid PID' };
    const { stdout } = await execAsync(`ps -p ${pid} -o pid,ppid,user,%cpu,%mem,etime,command`);
    return { info: stdout };
  }
  if (name === 'process_list') {
    const processes = await si.processes();
    const limit = Math.min(Math.max((args.limit as number) || 20, 1), 200);
    return { processes: processes.list.slice(0, limit) };
  }
  if (name === 'process_search') {
    const query = sanitizeShellArg(args.query as string);
    const { stdout } = await execAsync(`pgrep -la "${query}" 2>/dev/null || true`);
    return { matches: stdout.trim().split('\n').filter(Boolean) };
  }
  if (name === 'process_tree') {
    const hasPstree = await commandExists('pstree');
    if (hasPstree) {
      const { stdout } = await execAsync('pstree -p 2>/dev/null || pstree');
      return { tree: stdout };
    }
    const { stdout } = await execAsync('ps -axo pid,ppid,comm | head -100');
    return { tree: stdout, note: 'pstree not available' };
  }
  if (name === 'process_file_descriptors') {
    const pid = args.pid;
    if (!isValidPid(pid)) return { error: 'Invalid PID' };
    const { stdout } = await execAsync(`lsof -p ${pid} 2>/dev/null | head -50 || echo "lsof not available"`);
    return { fds: stdout };
  }
  if (name === 'process_environment') {
    const pid = args.pid;
    if (!isValidPid(pid)) return { error: 'Invalid PID' };
    if (platform() === 'darwin') {
      const { stdout } = await execAsync(`ps eww -p ${pid} 2>/dev/null || echo "Process not found"`);
      return { env: stdout };
    }
    const { stdout } = await execAsync(`cat /proc/${pid}/environ 2>/dev/null | tr '\\0' '\\n' || ps eww -p ${pid} 2>/dev/null || echo "Process not found"`);
    return { env: stdout };
  }
  if (name === 'process_children') {
    const pid = args.pid;
    if (!isValidPid(pid)) return { error: 'Invalid PID' };
    const { stdout } = await execAsync(`pgrep -P ${pid} 2>/dev/null || true`);
    return { children: stdout.trim().split('\n').filter(Boolean) };
  }
  if (name === 'process_top') {
    const limit = Math.min(Math.max((args.limit as number) || 10, 1), 100);
    const processes = await si.processes();
    const top = processes.list.sort((a, b) => b.cpu - a.cpu).slice(0, limit);
    return { top };
  }
  if (name === 'process_kill') {
    const pid = args.pid;
    const confirm = args.confirm as boolean;
    const signal = (args.signal as string) || 'SIGTERM';
    if (!confirm) return { error: 'Confirmation required. Set confirm: true' };
    if (!isValidPid(pid)) return { error: 'Invalid PID' };
    if (!['SIGTERM', 'SIGKILL', 'SIGINT'].includes(signal)) return { error: 'Invalid signal' };
    try {
      const { stdout: processInfo } = await execAsync(`ps -p ${pid} -o pid,comm 2>/dev/null`);
      await execAsync(`kill -${signal} ${pid}`);
      return { success: true, pid, signal, process: processInfo.trim() };
    } catch (error) {
      return { error: error instanceof Error ? error.message : 'Kill failed' };
    }
  }
  if (name === 'process_ports') {
    const pid = args.pid;
    if (!isValidPid(pid)) return { error: 'Invalid PID' };
    const { stdout } = await execAsync(`lsof -i -P -n -p ${pid} 2>/dev/null || true`);
    return { ports: stdout };
  }
  if (name === 'process_cpu_history') {
    const pid = args.pid;
    if (!isValidPid(pid)) return { error: 'Invalid PID' };
    const samples: number[] = [];
    for (let i = 0; i < 3; i++) {
      const { stdout } = await execAsync(`ps -p ${pid} -o %cpu 2>/dev/null | tail -1`);
      samples.push(parseFloat(stdout.trim()) || 0);
      if (i < 2) await new Promise(r => setTimeout(r, 500));
    }
    return { pid, samples, average: samples.reduce((a, b) => a + b, 0) / samples.length };
  }
  if (name === 'process_memory_detail') {
    const pid = args.pid;
    if (!isValidPid(pid)) return { error: 'Invalid PID' };
    const { stdout } = await execAsync(`ps -p ${pid} -o pid,rss,vsz,%mem 2>/dev/null`);
    return { memory: stdout };
  }
  if (name === 'process_threads') {
    const pid = args.pid;
    if (!isValidPid(pid)) return { error: 'Invalid PID' };
    try {
      if (platform() === 'darwin') {
        const { stdout } = await execAsync(`ps -M -p ${pid} 2>/dev/null`);
        return { pid, threads: stdout };
      } else if (platform() === 'linux') {
        const { stdout } = await execAsync(`ps -T -p ${pid} 2>/dev/null`);
        return { pid, threads: stdout };
      }
      return { error: 'Thread listing not supported on this platform' };
    } catch (error) {
      return { error: error instanceof Error ? error.message : 'Could not list threads' };
    }
  }
  if (name === 'process_io_stats') {
    const pid = args.pid;
    if (!isValidPid(pid)) return { error: 'Invalid PID' };
    if (platform() !== 'linux') {
      return { error: 'I/O stats only available on Linux' };
    }
    try {
      const { stdout } = await execAsync(`cat /proc/${pid}/io 2>/dev/null`);
      const lines = stdout.trim().split('\n');
      const stats: Record<string, number> = {};
      for (const line of lines) {
        const [key, value] = line.split(':');
        if (key && value) stats[key.trim()] = parseInt(value.trim(), 10);
      }
      return { pid, io: stats };
    } catch (error) {
      return { error: error instanceof Error ? error.message : 'Could not read I/O stats' };
    }
  }
  return { error: `Unknown process tool: ${name}` };
}

async function handleFileTool(name: string, args: Record<string, unknown>): Promise<unknown> {
  const baseDir = MIYABI_WATCH_DIR;

  if (name === 'file_stats') {
    const userPath = args.path as string;
    const fullPath = sanitizePath(baseDir, userPath);
    const stats = await stat(fullPath);
    return {
      path: userPath,
      size: stats.size,
      modified: stats.mtime,
      created: stats.birthtime,
      isDirectory: stats.isDirectory(),
      isFile: stats.isFile(),
      permissions: stats.mode.toString(8).slice(-3)
    };
  }
  if (name === 'file_recent_changes') {
    const minutes = Math.min(Math.max((args.minutes as number) || 60, 1), 10080);
    const limit = Math.min(Math.max((args.limit as number) || 20, 1), 200);
    const { stdout } = await execAsync(`find "${baseDir}" -type f -mmin -${minutes} 2>/dev/null | head -${limit}`);
    return { files: stdout.trim().split('\n').filter(Boolean) };
  }
  if (name === 'file_search') {
    const pattern = args.pattern as string;
    const files = await glob(pattern, { cwd: baseDir, ignore: ['node_modules/**', '.git/**'] });
    return { files };
  }
  if (name === 'file_tree') {
    const depth = Math.min(Math.max((args.depth as number) || 3, 1), 10);
    const { stdout } = await execAsync(`find "${baseDir}" -maxdepth ${depth} -type f 2>/dev/null | head -100`);
    return { tree: stdout };
  }
  if (name === 'file_compare') {
    const path1 = sanitizePath(baseDir, args.path1 as string);
    const path2 = sanitizePath(baseDir, args.path2 as string);
    const [stat1, stat2] = await Promise.all([stat(path1), stat(path2)]);
    return {
      path1: { size: stat1.size, modified: stat1.mtime },
      path2: { size: stat2.size, modified: stat2.mtime },
      sameSize: stat1.size === stat2.size
    };
  }
  if (name === 'file_changes_since') {
    const since = new Date(args.since as string);
    if (isNaN(since.getTime())) return { error: 'Invalid date format' };
    const { stdout } = await execAsync(`find "${baseDir}" -type f -newermt "${since.toISOString()}" 2>/dev/null | head -50`);
    return { files: stdout.trim().split('\n').filter(Boolean) };
  }
  if (name === 'file_read') {
    const userPath = args.path as string;
    const encoding = (args.encoding as BufferEncoding) || 'utf-8';
    const maxLines = Math.min(Math.max((args.maxLines as number) || 1000, 1), 5000);
    const fullPath = sanitizePath(baseDir, userPath);
    const stats = await stat(fullPath);
    if (stats.size > 100 * 1024) return { error: 'File too large (max 100KB)' };
    const content = await readFile(fullPath, encoding);
    const lines = content.split('\n');
    const truncated = lines.length > maxLines;
    return {
      path: userPath,
      size: stats.size,
      lines: lines.length,
      truncated,
      content: truncated ? lines.slice(0, maxLines).join('\n') : content
    };
  }
  if (name === 'file_checksum') {
    const userPath = args.path as string;
    const algorithm = (args.algorithm as string) || 'sha256';
    if (!['md5', 'sha256', 'sha512'].includes(algorithm)) return { error: 'Invalid algorithm' };
    const fullPath = sanitizePath(baseDir, userPath);
    const stats = await stat(fullPath);
    if (stats.size > 100 * 1024 * 1024) return { error: 'File too large (max 100MB)' };
    const content = await readFile(fullPath);
    const hash = createHash(algorithm).update(content).digest('hex');
    return { path: userPath, algorithm, checksum: hash, size: stats.size };
  }
  if (name === 'file_size_summary') {
    const dir = (args.directory as string) || '.';
    const safePath = sanitizePath(baseDir, dir);
    const { stdout } = await execAsync(`du -sh "${safePath}" 2>/dev/null`);
    return { summary: stdout.trim() };
  }
  if (name === 'file_duplicates') {
    const dir = (args.directory as string) || '.';
    const pattern = (args.pattern as string) || '*';
    const safePath = sanitizePath(baseDir, dir);
    const files = await glob(pattern, { cwd: safePath, ignore: ['node_modules/**', '.git/**'] });
    const checksums = new Map<string, string[]>();
    for (const f of files.slice(0, 100)) {
      const fullPath = join(safePath, f);
      try {
        const stats = await stat(fullPath);
        if (stats.isFile() && stats.size < 10 * 1024 * 1024) {
          const content = await readFile(fullPath);
          const hash = createHash('md5').update(content).digest('hex');
          if (!checksums.has(hash)) checksums.set(hash, []);
          checksums.get(hash)!.push(f);
        }
      } catch { /* skip */ }
    }
    const duplicates = Array.from(checksums.entries())
      .filter(([, files]) => files.length > 1)
      .map(([hash, files]) => ({ hash, files }));
    return { duplicates };
  }
  return { error: `Unknown file tool: ${name}` };
}

async function handleClaudeTool(name: string, args: Record<string, unknown>): Promise<unknown> {
  if (name === 'claude_config') {
    try {
      const content = await readFile(CLAUDE_CONFIG_FILE, 'utf-8');
      return { config: JSON.parse(content) };
    } catch {
      return { error: 'Could not read Claude config', path: CLAUDE_CONFIG_FILE };
    }
  }
  if (name === 'claude_mcp_status') {
    try {
      const content = await readFile(CLAUDE_CONFIG_FILE, 'utf-8');
      const config = JSON.parse(content);
      const servers = config.mcpServers || {};
      return {
        servers: Object.keys(servers),
        details: Object.entries(servers).map(([name, cfg]) => ({
          name,
          command: (cfg as { command?: string }).command || 'unknown'
        }))
      };
    } catch {
      return { error: 'Could not read MCP status' };
    }
  }
  if (name === 'claude_logs') {
    const lines = Math.min(Math.max((args.lines as number) || 100, 1), 1000);
    const { stdout } = await execAsync(`find "${CLAUDE_LOGS_DIR}" -name "*.log" -exec tail -n ${lines} {} \\; 2>/dev/null || echo "No logs found"`);
    return { logs: stdout };
  }
  if (name === 'claude_log_search') {
    const query = args.query as string;
    const lengthError = validateInputLength(query, MAX_QUERY_LENGTH, 'Query');
    if (lengthError) return { error: lengthError };
    const safeQuery = sanitizeShellArg(query);
    const { stdout } = await execAsync(`grep -riF "${safeQuery}" "${CLAUDE_LOGS_DIR}" 2>/dev/null | head -50 || echo "No matches"`);
    return { results: stdout };
  }
  if (name === 'claude_log_files') {
    try {
      const files = await readdir(CLAUDE_LOGS_DIR);
      return { files };
    } catch {
      return { error: 'Could not list log files', path: CLAUDE_LOGS_DIR };
    }
  }
  if (name === 'claude_session_info') {
    try {
      const { stdout } = await execAsync('pgrep -l -f "Claude" 2>/dev/null || echo ""');
      const processes = stdout.trim().split('\n').filter(Boolean);
      return {
        processes: processes.length,
        details: processes,
        configDir: CLAUDE_CONFIG_DIR,
        logsDir: CLAUDE_LOGS_DIR
      };
    } catch {
      return { processes: 0, configDir: CLAUDE_CONFIG_DIR, logsDir: CLAUDE_LOGS_DIR };
    }
  }
  if (name === 'claude_background_shells') {
    try {
      const { stdout } = await execAsync('ps aux | grep -E "(node|tsx).*claude" 2>/dev/null | grep -v grep || echo ""');
      const shells = stdout.trim().split('\n').filter(Boolean);
      return { shells, count: shells.length };
    } catch {
      return { shells: [], count: 0 };
    }
  }
  if (name === 'claude_status') {
    const [config, logs, processes] = await Promise.allSettled([
      readFile(CLAUDE_CONFIG_FILE, 'utf-8').then(c => JSON.parse(c)),
      readdir(CLAUDE_LOGS_DIR).catch(() => []),
      execAsync('pgrep -l -f "Claude" 2>/dev/null || echo ""').then(r => r.stdout.trim().split('\n').filter(Boolean))
    ]);
    return {
      config: config.status === 'fulfilled' ? { mcpServers: Object.keys(config.value.mcpServers || {}), hasConfig: true } : { hasConfig: false },
      logs: logs.status === 'fulfilled' ? { fileCount: logs.value.length, files: logs.value.slice(0, 10) } : { fileCount: 0 },
      processes: processes.status === 'fulfilled' ? { count: processes.value.length, list: processes.value } : { count: 0 },
      paths: { configDir: CLAUDE_CONFIG_DIR, configFile: CLAUDE_CONFIG_FILE, logsDir: CLAUDE_LOGS_DIR }
    };
  }
  return { error: `Unknown claude tool: ${name}` };
}

async function handleGitHubTool(name: string, args: Record<string, unknown>): Promise<unknown> {
  if (!octokit) {
    return { error: 'GitHub token not configured. Set GITHUB_TOKEN environment variable.' };
  }

  const owner = (args.owner as string) || GITHUB_DEFAULT_OWNER;
  const repo = (args.repo as string) || GITHUB_DEFAULT_REPO;

  if (!owner || !repo) {
    return { error: 'Repository owner and name required. Set GITHUB_DEFAULT_OWNER and GITHUB_DEFAULT_REPO.' };
  }

  if (name === 'github_list_issues') {
    const response = await octokit.issues.listForRepo({
      owner, repo,
      state: (args.state as 'open' | 'closed' | 'all') || 'open',
      per_page: Math.min((args.per_page as number) || 30, 100)
    });
    return { issues: response.data };
  }
  if (name === 'github_get_issue') {
    const response = await octokit.issues.get({ owner, repo, issue_number: args.issue_number as number });
    return { issue: response.data };
  }
  if (name === 'github_create_issue') {
    const response = await octokit.issues.create({
      owner, repo,
      title: args.title as string,
      body: args.body as string,
      labels: args.labels as string[]
    });
    return { issue: response.data };
  }
  if (name === 'github_update_issue') {
    const response = await octokit.issues.update({
      owner, repo,
      issue_number: args.issue_number as number,
      title: args.title as string,
      body: args.body as string,
      state: args.state as 'open' | 'closed'
    });
    return { issue: response.data };
  }
  if (name === 'github_add_comment') {
    const response = await octokit.issues.createComment({
      owner, repo,
      issue_number: args.issue_number as number,
      body: args.body as string
    });
    return { comment: response.data };
  }
  if (name === 'github_list_prs') {
    const response = await octokit.pulls.list({
      owner, repo,
      state: (args.state as 'open' | 'closed' | 'all') || 'open',
      per_page: Math.min((args.per_page as number) || 30, 100)
    });
    return { prs: response.data };
  }
  if (name === 'github_get_pr') {
    const response = await octokit.pulls.get({ owner, repo, pull_number: args.pull_number as number });
    return { pr: response.data };
  }
  if (name === 'github_create_pr') {
    const response = await octokit.pulls.create({
      owner, repo,
      title: args.title as string,
      head: args.head as string,
      base: (args.base as string) || 'main',
      body: args.body as string
    });
    return { pr: response.data };
  }
  if (name === 'github_merge_pr') {
    const response = await octokit.pulls.merge({
      owner, repo,
      pull_number: args.pull_number as number,
      merge_method: (args.merge_method as 'merge' | 'squash' | 'rebase') || 'squash'
    });
    return { merged: response.data };
  }
  if (name === 'github_list_labels') {
    const response = await octokit.issues.listLabelsForRepo({ owner, repo });
    return { labels: response.data };
  }
  if (name === 'github_add_labels') {
    const response = await octokit.issues.addLabels({
      owner, repo,
      issue_number: args.issue_number as number,
      labels: args.labels as string[]
    });
    return { labels: response.data };
  }
  if (name === 'github_list_milestones') {
    const response = await octokit.issues.listMilestones({
      owner, repo,
      state: (args.state as 'open' | 'closed' | 'all') || 'open'
    });
    return { milestones: response.data };
  }
  if (name === 'github_list_workflows') {
    const response = await octokit.actions.listRepoWorkflows({
      owner, repo,
      per_page: Math.min((args.per_page as number) || 30, 100)
    });
    return { workflows: response.data.workflows, total_count: response.data.total_count };
  }
  if (name === 'github_list_workflow_runs') {
    const params: { owner: string; repo: string; per_page?: number; workflow_id?: number; status?: 'queued' | 'in_progress' | 'completed' } = {
      owner, repo,
      per_page: Math.min((args.per_page as number) || 30, 100)
    };
    if (args.workflow_id) params.workflow_id = parseInt(args.workflow_id as string, 10);
    if (args.status) params.status = args.status as 'queued' | 'in_progress' | 'completed';
    const response = await octokit.actions.listWorkflowRunsForRepo(params);
    return { runs: response.data.workflow_runs, total_count: response.data.total_count };
  }
  if (name === 'github_repo_info') {
    const response = await octokit.repos.get({ owner, repo });
    return { repo: response.data };
  }
  if (name === 'github_list_releases') {
    const response = await octokit.repos.listReleases({
      owner, repo,
      per_page: Math.min((args.per_page as number) || 10, 100)
    });
    return { releases: response.data };
  }
  if (name === 'github_list_branches') {
    const response = await octokit.repos.listBranches({
      owner, repo,
      per_page: Math.min((args.per_page as number) || 30, 100)
    });
    return { branches: response.data };
  }
  if (name === 'github_compare_commits') {
    const base = args.base as string;
    const head = args.head as string;
    const response = await octokit.repos.compareCommits({ owner, repo, base, head });
    return {
      ahead_by: response.data.ahead_by,
      behind_by: response.data.behind_by,
      total_commits: response.data.total_commits,
      files_changed: response.data.files?.length || 0,
      commits: response.data.commits.map(c => ({ sha: c.sha, message: c.commit.message }))
    };
  }
  if (name === 'github_list_pr_reviews') {
    const pullNumber = args.pull_number as number;
    const response = await octokit.pulls.listReviews({ owner, repo, pull_number: pullNumber });
    return {
      reviews: response.data.map(r => ({
        id: r.id,
        user: r.user?.login,
        state: r.state,
        body: r.body,
        submitted_at: r.submitted_at
      }))
    };
  }
  if (name === 'github_create_review') {
    const pullNumber = args.pull_number as number;
    const body = args.body as string | undefined;
    const event = args.event as 'APPROVE' | 'REQUEST_CHANGES' | 'COMMENT' | undefined;
    const comments = args.comments as Array<{ path: string; position?: number; body: string }> | undefined;
    const response = await octokit.pulls.createReview({
      owner, repo,
      pull_number: pullNumber,
      body,
      event,
      comments
    });
    return {
      id: response.data.id,
      state: response.data.state,
      html_url: response.data.html_url
    };
  }
  if (name === 'github_submit_review') {
    const pullNumber = args.pull_number as number;
    const reviewId = args.review_id as number;
    const body = args.body as string | undefined;
    const event = args.event as 'APPROVE' | 'REQUEST_CHANGES' | 'COMMENT';
    const response = await octokit.pulls.submitReview({
      owner, repo,
      pull_number: pullNumber,
      review_id: reviewId,
      body,
      event
    });
    return {
      id: response.data.id,
      state: response.data.state,
      html_url: response.data.html_url
    };
  }
  return { error: `Unknown github tool: ${name}` };
}

async function handleHealthCheck(): Promise<unknown> {
  const [cpu, mem, disk, uptime] = await Promise.all([
    si.currentLoad(),
    si.mem(),
    si.fsSize(),
    si.time()
  ]);

  const health = {
    status: 'healthy' as string,
    checks: {
      cpu: { value: cpu.currentLoad, threshold: 90, passed: cpu.currentLoad < 90 },
      memory: { value: (mem.used / mem.total) * 100, threshold: 90, passed: (mem.used / mem.total) * 100 < 90 },
      disk: disk.map(d => ({ mount: d.mount, value: d.use, threshold: 90, passed: d.use < 90 }))
    },
    uptime: uptime.uptime,
    timestamp: new Date().toISOString()
  };

  if (!health.checks.cpu.passed || !health.checks.memory.passed) {
    health.status = 'warning';
  }
  if (health.checks.disk.some(d => !d.passed)) {
    health.status = 'warning';
  }

  return health;
}

async function handleLinuxTool(name: string, args: Record<string, unknown>): Promise<unknown> {
  if (platform() !== 'linux') {
    return { error: 'Linux tools are only available on Linux' };
  }

  const hasSystemctl = await commandExists('systemctl');
  if (!hasSystemctl) {
    return { error: 'systemctl not found. This system may not use systemd.' };
  }

  if (name === 'linux_systemd_units') {
    const unitType = sanitizeShellArg((args.type as string) || '');
    const state = sanitizeShellArg((args.state as string) || '');
    let cmd = 'systemctl list-units --no-pager';
    if (unitType) cmd += ` --type=${unitType}`;
    if (state) cmd += ` --state=${state}`;
    try {
      const { stdout } = await execAsync(cmd);
      return { units: stdout };
    } catch (error) {
      return { error: error instanceof Error ? error.message : 'Failed to list units' };
    }
  }
  if (name === 'linux_systemd_status') {
    const unit = sanitizeShellArg(args.unit as string);
    if (!unit) return { error: 'Unit name required' };
    try {
      const { stdout } = await execAsync(`systemctl status "${unit}" --no-pager 2>&1 || true`);
      return { unit, status: stdout };
    } catch (error) {
      return { error: error instanceof Error ? error.message : 'Failed to get status' };
    }
  }
  if (name === 'linux_journal_search') {
    const hasJournalctl = await commandExists('journalctl');
    if (!hasJournalctl) {
      return { error: 'journalctl not found' };
    }
    const unit = sanitizeShellArg((args.unit as string) || '');
    const priority = sanitizeShellArg((args.priority as string) || '');
    const since = sanitizeShellArg((args.since as string) || '');
    const lines = Math.min(Math.max((args.lines as number) || 100, 1), 1000);
    let cmd = `journalctl --no-pager -n ${lines}`;
    if (unit) cmd += ` -u "${unit}"`;
    if (priority) cmd += ` -p ${priority}`;
    if (since) cmd += ` --since="${since}"`;
    try {
      const { stdout } = await execAsync(cmd);
      return { journal: stdout };
    } catch (error) {
      return { error: error instanceof Error ? error.message : 'Failed to search journal' };
    }
  }
  return { error: `Unknown linux tool: ${name}` };
}

async function handleWindowsTool(name: string, args: Record<string, unknown>): Promise<unknown> {
  if (platform() !== 'win32') {
    return { error: 'Windows tools are only available on Windows' };
  }

  if (name === 'windows_service_status') {
    const service = sanitizeShellArg((args.service as string) || '');
    const cmd = service
      ? `sc query "${service}"`
      : 'sc query state= all';
    try {
      const { stdout } = await execAsync(cmd);
      return { services: stdout };
    } catch (error) {
      return { error: error instanceof Error ? error.message : 'Failed to get service status' };
    }
  }
  if (name === 'windows_eventlog_search') {
    const log = sanitizeShellArg((args.log as string) || 'System');
    const level = sanitizeShellArg((args.level as string) || '');
    const source = sanitizeShellArg((args.source as string) || '');
    const maxEvents = Math.min(Math.max((args.maxEvents as number) || 50, 1), 500);

    let filter = `LogName='${log}'`;
    if (level) {
      const levelMap: Record<string, number> = { Error: 2, Warning: 3, Information: 4 };
      if (levelMap[level]) filter += ` and Level=${levelMap[level]}`;
    }
    if (source) filter += ` and ProviderName='${source}'`;

    const cmd = `powershell -Command "Get-WinEvent -FilterHashtable @{${filter}} -MaxEvents ${maxEvents} | Select-Object TimeCreated,LevelDisplayName,ProviderName,Message | ConvertTo-Json"`;
    try {
      const { stdout } = await execAsync(cmd, { timeout: 30000 });
      return { events: stdout ? JSON.parse(stdout) : [] };
    } catch (error) {
      return { error: error instanceof Error ? error.message : 'Failed to search event log' };
    }
  }
  return { error: `Unknown windows tool: ${name}` };
}

// ========== Docker Handler ==========
async function handleDockerTool(name: string, args: Record<string, unknown>): Promise<unknown> {
  const hasDocker = await commandExists('docker');
  if (!hasDocker) {
    return { error: 'Docker is not installed or not in PATH' };
  }

  if (name === 'docker_ps') {
    const all = args.all as boolean;
    const limit = Math.min(Math.max((args.limit as number) || 100, 1), 500);
    let cmd = `docker ps --format "{{json .}}"`;
    if (all) cmd = `docker ps -a --format "{{json .}}"`;
    cmd += ` -n ${limit}`;
    try {
      const { stdout } = await execAsync(cmd, { timeout: 30000 });
      const containers = stdout.trim().split('\n').filter(Boolean).map(line => JSON.parse(line));
      return { containers, count: containers.length };
    } catch (error) {
      return { error: error instanceof Error ? error.message : 'Failed to list containers' };
    }
  }

  if (name === 'docker_images') {
    const all = args.all as boolean;
    const dangling = args.dangling as boolean;
    let cmd = `docker images --format "{{json .}}"`;
    if (all) cmd += ' -a';
    if (dangling) cmd = `docker images -f "dangling=true" --format "{{json .}}"`;
    try {
      const { stdout } = await execAsync(cmd, { timeout: 30000 });
      const images = stdout.trim().split('\n').filter(Boolean).map(line => JSON.parse(line));
      return { images, count: images.length };
    } catch (error) {
      return { error: error instanceof Error ? error.message : 'Failed to list images' };
    }
  }

  if (name === 'docker_logs') {
    const container = sanitizeShellArg(args.container as string);
    if (!container) return { error: 'Container name/id required' };
    const tail = Math.min(Math.max((args.tail as number) || 100, 1), 10000);
    const timestamps = args.timestamps as boolean;
    const since = sanitizeShellArg((args.since as string) || '');
    let cmd = `docker logs --tail ${tail}`;
    if (timestamps) cmd += ' --timestamps';
    if (since) cmd += ` --since "${since}"`;
    cmd += ` "${container}"`;
    try {
      const { stdout, stderr } = await execAsync(cmd, { timeout: 60000 });
      return { logs: stdout || stderr };
    } catch (error) {
      return { error: error instanceof Error ? error.message : 'Failed to get logs' };
    }
  }

  if (name === 'docker_inspect') {
    const target = sanitizeShellArg(args.target as string);
    if (!target) return { error: 'Target (container/image) required' };
    const type = args.type as string || 'container';
    const cmd = type === 'image' ? `docker image inspect "${target}"` : `docker inspect "${target}"`;
    try {
      const { stdout } = await execAsync(cmd, { timeout: 30000 });
      return { inspect: JSON.parse(stdout) };
    } catch (error) {
      return { error: error instanceof Error ? error.message : 'Failed to inspect' };
    }
  }

  if (name === 'docker_stats') {
    const container = sanitizeShellArg((args.container as string) || '');
    const cmd = container
      ? `docker stats --no-stream --format "{{json .}}" "${container}"`
      : `docker stats --no-stream --format "{{json .}}"`;
    try {
      const { stdout } = await execAsync(cmd, { timeout: 30000 });
      const stats = stdout.trim().split('\n').filter(Boolean).map(line => JSON.parse(line));
      return { stats };
    } catch (error) {
      return { error: error instanceof Error ? error.message : 'Failed to get stats' };
    }
  }

  if (name === 'docker_exec') {
    const container = sanitizeShellArg(args.container as string);
    const command = sanitizeShellArg(args.command as string);
    const user = sanitizeShellArg((args.user as string) || '');
    if (!container || !command) return { error: 'Container and command required' };
    let cmd = `docker exec`;
    if (user) cmd += ` -u "${user}"`;
    cmd += ` "${container}" ${command}`;
    try {
      const { stdout, stderr } = await execAsync(cmd, { timeout: 60000 });
      return { output: stdout || stderr };
    } catch (error) {
      return { error: error instanceof Error ? error.message : 'Failed to exec' };
    }
  }

  if (name === 'docker_start') {
    const container = sanitizeShellArg(args.container as string);
    if (!container) return { error: 'Container name/id required' };
    try {
      await execAsync(`docker start "${container}"`, { timeout: 30000 });
      return { success: true, message: `Container ${container} started` };
    } catch (error) {
      return { error: error instanceof Error ? error.message : 'Failed to start container' };
    }
  }

  if (name === 'docker_stop') {
    const container = sanitizeShellArg(args.container as string);
    if (!container) return { error: 'Container name/id required' };
    const timeout = Math.min(Math.max((args.timeout as number) || 10, 1), 300);
    try {
      await execAsync(`docker stop -t ${timeout} "${container}"`, { timeout: (timeout + 10) * 1000 });
      return { success: true, message: `Container ${container} stopped` };
    } catch (error) {
      return { error: error instanceof Error ? error.message : 'Failed to stop container' };
    }
  }

  if (name === 'docker_restart') {
    const container = sanitizeShellArg(args.container as string);
    if (!container) return { error: 'Container name/id required' };
    const timeout = Math.min(Math.max((args.timeout as number) || 10, 1), 300);
    try {
      await execAsync(`docker restart -t ${timeout} "${container}"`, { timeout: (timeout + 20) * 1000 });
      return { success: true, message: `Container ${container} restarted` };
    } catch (error) {
      return { error: error instanceof Error ? error.message : 'Failed to restart container' };
    }
  }

  if (name === 'docker_build') {
    const path = sanitizeShellArg((args.path as string) || '.');
    const tag = sanitizeShellArg((args.tag as string) || '');
    const dockerfile = sanitizeShellArg((args.dockerfile as string) || '');
    const noCache = args.noCache as boolean;
    let cmd = `docker build`;
    if (tag) cmd += ` -t "${tag}"`;
    if (dockerfile) cmd += ` -f "${dockerfile}"`;
    if (noCache) cmd += ' --no-cache';
    cmd += ` "${path}"`;
    try {
      const { stdout, stderr } = await execAsync(cmd, { timeout: 600000 }); // 10 min timeout for builds
      return { success: true, output: stdout || stderr };
    } catch (error) {
      return { error: error instanceof Error ? error.message : 'Build failed' };
    }
  }

  return { error: `Unknown docker tool: ${name}` };
}

// ========== Docker Compose Handler ==========
async function handleComposeTool(name: string, args: Record<string, unknown>): Promise<unknown> {
  // Check for docker compose (v2) or docker-compose (v1)
  let composeCmd = 'docker compose';
  const hasComposeV2 = await commandExists('docker');
  if (!hasComposeV2) {
    const hasComposeV1 = await commandExists('docker-compose');
    if (!hasComposeV1) {
      return { error: 'Docker Compose is not installed' };
    }
    composeCmd = 'docker-compose';
  }

  const composePath = sanitizeShellArg((args.path as string) || '');
  const pathArg = composePath ? ` -f "${composePath}"` : '';

  if (name === 'compose_ps') {
    const all = args.all as boolean;
    let cmd = `${composeCmd}${pathArg} ps --format json`;
    if (all) cmd += ' -a';
    try {
      const { stdout } = await execAsync(cmd, { timeout: 30000 });
      // docker compose ps --format json returns JSONL
      const services = stdout.trim().split('\n').filter(Boolean).map(line => {
        try { return JSON.parse(line); } catch { return { raw: line }; }
      });
      return { services, count: services.length };
    } catch (error) {
      return { error: error instanceof Error ? error.message : 'Failed to list services' };
    }
  }

  if (name === 'compose_up') {
    const services = (args.services as string[]) || [];
    const detach = args.detach !== false; // default true
    const build = args.build as boolean;
    let cmd = `${composeCmd}${pathArg} up`;
    if (detach) cmd += ' -d';
    if (build) cmd += ' --build';
    if (services.length > 0) {
      cmd += ' ' + services.map(s => sanitizeShellArg(s)).join(' ');
    }
    try {
      const { stdout, stderr } = await execAsync(cmd, { timeout: 300000 }); // 5 min
      return { success: true, output: stdout || stderr };
    } catch (error) {
      return { error: error instanceof Error ? error.message : 'Failed to start services' };
    }
  }

  if (name === 'compose_down') {
    const volumes = args.volumes as boolean;
    const removeOrphans = args.removeOrphans as boolean;
    let cmd = `${composeCmd}${pathArg} down`;
    if (volumes) cmd += ' -v';
    if (removeOrphans) cmd += ' --remove-orphans';
    try {
      const { stdout, stderr } = await execAsync(cmd, { timeout: 120000 });
      return { success: true, output: stdout || stderr };
    } catch (error) {
      return { error: error instanceof Error ? error.message : 'Failed to stop services' };
    }
  }

  if (name === 'compose_logs') {
    const services = (args.services as string[]) || [];
    const tail = Math.min(Math.max((args.tail as number) || 100, 1), 5000);
    const timestamps = args.timestamps as boolean;
    let cmd = `${composeCmd}${pathArg} logs --tail ${tail}`;
    if (timestamps) cmd += ' --timestamps';
    if (services.length > 0) {
      cmd += ' ' + services.map(s => sanitizeShellArg(s)).join(' ');
    }
    try {
      const { stdout, stderr } = await execAsync(cmd, { timeout: 60000 });
      return { logs: stdout || stderr };
    } catch (error) {
      return { error: error instanceof Error ? error.message : 'Failed to get logs' };
    }
  }

  return { error: `Unknown compose tool: ${name}` };
}

// ========== Kubernetes Handler ==========
async function handleK8sTool(name: string, args: Record<string, unknown>): Promise<unknown> {
  const hasKubectl = await commandExists('kubectl');
  if (!hasKubectl) {
    return { error: 'kubectl is not installed or not in PATH' };
  }

  const namespace = sanitizeShellArg((args.namespace as string) || '');
  const nsArg = namespace ? ` -n "${namespace}"` : '';
  const allNsArg = args.allNamespaces ? ' --all-namespaces' : '';

  if (name === 'k8s_get_pods') {
    const selector = sanitizeShellArg((args.selector as string) || '');
    let cmd = `kubectl get pods${nsArg}${allNsArg} -o json`;
    if (selector) cmd = `kubectl get pods${nsArg}${allNsArg} -l "${selector}" -o json`;
    try {
      const { stdout } = await execAsync(cmd, { timeout: 30000 });
      const result = JSON.parse(stdout);
      return { pods: result.items || [], count: (result.items || []).length };
    } catch (error) {
      return { error: error instanceof Error ? error.message : 'Failed to get pods' };
    }
  }

  if (name === 'k8s_get_deployments') {
    const cmd = `kubectl get deployments${nsArg}${allNsArg} -o json`;
    try {
      const { stdout } = await execAsync(cmd, { timeout: 30000 });
      const result = JSON.parse(stdout);
      return { deployments: result.items || [], count: (result.items || []).length };
    } catch (error) {
      return { error: error instanceof Error ? error.message : 'Failed to get deployments' };
    }
  }

  if (name === 'k8s_logs') {
    const pod = sanitizeShellArg(args.pod as string);
    if (!pod) return { error: 'Pod name required' };
    const container = sanitizeShellArg((args.container as string) || '');
    const tail = Math.min(Math.max((args.tail as number) || 100, 1), 10000);
    const since = sanitizeShellArg((args.since as string) || '');
    let cmd = `kubectl logs${nsArg} "${pod}" --tail=${tail}`;
    if (container) cmd += ` -c "${container}"`;
    if (since) cmd += ` --since="${since}"`;
    try {
      const { stdout } = await execAsync(cmd, { timeout: 60000 });
      return { logs: stdout };
    } catch (error) {
      return { error: error instanceof Error ? error.message : 'Failed to get logs' };
    }
  }

  if (name === 'k8s_describe') {
    const resource = sanitizeShellArg(args.resource as string);
    const resourceName = sanitizeShellArg(args.name as string);
    if (!resource || !resourceName) return { error: 'Resource type and name required' };
    const cmd = `kubectl describe ${resource}${nsArg} "${resourceName}"`;
    try {
      const { stdout } = await execAsync(cmd, { timeout: 30000 });
      return { description: stdout };
    } catch (error) {
      return { error: error instanceof Error ? error.message : 'Failed to describe resource' };
    }
  }

  if (name === 'k8s_apply') {
    const file = sanitizeShellArg(args.file as string);
    if (!file) return { error: 'Manifest file path required' };
    const dryRun = args.dryRun as boolean;
    let cmd = `kubectl apply${nsArg} -f "${file}"`;
    if (dryRun) cmd += ' --dry-run=client';
    try {
      const { stdout } = await execAsync(cmd, { timeout: 60000 });
      return { success: true, output: stdout };
    } catch (error) {
      return { error: error instanceof Error ? error.message : 'Failed to apply manifest' };
    }
  }

  if (name === 'k8s_delete') {
    const resource = sanitizeShellArg(args.resource as string);
    const resourceName = sanitizeShellArg(args.name as string);
    if (!resource || !resourceName) return { error: 'Resource type and name required' };
    const dryRun = args.dryRun as boolean;
    let cmd = `kubectl delete ${resource}${nsArg} "${resourceName}"`;
    if (dryRun) cmd += ' --dry-run=client';
    try {
      const { stdout } = await execAsync(cmd, { timeout: 60000 });
      return { success: true, output: stdout };
    } catch (error) {
      return { error: error instanceof Error ? error.message : 'Failed to delete resource' };
    }
  }

  return { error: `Unknown k8s tool: ${name}` };
}

// ========== Spec-Kit Handler ==========
async function handleSpeckitTool(name: string, args: Record<string, unknown>): Promise<unknown> {
  const projectPath = (args.path as string) || MIYABI_REPO_PATH;
  const safePath = sanitizePath(projectPath, '.');
  const speckitDir = join(safePath, '.speckit');
  const specsDir = join(safePath, 'specs');

  // speckit_init - Initialize Spec-Kit in project
  if (name === 'speckit_init') {
    try {
      const { mkdir, writeFile } = await import('fs/promises');

      // Create .speckit directory structure
      await mkdir(speckitDir, { recursive: true });
      await mkdir(join(speckitDir, 'templates'), { recursive: true });
      await mkdir(specsDir, { recursive: true });

      // Create default constitution.md
      const constitutionPath = join(safePath, 'memory', 'constitution.md');
      const memoryDir = join(safePath, 'memory');
      if (!existsSync(constitutionPath)) {
        await mkdir(memoryDir, { recursive: true });
        await writeFile(constitutionPath, `# Project Constitution

## Core Principles
1. Code quality over speed
2. User experience first
3. Security by design
4. Test coverage required

## Technology Choices
- Prefer TypeScript for type safety
- Use established patterns
- Document decisions

## Constraints
- No breaking changes without migration path
- All public APIs require documentation
`);
      }

      // Create spec template
      const templatePath = join(speckitDir, 'templates', 'spec-template.md');
      await writeFile(templatePath, `# Feature: [FEATURE_NAME]

## Summary
Brief description of the feature.

## User Stories
- As a [user type], I want to [action] so that [benefit]

## Functional Requirements
1. [Requirement 1]
2. [Requirement 2]

## Success Criteria
- [ ] Criterion 1
- [ ] Criterion 2

## Assumptions
- [Assumption 1]

## Dependencies
- [Dependency 1]
`);

      return {
        success: true,
        message: 'Spec-Kit initialized',
        created: [
          speckitDir,
          join(speckitDir, 'templates'),
          specsDir,
          memoryDir,
          constitutionPath,
          templatePath
        ]
      };
    } catch (error) {
      return { error: error instanceof Error ? error.message : 'Failed to initialize Spec-Kit' };
    }
  }

  // speckit_status - Get project status
  if (name === 'speckit_status') {
    const status = {
      initialized: existsSync(speckitDir),
      hasConstitution: existsSync(join(safePath, 'memory', 'constitution.md')),
      hasSpecs: existsSync(specsDir),
      features: [] as string[]
    };

    if (existsSync(specsDir)) {
      try {
        const entries = await readdir(specsDir, { withFileTypes: true });
        status.features = entries
          .filter(e => e.isDirectory())
          .map(e => e.name);
      } catch { /* ignore */ }
    }

    return status;
  }

  // speckit_constitution - Read or update constitution
  if (name === 'speckit_constitution') {
    const constitutionPath = join(safePath, 'memory', 'constitution.md');
    const content = args.content as string | undefined;

    if (content) {
      // Update constitution
      try {
        const { writeFile, mkdir } = await import('fs/promises');
        await mkdir(join(safePath, 'memory'), { recursive: true });
        await writeFile(constitutionPath, content);
        return { success: true, message: 'Constitution updated' };
      } catch (error) {
        return { error: error instanceof Error ? error.message : 'Failed to update constitution' };
      }
    } else {
      // Read constitution
      if (!existsSync(constitutionPath)) {
        return { error: 'Constitution not found. Run speckit_init first.' };
      }
      const constitutionContent = await readFile(constitutionPath, 'utf-8');
      return { content: constitutionContent };
    }
  }

  // speckit_specify - Create feature specification
  if (name === 'speckit_specify') {
    const feature = args.feature as string;
    if (!feature) return { error: 'Feature description required' };

    // Generate short name from feature description
    const shortName = feature
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .trim()
      .split(/\s+/)
      .slice(0, 4)
      .join('-');

    // Find next available number
    let nextNum = 1;
    if (existsSync(specsDir)) {
      try {
        const entries = await readdir(specsDir, { withFileTypes: true });
        const numbers = entries
          .filter(e => e.isDirectory())
          .map(e => parseInt(e.name.split('-')[0], 10))
          .filter(n => !isNaN(n));
        if (numbers.length > 0) {
          nextNum = Math.max(...numbers) + 1;
        }
      } catch { /* ignore */ }
    }

    const featureDir = join(specsDir, `${nextNum}-${shortName}`);
    const specFile = join(featureDir, 'spec.md');

    try {
      const { mkdir, writeFile } = await import('fs/promises');
      await mkdir(featureDir, { recursive: true });
      await mkdir(join(featureDir, 'checklists'), { recursive: true });

      const specContent = `# Feature: ${feature}

## Summary
${feature}

## User Stories
- As a user, I want to ${feature.toLowerCase()} so that I can accomplish my goal

## Functional Requirements
1. [NEEDS CLARIFICATION: Define primary requirement]

## Success Criteria
- [ ] Feature is implemented and tested
- [ ] Documentation is updated

## Assumptions
- Standard project setup

## Dependencies
- None identified yet
`;

      await writeFile(specFile, specContent);

      return {
        success: true,
        featureId: `${nextNum}-${shortName}`,
        featureDir,
        specFile,
        message: `Feature specification created: ${nextNum}-${shortName}`
      };
    } catch (error) {
      return { error: error instanceof Error ? error.message : 'Failed to create specification' };
    }
  }

  // speckit_plan - Generate implementation plan
  if (name === 'speckit_plan') {
    const feature = args.feature as string;
    if (!feature) return { error: 'Feature name/id required' };

    // Find feature directory
    let featureDir: string | null = null;
    if (existsSync(specsDir)) {
      const entries = await readdir(specsDir, { withFileTypes: true });
      const match = entries.find(e =>
        e.isDirectory() && e.name.includes(feature.toLowerCase().replace(/\s+/g, '-'))
      );
      if (match) featureDir = join(specsDir, match.name);
    }

    if (!featureDir || !existsSync(featureDir)) {
      return { error: `Feature not found: ${feature}. Run speckit_specify first.` };
    }

    const specFile = join(featureDir, 'spec.md');
    if (!existsSync(specFile)) {
      return { error: 'Spec file not found in feature directory' };
    }

    const planFile = join(featureDir, 'plan.md');

    try {
      const { writeFile } = await import('fs/promises');

      const planContent = `# Implementation Plan

## Feature
${feature}

## Technical Context
- **Framework**: [To be determined]
- **Dependencies**: [To be determined]

## Phase 0: Research
- [ ] Review existing codebase patterns
- [ ] Identify integration points
- [ ] Resolve NEEDS CLARIFICATION items

## Phase 1: Design
- [ ] Create data model
- [ ] Define API contracts
- [ ] Plan test strategy

## Phase 2: Implementation
- [ ] Implement core functionality
- [ ] Add tests
- [ ] Update documentation

## Constitution Check
- [ ] Follows project principles
- [ ] Security considered
- [ ] Test coverage planned

## Generated from
\`\`\`
${specFile}
\`\`\`
`;

      await writeFile(planFile, planContent);

      return {
        success: true,
        planFile,
        message: `Implementation plan created: ${planFile}`
      };
    } catch (error) {
      return { error: error instanceof Error ? error.message : 'Failed to create plan' };
    }
  }

  // speckit_tasks - Generate task list
  if (name === 'speckit_tasks') {
    const feature = args.feature as string;
    if (!feature) return { error: 'Feature name/id required' };

    // Find feature directory
    let featureDir: string | null = null;
    if (existsSync(specsDir)) {
      const entries = await readdir(specsDir, { withFileTypes: true });
      const match = entries.find(e =>
        e.isDirectory() && e.name.includes(feature.toLowerCase().replace(/\s+/g, '-'))
      );
      if (match) featureDir = join(specsDir, match.name);
    }

    if (!featureDir) {
      return { error: `Feature not found: ${feature}` };
    }

    const planFile = join(featureDir, 'plan.md');
    if (!existsSync(planFile)) {
      return { error: 'Plan file not found. Run speckit_plan first.' };
    }

    const tasksFile = join(featureDir, 'tasks.md');

    try {
      const { writeFile } = await import('fs/promises');

      const tasksContent = `# Tasks: ${feature}

## Phase 1: Setup
- [ ] T001 Create project structure per implementation plan
- [ ] T002 Install required dependencies

## Phase 2: Foundation
- [ ] T003 Set up base infrastructure
- [ ] T004 Create initial configuration

## Phase 3: Implementation
- [ ] T005 [P] Implement core functionality
- [ ] T006 [P] Add unit tests
- [ ] T007 Integration testing

## Phase 4: Polish
- [ ] T008 Update documentation
- [ ] T009 Code review and cleanup
- [ ] T010 Final testing

## Dependencies
- T003 depends on T001, T002
- T005, T006 can run in parallel after T004
- T008 depends on T005, T006, T007

## Notes
- [P] indicates parallelizable tasks
- Task IDs follow sequential order
`;

      await writeFile(tasksFile, tasksContent);

      return {
        success: true,
        tasksFile,
        taskCount: 10,
        message: `Task list created: ${tasksFile}`
      };
    } catch (error) {
      return { error: error instanceof Error ? error.message : 'Failed to create tasks' };
    }
  }

  // speckit_checklist - Create implementation checklist
  if (name === 'speckit_checklist') {
    const feature = args.feature as string;
    if (!feature) return { error: 'Feature name/id required' };

    // Find feature directory
    let featureDir: string | null = null;
    if (existsSync(specsDir)) {
      const entries = await readdir(specsDir, { withFileTypes: true });
      const match = entries.find(e =>
        e.isDirectory() && e.name.includes(feature.toLowerCase().replace(/\s+/g, '-'))
      );
      if (match) featureDir = join(specsDir, match.name);
    }

    if (!featureDir) {
      return { error: `Feature not found: ${feature}` };
    }

    const checklistDir = join(featureDir, 'checklists');
    const checklistFile = join(checklistDir, 'requirements.md');

    try {
      const { writeFile, mkdir } = await import('fs/promises');
      await mkdir(checklistDir, { recursive: true });

      const checklistContent = `# Specification Quality Checklist: ${feature}

**Purpose**: Validate specification completeness and quality before proceeding to planning
**Created**: ${new Date().toISOString().split('T')[0]}
**Feature**: [specs/${feature}/spec.md]

## Content Quality

- [ ] No implementation details (languages, frameworks, APIs)
- [ ] Focused on user value and business needs
- [ ] Written for non-technical stakeholders
- [ ] All mandatory sections completed

## Requirement Completeness

- [ ] No [NEEDS CLARIFICATION] markers remain
- [ ] Requirements are testable and unambiguous
- [ ] Success criteria are measurable
- [ ] Success criteria are technology-agnostic (no implementation details)
- [ ] All acceptance scenarios are defined
- [ ] Edge cases are identified
- [ ] Scope is clearly bounded
- [ ] Dependencies and assumptions identified

## Feature Readiness

- [ ] All functional requirements have clear acceptance criteria
- [ ] User scenarios cover primary flows
- [ ] Feature meets measurable outcomes defined in Success Criteria
- [ ] No implementation details leak into specification

## Notes

- Items marked incomplete require spec updates before /speckit.clarify or /speckit.plan
`;

      await writeFile(checklistFile, checklistContent);

      return {
        success: true,
        checklistFile,
        message: `Checklist created: ${checklistFile}`
      };
    } catch (error) {
      return { error: error instanceof Error ? error.message : 'Failed to create checklist' };
    }
  }

  // speckit_analyze - Analyze project consistency
  if (name === 'speckit_analyze') {
    const analysis = {
      projectPath: safePath,
      speckit: {
        initialized: existsSync(speckitDir),
        hasTemplates: existsSync(join(speckitDir, 'templates'))
      },
      constitution: {
        exists: existsSync(join(safePath, 'memory', 'constitution.md'))
      },
      features: [] as Array<{
        id: string;
        hasSpec: boolean;
        hasPlan: boolean;
        hasTasks: boolean;
        hasChecklist: boolean;
      }>
    };

    if (existsSync(specsDir)) {
      const entries = await readdir(specsDir, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.isDirectory()) {
          const featurePath = join(specsDir, entry.name);
          analysis.features.push({
            id: entry.name,
            hasSpec: existsSync(join(featurePath, 'spec.md')),
            hasPlan: existsSync(join(featurePath, 'plan.md')),
            hasTasks: existsSync(join(featurePath, 'tasks.md')),
            hasChecklist: existsSync(join(featurePath, 'checklists', 'requirements.md'))
          });
        }
      }
    }

    const issues: string[] = [];
    if (!analysis.speckit.initialized) {
      issues.push('Spec-Kit not initialized. Run speckit_init.');
    }
    if (!analysis.constitution.exists) {
      issues.push('Constitution missing. Run speckit_init or speckit_constitution.');
    }
    for (const f of analysis.features) {
      if (!f.hasSpec) issues.push(`Feature ${f.id} missing spec.md`);
      if (f.hasSpec && !f.hasPlan) issues.push(`Feature ${f.id} has spec but no plan`);
    }

    return {
      ...analysis,
      issues,
      isConsistent: issues.length === 0
    };
  }

  // speckit_list_features - List all features
  if (name === 'speckit_list_features') {
    if (!existsSync(specsDir)) {
      return { features: [], message: 'No specs directory found. Run speckit_init.' };
    }

    const entries = await readdir(specsDir, { withFileTypes: true });
    const features = await Promise.all(
      entries
        .filter(e => e.isDirectory())
        .map(async (e) => {
          const featurePath = join(specsDir, e.name);
          const specFile = join(featurePath, 'spec.md');
          let summary = '';

          if (existsSync(specFile)) {
            const content = await readFile(specFile, 'utf-8');
            const summaryMatch = content.match(/## Summary\n([^\n]+)/);
            if (summaryMatch) summary = summaryMatch[1].trim();
          }

          return {
            id: e.name,
            summary,
            hasSpec: existsSync(specFile),
            hasPlan: existsSync(join(featurePath, 'plan.md')),
            hasTasks: existsSync(join(featurePath, 'tasks.md'))
          };
        })
    );

    return { features, count: features.length };
  }

  return { error: `Unknown speckit tool: ${name}` };
}

// ========== MCP Tool Discovery Handler ==========
async function handleMcpTool(name: string, args: Record<string, unknown>): Promise<unknown> {
  // mcp_search_tools - Search tools by name or description
  if (name === 'mcp_search_tools') {
    const query = (args.query as string || '').toLowerCase();
    const category = (args.category as string || '').toLowerCase();

    let results = tools;

    // Filter by category prefix
    if (category) {
      results = results.filter(t => t.name.toLowerCase().startsWith(category));
    }

    // Filter by query (matches name or description)
    if (query) {
      results = results.filter(t =>
        t.name.toLowerCase().includes(query) ||
        (t.description && t.description.toLowerCase().includes(query))
      );
    }

    return {
      query,
      category: category || 'all',
      count: results.length,
      tools: results.map(t => ({
        name: t.name,
        description: t.description
      }))
    };
  }

  // mcp_list_categories - List all categories with counts
  if (name === 'mcp_list_categories') {
    const categories: Record<string, { count: number; description: string }> = {};

    const categoryDescriptions: Record<string, string> = {
      git: 'Git version control operations',
      tmux: 'Terminal multiplexer management',
      log: 'Log file analysis and search',
      resource: 'System resource monitoring (CPU, memory, disk)',
      network: 'Network inspection and diagnostics',
      process: 'Process management and monitoring',
      file: 'File system operations and watching',
      claude: 'Claude Code session management',
      github: 'GitHub API integration (issues, PRs, workflows)',
      linux: 'Linux systemd service management',
      windows: 'Windows service and event log',
      docker: 'Docker container management',
      compose: 'Docker Compose orchestration',
      k8s: 'Kubernetes cluster management',
      speckit: 'Spec-Driven Development workflow',
      mcp: 'MCP tool discovery and search',
      health: 'System health check',
      db: 'Database operations (SQLite, PostgreSQL, MySQL)',
      time: 'Time and timezone utilities',
      calc: 'Mathematical calculations and conversions',
      think: 'Sequential reasoning and thought chains',
      gen: 'Data generators (UUID, password, hash)'
    };

    for (const tool of tools) {
      const prefix = tool.name.split('_')[0];
      if (!categories[prefix]) {
        categories[prefix] = {
          count: 0,
          description: categoryDescriptions[prefix] || 'Miscellaneous tools'
        };
      }
      categories[prefix].count++;
    }

    const sortedCategories = Object.entries(categories)
      .sort((a, b) => b[1].count - a[1].count)
      .map(([name, info]) => ({
        category: name,
        ...info
      }));

    return {
      totalTools: tools.length,
      categoryCount: sortedCategories.length,
      categories: sortedCategories
    };
  }

  // mcp_get_tool_info - Get detailed info about a specific tool
  if (name === 'mcp_get_tool_info') {
    const toolName = args.tool as string;
    if (!toolName) return { error: 'Tool name required' };

    const tool = tools.find(t => t.name === toolName);
    if (!tool) {
      // Try fuzzy match
      const matches = tools.filter(t =>
        t.name.toLowerCase().includes(toolName.toLowerCase())
      );
      if (matches.length > 0) {
        return {
          error: `Tool '${toolName}' not found`,
          suggestions: matches.slice(0, 5).map(t => t.name)
        };
      }
      return { error: `Tool '${toolName}' not found` };
    }

    // Parse schema for parameters
    const schema = tool.inputSchema as {
      properties?: Record<string, { type: string; description?: string; enum?: string[] }>;
      required?: string[];
    };

    const parameters = schema.properties
      ? Object.entries(schema.properties).map(([name, prop]) => ({
          name,
          type: prop.type,
          description: prop.description || '',
          required: schema.required?.includes(name) || false,
          enum: prop.enum
        }))
      : [];

    return {
      name: tool.name,
      description: tool.description,
      category: tool.name.split('_')[0],
      parameters,
      requiredParams: schema.required || [],
      example: `Call with: { ${parameters.map(p => `"${p.name}": ${p.type === 'string' ? '"value"' : p.type === 'number' ? '123' : p.type === 'boolean' ? 'true' : '...'}`).join(', ')} }`
    };
  }

  return { error: `Unknown mcp tool: ${name}` };
}

// ========== Database Foundation Handler ==========
interface DbConnectionArgs {
  type: 'sqlite' | 'postgresql' | 'mysql';
  connection?: string;
  host?: string;
  port?: number;
  database?: string;
  user?: string;
  password?: string;
}

function buildDbCommand(args: DbConnectionArgs, sqlCommand: string): { cmd: string; env?: Record<string, string> } {
  const { type, connection, host, port, database, user, password } = args;

  switch (type) {
    case 'sqlite': {
      const dbPath = sanitizeShellArg(connection || ':memory:');
      return { cmd: `sqlite3 -json "${dbPath}" "${sqlCommand}"` };
    }
    case 'postgresql': {
      const pgHost = sanitizeShellArg(host || 'localhost');
      const pgPort = port || 5432;
      const pgDb = sanitizeShellArg(database || 'postgres');
      const pgUser = sanitizeShellArg(user || 'postgres');
      const env: Record<string, string> = {};
      if (password) env.PGPASSWORD = password;
      return {
        cmd: `psql -h "${pgHost}" -p ${pgPort} -U "${pgUser}" -d "${pgDb}" -t -A -c "${sqlCommand}"`,
        env
      };
    }
    case 'mysql': {
      const myHost = sanitizeShellArg(host || 'localhost');
      const myPort = port || 3306;
      const myDb = sanitizeShellArg(database || '');
      const myUser = sanitizeShellArg(user || 'root');
      const dbFlag = myDb ? `-D "${myDb}"` : '';
      const passFlag = password ? `-p"${sanitizeShellArg(password)}"` : '';
      return {
        cmd: `mysql -h "${myHost}" -P ${myPort} -u "${myUser}" ${passFlag} ${dbFlag} -N -e "${sqlCommand}"`
      };
    }
    default:
      throw new Error(`Unsupported database type: ${type}`);
  }
}

async function handleDbTool(name: string, args: Record<string, unknown>): Promise<unknown> {
  const dbArgs = args as unknown as DbConnectionArgs;
  const dbType = dbArgs.type;

  if (!dbType) {
    return { error: 'Database type required (sqlite, postgresql, mysql)' };
  }

  // Check if CLI tool exists
  const cliTool = dbType === 'sqlite' ? 'sqlite3' : dbType === 'postgresql' ? 'psql' : 'mysql';
  if (!await commandExists(cliTool)) {
    return { error: `${cliTool} CLI not found. Install ${dbType} client tools.` };
  }

  // db_connect - Test connection
  if (name === 'db_connect') {
    try {
      const testQuery = dbType === 'sqlite' ? 'SELECT 1' :
        dbType === 'postgresql' ? 'SELECT 1' : 'SELECT 1';
      const { cmd, env } = buildDbCommand(dbArgs, testQuery);
      const { stdout } = await execAsync(cmd, { timeout: 10000, env: { ...process.env, ...env } });
      return {
        success: true,
        type: dbType,
        message: `Connected to ${dbType} successfully`,
        result: stdout.trim()
      };
    } catch (error) {
      return {
        success: false,
        type: dbType,
        error: error instanceof Error ? error.message : 'Connection failed'
      };
    }
  }

  // db_tables - List tables
  if (name === 'db_tables') {
    try {
      let query: string;
      switch (dbType) {
        case 'sqlite':
          query = "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name";
          break;
        case 'postgresql':
          query = "SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename";
          break;
        case 'mysql':
          query = 'SHOW TABLES';
          break;
      }
      const { cmd, env } = buildDbCommand(dbArgs, query);
      const { stdout } = await execAsync(cmd, { timeout: 30000, env: { ...process.env, ...env } });

      const tables = stdout.trim().split('\n').filter(Boolean);
      return {
        type: dbType,
        count: tables.length,
        tables
      };
    } catch (error) {
      return { error: error instanceof Error ? error.message : 'Failed to list tables' };
    }
  }

  // db_schema - Get table schema
  if (name === 'db_schema') {
    const table = sanitizeShellArg(args.table as string);
    if (!table) return { error: 'Table name required' };

    try {
      let query: string;
      switch (dbType) {
        case 'sqlite':
          query = `PRAGMA table_info(${table})`;
          break;
        case 'postgresql':
          query = `SELECT column_name, data_type, is_nullable, column_default FROM information_schema.columns WHERE table_name = '${table}' ORDER BY ordinal_position`;
          break;
        case 'mysql':
          query = `DESCRIBE ${table}`;
          break;
      }
      const { cmd, env } = buildDbCommand(dbArgs, query);
      const { stdout } = await execAsync(cmd, { timeout: 30000, env: { ...process.env, ...env } });

      return {
        type: dbType,
        table,
        schema: stdout.trim()
      };
    } catch (error) {
      return { error: error instanceof Error ? error.message : 'Failed to get schema' };
    }
  }

  // db_query - Execute SELECT query
  if (name === 'db_query') {
    const query = args.query as string;
    if (!query) return { error: 'Query required' };

    // Security: Only allow SELECT queries
    const upperQuery = query.trim().toUpperCase();
    if (!upperQuery.startsWith('SELECT') && !upperQuery.startsWith('WITH')) {
      return { error: 'Only SELECT queries allowed (read-only). Use SELECT or WITH...SELECT.' };
    }

    // Block dangerous patterns
    const dangerousPatterns = [
      /;\s*(DROP|DELETE|UPDATE|INSERT|ALTER|CREATE|TRUNCATE|GRANT|REVOKE)/i,
      /INTO\s+OUTFILE/i,
      /INTO\s+DUMPFILE/i,
      /LOAD_FILE/i
    ];
    for (const pattern of dangerousPatterns) {
      if (pattern.test(query)) {
        return { error: 'Query contains blocked pattern' };
      }
    }

    const limit = Math.min(Math.max((args.limit as number) || 100, 1), 1000);
    let limitedQuery = query;
    if (!upperQuery.includes('LIMIT')) {
      limitedQuery = `${query.replace(/;?\s*$/, '')} LIMIT ${limit}`;
    }

    try {
      const { cmd, env } = buildDbCommand(dbArgs, sanitizeShellArg(limitedQuery));
      const { stdout } = await execAsync(cmd, { timeout: 60000, env: { ...process.env, ...env } });

      const rows = stdout.trim().split('\n').filter(Boolean);
      return {
        type: dbType,
        query: limitedQuery,
        rowCount: rows.length,
        result: rows
      };
    } catch (error) {
      return { error: error instanceof Error ? error.message : 'Query failed' };
    }
  }

  // db_explain - Query execution plan
  if (name === 'db_explain') {
    const query = args.query as string;
    if (!query) return { error: 'Query required' };

    try {
      let explainQuery: string;
      switch (dbType) {
        case 'sqlite':
          explainQuery = `EXPLAIN QUERY PLAN ${query}`;
          break;
        case 'postgresql':
          explainQuery = `EXPLAIN (FORMAT TEXT) ${query}`;
          break;
        case 'mysql':
          explainQuery = `EXPLAIN ${query}`;
          break;
      }
      const { cmd, env } = buildDbCommand(dbArgs, sanitizeShellArg(explainQuery));
      const { stdout } = await execAsync(cmd, { timeout: 30000, env: { ...process.env, ...env } });

      return {
        type: dbType,
        query,
        plan: stdout.trim()
      };
    } catch (error) {
      return { error: error instanceof Error ? error.message : 'Explain failed' };
    }
  }

  // db_health - Database health check
  if (name === 'db_health') {
    try {
      const health: Record<string, unknown> = {
        type: dbType,
        connected: false
      };

      // Test connection
      const testQuery = 'SELECT 1';
      const { cmd: testCmd, env } = buildDbCommand(dbArgs, testQuery);
      try {
        await execAsync(testCmd, { timeout: 10000, env: { ...process.env, ...env } });
        health.connected = true;
      } catch {
        return { ...health, error: 'Connection failed' };
      }

      // Get database-specific stats
      let statsQuery: string;
      switch (dbType) {
        case 'sqlite':
          statsQuery = "SELECT 'tables' as metric, COUNT(*) as value FROM sqlite_master WHERE type='table'";
          break;
        case 'postgresql':
          statsQuery = "SELECT 'size' as metric, pg_database_size(current_database()) as value";
          break;
        case 'mysql':
          statsQuery = "SELECT 'uptime' as metric, VARIABLE_VALUE as value FROM performance_schema.global_status WHERE VARIABLE_NAME = 'Uptime'";
          break;
      }

      const { cmd: statsCmd, env: statsEnv } = buildDbCommand(dbArgs, statsQuery);
      try {
        const { stdout } = await execAsync(statsCmd, { timeout: 10000, env: { ...process.env, ...statsEnv } });
        health.stats = stdout.trim();
      } catch {
        health.stats = 'Unable to fetch stats';
      }

      return health;
    } catch (error) {
      return { error: error instanceof Error ? error.message : 'Health check failed' };
    }
  }

  return { error: `Unknown db tool: ${name}` };
}

// ========== Time Tools Handler ==========
async function handleTimeTool(name: string, args: Record<string, unknown>): Promise<unknown> {
  // time_current - Get current time in timezone
  if (name === 'time_current') {
    const timezone = (args.timezone as string) || 'UTC';
    const format = (args.format as string) || 'iso';

    try {
      const now = new Date();
      const options: Intl.DateTimeFormatOptions = {
        timeZone: timezone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
      };

      if (format === 'unix') {
        return { timestamp: Math.floor(now.getTime() / 1000), timezone };
      } else if (format === 'human') {
        const formatter = new Intl.DateTimeFormat('en-US', { ...options, weekday: 'long' });
        return { time: formatter.format(now), timezone };
      } else {
        // ISO format
        const formatter = new Intl.DateTimeFormat('sv-SE', options);
        const formatted = formatter.format(now).replace(' ', 'T');
        return { time: formatted, timezone, iso: now.toISOString() };
      }
    } catch (error) {
      return { error: `Invalid timezone: ${timezone}` };
    }
  }

  // time_convert - Convert between timezones
  if (name === 'time_convert') {
    const timeStr = args.time as string;
    const fromTz = (args.from as string) || 'UTC';
    const toTz = args.to as string;

    try {
      // Parse the input time
      let date: Date;
      if (/^\d+$/.test(timeStr)) {
        // Unix timestamp
        date = new Date(parseInt(timeStr) * 1000);
      } else {
        date = new Date(timeStr);
      }

      if (isNaN(date.getTime())) {
        return { error: 'Invalid time format' };
      }

      const options: Intl.DateTimeFormatOptions = {
        timeZone: toTz,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
      };

      const formatter = new Intl.DateTimeFormat('sv-SE', options);
      return {
        original: timeStr,
        from: fromTz,
        to: toTz,
        converted: formatter.format(date).replace(' ', 'T'),
        unix: Math.floor(date.getTime() / 1000)
      };
    } catch (error) {
      return { error: error instanceof Error ? error.message : 'Conversion failed' };
    }
  }

  // time_format - Format datetime string
  if (name === 'time_format') {
    const timeStr = args.time as string;
    const formatStr = args.format as string;
    const timezone = (args.timezone as string) || 'UTC';

    try {
      const date = new Date(timeStr);
      if (isNaN(date.getTime())) {
        return { error: 'Invalid time format' };
      }

      // Simple format string replacement
      const parts: Record<string, string> = {};

      const getPart = (opt: Intl.DateTimeFormatOptions): string => {
        return new Intl.DateTimeFormat('en-US', { ...opt, timeZone: timezone }).format(date);
      };

      parts.YYYY = getPart({ year: 'numeric' });
      parts.MM = getPart({ month: '2-digit' });
      parts.DD = getPart({ day: '2-digit' });
      parts.HH = getPart({ hour: '2-digit', hour12: false }).padStart(2, '0');
      parts.mm = getPart({ minute: '2-digit' }).padStart(2, '0');
      parts.ss = getPart({ second: '2-digit' }).padStart(2, '0');

      let result = formatStr;
      for (const [key, value] of Object.entries(parts)) {
        result = result.replace(key, value);
      }

      return { formatted: result, original: timeStr, timezone };
    } catch (error) {
      return { error: error instanceof Error ? error.message : 'Format failed' };
    }
  }

  // time_diff - Calculate time difference
  if (name === 'time_diff') {
    const startStr = args.start as string;
    const endStr = (args.end as string) || new Date().toISOString();
    const unit = (args.unit as string) || 'seconds';

    try {
      const start = new Date(startStr);
      const end = new Date(endStr);

      if (isNaN(start.getTime()) || isNaN(end.getTime())) {
        return { error: 'Invalid time format' };
      }

      const diffMs = end.getTime() - start.getTime();
      const divisors: Record<string, number> = {
        seconds: 1000,
        minutes: 60000,
        hours: 3600000,
        days: 86400000,
        weeks: 604800000
      };

      const divisor = divisors[unit] || 1000;
      const diff = diffMs / divisor;

      return {
        start: start.toISOString(),
        end: end.toISOString(),
        difference: diff,
        unit,
        milliseconds: diffMs
      };
    } catch (error) {
      return { error: error instanceof Error ? error.message : 'Diff calculation failed' };
    }
  }

  return { error: `Unknown time tool: ${name}` };
}

// ========== Calculator Tools Handler ==========
async function handleCalcTool(name: string, args: Record<string, unknown>): Promise<unknown> {
  // calc_expression - Safe math expression evaluation
  if (name === 'calc_expression') {
    const expression = args.expression as string;
    const precision = Math.min(Math.max((args.precision as number) || 10, 0), 20);

    // Security: Only allow safe math operations
    const safeExpression = expression
      .replace(/\s+/g, '')
      .toLowerCase();

    // Validate - only allow numbers, operators, and math functions
    const allowedPattern = /^[\d+\-*/().%^e,\s]*(sqrt|sin|cos|tan|log|ln|abs|ceil|floor|round|pow|exp|pi|e)*[\d+\-*/().%^e,\s]*$/i;
    if (!allowedPattern.test(safeExpression)) {
      return { error: 'Invalid expression. Only math operations allowed.' };
    }

    // Block dangerous patterns
    if (/[a-z]{4,}/i.test(safeExpression.replace(/(sqrt|sin|cos|tan|log|abs|ceil|floor|round|pow|exp)/gi, ''))) {
      return { error: 'Invalid expression' };
    }

    try {
      // Build safe evaluator
      const mathFns: Record<string, unknown> = {
        sqrt: Math.sqrt,
        sin: Math.sin,
        cos: Math.cos,
        tan: Math.tan,
        log: Math.log10,
        ln: Math.log,
        abs: Math.abs,
        ceil: Math.ceil,
        floor: Math.floor,
        round: Math.round,
        pow: Math.pow,
        exp: Math.exp,
        PI: Math.PI,
        E: Math.E
      };

      let evalExpr = safeExpression
        .replace(/pi/gi, String(Math.PI))
        .replace(/\^/g, '**');

      // Replace function calls
      for (const [fn, impl] of Object.entries(mathFns)) {
        if (typeof impl === 'function') {
          const regex = new RegExp(`${fn}\\(([^)]+)\\)`, 'gi');
          evalExpr = evalExpr.replace(regex, (_, arg) => {
            const argVal = parseFloat(arg);
            if (!isNaN(argVal)) {
              return String((impl as (x: number) => number)(argVal));
            }
            return _;
          });
        }
      }

      // Final safety check - only numbers and operators
      if (!/^[\d+\-*/().%\s*e]+$/.test(evalExpr)) {
        return { error: 'Invalid expression after parsing' };
      }

      // Use Function constructor for safe eval (no access to scope)
      const result = new Function(`return (${evalExpr})`)();

      if (typeof result !== 'number' || !isFinite(result)) {
        return { error: 'Result is not a valid number' };
      }

      return {
        expression,
        result: parseFloat(result.toFixed(precision)),
        precision
      };
    } catch (error) {
      return { error: error instanceof Error ? error.message : 'Evaluation failed' };
    }
  }

  // calc_unit_convert - Unit conversion
  if (name === 'calc_unit_convert') {
    const value = args.value as number;
    const from = (args.from as string).toLowerCase();
    const to = (args.to as string).toLowerCase();

    // Temperature units (special handling - not ratio-based)
    const tempUnits: Record<string, string> = {
      celsius: 'c', c: 'c',
      fahrenheit: 'f', f: 'f',
      kelvin: 'k', k: 'k'
    };

    // Check if temperature conversion
    if (from in tempUnits && to in tempUnits) {
      const fromUnit = tempUnits[from];
      const toUnit = tempUnits[to];

      let celsius: number;
      // Convert to Celsius first
      if (fromUnit === 'c') celsius = value;
      else if (fromUnit === 'f') celsius = (value - 32) * 5 / 9;
      else celsius = value - 273.15; // Kelvin

      // Convert from Celsius to target
      let result: number;
      if (toUnit === 'c') result = celsius;
      else if (toUnit === 'f') result = celsius * 9 / 5 + 32;
      else result = celsius + 273.15; // Kelvin

      return { value, from, to, result: parseFloat(result.toFixed(4)) };
    }

    // Conversion tables (to base unit)
    const conversions: Record<string, Record<string, number>> = {
      // Length (base: meters)
      length: {
        m: 1, meter: 1, meters: 1,
        km: 1000, kilometer: 1000, kilometers: 1000,
        cm: 0.01, centimeter: 0.01,
        mm: 0.001, millimeter: 0.001,
        mi: 1609.344, mile: 1609.344, miles: 1609.344,
        yd: 0.9144, yard: 0.9144, yards: 0.9144,
        ft: 0.3048, foot: 0.3048, feet: 0.3048,
        in: 0.0254, inch: 0.0254, inches: 0.0254
      },
      // Weight (base: grams)
      weight: {
        g: 1, gram: 1, grams: 1,
        kg: 1000, kilogram: 1000,
        mg: 0.001, milligram: 0.001,
        lb: 453.592, pound: 453.592, pounds: 453.592,
        oz: 28.3495, ounce: 28.3495, ounces: 28.3495,
        ton: 1000000, t: 1000000
      },
      // Volume (base: liters)
      volume: {
        l: 1, liter: 1, liters: 1,
        ml: 0.001, milliliter: 0.001,
        gal: 3.78541, gallon: 3.78541, gallons: 3.78541,
        qt: 0.946353, quart: 0.946353,
        pt: 0.473176, pint: 0.473176,
        cup: 0.236588, cups: 0.236588,
        floz: 0.0295735
      },
      // Data (base: bytes)
      data: {
        b: 1, byte: 1, bytes: 1,
        kb: 1024, kilobyte: 1024,
        mb: 1048576, megabyte: 1048576,
        gb: 1073741824, gigabyte: 1073741824,
        tb: 1099511627776, terabyte: 1099511627776
      }
    };

    // Find the category for these units
    let category: string | null = null;
    for (const [cat, units] of Object.entries(conversions)) {
      if (from in units && to in units) {
        category = cat;
        break;
      }
    }

    if (!category) {
      return { error: `Cannot convert between ${from} and ${to}` };
    }

    // Standard conversion
    const units = conversions[category];
    const baseValue = value * units[from];
    const result = baseValue / units[to];

    return { value, from, to, result: parseFloat(result.toFixed(6)) };
  }

  // calc_statistics - Statistical calculations
  if (name === 'calc_statistics') {
    const data = args.data as number[];
    const metrics = (args.metrics as string[]) || ['mean', 'median', 'min', 'max', 'count'];

    if (!Array.isArray(data) || data.length === 0) {
      return { error: 'Data must be a non-empty array of numbers' };
    }

    const sorted = [...data].sort((a, b) => a - b);
    const n = data.length;
    const sum = data.reduce((a, b) => a + b, 0);
    const mean = sum / n;

    const results: Record<string, number> = {};

    for (const metric of metrics) {
      switch (metric) {
        case 'mean':
          results.mean = parseFloat(mean.toFixed(6));
          break;
        case 'median':
          results.median = n % 2 === 0
            ? (sorted[n / 2 - 1] + sorted[n / 2]) / 2
            : sorted[Math.floor(n / 2)];
          break;
        case 'mode':
          const freq: Record<number, number> = {};
          let maxFreq = 0, mode = data[0];
          for (const x of data) {
            freq[x] = (freq[x] || 0) + 1;
            if (freq[x] > maxFreq) { maxFreq = freq[x]; mode = x; }
          }
          results.mode = mode;
          break;
        case 'stddev':
          const variance = data.reduce((acc, x) => acc + Math.pow(x - mean, 2), 0) / n;
          results.stddev = parseFloat(Math.sqrt(variance).toFixed(6));
          break;
        case 'variance':
          results.variance = parseFloat((data.reduce((acc, x) => acc + Math.pow(x - mean, 2), 0) / n).toFixed(6));
          break;
        case 'min':
          results.min = sorted[0];
          break;
        case 'max':
          results.max = sorted[n - 1];
          break;
        case 'sum':
          results.sum = sum;
          break;
        case 'count':
          results.count = n;
          break;
      }
    }

    return { data: { count: n }, statistics: results };
  }

  return { error: `Unknown calc tool: ${name}` };
}

// ========== Sequential Thinking Handler ==========
// In-memory storage for thinking sessions
const thinkingSessions = new Map<string, {
  steps: Array<{ id: number; thought: string; type: string; confidence: number; timestamp: string }>;
  branches: Map<string, { fromStep: number; steps: Array<{ id: number; thought: string; type: string; confidence: number; timestamp: string }> }>;
  created: string;
}>();

async function handleThinkTool(name: string, args: Record<string, unknown>): Promise<unknown> {
  // think_step - Record a thinking step
  if (name === 'think_step') {
    const thought = args.thought as string;
    const type = (args.type as string) || 'observation';
    const confidence = Math.min(Math.max((args.confidence as number) || 0.5, 0), 1);
    let sessionId = args.sessionId as string;

    // Create or get session
    if (!sessionId) {
      sessionId = `think_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      thinkingSessions.set(sessionId, {
        steps: [],
        branches: new Map(),
        created: new Date().toISOString()
      });
    }

    const session = thinkingSessions.get(sessionId);
    if (!session) {
      return { error: `Session not found: ${sessionId}` };
    }

    const step = {
      id: session.steps.length + 1,
      thought,
      type,
      confidence,
      timestamp: new Date().toISOString()
    };

    session.steps.push(step);

    return {
      sessionId,
      step,
      totalSteps: session.steps.length,
      hint: session.steps.length === 1 ? 'Use sessionId in future calls to continue this chain' : undefined
    };
  }

  // think_branch - Create alternative thinking branch
  if (name === 'think_branch') {
    const sessionId = args.sessionId as string;
    const branchName = args.branchName as string;
    const fromStep = (args.fromStep as number) || 0;

    const session = thinkingSessions.get(sessionId);
    if (!session) {
      return { error: `Session not found: ${sessionId}` };
    }

    if (session.branches.has(branchName)) {
      return { error: `Branch ${branchName} already exists` };
    }

    session.branches.set(branchName, {
      fromStep,
      steps: []
    });

    return {
      sessionId,
      branchName,
      fromStep,
      mainSteps: session.steps.length,
      totalBranches: session.branches.size
    };
  }

  // think_summarize - Summarize thinking session
  if (name === 'think_summarize') {
    const sessionId = args.sessionId as string;
    const includeAlternatives = args.includeAlternatives as boolean ?? true;

    const session = thinkingSessions.get(sessionId);
    if (!session) {
      return { error: `Session not found: ${sessionId}` };
    }

    const observations = session.steps.filter(s => s.type === 'observation');
    const hypotheses = session.steps.filter(s => s.type === 'hypothesis');
    const analyses = session.steps.filter(s => s.type === 'analysis');
    const conclusions = session.steps.filter(s => s.type === 'conclusion');
    const questions = session.steps.filter(s => s.type === 'question');

    const avgConfidence = session.steps.length > 0
      ? session.steps.reduce((sum, s) => sum + s.confidence, 0) / session.steps.length
      : 0;

    const summary: Record<string, unknown> = {
      sessionId,
      created: session.created,
      totalSteps: session.steps.length,
      breakdown: {
        observations: observations.length,
        hypotheses: hypotheses.length,
        analyses: analyses.length,
        conclusions: conclusions.length,
        questions: questions.length
      },
      averageConfidence: parseFloat(avgConfidence.toFixed(2)),
      steps: session.steps
    };

    if (includeAlternatives && session.branches.size > 0) {
      summary.branches = Array.from(session.branches.entries()).map(([name, branch]) => ({
        name,
        fromStep: branch.fromStep,
        steps: branch.steps.length
      }));
    }

    // Extract key conclusions
    if (conclusions.length > 0) {
      summary.keyConclusions = conclusions.map(c => ({
        thought: c.thought,
        confidence: c.confidence
      }));
    }

    return summary;
  }

  return { error: `Unknown think tool: ${name}` };
}

// ========== Generator Tools Handler ==========
async function handleGenTool(name: string, args: Record<string, unknown>): Promise<unknown> {
  // gen_uuid - Generate UUID
  if (name === 'gen_uuid') {
    const version = (args.version as number) || 4;
    const count = Math.min(Math.max((args.count as number) || 1, 1), 100);

    const uuids: string[] = [];

    for (let i = 0; i < count; i++) {
      if (version === 4) {
        // UUID v4 (random)
        const bytes = new Uint8Array(16);
        crypto.getRandomValues(bytes);
        bytes[6] = (bytes[6] & 0x0f) | 0x40; // Version 4
        bytes[8] = (bytes[8] & 0x3f) | 0x80; // Variant

        const hex = Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
        uuids.push(
          `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
        );
      } else {
        // UUID v1 (time-based approximation)
        const now = Date.now();
        const uuid = 'xxxxxxxx-xxxx-1xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
          const r = (now + Math.random() * 16) % 16 | 0;
          return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
        });
        uuids.push(uuid);
      }
    }

    return count === 1 ? { uuid: uuids[0], version } : { uuids, version, count };
  }

  // gen_random - Generate random numbers
  if (name === 'gen_random') {
    const min = (args.min as number) ?? 0;
    const max = (args.max as number) ?? 100;
    const count = Math.min(Math.max((args.count as number) || 1, 1), 1000);
    const type = (args.type as string) || 'integer';

    const values: number[] = [];

    for (let i = 0; i < count; i++) {
      if (type === 'float') {
        values.push(parseFloat((Math.random() * (max - min) + min).toFixed(6)));
      } else {
        values.push(Math.floor(Math.random() * (max - min + 1)) + min);
      }
    }

    return count === 1
      ? { value: values[0], min, max, type }
      : { values, min, max, type, count };
  }

  // gen_hash - Generate hash
  if (name === 'gen_hash') {
    const input = args.input as string;
    const algorithm = (args.algorithm as string) || 'sha256';
    const encoding = (args.encoding as string) || 'hex';

    const validAlgorithms = ['md5', 'sha1', 'sha256', 'sha512'];
    if (!validAlgorithms.includes(algorithm)) {
      return { error: `Invalid algorithm. Use: ${validAlgorithms.join(', ')}` };
    }

    const hash = createHash(algorithm).update(input).digest(encoding as 'hex' | 'base64');

    return { input: input.slice(0, 50) + (input.length > 50 ? '...' : ''), algorithm, encoding, hash };
  }

  // gen_password - Generate secure password
  if (name === 'gen_password') {
    const length = Math.min(Math.max((args.length as number) || 16, 8), 128);
    const uppercase = args.uppercase !== false;
    const lowercase = args.lowercase !== false;
    const numbers = args.numbers !== false;
    const symbols = args.symbols !== false;
    const excludeSimilar = args.excludeSimilar === true;

    let chars = '';
    if (uppercase) chars += excludeSimilar ? 'ABCDEFGHJKLMNPQRSTUVWXYZ' : 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    if (lowercase) chars += excludeSimilar ? 'abcdefghjkmnpqrstuvwxyz' : 'abcdefghijklmnopqrstuvwxyz';
    if (numbers) chars += excludeSimilar ? '23456789' : '0123456789';
    if (symbols) chars += '!@#$%^&*()_+-=[]{}|;:,.<>?';

    if (chars.length === 0) {
      return { error: 'At least one character set must be enabled' };
    }

    // Use crypto for secure random
    const bytes = new Uint8Array(length);
    crypto.getRandomValues(bytes);

    let password = '';
    for (let i = 0; i < length; i++) {
      password += chars[bytes[i] % chars.length];
    }

    // Calculate entropy
    const entropy = Math.floor(length * Math.log2(chars.length));

    return {
      password,
      length,
      entropy: `${entropy} bits`,
      strength: entropy < 40 ? 'weak' : entropy < 60 ? 'fair' : entropy < 80 ? 'strong' : 'very strong'
    };
  }

  return { error: `Unknown gen tool: ${name}` };
}

// ========== Main Server ==========
const server = new Server(
  {
    name: 'miyabi-mcp-bundle',
    version: '3.6.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return { tools };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  const result = await handleTool(name, args as Record<string, unknown> || {});

  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(result, null, 2),
      },
    ],
  };
});

async function main() {
  console.error('');
  console.error('┌────────────────────────────────────────────────┐');
  console.error('│  🌸 Miyabi MCP Bundle v3.6.0                   │');
  console.error('│  The Most Comprehensive MCP Server             │');
  console.error('├────────────────────────────────────────────────┤');
  console.error(`│  📂 Repository: ${MIYABI_REPO_PATH.slice(0, 28).padEnd(28)} │`);
  console.error(`│  🔧 Tools: ${String(tools.length).padEnd(35)} │`);
  console.error(`│  🔐 Security: Enterprise-grade                 │`);
  console.error('└────────────────────────────────────────────────┘');
  console.error('');

  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch(console.error);
