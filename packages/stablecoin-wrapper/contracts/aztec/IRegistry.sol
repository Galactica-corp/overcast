// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.28;

/// @dev Subset of Aztec `IHaveVersion` / `IRegistry` used by `TokenPortal`.
interface IHaveVersion {
  function getVersion() external view returns (uint256);
}

interface IRegistry {
  function getCanonicalRollup() external view returns (IHaveVersion);
}
