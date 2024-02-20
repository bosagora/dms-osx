// SPDX-License-Identifier: AGPL-3.0-or-later

pragma solidity ^0.8.2;

interface IBridgeLiquidity {
    function depositLiquidity(uint256 _amount, bytes calldata _signature) external;

    function withdrawLiquidity(uint256 _amount) external;

    function getLiquidity(address _account) external view returns (uint256);
}
