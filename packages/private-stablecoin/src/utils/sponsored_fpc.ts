import { Fr } from '@aztec-labs/aztec.js/fields';
import {
  getContractInstanceFromInstantiationParams,
  type ContractInstanceWithAddress,
} from '@aztec-labs/aztec.js/contracts';
import type { Wallet } from '@aztec-labs/aztec.js/wallet';
import type { LogFn } from '@aztec-labs/foundation/log';
import {
  SponsoredFPCContract,
  SponsoredFPCContractArtifact,
} from '@aztec-labs/noir-contracts.js/SponsoredFPC';
import { SPONSORED_FPC_SALT } from '@aztec-labs/constants';

export async function getSponsoredFPCInstance(): Promise<ContractInstanceWithAddress> {
  return await getContractInstanceFromInstantiationParams(SponsoredFPCContractArtifact, {
    salt: new Fr(SPONSORED_FPC_SALT),
  });
}

export async function getSponsoredFPCAddress() {
  return (await getSponsoredFPCInstance()).address;
}

export async function setupSponsoredFPC(deployer: Wallet, log: LogFn) {
  const [{ item: from }] = await deployer.getAccounts();
  const deployRequest = SponsoredFPCContract.deploy(deployer, {
    salt: new Fr(SPONSORED_FPC_SALT),
    universalDeploy: true,
  });
  await deployRequest.simulate({ from });
  const deployed = await deployRequest.send({
    from,
  });

  log(`SponsoredFPC: ${deployed.contract.address}`);
}
