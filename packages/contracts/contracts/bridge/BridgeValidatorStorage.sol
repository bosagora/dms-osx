// SPDX-License-Identifier: AGPL-3.0-or-later

pragma solidity ^0.8.2;

contract BridgeValidatorStorage {
    address[] internal items;
    mapping(address => bool) internal validators;
    uint256 internal required;
}
