/**
 * Parse a non-negative decimal string into base units using fixed decimals (no RPC).
 * Example: "2.0" with decimals 6 -> 2000000n
 */
export function parseDecimalToBaseUnits(amountDecimal: string, decimals: number): bigint {
  if (decimals < 0 || decimals > 36 || !Number.isInteger(decimals)) {
    throw new Error(`tokenDecimals must be an integer between 0 and 36, got ${decimals}`);
  }
  const trimmed = amountDecimal.trim();
  if (trimmed === '' || trimmed === '.') {
    throw new Error('amount must be a non-empty decimal string');
  }
  if (trimmed.startsWith('-')) {
    throw new Error('amount must be non-negative');
  }
  const parts = trimmed.split('.');
  if (parts.length > 2) {
    throw new Error('amount must contain at most one decimal point');
  }
  const [wholePart, fracPart = ''] = parts;
  if (!/^\d*$/.test(wholePart) || !/^\d*$/.test(fracPart)) {
    throw new Error('amount must contain only digits and an optional decimal point');
  }
  if (fracPart.length > decimals) {
    throw new Error(`amount has more than ${decimals} fractional digits for this token`);
  }
  const whole = BigInt(wholePart === '' ? '0' : wholePart);
  const fracPadded = fracPart.padEnd(decimals, '0').slice(0, decimals);
  const fracValue = BigInt(fracPadded === '' ? '0' : fracPadded);
  const scale = 10n ** BigInt(decimals);
  return whole * scale + fracValue;
}
