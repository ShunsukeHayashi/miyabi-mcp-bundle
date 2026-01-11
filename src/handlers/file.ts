
import { exec } from 'child_process';
import { promisify } from 'util';
import { glob } from 'glob';
import { stat, readFile } from 'fs/promises';
import { createHash } from 'crypto';
import { join } from 'path';
import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { sanitizePath } from '../utils/security.js';

const execAsync = promisify(exec);

// Environment Configuration
const MIYABI_REPO_PATH = process.env.MIYABI_REPO_PATH || process.cwd();
const MIYABI_WATCH_DIR = process.env.MIYABI_WATCH_DIR || MIYABI_REPO_PATH;

export const fileTools: Tool[] = [
    {
        name: 'file_stats',
        description: 'Get detailed stats (size, modified, created, permissions) for a file.',
        inputSchema: {
            type: 'object',
            properties: {
                path: { type: 'string', description: 'Path to the file or directory' }
            },
            required: ['path']
        }
    },
    {
        name: 'file_recent_changes',
        description: 'List files changed within the last N minutes.',
        inputSchema: {
            type: 'object',
            properties: {
                minutes: { type: 'number', description: 'Lookback minutes (default 60)' },
                limit: { type: 'number', description: 'Max results (default 20)' }
            }
        }
    },
    {
        name: 'file_search',
        description: 'Find files matching a glob pattern.',
        inputSchema: {
            type: 'object',
            properties: {
                pattern: { type: 'string', description: 'Glob pattern (e.g., "**/*.ts")' }
            },
            required: ['pattern']
        }
    },
    {
        name: 'file_tree',
        description: 'Generate a text-based tree view of a directory.',
        inputSchema: {
            type: 'object',
            properties: {
                depth: { type: 'number', description: 'Depth of traversal (default 3)' }
            }
        }
    },
    {
        name: 'file_compare',
        description: 'Compare two files (size, modified time).',
        inputSchema: {
            type: 'object',
            properties: {
                path1: { type: 'string', description: 'First file' },
                path2: { type: 'string', description: 'Second file' }
            },
            required: ['path1', 'path2']
        }
    },
    {
        name: 'file_changes_since',
        description: 'List files changed since a specific ISO timestamp.',
        inputSchema: {
            type: 'object',
            properties: {
                since: { type: 'string', description: 'ISO date string' }
            },
            required: ['since']
        }
    },
    {
        name: 'file_read',
        description: 'Read the contents of a text file (max 100KB/1000 lines).',
        inputSchema: {
            type: 'object',
            properties: {
                path: { type: 'string', description: 'Path to file' },
                maxLines: { type: 'number', description: 'Max lines to read' },
                encoding: { type: 'string', description: 'Encoding (utf-8)' }
            },
            required: ['path']
        }
    },
    {
        name: 'file_checksum',
        description: 'Calculate checksum (MD5, SHA256) of a file.',
        inputSchema: {
            type: 'object',
            properties: {
                path: { type: 'string', description: 'Path to file' },
                algorithm: { type: 'string', description: 'md5, sha256, sha512 (default sha256)' }
            },
            required: ['path']
        }
    },
    {
        name: 'file_size_summary',
        description: 'Get a summary of directory size (du -sh).',
        inputSchema: {
            type: 'object',
            properties: {
                directory: { type: 'string', description: 'Directory path (default .)' }
            }
        }
    },
    {
        name: 'file_duplicates',
        description: 'Find duplicate files in a directory based on content hash.',
        inputSchema: {
            type: 'object',
            properties: {
                directory: { type: 'string', description: 'Directory to scan' },
                pattern: { type: 'string', description: 'Glob pattern filter' }
            }
        }
    }
];

export async function handleFileTool(name: string, args: Record<string, unknown>): Promise<unknown> {
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
