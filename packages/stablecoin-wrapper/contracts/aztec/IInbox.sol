// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.28;

import {DataStructures} from "./DataStructures.sol";

/// @dev `sendL2Message` matches `IInbox` in `@aztec-foundation/l1-artifacts` v6.0.0-rc.1.
interface IInbox {
  function sendL2Message(DataStructures.L2Actor memory _recipient, bytes32 _content, bytes32 _secretHash)
    external
    returns (bytes32, uint256);
}
