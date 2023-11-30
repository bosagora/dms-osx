// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "./ValidatorCollection.sol";

/// @notice 토큰 가격을 제공하는 스마트컨트랙트
contract CurrencyRate {
    bytes32 public constant BASE_CURRENCY = keccak256(abi.encodePacked("krw"));
    bytes32 public constant NULL_CURRENCY = keccak256(abi.encodePacked(""));
    uint256 public constant MULTIPLE = 1000000000;
    mapping(string => uint256) private prices;

    ValidatorCollection private validatorCollection;
    string private tokenSymbol;

    /// @notice 환률이 저장될 때 발생되는 이벤트
    event SetRate(string currency, uint256 rate);

    /// @notice 생성자
    /// @param _validatorAddress 검증자컬랙션의 주소
    constructor(address _validatorAddress, string memory _tokenSymbol) {
        validatorCollection = ValidatorCollection(_validatorAddress);
        tokenSymbol = _tokenSymbol;

        prices["krw"] = MULTIPLE;
        prices["point"] = MULTIPLE;
    }

    modifier onlyValidator(address _account) {
        require(validatorCollection.isActiveValidator(_account), "1000");
        _;
    }

    /// @notice 통화에 대한 가격을 저장한다.
    /// @param _symbol 통화명
    /// @param _price 토큰의 가격
    function set(string calldata _symbol, uint256 _price) external onlyValidator(msg.sender) {
        prices[_symbol] = _price;

        emit SetRate(_symbol, _price);
    }

    /// @notice 통화에 대한 가격을 제공한다.
    /// @param _symbol 통화명
    function get(string calldata _symbol) external view returns (uint256) {
        return _get(_symbol);
    }

    /// @notice 통화에 대한 가격을 제공한다.
    /// @param _symbol 통화명
    function _get(string memory _symbol) internal view returns (uint256) {
        uint256 p = prices[_symbol];
        require(p != 0, "1211");
        return p;
    }

    /// @notice 통화심벌을 제공하는지 검사한다.
    function support(string memory _symbol) external view returns (bool) {
        return prices[_symbol] != 0;
    }

    /// @notice 포인트를 토큰으로 환산한다.
    function convertPointToToken(uint256 amount) external view returns (uint256) {
        return (amount * MULTIPLE) / _get(tokenSymbol);
    }

    /// @notice 토큰을 포인트로 환산한다.
    function convertTokenToPoint(uint256 amount) external view returns (uint256) {
        return (amount * _get(tokenSymbol)) / MULTIPLE;
    }

    /// @notice 화폐를 포인트로 환산한다.
    function convertCurrencyToPoint(uint256 _amount, string calldata _symbol) external view returns (uint256) {
        bytes32 byteCurrency = keccak256(abi.encodePacked(_symbol));
        if ((byteCurrency == BASE_CURRENCY) || (byteCurrency == NULL_CURRENCY)) {
            return _amount;
        } else {
            return (_amount * _get(_symbol)) / MULTIPLE;
        }
    }

    /// @notice 화폐를 토큰으로 환산한다.
    function convertCurrencyToToken(uint256 _amount, string calldata _symbol) external view returns (uint256) {
        return _convertCurrency(_amount, _symbol, tokenSymbol);
    }

    /// @notice 화폐들을 환산한다.
    function convertCurrency(
        uint256 _amount,
        string calldata _symbol1,
        string calldata _symbol2
    ) external view returns (uint256) {
        return _convertCurrency(_amount, _symbol1, _symbol2);
    }

    function _convertCurrency(
        uint256 _amount,
        string memory _symbol1,
        string memory _symbol2
    ) internal view returns (uint256) {
        bytes32 bSymbol1 = keccak256(abi.encodePacked(_symbol1));
        bytes32 bSymbol2 = keccak256(abi.encodePacked(_symbol2));
        if (bSymbol1 == bSymbol2) return _amount;
        uint256 rate1 = ((bSymbol1 == BASE_CURRENCY) || (bSymbol1 == NULL_CURRENCY)) ? MULTIPLE : _get(_symbol1);
        uint256 rate2 = ((bSymbol2 == BASE_CURRENCY) || (bSymbol2 == NULL_CURRENCY)) ? MULTIPLE : _get(_symbol2);
        return (_amount * rate1) / rate2;
    }
}
