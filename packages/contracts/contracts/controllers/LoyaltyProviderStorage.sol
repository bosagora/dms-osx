// SPDX-License-Identifier: AGPL-3.0-or-later

pragma solidity ^0.8.2;

import "../interfaces/IPhoneLinkCollection.sol";

import "../interfaces/ICurrencyRate.sol";
import "../interfaces/IValidator.sol";
import "../interfaces/IShop.sol";
import "../interfaces/ILedger.sol";

contract LoyaltyProviderStorage {
    IValidator internal validatorContract;
    IPhoneLinkCollection internal linkContract;
    ICurrencyRate internal currencyRateContract;
    IShop internal shopContract;
    ILedger internal ledgerContract;

    mapping(string => bool) internal purchases;

    bool internal isSetLedger;
    bool internal isSetShop;
}
