// SPDX-License-Identifier: AGPL-3.0-or-later

pragma solidity ^0.8.20;

interface ILedger {
    enum LoyaltyType {
        POINT,
        TOKEN
    }

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
    function provideSettlement(
        address _account,
        bytes32 _shopId,
        uint256 _providedPoint,
        uint256 _providedToken,
        uint256 _providedValue,
        string calldata _currency,
        string calldata _purchaseId
    ) external;
    function changeToPayablePoint(bytes32 _phone, address _account) external;
    function addPointBalance(address _account, uint256 _amount) external;
    function subPointBalance(address _account, uint256 _amount) external;
    function addTokenBalance(address _account, uint256 _amount) external;
    function subTokenBalance(address _account, uint256 _amount) external;
    function transferToken(address _from, address _to, uint256 _amount) external;
    function unPayablePointBalanceOf(bytes32 _hash) external view returns (uint256);
    function pointBalanceOf(address _account) external view returns (uint256);
    function tokenBalanceOf(address _account) external view returns (uint256);
    function nonceOf(address _account) external view returns (uint256);
    function increaseNonce(address _account) external;
    function loyaltyTypeOf(address _account) external view returns (LoyaltyType);
    function changeToLoyaltyToken(address _account) external;
    function setFee(uint32 _fee) external;
    function getFee() external view returns (uint32);
    function getFoundationAccount() external view returns (address);
    function getSettlementAccount() external view returns (address);
    function getFeeAccount() external view returns (address);
}
