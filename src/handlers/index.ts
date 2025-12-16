/**
 * Handlers Index - Modular Handler Exports
 * 
 * Each handler module exports:
 * - Handler function(s)
 * - Tool definition(s)
 *
 * Note: Full modularization will be completed in future sprints.
 * Current implementation serves as a reference pattern.
 */

// Health Check (reference implementation)
export { handleHealthCheck, healthCheckTool } from './health.js';

// Society Health Check Pro (Issue #16)
export { 
  handleSocietyHealthAll,
  handleSocietyHealthSingle,
  handleSocietyAgentStatus,
  handleSocietyMcpStatus,
  handleSocietyMetricsSummary,
  societyHealthTools 
} from './society-health.js';

// Future handlers will be exported here as they are modularized:
// export * from './git.js';
// export * from './tmux.js';
// export * from './log.js';
// export * from './resource.js';
// export * from './network.js';
// export * from './process.js';
// export * from './file.js';
// export * from './claude.js';
// export * from './github.js';
