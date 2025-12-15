#!/usr/bin/env node
/**
 * Miyabi MCP Bundle - All-in-One Monitoring and Control Server
 * 
 * A comprehensive MCP server with 76 tools across 9 categories:
 * - Git Inspector (10 tools)
 * - Tmux Monitor (9 tools)
 * - Log Aggregator (6 tools)
 * - Resource Monitor (8 tools)
 * - Network Inspector (8 tools)
 * - Process Inspector (8 tools)
 * - File Watcher (6 tools)
 * - Claude Code Monitor (8 tools)
 * - GitHub Integration (12 tools)
 * 
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
import { join } from 'path';
import { homedir, platform } from 'os';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

// ========== Environment Configuration ==========
const MIYABI_REPO_PATH = process.env.MIYABI_REPO_PATH || process.cwd();
const MIYABI_LOG_DIR = process.env.MIYABI_LOG_DIR || MIYABI_REPO_PATH;
const MIYABI_WATCH_DIR = process.env.MIYABI_WATCH_DIR || MIYABI_REPO_PATH;

// Claude config paths (cross-platform)
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
  // === Git Inspector (10 tools) ===
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

  // === Tmux Monitor (9 tools) ===
  { name: 'tmux_list_sessions', description: 'List all tmux sessions', inputSchema: { type: 'object', properties: {} } },
  { name: 'tmux_list_windows', description: 'List windows in a session', inputSchema: { type: 'object', properties: { session: { type: 'string' } } } },
  { name: 'tmux_list_panes', description: 'List panes in a window', inputSchema: { type: 'object', properties: { session: { type: 'string' } } } },
  { name: 'tmux_send_keys', description: 'Send keys to a pane', inputSchema: { type: 'object', properties: { target: { type: 'string' }, keys: { type: 'string' } }, required: ['target', 'keys'] } },
  { name: 'tmux_pane_capture', description: 'Capture pane content', inputSchema: { type: 'object', properties: { target: { type: 'string' }, lines: { type: 'number' } } } },
  { name: 'tmux_pane_search', description: 'Search pane content', inputSchema: { type: 'object', properties: { target: { type: 'string' }, pattern: { type: 'string' } }, required: ['pattern'] } },
  { name: 'tmux_pane_tail', description: 'Get last N lines from pane', inputSchema: { type: 'object', properties: { target: { type: 'string' }, lines: { type: 'number' } } } },
  { name: 'tmux_pane_is_busy', description: 'Check if pane is busy', inputSchema: { type: 'object', properties: { target: { type: 'string' } } } },
  { name: 'tmux_pane_current_command', description: 'Get current command in pane', inputSchema: { type: 'object', properties: { target: { type: 'string' } } } },

  // === Log Aggregator (6 tools) ===
  { name: 'log_sources', description: 'List all log sources', inputSchema: { type: 'object', properties: {} } },
  { name: 'log_get_recent', description: 'Get recent log entries', inputSchema: { type: 'object', properties: { source: { type: 'string' }, limit: { type: 'number' }, minutes: { type: 'number' } } } },
  { name: 'log_search', description: 'Search logs for a pattern', inputSchema: { type: 'object', properties: { query: { type: 'string' }, source: { type: 'string' } }, required: ['query'] } },
  { name: 'log_get_errors', description: 'Get error-level logs', inputSchema: { type: 'object', properties: { minutes: { type: 'number' } } } },
  { name: 'log_get_warnings', description: 'Get warning-level logs', inputSchema: { type: 'object', properties: { minutes: { type: 'number' } } } },
  { name: 'log_tail', description: 'Tail a specific log file', inputSchema: { type: 'object', properties: { source: { type: 'string' }, lines: { type: 'number' } }, required: ['source'] } },

  // === Resource Monitor (8 tools) ===
  { name: 'resource_cpu', description: 'Get CPU usage', inputSchema: { type: 'object', properties: {} } },
  { name: 'resource_memory', description: 'Get memory usage', inputSchema: { type: 'object', properties: {} } },
  { name: 'resource_disk', description: 'Get disk usage', inputSchema: { type: 'object', properties: { path: { type: 'string' } } } },
  { name: 'resource_load', description: 'Get system load average', inputSchema: { type: 'object', properties: {} } },
  { name: 'resource_overview', description: 'Get comprehensive resource overview', inputSchema: { type: 'object', properties: {} } },
  { name: 'resource_processes', description: 'Get process list sorted by resource', inputSchema: { type: 'object', properties: { sort: { type: 'string', enum: ['cpu', 'memory'] }, limit: { type: 'number' } } } },
  { name: 'resource_uptime', description: 'Get system uptime', inputSchema: { type: 'object', properties: {} } },
  { name: 'resource_network_stats', description: 'Get network statistics', inputSchema: { type: 'object', properties: {} } },

  // === Network Inspector (8 tools) ===
  { name: 'network_interfaces', description: 'List network interfaces', inputSchema: { type: 'object', properties: {} } },
  { name: 'network_connections', description: 'List active connections', inputSchema: { type: 'object', properties: {} } },
  { name: 'network_listening_ports', description: 'List listening ports', inputSchema: { type: 'object', properties: { protocol: { type: 'string', enum: ['tcp', 'udp', 'all'] } } } },
  { name: 'network_stats', description: 'Get network statistics', inputSchema: { type: 'object', properties: {} } },
  { name: 'network_gateway', description: 'Get default gateway', inputSchema: { type: 'object', properties: {} } },
  { name: 'network_ping', description: 'Ping a host', inputSchema: { type: 'object', properties: { host: { type: 'string' } }, required: ['host'] } },
  { name: 'network_bandwidth', description: 'Get bandwidth usage', inputSchema: { type: 'object', properties: {} } },
  { name: 'network_overview', description: 'Get network overview', inputSchema: { type: 'object', properties: {} } },

  // === Process Inspector (8 tools) ===
  { name: 'process_info', description: 'Get process details by PID', inputSchema: { type: 'object', properties: { pid: { type: 'number' } }, required: ['pid'] } },
  { name: 'process_list', description: 'List all processes', inputSchema: { type: 'object', properties: { sort: { type: 'string' }, limit: { type: 'number' } } } },
  { name: 'process_search', description: 'Search processes by name', inputSchema: { type: 'object', properties: { query: { type: 'string' } }, required: ['query'] } },
  { name: 'process_tree', description: 'Get process tree', inputSchema: { type: 'object', properties: {} } },
  { name: 'process_file_descriptors', description: 'Get file descriptors for process', inputSchema: { type: 'object', properties: { pid: { type: 'number' } }, required: ['pid'] } },
  { name: 'process_environment', description: 'Get environment variables for process', inputSchema: { type: 'object', properties: { pid: { type: 'number' } }, required: ['pid'] } },
  { name: 'process_children', description: 'Get child processes', inputSchema: { type: 'object', properties: { pid: { type: 'number' } }, required: ['pid'] } },
  { name: 'process_top', description: 'Get top processes by CPU/memory', inputSchema: { type: 'object', properties: { limit: { type: 'number' } } } },

  // === File Watcher (6 tools) ===
  { name: 'file_stats', description: 'Get file/directory stats', inputSchema: { type: 'object', properties: { path: { type: 'string' } }, required: ['path'] } },
  { name: 'file_recent_changes', description: 'Get recently changed files', inputSchema: { type: 'object', properties: { directory: { type: 'string' }, minutes: { type: 'number' }, limit: { type: 'number' }, pattern: { type: 'string' } } } },
  { name: 'file_search', description: 'Search files by glob pattern', inputSchema: { type: 'object', properties: { pattern: { type: 'string' }, directory: { type: 'string' } }, required: ['pattern'] } },
  { name: 'file_tree', description: 'Get directory tree', inputSchema: { type: 'object', properties: { directory: { type: 'string' }, depth: { type: 'number' } } } },
  { name: 'file_compare', description: 'Compare two files', inputSchema: { type: 'object', properties: { path1: { type: 'string' }, path2: { type: 'string' } }, required: ['path1', 'path2'] } },
  { name: 'file_changes_since', description: 'Get files changed since timestamp', inputSchema: { type: 'object', properties: { since: { type: 'string' }, directory: { type: 'string' }, pattern: { type: 'string' } }, required: ['since'] } },

  // === Claude Code Monitor (8 tools) ===
  { name: 'claude_config', description: 'Get Claude Desktop configuration', inputSchema: { type: 'object', properties: {} } },
  { name: 'claude_mcp_status', description: 'Get MCP server status', inputSchema: { type: 'object', properties: {} } },
  { name: 'claude_session_info', description: 'Get Claude session info', inputSchema: { type: 'object', properties: {} } },
  { name: 'claude_logs', description: 'Get Claude logs', inputSchema: { type: 'object', properties: { lines: { type: 'number' } } } },
  { name: 'claude_log_search', description: 'Search Claude logs', inputSchema: { type: 'object', properties: { query: { type: 'string' } }, required: ['query'] } },
  { name: 'claude_log_files', description: 'List Claude log files', inputSchema: { type: 'object', properties: {} } },
  { name: 'claude_background_shells', description: 'Get background shell info', inputSchema: { type: 'object', properties: {} } },
  { name: 'claude_status', description: 'Get comprehensive Claude status', inputSchema: { type: 'object', properties: {} } },

  // === GitHub Integration (12 tools) ===
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
];

// ========== Tool Handlers ==========
async function handleTool(name: string, args: Record<string, unknown>): Promise<unknown> {
  try {
    // Git Inspector
    if (name === 'git_status') {
      const status = await git.status();
      return status;
    }
    if (name === 'git_branch_list') {
      const branches = await git.branch(['-a', '-v']);
      return branches;
    }
    if (name === 'git_current_branch') {
      const branch = await git.revparse(['--abbrev-ref', 'HEAD']);
      return { branch: branch.trim() };
    }
    if (name === 'git_log') {
      const limit = (args.limit as number) || 20;
      const log = await git.log({ maxCount: limit });
      return log;
    }
    if (name === 'git_worktree_list') {
      const { stdout } = await execAsync('git worktree list --porcelain', { cwd: MIYABI_REPO_PATH });
      return { worktrees: stdout };
    }
    if (name === 'git_diff') {
      const file = args.file as string | undefined;
      const diff = file ? await git.diff([file]) : await git.diff();
      return { diff };
    }
    if (name === 'git_staged_diff') {
      const diff = await git.diff(['--staged']);
      return { diff };
    }
    if (name === 'git_remote_list') {
      const remotes = await git.getRemotes(true);
      return { remotes };
    }
    if (name === 'git_branch_ahead_behind') {
      const branch = (args.branch as string) || 'HEAD';
      const { stdout } = await execAsync(`git rev-list --left-right --count origin/${branch}...${branch}`, { cwd: MIYABI_REPO_PATH });
      const [behind, ahead] = stdout.trim().split('\t').map(Number);
      return { ahead, behind };
    }
    if (name === 'git_file_history') {
      const file = args.file as string;
      const limit = (args.limit as number) || 10;
      const log = await git.log({ file, maxCount: limit });
      return log;
    }

    // Tmux Monitor
    if (name.startsWith('tmux_')) {
      return await handleTmuxTool(name, args);
    }

    // Log Aggregator
    if (name.startsWith('log_')) {
      return await handleLogTool(name, args);
    }

    // Resource Monitor
    if (name.startsWith('resource_')) {
      return await handleResourceTool(name, args);
    }

    // Network Inspector
    if (name.startsWith('network_')) {
      return await handleNetworkTool(name, args);
    }

    // Process Inspector
    if (name.startsWith('process_')) {
      return await handleProcessTool(name, args);
    }

    // File Watcher
    if (name.startsWith('file_')) {
      return await handleFileTool(name, args);
    }

    // Claude Monitor
    if (name.startsWith('claude_')) {
      return await handleClaudeTool(name, args);
    }

    // GitHub Integration
    if (name.startsWith('github_')) {
      return await handleGitHubTool(name, args);
    }

    return { error: `Unknown tool: ${name}` };
  } catch (error) {
    return { error: error instanceof Error ? error.message : String(error) };
  }
}

// ========== Category Handlers ==========
async function handleTmuxTool(name: string, args: Record<string, unknown>): Promise<unknown> {
  const target = (args.target as string) || '';
  
  if (name === 'tmux_list_sessions') {
    const { stdout } = await execAsync('tmux list-sessions -F "#{session_name}:#{session_windows}:#{session_attached}"');
    return { sessions: stdout.trim().split('\n') };
  }
  if (name === 'tmux_list_windows') {
    const session = (args.session as string) || '';
    const cmd = session ? `tmux list-windows -t ${session}` : 'tmux list-windows';
    const { stdout } = await execAsync(cmd);
    return { windows: stdout.trim().split('\n') };
  }
  if (name === 'tmux_list_panes') {
    const session = (args.session as string) || '';
    const cmd = session ? `tmux list-panes -t ${session} -F "#{pane_id}:#{pane_current_command}:#{pane_pid}"` : 'tmux list-panes -a -F "#{session_name}:#{pane_id}:#{pane_current_command}"';
    const { stdout } = await execAsync(cmd);
    return { panes: stdout.trim().split('\n') };
  }
  if (name === 'tmux_send_keys') {
    await execAsync(`tmux send-keys -t ${target} "${args.keys}" Enter`);
    return { success: true };
  }
  if (name === 'tmux_pane_capture') {
    const lines = (args.lines as number) || 100;
    const { stdout } = await execAsync(`tmux capture-pane -t ${target} -p -S -${lines}`);
    return { content: stdout };
  }
  if (name === 'tmux_pane_search') {
    const { stdout } = await execAsync(`tmux capture-pane -t ${target} -p | grep -i "${args.pattern}"`);
    return { matches: stdout.trim().split('\n') };
  }
  if (name === 'tmux_pane_tail') {
    const lines = (args.lines as number) || 20;
    const { stdout } = await execAsync(`tmux capture-pane -t ${target} -p | tail -n ${lines}`);
    return { content: stdout };
  }
  if (name === 'tmux_pane_is_busy') {
    const { stdout } = await execAsync(`tmux display-message -t ${target} -p "#{pane_current_command}"`);
    const cmd = stdout.trim();
    return { busy: !['bash', 'zsh', 'fish', 'sh'].includes(cmd), command: cmd };
  }
  if (name === 'tmux_pane_current_command') {
    const { stdout } = await execAsync(`tmux display-message -t ${target} -p "#{pane_current_command}"`);
    return { command: stdout.trim() };
  }
  return { error: `Unknown tmux tool: ${name}` };
}

async function handleLogTool(name: string, args: Record<string, unknown>): Promise<unknown> {
  // Simple implementation - can be extended
  if (name === 'log_sources') {
    const files = await glob('**/*.log', { cwd: MIYABI_LOG_DIR, ignore: 'node_modules/**' });
    return { sources: files };
  }
  if (name === 'log_get_recent' || name === 'log_get_errors' || name === 'log_get_warnings') {
    const minutes = (args.minutes as number) || 60;
    const source = (args.source as string) || '*.log';
    const { stdout } = await execAsync(`find ${MIYABI_LOG_DIR} -name "${source}" -mmin -${minutes} -exec tail -n 100 {} \\;`);
    return { logs: stdout };
  }
  if (name === 'log_search') {
    const { stdout } = await execAsync(`grep -ri "${args.query}" ${MIYABI_LOG_DIR} --include="*.log" | head -100`);
    return { results: stdout.trim().split('\n') };
  }
  if (name === 'log_tail') {
    const lines = (args.lines as number) || 50;
    const { stdout } = await execAsync(`tail -n ${lines} ${join(MIYABI_LOG_DIR, args.source as string)}`);
    return { content: stdout };
  }
  return { error: `Unknown log tool: ${name}` };
}

async function handleResourceTool(name: string, args: Record<string, unknown>): Promise<unknown> {
  if (name === 'resource_cpu') {
    const cpu = await si.currentLoad();
    return { cpu: cpu.currentLoad, cores: cpu.cpus };
  }
  if (name === 'resource_memory') {
    const mem = await si.mem();
    return { total: mem.total, used: mem.used, free: mem.free, usedPercent: (mem.used / mem.total) * 100 };
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
    const [cpu, mem, disk, load] = await Promise.all([
      si.currentLoad(),
      si.mem(),
      si.fsSize(),
      si.currentLoad()
    ]);
    return {
      cpu: { load: cpu.currentLoad },
      memory: { usedPercent: (mem.used / mem.total) * 100, freeGb: mem.free / 1024 / 1024 / 1024 },
      disk: disk.map(d => ({ mount: d.mount, usedPercent: d.use })),
      load: load.avgLoad
    };
  }
  if (name === 'resource_processes') {
    const processes = await si.processes();
    const limit = (args.limit as number) || 10;
    const sorted = processes.list.sort((a, b) => b.cpu - a.cpu).slice(0, limit);
    return { processes: sorted };
  }
  if (name === 'resource_uptime') {
    const time = await si.time();
    return { uptime: time.uptime, timezone: time.timezone };
  }
  if (name === 'resource_network_stats') {
    const stats = await si.networkStats();
    return { stats };
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
    return { connections: connections.slice(0, 50) };
  }
  if (name === 'network_listening_ports') {
    const connections = await si.networkConnections();
    const listening = connections.filter(c => c.state === 'LISTEN');
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
    const { stdout } = await execAsync(`ping -c 3 ${host}`);
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
  return { error: `Unknown network tool: ${name}` };
}

async function handleProcessTool(name: string, args: Record<string, unknown>): Promise<unknown> {
  if (name === 'process_info') {
    const pid = args.pid as number;
    const { stdout } = await execAsync(`ps -p ${pid} -o pid,ppid,user,%cpu,%mem,command`);
    return { info: stdout };
  }
  if (name === 'process_list') {
    const processes = await si.processes();
    const limit = (args.limit as number) || 20;
    return { processes: processes.list.slice(0, limit) };
  }
  if (name === 'process_search') {
    const query = args.query as string;
    const { stdout } = await execAsync(`pgrep -l "${query}"`);
    return { matches: stdout.trim().split('\n') };
  }
  if (name === 'process_tree') {
    const { stdout } = await execAsync('pstree');
    return { tree: stdout };
  }
  if (name === 'process_file_descriptors') {
    const pid = args.pid as number;
    const { stdout } = await execAsync(`lsof -p ${pid} 2>/dev/null | head -50`);
    return { fds: stdout };
  }
  if (name === 'process_environment') {
    const pid = args.pid as number;
    const { stdout } = await execAsync(`cat /proc/${pid}/environ 2>/dev/null | tr '\\0' '\\n' || ps eww -p ${pid}`);
    return { env: stdout };
  }
  if (name === 'process_children') {
    const pid = args.pid as number;
    const { stdout } = await execAsync(`pgrep -P ${pid}`);
    return { children: stdout.trim().split('\n').filter(Boolean) };
  }
  if (name === 'process_top') {
    const limit = (args.limit as number) || 10;
    const processes = await si.processes();
    const top = processes.list.sort((a, b) => b.cpu - a.cpu).slice(0, limit);
    return { top };
  }
  return { error: `Unknown process tool: ${name}` };
}

async function handleFileTool(name: string, args: Record<string, unknown>): Promise<unknown> {
  const baseDir = MIYABI_WATCH_DIR;
  
  if (name === 'file_stats') {
    const path = args.path as string;
    const fullPath = join(baseDir, path);
    const stats = await stat(fullPath);
    return { path, size: stats.size, modified: stats.mtime, isDirectory: stats.isDirectory() };
  }
  if (name === 'file_recent_changes') {
    const minutes = (args.minutes as number) || 60;
    const limit = (args.limit as number) || 20;
    const { stdout } = await execAsync(`find ${baseDir} -type f -mmin -${minutes} | head -${limit}`);
    return { files: stdout.trim().split('\n').filter(Boolean) };
  }
  if (name === 'file_search') {
    const pattern = args.pattern as string;
    const files = await glob(pattern, { cwd: baseDir, ignore: ['node_modules/**', '.git/**'] });
    return { files };
  }
  if (name === 'file_tree') {
    const depth = (args.depth as number) || 3;
    const { stdout } = await execAsync(`find ${baseDir} -maxdepth ${depth} -type f | head -100`);
    return { tree: stdout };
  }
  if (name === 'file_compare') {
    const path1 = join(baseDir, args.path1 as string);
    const path2 = join(baseDir, args.path2 as string);
    const [stat1, stat2] = await Promise.all([stat(path1), stat(path2)]);
    return {
      path1: { size: stat1.size, modified: stat1.mtime },
      path2: { size: stat2.size, modified: stat2.mtime },
      sameSize: stat1.size === stat2.size
    };
  }
  if (name === 'file_changes_since') {
    const since = new Date(args.since as string);
    const { stdout } = await execAsync(`find ${baseDir} -type f -newermt "${since.toISOString()}" | head -50`);
    return { files: stdout.trim().split('\n').filter(Boolean) };
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
      return { servers: Object.keys(config.mcpServers || {}) };
    } catch {
      return { error: 'Could not read MCP status' };
    }
  }
  if (name === 'claude_logs') {
    const lines = (args.lines as number) || 100;
    const { stdout } = await execAsync(`find ${CLAUDE_LOGS_DIR} -name "*.log" -exec tail -n ${lines} {} \\; 2>/dev/null || echo "No logs found"`);
    return { logs: stdout };
  }
  if (name === 'claude_log_search') {
    const query = args.query as string;
    const { stdout } = await execAsync(`grep -ri "${query}" ${CLAUDE_LOGS_DIR} 2>/dev/null | head -50 || echo "No matches"`);
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
  if (name === 'claude_session_info' || name === 'claude_background_shells' || name === 'claude_status') {
    // These require more complex integration
    return { message: 'Basic implementation - extend as needed' };
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
      per_page: (args.per_page as number) || 30
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
      per_page: (args.per_page as number) || 30
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
  return { error: `Unknown github tool: ${name}` };
}

// ========== Main Server ==========
const server = new Server(
  {
    name: 'miyabi-mcp-bundle',
    version: '2.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// List tools handler
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return { tools };
});

// Call tool handler
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

// Start server
async function main() {
  console.error('🚀 Miyabi MCP Bundle v2.0.0');
  console.error(`📂 Repository: ${MIYABI_REPO_PATH}`);
  console.error(`🔧 Tools: ${tools.length}`);
  console.error('');
  
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch(console.error);
