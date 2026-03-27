import { isHex, pad } from 'viem';
function toBigIntFlexible(v) {
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
function normalizeBytes32Hex(s) {
    const t = s.trim();
    if (!isHex(t)) {
        throw new Error(`Invalid hex string in sibling path: ${s}`);
    }
    return pad(t, { size: 32 });
}
/**
 * Parse JSON for `L2ToL1MembershipWitness`-shaped data (Fr fields may appear as hex strings).
 */
export function parseMembershipWitnessJson(raw) {
    let parsed;
    try {
        parsed = JSON.parse(raw);
    }
    catch {
        throw new Error('witness must be valid JSON');
    }
    if (parsed === null || typeof parsed !== 'object') {
        throw new Error('witness JSON must be an object');
    }
    const o = parsed;
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
    let pathRaw;
    if (Array.isArray(siblingPath)) {
        pathRaw = siblingPath;
    }
    else if (siblingPath && typeof siblingPath === 'object' && 'data' in siblingPath) {
        const data = siblingPath.data;
        if (!Array.isArray(data)) {
            throw new Error('witness.siblingPath.data must be an array when siblingPath is an object');
        }
        pathRaw = data;
    }
    else {
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
