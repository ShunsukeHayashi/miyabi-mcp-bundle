
import { exec } from 'child_process';
import { promisify } from 'util';
import * as si from 'systeminformation';
import { platform } from 'os';
import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { sanitizeShellArg, isValidPid, commandExists } from '../utils/security.js';

const execAsync = promisify(exec);

export const processTools: Tool[] = [
    {
        name: 'process_info',
        description: 'Get detailed information about a specific process by PID.',
        inputSchema: {
            type: 'object',
            properties: {
                pid: { type: 'number', description: 'Process ID' }
            },
            required: ['pid']
        }
    },
    {
        name: 'process_list',
        description: 'List running processes with filter and sort options.',
        inputSchema: {
            type: 'object',
            properties: {
                limit: { type: 'number', description: 'Max results (default 20)' },
                sort: { type: 'string', description: 'cpu, memory, or name' }
            }
        }
    },
    {
        name: 'process_search',
        description: 'Search processes by name or command line arguments.',
        inputSchema: {
            type: 'object',
            properties: {
                query: { type: 'string', description: 'Search term' }
            },
            required: ['query']
        }
    },
    {
        name: 'process_tree',
        description: 'display a tree of processes (like pstree).',
        inputSchema: {
            type: 'object',
            properties: {}
        }
    },
    {
        name: 'process_file_descriptors',
        description: 'List open file descriptors for a process (lsof).',
        inputSchema: {
            type: 'object',
            properties: {
                pid: { type: 'number', description: 'Process ID' }
            },
            required: ['pid']
        }
    },
    {
        name: 'process_environment',
        description: 'Get the environment variables for a specific process.',
        inputSchema: {
            type: 'object',
            properties: {
                pid: { type: 'number', description: 'Process ID' }
            },
            required: ['pid']
        }
    },
    {
        name: 'process_children',
        description: 'Get child processes for a given PID.',
        inputSchema: {
            type: 'object',
            properties: {
                pid: { type: 'number', description: 'Parent PID' }
            },
            required: ['pid']
        }
    },
    {
        name: 'process_top',
        description: 'Get top processes by CPU usage.',
        inputSchema: {
            type: 'object',
            properties: {
                limit: { type: 'number', description: 'Number of processes (default 10)' }
            }
        }
    },
    {
        name: 'process_kill',
        description: 'Terminate a process by PID after confirmation.',
        inputSchema: {
            type: 'object',
            properties: {
                pid: { type: 'number', description: 'Process ID' },
                signal: { type: 'string', description: 'Signal (SIGTERM, SIGKILL, SIGINT), default SIGTERM' },
                confirm: { type: 'boolean', description: 'Must be set to true' }
            },
            required: ['pid', 'confirm']
        }
    },
    {
        name: 'process_ports',
        description: 'List network ports a process is listening on (lsof -i).',
        inputSchema: {
            type: 'object',
            properties: {
                pid: { type: 'number', description: 'Process ID' }
            },
            required: ['pid']
        }
    },
    {
        name: 'process_cpu_history',
        description: 'Get a brief history of CPU usage for a process (samples over a few seconds).',
        inputSchema: {
            type: 'object',
            properties: {
                pid: { type: 'number', description: 'Process ID' }
            },
            required: ['pid']
        }
    },
    {
        name: 'process_memory_detail',
        description: 'Get detailed memory stats for a process (RSS, VSZ).',
        inputSchema: {
            type: 'object',
            properties: {
                pid: { type: 'number', description: 'Process ID' }
            },
            required: ['pid']
        }
    },
    {
        name: 'process_threads',
        description: 'List threads for a process.',
        inputSchema: {
            type: 'object',
            properties: {
                pid: { type: 'number', description: 'Process ID' }
            },
            required: ['pid']
        }
    },
    {
        name: 'process_io_stats',
        description: 'Get I/O statistics for a process (Linux only).',
        inputSchema: {
            type: 'object',
            properties: {
                pid: { type: 'number', description: 'Process ID' }
            },
            required: ['pid']
        }
    }
];

export async function handleProcessTool(name: string, args: Record<string, unknown>): Promise<unknown> {
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
