
import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { simpleGit, SimpleGit } from 'simple-git';
import { exec } from 'child_process';
import { promisify } from 'util';
import { readdir, stat } from 'fs/promises';
import { join } from 'path';
import { platform } from 'os';

import { sanitizeShellArg } from '../utils/security.js';
import { clampRange, parseLines } from '../utils/validation.js';
import { GIT_LOG_MAX, GIT_LOG_DEFAULT, GIT_CONTRIBUTORS_MAX, GIT_CONTRIBUTORS_DEFAULT } from '../constants.js';

const execAsync = promisify(exec);

// Environment Configuration
const MIYABI_REPO_PATH = process.env.MIYABI_REPO_PATH || process.cwd();

// Initialize Git Client
const git: SimpleGit = simpleGit(MIYABI_REPO_PATH);

// Helper: check if command exists
async function commandExists(cmd: string): Promise<boolean> {
  try {
    const which = platform() === 'win32' ? 'where' : 'which';
    await execAsync(`${which} ${sanitizeShellArg(cmd)}`);
    return true;
  } catch {
    return false;
  }
}

export const gitTools: Tool[] = [
  { name: 'git_status', description: 'Get working tree status showing modified, staged, and untracked files. Use before committing to review changes.', inputSchema: { type: 'object', properties: {} } },
  { name: 'git_branch_list', description: 'List all local and remote branches with tracking info. Shows which branches are ahead/behind remotes.', inputSchema: { type: 'object', properties: {} } },
  { name: 'git_current_branch', description: 'Get the name of the currently checked out branch. Useful for automation scripts.', inputSchema: { type: 'object', properties: {} } },
  { name: 'git_log', description: 'Get commit history with author, date, and message. Use limit to control results (default: 20).', inputSchema: { type: 'object', properties: { limit: { type: 'number', description: 'Number of commits (default: 20)' } } } },
  { name: 'git_worktree_list', description: 'List all git worktrees for parallel development. Shows path and branch for each worktree.', inputSchema: { type: 'object', properties: {} } },
  { name: 'git_diff', description: 'Show unstaged changes in working directory. Optionally specify a file to see changes for only that file.', inputSchema: { type: 'object', properties: { file: { type: 'string', description: 'Specific file to diff' } } } },
  { name: 'git_staged_diff', description: 'Show changes staged for commit (git diff --cached). Review before committing.', inputSchema: { type: 'object', properties: {} } },
  { name: 'git_remote_list', description: 'List configured remotes with their fetch/push URLs. Check remote configuration.', inputSchema: { type: 'object', properties: {} } },
  { name: 'git_branch_ahead_behind', description: 'Check how many commits a branch is ahead/behind its upstream. Useful before push/pull.', inputSchema: { type: 'object', properties: { branch: { type: 'string', description: 'Branch name (default: current branch)' } } } },
  { name: 'git_file_history', description: 'Get commit history for a specific file. Track when and why a file was modified (default: 10 commits).', inputSchema: { type: 'object', properties: { file: { type: 'string', description: 'File path to get history for' }, limit: { type: 'number', description: 'Number of commits (default: 10)' } }, required: ['file'] } },
  { name: 'git_stash_list', description: 'List all stashed changes with their descriptions. Find saved work to restore later.', inputSchema: { type: 'object', properties: {} } },
  { name: 'git_blame', description: 'Show who last modified each line of a file. Optional line range to focus on specific code.', inputSchema: { type: 'object', properties: { file: { type: 'string', description: 'File path to get blame for' }, startLine: { type: 'number', description: 'Starting line number (1-indexed)' }, endLine: { type: 'number', description: 'Ending line number (1-indexed)' } }, required: ['file'] } },
  { name: 'git_show', description: 'Show details of a commit including diff and metadata. Defaults to HEAD if no commit specified.', inputSchema: { type: 'object', properties: { commit: { type: 'string', description: 'Commit hash (default: HEAD)' } } } },
  { name: 'git_tag_list', description: 'List all tags with their associated commits. Useful for finding release versions.', inputSchema: { type: 'object', properties: {} } },
  { name: 'git_contributors', description: 'List contributors ranked by commit count. Identify active maintainers and authors.', inputSchema: { type: 'object', properties: { limit: { type: 'number', description: 'Max contributors to return' } } } },
  { name: 'git_conflicts', description: 'Detect files with merge conflicts in working tree. Use during merge/rebase to find issues.', inputSchema: { type: 'object', properties: {} } },
  { name: 'git_submodule_status', description: 'Show status of all submodules including commit hash and sync state.', inputSchema: { type: 'object', properties: {} } },
  { name: 'git_lfs_status', description: 'Get Git LFS tracked files and status. Requires git-lfs to be installed.', inputSchema: { type: 'object', properties: {} } },
  { name: 'git_hooks_list', description: 'List git hooks in .git/hooks directory. Check which hooks are enabled.', inputSchema: { type: 'object', properties: {} } },
];

export async function handleGitTool(name: string, args: Record<string, unknown>): Promise<unknown> {
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
    const limit = clampRange(args.limit, 1, GIT_LOG_MAX, GIT_LOG_DEFAULT);
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
    const limit = clampRange(args.limit, 1, 50, 10);
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
    const limit = clampRange(args.limit, 1, GIT_CONTRIBUTORS_MAX, GIT_CONTRIBUTORS_DEFAULT);
    const { stdout } = await execAsync(`git shortlog -sn --no-merges HEAD | head -${limit}`, { cwd: MIYABI_REPO_PATH });
    return { contributors: parseLines(stdout) };
  }
  if (name === 'git_conflicts') {
    try {
      const { stdout } = await execAsync('git diff --name-only --diff-filter=U', { cwd: MIYABI_REPO_PATH });
      const conflicts = parseLines(stdout);
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

  throw new Error(`Unknown tool: ${name}`);
}
