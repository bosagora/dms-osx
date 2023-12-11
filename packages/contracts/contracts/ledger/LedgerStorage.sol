// SPDX-License-Identifier: AGPL-3.0-or-later

pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "del-osx-artifacts-v2/contracts/PhoneLinkCollection.sol";

import "../certifier/Certifier.sol";
import "../currency/CurrencyRate.sol";
import "../validator/Validator.sol";
import "../shop/Shop.sol";

contract LedgerStorage {
    enum LoyaltyType {
        POINT,
        TOKEN
    }

    enum LoyaltyPaymentStatus {
        INVALID,
        OPENED_PAYMENT,
        CLOSED_PAYMENT,
        FAILED_PAYMENT,
        OPENED_CANCEL,
        CLOSED_CANCEL,
        FAILED_CANCEL
    }

    /// @notice Hash value of a blank string
    bytes32 public constant NULL = 0x32105b1d0b88ada155176b58ee08b45c31e4f2f7337475831982c313533b880c;
    uint32 public constant MAX_FEE = 5;

    mapping(bytes32 => uint256) internal unPayablePointBalances;
    mapping(address => uint256) internal pointBalances;
    mapping(address => uint256) internal tokenBalances;
    mapping(address => uint256) internal nonce;
    mapping(address => LoyaltyType) internal loyaltyTypes;

    struct LoyaltyPaymentData {
        bytes32 paymentId;
        string purchaseId;
        string currency;
        bytes32 shopId;
        address account;
        uint256 timestamp;
        LoyaltyType loyaltyType;
        uint256 paidPoint;
        uint256 paidToken;
        uint256 paidValue;
        uint256 feePoint;
        uint256 feeToken;
        uint256 feeValue;
        uint256 usedValueShop;
        LoyaltyPaymentStatus status;
    }
    mapping(bytes32 => LoyaltyPaymentData) internal loyaltyPayments;

    address public foundationAccount;
    address public settlementAccount;
    address public feeAccount;
    uint32 public fee;
    address public temporaryAddress;

    IERC20 internal tokenContract;
    Validator internal validatorContract;
    PhoneLinkCollection internal linkContract;
    CurrencyRate internal currencyRateContract;
    Shop internal shopContract;
    Certifier internal certifierContract;
}
