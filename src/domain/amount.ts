const DECIMAL_AMOUNT = /^(0|[1-9]\d*)(?:\.(\d+))?$/;

export function parseTokenAmount(value: string, decimals: number): bigint {
  if (!Number.isInteger(decimals) || decimals < 0 || decimals > 9) {
    throw new Error('Token decimals must be an integer from 0 through 9.');
  }

  const match = value.match(DECIMAL_AMOUNT);
  if (!match) throw new Error(`Invalid token amount: ${value}`);

  const whole = match[1] ?? '0';
  const fraction = match[2] ?? '';
  if (fraction.length > decimals) {
    throw new Error(`Token amount ${value} exceeds ${decimals} decimal places.`);
  }

  const paddedFraction = fraction.padEnd(decimals, '0');
  return (BigInt(whole) * (10n ** BigInt(decimals))) + BigInt(paddedFraction || '0');
}

export function formatTokenAmount(units: bigint, decimals: number): string {
  if (units < 0n) throw new Error('Token amount cannot be negative.');
  const scale = 10n ** BigInt(decimals);
  const whole = units / scale;
  if (decimals === 0) return whole.toString();
  const fraction = (units % scale).toString().padStart(decimals, '0').replace(/0+$/, '');
  return fraction ? `${whole}.${fraction}` : whole.toString();
}
