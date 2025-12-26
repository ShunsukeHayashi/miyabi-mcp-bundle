---
name: github-integration
description: GitHub API integration for issues, pull requests, workflows, and repository management. Use when working with GitHub issues, PRs, releases, or CI/CD workflows.
allowed-tools: Bash, Read, Write, WebFetch
mcp_tools:
  - "github_list_issues"
  - "github_get_issue"
  - "github_create_issue"
  - "github_update_issue"
  - "github_add_comment"
  - "github_list_pulls"
  - "github_get_pull"
  - "github_create_pull"
  - "github_merge_pull"
  - "github_list_labels"
  - "github_add_labels"
  - "github_list_milestones"
  - "github_list_workflows"
  - "github_list_workflow_runs"
  - "github_get_repo"
  - "github_list_releases"
  - "github_list_branches"
  - "github_compare_commits"
  - "github_list_pr_reviews"
  - "github_create_pr_review"
  - "github_search_code"
---

# GitHub Integration Skill

**Version**: 1.0.0
**Purpose**: GitHub API operations for repository collaboration

---

## Triggers

| Trigger | Examples |
|---------|----------|
| Issues | "list issues", "create issue", "Issue一覧" |
| PRs | "list PRs", "create PR", "PR作成" |
| Workflows | "check CI", "workflow status", "CI確認" |
| Release | "list releases", "リリース一覧" |

---

## Prerequisites

```bash
# Required environment variable
export GITHUB_TOKEN="ghp_..."

# Optional defaults
export GITHUB_DEFAULT_OWNER="owner"
export GITHUB_DEFAULT_REPO="repo"
```

---

## Integrated MCP Tools

| Tool | Purpose |
|------|---------|
| `github_list_issues` | List repository issues |
| `github_get_issue` | Get issue details |
| `github_create_issue` | Create new issue |
| `github_update_issue` | Update existing issue |
| `github_add_comment` | Add comment to issue/PR |
| `github_list_pulls` | List pull requests |
| `github_get_pull` | Get PR details |
| `github_create_pull` | Create new PR |
| `github_merge_pull` | Merge a PR |
| `github_list_labels` | Repository labels |
| `github_add_labels` | Add labels to issue |
| `github_list_milestones` | Project milestones |
| `github_list_workflows` | GitHub Actions workflows |
| `github_list_workflow_runs` | Workflow run history |
| `github_get_repo` | Repository information |
| `github_list_releases` | Repository releases |
| `github_list_branches` | Repository branches |
| `github_compare_commits` | Compare two commits |
| `github_list_pr_reviews` | PR reviews |
| `github_create_pr_review` | Submit PR review |
| `github_search_code` | Search code in repo |

---

## Workflow: Issue Management

### Step 1: List Issues
```
Use github_list_issues with:
- state: "open" | "closed" | "all"
- per_page: 30 (max 100)
```

### Step 2: Create Issue
```
Use github_create_issue with:
- title: Clear, descriptive title
- body: Markdown description
- labels: ["bug", "enhancement"]
```

### Step 3: Update Issue
```
Use github_update_issue with:
- issue_number: Issue ID
- state: "open" | "closed"
- labels: Updated labels
```

---

## Workflow: Pull Request

### Step 1: Create PR
```
Use github_create_pull with:
- title: PR title
- body: Description with context
- head: Source branch
- base: Target branch (main)
```

### Step 2: Review PR
```
Use github_create_pr_review with:
- pull_number: PR ID
- event: "APPROVE" | "REQUEST_CHANGES" | "COMMENT"
- body: Review comments
```

### Step 3: Merge PR
```
Use github_merge_pull with:
- pull_number: PR ID
- merge_method: "merge" | "squash" | "rebase"
```

---

## Workflow: CI/CD Monitoring

### Step 1: List Workflows
```
Use github_list_workflows to see all CI configurations
```

### Step 2: Check Runs
```
Use github_list_workflow_runs with:
- workflow_id: Specific workflow
- status: "completed" | "in_progress" | "queued"
```

---

## Best Practices

✅ GOOD:
- Use descriptive issue/PR titles
- Include context in descriptions
- Label issues appropriately
- Review before merging

❌ BAD:
- Vague titles like "Fix bug"
- Empty PR descriptions
- Merging without review
- Ignoring CI failures

---

## Checklist

- [ ] GITHUB_TOKEN configured
- [ ] Owner/repo specified
- [ ] Issue/PR has clear title
- [ ] Labels applied
- [ ] CI checks passed
