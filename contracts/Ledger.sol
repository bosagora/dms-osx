// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

/// @notice 마일리지와 토큰의 원장
contract Ledger {
    /// @notice 마일리지의 원장
    mapping(bytes32 => uint256) public mileageLedger;
    /// @notice 토큰의 원장
    mapping(bytes32 => uint256) public tokenLedger;
}
