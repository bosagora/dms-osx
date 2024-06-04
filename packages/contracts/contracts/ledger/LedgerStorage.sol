// SPDX-License-Identifier: AGPL-3.0-or-later

pragma solidity ^0.8.2;

import "loyalty-tokens/contracts/BIP20/IBIP20DelegatedTransfer.sol";
import "../interfaces/IPhoneLinkCollection.sol";

import "../interfaces/ICurrencyRate.sol";
import "../interfaces/ILedger.sol";

contract LedgerStorage {
    /// @notice Hash value of a blank string
    uint32 public constant MAX_FEE = 500;

    mapping(bytes32 => uint256) internal unPayablePointBalances;
    mapping(address => uint256) internal pointBalances;
    mapping(address => uint256) internal tokenBalances;
    mapping(address => uint256) internal nonce;
    mapping(address => uint256) internal liquidity;

    address public foundationAccount;
    address public settlementAccount;
    address public feeAccount;
    address public txFeeAccount;
    address public providerAddress;
    address public consumerAddress;
    address public exchangerAddress;
    address public burnerAddress;
    address public transferAddress;
    address public bridgeAddress;
    address public tokenAddress;
    address public shopAddress;

    uint32 internal fee;
    address internal temporaryAddress;

    IPhoneLinkCollection internal linkContract;
    IBIP20DelegatedTransfer internal tokenContract;
    ICurrencyRate internal currencyRateContract;
    bytes32 internal tokenId;
}
