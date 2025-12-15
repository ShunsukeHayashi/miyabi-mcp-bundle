# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Miyabi MCP Bundle is an All-in-One MCP (Model Context Protocol) server providing **102 tools** across 9 categories + health check for Claude Desktop and AI agents. The entire implementation lives in a single `src/index.ts` file (~1400 lines).

### Key Features (v3.0.0)
- **102 MCP Tools** across 9 categories
- **Enterprise-grade Security**: Input sanitization, path traversal protection
- **Intelligent Caching**: Built-in cache with TTL support
- **Health Check System**: Comprehensive system validation

## Commands

```bash
npm run dev      # Run with tsx (live TypeScript execution)
npm run build    # Compile TypeScript to dist/
npm run lint     # Run ESLint
npm test         # Run vitest test suite
npm start        # Run compiled dist/index.js
```

## Architecture

### Single-File Implementation

All tool definitions and handlers are in `src/index.ts`:

```
src/index.ts
├── Environment Configuration (lines 40-59)
├── Tool Definitions Array (lines 66-159)
├── Main Handler: handleTool() (lines 162-256)
│   └── Routes to category-specific handlers by prefix
├── Category Handlers:
│   ├── handleTmuxTool()     (tmux_*)
│   ├── handleLogTool()      (log_*)
│   ├── handleResourceTool() (resource_*)
│   ├── handleNetworkTool()  (network_*)
│   ├── handleProcessTool()  (process_*)
│   ├── handleFileTool()     (file_*)
│   ├── handleClaudeTool()   (claude_*)
│   └── handleGitHubTool()   (github_*)
└── MCP Server Setup (lines 656-700)
```

### Tool Naming Convention

Tools follow `category_action` pattern:
- `git_status`, `git_diff`, `git_log`
- `tmux_list_sessions`, `tmux_send_keys`
- `resource_cpu`, `resource_memory`
- `github_list_issues`, `github_create_pr`

### Key Libraries

- `@modelcontextprotocol/sdk` - MCP protocol implementation
- `simple-git` - Git operations
- `@octokit/rest` - GitHub API (optional, requires GITHUB_TOKEN)
- `systeminformation` - System resource monitoring
- `glob` - File pattern matching

### Environment Variables

| Variable | Default | Purpose |
|----------|---------|---------|
| `MIYABI_REPO_PATH` | `process.cwd()` | Git repository path |
| `MIYABI_LOG_DIR` | Same as repo path | Log directory |
| `MIYABI_WATCH_DIR` | Same as repo path | File watch directory |
| `GITHUB_TOKEN` | (none) | GitHub API authentication |
| `GITHUB_DEFAULT_OWNER` | (none) | Default GitHub owner |
| `GITHUB_DEFAULT_REPO` | (none) | Default GitHub repo |

### Cross-Platform Paths

Claude config paths are resolved per platform:
- macOS: `~/Library/Application Support/Claude`
- Windows: `%APPDATA%\Claude`
- Linux: `~/.config/claude`

## Adding New Tools

1. Add tool definition to the `tools` array (line 66+):
```typescript
{
  name: 'category_action',
  description: 'Description',
  inputSchema: {
    type: 'object',
    properties: { param: { type: 'string' } },
    required: ['param']
  }
}
```

2. Add handler logic in the appropriate `handle*Tool()` function or create a new category handler

3. If new category, add routing in `handleTool()`:
```typescript
if (name.startsWith('newcategory_')) {
  return await handleNewCategoryTool(name, args);
}
```

## Error Handling Pattern

All handlers wrap operations in try-catch and return error objects:
```typescript
try {
  // operation
} catch (error) {
  return { error: error instanceof Error ? error.message : String(error) };
}
```

## TypeScript Configuration

- Target: ES2022, Module: NodeNext
- Strict mode enabled with all strict checks
- Source maps and declaration files generated
- Output to `dist/` directory
