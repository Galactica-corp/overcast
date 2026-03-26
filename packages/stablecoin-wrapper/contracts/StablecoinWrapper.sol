// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.28;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Initializable} from "@openzeppelin/contracts/proxy/utils/Initializable.sol";

import {TokenPortal} from "./TokenPortal.sol";

/// @notice Holds underlying ERC20 as Aztec bridge collateral. `bridgeToAztec` pulls underlying here then calls
///         `TokenPortal` (which does not custody tokens).
contract StablecoinWrapper is Initializable {
  using SafeERC20 for IERC20;

  IERC20 public underlyingToken;
  TokenPortal public tokenPortal;

  event BridgedToAztec(address indexed from, uint256 amount, bytes32 secretHash);
  event WithdrawnFromL2(address indexed recipient, uint256 amount, address indexed callerOnL1);

  function initialize(address underlyingToken_, address tokenPortal_) public initializer {
    require(underlyingToken_ != address(0), "initialize: underlying token is zero");
    require(tokenPortal_ != address(0), "initialize: token portal is zero");

    underlyingToken = IERC20(underlyingToken_);
    tokenPortal = TokenPortal(tokenPortal_);
  }

  /// @notice Pull underlying from the caller into this contract and enqueue an L1→L2 bridge message.
  function bridgeToAztec(uint256 amount, bytes32 secretHash) external returns (bytes32, uint256) {
    require(amount > 0, "bridge: amount must be positive");
    require(amount <= type(uint128).max, "bridge: amount exceeds uint128");

    underlyingToken.safeTransferFrom(msg.sender, address(this), amount);
    (bytes32 key, uint256 index) = tokenPortal.depositToAztec(amount, secretHash);

    emit BridgedToAztec(msg.sender, amount, secretHash);
    return (key, index);
  }

  /// @notice Consume an L2→L1 withdrawal message and pay the recipient from collateral held here.
  /// @dev On L2, set `caller_on_l1` to this wrapper address so `TokenPortal` sees `msg.sender` as this contract.
  function withdrawFromL2ToL1(
    address recipient,
    uint256 amount,
    address callerOnL1,
    uint256 l2BlockNumber,
    uint256 leafIndex,
    bytes32[] calldata path
  ) external {
    require(amount > 0, "withdraw: amount must be positive");
    require(amount <= type(uint128).max, "withdraw: amount exceeds uint128");
    require(recipient != address(0), "withdraw: recipient is zero");
    require(underlyingToken.balanceOf(address(this)) >= amount, "withdraw: insufficient collateral");

    tokenPortal.withdraw(recipient, amount, callerOnL1, l2BlockNumber, leafIndex, path);
    underlyingToken.safeTransfer(recipient, amount);

    emit WithdrawnFromL2(recipient, amount, callerOnL1);
  }
}
