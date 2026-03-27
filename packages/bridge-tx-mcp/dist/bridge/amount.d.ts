/**
 * Parse a non-negative decimal string into base units using fixed decimals (no RPC).
 * Example: "2.0" with decimals 6 -> 2000000n
 */
export declare function parseDecimalToBaseUnits(amountDecimal: string, decimals: number): bigint;
