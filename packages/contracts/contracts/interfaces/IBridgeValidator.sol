// SPDX-License-Identifier: AGPL-3.0-or-later

pragma solidity ^0.8.2;

interface IBridgeValidator {
    function isValidator(address _account) external view returns (bool);

    function getLength() external view returns (uint256);

    function getRequired() external view returns (uint256);

    function itemOf(uint256 _idx) external view returns (address);
}
