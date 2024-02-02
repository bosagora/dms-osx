// SPDX-License-Identifier: AGPL-3.0-or-later

pragma solidity ^0.8.2;

import "../interfaces/ICurrencyRate.sol";
import "../interfaces/IShop.sol";
import "../interfaces/ILedger.sol";

contract LoyaltyConsumerStorage {
    enum LoyaltyPaymentStatus {
        INVALID,
        OPENED_PAYMENT,
        CLOSED_PAYMENT,
        FAILED_PAYMENT,
        OPENED_CANCEL,
        CLOSED_CANCEL,
        FAILED_CANCEL
    }

    struct LoyaltyPaymentData {
        bytes32 paymentId;
        string purchaseId;
        string currency;
        bytes32 shopId;
        address account;
        bytes32 secretLock;
        uint256 timestamp;
        ILedger.LoyaltyType loyaltyType;
        uint256 paidPoint;
        uint256 paidToken;
        uint256 paidValue;
        uint256 feePoint;
        uint256 feeToken;
        uint256 feeValue;
        uint256 usedValueShop;
        LoyaltyPaymentStatus status;
    }

    address internal foundationAccount;
    address internal settlementAccount;
    address internal feeAccount;
    address internal temporaryAddress;

    ICurrencyRate internal currencyRateContract;
    IShop internal shopContract;
    ILedger internal ledgerContract;

    bool internal isSetLedger;
    bool internal isSetShop;

    mapping(bytes32 => LoyaltyPaymentData) internal loyaltyPayments;
}
