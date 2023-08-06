// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

/// @notice 토큰 가격을 제공하는 스마트컨트랙트
contract TokenPrice {
    mapping(string => uint256) public prices;
}
