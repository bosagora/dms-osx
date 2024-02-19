// SPDX-License-Identifier: AGPL-3.0-or-later

pragma solidity ^0.8.2;

import "loyalty-tokens/contracts/BIP20/IBIP20DelegatedTransfer.sol";
import "../interfaces/ILedger.sol";
import "../interfaces/IBridgeValidator.sol";

contract LoyaltyBridgeStorage {
    struct DepositData {
        address account;
        uint256 amount;
    }
    mapping(bytes32 => DepositData) internal deposits;

    struct WithdrawData {
        address account;
        uint256 amount;
        bool executed;
    }
    mapping(bytes32 => WithdrawData) internal withdraws;
    mapping(bytes32 => mapping(address => bool)) internal confirmations;

    address internal foundationAccount;
    ILedger internal ledgerContract;
    bool internal isSetLedger;
    IBridgeValidator internal validatorContract;
    IBIP20DelegatedTransfer internal tokenContract;
}
