// SPDX-License-Identifier: AGPL-3.0-or-later

pragma solidity ^0.8.2;

import "del-osx-artifacts/contracts/interfaces/IPhoneLinkCollection.sol";

import "../interfaces/ICurrencyRate.sol";
import "../interfaces/IValidator.sol";
import "../interfaces/IShop.sol";
import "../interfaces/ILedger.sol";

contract LoyaltyProviderStorage {
    /// @notice Hash value of a blank string
    bytes32 public constant NULL = 0x32105b1d0b88ada155176b58ee08b45c31e4f2f7337475831982c313533b880c;

    IValidator internal validatorContract;
    IPhoneLinkCollection internal linkContract;
    ICurrencyRate internal currencyRateContract;
    IShop internal shopContract;
    ILedger internal ledgerContract;

    mapping(string => bool) internal purchases;

    bool internal isSetLedger;
    bool internal isSetShop;
}
