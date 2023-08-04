// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

///
contract ValidatorCollection {

    struct ValidatorData {
        address account;
        uint256 startTimestamp;
        uint256 balance;
        uint256 status;
    }

    ValidatorData[] public items;
}
