import { PrivateStablecoinContract } from '../src/artifacts/PrivateStablecoin.js';
import { type Logger, createLogger } from '@aztec/foundation/log';
import { SponsoredFeePaymentMethod } from '@aztec/aztec.js/fee';
import { setupWallet } from '../src/utils/setup_wallet.js';
import { getSponsoredFPCInstance } from '../src/utils/sponsored_fpc.js';
import { SponsoredFPCContractArtifact } from '@aztec/noir-contracts.js/SponsoredFPC';
import { deploySchnorrAccount } from '../src/utils/deploy_account.js';
import { getTimeouts } from '../config/config.js';

async function main() {
  const logger: Logger = createLogger('overcast:private-stablecoin:deploy');
  const timeouts = getTimeouts();

  logger.info('Starting PrivateStablecoin deployment...');

  const wallet = await setupWallet();
  logger.info('Wallet ready');

  const sponsoredFPC = await getSponsoredFPCInstance();
  await wallet.registerContract(sponsoredFPC, SponsoredFPCContractArtifact);
  const sponsoredPaymentMethod = new SponsoredFeePaymentMethod(sponsoredFPC.address);

  const account = await deploySchnorrAccount(wallet);
  const address = account.address;
  logger.info(`Admin account: ${address}`);

  const deployRequest = PrivateStablecoinContract.deployWithOpts(
    { wallet, method: 'constructor_with_minter' },
    'Overcast Stablecoin',
    'OS',
    18,
    address,
  );
  await deployRequest.simulate({ from: address });
  const { receipt } = await deployRequest.send({
    from: address,
    fee: { paymentMethod: sponsoredPaymentMethod },
    wait: { timeout: timeouts.deployTimeout, returnReceipt: true },
  });
  const token = receipt.contract;

  const initialSupply = 1000n;
  await token.methods.mint_to_public(address, initialSupply).simulate({ from: address });
  await token.methods.mint_to_public(address, initialSupply).send({
    from: address,
    fee: { paymentMethod: sponsoredPaymentMethod },
    wait: { timeout: timeouts.deployTimeout },
  });

  logger.info(`PrivateStablecoin deployed at: ${token.address}`);
}

main()
  .then(() => process.exit(0))
  .catch((error: Error) => {
    const logger = createLogger('overcast:private-stablecoin:deploy');
    logger.error(`Deployment failed: ${error.message}`);
    logger.error(error.stack ?? '');
    process.exit(1);
  });
