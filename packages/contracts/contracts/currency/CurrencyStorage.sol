// SPDX-License-Identifier: AGPL-3.0-or-later

pragma solidity ^0.8.20;

import "../validator/Validator.sol";

/// @notice 토큰 가격을 제공하는 스마트컨트랙트
contract CurrencyStorage {
    bytes32 public constant BASE_CURRENCY = keccak256(abi.encodePacked("krw"));
    bytes32 public constant NULL_CURRENCY = keccak256(abi.encodePacked(""));
    uint256 public constant MULTIPLE = 1000000000;
    mapping(string => uint256) internal rates;

    Validator internal validator;
    string internal tokenSymbol;
}