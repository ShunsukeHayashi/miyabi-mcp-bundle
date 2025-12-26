---
name: git-operations
description: Git version control operations including status, branches, commits, diffs, and worktree management. Use when working with git repositories, reviewing changes, or managing branches.
allowed-tools: Bash, Read, Write
mcp_tools:
  - "git_status"
  - "git_branch_list"
  - "git_current_branch"
  - "git_log"
  - "git_diff"
  - "git_staged_diff"
  - "git_remote_list"
  - "git_worktree_list"
  - "git_stash_list"
  - "git_tag_list"
  - "git_blame"
  - "git_show"
  - "git_branch_ahead_behind"
  - "git_commit_create"
  - "git_branch_create"
  - "git_checkout"
  - "git_merge"
  - "git_stash_save"
  - "git_stash_pop"
---

# Git Operations Skill

**Version**: 1.0.0
**Purpose**: Git version control operations for repository management

---

## Triggers

| Trigger | Examples |
|---------|----------|
| Status | "git status", "check changes", "変更確認" |
| Branch | "list branches", "create branch", "ブランチ一覧" |
| Commit | "commit changes", "view commits", "コミット" |
| Diff | "show diff", "review changes", "差分確認" |

---

## Integrated MCP Tools

This skill wraps the following MCP tools from miyabi-mcp-bundle:

| Tool | Purpose |
|------|---------|
| `git_status` | Repository status with staged/unstaged files |
| `git_branch_list` | List all branches with details |
| `git_current_branch` | Get current branch name |
| `git_log` | Commit history (configurable limit) |
| `git_diff` | Unstaged changes diff |
| `git_staged_diff` | Staged changes diff |
| `git_remote_list` | Remote repositories |
| `git_worktree_list` | Git worktrees |
| `git_stash_list` | Stashed changes |
| `git_tag_list` | Repository tags |
| `git_blame` | Line-by-line authorship |
| `git_show` | Commit details |
| `git_branch_ahead_behind` | Branch sync status |
| `git_commit_create` | Create new commit |
| `git_branch_create` | Create new branch |
| `git_checkout` | Switch branches |
| `git_merge` | Merge branches |
| `git_stash_save` | Save changes to stash |
| `git_stash_pop` | Restore stashed changes |

---

## Workflow

### Phase 1: Repository Assessment

#### Step 1.1: Check Status
```
Use git_status to see:
- Current branch
- Staged files
- Unstaged modifications
- Untracked files
```

#### Step 1.2: Review Recent History
```
Use git_log with limit=10 to see recent commits
```

### Phase 2: Change Review

#### Step 2.1: Unstaged Changes
```
Use git_diff to see uncommitted changes
```

#### Step 2.2: Staged Changes
```
Use git_staged_diff to review what will be committed
```

### Phase 3: Commit Workflow

#### Step 3.1: Stage Files
```bash
git add <files>
```

#### Step 3.2: Create Commit
```
Use git_commit_create with:
- message: Conventional commit format
- author: Optional override
```

---

## Best Practices

✅ GOOD:
- Review diff before committing
- Use conventional commit messages
- Keep commits atomic and focused

❌ BAD:
- Commit without reviewing changes
- Large commits with mixed concerns
- Vague commit messages

---

## Checklist

- [ ] Repository status checked
- [ ] Changes reviewed (diff)
- [ ] Commit message follows convention
- [ ] Tests pass before commit
