import { PrivateStablecoinContract } from '../../artifacts/PrivateStablecoin.js';
import { SponsoredFeePaymentMethod } from '@aztec/aztec.js/fee';
import { deploySchnorrAccount } from '../../utils/deploy_account.js';
import { getSponsoredFPCInstance } from '../../utils/sponsored_fpc.js';
import { setupWallet } from '../../utils/setup_wallet.js';
import { SponsoredFPCContractArtifact } from '@aztec/noir-contracts.js/SponsoredFPC';
import { getTimeouts } from '../../../config/config.js';
import { type Logger, createLogger } from '@aztec/foundation/log';
import { type ContractInstanceWithAddress } from '@aztec/aztec.js/contracts';
import { EmbeddedWallet } from '@aztec/wallets/embedded';
import { AccountManager } from '@aztec/aztec.js/wallet';

const runAztecE2E = process.env.RUN_AZTEC_E2E === '1';

(runAztecE2E ? describe : describe.skip)('PrivateStablecoin (private stablecoin prototype, Aztec E2E)', () => {
  let logger: Logger;
  let sponsoredFPC: ContractInstanceWithAddress;
  let sponsoredPaymentMethod: SponsoredFeePaymentMethod;
  let wallet: EmbeddedWallet;
  let adminAccount: AccountManager;
  let contract: PrivateStablecoinContract;

  beforeAll(async () => {
    logger = createLogger('overcast:private-stablecoin:e2e');
    logger.info('E2E tests starting (requires local Aztec network).');

    wallet = await setupWallet();

    sponsoredFPC = await getSponsoredFPCInstance();
    await wallet.registerContract(sponsoredFPC, SponsoredFPCContractArtifact);
    sponsoredPaymentMethod = new SponsoredFeePaymentMethod(sponsoredFPC.address);

    adminAccount = await deploySchnorrAccount(wallet);
    await wallet.registerSender(adminAccount.address, 'admin');

    const deployRequest = PrivateStablecoinContract.deployWithOpts(
      { wallet, method: 'constructor_with_minter' },
      'Overcast Stablecoin',
      'OS',
      18,
      adminAccount.address,
    );
    const deployed = await deployRequest.send({
      from: adminAccount.address,
      fee: { paymentMethod: sponsoredPaymentMethod },
      wait: { timeout: getTimeouts().deployTimeout },
    });
    contract = deployed.contract;

    const initialSupply = 1000n;
    await contract.methods.mint_to_public(adminAccount.address, initialSupply).simulate({
      from: adminAccount.address,
    });
    await contract.methods.mint_to_public(adminAccount.address, initialSupply).send({
      from: adminAccount.address,
      fee: { paymentMethod: sponsoredPaymentMethod },
      wait: { timeout: getTimeouts().deployTimeout },
    });

    logger.info(`PrivateStablecoin deployed at ${contract.address.toString()}`);
  }, 600000);

  afterAll(async () => {
    await wallet?.stop?.();
  });

  it('deploys and reports the initial admin public balance via balance_of_public', async () => {
    expect(contract).toBeDefined();
    expect(contract.address).toBeDefined();

    const { result: balance } = await contract.methods
      .balance_of_public(adminAccount.address)
      .simulate({ from: adminAccount.address });

    expect(balance).toBe(1000n);
  }, 120000);
});
