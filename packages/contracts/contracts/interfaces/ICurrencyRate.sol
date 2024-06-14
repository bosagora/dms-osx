// SPDX-License-Identifier: AGPL-3.0-or-later

pragma solidity ^0.8.2;

interface ICurrencyRate {
    struct CurrencyData {
        string symbol;
        uint256 rate;
    }

    function set(
        uint256 _timestamp,
        CurrencyData[] calldata _data,
        bytes[] calldata _signatures,
        bytes calldata _proposerSignature
    ) external;

    function get(string calldata _symbol) external view returns (uint256);

    function support(string memory _symbol) external view returns (bool);

    function convertPointToToken(uint256 amount) external view returns (uint256);

    function convertTokenToPoint(uint256 amount) external view returns (uint256);

    function convertCurrencyToPoint(uint256 _amount, string calldata _symbol) external view returns (uint256);

    function convertCurrencyToToken(uint256 _amount, string calldata _symbol) external view returns (uint256);

    function convertCurrency(
        uint256 _amount,
        string calldata _symbol1,
        string calldata _symbol2
    ) external view returns (uint256);

    function multiple() external view returns (uint256);
}
