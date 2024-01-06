// SPDX-License-Identifier: AGPL-3.0-or-later

pragma solidity ^0.8.2;

library DMS {
    uint256 public constant QUORUM = (uint256(2000) / uint256(3));

    /// @notice Hash value of a blank string
    bytes32 public constant NULL = 0x32105b1d0b88ada155176b58ee08b45c31e4f2f7337475831982c313533b880c;

    function zeroGWEI(uint256 value) internal pure returns (uint256) {
        return (value / 1 gwei) * 1 gwei;
    }
}
