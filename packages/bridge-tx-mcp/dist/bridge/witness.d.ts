/**
 * Parse JSON for `L2ToL1MembershipWitness`-shaped data (Fr fields may appear as hex strings).
 */
export declare function parseMembershipWitnessJson(raw: string): {
    epoch: bigint;
    leafIndex: bigint;
    path: readonly `0x${string}`[];
};
