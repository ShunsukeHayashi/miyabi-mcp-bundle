# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.1.0] - 2025-12-15

### Added
- **7 New Tools**:
  - `git_stash_list` - List all git stashes
  - `git_blame` - Get blame info for files with line range support
  - `network_dns_lookup` - DNS lookup with IPv4/IPv6 resolution
  - `process_kill` - Kill processes by PID with confirmation requirement
  - `file_read` - Read file contents with size limits (max 100KB)
  - `github_list_workflows` - List GitHub Actions workflows
  - `github_list_workflow_runs` - List recent workflow runs with status filter

### Changed
- Increased tool count from 76 to 82
- Updated all documentation to reflect new tool counts

### Security
- Added `sanitizeShellArg()` helper to prevent command injection
- Added `sanitizePath()` helper to prevent path traversal attacks
- Applied input sanitization across all shell commands (tmux, log, network, process)
- Added hostname validation for network tools (ping, DNS lookup)
- Added PID validation for process tools
- Added file size limits for file_read tool

### Fixed
- Removed duplicate `si.currentLoad()` call in `resource_overview` handler
- Completed all `claude_*` stub implementations:
  - `claude_session_info` - Now shows Claude process info
  - `claude_background_shells` - Lists node/tsx processes related to Claude
  - `claude_status` - Comprehensive status with config, logs, and processes
- Added platform checks for commands (pstree fallback, macOS vs Linux /proc)
- ESLint compliance: replaced `require('path')` with proper import

## [2.0.0] - 2025-12-15

### Added
- **Claude Code Plugins**: Complete plugin ecosystem integration
  - 38 AI Agents (coordinator, codegen, pr-agent, review-agent, etc.)
  - 22 Development Skills (rust-development, git-workflow, tdd-workflow, etc.)
  - 56 Slash Commands (/deploy, /pr-create, /issue-create, etc.)
  - 24 Hooks (auto-format, validate-rust, validate-typescript, etc.)
- Plugin packages in `plugins/` directory (zip format for distribution)
- Plugin source in `claude-plugins/` directory (unpacked for development)
- Marketplace JSON for plugin discovery

### Changed
- Increased tool count from 75 to 76
- Updated documentation with plugin information
- Enhanced README with comprehensive plugin reference

### Fixed
- Version consistency across all files

## [1.0.1] - 2025-12-15

### Fixed
- Minor documentation updates
- Submodule configuration for plugins

## [1.0.0] - 2025-01-15

### Added
- Initial release with 75+ tools across 9 categories
- Git Inspector (10 tools): status, branches, diff, log, worktrees
- Tmux Monitor (9 tools): sessions, windows, panes, send-keys
- Log Aggregator (6 tools): search, errors, warnings, tail
- Resource Monitor (8 tools): CPU, memory, disk, processes
- Network Inspector (8 tools): interfaces, connections, ports, ping
- Process Inspector (8 tools): list, search, tree, top
- File Watcher (6 tools): stats, recent changes, search, compare
- Claude Monitor (8 tools): config, MCP status, logs
- GitHub Integration (12 tools): issues, PRs, labels, milestones
- Cross-platform support (macOS, Linux, Windows)
- Easy installation via npx

### Documentation
- Comprehensive README with English and Japanese
- Claude Desktop configuration examples
- Tool reference documentation
