// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.28;

/// @dev Minimal registry surface used by `TokenPortal`. ABI-compatible with Aztec governance
/// `IRegistry` getters (`getRollup`, `getVersionFor`). Full interface lives in the
/// `l1-contracts` repository; this subset avoids Hardhat resolution issues for governance imports.

interface IRegistry {
  function getRollup() external view returns (address);

  function getVersionFor(address _rollup) external view returns (uint256);
}
