// SPDX-License-Identifier: AGPL-3.0-or-later

pragma solidity ^0.8.20;

interface ILedger {
    enum LoyaltyType {
        POINT,
        TOKEN
    }

    function changeToPayablePoint(bytes32 _phone, address _account, bytes calldata _signature) external;
    function changeToLoyaltyToken(address _account, bytes calldata _signature) external;
    function providePoint(
        address _account,
        uint256 _loyaltyPoint,
        uint256 _loyaltyValue,
        string calldata _currency,
        string calldata _purchaseId,
        bytes32 _shopId
    ) external;
    function provideUnPayablePoint(
        bytes32 _phone,
        uint256 _loyaltyPoint,
        uint256 _loyaltyValue,
        string calldata _currency,
        string calldata _purchaseId,
        bytes32 _shopId
    ) external;
    function provideToken(
        address _account,
        uint256 _loyaltyPoint,
        uint256 _loyaltyValue,
        string calldata _currency,
        string calldata _purchaseId,
        bytes32 _shopId
    ) external;
    function unPayablePointBalanceOf(bytes32 _hash) external view returns (uint256);
    function pointBalanceOf(address _account) external view returns (uint256);
    function tokenBalanceOf(address _account) external view returns (uint256);
    function nonceOf(address _account) external view returns (uint256);
    function loyaltyTypeOf(address _account) external view returns (LoyaltyType);
}
