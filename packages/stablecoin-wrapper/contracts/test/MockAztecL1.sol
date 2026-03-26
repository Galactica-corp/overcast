// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.28;

import {DataStructures} from "@aztec/core/libraries/DataStructures.sol";
import {IInbox} from "@aztec/core/interfaces/messagebridge/IInbox.sol";
import {IOutbox} from "@aztec/core/interfaces/messagebridge/IOutbox.sol";

import {IRegistry} from "../aztec/IRegistry.sol";

/// @dev Minimal rollup exposing only `INBOX` / `OUTBOX` (matches what `TokenPortal` calls via `IRollup`).
contract MockAztecRollup {
  IInbox public immutable inbox;
  IOutbox public immutable outbox;

  constructor(IInbox inbox_, IOutbox outbox_) {
    inbox = inbox_;
    outbox = outbox_;
  }

  function INBOX() external view returns (IInbox) {
    return inbox;
  }

  function OUTBOX() external view returns (IOutbox) {
    return outbox;
  }
}

/// @dev Lightweight registry for tests.
contract MockAztecRegistry is IRegistry {
  address public rollup;

  constructor(address rollup_) {
    rollup = rollup_;
  }

  function getRollup() external view returns (address) {
    return rollup;
  }

  function getVersionFor(address) external pure returns (uint256) {
    return 42;
  }
}

contract MockAztecInbox is IInbox {
  DataStructures.L2Actor public lastActor;
  bytes32 public lastContent;
  bytes32 public lastSecretHash;
  uint256 public nextIndex = 1;

  function sendL2Message(
    DataStructures.L2Actor memory _recipient,
    bytes32 _content,
    bytes32 _secretHash
  ) external returns (bytes32, uint256) {
    lastActor = _recipient;
    lastContent = _content;
    lastSecretHash = _secretHash;
    uint256 index = nextIndex++;
    return (bytes32(0), index);
  }

  function consume(uint256) external pure returns (bytes32) {
    return bytes32(0);
  }

  function getRoot(uint256) external pure returns (bytes32) {
    return bytes32(0);
  }
}

contract MockAztecOutbox is IOutbox {
  DataStructures.L2ToL1Msg public lastMessage;
  uint256 public lastL2BlockNumber;
  uint256 public lastLeafIndex;

  bytes32 public lastConsumedContent;
  bytes32 public lastSenderActor;
  uint256 public lastSenderVersion;
  address public lastRecipientActor;
  uint256 public lastRecipientChainId;

  event Consumed(DataStructures.L2ToL1Msg message, uint256 l2BlockNumber, uint256 leafIndex);

  function consume(
    DataStructures.L2ToL1Msg calldata _message,
    uint256 _l2BlockNumber,
    uint256 _leafIndex,
    bytes32[] calldata /* _path */
  ) external {
    lastMessage = DataStructures.L2ToL1Msg({
      sender: _message.sender,
      recipient: _message.recipient,
      content: _message.content
    });
    lastConsumedContent = _message.content;
    lastSenderActor = _message.sender.actor;
    lastSenderVersion = _message.sender.version;
    lastRecipientActor = _message.recipient.actor;
    lastRecipientChainId = _message.recipient.chainId;
    lastL2BlockNumber = _l2BlockNumber;
    lastLeafIndex = _leafIndex;
    emit Consumed(_message, _l2BlockNumber, _leafIndex);
  }

  function insert(uint256, bytes32, uint256) external pure {}

  function hasMessageBeenConsumedAtBlockAndIndex(uint256, uint256) external pure returns (bool) {
    return false;
  }

  function getRootData(uint256) external pure returns (bytes32, uint256) {
    return (bytes32(0), 0);
  }
}
