import { Fr } from '@aztec/foundation/curves/bn254';
import { computeSecretHash } from '@aztec/stdlib/hash';
/**
 * Same derivation as `generateClaimSecret` in `@aztec/aztec.js` (Fr.random + `computeSecretHash`).
 */
export async function generateDepositClaimPair() {
    const claimSecret = Fr.random();
    const secretHash = await computeSecretHash(claimSecret);
    return { claimSecret, secretHash };
}
