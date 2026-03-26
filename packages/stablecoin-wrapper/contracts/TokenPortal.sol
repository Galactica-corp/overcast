// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.28;

import {Initializable} from "@openzeppelin/contracts/proxy/utils/Initializable.sol";

import {IInbox} from "@aztec/core/interfaces/messagebridge/IInbox.sol";
import {IOutbox} from "@aztec/core/interfaces/messagebridge/IOutbox.sol";
import {DataStructures} from "@aztec/core/libraries/DataStructures.sol";

import {IRegistry} from "./aztec/IRegistry.sol";
import {IRollup} from "./aztec/IRollup.sol";
import {TokenPortalContentHash} from "./libraries/TokenPortalContentHash.sol";

/// @title TokenPortal
/// @notice Aztec L1 portal: sends L1→L2 bridge messages and consumes L2→L1 withdrawals. Does not hold or move
///         ERC20; custody stays in `StablecoinWrapper` which calls this contract.
/// @dev Uses `@aztec/l1-contracts` types (`DataStructures`, `Hash` via `TokenPortalContentHash`). Rollup wiring
///      matches published interfaces (`getRollup`, `INBOX`, `OUTBOX`, `getVersionFor`).
contract TokenPortal is Initializable {
  bytes32 public l2Bridge;
  IRegistry public registry;
  IRollup public rollup;
  IOutbox public outbox;
  IInbox public inbox;
  uint256 public rollupVersion;

  event Initialized(address indexed registry, bytes32 indexed l2Bridge);

  event DepositToAztec(uint256 indexed amount, bytes32 contentHash, bytes32 secretHash);

  event WithdrawalMessageConsumed(address indexed recipient, uint256 amount, address indexed callerOnL1);

  function initialize(address registry_, bytes32 l2Bridge_) external initializer {
    require(registry_ != address(0), "initialize: registry is zero");
    require(l2Bridge_ != bytes32(0), "initialize: l2 bridge is zero");

    registry = IRegistry(registry_);
    address rollupAddr = registry.getRollup();
    rollup = IRollup(rollupAddr);
    inbox = rollup.INBOX();
    outbox = rollup.OUTBOX();
    rollupVersion = registry.getVersionFor(rollupAddr);
    l2Bridge = l2Bridge_;

    emit Initialized(registry_, l2Bridge_);
  }

  /// @notice Enqueue an L1→L2 message for the bridge (`claim_public` or `claim_private` on L2 both consume this hash).
  function depositToAztec(uint256 amount, bytes32 secretHash) external returns (bytes32, uint256) {
    require(amount > 0, "deposit: amount is zero");
    require(amount <= type(uint128).max, "deposit: amount exceeds uint128");

    DataStructures.L2Actor memory actor = DataStructures.L2Actor(l2Bridge, rollupVersion);
    bytes32 contentHash = TokenPortalContentHash.mintToPrivateContentHash(amount);
    (bytes32 key, uint256 index) = inbox.sendL2Message(actor, contentHash, secretHash);

    emit DepositToAztec(amount, contentHash, secretHash);
    return (key, index);
  }

  /// @notice Consume an L2→L1 withdrawal message. Does not transfer ERC20 — the caller (typically
  ///         `StablecoinWrapper`) releases underlying after this succeeds.
  function withdraw(
    address recipient,
    uint256 amount,
    address callerOnL1,
    uint256 l2BlockNumber,
    uint256 leafIndex,
    bytes32[] calldata path
  ) external {
    require(amount > 0, "withdraw: amount is zero");
    require(amount <= type(uint128).max, "withdraw: amount exceeds uint128");
    require(recipient != address(0), "withdraw: recipient is zero");

    if (callerOnL1 != address(0)) {
      require(msg.sender == callerOnL1, "withdraw: not authorized caller");
    }

    bytes32 content = TokenPortalContentHash.withdrawContentHash(recipient, amount, callerOnL1);
    DataStructures.L2ToL1Msg memory message = DataStructures.L2ToL1Msg({
      sender: DataStructures.L2Actor(l2Bridge, rollupVersion),
      recipient: DataStructures.L1Actor(address(this), block.chainid),
      content: content
    });

    outbox.consume(message, l2BlockNumber, leafIndex, path);

    emit WithdrawalMessageConsumed(recipient, amount, callerOnL1);
  }
}
