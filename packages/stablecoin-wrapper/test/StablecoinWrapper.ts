import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { network } from "hardhat";
import { getAddress, pad, toHex } from "viem";

describe("StablecoinWrapper", async function () {
  const { viem } = await network.connect();
  const [depositor, recipient, thirdParty] = await viem.getWalletClients();

  const l2Bridge = pad(toHex(0xabcd), { size: 32 });

  async function deployMessagingStack() {
    const inbox = await viem.deployContract("MockAztecInbox");
    const outbox = await viem.deployContract("MockAztecOutbox");
    const rollup = await viem.deployContract("MockAztecRollup", [inbox.address, outbox.address]);
    const registry = await viem.deployContract("MockAztecRegistry", [rollup.address]);
    const portal = await viem.deployContract("TokenPortal");
    await portal.write.initialize([registry.address, l2Bridge]);
    return { portal };
  }

  async function deployFixture() {
    const stablecoin = await viem.deployContract("TestERC20", ["Mock USD", "mUSD"]);
    const { portal } = await deployMessagingStack();
    const wrapper = await viem.deployContract("StablecoinWrapper");

    await wrapper.write.initialize([stablecoin.address, portal.address]);

    return { stablecoin, wrapper, portal };
  }

  it("stores the configured underlying token and portal", async function () {
    const { stablecoin, wrapper, portal } = await deployFixture();

    assert.equal(await wrapper.read.underlyingToken(), getAddress(stablecoin.address));
    assert.equal(await wrapper.read.tokenPortal(), getAddress(portal.address));
  });

  it("shields tokens for the requested recipient", async function () {
    const { stablecoin, wrapper } = await deployFixture();
    const amount = 25n;

    await stablecoin.write.mint([depositor.account.address, amount]);
    await stablecoin.write.approve([wrapper.address, amount]);

    await viem.assertions.emitWithArgs(
      wrapper.write.shield([recipient.account.address, amount]),
      wrapper,
      "Shielded",
      [
        getAddress(depositor.account.address),
        getAddress(recipient.account.address),
        amount,
      ],
    );

    assert.equal(await wrapper.read.balances([recipient.account.address]), amount);
    assert.equal(await stablecoin.read.balanceOf([wrapper.address]), amount);
    assert.equal(await stablecoin.read.balanceOf([depositor.account.address]), 0n);
  });

  it("unshields tokens for the caller after reducing their balance", async function () {
    const { stablecoin, wrapper } = await deployFixture();
    const shieldAmount = 40n;
    const withdrawAmount = 15n;

    await stablecoin.write.mint([depositor.account.address, shieldAmount]);
    await stablecoin.write.approve([wrapper.address, shieldAmount]);
    await wrapper.write.shield([depositor.account.address, shieldAmount]);

    await viem.assertions.emitWithArgs(
      wrapper.write.unshield([withdrawAmount]),
      wrapper,
      "Unshielded",
      [getAddress(depositor.account.address), withdrawAmount],
    );

    assert.equal(
      await wrapper.read.balances([depositor.account.address]),
      shieldAmount - withdrawAmount,
    );
    assert.equal(await stablecoin.read.balanceOf([depositor.account.address]), withdrawAmount);
    assert.equal(
      await stablecoin.read.balanceOf([wrapper.address]),
      shieldAmount - withdrawAmount,
    );
  });

  it("rejects unshield attempts above the caller balance", async function () {
    const { wrapper } = await deployFixture();

    await assert.rejects(
      wrapper.write.unshield([1n], { account: thirdParty.account }),
      /unshield: insufficient balance/,
    );
  });

  it("bridgeToAztec pulls underlying and calls the portal", async function () {
    const { stablecoin, wrapper, portal } = await deployFixture();
    const amount = 30n;
    const secretHash = pad(toHex(0xbeef), { size: 32 });

    await stablecoin.write.mint([depositor.account.address, amount]);
    await stablecoin.write.approve([wrapper.address, amount]);

    await viem.assertions.emitWithArgs(
      wrapper.write.bridgeToAztec([amount, secretHash], { account: depositor.account }),
      wrapper,
      "BridgedToAztec",
      [getAddress(depositor.account.address), amount, secretHash],
    );

    assert.equal(await stablecoin.read.balanceOf([wrapper.address]), amount);
    assert.equal(await stablecoin.read.balanceOf([depositor.account.address]), 0n);
    assert.equal(await stablecoin.read.balanceOf([portal.address]), 0n);
  });

  it("withdrawFromL2ToL1 pays the recipient after the portal consumes the message", async function () {
    const { stablecoin, wrapper } = await deployFixture();
    const amount = 50n;
    await stablecoin.write.mint([wrapper.address, amount]);

    const recipientAddr = recipient.account.address;
    const callerOnL1 = getAddress(wrapper.address);
    const l2BlockNumber = 7n;
    const leafIndex = 2n;
    const path: `0x${string}`[] = [];

    await wrapper.write.withdrawFromL2ToL1(
      [recipientAddr, amount, callerOnL1, l2BlockNumber, leafIndex, path],
      { account: depositor.account },
    );

    assert.equal(await stablecoin.read.balanceOf([recipientAddr]), amount);
    assert.equal(await stablecoin.read.balanceOf([wrapper.address]), 0n);
    assert.equal(await stablecoin.read.balanceOf([portal.address]), 0n);
  });
});
