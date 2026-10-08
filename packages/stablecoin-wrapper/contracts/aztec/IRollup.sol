// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.28;

import {IInbox} from "./IInbox.sol";
import {IOutbox} from "./IOutbox.sol";

/// @dev Subset of Aztec `IRollup` used by `TokenPortal` (`getInbox`, `getOutbox`, `getVersion`).
interface IRollup {
  function getInbox() external view returns (IInbox);

  function getOutbox() external view returns (IOutbox);

  function getVersion() external view returns (uint256);
}
