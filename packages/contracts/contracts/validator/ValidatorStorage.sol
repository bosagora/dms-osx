// SPDX-License-Identifier: AGPL-3.0-or-later

pragma solidity ^0.8.2;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import "../interfaces/IValidator.sol";

contract ValidatorStorage {
    uint256 public constant MINIMUM_DEPOSIT_AMOUNT = 100000 ether;
    IERC20 internal token;
    address[] internal items;
    address[] internal activeItems;
    mapping(address => IValidator.ValidatorData) internal validators;
}
