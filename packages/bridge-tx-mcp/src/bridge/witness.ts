import { isHex, pad } from 'viem';

function toBigIntFlexible(v: unknown): bigint {
  if (typeof v === 'bigint') {
    return v;
  }
  if (typeof v === 'number') {
    if (!Number.isFinite(v) || !Number.isInteger(v)) {
      throw new Error('Expected integer number for bigint field');
    }
    return BigInt(v);
  }
  if (typeof v === 'string') {
    return BigInt(v);
  }
  throw new Error('Expected string, number, or bigint');
}

function normalizeBytes32Hex(s: string): `0x${string}` {
  const t = s.trim();
  if (!isHex(t)) {
    throw new Error(`Invalid hex string in sibling path: ${s}`);
  }
  return pad(t as `0x${string}`, { size: 32 });
}

/**
 * Parse JSON for `L2ToL1MembershipWitness`-shaped data (Fr fields may appear as hex strings).
 */
export function parseMembershipWitnessJson(raw: string): {
  epoch: bigint;
  leafIndex: bigint;
  path: readonly `0x${string}`[];
} {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw) as unknown;
  } catch {
    throw new Error('witness must be valid JSON');
  }
  if (parsed === null || typeof parsed !== 'object') {
    throw new Error('witness JSON must be an object');
  }
  const o = parsed as Record<string, unknown>;
  const epochNumber = o.epochNumber ?? o.epoch;
  const leafIndex = o.leafIndex;
  const siblingPath = o.siblingPath;

  if (epochNumber === undefined) {
    throw new Error('witness must include epochNumber');
  }
  if (leafIndex === undefined) {
    throw new Error('witness must include leafIndex');
  }
  if (siblingPath === undefined) {
    throw new Error('witness must include siblingPath');
  }

  const epoch = toBigIntFlexible(epochNumber);
  const leaf = toBigIntFlexible(leafIndex);

  let pathRaw: unknown[];
  if (Array.isArray(siblingPath)) {
    pathRaw = siblingPath;
  } else if (siblingPath && typeof siblingPath === 'object' && 'data' in siblingPath) {
    const data = (siblingPath as { data?: unknown }).data;
    if (!Array.isArray(data)) {
      throw new Error('witness.siblingPath.data must be an array when siblingPath is an object');
    }
    pathRaw = data;
  } else {
    throw new Error('witness.siblingPath must be a hex string array or { data: hex[] }');
  }

  const path = pathRaw.map((p, i) => {
    if (typeof p !== 'string') {
      throw new Error(`witness.siblingPath[${i}] must be a hex string`);
    }
    return normalizeBytes32Hex(p);
  });

  return { epoch, leafIndex: leaf, path };
}
