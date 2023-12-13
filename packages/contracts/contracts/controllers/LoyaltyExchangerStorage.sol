// SPDX-License-Identifier: AGPL-3.0-or-later

pragma solidity ^0.8.2;

import "del-osx-artifacts/contracts/interfaces/IPhoneLinkCollection.sol";

import "../interfaces/ICurrencyRate.sol";
import "../interfaces/ILedger.sol";

contract LoyaltyExchangerStorage {
    address internal foundationAccount;

    IPhoneLinkCollection internal linkContract;
    ICurrencyRate internal currencyRateContract;
    ILedger internal ledgerContract;

    bool internal isSetLedger;
}
