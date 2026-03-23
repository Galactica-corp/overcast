import { SponsoredFeePaymentMethod } from '@aztec/aztec.js/fee';
import { getSponsoredFPCInstance } from './sponsored_fpc.js';
import { SponsoredFPCContractArtifact } from '@aztec/noir-contracts.js/SponsoredFPC';
import { Fr } from '@aztec/aztec.js/fields';
import { GrumpkinScalar } from '@aztec/foundation/curves/grumpkin';
import { type Logger, createLogger } from '@aztec/foundation/log';
import { setupWallet } from './setup_wallet.js';
import { AztecAddress } from '@aztec/aztec.js/addresses';
import { AccountManager } from '@aztec/aztec.js/wallet';
import { EmbeddedWallet } from '@aztec/wallets/embedded';
import { getTimeouts } from '../../config/config.js';

function isEnvValueSet(value: string | undefined): boolean {
  return value !== undefined && value.trim() !== '';
}

/**
 * Re-register the Schnorr account contract with the PXE after the deploy tx lands.
 * Uses the in-memory instance from `AccountManager` (Aztec node `getContract` is not reliable for
 * account addresses on all networks). Needed so follow-up private calls can resolve public keys.
 */
export async function registerDeployedAccountWithPxe(
  wallet: EmbeddedWallet,
  account: AccountManager,
): Promise<void> {
  const instance = account.getInstance();
  const artifact = await (await account.getAccountContract()).getContractArtifact();
  await wallet.registerContract(instance, artifact, account.getSecretKey());
}

export async function deploySchnorrAccount(wallet?: EmbeddedWallet): Promise<AccountManager> {
  const logger: Logger = createLogger('overcast:private-stablecoin');
  const timeouts = getTimeouts();
  logger.info('Starting Schnorr account deployment...');

  const secretEnv = process.env.SECRET;
  const signingKeyEnv = process.env.SIGNING_KEY;
  const saltEnv = process.env.SALT;

  let secretKey: Fr;
  let signingKey: GrumpkinScalar;
  let salt: Fr;

  try {
    if (isEnvValueSet(secretEnv)) {
      secretKey = Fr.fromString(secretEnv!.trim());
    } else {
      secretKey = Fr.random();
    }
    if (isEnvValueSet(signingKeyEnv)) {
      signingKey = GrumpkinScalar.fromString(signingKeyEnv!.trim());
    } else {
      signingKey = GrumpkinScalar.random();
    }
    if (isEnvValueSet(saltEnv)) {
      salt = Fr.fromString(saltEnv!.trim());
    } else {
      salt = Fr.random();
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(
      `Invalid SECRET, SIGNING_KEY, or SALT in .env (expect hex strings, e.g. 0x…): ${message}`,
    );
  }

  const generated: string[] = [];
  if (!isEnvValueSet(secretEnv)) {
    generated.push(`SECRET="${secretKey.toString()}"`);
  }
  if (!isEnvValueSet(signingKeyEnv)) {
    generated.push(`SIGNING_KEY="${signingKey.toString()}"`);
  }
  if (!isEnvValueSet(saltEnv)) {
    generated.push(`SALT="${salt.toString()}"`);
  }
  if (generated.length > 0) {
    logger.info('Missing or empty SECRET, SIGNING_KEY, and/or SALT in .env; generated random values (add to .env to reuse):');
    for (const line of generated) {
      logger.info(line);
    }
  } else {
    logger.info('Using SECRET, SIGNING_KEY, and SALT from environment.');
  }

  const activeWallet = wallet ?? (await setupWallet());
  const account = await activeWallet.createSchnorrAccount(secretKey, salt, signingKey);
  logger.info(`Account address will be: ${account.address}`);

  const { isContractPublished, isContractInitialized } =
    await activeWallet.getContractMetadata(account.address);
  // `isContractPublished` uses the node's public contract registry; `isContractInitialized`
  // checks the siloed init nullifier. An account can be initialized (deploy tx landed) without
  // the former being set — redeploying would then fail with "Invalid tx: Existing nullifier".
  if (isContractPublished || isContractInitialized) {
    logger.info(
      'Account already exists on the network (skipping deployment transaction).',
    );
    await registerDeployedAccountWithPxe(activeWallet, account);
    return account;
  }

  const deployMethod = await account.getDeployMethod();

  logger.info('Setting up sponsored fee payment for account deployment...');
  const sponsoredFPC = await getSponsoredFPCInstance();
  logger.info(`Sponsored FPC at: ${sponsoredFPC.address}`);

  await activeWallet.registerContract(sponsoredFPC, SponsoredFPCContractArtifact);
  const sponsoredPaymentMethod = new SponsoredFeePaymentMethod(sponsoredFPC.address);

  // Match aztec-starter e2e: account deploy via send only (see their index.test.ts beforeAll).
  await deployMethod.send({
    from: AztecAddress.ZERO,
    fee: { paymentMethod: sponsoredPaymentMethod },
    wait: { timeout: timeouts.deployTimeout },
  });

  await registerDeployedAccountWithPxe(activeWallet, account);

  logger.info('Account deployment transaction completed.');
  return account;
}
