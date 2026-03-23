// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.28;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Initializable} from "@openzeppelin/contracts/proxy/utils/Initializable.sol";

contract StablecoinWrapper is Initializable {
  using SafeERC20 for IERC20;

  IERC20 public underlyingToken;
  mapping(address => uint256) public balances;

  event Shielded(address indexed depositor, address indexed recipient, uint256 amount);
  event Unshielded(address indexed account, uint256 amount);

  function initialize(address underlyingToken_) public initializer {
    require(underlyingToken_ != address(0), "initialize: underlying token is zero");

    underlyingToken = IERC20(underlyingToken_);
  }

  function shield(address recipient, uint256 amount) public {
    require(recipient != address(0), "shield: recipient is zero");
    require(amount > 0, "shield: amount must be positive");

    underlyingToken.safeTransferFrom(msg.sender, address(this), amount);
    balances[recipient] += amount;

    emit Shielded(msg.sender, recipient, amount);
  }

  function unshield(uint256 amount) public {
    uint256 balance = balances[msg.sender];
    require(balance >= amount, "unshield: insufficient balance");
    require(amount > 0, "unshield: amount must be positive");

    balances[msg.sender] = balance - amount;
    underlyingToken.safeTransfer(msg.sender, amount);

    emit Unshielded(msg.sender, amount);
  }
}
