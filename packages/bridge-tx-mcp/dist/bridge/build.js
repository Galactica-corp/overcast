import { encodeFunctionData } from 'viem';
import { erc20ApproveAbi, stablecoinWrapperAbi } from './abis.js';
import { generateDepositClaimPair } from './claim.js';
import { GAS_APPROVE, GAS_BRIDGE_DEPOSIT, GAS_BRIDGE_WITHDRAW } from './gas.js';
import { renderMarkdownComponentRawTransactionWithPermit, } from './markdown.js';
import { parseDecimalToBaseUnits } from './amount.js';
import { parseMembershipWitnessJson } from './witness.js';
export async function buildDepositTransaction(input) {
    void input.userAztecAddress;
    const amountWei = parseDecimalToBaseUnits(input.amountDecimal, input.tokenDecimals);
    const { claimSecret, secretHash } = await generateDepositClaimPair();
    const secretHashHex = secretHash.toString();
    const bridgeData = encodeFunctionData({
        abi: stablecoinWrapperAbi,
        functionName: 'bridgeToAztec',
        args: [amountWei, secretHashHex],
    });
    const props = {
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
    const claimData = {
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
export function buildWithdrawTransaction(input) {
    void input.userAztecAddress;
    const amountWei = parseDecimalToBaseUnits(input.amountDecimal, input.tokenDecimals);
    const { epoch, leafIndex, path } = parseMembershipWitnessJson(input.witnessJson);
    const withdrawData = encodeFunctionData({
        abi: stablecoinWrapperAbi,
        functionName: 'withdrawFromL2ToL1',
        args: [input.userEvmAddress, amountWei, input.callerOnL1, epoch, leafIndex, [...path]],
    });
    const props = {
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
