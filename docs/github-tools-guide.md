# GitHub Tools Guide - Miyabi MCP Bundle

Complete guide to using the 21 GitHub tools in miyabi-mcp-bundle.

## 🔧 Setup

Environment variables required:
```bash
GITHUB_TOKEN=your_github_token
GITHUB_DEFAULT_OWNER=ShunsukeHayashi  # Optional default
GITHUB_DEFAULT_REPO=Miyabi            # Optional default
```

---

## 📋 Issues Management

### 1. List Issues
```javascript
// List open issues
github_list_issues({ "state": "open" })

// List closed issues
github_list_issues({ "state": "closed" })

// Filter by labels
github_list_issues({ "state": "open", "labels": "bug,critical" })

// Limit results
github_list_issues({ "state": "open", "per_page": 10 })
```

### 2. Get Issue Details
```javascript
github_get_issue({ "issue_number": 42 })
```

### 3. Create Issue
```javascript
github_create_issue({
  "title": "Fix authentication bug",
  "body": "## Problem\nUsers can't login\n\n## Steps to Reproduce\n1. Go to login\n2. Enter credentials\n3. Error occurs",
  "labels": ["bug", "high-priority"]
})
```

### 4. Update Issue
```javascript
// Update title and body
github_update_issue({
  "issue_number": 42,
  "title": "Updated title",
  "body": "Updated description"
})

// Close an issue
github_update_issue({
  "issue_number": 42,
  "state": "closed"
})
```

---

## 🔀 Pull Requests

### 5. List Pull Requests
```javascript
// List open PRs
github_list_prs({ "state": "open" })

// List all PRs
github_list_prs({ "state": "all", "per_page": 20 })
```

### 6. Get PR Details
```javascript
github_get_pr({ "pull_number": 123 })
// Returns: diff stats, merge status, review state, files changed
```

### 7. Create Pull Request
```javascript
github_create_pr({
  "title": "Add dark mode feature",
  "head": "feature/dark-mode",
  "base": "main",
  "body": "## Changes\n- Added dark mode toggle\n- Updated CSS variables\n\n## Screenshots\n![screenshot](url)"
})
```

### 8. Merge Pull Request
```javascript
// Standard merge
github_merge_pr({
  "pull_number": 123,
  "merge_method": "merge"
})

// Squash and merge
github_merge_pr({
  "pull_number": 123,
  "merge_method": "squash"
})

// Rebase and merge
github_merge_pr({
  "pull_number": 123,
  "merge_method": "rebase"
})
```

### 9. List PR Reviews
```javascript
github_list_pr_reviews({ "pull_number": 123 })
// Returns: review comments, approval status, reviewers
```

### 10. Create PR Review
```javascript
// Approve
github_create_review({
  "pull_number": 123,
  "event": "APPROVE",
  "body": "LGTM! Great work."
})

// Request changes
github_create_review({
  "pull_number": 123,
  "event": "REQUEST_CHANGES",
  "body": "Please fix the following:\n- Update tests\n- Fix type errors"
})

// Comment only
github_create_review({
  "pull_number": 123,
  "event": "COMMENT",
  "body": "Nice implementation!"
})
```

### 11. Submit Review
```javascript
github_submit_review({
  "pull_number": 123,
  "review_id": 456789,
  "event": "APPROVE"
})
```

---

## 📦 Repository Management

### 12. Get Repository Info
```javascript
github_repo_info({})
// Returns: stars, forks, language, description, settings, default_branch
```

### 13. List Releases
```javascript
github_list_releases({ "per_page": 10 })
// Returns: release tags, assets, release notes, published date
```

### 14. List Branches
```javascript
github_list_branches({ "per_page": 20 })
// Returns: branch names, protection status, last commit info
```

### 15. Compare Commits
```javascript
// Compare branches
github_compare_commits({
  "base": "main",
  "head": "develop"
})

// Compare commits
github_compare_commits({
  "base": "abc123",
  "head": "def456"
})
// Returns: diff, files changed, commit list
```

---

## 🏷️ Labels & Milestones

### 16. List Labels
```javascript
github_list_labels({})
// Returns: all labels with colors and descriptions
```

### 17. Add Labels
```javascript
github_add_labels({
  "issue_number": 42,
  "labels": ["bug", "urgent", "needs-review"]
})
// Creates labels if they don't exist
```

### 18. List Milestones
```javascript
// List open milestones
github_list_milestones({ "state": "open" })

// List all milestones
github_list_milestones({ "state": "all" })
```

---

## ⚙️ CI/CD Workflows

### 19. List Workflows
```javascript
github_list_workflows({ "per_page": 10 })
// Returns: all GitHub Actions workflows
```

### 20. List Workflow Runs
```javascript
// All runs
github_list_workflow_runs({ "per_page": 20 })

// Specific workflow
github_list_workflow_runs({
  "workflow_id": "ci.yml",
  "per_page": 10
})

// Only failures
github_list_workflow_runs({
  "status": "completed",
  "per_page": 10
})
```

---

## 💬 Comments

### 21. Add Comment
```javascript
github_add_comment({
  "issue_number": 42,
  "body": "Thanks for reporting! We'll look into this.\n\n**Priority:** High"
})

// Works for both issues and PRs
github_add_comment({
  "issue_number": 123,  // PR number
  "body": "Looks good, but please update the tests."
})
```

---

## 🎯 Common Workflows

### Workflow 1: Issue Triage
```javascript
1. github_list_issues({ "state": "open" })
2. github_get_issue({ "issue_number": 42 })
3. github_add_labels({ "issue_number": 42, "labels": ["bug", "high-priority"] })
4. github_add_comment({ "issue_number": 42, "body": "Assigned to team" })
```

### Workflow 2: PR Review Process
```javascript
1. github_list_prs({ "state": "open" })
2. github_get_pr({ "pull_number": 123 })
3. github_list_pr_reviews({ "pull_number": 123 })
4. github_create_review({ "pull_number": 123, "event": "APPROVE", "body": "LGTM!" })
5. github_merge_pr({ "pull_number": 123, "merge_method": "squash" })
```

### Workflow 3: Release Management
```javascript
1. github_list_branches({})
2. github_compare_commits({ "base": "main", "head": "develop" })
3. github_create_pr({ "title": "Release v2.0", "head": "develop", "base": "main" })
4. github_list_workflow_runs({ "workflow_id": "release.yml" })
5. github_list_releases({})
```

### Workflow 4: CI/CD Monitoring
```javascript
1. github_list_workflows({})
2. github_list_workflow_runs({ "status": "completed" })
3. // Check for failures and investigate
4. github_create_issue({ "title": "CI failure on main", "body": "..." })
```

---

## 🔒 Security Notes

- All tools require `GITHUB_TOKEN` environment variable
- Token needs appropriate scopes: `repo`, `workflow` (for Actions)
- Default owner/repo can be set via env vars
- All tools support markdown formatting in text fields

---

## 📚 Additional Resources

- GitHub API Docs: https://docs.github.com/rest
- MCP Protocol: https://modelcontextprotocol.io
- Miyabi MCP Bundle: https://github.com/ShunsukeHayashi/miyabi-mcp-bundle
