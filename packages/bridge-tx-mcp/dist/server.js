import { FastMCP } from 'fastmcp';
import { isAddress } from 'viem';
import { z } from 'zod';
import { buildDepositTransaction, buildWithdrawTransaction } from './bridge/build.js';
const hexAddress = z
    .string()
    .refine((a) => isAddress(a), {
    message: 'Must be a checksummed or valid 0x address',
});
/** Validated for presence only; format varies by caller (Fr hex, Aztec address string, etc.). */
const aztecLikeAddress = z.string().min(1);
const baseInputs = z.object({
    tokenAddress: hexAddress,
    wrapperAddress: hexAddress,
    userEvmAddress: hexAddress,
    userAztecAddress: aztecLikeAddress,
    amount: z.string().describe("Token amount as decimal, e.g. '2.0' for two whole tokens"),
    chainId: z.string().regex(/^\d+$/, 'chainId must be a decimal string'),
    tokenDecimals: z.number().int().min(0).max(36).optional().default(18),
    permitSymbol: z.string().optional().default('UNKNOWN'),
});
const depositParameters = baseInputs;
const withdrawParameters = baseInputs.extend({
    witness: z
        .string()
        .min(1)
        .describe('JSON string of L2ToL1MembershipWitness (root, leafIndex, siblingPath, epochNumber)'),
    callerOnL1: hexAddress.describe('L1 address passed as caller_on_l1 in exit_to_l1_private (often the wrapper)'),
});
export function createBridgeMcpServer() {
    const server = new FastMCP({
        name: 'overcast-bridge-tx-mcp',
        version: '1.0.0',
        instructions: 'Builds Markdown for StablecoinWrapper bridge transactions. Gas values are offline upper bounds (no RPC). ' +
            'Deposit claimData omits messageHash/messageLeafIndex until the bridge tx is mined and events are available.',
    });
    server.addTool({
        name: 'deposit',
        description: 'Encode StablecoinWrapper.bridgeToAztec and return MarkdownComponentRawTransactionWithPermit plus L1→L2 claim fields (secret + amount).',
        parameters: depositParameters,
        execute: async (args) => {
            const result = await buildDepositTransaction({
                tokenAddress: args.tokenAddress,
                wrapperAddress: args.wrapperAddress,
                userEvmAddress: args.userEvmAddress,
                userAztecAddress: args.userAztecAddress,
                amountDecimal: args.amount,
                chainId: args.chainId,
                tokenDecimals: args.tokenDecimals,
                permitSymbol: args.permitSymbol,
            });
            return JSON.stringify({
                markdown: result.markdown,
                claimData: result.claimData,
                approvalMarkdown: result.approvalMarkdown,
                bridgeArgs: result.bridgeArgs,
            }, null, 2);
        },
    });
    server.addTool({
        name: 'withdrawal',
        description: 'Encode StablecoinWrapper.withdrawFromL2ToL1 from a membership witness JSON string and return MarkdownComponentRawTransactionWithPermit.',
        parameters: withdrawParameters,
        execute: async (args) => {
            const result = buildWithdrawTransaction({
                wrapperAddress: args.wrapperAddress,
                userEvmAddress: args.userEvmAddress,
                userAztecAddress: args.userAztecAddress,
                amountDecimal: args.amount,
                chainId: args.chainId,
                tokenDecimals: args.tokenDecimals,
                witnessJson: args.witness,
                callerOnL1: args.callerOnL1,
            });
            return JSON.stringify({ markdown: result.markdown }, null, 2);
        },
    });
    return server;
}
