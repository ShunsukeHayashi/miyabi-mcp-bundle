# Troubleshooting Guide

Common issues and solutions for Miyabi MCP Bundle.

## Installation Issues

### "npx miyabi-mcp init" fails

**Symptoms:**
```
Error: ENOENT: no such file or directory
```

**Solutions:**
1. Ensure Node.js 18+ is installed:
   ```bash
   node --version  # Should be v18.0.0 or higher
   ```

2. Clear npm cache:
   ```bash
   npm cache clean --force
   npx clear-npx-cache
   ```

3. Install directly:
   ```bash
   npm install -g miyabi-mcp-bundle
   miyabi-mcp init
   ```

### Permission denied on macOS

**Symptoms:**
```
Error: EACCES: permission denied
```

**Solutions:**
1. Fix npm permissions:
   ```bash
   sudo chown -R $(whoami) ~/.npm
   ```

2. Use a node version manager (recommended):
   ```bash
   brew install nvm
   nvm install 20
   nvm use 20
   ```

## Connection Issues

### Claude Desktop doesn't see the server

**Symptoms:**
- Tools don't appear in Claude Desktop
- "No MCP servers connected" message

**Solutions:**

1. Verify config location:
   - macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`
   - Windows: `%APPDATA%\Claude\claude_desktop_config.json`
   - Linux: `~/.config/claude/claude_desktop_config.json`

2. Check config format:
   ```json
   {
     "mcpServers": {
       "miyabi": {
         "command": "npx",
         "args": ["-y", "miyabi-mcp-bundle"]
       }
     }
   }
   ```

3. Restart Claude Desktop completely (Quit and reopen)

4. Run diagnostics:
   ```bash
   npx miyabi-mcp doctor
   ```

### Server starts but tools fail

**Symptoms:**
- Server shows "Connected" but tools return errors
- "Tool not found" errors

**Solutions:**

1. Check server output:
   ```bash
   npx miyabi-mcp-server
   ```
   Look for startup errors.

2. Verify dependencies:
   ```bash
   npm ls
   ```

3. Check for port conflicts:
   ```bash
   lsof -i :3000  # or the port your server uses
   ```

## Tool-Specific Issues

### Git Tools

#### "Not a git repository"

**Symptoms:**
```
Error: Not a git repository
```

**Solutions:**
1. Set repository path:
   ```bash
   export MIYABI_REPO_PATH="/path/to/your/repo"
   ```

2. Or configure in Claude Desktop:
   ```json
   {
     "mcpServers": {
       "miyabi": {
         "command": "npx",
         "args": ["-y", "miyabi-mcp-bundle"],
         "env": {
           "MIYABI_REPO_PATH": "/path/to/repo"
         }
       }
     }
   }
   ```

#### "Git command not found"

**Solutions:**
1. Install Git:
   - macOS: `brew install git`
   - Ubuntu: `sudo apt install git`
   - Windows: Download from git-scm.com

2. Verify installation:
   ```bash
   git --version
   ```

### GitHub Tools

#### "Bad credentials" or 401 errors

**Symptoms:**
```
Error: Bad credentials
Error: 401 Unauthorized
```

**Solutions:**
1. Create a GitHub Personal Access Token:
   - Go to GitHub Settings > Developer Settings > Personal Access Tokens
   - Generate new token with required scopes:
     - `repo` (for private repos)
     - `read:org` (for organization repos)

2. Set the token:
   ```bash
   export GITHUB_TOKEN="ghp_your_token_here"
   ```

3. Or add to Claude Desktop config:
   ```json
   {
     "env": {
       "GITHUB_TOKEN": "ghp_your_token_here"
     }
   }
   ```

#### "Repository not found"

**Solutions:**
1. Check repository name spelling
2. Ensure token has access to the repository
3. For private repos, ensure `repo` scope is enabled

### Tmux Tools

#### "tmux: command not found"

**Solutions:**
1. Install tmux:
   - macOS: `brew install tmux`
   - Ubuntu: `sudo apt install tmux`

2. Verify installation:
   ```bash
   tmux -V
   ```

#### "no server running"

**Symptoms:**
```
Error: no server running on /tmp/tmux-xxx/default
```

**Solutions:**
1. Start a tmux session first:
   ```bash
   tmux new -s main
   ```

2. Tmux tools require an active tmux server

### Network Tools

#### "ping: permission denied"

**Symptoms:**
On some Linux systems, ping requires special permissions.

**Solutions:**
1. Use sudo (not recommended for MCP):
   ```bash
   sudo chmod u+s /bin/ping
   ```

2. Or use alternative tools:
   - `network_port_check` for connectivity testing

#### DNS lookup fails

**Solutions:**
1. Check network connectivity
2. Verify DNS server:
   ```bash
   cat /etc/resolv.conf
   ```
3. Try alternative DNS:
   ```bash
   nslookup example.com 8.8.8.8
   ```

### Process Tools

#### "Operation not permitted"

**Symptoms:**
```
Error: EPERM: operation not permitted
```

**Solutions:**
1. Some process operations require elevated privileges
2. Run with appropriate permissions
3. Consider using user-owned processes only

### File Tools

#### "Path traversal detected"

**Symptoms:**
```
Error: Path traversal detected
```

**Causes:**
- Attempting to access files outside the configured watch directory
- Using `..` in paths

**Solutions:**
1. Set the watch directory:
   ```bash
   export MIYABI_WATCH_DIR="/path/to/allowed/directory"
   ```

2. Use absolute paths within the allowed directory

#### "File too large"

**Symptoms:**
```
Error: File exceeds maximum size (100KB)
```

**Solutions:**
1. The `file_read` tool has a 100KB limit for safety
2. For larger files, use external tools or pagination
3. Use `file_stats` to check file size first

### Database Tools

#### "sqlite3: command not found"

**Solutions:**
1. Install SQLite:
   - macOS: `brew install sqlite`
   - Ubuntu: `sudo apt install sqlite3`

2. For PostgreSQL:
   - macOS: `brew install postgresql`
   - Ubuntu: `sudo apt install postgresql-client`

3. For MySQL:
   - macOS: `brew install mysql-client`
   - Ubuntu: `sudo apt install mysql-client`

#### "Connection refused"

**Solutions:**
1. Verify database server is running
2. Check connection string format:
   ```
   postgresql://user:pass@localhost:5432/dbname
   mysql://user:pass@localhost:3306/dbname
   sqlite:///path/to/database.db
   ```
3. Check firewall settings

## Performance Issues

### Slow response times

**Solutions:**
1. Enable caching (built-in):
   ```typescript
   // Caching is automatic for:
   // - CPU stats (2s TTL)
   // - Memory stats (2s TTL)
   // - Disk stats (10s TTL)
   ```

2. Reduce data volume:
   - Use `limit` parameters
   - Filter by time ranges

3. Check system resources:
   ```bash
   npx miyabi-mcp-server
   # Then use resource_overview tool
   ```

### High memory usage

**Solutions:**
1. Check for memory leaks:
   ```bash
   node --inspect npx miyabi-mcp-server
   ```

2. Restart the server periodically

3. Reduce concurrent operations

## Debugging

### Enable verbose logging

```bash
DEBUG=miyabi:* npx miyabi-mcp-server
```

### Check server health

Use the `health_check` tool to verify all systems:
```
health_check
```

This returns:
- Git status
- GitHub connectivity
- System resource status
- Tool availability

### View server logs

Check Claude logs for MCP communication:
- macOS: `~/Library/Logs/Claude/`
- Windows: `%LOCALAPPDATA%\Claude\logs\`

## Getting Help

1. **Documentation**: Check the full README
2. **Issues**: https://github.com/ShunsukeHayashi/miyabi-mcp-bundle/issues
3. **Diagnostics**: Run `npx miyabi-mcp doctor`

When reporting issues, include:
- Node.js version (`node --version`)
- OS and version
- Error messages (full stack trace)
- Steps to reproduce
- Output of `miyabi-mcp doctor`
