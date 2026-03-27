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
import { deploySchnorrAccount } from '../../utils/deploy_account.js';
import { setupWallet } from '../../utils/setup_wallet.js';
import { getSponsoredFPCInstance } from '../../utils/sponsored_fpc.js';
import {
  bridgeStablecoinToAztecPrivate,
  getWithdrawL2MessageHash,
  mintTestErc20To,
  waitForL1MessageReadyForClaim,
  waitForL2ToL1MembershipWitness,
  withdrawStablecoinFromL2ToL1,
} from '../../utils/bridge/stablecoin_cross_chain.js';

const runFull = process.env.RUN_AZTEC_E2E === '1';

(runFull ? describe : describe.skip)('Token bridge full flow (Aztec E2E)', () => {
  const logger = createLogger('overcast:token-bridge-full:e2e');
  const timeouts = getTimeouts();

  it(
    'deploys, wraps, claims private balance, transfers, exits, and withdraws on L1',
    async () => {
      const wallet = await setupWallet();
      const sponsoredFPC = await getSponsoredFPCInstance();
      await wallet.registerContract(sponsoredFPC, SponsoredFPCContractArtifact);
      const sponsoredPaymentMethod = new SponsoredFeePaymentMethod(sponsoredFPC.address);

      const stack = await deployTokenBridgeStack({ wallet });

      const testErc20Art = loadStablecoinWrapperArtifact('test/TestERC20.sol/TestERC20.json');
      const wrapperArt = loadStablecoinWrapperArtifact('StablecoinWrapper.sol/StablecoinWrapper.json');
      const portalArt = loadStablecoinWrapperArtifact('TokenPortal.sol/TokenPortal.json');

      const l1Deployer = stack.l1Client;
      const l1Alice = createL1ClientFromConfig(1);
      const bobL1Client = createL1ClientFromConfig(2);

      const aliceEth = (await l1Alice.getAddresses())[0] as `0x${string}`;
      const bobEth = (await bobL1Client.getAddresses())[0] as `0x${string}`;

      const aliceAccount = await deploySchnorrAccount(wallet);
      await wallet.registerSender(aliceAccount.address, 'alice');
      const bobAccount = await deploySchnorrAccount(wallet);
      await wallet.registerSender(bobAccount.address, 'bob');

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

      await waitForL1MessageReadyForClaim(stack.aztecNode, claim.messageHash, 600);

      const bridge = await TokenBridgeContract.at(stack.l2Bridge, wallet);
      const token = await PrivateStablecoinContract.at(stack.l2Token, wallet);

      const messageLeafIndex = Fr.fromString(claim.messageLeafIndex.toString());

      await bridge.methods
        .claim_private(aliceAztec, claim.claimAmount, claim.claimSecret, messageLeafIndex)
        .simulate({ from: aliceAztec });
      await bridge.methods
        .claim_private(aliceAztec, claim.claimAmount, claim.claimSecret, messageLeafIndex)
        .send({
          from: aliceAztec,
          fee: { paymentMethod: sponsoredPaymentMethod },
          wait: { timeout: timeouts.txTimeout },
        });

      const { result: aliceBalAfterClaim } = await token.methods
        .balance_of_private(aliceAztec)
        .simulate({ from: aliceAztec });
      expect(aliceBalAfterClaim).toBe(bridgeAmount);

      const transferNonce = Fr.ZERO;
      await token.methods
        .transfer_private_to_private(aliceAztec, bobAztec, transferAmount, transferNonce)
        .simulate({ from: aliceAztec });
      await token.methods
        .transfer_private_to_private(aliceAztec, bobAztec, transferAmount, transferNonce)
        .send({
          from: aliceAztec,
          fee: { paymentMethod: sponsoredPaymentMethod },
          wait: { timeout: timeouts.txTimeout },
        });

      const { result: bobBal } = await token.methods.balance_of_private(bobAztec).simulate({ from: bobAztec });
      expect(bobBal).toBe(transferAmount);

      const exitNonce = Fr.random();
      const burnAuth = await wallet.createAuthWit(
        bobAztec,
        // ContractFunctionInteractionCallIntent (caller + action); wallet .d.ts may omit this variant.
        {
          caller: stack.l2Bridge,
          action: token.methods.burn_private(bobAztec, transferAmount, exitNonce),
        } as never,
      );

      const wrapperEth = EthAddress.fromString(stack.stablecoinWrapper);

      await bridge.methods
        .exit_to_l1_private(EthAddress.fromString(bobEth), transferAmount, wrapperEth, exitNonce)
        .simulate({ from: bobAztec, authWitnesses: [burnAuth] });
      const { receipt: exitReceipt } = await bridge.methods
        .exit_to_l1_private(EthAddress.fromString(bobEth), transferAmount, wrapperEth, exitNonce)
        .send({
          from: bobAztec,
          authWitnesses: [burnAuth],
          fee: { paymentMethod: sponsoredPaymentMethod },
          wait: { timeout: timeouts.txTimeout },
        });

      const exitTxHash = exitReceipt.txHash.toString();

      const withdrawMsgHash = await getWithdrawL2MessageHash(l1Deployer, stack.aztecNode, {
        l2Bridge: stack.l2Bridge,
        tokenPortalAddress: stack.tokenPortal,
        recipientL1: EthAddress.fromString(bobEth),
        amount: transferAmount,
        callerOnL1: wrapperEth,
      });

      const witness = await waitForL2ToL1MembershipWitness(
        stack.aztecNode,
        withdrawMsgHash,
        exitTxHash,
        900,
        3,
      );

      const bobBefore = (await l1Deployer.readContract({
        address: stack.underlying,
        abi: testErc20Art.abi,
        functionName: 'balanceOf',
        args: [bobEth],
      })) as bigint;

      await withdrawStablecoinFromL2ToL1({
        l1Client: l1Deployer,
        stablecoinWrapper: stack.stablecoinWrapper,
        wrapperAbi: wrapperArt.abi,
        recipient: bobEth,
        amount: transferAmount,
        callerOnL1: stack.stablecoinWrapper,
        witness,
      });

      const bobAfter = (await l1Deployer.readContract({
        address: stack.underlying,
        abi: testErc20Art.abi,
        functionName: 'balanceOf',
        args: [bobEth],
      })) as bigint;

      expect(bobAfter - bobBefore).toBe(transferAmount);

      logger.info('Token bridge full flow completed.');
      await wallet.stop?.();
    },
    600000,
  );
});
