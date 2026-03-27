import { Fr } from '@aztec/foundation/curves/bn254';
export interface L1ToL2PrivateClaimJson {
    /** Base units as decimal string */
    claimAmount: string;
    /** `Fr` serialized as hex (matches `Fr.toString()`) */
    claimSecret: string;
    /**
     * Inbox message key from `DepositToAztec` after the L1 bridge tx is mined — unknown offline.
     * Omitted when not available.
     */
    messageHash?: string;
    /**
     * Inbox leaf index from the same event — unknown offline.
     * Omitted when not available.
     */
    messageLeafIndex?: string;
}
/**
 * Same derivation as `generateClaimSecret` in `@aztec/aztec.js` (Fr.random + `computeSecretHash`).
 */
export declare function generateDepositClaimPair(): Promise<{
    claimSecret: Fr;
    secretHash: Fr;
}>;
