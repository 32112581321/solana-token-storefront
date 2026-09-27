import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('historical upstream transfer proof', () => {
  it('preserves the recorded demo transfer independently of a fork configuration', async () => {
    const proof = JSON.parse(await readFile(resolve(import.meta.dirname, '../public/devnet-proof.json'), 'utf8'));
    expect(proof).toMatchObject({
      network: 'devnet',
      recipient: '8YRJP9pHJJtcDqX29hwGKmCmvBwmcyoCaKmFnyk43UNL',
      token: {
        symbol: 'TEST DRU',
        mint: 'FAM2TEFYrRXFVQ8W16SkPwaeZyWPcLnjieiTMYvc6Kpw',
        decimals: 6,
      },
      amount: '30',
      amountMinorUnits: '30000000',
      signature: '3MLUvuYppeqJt4DFC6tY1RXxMyznBRTcjmv2vy5bQfsHr925tKqb4PkWh8oisPfX8E4dJR57kqNUDktejE8kMUWz',
    });
    expect(BigInt(proof.recipientBalanceAfter) - BigInt(proof.recipientBalanceBefore))
      .toBe(BigInt(proof.amountMinorUnits));
  });
});
