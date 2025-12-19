# Contributing to Miyabi MCP Bundle

First off, thank you for considering contributing to Miyabi MCP Bundle! 🌸

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [How to Contribute](#how-to-contribute)
- [Development Setup](#development-setup)
- [Adding New Tools](#adding-new-tools)
- [Pull Request Process](#pull-request-process)
- [Style Guide](#style-guide)

## Code of Conduct

This project adheres to a [Code of Conduct](CODE_OF_CONDUCT.md). By participating, you are expected to uphold this code.

## Getting Started

### Prerequisites

- Node.js >= 18.0.0
- npm or yarn
- Git
- TypeScript knowledge

### Fork and Clone

```bash
# Fork the repository on GitHub, then:
git clone https://github.com/YOUR_USERNAME/miyabi-mcp-bundle.git
cd miyabi-mcp-bundle
npm install
```

## How to Contribute

### Reporting Bugs

- Check if the bug has already been reported in [Issues](https://github.com/ShunsukeHayashi/miyabi-mcp-bundle/issues)
- If not, create a new issue using the bug report template
- Include as much detail as possible

### Suggesting Features

- Check existing [feature requests](https://github.com/ShunsukeHayashi/miyabi-mcp-bundle/issues?q=label%3Aenhancement)
- Create a new issue using the feature request template
- Describe the use case and expected behavior

### Submitting Pull Requests

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-tool`)
3. Make your changes
4. Run tests (`npm test`)
5. Commit with conventional commits
6. Push and create a Pull Request

## Development Setup

```bash
# Install dependencies
npm install

# Run in development mode
npm run dev

# Build
npm run build

# Run tests
npm test

# Run linter
npm run lint
```

## Adding New Tools

### Step 1: Define the Tool

Add your tool definition to the `tools` array in `src/index.ts`:

```typescript
{
  name: 'category_action',
  description: 'Clear description of what this tool does',
  inputSchema: {
    type: 'object',
    properties: {
      param1: { type: 'string', description: 'Parameter description' },
      param2: { type: 'number', description: 'Optional parameter' }
    },
    required: ['param1']
  }
}
```

### Step 2: Implement the Handler

Add the handler logic in the appropriate `handle*Tool()` function:

```typescript
case 'category_action': {
  const param1 = sanitizeShellArg(String(args.param1 || ''));
  // Your implementation here
  return { result: 'success', data: yourData };
}
```

### Step 3: Security Requirements

**All new tools MUST follow these security guidelines:**

| Input Type | Required Function |
|------------|-------------------|
| Shell arguments | `sanitizeShellArg()` |
| File paths | `sanitizePath()` |
| Hostnames | `isValidHostname()` |
| Process IDs | `isValidPid()` |

### Step 4: Update Documentation

1. Add to the appropriate section in `README.md`
2. Update tool count in all files
3. Add to `CHANGELOG.md`

### Tool Categories

| Prefix | Category | Handler |
|--------|----------|---------|
| `git_` | Git Inspector | Direct in handleTool |
| `tmux_` | Tmux Monitor | handleTmuxTool |
| `log_` | Log Aggregator | handleLogTool |
| `resource_` | Resource Monitor | handleResourceTool |
| `network_` | Network Inspector | handleNetworkTool |
| `process_` | Process Inspector | handleProcessTool |
| `file_` | File Watcher | handleFileTool |
| `claude_` | Claude Monitor | handleClaudeTool |
| `github_` | GitHub Integration | handleGitHubTool |

## Pull Request Process

1. **Title**: Use conventional commit format
   - `feat: add new_tool to category`
   - `fix: resolve issue with tool_name`
   - `docs: update README`

2. **Description**: Fill out the PR template completely

3. **Checklist**:
   - [ ] Tests pass (`npm test`)
   - [ ] Linter passes (`npm run lint`)
   - [ ] Build succeeds (`npm run build`)
   - [ ] Security guidelines followed
   - [ ] Documentation updated

4. **Review**: Wait for maintainer review

## Style Guide

### TypeScript

- Use TypeScript strict mode
- Prefer `const` over `let`
- Use meaningful variable names
- Add JSDoc comments for functions

### Naming Conventions

- Tools: `category_action` (snake_case)
- Functions: `camelCase`
- Constants: `UPPER_SNAKE_CASE`
- Types/Interfaces: `PascalCase`

### Error Handling

```typescript
try {
  // operation
} catch (error) {
  return { error: error instanceof Error ? error.message : String(error) };
}
```

## Questions?

Feel free to open an issue or reach out to the maintainers.

Thank you for contributing! 🌸
