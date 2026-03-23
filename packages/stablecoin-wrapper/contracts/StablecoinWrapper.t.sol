// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.28;

import {StablecoinWrapper} from "./StablecoinWrapper.sol";
import {TestERC20} from "./test/TestERC20.sol";
import {Test} from "forge-std/Test.sol";

contract StablecoinWrapperTest is Test {
  StablecoinWrapper wrapper;
  TestERC20 stablecoin;
  address depositor = makeAddr("depositor");
  address recipient = makeAddr("recipient");

  function setUp() public {
    stablecoin = new TestERC20("Mock USD", "mUSD");
    wrapper = new StablecoinWrapper();
    wrapper.initialize(address(stablecoin));

    stablecoin.mint(depositor, 100 ether);

    vm.prank(depositor);
    stablecoin.approve(address(wrapper), type(uint256).max);
  }

  function test_InitializeStoresUnderlyingToken() public view {
    assertEq(address(wrapper.underlyingToken()), address(stablecoin));
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
