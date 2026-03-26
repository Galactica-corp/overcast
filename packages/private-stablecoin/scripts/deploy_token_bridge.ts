import { createLogger } from '@aztec/foundation/log';
import { setupWallet } from '../src/utils/setup_wallet.js';
import { deployTokenBridgeStack } from '../src/utils/deploy_token_bridge.js';
import { Fr } from '@aztec/aztec.js/fields';

async function main() {
  const logger = createLogger('overcast:deploy:token-bridge');
  const wallet = await setupWallet();
  const saltToken = process.env.BRIDGE_SALT_TOKEN ? Fr.fromString(process.env.BRIDGE_SALT_TOKEN.trim()) : undefined;
  const saltBridge = process.env.BRIDGE_SALT_BRIDGE ? Fr.fromString(process.env.BRIDGE_SALT_BRIDGE.trim()) : undefined;

  const result = await deployTokenBridgeStack({
    wallet,
    underlyingL1Address: process.env.L1_UNDERLYING_ADDRESS as `0x${string}` | undefined,
    saltToken,
    saltBridge,
  });

  logger.info('Deployment complete.');
  logger.info(`L1 underlying ERC20: ${result.underlying}`);
  logger.info(`L1 TokenPortal: ${result.tokenPortal}`);
  logger.info(`L1 StablecoinWrapper: ${result.stablecoinWrapper}`);
  logger.info(`L2 PrivateStablecoin: ${result.l2Token.toString()}`);
  logger.info(`L2 TokenBridge: ${result.l2Bridge.toString()}`);
}

main()
  .then(() => process.exit(0))
  .catch((err: Error) => {
    console.error(err.message);
    console.error(err.stack);
    process.exit(1);
  });
