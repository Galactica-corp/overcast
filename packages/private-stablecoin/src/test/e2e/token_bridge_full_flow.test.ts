import { EthAddress } from '@aztec/aztec.js/addresses';
import { SponsoredFeePaymentMethod } from '@aztec/aztec.js/fee';
import { Fr } from '@aztec/aztec.js/fields';
import { SponsoredFPCContractArtifact } from '@aztec/noir-contracts.js/SponsoredFPC';
import { createLogger } from '@aztec/foundation/log';

import { PrivateStablecoinContract } from '../../artifacts/PrivateStablecoin.js';
import { TokenBridgeContract } from '../../artifacts/TokenBridge.js';
import { getTimeouts } from '../../../config/config.js';
import {
  createL1ClientFromConfig,
  deployTokenBridgeStack,
  loadStablecoinWrapperArtifact,
} from '../../utils/deploy_token_bridge.js';
import { deploySchnorrAccountRandom } from '../../utils/deploy_account.js';
import { setupWallet } from '../../utils/setup_wallet.js';
import { getSponsoredFPCInstance } from '../../utils/sponsored_fpc.js';
import {
  advanceLocalChainThenWaitForL1MessageReady,
  bridgeStablecoinToAztecPrivate,
  getWithdrawL2MessageHash,
  mintTestErc20To,
  waitForL2BlockProvenOnL1,
  waitForL2ToL1MembershipWitness,
  withdrawStablecoinFromL2ToL1,
} from '../../utils/bridge/stablecoin_cross_chain.js';

const runFull = process.env.RUN_AZTEC_E2E === '1';

/** Uses stdout (not `console.log`) so lines appear while the test runs; Jest buffers `console` until the file finishes. */
const logStep = (label: string, detail?: Record<string, unknown>) => {
  const payload = detail ? ` ${JSON.stringify(detail)}` : '';
  process.stdout.write(`[token-bridge-full-flow] ${label}${payload}\n`);
};

