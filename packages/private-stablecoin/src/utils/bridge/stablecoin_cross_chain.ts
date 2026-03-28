import { EthAddress, AztecAddress } from '@aztec/aztec.js/addresses';
import type { SponsoredFeePaymentMethod } from '@aztec/aztec.js/fee';
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
import type { EmbeddedWallet } from '@aztec/wallets/embedded';
import type { Abi } from 'viem';
import { encodeFunctionData, numberToHex, toFunctionSelector } from 'viem';

import { TokenBridgeContract } from '../../artifacts/TokenBridge.js';

import { getL1ChainId } from '../../../config/config.js';

export interface L1ToL2PrivateClaim {
  claimAmount: bigint;
  claimSecret: Fr;
  messageHash: Fr;
  messageLeafIndex: bigint;
}

interface MarkdownComponentRawTransactionWithPermitFields {
  txTo: string;
  txGas: string;
  txData: string;
  txFrom: string;
  txValue: string;
  permitSymbol: string;
  permitTo: string;
  permitToken: string;
  permitValue: string;
  chainId: string;
}

function getWalletClientAddress(client: ExtendedViemWalletClient): `0x${string}` {
  const account = client.account;
  if (!account) {
    throw new Error('Wallet client account is required to build EVM transaction metadata.');
  }
  return (typeof account === 'string' ? account : account.address) as `0x${string}`;
}

