// SPDX-License-Identifier: AGPL-3.0-or-later

pragma solidity ^0.8.2;

import "loyalty-tokens/contracts/BIP20/IBIP20DelegatedTransfer.sol";

import "../interfaces/IBridge.sol";
import "../interfaces/IBridgeValidator.sol";

contract BridgeStorage {
    mapping(bytes32 => IBridge.DepositData) internal deposits;
    mapping(bytes32 => IBridge.WithdrawData) internal withdraws;
    mapping(bytes32 => mapping(address => bool)) internal confirmations;
    mapping(address => uint256) internal liquidity;

    address internal feeAccount;

    uint256 internal fee;

    IBIP20DelegatedTransfer internal tokenContract;
    IBridgeValidator internal validatorContract;
}
