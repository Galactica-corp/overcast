// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.28;

import {DataStructures} from "./DataStructures.sol";
import {Epoch} from "./TimeLib.sol";

/// @dev `consume` matches `IOutbox` in `@aztec-foundation/l1-artifacts` v6.0.0-rc.1.
interface IOutbox {
  function consume(
    DataStructures.L2ToL1Msg calldata _message,
    Epoch _epoch,
    uint256 _numCheckpointsInEpoch,
    uint256 _leafIndex,
    bytes32[] calldata _path
  ) external;
}