function logMarkdownComponentRawTransactionWithPermit(flow: 'deposit' | 'withdraw', payload: Record<string, unknown>): void {
  process.stdout.write(
    `[stablecoin-cross-chain:${flow}] ${JSON.stringify(
      {
        instruction: `Coding agent: write an MCP that returns these fields for ${flow} so the UI can render MarkdownComponentRawTransactionWithPermit directly.`,
        component: 'MarkdownComponentRawTransactionWithPermit',
        flow,
        ...payload,
      },
      null,
      2,
    )}\n`,
  );
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
  const txFrom = getWalletClientAddress(opts.l1ClientAlice);
  const chainId = String(await opts.l1ClientAlice.getChainId());
  const approveData = encodeFunctionData({
    abi: opts.testErc20Abi,
    functionName: 'approve',
    args: [opts.stablecoinWrapper, opts.amount],
  });
  const approveGas = await opts.l1ClientAlice.estimateGas({
    account: txFrom,
    to: opts.underlying,
    data: approveData,
    value: 0n,
  });
  const bridgeData = encodeFunctionData({
    abi: opts.wrapperAbi,
    functionName: 'bridgeToAztec',
    args: [opts.amount, secretHashHex],
  });
  let permitSymbol = 'UNKNOWN';
  try {
    permitSymbol = String(
      await opts.l1ClientAlice.readContract({
        address: opts.underlying,
        abi: opts.testErc20Abi,
        functionName: 'symbol',
      }),
    );
  } catch {
    // Some test ERC20 ABIs may not expose `symbol`; keep the MCP contract explicit about the missing value.
  }

  const approveHash = await opts.l1ClientAlice.writeContract({
    address: opts.underlying,
    abi: opts.testErc20Abi,
    functionName: 'approve',
    args: [opts.stablecoinWrapper, opts.amount],
  });
  await opts.l1ClientAlice.waitForTransactionReceipt({ hash: approveHash });

  const bridgeGas = await opts.l1ClientAlice.estimateGas({
    account: txFrom,
    to: opts.stablecoinWrapper,
    data: bridgeData,
    value: 0n,
  });
  const markdownComponentProps: MarkdownComponentRawTransactionWithPermitFields = {
    txTo: opts.stablecoinWrapper,
    txGas: bridgeGas.toString(),
    txData: bridgeData,
    txFrom,
    txValue: '0',
    permitSymbol,
    permitTo: opts.stablecoinWrapper,
    permitToken: opts.underlying,
    permitValue: opts.amount.toString(),
    chainId,
  };
  logMarkdownComponentRawTransactionWithPermit('deposit', {
    markdownComponentProps,
    notes: [
      'The raw transaction is StablecoinWrapper.bridgeToAztec(amount, secretHash).',
      'The current flow sends a separate ERC20 approve transaction before bridgeToAztec; map that approval into the permit fields until a signed permit flow exists.',
      'If permitSymbol is UNKNOWN, the MCP should fetch ERC20.symbol() separately or let the caller supply it.',
      'This payload is emitted after the approval transaction is mined so gas estimation reflects the real executable bridge call.',
    ],
    approvalTransaction: {
      txTo: opts.underlying,
      txGas: approveGas.toString(),
      txData: approveData,
      txFrom,
      txValue: '0',
      txHash: approveHash,
    },
    bridgeArgs: {
      amount: opts.amount.toString(),
      secretHash: secretHashHex,
    },
  });

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
 * Mine L1 blocks on Foundry Anvil (chain id 31337). Helps the Aztec sequencer observe finalized L1 inbox state.
 * No-ops on other chains or if the RPC does not support `anvil_mine`.
 */
export async function mineAnvilL1Blocks(l1Client: ExtendedViemWalletClient, blocks: number): Promise<void> {
  if (getL1ChainId() !== 31337 || blocks <= 0) {
    return;
  }
  try {
    await l1Client.transport.request({
      method: 'anvil_mine',
      params: [numberToHex(blocks)],
    });
  } catch {
    // Not Anvil or method unavailable — devnet / other L1.
  }
}

/**
 * Mine two L2 blocks by universal-deploying `TokenBridge` twice (Aztec bridge tutorial pattern). Required so L2
 * checkpoints advance far enough for `waitForL1ToL2MessageReady` / `claim_private` after an L1 deposit.
 */
export async function mineTwoL2BlocksForInboxLag(opts: {
  wallet: EmbeddedWallet;
  l2Token: AztecAddress;
  tokenPortalL1: `0x${string}`;
  from: AztecAddress;
  sponsoredPaymentMethod: SponsoredFeePaymentMethod;
  txTimeout: number;
}): Promise<void> {
  const portalEth = EthAddress.fromString(opts.tokenPortalL1);
  for (let i = 0; i < 2; i++) {
    const deploy = TokenBridgeContract.deploy(opts.wallet, opts.l2Token, portalEth);
    await deploy.send({
      from: opts.from,
      fee: { paymentMethod: opts.sponsoredPaymentMethod },
      wait: { timeout: opts.txTimeout },
      contractAddressSalt: Fr.random(),
      universalDeploy: true,
    });
  }
}

/**
 * After `bridgeToAztec` on L1: advance local L1 (Anvil) + L2 so inbox messages become claimable, then wait for the
 * node to report the message ready (checkpoint ordering).
 */
export async function advanceLocalChainThenWaitForL1MessageReady(opts: {
  node: AztecNode;
  messageHash: Fr;
  l1Client: ExtendedViemWalletClient;
  wallet: EmbeddedWallet;
  l2Token: AztecAddress;
  tokenPortalL1: `0x${string}`;
  from: AztecAddress;
  sponsoredPaymentMethod: SponsoredFeePaymentMethod;
  txTimeout: number;
  waitTimeoutSeconds: number;
}): Promise<void> {
  await mineAnvilL1Blocks(opts.l1Client, 2);
  await mineTwoL2BlocksForInboxLag({
    wallet: opts.wallet,
    l2Token: opts.l2Token,
    tokenPortalL1: opts.tokenPortalL1,
    from: opts.from,
    sponsoredPaymentMethod: opts.sponsoredPaymentMethod,
    txTimeout: opts.txTimeout,
  });
  await waitForL1MessageReadyForClaim(opts.node, opts.messageHash, opts.waitTimeoutSeconds);
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
  const sec = timeoutSeconds == null || timeoutSeconds <= 0 ? 300 : timeoutSeconds;
  await waitForL1ToL2MessageReady(node, messageHash, { timeoutSeconds: sec });
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
 * Wait until L2 has proven at least `minBlockNumber` on L1 (rollup inserts the epoch outbox root).
 * Required before `Outbox.consume` / `TokenPortal.withdraw`; otherwise L1 reverts with
 * `Outbox__NothingToConsumeAtEpoch` because `roots[epoch].root` is still zero.
 */
export async function waitForL2BlockProvenOnL1(
  node: AztecNode,
  minBlockNumber: number,
  timeoutSeconds: number,
  intervalSeconds = 2,
): Promise<void> {
  await retryUntil(
    async () => {
      const proven = await node.getProvenBlockNumber();
      return proven >= minBlockNumber ? true : undefined;
    },
    `L2 block ${minBlockNumber} proven on L1 (outbox root available)`,
    timeoutSeconds,
    intervalSeconds,
  );
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
  const txFrom = getWalletClientAddress(opts.l1Client);
  const chainId = String(await opts.l1Client.getChainId());
  const withdrawArgs = [opts.recipient, opts.amount, opts.callerOnL1, epoch, opts.witness.leafIndex, path] as const;
  const withdrawData = encodeFunctionData({
    abi: opts.wrapperAbi,
    functionName: 'withdrawFromL2ToL1',
    args: withdrawArgs,
  });
  const withdrawGas = await opts.l1Client.estimateGas({
    account: txFrom,
    to: opts.stablecoinWrapper,
    data: withdrawData,
    value: 0n,
  });

  const markdownComponentProps: MarkdownComponentRawTransactionWithPermitFields = {
    txTo: opts.stablecoinWrapper,
    txGas: withdrawGas.toString(),
    txData: withdrawData,
    txFrom,
    txValue: '0',
    permitSymbol: '',
    permitTo: '',
    permitToken: '',
    permitValue: '',
    chainId,
  };
  logMarkdownComponentRawTransactionWithPermit('withdraw', {
    markdownComponentProps,
    notes: [
      'The raw transaction is StablecoinWrapper.withdrawFromL2ToL1(recipient, amount, callerOnL1, epoch, leafIndex, siblingPath).',
      'There is no permit/approval step in the withdrawal flow, so the permit fields should be treated as empty or not-applicable by the MCP consumer.',
    ],
    withdrawArgs: {
      recipient: opts.recipient,
      amount: opts.amount.toString(),
      callerOnL1: opts.callerOnL1,
      epoch: epoch.toString(),
      leafIndex: opts.witness.leafIndex.toString(),
      siblingPath: path,
    },
  });

  const hash = await opts.l1Client.writeContract({
    address: opts.stablecoinWrapper,
    abi: opts.wrapperAbi,
    functionName: 'withdrawFromL2ToL1',
    args: withdrawArgs,
  });
  await opts.l1Client.waitForTransactionReceipt({ hash });
}
