# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [3.5.0] - 2025-12-15

### Added
- **🗄️ Database Foundation** - SQL database integration (Issue #8)
- **158 Total Tools** - Expansion from 152 to 158 tools (+6)
- **1 New Category**:
  - **Database (6 tools)**: SQLite/PostgreSQL/MySQL support via CLI
- **6 Database Tools**:
  - `db_connect` - Test database connection
  - `db_tables` - List all tables in database
  - `db_schema` - Get schema for a specific table
  - `db_query` - Execute read-only SQL query (SELECT only)
  - `db_explain` - Explain query execution plan
  - `db_health` - Check database health and statistics

### Security
- All db_query operations are SELECT-only
- Dangerous SQL patterns (DROP, DELETE, UPDATE, INSERT, ALTER, TRUNCATE) blocked
- Input sanitization on all database parameters
- Environment variable support for secure password handling

### Changed
- Categories increased from 16 to 17
- Added CLI-based database support without requiring driver dependencies

## [3.4.0] - 2025-12-15

### Added
- **📋 Spec-Kit Integration** - Spec-Driven Development workflow
- **🔍 MCP Tool Discovery** - Search and discover tools dynamically
- **152 Total Tools** - Expansion from 140 to 152 tools (+12)
- **2 New Categories**:
  - **Spec-Kit (9 tools)**: Feature specification and planning workflow
  - **MCP Tool Discovery (3 tools)**: Search and discover available tools
- **9 Spec-Kit Tools** (GitHub spec-kit compatible):
  - `speckit_init` - Initialize Spec-Kit in project (creates .speckit/ directory)
  - `speckit_status` - Get Spec-Kit project status
  - `speckit_constitution` - Read or update project constitution (principles)
  - `speckit_specify` - Create feature specification from description
  - `speckit_plan` - Generate implementation plan for a feature
  - `speckit_tasks` - Generate task list from plan
  - `speckit_checklist` - Create implementation checklist
  - `speckit_analyze` - Analyze project for consistency
  - `speckit_list_features` - List all features in project
- **3 MCP Tool Discovery Tools**:
  - `mcp_search_tools` - Search tools by name or description with category filter
  - `mcp_list_categories` - List all tool categories with counts and descriptions
  - `mcp_get_tool_info` - Get detailed info about a specific tool including parameters

### Changed
- Categories increased from 14 to 16
- Integrated GitHub's spec-kit methodology for structured development
- Added tool discovery for better discoverability of 152+ tools

### Documentation
- Added Spec-Kit workflow documentation
- Added MCP Tool Discovery documentation
- Updated tool counts across all documentation

## [3.3.0] - 2025-12-15

### Added
- **🐳 Docker Inspector** - Complete container management (Issue #11)
- **140 Total Tools** - Major expansion from 120 to 140 tools (+20)
- **3 New Categories**:
  - **Docker (10 tools)**: Container lifecycle management
  - **Docker Compose (4 tools)**: Multi-container orchestration
  - **Kubernetes (6 tools)**: K8s cluster management
- **10 Docker Tools**:
  - `docker_ps` - List containers (running/all)
  - `docker_images` - List images
  - `docker_logs` - Get container logs
  - `docker_inspect` - Container/image details
  - `docker_stats` - Resource usage stats
  - `docker_exec` - Execute commands in containers
  - `docker_start` - Start containers
  - `docker_stop` - Stop containers
  - `docker_restart` - Restart containers
  - `docker_build` - Build images from Dockerfile
- **4 Docker Compose Tools**:
  - `compose_ps` - List service status
  - `compose_up` - Start services
  - `compose_down` - Stop services
  - `compose_logs` - Get service logs
- **6 Kubernetes Tools**:
  - `k8s_get_pods` - List pods
  - `k8s_get_deployments` - List deployments
  - `k8s_logs` - Get pod logs
  - `k8s_describe` - Describe resources
  - `k8s_apply` - Apply manifests (dry-run supported)
  - `k8s_delete` - Delete resources (dry-run supported)

### Changed
- Categories increased from 11 to 14
- All container commands include proper input sanitization
- Timeouts configured for long-running operations (builds up to 10min)

### Security
- Docker socket access validation
- Container name/ID sanitization to prevent injection
- Safe defaults for all operations

## [3.2.0] - 2025-12-15

### Added
- **🚀 120 Total Tools** - Major expansion from 103 to 120 tools (+17)
- **2 New Categories**:
  - **Linux systemd (3 tools)**: System service management for Linux
  - **Windows (2 tools)**: Windows service and Event Log support
- **19 Git Tools** (+4 new):
  - `git_conflicts` - Detect merge conflicts in current worktree
  - `git_submodule_status` - List submodule status
  - `git_lfs_status` - Get Git LFS status
  - `git_hooks_list` - List git hooks in repository
- **21 GitHub Tools** (+3 new):
  - `github_list_pr_reviews` - List reviews for a pull request
  - `github_create_review` - Create a review for a pull request
  - `github_submit_review` - Submit a pending review
- **15 Network Tools** (+3 new):
  - `network_route_table` - Show routing table
  - `network_ssl_check` - Check SSL certificate for a host
  - `network_traceroute` - Traceroute to a host
- **14 Process Tools** (+2 new):
  - `process_threads` - List threads for a process
  - `process_io_stats` - Get I/O statistics for a process (Linux)
- **3 Linux systemd Tools** (new category):
  - `linux_systemd_units` - List systemd units
  - `linux_systemd_status` - Get status of a systemd unit
  - `linux_journal_search` - Search systemd journal
- **2 Windows Tools** (new category):
  - `windows_service_status` - Get Windows service status
  - `windows_eventlog_search` - Search Windows Event Log

### Changed
- Categories increased from 9 to 11
- Enhanced cross-platform support with native OS integration
- Updated all documentation with new tool counts

## [3.1.0] - 2025-12-15

### Added
- **🚀 Onboarding Flow** - Interactive CLI for easy setup
  - `miyabi-mcp init` - Setup wizard that generates Claude Desktop config
  - `miyabi-mcp doctor` - Diagnose setup issues
  - `miyabi-mcp info` - Show system information
  - Beautiful ASCII banner with color support
- **Improved Server Startup** - Enhanced welcome message with box drawing

### Changed
- CLI now defaults to `miyabi-mcp` command with subcommands
- Separate `miyabi-mcp-server` command for direct server start

## [3.0.0] - 2025-12-15

### Added
- **🚀 103 Total Tools** - Massive expansion from 82 to 103 tools
- **Enterprise-grade Security**:
  - `sanitizeShellArg()` - Prevent command injection attacks
  - `sanitizePath()` - Prevent path traversal attacks
  - `commandExists()` - Safe command validation
  - `isValidHostname()` - Hostname validation for network tools
  - `isValidPid()` - PID validation for process tools
- **Intelligent Caching System**:
  - `SimpleCache` class with TTL support
  - Reduces redundant API calls and system queries
  - Configurable expiration times
- **15 Git Tools** (+3 new):
  - `git_show` - Show commit details and diffs
  - `git_tag_list` - List all tags with metadata
  - `git_contributors` - Get repository contributors with stats
- **10 Tmux Tools** (+1 new):
  - `tmux_session_info` - Detailed session information
- **7 Log Tools** (+1 new):
  - `log_stats` - Log file statistics and analysis
- **10 Resource Tools** (+2 new):
  - `resource_battery` - Battery status and health
  - `resource_temperature` - CPU/GPU temperature monitoring
- **12 Network Tools** (+4 new):
  - `network_port_check` - Check if port is open on host
  - `network_public_ip` - Get public IP address
  - `network_wifi_info` - WiFi connection details
  - Enhanced DNS lookup with IPv4/IPv6 support
- **12 Process Tools** (+4 new):
  - `process_ports` - Processes with network ports
  - `process_cpu_history` - CPU usage history
  - `process_memory_detail` - Detailed memory breakdown
  - Enhanced kill with safety confirmations
- **10 File Tools** (+4 new):
  - `file_checksum` - MD5/SHA256 file checksums
  - `file_size_summary` - Directory size analysis
  - `file_duplicates` - Find duplicate files
  - `file_read` - Safe file reading with size limits
- **18 GitHub Tools** (+4 new):
  - `github_repo_info` - Repository metadata and stats
  - `github_list_releases` - Release history
  - `github_list_branches` - Branch listing with protection status
  - `github_compare_commits` - Compare two commits/branches
- **Health Check System**:
  - `health_check` - Comprehensive system health validation
  - Validates Git, GitHub, system resources

### Changed
- Complete rewrite with modular architecture
- All handlers now use security sanitization
- Improved error messages with actionable suggestions
- Better TypeScript types and validation

### Security
- All shell commands sanitized against injection
- Path traversal protection on all file operations
- Input validation on all user-provided data
- Safe defaults for all operations

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
