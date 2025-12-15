# Miyabi MCP Bundle

<p align="center">
  <img src="https://img.shields.io/npm/v/miyabi-mcp-bundle?style=flat-square" alt="npm version">
  <img src="https://img.shields.io/npm/dm/miyabi-mcp-bundle?style=flat-square" alt="npm downloads">
  <img src="https://img.shields.io/github/license/ShunsukeHayashi/miyabi-mcp-bundle?style=flat-square" alt="license">
  <img src="https://img.shields.io/badge/MCP-Compatible-brightgreen?style=flat-square" alt="MCP Compatible">
</p>

<p align="center">
  <strong>🎯 All-in-One MCP Server for Claude Desktop & AI Agents</strong>
</p>

<p align="center">
  Complete monitoring and control toolkit with <strong>75+ tools</strong> across <strong>9 categories</strong>
</p>

---

[English](#english) | [日本語](#japanese)

---

<a name="english"></a>

## 🚀 Features

- **75+ Tools** across 9 categories in a single MCP server
- **Zero Configuration** - Works out of the box
- **Production Ready** - Battle-tested in real development environments
- **TypeScript** - Fully typed with excellent IDE support

### Tool Categories

| Category | Tools | Description |
|----------|-------|-------------|
| 🔀 **Git Inspector** | 10 | Git status, branches, diff, history |
| 📺 **Tmux Monitor** | 9 | Session, window, pane management |
| 📋 **Log Aggregator** | 6 | Log search, errors, warnings |
| 💻 **Resource Monitor** | 8 | CPU, memory, disk, system info |
| 🌐 **Network Inspector** | 8 | Interfaces, connections, ports |
| ⚙️ **Process Inspector** | 8 | Process list, tree, details |
| 📁 **File Watcher** | 6 | File changes, search, compare |
| 🤖 **Claude Monitor** | 8 | Claude Desktop config, logs, MCP status |
| 🐙 **GitHub Integration** | 12 | Issues, PRs, labels, milestones |

## 📦 Installation

### Option 1: npx (Recommended)

```bash
npx miyabi-mcp-bundle
```

### Option 2: Global Install

```bash
npm install -g miyabi-mcp-bundle
miyabi-mcp
```

### Option 3: Local Install

```bash
npm install miyabi-mcp-bundle
npx miyabi-mcp-bundle
```

## ⚙️ Claude Desktop Configuration

Add to your Claude Desktop config (`~/Library/Application Support/Claude/claude_desktop_config.json` on macOS):

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

### Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `MIYABI_REPO_PATH` | No | Git repository path (default: current directory) |
| `MIYABI_LOG_DIR` | No | Log files directory |
| `MIYABI_WATCH_DIR` | No | File watch directory |
| `GITHUB_TOKEN` | For GitHub tools | GitHub Personal Access Token |
| `GITHUB_DEFAULT_OWNER` | No | Default repository owner |
| `GITHUB_DEFAULT_REPO` | No | Default repository name |

## 🎯 Quick Start

After configuration, try these commands in Claude Desktop:

```
Check my git status
Show system resources
List recent file changes
Search logs for errors
List open GitHub issues
```

## 📖 Tool Reference

### P0 - Critical (Use Daily)

| Tool | Description |
|------|-------------|
| `git_status` | Get current git status |
| `log_get_errors` | Get error-level logs |
| `resource_overview` | Get system resource overview |
| `github_list_issues` | List GitHub issues |

### P1 - High Priority

| Tool | Description |
|------|-------------|
| `git_diff` | Get unstaged changes |
| `git_log` | Get commit history |
| `tmux_list_panes` | List tmux panes |
| `file_recent_changes` | Get recently changed files |
| `process_top` | Get top processes by CPU |

[See full tool reference →](./docs/TOOL_REFERENCE.md)

## 🔧 Development

```bash
# Clone
git clone https://github.com/ShunsukeHayashi/miyabi-mcp-bundle.git
cd miyabi-mcp-bundle

# Install
npm install

# Development mode
npm run dev

# Build
npm run build

# Test
npm test
```

## 📄 License

MIT © [Shunsuke Hayashi](https://github.com/ShunsukeHayashi)

---

<a name="japanese"></a>

## 🚀 特徴（日本語）

- **75以上のツール** を9カテゴリに統合した単一MCPサーバー
- **設定不要** - すぐに使える
- **本番環境対応** - 実際の開発環境でテスト済み
- **TypeScript** - 完全な型定義とIDEサポート

### ツールカテゴリ

| カテゴリ | ツール数 | 説明 |
|----------|----------|------|
| 🔀 **Git Inspector** | 10 | Git状態、ブランチ、差分、履歴 |
| 📺 **Tmux Monitor** | 9 | セッション、ウィンドウ、ペイン管理 |
| 📋 **Log Aggregator** | 6 | ログ検索、エラー、警告 |
| 💻 **Resource Monitor** | 8 | CPU、メモリ、ディスク、システム情報 |
| 🌐 **Network Inspector** | 8 | インターフェース、接続、ポート |
| ⚙️ **Process Inspector** | 8 | プロセス一覧、ツリー、詳細 |
| 📁 **File Watcher** | 6 | ファイル変更、検索、比較 |
| 🤖 **Claude Monitor** | 8 | Claude Desktop設定、ログ、MCP状態 |
| 🐙 **GitHub Integration** | 12 | Issue、PR、ラベル、マイルストーン |

## 📦 インストール

### オプション1: npx（推奨）

```bash
npx miyabi-mcp-bundle
```

### オプション2: グローバルインストール

```bash
npm install -g miyabi-mcp-bundle
miyabi-mcp
```

## ⚙️ Claude Desktop 設定

Claude Desktopの設定ファイルに追加:

**macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
**Windows**: `%APPDATA%\Claude\claude_desktop_config.json`

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

## 🎯 クイックスタート

設定後、Claude Desktopで以下を試してください：

```
gitの状態を確認して
システムリソースを表示して
最近変更されたファイルを見せて
エラーログを検索して
GitHubのIssue一覧を表示して
```

## 🤝 コントリビューション

Issue、Pull Requestを歓迎します！

## 📄 ライセンス

MIT © [Shunsuke Hayashi](https://github.com/ShunsukeHayashi)

---

<p align="center">
  Made with ❤️ by <a href="https://github.com/ShunsukeHayashi">Shunsuke Hayashi</a>
</p>
