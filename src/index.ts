#!/usr/bin/env node
/**
 * Miyabi MCP Bundle - All-in-One Monitoring and Control Server
 *
 * A comprehensive MCP server with 100+ tools across 9 categories:
 * - Git Inspector (15 tools)
 * - Tmux Monitor (10 tools)
 * - Log Aggregator (7 tools)
 * - Resource Monitor (10 tools)
 * - Network Inspector (12 tools)
 * - Process Inspector (12 tools)
 * - File Watcher (10 tools)
 * - Claude Code Monitor (8 tools)
 * - GitHub Integration (18 tools)
 *
 * @version 3.0.0
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
/**
 * Sanitize shell argument to prevent command injection
 */
function sanitizeShellArg(arg: string): string {
  if (!arg) return '';
  return arg.replace(/[;&|`$(){}[\]<>\\!#*?~\n\r]/g, '');
}

/**
 * Validate and sanitize path to prevent traversal attacks
 */
function sanitizePath(basePath: string, userPath: string): string {
  const resolved = resolve(basePath, userPath);
  if (!resolved.startsWith(resolve(basePath))) {
    throw new Error('Path traversal detected');
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
  // === Git Inspector (15 tools) ===
  { name: 'git_status', description: 'Get current git status (modified, staged, untracked files)', inputSchema: { type: 'object', properties: {} } },
  { name: 'git_branch_list', description: 'List all branches with remote tracking info', inputSchema: { type: 'object', properties: {} } },
  { name: 'git_current_branch', description: 'Get current branch name', inputSchema: { type: 'object', properties: {} } },
  { name: 'git_log', description: 'Get commit history', inputSchema: { type: 'object', properties: { limit: { type: 'number', description: 'Number of commits (default: 20)' } } } },
  { name: 'git_worktree_list', description: 'List all git worktrees', inputSchema: { type: 'object', properties: {} } },
  { name: 'git_diff', description: 'Get diff of unstaged changes', inputSchema: { type: 'object', properties: { file: { type: 'string', description: 'Specific file to diff' } } } },
  { name: 'git_staged_diff', description: 'Get diff of staged changes', inputSchema: { type: 'object', properties: {} } },
  { name: 'git_remote_list', description: 'List all remotes', inputSchema: { type: 'object', properties: {} } },
  { name: 'git_branch_ahead_behind', description: 'Check commits ahead/behind origin', inputSchema: { type: 'object', properties: { branch: { type: 'string' } } } },
  { name: 'git_file_history', description: 'Get commit history for a file', inputSchema: { type: 'object', properties: { file: { type: 'string' }, limit: { type: 'number' } }, required: ['file'] } },
  { name: 'git_stash_list', description: 'List all stashes', inputSchema: { type: 'object', properties: {} } },
  { name: 'git_blame', description: 'Get blame info for a file', inputSchema: { type: 'object', properties: { file: { type: 'string' }, startLine: { type: 'number' }, endLine: { type: 'number' } }, required: ['file'] } },
  { name: 'git_show', description: 'Show commit details', inputSchema: { type: 'object', properties: { commit: { type: 'string', description: 'Commit hash (default: HEAD)' } } } },
  { name: 'git_tag_list', description: 'List all tags', inputSchema: { type: 'object', properties: {} } },
  { name: 'git_contributors', description: 'List contributors with commit counts', inputSchema: { type: 'object', properties: { limit: { type: 'number' } } } },

  // === Tmux Monitor (10 tools) ===
  { name: 'tmux_list_sessions', description: 'List all tmux sessions', inputSchema: { type: 'object', properties: {} } },
  { name: 'tmux_list_windows', description: 'List windows in a session', inputSchema: { type: 'object', properties: { session: { type: 'string' } } } },
  { name: 'tmux_list_panes', description: 'List panes in a window', inputSchema: { type: 'object', properties: { session: { type: 'string' } } } },
  { name: 'tmux_send_keys', description: 'Send keys to a pane', inputSchema: { type: 'object', properties: { target: { type: 'string' }, keys: { type: 'string' } }, required: ['target', 'keys'] } },
  { name: 'tmux_pane_capture', description: 'Capture pane content', inputSchema: { type: 'object', properties: { target: { type: 'string' }, lines: { type: 'number' } } } },
  { name: 'tmux_pane_search', description: 'Search pane content', inputSchema: { type: 'object', properties: { target: { type: 'string' }, pattern: { type: 'string' } }, required: ['pattern'] } },
  { name: 'tmux_pane_tail', description: 'Get last N lines from pane', inputSchema: { type: 'object', properties: { target: { type: 'string' }, lines: { type: 'number' } } } },
  { name: 'tmux_pane_is_busy', description: 'Check if pane is busy', inputSchema: { type: 'object', properties: { target: { type: 'string' } } } },
  { name: 'tmux_pane_current_command', description: 'Get current command in pane', inputSchema: { type: 'object', properties: { target: { type: 'string' } } } },
  { name: 'tmux_session_info', description: 'Get detailed session info', inputSchema: { type: 'object', properties: { session: { type: 'string' } }, required: ['session'] } },

  // === Log Aggregator (7 tools) ===
  { name: 'log_sources', description: 'List all log sources', inputSchema: { type: 'object', properties: {} } },
  { name: 'log_get_recent', description: 'Get recent log entries', inputSchema: { type: 'object', properties: { source: { type: 'string' }, limit: { type: 'number' }, minutes: { type: 'number' } } } },
  { name: 'log_search', description: 'Search logs for a pattern', inputSchema: { type: 'object', properties: { query: { type: 'string' }, source: { type: 'string' } }, required: ['query'] } },
  { name: 'log_get_errors', description: 'Get error-level logs', inputSchema: { type: 'object', properties: { minutes: { type: 'number' } } } },
  { name: 'log_get_warnings', description: 'Get warning-level logs', inputSchema: { type: 'object', properties: { minutes: { type: 'number' } } } },
  { name: 'log_tail', description: 'Tail a specific log file', inputSchema: { type: 'object', properties: { source: { type: 'string' }, lines: { type: 'number' } }, required: ['source'] } },
  { name: 'log_stats', description: 'Get log file statistics', inputSchema: { type: 'object', properties: {} } },

  // === Resource Monitor (10 tools) ===
  { name: 'resource_cpu', description: 'Get CPU usage', inputSchema: { type: 'object', properties: {} } },
  { name: 'resource_memory', description: 'Get memory usage', inputSchema: { type: 'object', properties: {} } },
  { name: 'resource_disk', description: 'Get disk usage', inputSchema: { type: 'object', properties: { path: { type: 'string' } } } },
  { name: 'resource_load', description: 'Get system load average', inputSchema: { type: 'object', properties: {} } },
  { name: 'resource_overview', description: 'Get comprehensive resource overview', inputSchema: { type: 'object', properties: {} } },
  { name: 'resource_processes', description: 'Get process list sorted by resource', inputSchema: { type: 'object', properties: { sort: { type: 'string', enum: ['cpu', 'memory'] }, limit: { type: 'number' } } } },
  { name: 'resource_uptime', description: 'Get system uptime', inputSchema: { type: 'object', properties: {} } },
  { name: 'resource_network_stats', description: 'Get network statistics', inputSchema: { type: 'object', properties: {} } },
  { name: 'resource_battery', description: 'Get battery status (laptops)', inputSchema: { type: 'object', properties: {} } },
  { name: 'resource_temperature', description: 'Get CPU/system temperature', inputSchema: { type: 'object', properties: {} } },

  // === Network Inspector (12 tools) ===
  { name: 'network_interfaces', description: 'List network interfaces', inputSchema: { type: 'object', properties: {} } },
  { name: 'network_connections', description: 'List active connections', inputSchema: { type: 'object', properties: {} } },
  { name: 'network_listening_ports', description: 'List listening ports', inputSchema: { type: 'object', properties: { protocol: { type: 'string', enum: ['tcp', 'udp', 'all'] } } } },
  { name: 'network_stats', description: 'Get network statistics', inputSchema: { type: 'object', properties: {} } },
  { name: 'network_gateway', description: 'Get default gateway', inputSchema: { type: 'object', properties: {} } },
  { name: 'network_ping', description: 'Ping a host', inputSchema: { type: 'object', properties: { host: { type: 'string' }, count: { type: 'number' } }, required: ['host'] } },
  { name: 'network_bandwidth', description: 'Get bandwidth usage', inputSchema: { type: 'object', properties: {} } },
  { name: 'network_overview', description: 'Get network overview', inputSchema: { type: 'object', properties: {} } },
  { name: 'network_dns_lookup', description: 'DNS lookup for a hostname', inputSchema: { type: 'object', properties: { hostname: { type: 'string' } }, required: ['hostname'] } },
  { name: 'network_port_check', description: 'Check if a port is open on a host', inputSchema: { type: 'object', properties: { host: { type: 'string' }, port: { type: 'number' } }, required: ['host', 'port'] } },
  { name: 'network_public_ip', description: 'Get public IP address', inputSchema: { type: 'object', properties: {} } },
  { name: 'network_wifi_info', description: 'Get WiFi connection info (macOS/Linux)', inputSchema: { type: 'object', properties: {} } },

  // === Process Inspector (12 tools) ===
  { name: 'process_info', description: 'Get process details by PID', inputSchema: { type: 'object', properties: { pid: { type: 'number' } }, required: ['pid'] } },
  { name: 'process_list', description: 'List all processes', inputSchema: { type: 'object', properties: { sort: { type: 'string' }, limit: { type: 'number' } } } },
  { name: 'process_search', description: 'Search processes by name', inputSchema: { type: 'object', properties: { query: { type: 'string' } }, required: ['query'] } },
  { name: 'process_tree', description: 'Get process tree', inputSchema: { type: 'object', properties: {} } },
  { name: 'process_file_descriptors', description: 'Get file descriptors for process', inputSchema: { type: 'object', properties: { pid: { type: 'number' } }, required: ['pid'] } },
  { name: 'process_environment', description: 'Get environment variables for process', inputSchema: { type: 'object', properties: { pid: { type: 'number' } }, required: ['pid'] } },
  { name: 'process_children', description: 'Get child processes', inputSchema: { type: 'object', properties: { pid: { type: 'number' } }, required: ['pid'] } },
  { name: 'process_top', description: 'Get top processes by CPU/memory', inputSchema: { type: 'object', properties: { limit: { type: 'number' } } } },
  { name: 'process_kill', description: 'Kill a process by PID (requires confirmation)', inputSchema: { type: 'object', properties: { pid: { type: 'number' }, signal: { type: 'string', enum: ['SIGTERM', 'SIGKILL', 'SIGINT'] }, confirm: { type: 'boolean' } }, required: ['pid', 'confirm'] } },
  { name: 'process_ports', description: 'Get ports used by a process', inputSchema: { type: 'object', properties: { pid: { type: 'number' } }, required: ['pid'] } },
  { name: 'process_cpu_history', description: 'Get CPU usage history for process', inputSchema: { type: 'object', properties: { pid: { type: 'number' } }, required: ['pid'] } },
  { name: 'process_memory_detail', description: 'Get detailed memory info for process', inputSchema: { type: 'object', properties: { pid: { type: 'number' } }, required: ['pid'] } },

  // === File Watcher (10 tools) ===
  { name: 'file_stats', description: 'Get file/directory stats', inputSchema: { type: 'object', properties: { path: { type: 'string' } }, required: ['path'] } },
  { name: 'file_recent_changes', description: 'Get recently changed files', inputSchema: { type: 'object', properties: { directory: { type: 'string' }, minutes: { type: 'number' }, limit: { type: 'number' }, pattern: { type: 'string' } } } },
  { name: 'file_search', description: 'Search files by glob pattern', inputSchema: { type: 'object', properties: { pattern: { type: 'string' }, directory: { type: 'string' } }, required: ['pattern'] } },
  { name: 'file_tree', description: 'Get directory tree', inputSchema: { type: 'object', properties: { directory: { type: 'string' }, depth: { type: 'number' } } } },
  { name: 'file_compare', description: 'Compare two files', inputSchema: { type: 'object', properties: { path1: { type: 'string' }, path2: { type: 'string' } }, required: ['path1', 'path2'] } },
  { name: 'file_changes_since', description: 'Get files changed since timestamp', inputSchema: { type: 'object', properties: { since: { type: 'string' }, directory: { type: 'string' }, pattern: { type: 'string' } }, required: ['since'] } },
  { name: 'file_read', description: 'Read file contents (text, max 100KB)', inputSchema: { type: 'object', properties: { path: { type: 'string' }, encoding: { type: 'string' }, maxLines: { type: 'number' } }, required: ['path'] } },
  { name: 'file_checksum', description: 'Calculate file checksum (md5/sha256)', inputSchema: { type: 'object', properties: { path: { type: 'string' }, algorithm: { type: 'string', enum: ['md5', 'sha256', 'sha512'] } }, required: ['path'] } },
  { name: 'file_size_summary', description: 'Get directory size summary', inputSchema: { type: 'object', properties: { directory: { type: 'string' } } } },
  { name: 'file_duplicates', description: 'Find duplicate files by checksum', inputSchema: { type: 'object', properties: { directory: { type: 'string' }, pattern: { type: 'string' } } } },

  // === Claude Code Monitor (8 tools) ===
  { name: 'claude_config', description: 'Get Claude Desktop configuration', inputSchema: { type: 'object', properties: {} } },
  { name: 'claude_mcp_status', description: 'Get MCP server status', inputSchema: { type: 'object', properties: {} } },
  { name: 'claude_session_info', description: 'Get Claude session info', inputSchema: { type: 'object', properties: {} } },
  { name: 'claude_logs', description: 'Get Claude logs', inputSchema: { type: 'object', properties: { lines: { type: 'number' } } } },
  { name: 'claude_log_search', description: 'Search Claude logs', inputSchema: { type: 'object', properties: { query: { type: 'string' } }, required: ['query'] } },
  { name: 'claude_log_files', description: 'List Claude log files', inputSchema: { type: 'object', properties: {} } },
  { name: 'claude_background_shells', description: 'Get background shell info', inputSchema: { type: 'object', properties: {} } },
  { name: 'claude_status', description: 'Get comprehensive Claude status', inputSchema: { type: 'object', properties: {} } },

  // === GitHub Integration (18 tools) ===
  { name: 'github_list_issues', description: 'List GitHub issues', inputSchema: { type: 'object', properties: { state: { type: 'string', enum: ['open', 'closed', 'all'] }, labels: { type: 'string' }, per_page: { type: 'number' } } } },
  { name: 'github_get_issue', description: 'Get issue details', inputSchema: { type: 'object', properties: { issue_number: { type: 'number' } }, required: ['issue_number'] } },
  { name: 'github_create_issue', description: 'Create new issue', inputSchema: { type: 'object', properties: { title: { type: 'string' }, body: { type: 'string' }, labels: { type: 'array', items: { type: 'string' } } }, required: ['title'] } },
  { name: 'github_update_issue', description: 'Update issue', inputSchema: { type: 'object', properties: { issue_number: { type: 'number' }, title: { type: 'string' }, body: { type: 'string' }, state: { type: 'string' } }, required: ['issue_number'] } },
  { name: 'github_add_comment', description: 'Add comment to issue/PR', inputSchema: { type: 'object', properties: { issue_number: { type: 'number' }, body: { type: 'string' } }, required: ['issue_number', 'body'] } },
  { name: 'github_list_prs', description: 'List pull requests', inputSchema: { type: 'object', properties: { state: { type: 'string', enum: ['open', 'closed', 'all'] }, per_page: { type: 'number' } } } },
  { name: 'github_get_pr', description: 'Get PR details', inputSchema: { type: 'object', properties: { pull_number: { type: 'number' } }, required: ['pull_number'] } },
  { name: 'github_create_pr', description: 'Create pull request', inputSchema: { type: 'object', properties: { title: { type: 'string' }, head: { type: 'string' }, base: { type: 'string' }, body: { type: 'string' } }, required: ['title', 'head'] } },
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

  // === System Health (1 tool) ===
  { name: 'health_check', description: 'Comprehensive system health check', inputSchema: { type: 'object', properties: {} } },
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
    const query = sanitizeShellArg(args.query as string);
    const { stdout } = await execAsync(`grep -ri "${query}" "${MIYABI_LOG_DIR}" --include="*.log" 2>/dev/null | head -100 || true`);
    return { results: stdout.trim().split('\n').filter(Boolean) };
  }
  if (name === 'log_tail') {
    const source = args.source as string;
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
    const mem = await si.mem();
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
    const disks = await si.fsSize();
    return { disks };
  }
  if (name === 'resource_load') {
    const load = await si.currentLoad();
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
    const interfaces = await si.networkInterfaces();
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
    const stats = await si.networkStats();
    return { stats };
  }
  if (name === 'network_gateway') {
    const gateway = await si.networkGatewayDefault();
    return { gateway };
  }
  if (name === 'network_ping') {
    const host = args.host as string;
    if (!isValidHostname(host)) {
      return { error: 'Invalid hostname format' };
    }
    const count = Math.min(Math.max((args.count as number) || 3, 1), 10);
    const pingFlag = platform() === 'darwin' ? '-c' : '-c';
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
    const query = sanitizeShellArg(args.query as string);
    const { stdout } = await execAsync(`grep -ri "${query}" "${CLAUDE_LOGS_DIR}" 2>/dev/null | head -50 || echo "No matches"`);
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

// ========== Main Server ==========
const server = new Server(
  {
    name: 'miyabi-mcp-bundle',
    version: '3.0.0',
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
  console.error('🚀 Miyabi MCP Bundle v3.0.0');
  console.error(`📂 Repository: ${MIYABI_REPO_PATH}`);
  console.error(`🔧 Tools: ${tools.length}`);
  console.error('');

  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch(console.error);
