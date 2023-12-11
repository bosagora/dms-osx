// SPDX-License-Identifier: AGPL-3.0-or-later

pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "del-osx-artifacts-v2/contracts/interfaces/IPhoneLinkCollection.sol";

import "../interfaces/ICertifier.sol";
import "../interfaces/ICurrencyRate.sol";
import "../interfaces/IValidator.sol";
import "../interfaces/IShop.sol";
import "../interfaces/ILedger.sol";

contract LedgerStorage {
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
    uint32 public constant MAX_FEE = 5;

    mapping(bytes32 => uint256) internal unPayablePointBalances;
    mapping(address => uint256) internal pointBalances;
    mapping(address => uint256) internal tokenBalances;
    mapping(address => uint256) internal nonce;
    mapping(address => ILedger.LoyaltyType) internal loyaltyTypes;

    struct LoyaltyPaymentData {
        bytes32 paymentId;
        string purchaseId;
        string currency;
        bytes32 shopId;
        address account;
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
    mapping(bytes32 => LoyaltyPaymentData) internal loyaltyPayments;

    address public foundationAccount;
    address public settlementAccount;
    address public feeAccount;
    address public providerAddress;
    address public consumerAddress;
    uint32 public fee;
    address public temporaryAddress;

    IPhoneLinkCollection internal linkContract;
    IERC20 internal tokenContract;
    IValidator internal validatorContract;
    ICurrencyRate internal currencyRateContract;
    IShop internal shopContract;
    ICertifier internal certifierContract;
}
