// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.28;

import {TokenPortalContentHash} from "../libraries/TokenPortalContentHash.sol";

/// @dev Exposes content-hash helpers for Hardhat tests.
contract TokenPortalContentHashHarness {
  function mintToPrivateContentHash(uint256 amount) external pure returns (bytes32) {
    return TokenPortalContentHash.mintToPrivateContentHash(amount);
  }

  function withdrawContentHash(address recipient, uint256 amount, address callerOnL1) external pure returns (bytes32) {
    return TokenPortalContentHash.withdrawContentHash(recipient, amount, callerOnL1);
  }
}
