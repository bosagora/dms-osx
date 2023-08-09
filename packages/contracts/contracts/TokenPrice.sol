// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "./ValidatorCollection.sol";

/// @notice 토큰 가격을 제공하는 스마트컨트랙트
contract TokenPrice {
    uint256 public constant MULTIPLE = 1000000000;
    mapping(string => uint256) public prices;

    address public validatorAddress;
    ValidatorCollection private validatorCollection;

    /// @notice 가격이 저장될 때 발생되는 이벤트
    event SetPrice(string currency, uint256 price);

    /// @notice 생성자
    /// @param _validatorAddress 검증자컬랙션의 주소
    constructor(address _validatorAddress) {
        validatorAddress = _validatorAddress;

        validatorCollection = ValidatorCollection(_validatorAddress);
    }

    modifier onlyValidator(address _account) {
        bool isValidator = false;
        for (uint256 i = 0; i < validatorCollection.getActiveItemsLength(); ++i) {
            if (_account == validatorCollection.activeItems(i)) {
                isValidator = true;
                break;
            }
        }
        require(isValidator, "Not validator");
        _;
    }

    /// @notice 통화에 대한 가격을 저장한다.
    /// @param _currency 통화명
    /// @param _price 토큰의 가격
    function set(string memory _currency, uint256 _price) public onlyValidator(msg.sender) {
        prices[_currency] = _price;

        emit SetPrice(_currency, _price);
    }

    /// @notice 통화에 대한 가격을 제공한다.
    /// @param _currency 통화명
    function get(string memory _currency) public view returns (uint256) {
        return prices[_currency];
    }
}
