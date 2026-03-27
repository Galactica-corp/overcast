import { EthAddress, AztecAddress } from '@aztec/aztec.js/addresses';
import { Fr } from '@aztec/aztec.js/fields';
import { generateClaimSecret } from '@aztec/aztec.js/ethereum';
import { waitForL1ToL2MessageReady } from '@aztec/aztec.js/messaging';
import type { AztecNode } from '@aztec/aztec.js/node';
import { extractEvent } from '@aztec/ethereum/utils';
import type { ExtendedViemWalletClient } from '@aztec/ethereum/types';
import { retryUntil } from '@aztec/foundation/retry';
import { sha256ToField } from '@aztec/foundation/crypto/sha256';
import { OutboxAbi } from '@aztec/l1-artifacts/OutboxAbi';
import { computeL2ToL1MessageHash } from '@aztec/stdlib/hash';
import { computeL2ToL1MembershipWitness } from '@aztec/stdlib/messaging';
import { TxHash } from '@aztec/stdlib/tx';
import type { Abi } from 'viem';
import { toFunctionSelector } from 'viem';

import { getL1ChainId } from '../../../config/config.js';

export interface L1ToL2PrivateClaim {
    claimAmount: bigint;
    claimSecret: Fr;
    messageHash: Fr;
    messageLeafIndex: bigint;
}

/**
 * Mint TestERC20 to an address (open `mint` — local testing only).
 */
export async function mintTestErc20To(
    l1Client: ExtendedViemWalletClient,
    underlying: `0x${string}`,
    erc20Abi: Abi,
    to: `0x${string}`,
    amount: bigint,
): Promise<void> {
    const hash = await l1Client.writeContract({
        address: underlying,
        abi: erc20Abi,
        functionName: 'mint',
        args: [to, amount],
    });
    await l1Client.waitForTransactionReceipt({ hash });
}

/**
 * Approve StablecoinWrapper, then `bridgeToAztec` with a fresh claim secret. Parses `DepositToAztec` for inbox key/index.
 */
export async function bridgeStablecoinToAztecPrivate(opts: {
    l1ClientAlice: ExtendedViemWalletClient;
    underlying: `0x${string}`;
    stablecoinWrapper: `0x${string}`;
    tokenPortal: `0x${string}`;
    testErc20Abi: Abi;
    wrapperAbi: Abi;
    tokenPortalAbi: Abi;
    amount: bigint;
}): Promise<L1ToL2PrivateClaim> {
    const [claimSecret, secretHashFr] = await generateClaimSecret(undefined);
    const secretHashHex = secretHashFr.toString() as `0x${string}`;

    const approveHash = await opts.l1ClientAlice.writeContract({
        address: opts.underlying,
        abi: opts.testErc20Abi,
        functionName: 'approve',
        args: [opts.stablecoinWrapper, opts.amount],
    });
    await opts.l1ClientAlice.waitForTransactionReceipt({ hash: approveHash });

    const bridgeHash = await opts.l1ClientAlice.writeContract({
        address: opts.stablecoinWrapper,
        abi: opts.wrapperAbi,
        functionName: 'bridgeToAztec',
        args: [opts.amount, secretHashHex],
    });
    const receipt = await opts.l1ClientAlice.waitForTransactionReceipt({ hash: bridgeHash });

    const decoded = extractEvent(
        receipt.logs,
        opts.tokenPortal,
        opts.tokenPortalAbi,
        'DepositToAztec',
        (log) => {
            const args = log.args as {
                secretHash?: `0x${string}`;
                key?: `0x${string}`;
                index?: bigint;
            };
            return args.secretHash?.toLowerCase() === secretHashHex.toLowerCase();
        },
        undefined,
    );
    const args = decoded.args as unknown as {
        key: `0x${string}`;
        index: bigint;
    };
    const messageHash = Fr.fromHexString(args.key);

    return {
        claimSecret,
        claimAmount: opts.amount,
        messageHash,
        messageLeafIndex: args.index,
    };
}

