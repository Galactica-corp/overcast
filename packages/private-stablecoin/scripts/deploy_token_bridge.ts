import { createLogger } from '@aztec/foundation/log';
import { setupWallet } from '../src/utils/setup_wallet.js';
import {
    deployTokenBridgeStack,
    loadStablecoinWrapperArtifact,
} from '../src/utils/deploy_token_bridge.js';
import { mintTestErc20To } from '../src/utils/bridge/stablecoin_cross_chain.js';
import { formatFrontendDeploymentConfig } from '../src/utils/frontend_deployment_config.js';
import { Fr } from '@aztec/aztec.js/fields';
import { getAddress, parseUnits } from 'viem';

const TEST_TOKEN_MINT_TO_ENV = 'L1_TEST_TOKEN_MINT_TO';
const TEST_TOKEN_MINT_AMOUNT = parseUnits('10000', 18);

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

async function main() {
    const logger = createLogger('overcast:deploy:token-bridge');
    const wallet = await setupWallet();
    const tokenName = getOptionalEnv('PRIVATE_STABLECOIN_NAME') ?? 'Overcast Stablecoin';
    const tokenSymbol = getOptionalEnv('PRIVATE_STABLECOIN_SYMBOL') ?? 'OS';
    const tokenDecimals = getDecimalsFromEnv('PRIVATE_STABLECOIN_DECIMALS', 18);
    const saltToken = getSaltFromEnv('BRIDGE_SALT_TOKEN') ?? Fr.random();
    const saltBridge = getSaltFromEnv('BRIDGE_SALT_BRIDGE') ?? Fr.random();
    const mintRecipient = process.env[TEST_TOKEN_MINT_TO_ENV]?.trim();

    const result = await deployTokenBridgeStack({
        wallet,
        underlyingL1Address: process.env.L1_UNDERLYING_ADDRESS as `0x${string}` | undefined,
        tokenName,
        tokenSymbol,
        tokenDecimals: BigInt(tokenDecimals),
        saltToken,
        saltBridge,
    });

    if (mintRecipient) {
        const normalizedMintRecipient = getAddress(mintRecipient);
        const testErc20Artifact = loadStablecoinWrapperArtifact('test/TestERC20.sol/TestERC20.json');

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
