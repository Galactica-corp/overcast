import { createLogger } from '@aztec/foundation/log';
import { createAztecNodeClient } from '@aztec/aztec.js/node';
import { Fr } from '@aztec/aztec.js/fields';
import { AztecAddress } from '@aztec/aztec.js/addresses';
import { generateClaimSecret } from '@aztec/aztec.js/ethereum';
import { FeeJuicePortalAbi } from '@aztec/l1-artifacts';
import { createExtendedL1Client } from '@aztec/ethereum/client';
import { extractEvent } from '@aztec/ethereum/utils';
import type { Abi } from 'viem';
import { parseEther, getAddress } from 'viem';

import { registerPrivateContract } from '@wonderland/aztec-fee-payment';
import { FeeJuiceContract } from '@aztec/noir-contracts.js/FeeJuice';

import { setupWallet } from '../src/utils/setup_wallet.js';
import { deploySchnorrAccount } from '../src/utils/deploy_account.js';
import { getAztecNodeUrl, getL1ChainId, getL1RpcUrl, getTimeouts } from '../config/config.js';

const TESTNET_MINT_CONTRACT = getAddress('0x5602c39A6E9C5AcE589F64F754927bcDa4f4BFc9');
const TESTNET_FEE_JUICE_TOKEN = getAddress('0x762C132040fdA6183066Fa3B14d985ee55aA3C18');
const MAINNET_FEE_JUICE_TOKEN = getAddress('0xA27EC0006e59f245217Ff08CD52A7E8b169E62D2');

const TESTNET_DEFAULT_AMOUNT = parseEther('1000');
const MAINNET_DEFAULT_AMOUNT = parseEther('10');

const ERC20_BALANCE_OF_ABI = [
    {
        inputs: [{ internalType: 'address', name: 'account', type: 'address' }],
        name: 'balanceOf',
        outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
        stateMutability: 'view',
        type: 'function',
    },
] as const satisfies Abi;

const TESTNET_MINT_ABI = [
    {
        inputs: [{ internalType: 'address', name: '_recipient', type: 'address' }],
        name: 'mint',
        outputs: [],
        stateMutability: 'nonpayable',
        type: 'function',
    },
] as const satisfies Abi;

function requiredEnv(name: string): string {
    const value = process.env[name]?.trim();
    if (!value) {
        throw new Error(`Missing required env var ${name}`);
    }
    return value;
}

function optionalEnv(name: string): string | undefined {
    const value = process.env[name]?.trim();
    return value ? value : undefined;
}

function isMainnetLike(chainId: number): boolean {
    return chainId === 1;
}

function isTestnetLike(chainId: number): boolean {
    return chainId === 11155111;
}

function parseAmountWei(chainId: number): bigint {
    const raw = optionalEnv('FEE_JUICE_AMOUNT_WEI');
    if (raw) {
        try {
            return BigInt(raw);
        } catch {
            throw new Error(`Invalid FEE_JUICE_AMOUNT_WEI: expected bigint string, got "${raw}"`);
        }
    }
    return isMainnetLike(chainId) ? MAINNET_DEFAULT_AMOUNT : TESTNET_DEFAULT_AMOUNT;
}

function getFeeJuiceTokenAddress(chainId: number): `0x${string}` {
    if (isMainnetLike(chainId)) {
        return MAINNET_FEE_JUICE_TOKEN;
    }
    if (isTestnetLike(chainId)) {
        return TESTNET_FEE_JUICE_TOKEN;
    }
    throw new Error(`Unsupported L1 chain id ${chainId} (expected 1 for mainnet or 11155111 for sepolia testnet).`);
}

function getFeeJuicePortalAddressFromNodeInfo(nodeInfo: any): `0x${string}` {
    const l1 = nodeInfo?.l1ContractAddresses;
    const candidates = [
        l1?.feeJuicePortalAddress,
        l1?.feeAssetPortalAddress,
        l1?.feeAssetPortal,
        l1?.feeJuicePortal,
    ];
    for (const c of candidates) {
        if (typeof c === 'string' && c.startsWith('0x')) {
            return getAddress(c) as `0x${string}`;
        }
        if (c && typeof c.toString === 'function') {
            const s = c.toString();
            if (typeof s === 'string' && s.startsWith('0x')) {
                return getAddress(s) as `0x${string}`;
            }
        }
    }
    throw new Error(
        `Could not determine FeeJuicePortal address from node_getNodeInfo().l1ContractAddresses; got keys: ${Object.keys(l1 ?? {}).join(', ')}`,
    );
}

