import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { padHex } from 'viem';
import type { Abi } from 'viem';
import { TokenBridgeContract } from '../../artifacts/TokenBridge.js';
import { PrivateStablecoinContract } from '../../artifacts/PrivateStablecoin.js';
import { setupWallet } from '../../utils/setup_wallet.js';
import { deployTokenBridgeStack } from '../../utils/deploy_token_bridge.js';
import { getSponsoredFPCInstance } from '../../utils/sponsored_fpc.js';
import { SponsoredFPCContractArtifact } from '@aztec/noir-contracts.js/SponsoredFPC';
import { createLogger } from '@aztec/foundation/log';
import { EthAddress } from '@aztec/aztec.js/addresses';
import { Fr } from '@aztec/aztec.js/fields';

const runBridge = process.env.RUN_AZTEC_E2E === '1';

const e2eDir = dirname(fileURLToPath(import.meta.url));
const packageRoot = join(e2eDir, '../../..');
const stablecoinArtifacts = join(packageRoot, '../stablecoin-wrapper/artifacts/contracts');

function loadAbi(rel: string): Abi {
  const j = JSON.parse(readFileSync(join(stablecoinArtifacts, rel), 'utf-8')) as { abi: Abi };
  return j.abi;
}

/** Simulate return for EthAddress is a plain `{ inner }` struct, not `EthAddress` (unlike AztecAddress). */
function ethAddressFromSimulate(value: unknown): EthAddress {
  if (value instanceof EthAddress) {
    return value;
  }
  if (value !== null && typeof value === 'object' && 'inner' in value) {
    const inner = (value as { inner: bigint | Fr }).inner;
    return EthAddress.fromField(inner instanceof Fr ? inner : new Fr(inner));
  }
  throw new Error('Unexpected EthAddress value from contract simulate');
}

(runBridge ? describe : describe.skip)('Token bridge stack deploy (Aztec E2E)', () => {
  const logger = createLogger('overcast:token-bridge-deploy:e2e');

  it('deploys L1 portal/wrapper, L2 token/bridge, and initializes portal wiring', async () => {
    const wallet = await setupWallet();
    const sponsoredFPC = await getSponsoredFPCInstance();
    await wallet.registerContract(sponsoredFPC, SponsoredFPCContractArtifact);

    const stack = await deployTokenBridgeStack({ wallet });

    logger.info(`L2 token ${stack.l2Token.toString()} bridge ${stack.l2Bridge.toString()}`);

    const tokenPortalAbi = loadAbi('TokenPortal.sol/TokenPortal.json');
    const wrapperAbi = loadAbi('StablecoinWrapper.sol/StablecoinWrapper.json');

    const l1 = stack.l1Client;

    const registryOnChain = (await l1.readContract({
      address: stack.tokenPortal,
      abi: tokenPortalAbi,
      functionName: 'registry',
    })) as `0x${string}`;
    const l2BridgeStored = (await l1.readContract({
      address: stack.tokenPortal,
      abi: tokenPortalAbi,
      functionName: 'l2Bridge',
    })) as `0x${string}`;
    const rollupVersion = (await l1.readContract({
      address: stack.tokenPortal,
      abi: tokenPortalAbi,
      functionName: 'rollupVersion',
    })) as bigint;

    expect(registryOnChain).toMatch(/^0x[0-9a-fA-F]{40}$/);
    expect(rollupVersion).toBeGreaterThan(0n);
    expect(l2BridgeStored).toBe(
      padHex(`0x${Buffer.from(stack.l2Bridge.toBuffer()).toString('hex')}`, { size: 32 }),
    );

    const underlying = (await l1.readContract({
      address: stack.stablecoinWrapper,
      abi: wrapperAbi,
      functionName: 'underlyingToken',
    })) as `0x${string}`;
    const portalRef = (await l1.readContract({
      address: stack.stablecoinWrapper,
      abi: wrapperAbi,
      functionName: 'tokenPortal',
    })) as `0x${string}`;
    expect(underlying.toLowerCase()).toBe(stack.underlying.toLowerCase());
    expect(portalRef.toLowerCase()).toBe(stack.tokenPortal.toLowerCase());

    const bridge = await TokenBridgeContract.at(stack.l2Bridge, wallet);
    const token = await PrivateStablecoinContract.at(stack.l2Token, wallet);

    const { result: bridgeToken } = await bridge.methods.get_token().simulate({ from: stack.deployer.address });
    const { result: bridgePortal } = await bridge.methods.get_portal().simulate({ from: stack.deployer.address });

    expect(bridgeToken.toString()).toBe(stack.l2Token.toString());
    expect(ethAddressFromSimulate(bridgePortal).toString().toLowerCase()).toBe(
      stack.tokenPortal.toLowerCase(),
    );

    const { result: name } = await token.methods.name().simulate({ from: stack.deployer.address });
    expect(name).toBeDefined();

    await wallet.stop?.();
  }, 600000);
});
