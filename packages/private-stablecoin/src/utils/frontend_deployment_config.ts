export interface FrontendContractDeployment {
    address: string;
    salt: string;
}

export interface FrontendTokenBridgeConstructorArgs {
    tokenAddress: string;
    portalAddress: string;
}

export interface FrontendPrivateStablecoinConstructorArgs {
    name: string;
    symbol: string;
    decimals: number;
    adminAddress: string;
}

export interface FrontendDeploymentConfig {
    tokenBridgeContract: FrontendContractDeployment;
    tokenBridgeConstructorArgs: FrontendTokenBridgeConstructorArgs;
    privateStablecoinContract: FrontendContractDeployment;
    privateStablecoinConstructorArgs: FrontendPrivateStablecoinConstructorArgs;
}

export function createFrontendDeploymentConfig(
    config: FrontendDeploymentConfig,
): FrontendDeploymentConfig {
    return {
        tokenBridgeContract: {
            address: config.tokenBridgeContract.address,
            salt: config.tokenBridgeContract.salt,
        },
        tokenBridgeConstructorArgs: {
            tokenAddress: config.tokenBridgeConstructorArgs.tokenAddress,
            portalAddress: config.tokenBridgeConstructorArgs.portalAddress,
        },
        privateStablecoinContract: {
            address: config.privateStablecoinContract.address,
            salt: config.privateStablecoinContract.salt,
        },
        privateStablecoinConstructorArgs: {
            name: config.privateStablecoinConstructorArgs.name,
            symbol: config.privateStablecoinConstructorArgs.symbol,
            decimals: config.privateStablecoinConstructorArgs.decimals,
            adminAddress: config.privateStablecoinConstructorArgs.adminAddress,
        },
    };
}

export function formatFrontendDeploymentConfig(config: FrontendDeploymentConfig): string {
    return JSON.stringify(createFrontendDeploymentConfig(config), null, 2);
}
