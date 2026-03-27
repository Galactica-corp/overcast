import type { L1ToL2PrivateClaimJson } from './claim.js';
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
    bridgeArgs: {
        amount: string;
        secretHash: string;
    };
}
export declare function buildDepositTransaction(input: DepositBuildInput): Promise<DepositBuildResult>;
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
export declare function buildWithdrawTransaction(input: WithdrawBuildInput): WithdrawBuildResult;
