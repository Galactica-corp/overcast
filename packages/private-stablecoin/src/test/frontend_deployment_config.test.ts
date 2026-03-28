import {
    createFrontendDeploymentConfig,
    formatFrontendDeploymentConfig,
} from '../utils/frontend_deployment_config.js';

describe('frontend deployment config formatting', () => {
    it('preserves the frontend payload shape and key order', () => {
        const config = createFrontendDeploymentConfig({
            tokenBridgeContract: {
                address: '0x1111',
                salt: '0x2222',
            },
            tokenBridgeConstructorArgs: {
                tokenAddress: '0x3333',
                portalAddress: '0x4444',
            },
            privateStablecoinContract: {
                address: '0x5555',
                salt: '0x6666',
            },
            privateStablecoinConstructorArgs: {
                name: 'Private Stablecoin',
                symbol: 'STBL',
                decimals: 18,
                adminAddress: '0x7777',
            },
        });

        expect(config).toEqual({
            tokenBridgeContract: {
                address: '0x1111',
                salt: '0x2222',
            },
            tokenBridgeConstructorArgs: {
                tokenAddress: '0x3333',
                portalAddress: '0x4444',
            },
            privateStablecoinContract: {
                address: '0x5555',
                salt: '0x6666',
            },
            privateStablecoinConstructorArgs: {
                name: 'Private Stablecoin',
                symbol: 'STBL',
                decimals: 18,
                adminAddress: '0x7777',
            },
        });

        expect(formatFrontendDeploymentConfig(config)).toBe(`{
  "tokenBridgeContract": {
    "address": "0x1111",
    "salt": "0x2222"
  },
  "tokenBridgeConstructorArgs": {
    "tokenAddress": "0x3333",
    "portalAddress": "0x4444"
  },
  "privateStablecoinContract": {
    "address": "0x5555",
    "salt": "0x6666"
  },
  "privateStablecoinConstructorArgs": {
    "name": "Private Stablecoin",
    "symbol": "STBL",
    "decimals": 18,
    "adminAddress": "0x7777"
  }
}`);
    });
});
