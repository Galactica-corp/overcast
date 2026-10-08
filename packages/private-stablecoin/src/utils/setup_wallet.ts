import { createAztecNodeClient } from '@aztec-labs/aztec.js/node';
import { getAztecNodeUrl } from '../../config/config.js';
import { EmbeddedWallet } from '@aztec-labs/wallets/embedded';

export async function setupWallet(): Promise<EmbeddedWallet> {
  const nodeUrl = getAztecNodeUrl();
  const node = createAztecNodeClient(nodeUrl);
  const wallet = await EmbeddedWallet.create(node, {
    ephemeral: true,
    // Local + remote testnet: prover helps PXE resolve account keys for private calls (e.g. PrivateToken admin note).
    pxeConfig: { proverEnabled: true },
  });
  return wallet;
}
