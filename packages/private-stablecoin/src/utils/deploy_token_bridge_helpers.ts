import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { createAztecNodeClient, type AztecNode } from '@aztec/aztec.js/node';
import { EthAddress } from '@aztec/aztec.js/addresses';
import { createExtendedL1Client } from '@aztec/ethereum/client';
import { deployL1Contract } from '@aztec/ethereum/deploy-l1-contract';
import type { ExtendedViemWalletClient } from '@aztec/ethereum/types';
import type { Abi } from 'viem';
import { foundry, sepolia } from 'viem/chains';
import { padHex } from 'viem';

import { PrivateStablecoinContract } from '../artifacts/PrivateStablecoin.js';
import { TokenBridgeContract } from '../artifacts/TokenBridge.js';
import { getAztecNodeUrl, getL1ChainId, getL1RpcUrl, getTimeouts } from '../../config/config.js';
import { deploySchnorrAccount } from './deploy_account.js';
import { getSponsoredFPCInstance } from './sponsored_fpc.js';
import { SponsoredFeePaymentMethod } from '@aztec/aztec.js/fee';
import { SponsoredFPCContractArtifact } from '@aztec/noir-contracts.js/SponsoredFPC';
import { Fr } from '@aztec/aztec.js/fields';
import type { EmbeddedWallet } from '@aztec/wallets/embedded';
import type { AccountManager } from '@aztec/aztec.js/wallet';
import type { AztecAddress } from '@aztec/aztec.js/addresses';
const packageDir = dirname(fileURLToPath(import.meta.url));
const repoPackagesDir = join(packageDir, '../../..');
export const STABLECOIN_WRAPPER_ARTIFACTS_DIR = join(repoPackagesDir, 'stablecoin-wrapper/artifacts/contracts');

export type SolidityArtifact = { abi: Abi; bytecode: string };

export function loadStablecoinWrapperArtifact(relativePath: string): SolidityArtifact {
  const full = join(STABLECOIN_WRAPPER_ARTIFACTS_DIR, relativePath);
  const raw = JSON.parse(readFileSync(full, 'utf-8')) as SolidityArtifact;
  return raw;
}

const DEFAULT_MNEMONIC = 'test test test test test test test test test test test junk';

export function l1ChainForConfig(): typeof foundry | typeof sepolia {
  const id = getL1ChainId();
  if (id === 11155111) {
    return sepolia;
  }
  return foundry;
}

/**
 * Extended L1 viem client using repo config (RPC, chain id) and optional `L1_MNEMONIC`.
 */
export function createL1ClientFromConfig(
  addressIndex?: number,
): ExtendedViemWalletClient {
  const l1Rpc = getL1RpcUrl();
  const chain = l1ChainForConfig();
  const mnemonic = process.env.L1_MNEMONIC ?? DEFAULT_MNEMONIC;
  return createExtendedL1Client(
    [l1Rpc],
    mnemonic,
    chain as Parameters<typeof createExtendedL1Client>[2],
    undefined,
    addressIndex,
  );
}

export interface DeployL1StackOptions {
  l1Client: ExtendedViemWalletClient;
  underlyingL1Address?: `0x${string}`;
}

export interface DeployL1StackResult {
  underlying: `0x${string}`;
  tokenPortal: `0x${string}`;
  stablecoinWrapper: `0x${string}`;
  testErc20Artifact: SolidityArtifact;
  tokenPortalArtifact: SolidityArtifact;
  wrapperArtifact: SolidityArtifact;
}

/**
 * Deploy TestERC20 (unless underlying provided), TokenPortal, StablecoinWrapper, and initialize the wrapper.
 */
export async function deployL1UnderlyingPortalWrapper(
  opts: DeployL1StackOptions,
): Promise<DeployL1StackResult> {
  const { l1Client } = opts;
  const testErc20 = loadStablecoinWrapperArtifact('test/TestERC20.sol/TestERC20.json');
  const tokenPortalArt = loadStablecoinWrapperArtifact('TokenPortal.sol/TokenPortal.json');
  const wrapperArt = loadStablecoinWrapperArtifact('StablecoinWrapper.sol/StablecoinWrapper.json');

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

  return {
    underlying,
    tokenPortal: portalAddr.toString() as `0x${string}`,
    stablecoinWrapper: wrapperAddr.toString() as `0x${string}`,
    testErc20Artifact: testErc20,
    tokenPortalArtifact: tokenPortalArt,
    wrapperArtifact: wrapperArt,
  };
}

export interface DeployL2TokenBridgeOptions {
  wallet: EmbeddedWallet;
  tokenName: string;
  tokenSymbol: string;
  tokenDecimals: bigint;
  saltToken: Fr;
  saltBridge: Fr;
  portalEth: EthAddress;
}

export interface DeployL2TokenBridgeResult {
  deployer: AccountManager;
  l2Token: AztecAddress;
  l2Bridge: AztecAddress;
}

/**
 * Register sponsored FPC, deploy Schnorr deployer, deploy L2 token + bridge, set bridge as minter.
 */
export async function deployL2PrivateStablecoinAndBridge(
  opts: DeployL2TokenBridgeOptions,
): Promise<DeployL2TokenBridgeResult> {
  const timeouts = getTimeouts();
  const { wallet, tokenName, tokenSymbol, tokenDecimals, saltToken, saltBridge, portalEth } = opts;

  const sponsoredFPC = await getSponsoredFPCInstance();
  await wallet.registerContract(sponsoredFPC, SponsoredFPCContractArtifact);
  const sponsoredPaymentMethod = new SponsoredFeePaymentMethod(sponsoredFPC.address);

  const deployer = await deploySchnorrAccount(wallet);
  const admin = deployer.address;

  const tokenDeploy = PrivateStablecoinContract.deployWithOpts(
    { wallet, method: 'constructor_with_minter' },
    tokenName,
    tokenSymbol,
    tokenDecimals,
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
  const tokenContract = tokenReceipt.contract;
  const l2Token = tokenContract.address;

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

  await tokenContract.methods.set_minter(l2Bridge).simulate({ from: admin });
  await tokenContract.methods.set_minter(l2Bridge).send({
    from: admin,
    fee: { paymentMethod: sponsoredPaymentMethod },
    wait: { timeout: timeouts.deployTimeout },
  });

  return {
    deployer,
    l2Token,
    l2Bridge,
  };
}

export interface InitializePortalOptions {
  l1Client: ExtendedViemWalletClient;
  tokenPortalAddress: `0x${string}`;
  tokenPortalAbi: Abi;
  l2Bridge: AztecAddress;
  /** From `node.getNodeInfo().l1ContractAddresses.registryAddress`. */
  registryAddress: `0x${string}`;
}

/**
 * Portal `initialize(registry, l2BridgeBytes32)` after L2 bridge address is known.
 */
export async function initializePortalWithL2Bridge(opts: InitializePortalOptions): Promise<void> {
  const l2BridgeBytes32 = padHex(`0x${Buffer.from(opts.l2Bridge.toBuffer()).toString('hex')}`, {
    size: 32,
  }) as `0x${string}`;

  const initPortalHash = await opts.l1Client.writeContract({
    address: opts.tokenPortalAddress,
    abi: opts.tokenPortalAbi,
    functionName: 'initialize',
    args: [opts.registryAddress, l2BridgeBytes32],
  });
  await opts.l1Client.waitForTransactionReceipt({ hash: initPortalHash });
}

export function createAztecNodeFromConfig(): AztecNode {
  return createAztecNodeClient(getAztecNodeUrl());
}
