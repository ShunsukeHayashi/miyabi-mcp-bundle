<div align="center">

# 🌸 Miyabi MCP Bundle

### The Ultimate MCP Server for Claude Desktop & AI Agents

[![npm version](https://img.shields.io/npm/v/miyabi-mcp-bundle?style=for-the-badge&logo=npm&logoColor=white&color=CB3837)](https://www.npmjs.com/package/miyabi-mcp-bundle)
[![npm downloads](https://img.shields.io/npm/dm/miyabi-mcp-bundle?style=for-the-badge&logo=npm&logoColor=white&color=CB3837)](https://www.npmjs.com/package/miyabi-mcp-bundle)
[![GitHub stars](https://img.shields.io/github/stars/ShunsukeHayashi/miyabi-mcp-bundle?style=for-the-badge&logo=github&logoColor=white&color=181717)](https://github.com/ShunsukeHayashi/miyabi-mcp-bundle)
[![License](https://img.shields.io/github/license/ShunsukeHayashi/miyabi-mcp-bundle?style=for-the-badge&color=blue)](LICENSE)

[![TypeScript](https://img.shields.io/badge/TypeScript-5.3-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-≥18-339933?style=for-the-badge&logo=node.js&logoColor=white)](https://nodejs.org/)
[![MCP](https://img.shields.io/badge/MCP-Compatible-00D084?style=for-the-badge&logo=anthropic&logoColor=white)](https://modelcontextprotocol.io/)

<br />

**82 MCP Tools** · **38 Agents** · **22 Skills** · **56 Commands** · **24 Hooks**

[Installation](#-installation) · [Quick Start](#-quick-start) · [Tool Reference](#-complete-tool-reference) · [Plugins](#-plugins) · [日本語](#-日本語)

<br />

```
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│   ███╗   ███╗██╗██╗   ██╗ █████╗ ██████╗ ██╗                   │
│   ████╗ ████║██║╚██╗ ██╔╝██╔══██╗██╔══██╗██║                   │
│   ██╔████╔██║██║ ╚████╔╝ ███████║██████╔╝██║                   │
│   ██║╚██╔╝██║██║  ╚██╔╝  ██╔══██║██╔══██╗██║                   │
│   ██║ ╚═╝ ██║██║   ██║   ██║  ██║██████╔╝██║                   │
│   ╚═╝     ╚═╝╚═╝   ╚═╝   ╚═╝  ╚═╝╚═════╝ ╚═╝                   │
│                                                                 │
│        All-in-One MCP Server for Claude Desktop                 │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

</div>

---

## ✨ Why Miyabi?

> **Miyabi (雅)** - Japanese for "elegance" and "refinement"

Transform your Claude Desktop into a **powerful development command center** with a single MCP server that provides everything you need:

<table>
<tr>
<td width="50%">

### 🎯 **Complete AI Development Platform**
82 MCP Tools + 38 Agents + 22 Skills + 56 Commands + 24 Hooks in one package.

### ⚡ **Zero Configuration**
Works instantly out of the box. Just add to Claude Desktop and go.

</td>
<td width="50%">

### 🔒 **Production Tested**
Battle-tested in real development environments with enterprise-grade reliability.

### 🌍 **Cross-Platform**
Seamlessly works on macOS, Linux, and Windows.

</td>
</tr>
</table>

---

## 📦 Installation

### Quick Start (Recommended)

```bash
npx miyabi-mcp-bundle
```

### Global Installation

```bash
npm install -g miyabi-mcp-bundle
miyabi-mcp
```

---

## ⚙️ Claude Desktop Setup

Add to your Claude Desktop configuration:

<details>
<summary><b>📍 Config File Locations</b></summary>

| OS | Path |
|---|---|
| **macOS** | `~/Library/Application Support/Claude/claude_desktop_config.json` |
| **Windows** | `%APPDATA%\Claude\claude_desktop_config.json` |
| **Linux** | `~/.config/claude/claude_desktop_config.json` |

</details>

```json
{
  "mcpServers": {
    "miyabi": {
      "command": "npx",
      "args": ["-y", "miyabi-mcp-bundle"],
      "env": {
        "MIYABI_REPO_PATH": "/path/to/your/repo",
        "GITHUB_TOKEN": "ghp_your_token_here"
      }
    }
  }
}
```

<details>
<summary><b>🔧 Environment Variables</b></summary>

| Variable | Required | Default | Description |
|----------|:--------:|---------|-------------|
| `MIYABI_REPO_PATH` | - | `cwd()` | Git repository path |
| `MIYABI_LOG_DIR` | - | Same as repo | Log files directory |
| `MIYABI_WATCH_DIR` | - | Same as repo | File watch directory |
| `GITHUB_TOKEN` | For GitHub | - | GitHub Personal Access Token |
| `GITHUB_DEFAULT_OWNER` | - | - | Default repository owner |
| `GITHUB_DEFAULT_REPO` | - | - | Default repository name |

</details>

---

## 🚀 Quick Start

After configuration, try these commands in Claude Desktop:

```
📊 "Show me the system resources"
🔀 "What's my git status?"
📁 "List recently changed files"
🐛 "Search logs for errors"
🐙 "Show open GitHub issues"
```

---

## 🛠️ Complete Tool Reference

<div align="center">

### 82 Tools Across 9 Categories

</div>

<details open>
<summary><h3>🔀 Git Inspector <code>10 tools</code></h3></summary>

| Tool | Description |
|:-----|:------------|
| `git_status` | Get current git status (modified, staged, untracked) |
| `git_branch_list` | List all branches with remote tracking info |
| `git_current_branch` | Get current branch name |
| `git_log` | Get commit history |
| `git_worktree_list` | List all git worktrees |
| `git_diff` | Get diff of unstaged changes |
| `git_staged_diff` | Get diff of staged changes |
| `git_remote_list` | List all remotes |
| `git_branch_ahead_behind` | Check commits ahead/behind origin |
| `git_file_history` | Get commit history for a specific file |

</details>

<details>
<summary><h3>📺 Tmux Monitor <code>9 tools</code></h3></summary>

| Tool | Description |
|:-----|:------------|
| `tmux_list_sessions` | List all tmux sessions |
| `tmux_list_windows` | List windows in a session |
| `tmux_list_panes` | List panes in a window |
| `tmux_send_keys` | Send keys to a pane |
| `tmux_pane_capture` | Capture pane content |
| `tmux_pane_search` | Search pane content |
| `tmux_pane_tail` | Get last N lines from pane |
| `tmux_pane_is_busy` | Check if pane is busy |
| `tmux_pane_current_command` | Get current command in pane |

</details>

<details>
<summary><h3>📋 Log Aggregator <code>6 tools</code></h3></summary>

| Tool | Description |
|:-----|:------------|
| `log_sources` | List all log sources |
| `log_get_recent` | Get recent log entries |
| `log_search` | Search logs for a pattern |
| `log_get_errors` | Get error-level logs |
| `log_get_warnings` | Get warning-level logs |
| `log_tail` | Tail a specific log file |

</details>

<details>
<summary><h3>💻 Resource Monitor <code>8 tools</code></h3></summary>

| Tool | Description |
|:-----|:------------|
| `resource_cpu` | Get CPU usage |
| `resource_memory` | Get memory usage |
| `resource_disk` | Get disk usage |
| `resource_load` | Get system load average |
| `resource_overview` | Get comprehensive resource overview |
| `resource_processes` | Get process list sorted by resource |
| `resource_uptime` | Get system uptime |
| `resource_network_stats` | Get network statistics |

</details>

<details>
<summary><h3>🌐 Network Inspector <code>8 tools</code></h3></summary>

| Tool | Description |
|:-----|:------------|
| `network_interfaces` | List network interfaces |
| `network_connections` | List active connections |
| `network_listening_ports` | List listening ports |
| `network_stats` | Get network statistics |
| `network_gateway` | Get default gateway |
| `network_ping` | Ping a host |
| `network_bandwidth` | Get bandwidth usage |
| `network_overview` | Get network overview |

</details>

<details>
<summary><h3>⚙️ Process Inspector <code>8 tools</code></h3></summary>

| Tool | Description |
|:-----|:------------|
| `process_info` | Get process details by PID |
| `process_list` | List all processes |
| `process_search` | Search processes by name |
| `process_tree` | Get process tree |
| `process_file_descriptors` | Get file descriptors for process |
| `process_environment` | Get environment variables for process |
| `process_children` | Get child processes |
| `process_top` | Get top processes by CPU/memory |

</details>

<details>
<summary><h3>📁 File Watcher <code>6 tools</code></h3></summary>

| Tool | Description |
|:-----|:------------|
| `file_stats` | Get file/directory stats |
| `file_recent_changes` | Get recently changed files |
| `file_search` | Search files by glob pattern |
| `file_tree` | Get directory tree |
| `file_compare` | Compare two files |
| `file_changes_since` | Get files changed since timestamp |

</details>

<details>
<summary><h3>🤖 Claude Monitor <code>8 tools</code></h3></summary>

| Tool | Description |
|:-----|:------------|
| `claude_config` | Get Claude Desktop configuration |
| `claude_mcp_status` | Get MCP server status |
| `claude_session_info` | Get Claude session info |
| `claude_logs` | Get Claude logs |
| `claude_log_search` | Search Claude logs |
| `claude_log_files` | List Claude log files |
| `claude_background_shells` | Get background shell info |
| `claude_status` | Get comprehensive Claude status |

</details>

<details>
<summary><h3>🐙 GitHub Integration <code>12 tools</code></h3></summary>

| Tool | Description |
|:-----|:------------|
| `github_list_issues` | List GitHub issues |
| `github_get_issue` | Get issue details |
| `github_create_issue` | Create new issue |
| `github_update_issue` | Update issue |
| `github_add_comment` | Add comment to issue/PR |
| `github_list_prs` | List pull requests |
| `github_get_pr` | Get PR details |
| `github_create_pr` | Create pull request |
| `github_merge_pr` | Merge pull request |
| `github_list_labels` | List repository labels |
| `github_add_labels` | Add labels to issue/PR |
| `github_list_milestones` | List milestones |

</details>

---

## 🔌 Plugins

<div align="center">

### Included Claude Code Plugins (v2.0.0)

</div>

This package includes the complete Miyabi plugin ecosystem:

<details open>
<summary><h3>🤖 38 AI Agents</h3></summary>

| Agent | Description |
|:------|:------------|
| `coordinator-agent` | Multi-agent orchestration and task distribution |
| `codegen-agent` | AI-driven code generation (Rust, TypeScript, Python) |
| `pr-agent` | Pull request creation and management |
| `review-agent` | Code review automation |
| `issue-agent` | GitHub issue analysis and triage |
| `deployment-agent` | CI/CD and deployment automation |
| `analytics-agent` | Data analysis and visualization |
| `honoka-agent` | Udemy course creation specialist |
| `marketing-agent` | Marketing strategy and content |
| `crm-agent` | Customer relationship management |
| `jonathan-ive-design-agent` | UI/UX design with Apple design principles |
| `lp-gen-agent` | Landing page generation |
| `narration-agent` | Voice narration and script writing |
| ... and 25 more agents |

</details>

<details>
<summary><h3>🎯 22 Development Skills</h3></summary>

| Skill | Description |
|:------|:------------|
| `rust-development` | Rust build, test, clippy, fmt workflow |
| `git-workflow` | Conventional commits and PR workflow |
| `tdd-workflow` | Test-driven development patterns |
| `security-audit` | Security scanning and vulnerability checks |
| `performance-analysis` | Profiling and optimization |
| `debugging-troubleshooting` | Error diagnosis and resolution |
| `documentation-generation` | Auto-generate docs from code |
| `project-setup` | New project scaffolding |
| `dependency-management` | Package updates and auditing |
| `context-eng` | Context window optimization |
| `issue-analysis` | Issue triage and prioritization |
| `voicevox` | Japanese voice synthesis |
| `tmux-iterm-integration` | Terminal session management |
| `paper2agent` | Research paper to agent conversion |
| `business-strategy-planning` | Business analysis workflows |
| `sales-crm-management` | Sales pipeline automation |
| `market-research-analysis` | Competitive analysis |
| `content-marketing-strategy` | Content planning |
| `growth-analytics-dashboard` | Growth metrics tracking |
| `agent-execution` | Agent spawning and management |
| `claude-code-x` | Extended Claude Code workflows |

</details>

<details>
<summary><h3>📋 56 Slash Commands</h3></summary>

| Command | Description |
|:--------|:------------|
| `/deploy` | Execute deployment pipeline |
| `/pr-create` | Create pull request |
| `/issue-create` | Create GitHub issue |
| `/health-check` | System health verification |
| `/security-scan` | Run security audit |
| `/dashboard` | Show project dashboard |
| `/worktree-create` | Create git worktree |
| `/tmux-orchestra-start` | Start tmux orchestration |
| `/codex` | OpenAI Codex integration |
| `/voicevox` | Voice synthesis |
| `/generate-docs` | Generate documentation |
| `/test-escalation` | Run test escalation |
| ... and 44 more commands |

</details>

<details>
<summary><h3>🪝 24 Hooks</h3></summary>

| Hook | Description |
|:-----|:------------|
| `agent-complete.sh` | Post-agent execution |
| `agent-worktree-pre.sh` | Before worktree creation |
| `agent-worktree-post.sh` | After worktree creation |
| `auto-format.sh` | Auto-format on save |
| `validate-rust.sh` | Rust validation pre-commit |
| `validate-typescript.sh` | TypeScript validation |
| `git-ops-validator.sh` | Git operation validation |
| `codex-monitor.sh` | Codex process monitoring |
| `session-keepalive.sh` | Session persistence |
| `notification.sh` | Desktop notifications |
| ... and 14 more hooks |

</details>

### Plugin Installation

Plugins are included in `plugins-unpacked/` directory when installed via npm:

```bash
# Access plugins after npm install
ls node_modules/miyabi-mcp-bundle/plugins-unpacked/
```

---

## 🏗️ Architecture

```
┌────────────────────────────────────────────────────────────┐
│                    Claude Desktop                          │
└─────────────────────────┬──────────────────────────────────┘
                          │ MCP Protocol
                          ▼
┌────────────────────────────────────────────────────────────┐
│                 Miyabi MCP Bundle                          │
│  ┌──────────────────────────────────────────────────────┐  │
│  │                   Tool Router                        │  │
│  └──────────────────────────────────────────────────────┘  │
│      │        │        │        │        │        │        │
│      ▼        ▼        ▼        ▼        ▼        ▼        │
│  ┌──────┐┌──────┐┌──────┐┌──────┐┌──────┐┌──────┐        │
│  │ Git  ││ Tmux ││ Log  ││Resource││Network││GitHub│  ...  │
│  │ 10   ││  9   ││  6   ││   8   ││   8   ││  12  │        │
│  └──────┘└──────┘└──────┘└──────┘└──────┘└──────┘        │
└────────────────────────────────────────────────────────────┘
```

---

## 👨‍💻 Development

```bash
# Clone the repository
git clone https://github.com/ShunsukeHayashi/miyabi-mcp-bundle.git
cd miyabi-mcp-bundle

# Install dependencies
npm install

# Development mode (with hot reload)
npm run dev

# Build for production
npm run build

# Run linter
npm run lint

# Run tests
npm test
```

---

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

## 📄 License

MIT © [Shunsuke Hayashi](https://github.com/ShunsukeHayashi)

---

<div align="center">

# 🇯🇵 日本語

</div>

## ✨ Miyabiとは？

> **雅 (Miyabi)** - 洗練された優美さを意味する日本語

Claude Desktopを**強力な開発コマンドセンター**に変換する、単一のMCPサーバーです。

### 🎯 特徴

- **82 MCPツール** を9カテゴリに統合
- **38 AIエージェント** - コード生成、レビュー、デプロイ等
- **22 開発スキル** - Rust、Git、TDD、セキュリティ等
- **56 スラッシュコマンド** - デプロイ、PR作成、Issue管理等
- **24 フック** - 自動フォーマット、バリデーション等
- **設定不要** - すぐに使える
- **本番環境対応** - 実際の開発環境でテスト済み

## 📦 インストール

```bash
# npx（推奨）
npx miyabi-mcp-bundle

# グローバルインストール
npm install -g miyabi-mcp-bundle
```

## ⚙️ Claude Desktop 設定

```json
{
  "mcpServers": {
    "miyabi": {
      "command": "npx",
      "args": ["-y", "miyabi-mcp-bundle"],
      "env": {
        "MIYABI_REPO_PATH": "/path/to/your/repo",
        "GITHUB_TOKEN": "ghp_your_token_here"
      }
    }
  }
}
```

## 🚀 クイックスタート

設定後、Claude Desktopで以下を試してください：

```
📊 「システムリソースを表示して」
🔀 「gitの状態を確認して」
📁 「最近変更されたファイルを見せて」
🐛 「エラーログを検索して」
🐙 「GitHubのIssue一覧を表示して」
```

## 🛠️ ツールカテゴリ

| カテゴリ | ツール数 | 説明 |
|:---------|:--------:|:-----|
| 🔀 **Git Inspector** | 10 | Git状態、ブランチ、差分、履歴 |
| 📺 **Tmux Monitor** | 9 | セッション、ウィンドウ、ペイン管理 |
| 📋 **Log Aggregator** | 6 | ログ検索、エラー、警告 |
| 💻 **Resource Monitor** | 8 | CPU、メモリ、ディスク、システム情報 |
| 🌐 **Network Inspector** | 8 | インターフェース、接続、ポート |
| ⚙️ **Process Inspector** | 8 | プロセス一覧、ツリー、詳細 |
| 📁 **File Watcher** | 6 | ファイル変更、検索、比較 |
| 🤖 **Claude Monitor** | 8 | Claude Desktop設定、ログ、MCP状態 |
| 🐙 **GitHub Integration** | 12 | Issue、PR、ラベル、マイルストーン |

---

<div align="center">

### ⭐ Star this repo if you find it useful!

<br />

Made with ❤️ by [Shunsuke Hayashi](https://github.com/ShunsukeHayashi)

<br />

[![GitHub](https://img.shields.io/badge/GitHub-ShunsukeHayashi-181717?style=for-the-badge&logo=github)](https://github.com/ShunsukeHayashi)
[![Twitter](https://img.shields.io/badge/Twitter-@shuhayas-1DA1F2?style=for-the-badge&logo=twitter&logoColor=white)](https://twitter.com/shuhayas)

</div>
