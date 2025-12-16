/**
 * Miyabi MCP Bundle - Handlers Index
 *
 * Central export for all tool handlers.
 * Each handler module exports:
 * - Handler function(s)
 * - Tool definition(s)
 *
 * Note: Full modularization will be completed in future sprints.
 * Current implementation serves as a reference pattern.
 */

// Health Check (reference implementation)
export { handleHealthCheck, healthCheckTool } from './health.js';

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

// Context Foundation (Issue #13)
export {
  handleContextStore,
  handleContextGet,
  handleContextList,
  handleContextExpire,
  handleContextShare,
  handleContextSearch,
  contextTools
} from './context.js';
