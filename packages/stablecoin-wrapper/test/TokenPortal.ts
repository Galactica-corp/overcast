import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { network } from "hardhat";
import { getAddress, pad, toHex } from "viem";

describe("TokenPortal", async function () {
  const { viem } = await network.connect();
  const [user, recipient, other] = await viem.getWalletClients();

  const maxUint128 = 2n ** 128n - 1n;
  const l2Bridge = pad(toHex(0xabcd), { size: 32 });

  async function deployMessagingFixture() {
    const inbox = await viem.deployContract("MockAztecInbox");
    const outbox = await viem.deployContract("MockAztecOutbox");
    const rollup = await viem.deployContract("MockAztecRollup", [inbox.address, outbox.address]);
    const registry = await viem.deployContract("MockAztecRegistry", [rollup.address]);
    return { inbox, outbox, rollup, registry };
  }

  it("initialize cannot run twice", async function () {
    const { registry } = await deployMessagingFixture();
    const portal = await viem.deployContract("TokenPortal");

    await portal.write.initialize([registry.address, l2Bridge]);

    await assert.rejects(
      portal.write.initialize([registry.address, l2Bridge]),
      /InvalidInitialization/,
    );
  });

  it("mintToPrivateContentHash reverts when amount exceeds uint128", async function () {
    const harness = await viem.deployContract("TokenPortalContentHashHarness");
    const tooLarge = maxUint128 + 1n;

    await assert.rejects(harness.read.mintToPrivateContentHash([tooLarge]), /AmountExceedsUint128/);
  });

  it("depositToAztec enqueues mint-to-private content hash without moving ERC20", async function () {
    const { inbox, registry } = await deployMessagingFixture();
    const portal = await viem.deployContract("TokenPortal");

    await portal.write.initialize([registry.address, l2Bridge]);

    const amount = 1_000n;
    const secretHash = pad(toHex(0xbeef), { size: 32 });

    const harness = await viem.deployContract("TokenPortalContentHashHarness");
    const expectedContent = await harness.read.mintToPrivateContentHash([amount]);

    await viem.assertions.emitWithArgs(
      portal.write.depositToAztec([amount, secretHash], { account: user.account }),
      portal,
      "DepositToAztec",
      [amount, expectedContent, secretHash],
    );

    assert.equal(await inbox.read.lastContent(), expectedContent);
    assert.equal(await inbox.read.lastSecretHash(), secretHash);
    const actor = await inbox.read.lastActor();
    assert.equal(actor[0], l2Bridge);
    assert.equal(actor[1], 42n);
  });

  it("withdraw consumes the outbox message without transferring tokens", async function () {
    const { outbox, registry } = await deployMessagingFixture();
    const portal = await viem.deployContract("TokenPortal");

    await portal.write.initialize([registry.address, l2Bridge]);

    const amount = 500n;
    const recipientAddr = recipient.account.address;
    const callerOnL1 = other.account.address;
    const l2BlockNumber = 7n;
    const leafIndex = 3n;
    const path: `0x${string}`[] = [];

    const harness = await viem.deployContract("TokenPortalContentHashHarness");
    const content = await harness.read.withdrawContentHash([recipientAddr, amount, callerOnL1]);

    await assert.rejects(
      portal.write.withdraw([
        recipientAddr,
        amount,
        callerOnL1,
        l2BlockNumber,
        leafIndex,
        path,
      ]),
      /withdraw: not authorized caller/,
    );

    await portal.write.withdraw(
      [recipientAddr, amount, callerOnL1, l2BlockNumber, leafIndex, path],
      { account: other.account },
    );

    assert.equal(await outbox.read.lastConsumedContent(), content);
    assert.equal(await outbox.read.lastSenderActor(), l2Bridge);
    assert.equal(await outbox.read.lastSenderVersion(), 42n);
    assert.equal(await outbox.read.lastRecipientActor(), getAddress(portal.address));
    const publicClient = await viem.getPublicClient();
    const chainId = BigInt(publicClient.chain!.id);
    assert.equal(chainId, await outbox.read.lastRecipientChainId());
  });

  it("withdraw allows any caller when callerOnL1 is zero", async function () {
    const { outbox, registry } = await deployMessagingFixture();
    const portal = await viem.deployContract("TokenPortal");

    await portal.write.initialize([registry.address, l2Bridge]);

    const amount = 100n;
    const recipientAddr = recipient.account.address;
    const callerOnL1 = "0x0000000000000000000000000000000000000000" as const;
    const l2BlockNumber = 1n;
    const leafIndex = 0n;
    const path: `0x${string}`[] = [];

    await portal.write.withdraw(
      [recipientAddr, amount, callerOnL1, l2BlockNumber, leafIndex, path],
      { account: user.account },
    );

    const harness = await viem.deployContract("TokenPortalContentHashHarness");
    const expected = await harness.read.withdrawContentHash([recipientAddr, amount, callerOnL1]);
    assert.equal(await outbox.read.lastConsumedContent(), expected);
  });
});
