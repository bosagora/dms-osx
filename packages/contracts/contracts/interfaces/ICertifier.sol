// SPDX-License-Identifier: AGPL-3.0-or-later

pragma solidity ^0.8.2;

interface ICertifier {
    function isCertifier(address account) external view returns (bool);
}
