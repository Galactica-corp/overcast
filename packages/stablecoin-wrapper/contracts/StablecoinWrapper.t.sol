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
}
