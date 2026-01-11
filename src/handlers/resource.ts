
import * as si from 'systeminformation';
import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { sharedCache as cache } from '../utils/shared-cache.js';
import { validateInputLength, sanitizeShellArg, isValidHostname } from '../utils/security.js';
import { MAX_HOSTNAME_LENGTH } from '../constants.js';

export const resourceTools: Tool[] = [
    {
        name: 'resource_cpu',
        description: 'Get CPU load and core information.',
        inputSchema: { type: 'object', properties: {} }
    },
    {
        name: 'resource_memory',
        description: 'Get memory usage statistics (total, free, used, swap).',
        inputSchema: { type: 'object', properties: {} }
    },
    {
        name: 'resource_disk',
        description: 'Get disk usage information for all mounted filesystems.',
        inputSchema: { type: 'object', properties: {} }
    },
    {
        name: 'resource_load',
        description: 'Get average and current system load.',
        inputSchema: { type: 'object', properties: {} }
    },
    {
        name: 'resource_overview',
        description: 'Get a combined overview of CPU, Memory, and Disk usage in one call.',
        inputSchema: { type: 'object', properties: {} }
    },
    {
        name: 'resource_processes',
        description: 'Get list of top processes sorted by CPU or Memory.',
        inputSchema: {
            type: 'object',
            properties: {
                limit: { type: 'number', description: 'Number of processes (default 10)' },
                sort: { type: 'string', description: 'Sort by "cpu" or "memory" (default "cpu")' }
            }
        }
    },
    {
        name: 'resource_uptime',
        description: 'Get system uptime and timezone info.',
        inputSchema: { type: 'object', properties: {} }
    },
    {
        name: 'resource_network_stats',
        description: 'Get network interface statistics (rx/tx).',
        inputSchema: { type: 'object', properties: {} }
    },
    {
        name: 'resource_battery',
        description: 'Get battery status if available.',
        inputSchema: { type: 'object', properties: {} }
    },
    {
        name: 'resource_temperature',
        description: 'Get CPU temperature if available.',
        inputSchema: { type: 'object', properties: {} }
    }
];

export async function handleResourceTool(name: string, args: Record<string, unknown>): Promise<unknown> {
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