function getFeeJuiceL2AddressFromNodeInfo(nodeInfo: any): AztecAddress {
    const l2 = nodeInfo?.l2ContractAddresses;
    const candidates = [
        l2?.feeJuiceAddress,
        l2?.feeJuiceContractAddress,
        l2?.feeJuice,
    ];
    for (const c of candidates) {
        if (typeof c === 'string' && c.startsWith('0x')) {
            return AztecAddress.fromString(c);
        }
        if (c && typeof c.toString === 'function') {
            const s = c.toString();
            if (typeof s === 'string' && s.startsWith('0x')) {
                return AztecAddress.fromString(s);
            }
        }
    }
    throw new Error(
        `Could not determine FeeJuice L2 address from node_getNodeInfo().l2ContractAddresses; got keys: ${Object.keys(l2 ?? {}).join(', ')}`,
    );
}

function extractDepositLeafIndexFromReceipt(opts: {
    logs: any[];
    portalAddress: `0x${string}`;
    secretHash: `0x${string}`;
}): bigint {
    const eventNames = ['DepositToAztecPublic'] as const;
    let lastError: unknown;
    for (const eventName of eventNames) {
        try {
            const decoded = extractEvent(
                opts.logs,
                opts.portalAddress,
                FeeJuicePortalAbi,
                eventName,
                (log) => {
                    const args = log.args as { secretHash?: `0x${string}` };
                    return args.secretHash?.toLowerCase() === opts.secretHash.toLowerCase();
                },
                undefined,
            );
            const args = decoded.args as unknown as { index?: bigint };
            if (typeof args.index === 'bigint') {
                return args.index;
            }
        } catch (err) {
            lastError = err;
        }
    }

    const message = lastError instanceof Error ? lastError.message : String(lastError ?? 'unknown');
    throw new Error(`Failed to extract leafIndex from FeeJuicePortal deposit event logs: ${message}`);
}

async function ensureFeeJuiceBalance(opts: {
    chainId: number;
    l1Client: ReturnType<typeof createExtendedL1Client>;
    token: `0x${string}`;
    depositor: `0x${string}`;
    amount: bigint;
    logger: ReturnType<typeof createLogger>;
}): Promise<void> {
    const current = (await opts.l1Client.readContract({
        address: opts.token,
        abi: ERC20_BALANCE_OF_ABI,
        functionName: 'balanceOf',
        args: [opts.depositor],
    })) as bigint;

    if (current >= opts.amount) {
        opts.logger.info(`FeeJuice balance OK: ${current.toString()} wei`);
        return;
    }

    if (isMainnetLike(opts.chainId)) {
        throw new Error(
            `Insufficient FeeJuice balance for depositor ${opts.depositor}. Need ${opts.amount.toString()} wei but have ${current.toString()} wei. ` +
                `On mainnet, fund the depositor with FeeJuice at ${opts.token} before running this script.`,
        );
    }

    if (!isTestnetLike(opts.chainId)) {
        throw new Error(`Unsupported L1 chain id ${opts.chainId} for auto-minting FeeJuice.`);
    }

    opts.logger.info('Minting FeeJuice on testnet...');
    const mintHash = await opts.l1Client.writeContract({
        address: TESTNET_MINT_CONTRACT,
        abi: TESTNET_MINT_ABI,
        functionName: 'mint',
        args: [opts.depositor],
    });
    await opts.l1Client.waitForTransactionReceipt({ hash: mintHash });

    const after = (await opts.l1Client.readContract({
        address: opts.token,
        abi: ERC20_BALANCE_OF_ABI,
        functionName: 'balanceOf',
        args: [opts.depositor],
    })) as bigint;

    if (after < opts.amount) {
        throw new Error(
            `Mint completed but FeeJuice balance is still insufficient. Need ${opts.amount.toString()} wei but have ${after.toString()} wei.`,
        );
    }

    opts.logger.info(`FeeJuice minted. New balance: ${after.toString()} wei`);
}

