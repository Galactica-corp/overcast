// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.28;

import {StablecoinWrapper} from "./StablecoinWrapper.sol";
import {TokenPortal} from "./TokenPortal.sol";
import {MockAztecInbox, MockAztecOutbox, MockAztecRegistry, MockAztecRollup} from "./test/MockAztecL1.sol";
import {TestERC20} from "./test/TestERC20.sol";
import {Test} from "forge-std/Test.sol";

contract StablecoinWrapperTest is Test {
  StablecoinWrapper wrapper;
  TokenPortal portal;
  TestERC20 stablecoin;
  address depositor = makeAddr("depositor");
  address recipient = makeAddr("recipient");

  bytes32 internal constant L2_BRIDGE = bytes32(uint256(0xabcd));

  function setUp() public {
    stablecoin = new TestERC20("Mock USD", "mUSD");

    MockAztecInbox inbox = new MockAztecInbox();
    MockAztecOutbox outbox = new MockAztecOutbox();
    MockAztecRollup rollup = new MockAztecRollup(inbox, outbox);
    MockAztecRegistry registry = new MockAztecRegistry(address(rollup));

    portal = new TokenPortal();
    portal.initialize(address(registry), L2_BRIDGE);

    wrapper = new StablecoinWrapper();
    wrapper.initialize(address(stablecoin), address(portal));

    stablecoin.mint(depositor, 100 ether);

    vm.prank(depositor);
    stablecoin.approve(address(wrapper), type(uint256).max);
  }

  function test_InitializeStoresUnderlyingTokenAndPortal() public view {
    assertEq(address(wrapper.underlyingToken()), address(stablecoin));
    assertEq(address(wrapper.tokenPortal()), address(portal));
  }

  function test_ShieldCreditsRecipientAndTransfersUnderlying() public {
    uint256 amount = 25 ether;

    vm.prank(depositor);
    wrapper.shield(recipient, amount);

    assertEq(wrapper.balances(recipient), amount);
    assertEq(stablecoin.balanceOf(address(wrapper)), amount);
    assertEq(stablecoin.balanceOf(depositor), 75 ether);
  }

  function test_UnshieldReducesBalanceAndReturnsUnderlying() public {
    uint256 shieldAmount = 40 ether;
    uint256 withdrawAmount = 15 ether;

    vm.startPrank(depositor);
    wrapper.shield(depositor, shieldAmount);
    wrapper.unshield(withdrawAmount);
    vm.stopPrank();

    assertEq(wrapper.balances(depositor), shieldAmount - withdrawAmount);
    assertEq(stablecoin.balanceOf(address(wrapper)), shieldAmount - withdrawAmount);
    assertEq(stablecoin.balanceOf(depositor), 75 ether);
  }

  function test_UnshieldInsufficientBalanceReverts() public {
    vm.prank(recipient);
    vm.expectRevert(bytes("unshield: insufficient balance"));
    wrapper.unshield(1);
  }
}
