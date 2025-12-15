/**
 * Tests for validation utility functions
 */

import { describe, it, expect } from 'vitest';
import {
  clampRange,
  clampInt,
  parseLines,
  parseFirstLine,
  toString,
  toOptionalString,
  toBoolean,
  toArray,
  limitArray,
  isObject,
  getProp,
} from '../../../src/utils/validation.js';

describe('clampRange', () => {
  describe('basic functionality', () => {
    it('should return value within range', () => {
      expect(clampRange(50, 0, 100, 0)).toBe(50);
      expect(clampRange(5, 1, 10, 5)).toBe(5);
    });

    it('should clamp value below minimum', () => {
      expect(clampRange(-10, 0, 100, 50)).toBe(0);
      expect(clampRange(0, 1, 10, 5)).toBe(1);
    });

    it('should clamp value above maximum', () => {
      expect(clampRange(150, 0, 100, 50)).toBe(100);
      expect(clampRange(20, 1, 10, 5)).toBe(10);
    });

    it('should use default for non-number values', () => {
      expect(clampRange(undefined, 0, 100, 50)).toBe(50);
      expect(clampRange(null, 0, 100, 50)).toBe(50);
      expect(clampRange('string', 0, 100, 50)).toBe(50);
      expect(clampRange({}, 0, 100, 50)).toBe(50);
    });

    it('should handle NaN', () => {
      expect(clampRange(NaN, 0, 100, 50)).toBe(50);
    });
  });

  describe('edge cases', () => {
    it('should handle min equal to max', () => {
      expect(clampRange(50, 10, 10, 10)).toBe(10);
    });

    it('should handle negative ranges', () => {
      expect(clampRange(-50, -100, -10, -50)).toBe(-50);
      expect(clampRange(-150, -100, -10, -50)).toBe(-100);
    });

    it('should handle zero as default', () => {
      expect(clampRange(undefined, 0, 100, 0)).toBe(0);
    });

    it('should handle float values', () => {
      expect(clampRange(5.5, 0, 10, 5)).toBe(5.5);
    });
  });
});

describe('clampInt', () => {
  it('should clamp and floor float values', () => {
    expect(clampInt(5.9, 1, 10, 5)).toBe(5);
    expect(clampInt(5.1, 1, 10, 5)).toBe(5);
  });

  it('should use default for non-numbers', () => {
    expect(clampInt(undefined, 1, 10, 5)).toBe(5);
    expect(clampInt('string', 1, 10, 5)).toBe(5);
  });
});

describe('parseLines', () => {
  it('should split output into lines', () => {
    expect(parseLines('line1\nline2\nline3')).toEqual(['line1', 'line2', 'line3']);
  });

  it('should filter empty lines', () => {
    expect(parseLines('line1\n\nline2\n\n')).toEqual(['line1', 'line2']);
  });

  it('should trim whitespace', () => {
    expect(parseLines('  line1\nline2  \n  ')).toEqual(['line1', 'line2']);
  });

  it('should handle empty string', () => {
    expect(parseLines('')).toEqual([]);
  });

  it('should handle single line', () => {
    expect(parseLines('single line')).toEqual(['single line']);
  });

  it('should handle Windows line endings', () => {
    expect(parseLines('line1\r\nline2')).toEqual(['line1\r', 'line2']);
  });
});

describe('parseFirstLine', () => {
  it('should return first line', () => {
    expect(parseFirstLine('first\nsecond\nthird')).toBe('first');
  });

  it('should handle single line', () => {
    expect(parseFirstLine('only line')).toBe('only line');
  });

  it('should handle empty string', () => {
    expect(parseFirstLine('')).toBe('');
  });

  it('should trim leading whitespace', () => {
    // parseFirstLine trims the whole string first, then splits
    // So '  first  \nsecond' becomes 'first  \nsecond' then ['first  ', 'second']
    expect(parseFirstLine('  first\nsecond')).toBe('first');
  });
});

