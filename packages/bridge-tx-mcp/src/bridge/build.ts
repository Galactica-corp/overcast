import { encodeFunctionData } from 'viem';

import { erc20ApproveAbi, stablecoinWrapperAbi } from './abis.js';
import type { L1ToL2PrivateClaimJson } from './claim.js';
import { generateDepositClaimPair } from './claim.js';
import { GAS_APPROVE, GAS_BRIDGE_DEPOSIT, GAS_BRIDGE_WITHDRAW } from './gas.js';
import {
  renderMarkdownComponentRawTransactionWithPermit,
  type MarkdownTxPermitProps,
} from './markdown.js';
import { parseDecimalToBaseUnits } from './amount.js';
import { parseMembershipWitnessJson } from './witness.js';

export interface DepositBuildInput {
  tokenAddress: `0x${string}`;
  wrapperAddress: `0x${string}`;
  userEvmAddress: `0x${string}`;
  userAztecAddress: string;
  amountDecimal: string;
  chainId: string;
  tokenDecimals: number;
  permitSymbol: string;
}

export interface DepositBuildResult {
  markdown: string;
  claimData: L1ToL2PrivateClaimJson;
  /** Optional: ERC-20 approve tx (same mapping as `stablecoin_cross_chain` permit fields). */
  approvalMarkdown?: string;
  bridgeArgs: { amount: string; secretHash: string };
}

export async function buildDepositTransaction(
  input: DepositBuildInput,
): Promise<DepositBuildResult> {
  void input.userAztecAddress;
  const amountWei = parseDecimalToBaseUnits(input.amountDecimal, input.tokenDecimals);
  const { claimSecret, secretHash } = await generateDepositClaimPair();
  const secretHashHex = secretHash.toString() as `0x${string}`;

  const bridgeData = encodeFunctionData({
    abi: stablecoinWrapperAbi,
    functionName: 'bridgeToAztec',
    args: [amountWei, secretHashHex],
  });

  const props: MarkdownTxPermitProps = {
    txTo: input.wrapperAddress,
    txGas: GAS_BRIDGE_DEPOSIT.toString(),
    txData: bridgeData,
    txFrom: input.userEvmAddress,
    txValue: '0',
    permitSymbol: input.permitSymbol,
    permitTo: input.wrapperAddress,
    permitToken: input.tokenAddress,
    permitValue: amountWei.toString(),
    chainId: input.chainId,
  };

  const markdown = renderMarkdownComponentRawTransactionWithPermit(props);

  const approveData = encodeFunctionData({
    abi: erc20ApproveAbi,
    functionName: 'approve',
    args: [input.wrapperAddress, amountWei],
  });

  const approvalMarkdown = renderMarkdownComponentRawTransactionWithPermit({
    ...props,
    txTo: input.tokenAddress,
    txGas: GAS_APPROVE.toString(),
    txData: approveData,
    permitSymbol: input.permitSymbol,
    permitTo: input.wrapperAddress,
    permitToken: input.tokenAddress,
    permitValue: amountWei.toString(),
  });

  const claimData: L1ToL2PrivateClaimJson = {
    claimAmount: amountWei.toString(),
    claimSecret: claimSecret.toString(),
  };

  return {
    markdown,
    claimData,
    approvalMarkdown,
    bridgeArgs: {
      amount: amountWei.toString(),
      secretHash: secretHashHex,
    },
  };
}

export interface WithdrawBuildInput {
  wrapperAddress: `0x${string}`;
  userEvmAddress: `0x${string}`;
  userAztecAddress: string;
  amountDecimal: string;
  chainId: string;
  tokenDecimals: number;
  witnessJson: string;
  callerOnL1: `0x${string}`;
}

export interface WithdrawBuildResult {
  markdown: string;
}

export function buildWithdrawTransaction(input: WithdrawBuildInput): WithdrawBuildResult {
  void input.userAztecAddress;
  const amountWei = parseDecimalToBaseUnits(input.amountDecimal, input.tokenDecimals);
  const { epoch, leafIndex, path } = parseMembershipWitnessJson(input.witnessJson);

  const withdrawData = encodeFunctionData({
    abi: stablecoinWrapperAbi,
    functionName: 'withdrawFromL2ToL1',
    args: [input.userEvmAddress, amountWei, input.callerOnL1, epoch, leafIndex, [...path]],
  });

  const props: MarkdownTxPermitProps = {
    txTo: input.wrapperAddress,
    txGas: GAS_BRIDGE_WITHDRAW.toString(),
    txData: withdrawData,
    txFrom: input.userEvmAddress,
    txValue: '0',
    permitSymbol: '',
    permitTo: '',
    permitToken: '',
    permitValue: '',
    chainId: input.chainId,
  };

  return {
    markdown: renderMarkdownComponentRawTransactionWithPermit(props),
  };
}
