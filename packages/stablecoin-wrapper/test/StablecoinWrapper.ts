import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { network } from "hardhat";
import { getAddress } from "viem";

describe("StablecoinWrapper", async function () {
  const { viem } = await network.connect();
  const [depositor, recipient, thirdParty] = await viem.getWalletClients();

  async function deployFixture() {
    const stablecoin = await viem.deployContract("TestERC20", ["Mock USD", "mUSD"]);
    const wrapper = await viem.deployContract("StablecoinWrapper");

    await wrapper.write.initialize([stablecoin.address]);

    return { stablecoin, wrapper };
  }

  it("stores the configured underlying token", async function () {
    const { stablecoin, wrapper } = await deployFixture();

    assert.equal(await wrapper.read.underlyingToken(), getAddress(stablecoin.address));
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
});
