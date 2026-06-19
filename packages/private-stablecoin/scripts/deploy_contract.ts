import { PrivateStablecoinContract } from '../src/artifacts/PrivateStablecoin.js';
import { TokenBridgeContract } from '../src/artifacts/TokenBridge.js';
import { EthAddress } from '@aztec/aztec.js/addresses';
import { type Logger, createLogger } from '@aztec/foundation/log';
import { Fr } from '@aztec/aztec.js/fields';
import { setupWallet } from '../src/utils/setup_wallet.js';
import { deploySchnorrAccount } from '../src/utils/deploy_account.js';
import { getTimeouts } from '../config/config.js';
import { formatFrontendDeploymentConfig } from '../src/utils/frontend_deployment_config.js';
import { getFeePaymentMethodForTxFees } from '../src/utils/fpc.js';

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
    const logger: Logger = createLogger('overcast:private-stablecoin:deploy');
    const timeouts = getTimeouts();

    logger.info('Starting PrivateStablecoin deployment...');

    const wallet = await setupWallet();
    logger.info('Wallet ready');

    const { paymentMethod } = await getFeePaymentMethodForTxFees(wallet);

    const account = await deploySchnorrAccount(wallet);
    const address = account.address;
    logger.info(`Admin account: ${address}`);

    const tokenName = getOptionalEnv('PRIVATE_STABLECOIN_NAME') ?? 'Overcast Stablecoin';
    const tokenSymbol = getOptionalEnv('PRIVATE_STABLECOIN_SYMBOL') ?? 'OS';
    const tokenDecimals = getDecimalsFromEnv('PRIVATE_STABLECOIN_DECIMALS', 18);
    const tokenSalt = getSaltFromEnv('PRIVATE_STABLECOIN_SALT') ?? Fr.random();
    const tokenPortalAddress = getOptionalEnv('TOKEN_PORTAL_ADDRESS');
    const bridgeSalt = tokenPortalAddress
        ? getSaltFromEnv('TOKEN_BRIDGE_SALT') ?? Fr.random()
        : undefined;

    const deployRequest = PrivateStablecoinContract.deployWithOpts(
        { wallet, method: 'constructor_with_minter' },
        tokenName,
        tokenSymbol,
        tokenDecimals,
        address,
    );
    await deployRequest.simulate({ from: address });
    const { contract: token } = await deployRequest.send({
        from: address,
        fee: { paymentMethod },
        wait: { timeout: timeouts.deployTimeout },
        contractAddressSalt: tokenSalt,
        universalDeploy: true,
    });

    const initialSupply = 1000n;
    await token.methods.mint_to_public(address, initialSupply).simulate({ from: address });
    await token.methods.mint_to_public(address, initialSupply).send({
        from: address,
        fee: { paymentMethod },
        wait: { timeout: timeouts.deployTimeout },
    });

    logger.info(`PrivateStablecoin deployed at: ${token.address}`);

    if (!tokenPortalAddress || !bridgeSalt) {
        logger.info(
            'Set TOKEN_PORTAL_ADDRESS to also deploy TokenBridge and print the frontend deployment config.',
        );
        return;
    }

    const portalAddress = EthAddress.fromString(tokenPortalAddress);
    const bridgeDeploy = TokenBridgeContract.deploy(wallet, token.address, portalAddress);
    await bridgeDeploy.simulate({ from: address });
    const { contract: bridge } = await bridgeDeploy.send({
        from: address,
        fee: { paymentMethod },
        wait: { timeout: timeouts.deployTimeout },
        contractAddressSalt: bridgeSalt,
        universalDeploy: true,
    });

    await token.methods.set_minter(bridge.address).simulate({ from: address });
    await token.methods.set_minter(bridge.address).send({
        from: address,
        fee: { paymentMethod },
        wait: { timeout: timeouts.deployTimeout },
    });

    logger.info(`TokenBridge deployed at: ${bridge.address}`);
    logger.info('Frontend deployment config:');
    console.log(
        formatFrontendDeploymentConfig({
            tokenBridgeContract: {
                address: bridge.address.toString(),
                salt: bridgeSalt.toString(),
            },
            tokenBridgeConstructorArgs: {
                tokenAddress: token.address.toString(),
                portalAddress: tokenPortalAddress,
            },
            privateStablecoinContract: {
                address: token.address.toString(),
                salt: tokenSalt.toString(),
            },
            privateStablecoinConstructorArgs: {
                name: tokenName,
                symbol: tokenSymbol,
                decimals: tokenDecimals,
                adminAddress: address.toString(),
            },
        }),
    );
}

main()
    .then(() => process.exit(0))
    .catch((error: Error) => {
        const logger = createLogger('overcast:private-stablecoin:deploy');
        logger.error(`Deployment failed: ${error.message}`);
        logger.error(error.stack ?? '');
        process.exit(1);
    });
