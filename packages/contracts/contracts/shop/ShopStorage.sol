// SPDX-License-Identifier: AGPL-3.0-or-later

pragma solidity ^0.8.2;

import "../interfaces/ICurrencyRate.sol";
import "../interfaces/IShop.sol";

/// @notice 상점컬랙션
contract ShopStorage {
    mapping(bytes32 => IShop.ShopData) internal shops;
    mapping(address => bytes32[]) internal shopIdByAddress;

    bytes32[] internal items;

    address public providerAddress;
    address public consumerAddress;
    mapping(address => uint256) internal nonce;

    ICurrencyRate internal currencyRate;
}
