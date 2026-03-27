// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.28;

import {DataStructures} from "@aztec/core/libraries/DataStructures.sol";
import {Epoch} from "@aztec/core/libraries/TimeLib.sol";
import {IInbox} from "@aztec/core/interfaces/messagebridge/IInbox.sol";
import {IOutbox} from "@aztec/core/interfaces/messagebridge/IOutbox.sol";
import {IHaveVersion} from "@aztec/governance/interfaces/IRegistry.sol";

/// @dev Minimal rollup for tests: `TokenPortal` calls `getInbox`, `getOutbox`, and `getVersion` on `IRollup`.
contract MockAztecRollup {
  IInbox public immutable inbox;
  IOutbox public immutable outbox;

  constructor(IInbox inbox_, IOutbox outbox_) {
    inbox = inbox_;
    outbox = outbox_;
  }

  function getInbox() external view returns (IInbox) {
    return inbox;
  }

  function getOutbox() external view returns (IOutbox) {
    return outbox;
  }

  function getVersion() external pure returns (uint256) {
    return 42;
  }

  function INBOX() external view returns (IInbox) {
    return inbox;
  }

  function OUTBOX() external view returns (IOutbox) {
    return outbox;
  }
}

/// @dev Lightweight registry for tests (`getCanonicalRollup` + `getVersionFor` for inbox actor version).
contract MockAztecRegistry {
  address public rollup;

  constructor(address rollup_) {
    rollup = rollup_;
  }

  function getCanonicalRollup() external view returns (IHaveVersion) {
    return IHaveVersion(rollup);
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

  function catchUp(uint256) external {}

  function getFeeAssetPortal() external pure returns (address) {
    return address(0);
  }

  function getRoot(uint256) external pure returns (bytes32) {
    return bytes32(0);
  }

  function getState() external view returns (IInbox.InboxState memory) {
    return IInbox.InboxState({
      rollingHash: bytes16(0),
      totalMessagesInserted: uint64(nextIndex - 1),
      inProgress: 0
    });
  }

  function getTotalMessagesInserted() external view returns (uint64) {
    return uint64(nextIndex - 1);
  }

  function getInProgress() external pure returns (uint64) {
    return 0;
  }
}

contract MockAztecOutbox is IOutbox {
  DataStructures.L2ToL1Msg public lastMessage;
  /// @dev Retained name for tests: stores `Epoch.unwrap` of the epoch passed to `consume`.
  uint256 public lastL2BlockNumber;
  uint256 public lastLeafIndex;

  bytes32 public lastConsumedContent;
  bytes32 public lastSenderActor;
  uint256 public lastSenderVersion;
  address public lastRecipientActor;
  uint256 public lastRecipientChainId;

  event Consumed(DataStructures.L2ToL1Msg message, uint256 epoch, uint256 leafIndex);

  function consume(
    DataStructures.L2ToL1Msg calldata _message,
    Epoch _epoch,
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
    lastL2BlockNumber = Epoch.unwrap(_epoch);
    lastLeafIndex = _leafIndex;
    emit Consumed(_message, lastL2BlockNumber, _leafIndex);
  }

  function insert(Epoch, bytes32) external {}

  function hasMessageBeenConsumedAtEpoch(Epoch, uint256) external pure returns (bool) {
    return false;
  }

  function getRootData(Epoch) external pure returns (bytes32) {
    return bytes32(0);
  }
}
