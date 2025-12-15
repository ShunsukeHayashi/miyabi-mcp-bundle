# Security Guide

This document describes the security measures implemented in Miyabi MCP Bundle.

## Overview

Miyabi MCP Bundle implements enterprise-grade security measures to protect against common attack vectors including:

- Command injection attacks
- Path traversal attacks
- Symlink attacks
- ReDoS (Regular Expression Denial of Service)
- Input validation bypass

## Security Functions

### sanitizeShellArg()

Removes dangerous shell metacharacters from user input before passing to shell commands.

```typescript
import { sanitizeShellArg } from './utils/security';

const userInput = 'file.txt; rm -rf /';
const safe = sanitizeShellArg(userInput);
// Result: 'file.txt rm -rf '
```

**Characters removed:**
- `;` - Command separator
- `|` - Pipe
- `&` - Background/AND
- `$` - Variable expansion
- `` ` `` - Command substitution
- `(` `)` - Subshell
- `{` `}` - Brace expansion
- `<` `>` - Redirection
- `!` - History expansion
- `\`` - Escape sequences
- `'` `"` - Quotes (partial)

### sanitizePath()

Prevents path traversal and symlink attacks by validating that resolved paths stay within allowed directories.

```typescript
import { sanitizePath } from './utils/security';

// Valid - stays within base path
sanitizePath('/home/user', 'documents/file.txt');
// Returns: '/home/user/documents/file.txt'

// Invalid - path traversal attempt
sanitizePath('/home/user', '../etc/passwd');
// Throws: Error('Path traversal detected')

// Invalid - symlink points outside base
sanitizePath('/home/user', 'link-to-root');
// Throws: Error('Symlink traversal detected')
```

**Protection mechanisms:**
1. Path normalization with `resolve()`
2. Prefix validation against base path
3. Symlink resolution with `realpathSync()`
4. Real path validation against base path

### isValidHostname()

Validates hostname format according to RFC 1123 rules.

```typescript
import { isValidHostname } from './utils/security';

isValidHostname('example.com');    // true
isValidHostname('192.168.1.1');    // true
isValidHostname('localhost');       // true
isValidHostname('example..com');   // false
isValidHostname('-invalid.com');   // false
```

**Validation rules:**
- Maximum 253 characters total
- Labels separated by `.`
- Each label: 1-63 characters
- Valid characters: a-z, 0-9, hyphen
- Labels cannot start or end with hyphen
- IP addresses validated separately

### isValidPid()

Validates process IDs to prevent injection attacks.

```typescript
import { isValidPid } from './utils/security';

isValidPid(1234);    // true
isValidPid(0);       // false (reserved)
isValidPid(-1);      // false (negative)
isValidPid(5000000); // false (exceeds Linux max)
```

**Validation rules:**
- Must be positive integer
- Minimum: 1
- Maximum: 4194304 (Linux default)
- No floating point values

### validateInputLength()

Enforces maximum length limits on user input.

```typescript
import { validateInputLength } from './utils/security';

const error = validateInputLength(userQuery, 1000, 'Query');
if (error) {
  return { error };
}
```

## Input Size Limits

| Input Type | Maximum | Constant |
|------------|---------|----------|
| Query strings | 1,000 chars | `MAX_QUERY_LENGTH` |
| File paths | 4,096 chars | `MAX_PATH_LENGTH` |
| Hostnames | 253 chars | `MAX_HOSTNAME_LENGTH` |
| Process IDs | 4,194,304 | `LINUX_MAX_PID` |

## ReDoS Protection

All grep operations use the `-F` flag for fixed string matching, preventing regex-based denial of service attacks.

```bash
# Safe: Fixed string matching
grep -riF "search term" ./logs

# Vulnerable (NOT used): Regex matching
grep -ri "search.*term" ./logs
```

## Environment Variables

Never store secrets directly in code. Use environment variables:

```bash
# GitHub token for API access
export GITHUB_TOKEN="ghp_xxxxx"

# Database credentials (if using DB tools)
export MIYABI_DB_PASSWORD="secure_password"
```

## Best Practices

### 1. Input Validation

Always validate user input before processing:

```typescript
// Good: Validate before use
const query = args.query as string;
const lengthError = validateInputLength(query, MAX_QUERY_LENGTH, 'Query');
if (lengthError) return { error: lengthError };
const safeQuery = sanitizeShellArg(query);

// Bad: Direct use without validation
const query = args.query as string;
exec(`grep "${query}" ./logs`);
```

### 2. Path Safety

Always use sanitizePath() for file operations:

```typescript
// Good: Sanitized path
const safePath = sanitizePath(WATCH_DIR, userPath);
const content = await readFile(safePath);

// Bad: Direct path concatenation
const unsafePath = join(WATCH_DIR, userPath);
const content = await readFile(unsafePath);
```

### 3. Command Execution

Use execAsync with sanitized arguments:

```typescript
// Good: Sanitized command
const safeArg = sanitizeShellArg(userInput);
const { stdout } = await execAsync(`command "${safeArg}"`);

// Bad: Direct interpolation
const { stdout } = await execAsync(`command "${userInput}"`);
```

### 4. Error Handling

Never expose internal error details to users:

```typescript
// Good: Generic error message
return { error: 'Operation failed' };

// Bad: Exposing stack trace
return { error: error.stack };
```

## Security Testing

Run security-focused tests:

```bash
npm test -- tests/unit/security/
```

Test files:
- `sanitizeShellArg.test.ts` - Command injection prevention
- `sanitizePath.test.ts` - Path traversal prevention
- `isValidHostname.test.ts` - Hostname validation
- `isValidPid.test.ts` - PID validation

## Reporting Security Issues

If you discover a security vulnerability, please report it privately:

1. **DO NOT** create a public GitHub issue
2. Email: security@miyabi.dev
3. Include detailed reproduction steps
4. Allow 90 days for fix before public disclosure

## Changelog

### v3.0.0
- Added `sanitizeShellArg()` function
- Added `sanitizePath()` with symlink protection
- Added `isValidHostname()` validation
- Added `isValidPid()` validation
- Added input length validation
- Applied security measures across all handlers

### v2.1.0
- Initial security functions
- Basic input sanitization
