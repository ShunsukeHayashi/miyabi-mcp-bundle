# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Miyabi MCP Bundle is an All-in-One MCP (Model Context Protocol) server providing **172 tools**, **18 resources**, **15 prompts**, and **9 skills** for Claude Desktop and AI agents.

### Key Features (v3.7.0)
- **172 MCP Tools** across 21 categories
- **18 MCP Resources** for data access (miyabi:// URIs)
- **15 MCP Prompts** for guided workflows
- **9 Agent Skills** following progressive disclosure pattern
- **Enterprise-grade Security**: Input sanitization, path traversal protection, symlink attack prevention
- **Intelligent Caching**: Built-in LRU cache with TTL support
- **Health Check System**: Comprehensive system validation
- **Cross-Platform**: Linux systemd support, Windows Event Log support
- **Container Management**: Docker, Docker Compose, Kubernetes integration
- **Spec-Driven Development**: GitHub spec-kit methodology integration
- **MCP Tool Discovery**: Search and discover tools dynamically
- **Database Integration**: SQLite, PostgreSQL, MySQL support via CLI

## Commands

```bash
npm run dev      # Run with tsx (live TypeScript execution)
npm run build    # Compile TypeScript to dist/
npm run lint     # Run ESLint
npm test         # Run vitest test suite
npm start        # Run compiled dist/index.js
```

## Architecture

### Hybrid Implementation (Transitioning from Monolith)

The codebase is currently in a hybrid state, transitioning from a single-file monolith to a modular architecture.

1. **Core & Legacy (`src/index.ts`)**:
   - Environment configuration & server setup
   - Main tool routing `handleTool()`
   - Legacy handlers: Git, Tmux, Log, Resource, Network, etc.

2. **Modern Modules (`src/handlers/`)**:
   - Newer features are modularized in dedicated files:
   - `handlers/society-health.ts`
   - `handlers/metrics.ts`
   - `handlers/bridge.ts`
   - `handlers/context.ts`

```
src/
├── index.ts              # Entry point & Legacy Handlers
├── handlers/             # Modern Modular Handlers
│   ├── society-health.ts
│   ├── metrics.ts
│   ├── bridge.ts
│   └── context.ts
└── utils/                # Shared Utilities
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

## Agent Skills (v3.7.0)

Skills follow progressive disclosure pattern - load metadata first, full content only when activated.

### Skill Index

See `.claude/overview.md` for complete skill catalog.

| Skill | Tools | Triggers |
|-------|-------|----------|
| `git-operations` | 19 | git status, branches, commit |
| `github-integration` | 21 | issues, PRs, CI |
| `docker-management` | 14 | containers, logs, compose |
| `system-monitoring` | 10 | health check, CPU, memory |
| `network-diagnostics` | 15 | ping, DNS, ports |
| `kubernetes-operations` | 6 | pods, services, logs |
| `log-analysis` | 7 | read logs, find errors |
| `process-management` | 24 | processes, tmux |
| `sequential-thinking` | 3 | analyze, reason |

### Skill Structure

```
.claude/skills/[skill-name]/
├── SKILL.md              # Main skill definition
└── resources/            # Optional reference docs
```

### Usage Pattern

```
1. User triggers skill → Load SKILL.md
2. Follow skill workflow → Use wrapped MCP tools
3. Complete task → Return results
```