(runFull ? describe : describe.skip)('Token bridge full flow (Aztec E2E)', () => {
  const logger = createLogger('overcast:token-bridge-full:e2e');
  const timeouts = getTimeouts();

  it(
    'deploys, wraps, claims private balance, transfers, exits, and withdraws on L1',
    async () => {
      logStep('start');
      const wallet = await setupWallet();
      logStep('setupWallet done');
      const sponsoredFPC = await getSponsoredFPCInstance();
      logStep('getSponsoredFPCInstance done');
      await wallet.registerContract(sponsoredFPC, SponsoredFPCContractArtifact);
      logStep('registerContract SponsoredFPC done');
      const sponsoredPaymentMethod = new SponsoredFeePaymentMethod(sponsoredFPC.address);

      const stack = await deployTokenBridgeStack({ wallet });
      logStep('deployTokenBridgeStack done', {
        l2Token: stack.l2Token.toString(),
        l2Bridge: stack.l2Bridge.toString(),
      });

      const testErc20Art = loadStablecoinWrapperArtifact('test/TestERC20.sol/TestERC20.json');
      const wrapperArt = loadStablecoinWrapperArtifact('StablecoinWrapper.sol/StablecoinWrapper.json');
      const portalArt = loadStablecoinWrapperArtifact('TokenPortal.sol/TokenPortal.json');

      const l1Deployer = stack.l1Client;
      const l1Alice = createL1ClientFromConfig(1);
      const bobL1Client = createL1ClientFromConfig(2);

      const aliceEth = (await l1Alice.getAddresses())[0] as `0x${string}`;
      const bobEth = (await bobL1Client.getAddresses())[0] as `0x${string}`;
      logStep('L1 clients ready', { aliceEth, bobEth });

      const aliceAccount = await deploySchnorrAccountRandom(wallet);
      logStep('deploySchnorrAccountRandom alice done', { alice: aliceAccount.address.toString() });
      await wallet.registerSender(aliceAccount.address, 'alice');
      const bobAccount = await deploySchnorrAccountRandom(wallet);
      logStep('deploySchnorrAccountRandom bob done', { bob: bobAccount.address.toString() });
      await wallet.registerSender(bobAccount.address, 'bob');
      logStep('registerSender alice/bob done');

      const aliceAztec = aliceAccount.address;
      const bobAztec = bobAccount.address;

      const bridgeAmount = 10n ** 18n;
      const transferAmount = 6n * 10n ** 17n;

      await mintTestErc20To(
        l1Deployer,
        stack.underlying,
        testErc20Art.abi,
        aliceEth,
        bridgeAmount,
      );
      logStep('mintTestErc20To alice done');

      const claim = await bridgeStablecoinToAztecPrivate({
        l1ClientAlice: l1Alice,
        underlying: stack.underlying,
        stablecoinWrapper: stack.stablecoinWrapper,
        tokenPortal: stack.tokenPortal,
        testErc20Abi: testErc20Art.abi,
        wrapperAbi: wrapperArt.abi,
        tokenPortalAbi: portalArt.abi,
        amount: bridgeAmount,
      });
      logStep('bridgeStablecoinToAztecPrivate done', {
        messageLeafIndex: claim.messageLeafIndex.toString(),
      });

      logStep('advanceLocalChainThenWaitForL1MessageReady starting (may block)');
      const waitL1ReadySec = Math.max(300, Math.ceil(timeouts.waitTimeout / 1000));
      await advanceLocalChainThenWaitForL1MessageReady({
        node: stack.aztecNode,
        messageHash: claim.messageHash,
        l1Client: l1Alice,
        wallet,
        l2Token: stack.l2Token,
        tokenPortalL1: stack.tokenPortal,
        from: aliceAztec,
        sponsoredPaymentMethod,
        txTimeout: timeouts.txTimeout,
        waitTimeoutSeconds: waitL1ReadySec,
      });
      logStep('advanceLocalChainThenWaitForL1MessageReady done');

      const bridge = await TokenBridgeContract.at(stack.l2Bridge, wallet);
      const token = await PrivateStablecoinContract.at(stack.l2Token, wallet);
      logStep('TokenBridge + PrivateStablecoin .at() done');

      const messageLeafIndex = Fr.fromString(claim.messageLeafIndex.toString());

      logStep('claim_private simulate starting');
      await bridge.methods
        .claim_private(aliceAztec, claim.claimAmount, claim.claimSecret, messageLeafIndex)
        .simulate({ from: aliceAztec });
      logStep('claim_private send starting');
      await bridge.methods
        .claim_private(aliceAztec, claim.claimAmount, claim.claimSecret, messageLeafIndex)
        .send({
          from: aliceAztec,
          fee: { paymentMethod: sponsoredPaymentMethod },
          wait: { timeout: timeouts.txTimeout },
        });
      logStep('claim_private send done');

      const { result: aliceBalAfterClaim } = await token.methods
        .balance_of_private(aliceAztec)
        .simulate({ from: aliceAztec });
      expect(aliceBalAfterClaim).toBe(bridgeAmount);
      logStep('alice balance after claim OK');

      const transferNonce = Fr.ZERO;
      logStep('transfer_private_to_private simulate starting');
      await token.methods
        .transfer_private_to_private(aliceAztec, bobAztec, transferAmount, transferNonce)
        .simulate({ from: aliceAztec });
      logStep('transfer_private_to_private send starting');
      await token.methods
        .transfer_private_to_private(aliceAztec, bobAztec, transferAmount, transferNonce)
        .send({
          from: aliceAztec,
          fee: { paymentMethod: sponsoredPaymentMethod },
          wait: { timeout: timeouts.txTimeout },
        });
      logStep('transfer_private_to_private send done');

      const { result: bobBal } = await token.methods.balance_of_private(bobAztec).simulate({ from: bobAztec });
      expect(bobBal).toBe(transferAmount);
      logStep('bob balance after transfer OK');

      const exitNonce = Fr.random();
      logStep('createAuthWit burn_private starting');
      const burnAuth = await wallet.createAuthWit(
        bobAztec,
        // ContractFunctionInteractionCallIntent (caller + action); wallet .d.ts may omit this variant.
        {
          caller: stack.l2Bridge,
          action: token.methods.burn_private(bobAztec, transferAmount, exitNonce),
        } as never,
      );
      logStep('createAuthWit burn_private done');

      const wrapperEth = EthAddress.fromString(stack.stablecoinWrapper);

      logStep('exit_to_l1_private simulate starting');
      await bridge.methods
        .exit_to_l1_private(EthAddress.fromString(bobEth), transferAmount, wrapperEth, exitNonce)
        .simulate({ from: bobAztec, authWitnesses: [burnAuth] });
      logStep('exit_to_l1_private send starting');
      const { receipt: exitReceipt } = await bridge.methods
        .exit_to_l1_private(EthAddress.fromString(bobEth), transferAmount, wrapperEth, exitNonce)
        .send({
          from: bobAztec,
          authWitnesses: [burnAuth],
          fee: { paymentMethod: sponsoredPaymentMethod },
          wait: { timeout: timeouts.txTimeout },
        });
      logStep('exit_to_l1_private send done');

      const exitTxHash = exitReceipt.txHash.toString();
      const exitBlockNumber = exitReceipt.blockNumber;
      if (exitBlockNumber === undefined) {
        throw new Error('exit tx receipt missing blockNumber (needed for L1 outbox timing)');
      }

      logStep('waitForL2BlockProvenOnL1 starting (may block)');
      await waitForL2BlockProvenOnL1(stack.aztecNode, exitBlockNumber, 900);
      logStep('waitForL2BlockProvenOnL1 done');

      logStep('getWithdrawL2MessageHash starting');
      const withdrawMsgHash = await getWithdrawL2MessageHash(l1Deployer, stack.aztecNode, {
        l2Bridge: stack.l2Bridge,
        tokenPortalAddress: stack.tokenPortal,
        recipientL1: EthAddress.fromString(bobEth),
        amount: transferAmount,
        callerOnL1: wrapperEth,
      });
      logStep('getWithdrawL2MessageHash done', { withdrawMsgHash: withdrawMsgHash.toString() });

      logStep('waitForL2ToL1MembershipWitness starting (may block)');
      const witness = await waitForL2ToL1MembershipWitness(
        stack.aztecNode,
        withdrawMsgHash,
        exitTxHash,
        900,
        3,
      );
      logStep('waitForL2ToL1MembershipWitness done');

      const bobBefore = (await l1Deployer.readContract({
        address: stack.underlying,
        abi: testErc20Art.abi,
        functionName: 'balanceOf',
        args: [bobEth],
      })) as bigint;
      logStep('bob L1 underlying balance before withdraw', { bobBefore: bobBefore.toString() });

      logStep('withdrawStablecoinFromL2ToL1 starting');
      await withdrawStablecoinFromL2ToL1({
        l1Client: l1Deployer,
        stablecoinWrapper: stack.stablecoinWrapper,
        wrapperAbi: wrapperArt.abi,
        recipient: bobEth,
        amount: transferAmount,
        callerOnL1: stack.stablecoinWrapper,
        witness,
      });
      logStep('withdrawStablecoinFromL2ToL1 done');

      const bobAfter = (await l1Deployer.readContract({
        address: stack.underlying,
        abi: testErc20Art.abi,
        functionName: 'balanceOf',
        args: [bobEth],
      })) as bigint;

      expect(bobAfter - bobBefore).toBe(transferAmount);
      logStep('assert bob L1 delta OK', { bobAfter: bobAfter.toString() });

      logger.info('Token bridge full flow completed.');
      logStep('finished');
      await wallet.stop?.();
    },
    600000,
  );
});
