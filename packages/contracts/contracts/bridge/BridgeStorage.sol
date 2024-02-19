// SPDX-License-Identifier: AGPL-3.0-or-later

pragma solidity ^0.8.2;

import "loyalty-tokens/contracts/BIP20/IBIP20DelegatedTransfer.sol";

import "../interfaces/IBridgeValidator.sol";

contract BridgeStorage {
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

    mapping(address => uint256) internal liquidity;

    IBIP20DelegatedTransfer internal tokenContract;
    IBridgeValidator internal validatorContract;
}
