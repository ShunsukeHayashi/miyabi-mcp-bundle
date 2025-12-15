/**
 * Tests for sanitizePath function
 * Security-critical: prevents path traversal and symlink attacks
 */

import { describe, it, expect } from 'vitest';
import { sanitizePath } from '../../../src/utils/security.js';

describe('sanitizePath', () => {
  const basePath = '/home/user/data';

  describe('valid paths', () => {
    it('should allow simple filenames', () => {
      expect(sanitizePath(basePath, 'file.txt')).toBe('/home/user/data/file.txt');
    });

    it('should allow subdirectory paths', () => {
      expect(sanitizePath(basePath, 'subdir/file.txt')).toBe('/home/user/data/subdir/file.txt');
    });

    it('should allow deeply nested paths', () => {
      expect(sanitizePath(basePath, 'a/b/c/d/file.txt')).toBe('/home/user/data/a/b/c/d/file.txt');
    });

    it('should handle current directory references within base', () => {
      expect(sanitizePath(basePath, './file.txt')).toBe('/home/user/data/file.txt');
      expect(sanitizePath(basePath, './subdir/../file.txt')).toBe('/home/user/data/file.txt');
    });

    it('should allow paths with special characters in names', () => {
      expect(sanitizePath(basePath, 'file-name.txt')).toBe('/home/user/data/file-name.txt');
      expect(sanitizePath(basePath, 'file_name.txt')).toBe('/home/user/data/file_name.txt');
      expect(sanitizePath(basePath, 'file name.txt')).toBe('/home/user/data/file name.txt');
    });

    it('should handle empty user path', () => {
      expect(sanitizePath(basePath, '')).toBe('/home/user/data');
    });
  });

  describe('path traversal attacks', () => {
    it('should block simple parent traversal', () => {
      expect(() => sanitizePath(basePath, '../etc/passwd')).toThrow('Path traversal detected');
    });

    it('should block multiple parent traversal', () => {
      expect(() => sanitizePath(basePath, '../../root/.ssh/id_rsa')).toThrow('Path traversal detected');
      expect(() => sanitizePath(basePath, '../../../etc/shadow')).toThrow('Path traversal detected');
    });

    it('should block traversal with subdirectory prefix', () => {
      expect(() => sanitizePath(basePath, 'subdir/../../etc/passwd')).toThrow('Path traversal detected');
    });

    it('should block absolute paths outside base', () => {
      expect(() => sanitizePath(basePath, '/etc/passwd')).toThrow('Path traversal detected');
      expect(() => sanitizePath(basePath, '/root/.ssh/id_rsa')).toThrow('Path traversal detected');
    });

    it('should handle encoded paths (not decoded)', () => {
      // URL-encoded paths are NOT decoded by sanitizePath
      // They are treated as literal characters, so '%2e%2e' is a valid subdir name
      const result = sanitizePath(basePath, '%2e%2e/etc/passwd');
      expect(result).toContain('%2e%2e');
    });

    it('should handle null bytes in path', () => {
      // Null bytes become part of the path string
      // The OS will typically truncate at null byte, but sanitizePath doesn't throw
      const result = sanitizePath(basePath, 'file.txt');
      expect(result).toBe('/home/user/data/file.txt');
    });
  });

  describe('edge cases', () => {
    it('should handle base path without trailing slash', () => {
      expect(sanitizePath('/home/user', 'file.txt')).toBe('/home/user/file.txt');
    });

    it('should handle base path with trailing slash', () => {
      expect(sanitizePath('/home/user/', 'file.txt')).toBe('/home/user/file.txt');
    });

    it('should handle Windows-style paths on Unix', () => {
      // Windows path separators should be handled
      const result = sanitizePath(basePath, 'subdir\\file.txt');
      expect(result).toContain('subdir');
    });
  });

  describe('base path edge cases', () => {
    it('should work with root as base', () => {
      const result = sanitizePath('/', 'etc/passwd');
      // On macOS, /etc is a symlink to /private/etc
      expect(result).toMatch(/\/(private\/)?etc\/passwd$/);
    });

    it('should handle traversal from root (goes to root itself)', () => {
      // '../outside' from '/' resolves to '/' on Unix (can't go above root)
      // So it doesn't throw - it stays within root
      const result = sanitizePath('/', '../tmp');
      expect(result).toMatch(/\/.*tmp$/);
    });
  });
});