describe('toString', () => {
  it('should return strings as-is', () => {
    expect(toString('hello')).toBe('hello');
    expect(toString('')).toBe('');
  });

  it('should convert numbers', () => {
    expect(toString(42)).toBe('42');
    expect(toString(3.14)).toBe('3.14');
  });

  it('should handle null/undefined', () => {
    expect(toString(null)).toBe('');
    expect(toString(undefined)).toBe('');
  });

  it('should convert booleans', () => {
    expect(toString(true)).toBe('true');
    expect(toString(false)).toBe('false');
  });

  it('should convert objects', () => {
    expect(toString({})).toBe('[object Object]');
  });
});

describe('toOptionalString', () => {
  it('should return string for values', () => {
    expect(toOptionalString('hello')).toBe('hello');
    expect(toOptionalString(42)).toBe('42');
  });

  it('should return undefined for null/undefined', () => {
    expect(toOptionalString(null)).toBeUndefined();
    expect(toOptionalString(undefined)).toBeUndefined();
  });
});

describe('toBoolean', () => {
  it('should pass through booleans', () => {
    expect(toBoolean(true)).toBe(true);
    expect(toBoolean(false)).toBe(false);
  });

  it('should convert truthy strings', () => {
    expect(toBoolean('true')).toBe(true);
    expect(toBoolean('1')).toBe(true);
  });

  it('should convert falsy strings', () => {
    expect(toBoolean('false')).toBe(false);
    expect(toBoolean('0')).toBe(false);
  });

  it('should use default for other values', () => {
    expect(toBoolean('yes', false)).toBe(false);
    expect(toBoolean('yes', true)).toBe(true);
    expect(toBoolean(null, true)).toBe(true);
    expect(toBoolean(undefined, false)).toBe(false);
  });
});

describe('toArray', () => {
  it('should return array as-is', () => {
    expect(toArray([1, 2, 3])).toEqual([1, 2, 3]);
    expect(toArray([])).toEqual([]);
  });

  it('should wrap single value', () => {
    expect(toArray(42)).toEqual([42]);
    expect(toArray('hello')).toEqual(['hello']);
  });

  it('should return empty array for null/undefined', () => {
    expect(toArray(null)).toEqual([]);
    expect(toArray(undefined)).toEqual([]);
  });
});

describe('limitArray', () => {
  it('should limit array to N items', () => {
    expect(limitArray([1, 2, 3, 4, 5], 3)).toEqual([1, 2, 3]);
  });

  it('should return full array if limit exceeds length', () => {
    expect(limitArray([1, 2], 5)).toEqual([1, 2]);
  });

  it('should return empty for zero limit', () => {
    expect(limitArray([1, 2, 3], 0)).toEqual([]);
  });

  it('should handle negative limit', () => {
    expect(limitArray([1, 2, 3], -1)).toEqual([]);
  });
});

describe('isObject', () => {
  it('should return true for plain objects', () => {
    expect(isObject({})).toBe(true);
    expect(isObject({ key: 'value' })).toBe(true);
  });

  it('should return false for arrays', () => {
    expect(isObject([])).toBe(false);
    expect(isObject([1, 2, 3])).toBe(false);
  });

  it('should return false for null', () => {
    expect(isObject(null)).toBe(false);
  });

  it('should return false for primitives', () => {
    expect(isObject('string')).toBe(false);
    expect(isObject(42)).toBe(false);
    expect(isObject(true)).toBe(false);
    expect(isObject(undefined)).toBe(false);
  });
});

describe('getProp', () => {
  it('should get existing property', () => {
    expect(getProp({ key: 'value' }, 'key', 'default')).toBe('value');
  });

  it('should return default for missing property', () => {
    expect(getProp({}, 'key', 'default')).toBe('default');
  });

  it('should return default for null/undefined values', () => {
    expect(getProp({ key: null }, 'key', 'default')).toBe('default');
    expect(getProp({ key: undefined }, 'key', 'default')).toBe('default');
  });

  it('should return falsy values that are not null/undefined', () => {
    expect(getProp({ key: 0 }, 'key', 10)).toBe(0);
    expect(getProp({ key: '' }, 'key', 'default')).toBe('');
    expect(getProp({ key: false }, 'key', true)).toBe(false);
  });
});
