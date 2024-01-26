// SPDX-License-Identifier: AGPL-3.0-or-later

pragma solidity ^0.8.2;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "del-osx-artifacts/contracts/interfaces/IPhoneLinkCollection.sol";

import "../interfaces/ICurrencyRate.sol";
import "../interfaces/ILedger.sol";

contract LedgerStorage {
    /// @notice Hash value of a blank string
    uint32 public constant MAX_FEE = 500;

    mapping(bytes32 => uint256) internal unPayablePointBalances;
    mapping(address => uint256) internal pointBalances;
    mapping(address => uint256) internal tokenBalances;
    mapping(address => uint256) internal nonce;
    mapping(address => ILedger.LoyaltyType) internal loyaltyTypes;

    address public foundationAccount;
    address public settlementAccount;
    address public feeAccount;
    address public providerAddress;
    address public consumerAddress;
    address public exchangerAddress;
    address public burnerAddress;
    address public transferAddress;

    uint32 internal fee;
    address internal temporaryAddress;

    IPhoneLinkCollection internal linkContract;
    IERC20 internal tokenContract;
    ICurrencyRate internal currencyRateContract;
}
