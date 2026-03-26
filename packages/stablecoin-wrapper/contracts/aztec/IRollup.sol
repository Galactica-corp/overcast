// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.28;

import {IInbox} from "@aztec/core/interfaces/messagebridge/IInbox.sol";
import {IOutbox} from "@aztec/core/interfaces/messagebridge/IOutbox.sol";

/// @dev Minimal rollup surface used by `TokenPortal`. Matches `INBOX` / `OUTBOX` on the deployed rollup.
/// The full `IRollup` in `l1-contracts` pulls in rollup libs and OpenZeppelin paths not wired for npm.

interface IRollup {
  function INBOX() external view returns (IInbox);

  function OUTBOX() external view returns (IOutbox);
}
