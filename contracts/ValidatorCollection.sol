// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

///
contract ValidatorCollection {

    enum Status {
        INVALID,
        ACTIVE,
        STOP,
        EXIT
    }

    struct ValidatorData {
        address account;
        uint256 startTimestamp;
        uint256 balance;
        Status status;
    }

    ValidatorData[] public items;
}
