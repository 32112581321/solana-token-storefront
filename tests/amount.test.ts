import { describe, expect, it } from 'vitest';
import { formatTokenAmount, parseTokenAmount } from '../src/domain/amount';

describe('token amount arithmetic', () => {
  it('parses and formats exact minor units', () => {
    expect(parseTokenAmount('30', 6)).toBe(30_000_000n);
    expect(parseTokenAmount('1.000001', 6)).toBe(1_000_001n);
    expect(formatTokenAmount(30_000_000n, 6)).toBe('30');
    expect(formatTokenAmount(1_230_000n, 6)).toBe('1.23');
  });

  it('rejects excess precision and malformed values', () => {
    expect(() => parseTokenAmount('1.0000001', 6)).toThrow('exceeds 6 decimal places');
    expect(() => parseTokenAmount('1e3', 6)).toThrow('Invalid token amount');
    expect(() => parseTokenAmount('-1', 6)).toThrow('Invalid token amount');
  });
});
