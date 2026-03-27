import { AztecAddress, EthAddress } from '@aztec/aztec.js/addresses';
import { Fr } from '@aztec/aztec.js/fields';
import type { ExtendedViemWalletClient } from '@aztec/ethereum/types';
import type { AztecNode } from '@aztec/aztec.js/node';

import type { EmbeddedWallet } from '@aztec/wallets/embedded';
import type { AccountManager } from '@aztec/aztec.js/wallet';

import {
    createAztecNodeFromConfig,
    createL1ClientFromConfig,
    deployL1UnderlyingPortalWrapper,
    deployL2PrivateStablecoinAndBridge,
    initializePortalWithL2Bridge,
} from './deploy_token_bridge_helpers.js';

export {
    STABLECOIN_WRAPPER_ARTIFACTS_DIR,
    createAztecNodeFromConfig,
    createL1ClientFromConfig,
    deployL1UnderlyingPortalWrapper,
    deployL2PrivateStablecoinAndBridge,
    initializePortalWithL2Bridge,
    loadStablecoinWrapperArtifact,
    l1ChainForConfig,
} from './deploy_token_bridge_helpers.js';
export type { SolidityArtifact, DeployL1StackResult, DeployL2TokenBridgeResult } from './deploy_token_bridge_helpers.js';

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
    /**
     * Reuse an existing L1 client (same mnemonic/chain as config). If omitted, a new client is created.
     */
    l1Client?: ExtendedViemWalletClient;
}

export interface DeployedTokenBridgeStack {
    underlying: `0x${string}`;
    tokenPortal: `0x${string}`;
    stablecoinWrapper: `0x${string}`;
    l2Token: AztecAddress;
    l2Bridge: AztecAddress;
    deployer: AccountManager;
    /** Viem L1 wallet client used for deployment (for tests and follow-up L1 txs). */
    l1Client: ExtendedViemWalletClient;
    /** Aztec node client for the configured `AZTEC_ENV` (L1 registry, messaging, proofs). */
    aztecNode: AztecNode;
}

/**
 * Full stack: L1 underlying + portal + wrapper init → L2 token + bridge (deterministic salts) →
 * public `set_minter(bridge)` on token → L1 portal init.
 */
export async function deployTokenBridgeStack(
    opts: DeployTokenBridgeOptions,
): Promise<DeployedTokenBridgeStack> {
    const tokenName = opts.tokenName ?? 'Overcast Stablecoin';
    const tokenSymbol = opts.tokenSymbol ?? 'OS';
    const tokenDecimals = opts.tokenDecimals ?? 18n;

    const saltToken = opts.saltToken ?? Fr.random();
    const saltBridge = opts.saltBridge ?? Fr.random();

    const l1Client = opts.l1Client ?? createL1ClientFromConfig();

    const l1Stack = await deployL1UnderlyingPortalWrapper({
        l1Client,
        underlyingL1Address: opts.underlyingL1Address,
    });

    const aztecNode = createAztecNodeFromConfig();
    const nodeInfo = await aztecNode.getNodeInfo();
    const registryAddress = nodeInfo.l1ContractAddresses.registryAddress.toString() as `0x${string}`;
    const portalEth = EthAddress.fromString(l1Stack.tokenPortal);

    const l2 = await deployL2PrivateStablecoinAndBridge({
        wallet: opts.wallet,
        tokenName,
        tokenSymbol,
        tokenDecimals,
        saltToken,
        saltBridge,
        portalEth,
    });

    await initializePortalWithL2Bridge({
        l1Client,
        tokenPortalAddress: l1Stack.tokenPortal,
        tokenPortalAbi: l1Stack.tokenPortalArtifact.abi,
        l2Bridge: l2.l2Bridge,
        registryAddress,
    });

    return {
        underlying: l1Stack.underlying,
        tokenPortal: l1Stack.tokenPortal,
        stablecoinWrapper: l1Stack.stablecoinWrapper,
        l2Token: l2.l2Token,
        l2Bridge: l2.l2Bridge,
        deployer: l2.deployer,
        l1Client,
        aztecNode,
    };
}
