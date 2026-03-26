import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { createAztecNodeClient } from '@aztec/aztec.js/node';
import { AztecAddress, EthAddress } from '@aztec/aztec.js/addresses';
import { getContractInstanceFromInstantiationParams } from '@aztec/aztec.js/contracts';
import { SponsoredFeePaymentMethod } from '@aztec/aztec.js/fee';
import { Fr } from '@aztec/aztec.js/fields';
import { createExtendedL1Client } from '@aztec/ethereum/client';
import { deployL1Contract } from '@aztec/ethereum/deploy-l1-contract';
import { SponsoredFPCContractArtifact } from '@aztec/noir-contracts.js/SponsoredFPC';
import type { Abi } from 'viem';
import { foundry, sepolia } from 'viem/chains';
import { padHex } from 'viem';

import { PrivateStablecoinContract, PrivateStablecoinContractArtifact } from '../artifacts/PrivateStablecoin.js';
import { TokenBridgeContract, TokenBridgeContractArtifact } from '../artifacts/TokenBridge.js';
import { getAztecNodeUrl, getL1ChainId, getL1RpcUrl, getTimeouts } from '../../config/config.js';
import { deploySchnorrAccount } from './deploy_account.js';
import { getSponsoredFPCInstance } from './sponsored_fpc.js';
import type { EmbeddedWallet } from '@aztec/wallets/embedded';
import type { AccountManager } from '@aztec/aztec.js/wallet';

const packageDir = dirname(fileURLToPath(import.meta.url));
const repoPackagesDir = join(packageDir, '../../..');
const stablecoinWrapperArtifacts = join(repoPackagesDir, 'stablecoin-wrapper/artifacts/contracts');

type SolidityArtifact = { abi: Abi; bytecode: string };

function loadL1Artifact(relativePath: string): SolidityArtifact {
  const full = join(stablecoinWrapperArtifacts, relativePath);
  const raw = JSON.parse(readFileSync(full, 'utf-8')) as SolidityArtifact;
  return raw;
}

function l1ChainForConfig() {
  const id = getL1ChainId();
  if (id === 11155111) {
    return sepolia;
  }
  return foundry;
}

export interface DeployTokenBridgeOptions {
  wallet: EmbeddedWallet;
  /** Defaults from env `L1_UNDERLYING_ADDRESS` or deploy `TestERC20`. */
  underlyingL1Address?: `0x${string}`;
  tokenName?: string;
  tokenSymbol?: string;
  tokenDecimals?: bigint;
  /** Fr hex string; random if unset. */
  saltToken?: Fr;
  saltBridge?: Fr;
}

export interface DeployedTokenBridgeStack {
  underlying: `0x${string}`;
  tokenPortal: `0x${string}`;
  stablecoinWrapper: `0x${string}`;
  l2Token: AztecAddress;
  l2Bridge: AztecAddress;
  deployer: AccountManager;
}

const DEFAULT_MNEMONIC =
  'test test test test test test test test test test test junk';

/**
 * Resolve (L2 token, L2 bridge) contract instance addresses where token minter is bridge and bridge references token + L1 portal.
 * Fixed-point iteration is required because both addresses depend on each other.
 */
export async function resolveTokenAndBridgeInstanceAddresses(
  saltToken: Fr,
  saltBridge: Fr,
  portalEth: EthAddress,
  name: string,
  symbol: string,
  decimals: bigint,
  admin: AztecAddress,
): Promise<{ tokenAddr: AztecAddress; bridgeAddr: AztecAddress }> {
  let bridgeAddr = AztecAddress.ZERO;
  for (let i = 0; i < 64; i++) {
    const tokenInst = await getContractInstanceFromInstantiationParams(PrivateStablecoinContractArtifact, {
      salt: saltToken,
      constructorArgs: [name, symbol, decimals, bridgeAddr, admin],
    });
    const tokenAddr = tokenInst.address;
    const bridgeInst = await getContractInstanceFromInstantiationParams(TokenBridgeContractArtifact, {
      salt: saltBridge,
      constructorArgs: [tokenAddr, portalEth],
    });
    const candidateBridge = bridgeInst.address;
    if (candidateBridge.equals(bridgeAddr)) {
      return { tokenAddr, bridgeAddr: candidateBridge };
    }
    bridgeAddr = candidateBridge;
  }
  throw new Error('Token/bridge address fixed point did not converge within 64 iterations');
}

/**
 * Full stack: L1 underlying + portal + wrapper init → L2 token + bridge (deterministic salts) → L1 portal init.
 */
