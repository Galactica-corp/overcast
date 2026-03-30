import { createLogger } from '@aztec/foundation/log';
import { SponsoredFeePaymentMethod } from '@aztec/aztec.js/fee';
import { setupWallet } from '../src/utils/setup_wallet.js';
import {
    deployTokenBridgeStack,
    loadStablecoinWrapperArtifact,
} from '../src/utils/deploy_token_bridge.js';
import {
    advanceLocalChainThenWaitForL1MessageReady,
    bridgeStablecoinToAztecPrivate,
    mintTestErc20To,
} from '../src/utils/bridge/stablecoin_cross_chain.js';
import { formatFrontendDeploymentConfig } from '../src/utils/frontend_deployment_config.js';
import { getTimeouts } from '../config/config.js';
import { getSponsoredFPCInstance } from '../src/utils/sponsored_fpc.js';
import { Fr } from '@aztec/aztec.js/fields';
import { getAddress, parseEther, parseUnits } from 'viem';

const TEST_TOKEN_MINT_TO_ENV = 'L1_TEST_TOKEN_MINT_TO';
const TEST_NATIVE_GAS_ETH_ENV = 'L1_TEST_TOKEN_NATIVE_GAS_ETH';
const TEST_TOKEN_MINT_AMOUNT = parseUnits('10000', 18);
const DEFAULT_TEST_NATIVE_GAS_AMOUNT = parseEther('0.01');
const CREATOR_BRIDGE_AMOUNT = parseUnits('1000', 18);
const BRIDGE_CLAIM_RECIPIENT = '0x1250c3a3217014e521e5ec9bf906b2f6bd09fe74ee6fdbf6c02aa6e80baef546';

function getOptionalEnv(name: string): string | undefined {
    const value = process.env[name]?.trim();
    return value ? value : undefined;
}

function getSaltFromEnv(name: string): Fr | undefined {
    const value = getOptionalEnv(name);
    return value ? Fr.fromString(value) : undefined;
}

function getDecimalsFromEnv(name: string, fallback: number): number {
    const value = getOptionalEnv(name);
    if (!value) {
        return fallback;
    }

    const parsed = Number.parseInt(value, 10);
    if (!Number.isSafeInteger(parsed) || parsed < 0) {
        throw new Error(`Invalid ${name}: expected a non-negative integer, received "${value}"`);
    }

    return parsed;
}

function getNativeGasAmount(): bigint {
    const value = getOptionalEnv(TEST_NATIVE_GAS_ETH_ENV);
    if (!value) {
        return DEFAULT_TEST_NATIVE_GAS_AMOUNT;
    }

    return parseEther(value);
}

