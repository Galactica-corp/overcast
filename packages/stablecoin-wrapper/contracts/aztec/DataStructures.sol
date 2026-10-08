// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.28;

/// @dev Field layout matches `DataStructures` in `@aztec-foundation/l1-artifacts` v6.0.0-rc.1.
///      Kept local so Hardhat does not have to compile the rollup import tree.
library DataStructures {
  struct L1Actor {
    address actor;
    uint256 chainId;
  }

  struct L2Actor {
    bytes32 actor;
    uint256 version;
  }

  struct L2ToL1Msg {
    DataStructures.L2Actor sender;
    DataStructures.L1Actor recipient;
    bytes32 content;
  }
}
