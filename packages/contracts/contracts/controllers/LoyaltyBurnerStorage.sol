// SPDX-License-Identifier: AGPL-3.0-or-later

pragma solidity ^0.8.2;

import "../interfaces/IPhoneLinkCollection.sol";

import "../interfaces/IValidator.sol";
import "../interfaces/ILedger.sol";

contract LoyaltyBurnerStorage {
    IValidator internal validatorContract;
    IPhoneLinkCollection internal linkContract;
    ILedger internal ledgerContract;

    bool internal isSetLedger;
}
