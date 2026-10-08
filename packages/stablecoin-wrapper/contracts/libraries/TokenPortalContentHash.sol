// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.28;

/// @dev Mirrors `packages/private-stablecoin/crates/token_portal_content_hash_lib/src/lib.nr`.
///      `sha256ToField` matches Aztec `Hash.sha256ToField(bytes)`: one leading zero byte, then 31 bytes of sha256.
///      L1 `depositToAztec` uses only `mintToPrivateContentHash` (single deposit); public vs private
///      claim is chosen on L2 when consuming the message.
library TokenPortalContentHash {
  error AmountExceedsUint128();

  function mintToPrivateContentHash(uint256 amount) internal pure returns (bytes32) {
    if (amount > type(uint128).max) revert AmountExceedsUint128();
    bytes memory preimage = abi.encodePacked(bytes4(keccak256("mint_to_private(uint256)")), bytes32(amount));
    return sha256ToField(preimage);
  }

  function withdrawContentHash(address recipient, uint256 amount, address callerOnL1) internal pure returns (bytes32) {
    if (amount > type(uint128).max) revert AmountExceedsUint128();
    bytes memory preimage = abi.encodePacked(
      bytes4(keccak256("withdraw(address,uint256,address)")),
      bytes32(uint256(uint160(recipient))),
      bytes32(amount),
      bytes32(uint256(uint160(callerOnL1)))
    );
    return sha256ToField(preimage);
  }

  function sha256ToField(bytes memory data) private pure returns (bytes32) {
    return bytes32(bytes.concat(new bytes(1), bytes31(sha256(data))));
  }
}