async function main() {
    const logger = createLogger('overcast:deploy:token-bridge');
    const wallet = await setupWallet();
    const timeouts = getTimeouts();
    const tokenName = getOptionalEnv('PRIVATE_STABLECOIN_NAME') ?? 'Overcast Stablecoin';
    const tokenSymbol = getOptionalEnv('PRIVATE_STABLECOIN_SYMBOL') ?? 'OS';
    const tokenDecimals = getDecimalsFromEnv('PRIVATE_STABLECOIN_DECIMALS', 18);
    const saltToken = getSaltFromEnv('BRIDGE_SALT_TOKEN') ?? Fr.random();
    const saltBridge = getSaltFromEnv('BRIDGE_SALT_BRIDGE') ?? Fr.random();
    const mintRecipient = process.env[TEST_TOKEN_MINT_TO_ENV]?.trim();
    const nativeGasAmount = getNativeGasAmount();

    const result = await deployTokenBridgeStack({
        wallet,
        underlyingL1Address: process.env.L1_UNDERLYING_ADDRESS as `0x${string}` | undefined,
        tokenName,
        tokenSymbol,
        tokenDecimals: BigInt(tokenDecimals),
        saltToken,
        saltBridge,
    });

    const [creatorAddressRaw] = await result.l1Client.getAddresses();
    if (!creatorAddressRaw) {
        throw new Error('L1 creator account is required to mint and bridge the test tokens.');
    }

    const creatorAddress = getAddress(creatorAddressRaw as `0x${string}`);
    const testErc20Artifact = loadStablecoinWrapperArtifact('test/TestERC20.sol/TestERC20.json');
    const wrapperArtifact = loadStablecoinWrapperArtifact('StablecoinWrapper.sol/StablecoinWrapper.json');
    const tokenPortalArtifact = loadStablecoinWrapperArtifact('TokenPortal.sol/TokenPortal.json');

    await mintTestErc20To(
        result.l1Client,
        result.underlying,
        testErc20Artifact.abi,
        creatorAddress,
        CREATOR_BRIDGE_AMOUNT,
    );
    logger.info(
        `Minted ${CREATOR_BRIDGE_AMOUNT.toString()} test tokens to creator account ${creatorAddress}.`,
    );

    const claim = await bridgeStablecoinToAztecPrivate({
        l1ClientAlice: result.l1Client,
        underlying: result.underlying,
        stablecoinWrapper: result.stablecoinWrapper,
        tokenPortal: result.tokenPortal,
        testErc20Abi: testErc20Artifact.abi,
        wrapperAbi: wrapperArtifact.abi,
        tokenPortalAbi: tokenPortalArtifact.abi,
        amount: CREATOR_BRIDGE_AMOUNT,
    });
    logger.info(
        `Bridged ${CREATOR_BRIDGE_AMOUNT.toString()} test tokens from ${creatorAddress} for Aztec claim recipient ${BRIDGE_CLAIM_RECIPIENT}.`,
    );

    const sponsoredFPC = await getSponsoredFPCInstance();
    const sponsoredPaymentMethod = new SponsoredFeePaymentMethod(sponsoredFPC.address);
    const waitL1ReadySec = Math.max(300, Math.ceil(timeouts.waitTimeout / 1000));

    await advanceLocalChainThenWaitForL1MessageReady({
        node: result.aztecNode,
        messageHash: claim.messageHash,
        l1Client: result.l1Client,
        wallet,
        l2Token: result.l2Token,
        tokenPortalL1: result.tokenPortal,
        from: result.deployer.address,
        sponsoredPaymentMethod,
        txTimeout: timeouts.txTimeout,
        waitTimeoutSeconds: waitL1ReadySec,
    });
    logger.info(`Bridge deposit is ready to claim for ${BRIDGE_CLAIM_RECIPIENT}.`);
    logger.info('Claim secrets and parameters:');
    console.log(
        JSON.stringify(
            {
                aztecRecipient: BRIDGE_CLAIM_RECIPIENT,
                claimAmount: claim.claimAmount.toString(),
                claimSecret: claim.claimSecret.toString(),
                messageHash: claim.messageHash.toString(),
                messageLeafIndex: claim.messageLeafIndex.toString(),
            },
            null,
            2,
        ),
    );

    if (mintRecipient) {
        const normalizedMintRecipient = getAddress(mintRecipient);

        await mintTestErc20To(
            result.l1Client,
            result.underlying,
            testErc20Artifact.abi,
            normalizedMintRecipient,
            TEST_TOKEN_MINT_AMOUNT,
        );

        logger.info(
            `Minted ${TEST_TOKEN_MINT_AMOUNT.toString()} test tokens to ${normalizedMintRecipient}.`,
        );

        if (nativeGasAmount > 0n) {
            const nativeFundingHash = await result.l1Client.sendTransaction({
                to: normalizedMintRecipient,
                value: nativeGasAmount,
            });
            await result.l1Client.waitForTransactionReceipt({ hash: nativeFundingHash });

            logger.info(
                `Sent ${nativeGasAmount.toString()} native gas wei to ${normalizedMintRecipient}.`,
            );
        }
    }

    logger.info('Deployment complete.');
    logger.info(`L1 underlying ERC20: ${result.underlying}`);
    logger.info(`L1 TokenPortal: ${result.tokenPortal}`);
    logger.info(`L1 StablecoinWrapper: ${result.stablecoinWrapper}`);
    logger.info(`L2 PrivateStablecoin: ${result.l2Token.toString()}`);
    logger.info(`L2 TokenBridge: ${result.l2Bridge.toString()}`);
    logger.info('Frontend deployment config:');
    console.log(
        formatFrontendDeploymentConfig({
            tokenBridgeContract: {
                address: result.l2Bridge.toString(),
                salt: saltBridge.toString(),
            },
            tokenBridgeConstructorArgs: {
                tokenAddress: result.l2Token.toString(),
                portalAddress: result.tokenPortal,
            },
            privateStablecoinContract: {
                address: result.l2Token.toString(),
                salt: saltToken.toString(),
            },
            privateStablecoinConstructorArgs: {
                name: tokenName,
                symbol: tokenSymbol,
                decimals: tokenDecimals,
                adminAddress: result.deployer.address.toString(),
            },
        }),
    );
}

main()
    .then(() => process.exit(0))
    .catch((err: Error) => {
        console.error(err.message);
        console.error(err.stack);
        process.exit(1);
    });