/**
 * Wait until the archiver exposes the L1→L2 message for consumption, then (optionally) you may still need rollup
 * progression; callers typically `simulate` + `send` for `claim_private` after this.
 */
export async function waitForL1MessageReadyForClaim(
    node: AztecNode,
    messageHash: Fr,
    timeoutSeconds = 300,
): Promise<void> {
    await waitForL1ToL2MessageReady(node, messageHash, { timeoutSeconds });
}

/**
 * Hash of the L2→L1 withdrawal message for `TokenPortalContentHash.withdrawContentHash` + protocol L2→L1 wrapping.
 */
export async function getWithdrawL2MessageHash(
    l1Client: ExtendedViemWalletClient,
    aztecNode: AztecNode,
    params: {
        l2Bridge: AztecAddress;
        tokenPortalAddress: `0x${string}`;
        recipientL1: EthAddress;
        amount: bigint;
        /** Set to the StablecoinWrapper L1 address so `msg.sender == callerOnL1` on the portal. */
        callerOnL1: EthAddress;
    },
): Promise<Fr> {
    const { l1ContractAddresses } = await aztecNode.getNodeInfo();
    const version = (await l1Client.readContract({
        address: l1ContractAddresses.outboxAddress.toString(),
        abi: OutboxAbi,
        functionName: 'VERSION',
    })) as bigint;
    const content = sha256ToField([
        Buffer.from(toFunctionSelector('withdraw(address,uint256,address)').substring(2), 'hex'),
        params.recipientL1.toBuffer32(),
        new Fr(params.amount).toBuffer(),
        params.callerOnL1.toBuffer32(),
    ]);
    const chainId = BigInt(getL1ChainId());
    return computeL2ToL1MessageHash({
        l2Sender: params.l2Bridge,
        l1Recipient: EthAddress.fromString(params.tokenPortalAddress),
        content,
        rollupVersion: new Fr(version),
        chainId: new Fr(chainId),
    });
}

/**
 * Poll until `exit_to_l1_private` is included in a proven epoch and the membership witness exists.
 */
export async function waitForL2ToL1MembershipWitness(
    aztecNode: AztecNode,
    messageHash: Fr,
    l2TxHash: string,
    timeoutSeconds = 600,
    intervalSeconds = 2,
): Promise<NonNullable<Awaited<ReturnType<typeof computeL2ToL1MembershipWitness>>>> {
    const txHash = TxHash.fromString(l2TxHash.startsWith('0x') ? l2TxHash : `0x${l2TxHash}`);
    const witness = await retryUntil(
        async () => (await computeL2ToL1MembershipWitness(aztecNode, messageHash, txHash)) ?? undefined,
        'L2 to L1 membership witness',
        timeoutSeconds,
        intervalSeconds,
    );
    return witness;
}

/**
 * Complete L1 withdrawal via StablecoinWrapper after the outbox proof is available.
 */
export async function withdrawStablecoinFromL2ToL1(opts: {
    l1Client: ExtendedViemWalletClient;
    stablecoinWrapper: `0x${string}`;
    wrapperAbi: Abi;
    recipient: `0x${string}`;
    amount: bigint;
    /** Same L1 address passed as `caller_on_l1` in `exit_to_l1_private`. */
    callerOnL1: `0x${string}`;
    witness: NonNullable<Awaited<ReturnType<typeof computeL2ToL1MembershipWitness>>>;
}): Promise<void> {
    const path = opts.witness.siblingPath
        .toBufferArray()
        .map((buf) => `0x${Buffer.from(buf).toString('hex')}` as `0x${string}`);
    const epoch = BigInt(String(opts.witness.epochNumber));

    const hash = await opts.l1Client.writeContract({
        address: opts.stablecoinWrapper,
        abi: opts.wrapperAbi,
        functionName: 'withdrawFromL2ToL1',
        args: [opts.recipient, opts.amount, opts.callerOnL1, epoch, opts.witness.leafIndex, path],
    });
    await opts.l1Client.waitForTransactionReceipt({ hash });
}
