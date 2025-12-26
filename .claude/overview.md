---
version: "1.0"
last_updated: "2025-12-26"
---

# Miyabi MCP Bundle - Agent Skills

**Version**: 3.7.0
**Total Tools**: 172
**Skills**: 9

---

## Available Skills

| Skill | Description | Triggers | Tools |
|-------|-------------|----------|-------|
| `git-operations` | Git version control operations | "git status", "branches", "commit" | 19 |
| `github-integration` | GitHub API (issues, PRs, workflows) | "issues", "PR", "CI check" | 21 |
| `docker-management` | Docker containers and compose | "docker ps", "logs", "compose" | 14 |
| `system-monitoring` | CPU, memory, disk, network stats | "system status", "health check" | 10 |
| `network-diagnostics` | Ping, DNS, ports, HTTP tests | "ping", "DNS lookup", "port check" | 15 |
| `kubernetes-operations` | Pods, services, deployments | "pods", "k8s logs", "debug pod" | 6 |
| `log-analysis` | Log reading, search, filtering | "read logs", "find error" | 7 |
| `process-management` | Processes and tmux sessions | "kill process", "tmux" | 24 |
| `sequential-thinking` | Structured reasoning tools | "analyze problem", "think through" | 3 |

---

## Tool Categories (Quick Reference)

| Category | Prefix | Count | Example |
|----------|--------|-------|---------|
| Git | `git_` | 19 | `git_status`, `git_log` |
| GitHub | `github_` | 21 | `github_list_issues` |
| Docker | `docker_` | 10 | `docker_ps`, `docker_logs` |
| Compose | `compose_` | 4 | `compose_up`, `compose_down` |
| System | `resource_` | 10 | `resource_cpu`, `resource_memory` |
| Network | `network_` | 15 | `network_ping`, `network_dns_lookup` |
| Process | `process_` | 14 | `process_list`, `process_kill` |
| Tmux | `tmux_` | 10 | `tmux_list_sessions` |
| Kubernetes | `k8s_` | 6 | `k8s_pods`, `k8s_pod_logs` |
| Logs | `log_` | 7 | `log_read`, `log_search` |
| Database | `db_` | 6 | `db_query`, `db_tables` |
| File | `file_` | 10 | `file_read`, `file_write` |
| Thinking | `think_` | 3 | `think_step`, `think_summarize` |
| Generator | `gen_` | 4 | `gen_uuid`, `gen_password` |
| Calculator | `calc_` | 3 | `calc_eval`, `calc_statistics` |

---

## Loading Rules

### Progressive Disclosure

```
Layer 1: This overview only (~500 tokens)    ← Always loaded
    ↓
Layer 2: Skill SKILL.md (~1,000 tokens)      ← On trigger
    ↓
Layer 3: Full tool definitions               ← On execution
```

### When to Load Skills

1. **User mentions trigger keywords** → Load corresponding skill
2. **User asks about capability** → Show relevant skill from overview
3. **Complex task matching skill** → Load and follow skill workflow

---

## MCP Resources

| Resource | URI | Description |
|----------|-----|-------------|
| Git Status | `miyabi://git/status` | Repository status |
| Git Branches | `miyabi://git/branches` | Branch list |
| System Info | `miyabi://system/info` | CPU, memory, disk |
| Docker Containers | `miyabi://docker/containers` | Container list |
| GitHub Issues | `miyabi://github/issues` | Open issues |
| Tool Catalog | `miyabi://catalog/tools` | All tools by category |

---

## MCP Prompts

| Prompt | Purpose | Arguments |
|--------|---------|-----------|
| `git-commit` | Create conventional commit | type, scope, description |
| `git-review` | Review changes | focus |
| `docker-debug` | Debug container | container, issue |
| `github-pr-review` | Review PR | pr_number, focus |
| `system-health-check` | Health check | focus |
| `network-diagnose` | Network troubleshooting | target |
| `k8s-debug-pod` | Debug Kubernetes pod | pod_name, namespace |
| `log-analyze` | Analyze logs | source, pattern |
| `analyze-problem` | Sequential thinking | problem, context |

---

## Quick Start

### Check System Health
```
Trigger: "system health check"
Skill: system-monitoring
```

### Debug Container
```
Trigger: "debug container myapp"
Skill: docker-management
```

### Review Git Changes
```
Trigger: "review my changes"
Skill: git-operations
```

### Create GitHub Issue
```
Trigger: "create issue for bug"
Skill: github-integration
```

---

## Related Files

- `.claude/skills/*/SKILL.md` - Individual skill definitions
- `CLAUDE.md` - Project configuration
- `src/index.ts` - MCP server implementation
