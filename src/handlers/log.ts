
import { exec } from 'child_process';
import { promisify } from 'util';
import { glob } from 'glob';
import { stat } from 'fs/promises';
import { join } from 'path';
import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { validateInputLength, sanitizeShellArg, sanitizePath } from '../utils/security.js';
import { MAX_QUERY_LENGTH, MAX_PATH_LENGTH } from '../constants.js';

const execAsync = promisify(exec);

// Environment Configuration
const MIYABI_REPO_PATH = process.env.MIYABI_REPO_PATH || process.cwd();
const MIYABI_LOG_DIR = process.env.MIYABI_LOG_DIR || MIYABI_REPO_PATH;

export const logTools: Tool[] = [
    {
        name: 'log_list',
        description: 'List top 50 log files in the Miyabi log directory. Can list all logs, or filter by specific patterns.',
        inputSchema: {
            type: 'object',
            properties: {
                limit: { type: 'number', description: 'Number of logs to return (default 50)' }
            }
        }
    },
    {
        name: 'log_read',
        description: 'Read the last N lines of a specified log file. Useful for checking recent activities or errors.',
        inputSchema: {
            type: 'object',
            properties: {
                filename: { type: 'string', description: 'Name of the log file to read' },
                lines: { type: 'number', description: 'Number of lines to read (default 100)' }
            },
            required: ['filename']
        }
    },
    {
        name: 'log_search',
        description: 'Search for a string pattern across all .log files in the log directory. Returns matching lines.',
        inputSchema: {
            type: 'object',
            properties: {
                query: { type: 'string', description: 'String or regex pattern to search for' }
            },
            required: ['query']
        }
    },
    {
        name: 'log_analyze_errors',
        description: 'Scan logs for common error patterns (Error, Exception, Fail) and return a summary of findings.',
        inputSchema: {
            type: 'object',
            properties: {
                days: { type: 'number', description: 'Number of past days to scan (default 1)' }
            }
        }
    },
    {
        name: 'log_grep',
        description: 'Search for a string or regex in a specific log file or all logs.',
        inputSchema: {
            type: 'object',
            properties: {
                query: { type: 'string', description: 'Search term' }
            },
            required: ['query']
        }
    },
    {
        name: 'log_tail',
        description: 'Tail a log file to see the most recent content.',
        inputSchema: {
            type: 'object',
            properties: {
                source: { type: 'string', description: 'Source file path' },
                lines: { type: 'number', description: 'Number of lines (default 50)' }
            },
            required: ['source']
        }
    },
    {
        name: 'log_stats',
        description: 'Get statistics about log files (count, size, modification times) to monitor log volume.',
        inputSchema: {
            type: 'object',
            properties: {}
        }
    }
];

export async function handleLogTool(name: string, args: Record<string, unknown>): Promise<unknown> {
    if (name === 'log_list') {
        // SECURITY: Use 'glob' which is safer than shell execution for listing files
        const limit = Math.min(Math.max((args.limit as number) || 50, 1), 1000);
        const files = await glob('**/*.log', { cwd: MIYABI_LOG_DIR, ignore: ['node_modules/**'] });
        return { files: files.slice(0, limit) };
    }
    if (name === 'log_read') {
        const filename = args.filename as string;
        const lengthError = validateInputLength(filename, MAX_PATH_LENGTH, 'Filename');
        if (lengthError) return { error: lengthError };

        const lines = Math.min(Math.max((args.lines as number) || 100, 1), 5000);
        const safePath = sanitizePath(MIYABI_LOG_DIR, filename);

        // SECURITY: sanitizePath ensures traversal protection, execAsync uses 'tail'
        const { stdout } = await execAsync(`tail -n ${lines} "${safePath}"`);
        return { content: stdout };
    }
    if (name === 'log_search') {
        const query = args.query as string;
        const lengthError = validateInputLength(query, MAX_QUERY_LENGTH, 'Query');
        if (lengthError) return { error: lengthError };
        const safeQuery = sanitizeShellArg(query);
        const { stdout } = await execAsync(`grep -r "${safeQuery}" "${MIYABI_LOG_DIR}" --include="*.log" 2>/dev/null | head -100 || echo "No matches found"`);
        return { results: stdout.trim().split('\n') };
    }
    if (name === 'log_analyze_errors') {
        const days = Math.min(Math.max((args.days as number) || 1, 1), 30);
        const minutes = days * 1440;
        const { stdout } = await execAsync(`find "${MIYABI_LOG_DIR}" -name "*.log" -type f -mmin -${minutes} -exec grep -E "Error|Exception|Fail" {} + | head -100 || echo "No recent errors"`);
        return { overview: stdout };
    }
    if (name === 'log_grep') {
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