export async function deployTokenBridgeStack(
  opts: DeployTokenBridgeOptions,
): Promise<DeployedTokenBridgeStack> {
  const timeouts = getTimeouts();
  const { wallet } = opts;
  const tokenName = opts.tokenName ?? 'Overcast Stablecoin';
  const tokenSymbol = opts.tokenSymbol ?? 'OS';
  const tokenDecimals = opts.tokenDecimals ?? 18n;

  const saltToken = opts.saltToken ?? Fr.random();
  const saltBridge = opts.saltBridge ?? Fr.random();

  const l1Rpc = getL1RpcUrl();
  const chain = l1ChainForConfig();
  const mnemonic = process.env.L1_MNEMONIC ?? DEFAULT_MNEMONIC;
  const l1Client = createExtendedL1Client(
    [l1Rpc],
    mnemonic,
    chain as Parameters<typeof createExtendedL1Client>[2],
  );

  const testErc20 = loadL1Artifact('test/TestERC20.sol/TestERC20.json');
  const tokenPortalArt = loadL1Artifact('TokenPortal.sol/TokenPortal.json');
  const wrapperArt = loadL1Artifact('StablecoinWrapper.sol/StablecoinWrapper.json');

  let underlying = opts.underlyingL1Address;
  if (!underlying) {
    const { address } = await deployL1Contract(
      l1Client,
      testErc20.abi,
      testErc20.bytecode as `0x${string}`,
      ['Mock USD', 'mUSD'],
    );
    underlying = address.toString() as `0x${string}`;
  }

  const { address: portalAddr } = await deployL1Contract(
    l1Client,
    tokenPortalArt.abi,
    tokenPortalArt.bytecode as `0x${string}`,
    [],
  );

  const { address: wrapperAddr } = await deployL1Contract(
    l1Client,
    wrapperArt.abi,
    wrapperArt.bytecode as `0x${string}`,
    [],
  );

  const initWrapperHash = await l1Client.writeContract({
    address: wrapperAddr.toString() as `0x${string}`,
    abi: wrapperArt.abi,
    functionName: 'initialize',
    args: [underlying, portalAddr.toString() as `0x${string}`],
  });
  await l1Client.waitForTransactionReceipt({ hash: initWrapperHash });

  const node = createAztecNodeClient(getAztecNodeUrl());
  const nodeInfo = await node.getNodeInfo();
  const registry = nodeInfo.l1ContractAddresses.registryAddress.toString() as `0x${string}`;
  const portalEth = EthAddress.fromString(portalAddr.toString());

  const sponsoredFPC = await getSponsoredFPCInstance();
  await wallet.registerContract(sponsoredFPC, SponsoredFPCContractArtifact);
  const sponsoredPaymentMethod = new SponsoredFeePaymentMethod(sponsoredFPC.address);

  const deployer = await deploySchnorrAccount(wallet);
  const admin = deployer.address;

  const { tokenAddr, bridgeAddr } = await resolveTokenAndBridgeInstanceAddresses(
    saltToken,
    saltBridge,
    portalEth,
    tokenName,
    tokenSymbol,
    tokenDecimals,
    admin,
  );

  const tokenDeploy = PrivateStablecoinContract.deployWithOpts(
    { wallet, method: 'constructor_with_minter' },
    tokenName,
    tokenSymbol,
    tokenDecimals,
    bridgeAddr,
    admin,
  );
  await tokenDeploy.simulate({ from: admin });
  const { receipt: tokenReceipt } = await tokenDeploy.send({
    from: admin,
    fee: { paymentMethod: sponsoredPaymentMethod },
    wait: { timeout: timeouts.deployTimeout, returnReceipt: true },
    contractAddressSalt: saltToken,
    universalDeploy: true,
  });
  const l2Token = tokenReceipt.contract.address;

  if (!l2Token.equals(tokenAddr)) {
    throw new Error(
      `Deployed token address ${l2Token.toString()} does not match preimage ${tokenAddr.toString()}`,
    );
  }

  const bridgeDeploy = TokenBridgeContract.deploy(wallet, l2Token, portalEth);
  await bridgeDeploy.simulate({ from: admin });
  const { receipt: bridgeReceipt } = await bridgeDeploy.send({
    from: admin,
    fee: { paymentMethod: sponsoredPaymentMethod },
    wait: { timeout: timeouts.deployTimeout, returnReceipt: true },
    contractAddressSalt: saltBridge,
    universalDeploy: true,
  });
  const l2Bridge = bridgeReceipt.contract.address;

  if (!l2Bridge.equals(bridgeAddr)) {
    throw new Error(
      `Deployed bridge address ${l2Bridge.toString()} does not match preimage ${bridgeAddr.toString()}`,
    );
  }

  const l2BridgeBytes32 = padHex(`0x${Buffer.from(l2Bridge.toBuffer()).toString('hex')}`, {
    size: 32,
  }) as `0x${string}`;

  const initPortalHash = await l1Client.writeContract({
    address: portalAddr.toString() as `0x${string}`,
    abi: tokenPortalArt.abi,
    functionName: 'initialize',
    args: [registry, l2BridgeBytes32],
  });
  await l1Client.waitForTransactionReceipt({ hash: initPortalHash });

  return {
    underlying,
    tokenPortal: portalAddr.toString() as `0x${string}`,
    stablecoinWrapper: wrapperAddr.toString() as `0x${string}`,
    l2Token,
    l2Bridge,
    deployer,
  };
}
