/**
 * Tests for isValidPid function
 * Security-critical: validates process IDs for process operations
 */

import { describe, it, expect } from 'vitest';
import { isValidPid } from '../../../src/utils/security.js';

describe('isValidPid', () => {
  describe('valid PIDs', () => {
    it('should accept positive integers', () => {
      expect(isValidPid(1)).toBe(true);
      expect(isValidPid(100)).toBe(true);
      expect(isValidPid(1000)).toBe(true);
      expect(isValidPid(12345)).toBe(true);
    });

    it('should accept PID 1 (init/systemd)', () => {
      expect(isValidPid(1)).toBe(true);
    });

    it('should accept common PID ranges', () => {
      expect(isValidPid(32768)).toBe(true);  // Common max on 32-bit
      expect(isValidPid(65535)).toBe(true);
      expect(isValidPid(100000)).toBe(true);
    });

    it('should accept PIDs up to Linux max (4194304)', () => {
      expect(isValidPid(4194304)).toBe(true);
      expect(isValidPid(4000000)).toBe(true);
    });
  });

  describe('invalid PIDs', () => {
    it('should reject zero', () => {
      expect(isValidPid(0)).toBe(false);
    });

    it('should reject negative numbers', () => {
      expect(isValidPid(-1)).toBe(false);
      expect(isValidPid(-100)).toBe(false);
      expect(isValidPid(-32768)).toBe(false);
    });

    it('should reject PIDs exceeding Linux max', () => {
      expect(isValidPid(4194305)).toBe(false);
      expect(isValidPid(5000000)).toBe(false);
      expect(isValidPid(10000000)).toBe(false);
    });

    it('should reject non-integers (floats)', () => {
      expect(isValidPid(1.5)).toBe(false);
      expect(isValidPid(100.1)).toBe(false);
      expect(isValidPid(3.14159)).toBe(false);
    });

    it('should reject NaN', () => {
      expect(isValidPid(NaN)).toBe(false);
    });

    it('should reject Infinity', () => {
      expect(isValidPid(Infinity)).toBe(false);
      expect(isValidPid(-Infinity)).toBe(false);
    });
  });

  describe('type coercion', () => {
    it('should reject strings', () => {
      expect(isValidPid('1' as unknown as number)).toBe(false);
      expect(isValidPid('100' as unknown as number)).toBe(false);
    });

    it('should reject null/undefined', () => {
      expect(isValidPid(null as unknown as number)).toBe(false);
      expect(isValidPid(undefined as unknown as number)).toBe(false);
    });

    it('should reject objects', () => {
      expect(isValidPid({} as unknown as number)).toBe(false);
      expect(isValidPid({ pid: 1 } as unknown as number)).toBe(false);
    });

    it('should reject arrays', () => {
      expect(isValidPid([] as unknown as number)).toBe(false);
      expect(isValidPid([1] as unknown as number)).toBe(false);
    });

    it('should reject booleans', () => {
      expect(isValidPid(true as unknown as number)).toBe(false);
      expect(isValidPid(false as unknown as number)).toBe(false);
    });
  });

  describe('edge cases', () => {
    it('should handle Number.MAX_SAFE_INTEGER', () => {
      expect(isValidPid(Number.MAX_SAFE_INTEGER)).toBe(false);
    });

    it('should handle very small positive numbers', () => {
      expect(isValidPid(0.0001)).toBe(false);
      expect(isValidPid(0.9999)).toBe(false);
    });
  });
});
