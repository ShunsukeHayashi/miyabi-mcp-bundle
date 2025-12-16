/**
 * Society Health Check Pro - Full Society Health Monitoring
 * Issue #16: 全Society健全性一括監視
 */

import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

// Society definitions (26 Societies)
const SOCIETIES = [
  'investment', 'sales', 'marketing', 'content', 'customer_service',
  'data_analytics', 'operations', 'research', 'product', 'engineering',
  'hr', 'finance', 'legal', 'strategy', 'innovation',
  'quality', 'security', 'infrastructure', 'support', 'training',
  'compliance', 'procurement', 'logistics', 'partnerships', 'communications', 'executive'
];

interface SocietyHealth {
  status: 'healthy' | 'degraded' | 'error' | 'unknown';
  agents: { total: number; active: number; idle: number; error: number };
  mcp_servers: { total: number; connected: number };
  last_activity?: string;
  issues?: string[];
}

interface HealthResult {
  timestamp: string;
  societies: Record<string, SocietyHealth>;
  summary: {
    total_societies: number;
    healthy: number;
    degraded: number;
    error: number;
  };
}

/**
 * Get tmux sessions to check Society health
 */
async function getTmuxSessions(): Promise<string[]> {
  try {
    const { stdout } = await execAsync('tmux list-sessions -F "#{session_name}" 2>/dev/null || echo ""');
    return stdout.trim().split('\n').filter(s => s);
  } catch {
    return [];
  }
}

/**
 * Check single Society health via tmux
 */
async function checkSocietyHealth(society: string): Promise<SocietyHealth> {
  const sessions = await getTmuxSessions();
  const societySessions = sessions.filter(s => s.toLowerCase().includes(society.toLowerCase()));
  
  if (societySessions.length === 0) {
    return {
      status: 'unknown',
      agents: { total: 0, active: 0, idle: 0, error: 0 },
      mcp_servers: { total: 0, connected: 0 }
    };
  }

  // Check for active agents in sessions
  let activeCount = 0;
  let errorCount = 0;
  
  for (const session of societySessions) {
    try {
      const { stdout } = await execAsync(`tmux capture-pane -t "${session}" -p 2>/dev/null | tail -5`);
      if (stdout.includes('error') || stdout.includes('Error') || stdout.includes('ERROR')) {
        errorCount++;
      } else {
        activeCount++;
      }
    } catch {
      errorCount++;
    }
  }

  const status = errorCount > 0 ? 'degraded' : (activeCount > 0 ? 'healthy' : 'unknown');
  
  return {
    status,
    agents: { 
      total: societySessions.length, 
      active: activeCount, 
      idle: 0, 
      error: errorCount 
    },
    mcp_servers: { total: 1, connected: status === 'healthy' ? 1 : 0 },
    last_activity: new Date().toISOString(),
    issues: errorCount > 0 ? [`${errorCount} agent(s) reporting errors`] : undefined
  };
}

// === Handler Functions ===

export async function handleSocietyHealthAll(): Promise<HealthResult> {
  const timestamp = new Date().toISOString();
  const societies: Record<string, SocietyHealth> = {};
  
  let healthy = 0, degraded = 0, errorCount = 0;
  
  for (const society of SOCIETIES) {
    const health = await checkSocietyHealth(society);
    societies[society] = health;
    
    if (health.status === 'healthy') healthy++;
    else if (health.status === 'degraded') degraded++;
    else if (health.status === 'error') errorCount++;
  }

  return {
    timestamp,
    societies,
    summary: {
      total_societies: SOCIETIES.length,
      healthy,
      degraded,
      error: errorCount
    }
  };
}

export async function handleSocietyHealthSingle(society: string): Promise<SocietyHealth & { society: string }> {
  const health = await checkSocietyHealth(society);
  return { society, ...health };
}

export async function handleSocietyAgentStatus(society?: string): Promise<object> {
  const sessions = await getTmuxSessions();
  const filtered = society 
    ? sessions.filter(s => s.toLowerCase().includes(society.toLowerCase()))
    : sessions;
  
  const agents: Array<{ name: string; session: string; status: string }> = [];
  
  for (const session of filtered) {
    try {
      const { stdout } = await execAsync(`tmux capture-pane -t "${session}" -p 2>/dev/null | tail -1`);
      agents.push({
        name: session,
        session,
        status: stdout.includes('error') ? 'error' : 'active'
      });
    } catch {
      agents.push({ name: session, session, status: 'unknown' });
    }
  }

  return {
    timestamp: new Date().toISOString(),
    society: society || 'all',
    agents,
    total: agents.length,
    active: agents.filter(a => a.status === 'active').length,
    error: agents.filter(a => a.status === 'error').length
  };
}

export async function handleSocietyMcpStatus(): Promise<object> {
  // Check MCP server processes
  let mcpServers: Array<{ name: string; status: string; pid?: number }> = [];
  
  try {
    const { stdout } = await execAsync('ps aux | grep -i mcp | grep -v grep');
    const lines = stdout.trim().split('\n').filter(l => l);
    mcpServers = lines.map(line => {
      const parts = line.split(/\s+/);
      return {
        name: parts.slice(10).join(' ').slice(0, 50),
        status: 'running',
        pid: parseInt(parts[1])
      };
    });
  } catch {
    // No MCP processes found
  }

  return {
    timestamp: new Date().toISOString(),
    mcp_servers: mcpServers,
    total: mcpServers.length,
    running: mcpServers.filter(s => s.status === 'running').length
  };
}

export async function handleSocietyMetricsSummary(): Promise<object> {
  const sessions = await getTmuxSessions();
  const healthResult = await handleSocietyHealthAll();
  
  return {
    timestamp: new Date().toISOString(),
    metrics: {
      total_societies: SOCIETIES.length,
      active_sessions: sessions.length,
      health_summary: healthResult.summary,
      societies_by_status: {
        healthy: Object.entries(healthResult.societies).filter(([,v]) => v.status === 'healthy').map(([k]) => k),
        degraded: Object.entries(healthResult.societies).filter(([,v]) => v.status === 'degraded').map(([k]) => k),
        error: Object.entries(healthResult.societies).filter(([,v]) => v.status === 'error').map(([k]) => k),
        unknown: Object.entries(healthResult.societies).filter(([,v]) => v.status === 'unknown').map(([k]) => k)
      }
    }
  };
}

// === Tool Definitions ===

export const societyHealthTools = [
  {
    name: 'society_health_all',
    description: 'Check health status of all 26 Miyabi Societies at once. Returns comprehensive health report.',
    inputSchema: { type: 'object' as const, properties: {} }
  },
  {
    name: 'society_health_single', 
    description: 'Check detailed health status of a single Society.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        society: { type: 'string', description: 'Society name (e.g., investment, sales, marketing)' }
      },
      required: ['society']
    }
  },
  {
    name: 'society_agent_status',
    description: 'Get status of all agents within a Society or all Societies.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        society: { type: 'string', description: 'Optional: filter by Society name' }
      }
    }
  },
  {
    name: 'society_mcp_status',
    description: 'Check status of MCP servers used by Societies.',
    inputSchema: { type: 'object' as const, properties: {} }
  },
  {
    name: 'society_metrics_summary',
    description: 'Get aggregated metrics summary for all Societies.',
    inputSchema: { type: 'object' as const, properties: {} }
  }
];
