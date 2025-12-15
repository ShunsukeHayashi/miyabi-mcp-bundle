/**
 * Miyabi MCP Bundle - Health Check Handler
 *
 * Comprehensive system health validation.
 */

import { ToolResult, HealthCheckResult } from '../types.js';
import { createErrorFromException } from '../utils/errors.js';

interface HealthCheckDependencies {
  git: {
    status: () => Promise<unknown>;
  };
  octokit: {
    users: { getAuthenticated: () => Promise<unknown> };
  } | null;
  commandExists: (cmd: string) => Promise<boolean>;
  si: {
    cpu: () => Promise<unknown>;
    mem: () => Promise<unknown>;
  };
}

/**
 * Run comprehensive health check
 */
export async function handleHealthCheck(
  deps: HealthCheckDependencies
): Promise<ToolResult> {
  try {
    const checks = {
      git: false,
      github: false,
      tmux: false,
      system: false,
    };

    const details: Record<string, unknown> = {};

    // Check Git
    try {
      await deps.git.status();
      checks.git = true;
      details.git = 'OK';
    } catch (e) {
      details.git = e instanceof Error ? e.message : 'Git not available';
    }

    // Check GitHub
    if (deps.octokit) {
      try {
        await deps.octokit.users.getAuthenticated();
        checks.github = true;
        details.github = 'OK';
      } catch (e) {
        details.github = e instanceof Error ? e.message : 'GitHub API error';
      }
    } else {
      details.github = 'No GITHUB_TOKEN configured';
    }

    // Check tmux
    try {
      const tmuxExists = await deps.commandExists('tmux');
      checks.tmux = tmuxExists;
      details.tmux = tmuxExists ? 'OK' : 'tmux not installed';
    } catch {
      details.tmux = 'tmux check failed';
    }

    // Check system resources
    try {
      const [cpu, mem] = await Promise.all([
        deps.si.cpu(),
        deps.si.mem()
      ]);
      checks.system = true;
      details.system = { cpu, mem };
    } catch (e) {
      details.system = e instanceof Error ? e.message : 'System check failed';
    }

    // Determine overall status
    const passedChecks = Object.values(checks).filter(Boolean).length;
    let status: HealthCheckResult['status'];

    if (passedChecks === 4) {
      status = 'healthy';
    } else if (passedChecks >= 2) {
      status = 'degraded';
    } else {
      status = 'unhealthy';
    }

    return {
      status,
      checks,
      details,
    };
  } catch (error) {
    return createErrorFromException(error, 'EXECUTION_FAILED');
  }
}

/**
 * Tool definition for health check
 */
export const healthCheckTool = {
  name: 'health_check',
  description: 'Comprehensive system health validation for Git, GitHub, tmux, and system resources',
  inputSchema: {
    type: 'object' as const,
    properties: {},
  },
};
