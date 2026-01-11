
import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { exec } from 'child_process';
import { promisify } from 'util';
import dns from 'dns';
import { platform } from 'os';

import { sanitizeShellArg, isValidHostname } from '../utils/security.js';
import { sharedCache as cache } from '../utils/shared-cache.js';

const execAsync = promisify(exec);
const dnsResolve4 = promisify(dns.resolve4);
const dnsResolve6 = promisify(dns.resolve6);

export const networkTools: Tool[] = [
    { name: 'network_interfaces', description: 'List network interfaces with IP addresses, MAC, and status. Check connectivity.', inputSchema: { type: 'object', properties: {} } },
    { name: 'network_connections', description: 'List active TCP/UDP connections with remote endpoints. Debug network issues.', inputSchema: { type: 'object', properties: {} } },
    { name: 'network_listening_ports', description: 'List ports your services are listening on. Find port conflicts.', inputSchema: { type: 'object', properties: { protocol: { type: 'string', enum: ['tcp', 'udp', 'all'], description: 'Filter by protocol (default: all)' } } } },
    { name: 'network_stats', description: 'Get network I/O statistics: bytes, packets, errors, and drops per interface.', inputSchema: { type: 'object', properties: {} } },
    { name: 'network_gateway', description: 'Get default gateway IP and interface. Verify internet routing.', inputSchema: { type: 'object', properties: {} } },
    { name: 'network_ping', description: 'Ping a host to check connectivity and measure latency (default: 4 pings).', inputSchema: { type: 'object', properties: { host: { type: 'string', description: 'Hostname or IP address' }, count: { type: 'number', description: 'Number of pings (default: 4)' } }, required: ['host'] } },
    { name: 'network_bandwidth', description: 'Get current network bandwidth usage in bytes/sec per interface.', inputSchema: { type: 'object', properties: {} } },
    { name: 'network_overview', description: 'Get complete network overview: interfaces, connections, ports, and gateway.', inputSchema: { type: 'object', properties: {} } },
    { name: 'network_dns_lookup', description: 'Resolve hostname to IP addresses (IPv4 and IPv6). Debug DNS issues.', inputSchema: { type: 'object', properties: { hostname: { type: 'string', description: 'Hostname to resolve' } }, required: ['hostname'] } },
    { name: 'network_port_check', description: 'Check if a TCP port is open on a remote host. Test service availability.', inputSchema: { type: 'object', properties: { host: { type: 'string', description: 'Target host' }, port: { type: 'number', description: 'Port number to check' } }, required: ['host', 'port'] } },
    { name: 'network_public_ip', description: 'Get your public IP address as seen from the internet.', inputSchema: { type: 'object', properties: {} } },
    { name: 'network_wifi_info', description: 'Get WiFi connection details: SSID, signal strength, channel (macOS/Linux).', inputSchema: { type: 'object', properties: {} } },
    { name: 'network_route_table', description: 'Show IP routing table. Debug traffic routing and network paths.', inputSchema: { type: 'object', properties: {} } },
    { name: 'network_ssl_check', description: 'Check SSL/TLS certificate: expiry, issuer, validity. Monitor cert health.', inputSchema: { type: 'object', properties: { host: { type: 'string', description: 'Hostname to check' }, port: { type: 'number', description: 'Port (default: 443)' } }, required: ['host'] } },
    { name: 'network_traceroute', description: 'Trace network path to a host. Diagnose routing and latency issues.', inputSchema: { type: 'object', properties: { host: { type: 'string', description: 'Target host' }, maxHops: { type: 'number', description: 'Max hops (default: 30)' } }, required: ['host'] } },
];

export async function handleNetworkTool(name: string, args: Record<string, unknown>): Promise<unknown> {
    if (name === 'network_interfaces') {
        const cached = cache.get('network_interfaces');
        if (cached) return cached;
        const { stdout } = await execAsync('ifconfig -a || ip addr');
        const result = { interfaces: stdout };
        cache.set('network_interfaces', result, 30000); // 30s cache
        return result;
    }
    if (name === 'network_connections') {
        const cmd = platform() === 'win32' ? 'netstat -ano' : 'netstat -an';
        const { stdout } = await execAsync(cmd);
        return { connections: stdout.trim().split('\n').slice(0, 50) };
    }
    if (name === 'network_listening_ports') {
        const protocol = (args.protocol as string) || 'all';
        let cmd = 'lsof -i -P -n | grep LISTEN';
        if (protocol === 'tcp') cmd = 'lsof -i TCP -P -n | grep LISTEN';
        if (protocol === 'udp') cmd = 'lsof -i UDP -P -n | grep LISTEN'; // UDP doesn't technically "listen" but shows up
        if (platform() === 'win32') cmd = 'netstat -an | findstr LISTENING';
        try {
            const { stdout } = await execAsync(cmd);
            return { ports: stdout.trim().split('\n') };
        } catch {
            return { ports: [], message: 'No listening ports found or lsof not available' };
        }
    }
    if (name === 'network_stats') {
        const cached = cache.get('network_stats');
        if (cached) return cached;
        const cmd = platform() === 'darwin' ? 'netstat -ib' : 'netstat -i'; // -b for bytes on macOS
        try {
            const { stdout } = await execAsync(cmd);
            const result = { stats: stdout };
            cache.set('network_stats', result, 10000); // 10s cache
            return result;
        } catch {
            return { error: 'Could not get network stats' };
        }
    }
    if (name === 'network_gateway') {
        const cmd = platform() === 'darwin'
            ? 'route -n get default | grep gateway'
            : platform() === 'win32'
                ? 'ipconfig | findstr "Default Gateway"'
                : 'ip route | grep default';
        try {
            const { stdout } = await execAsync(cmd);
            return { gateway: stdout.trim() };
        } catch {
            return { error: 'Could not determine gateway' };
        }
    }
    if (name === 'network_ping') {
        const host = sanitizeShellArg(args.host as string);
        if (!isValidHostname(host)) return { error: 'Invalid hostname' };
        const count = Math.min(Math.max((args.count as number) || 4, 1), 20);
        const cmd = platform() === 'win32'
            ? `ping -n ${count} "${host}"`
            : `ping -c ${count} "${host}"`;
        try {
            const { stdout } = await execAsync(cmd);
            return { host, result: stdout };
        } catch (error) {
            return { error: error instanceof Error ? error.message : 'Ping failed' };
        }
    }
    if (name === 'network_bandwidth') {
        // Basic snapshot using netstat, real bandwidth requires duration monitoring
        const cmd = platform() === 'darwin' ? 'netstat -ib' : 'cat /proc/net/dev';
        try {
            const { stdout } = await execAsync(cmd);
            return { bandwidth_snapshot: stdout };
        } catch {
            return { error: 'Could not retrieve bandwidth info' };
        }
    }
    if (name === 'network_overview') {
        // Aggregate multiple checks (cached)
        const interfaces = await handleNetworkTool('network_interfaces', {}) as { interfaces?: string };
        const gateway = await handleNetworkTool('network_gateway', {}) as { gateway?: string };
        return {
            interfaces: interfaces.interfaces || interfaces,
            gateway: gateway.gateway || gateway
        };
    }
    if (name === 'network_dns_lookup') {
        const hostname = args.hostname as string;
        if (!isValidHostname(hostname)) return { error: 'Invalid hostname' };
        try {
            const [ipv4, ipv6] = await Promise.allSettled([
                dnsResolve4(hostname).catch(() => []),
                dnsResolve6(hostname).catch(() => [])
            ]);
            return {
                hostname,
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
    throw new Error(`Unknown network tool: ${name}`);
}
