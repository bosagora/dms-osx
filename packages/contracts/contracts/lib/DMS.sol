// SPDX-License-Identifier: AGPL-3.0-or-later

pragma solidity ^0.8.2;

library DMS {
    function zeroGWEI(uint256 value) internal pure returns (uint256) {
        return (value / 1 gwei) * 1 gwei;
    }
}