async function main() {
    const logger = createLogger('overcast:fee-juice:setup');
    const timeouts = getTimeouts();

    const chainId = getL1ChainId();
    const l1RpcUrl = optionalEnv('L1_RPC_URL') ?? getL1RpcUrl();
    const l1PrivateKey = requiredEnv('L1_PRIVATE_KEY');
    const amount = parseAmountWei(chainId);

    const salt = Fr.fromString(requiredEnv('PRIVATE_FPC_SALT'));

    const wallet = await setupWallet();
    const account = await deploySchnorrAccount(wallet);
    const claimerAddress = account.address;

    logger.info(`Using L1 chain id: ${chainId}`);
    logger.info(`Using L1 RPC: ${l1RpcUrl}`);
    logger.info(`Using claimer (L2): ${claimerAddress.toString()}`);

    const fpc = await registerPrivateContract(wallet, salt);
    logger.info(`Registered PrivateFPC: ${fpc.address.toString()}`);

    const [secret, secretHashFr] = await generateClaimSecret(undefined);

    const nodeUrl = getAztecNodeUrl();
    const node = createAztecNodeClient(nodeUrl);
    const nodeInfo = await node.getNodeInfo();
    const feeJuicePortal = getFeeJuicePortalAddressFromNodeInfo(nodeInfo);

    const l1Client = createExtendedL1Client([l1RpcUrl], l1PrivateKey as `0x${string}`);
    const depositorRaw = l1Client.account;
    if (!depositorRaw) {
        throw new Error('L1 client account missing (check L1_PRIVATE_KEY).');
    }
    const depositor = getAddress(typeof depositorRaw === 'string' ? depositorRaw : depositorRaw.address);
    const feeJuiceToken = getFeeJuiceTokenAddress(chainId);

    await ensureFeeJuiceBalance({
        chainId,
        l1Client,
        token: feeJuiceToken,
        depositor,
        amount,
        logger,
    });

    logger.info('Depositing FeeJuice to FeeJuicePortal...');
    const depositHash = await l1Client.writeContract({
        address: feeJuicePortal,
        abi: FeeJuicePortalAbi,
        functionName: 'depositToAztecPublic',
        args: [fpc.address.toString(), amount, secretHashFr.toString()],
    } as any);
    const receipt = await l1Client.waitForTransactionReceipt({ hash: depositHash });
    logger.info(`L1 deposit tx: ${receipt.transactionHash}`);

    const leafIndex = extractDepositLeafIndexFromReceipt({
        logs: receipt.logs,
        portalAddress: feeJuicePortal,
        secretHash: secretHashFr.toString() as `0x${string}`,
    });
    logger.info(`FeeJuicePortal leafIndex: ${leafIndex.toString()}`);

    const feeJuiceL2 = getFeeJuiceL2AddressFromNodeInfo(nodeInfo);
    const feeJuice = await FeeJuiceContract.at(feeJuiceL2, wallet);

    await feeJuice.methods.claim(fpc.address, amount, secret, leafIndex).send({
        from: claimerAddress,
        wait: { timeout: timeouts.txTimeout },
    });

    await fpc.methods.mint(amount, salt, leafIndex).send({
        from: claimerAddress,
        wait: { timeout: timeouts.txTimeout },
    });

    logger.info('FeeJuice setup complete. Parameters:');
    console.log(
        JSON.stringify(
            {
                privateFpcAddress: fpc.address.toString(),
                claimerAddress: claimerAddress.toString(),
                amountWei: amount.toString(),
                salt: salt.toString(),
                secret: secret.toString(),
                secretHash: secretHashFr.toString(),
                leafIndex: leafIndex.toString(),
                feeJuicePortal,
                feeJuiceToken,
            },
            null,
            2,
        ),
    );
}

main().catch((err: unknown) => {
    const message = err instanceof Error ? err.message : String(err);
    // eslint-disable-next-line no-console
    console.error(message);
    // eslint-disable-next-line no-console
    console.error(err instanceof Error ? err.stack : '');
    process.exit(1);
});

