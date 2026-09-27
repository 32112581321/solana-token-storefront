const BASE58_ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
const BASE58_ADDRESS = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

export function isSolanaAddress(value: string): boolean {
  if (!BASE58_ADDRESS.test(value)) return false;

  let decoded = 0n;
  for (const character of value) {
    const index = BASE58_ALPHABET.indexOf(character);
    if (index < 0) return false;
    decoded = (decoded * 58n) + BigInt(index);
  }

  const leadingZeroBytes = value.match(/^1*/)?.[0].length ?? 0;
  const decodedBytes = decoded === 0n ? 0 : Math.ceil(decoded.toString(16).length / 2);
  return leadingZeroBytes + decodedBytes === 32;
}

export function encodeBase58(bytes: Uint8Array): string {
  let value = 0n;
  for (const byte of bytes) value = (value * 256n) + BigInt(byte);

  let encoded = '';
  while (value > 0n) {
    const remainder = Number(value % 58n);
    encoded = `${BASE58_ALPHABET[remainder]}${encoded}`;
    value /= 58n;
  }

  let leadingZeroes = 0;
  while (leadingZeroes < bytes.length && bytes[leadingZeroes] === 0) leadingZeroes += 1;
  return `${'1'.repeat(leadingZeroes)}${encoded}`;
}

export function createReference(randomBytes?: Uint8Array): string {
  const bytes = randomBytes ?? crypto.getRandomValues(new Uint8Array(32));
  if (bytes.length !== 32) throw new Error('Payment references require exactly 32 random bytes.');
  return encodeBase58(bytes);
}

export function shortAddress(value: string): string {
  return value ? `${value.slice(0, 5)}…${value.slice(-5)}` : 'Not configured';
}
