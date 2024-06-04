// SPDX-License-Identifier: AGPL-3.0-or-later

pragma solidity ^0.8.2;

interface IShop {
    enum ShopStatus {
        INVALID,
        ACTIVE,
        INACTIVE
    }
    struct ShopData {
        bytes32 shopId; // 상점 아이디
        string name; // 상점 이름
        string currency; // 상점의 결제 통화
        address account; // 상점주의 지갑주소
        address delegator; // 위임자의 지갑주소
        uint256 providedAmount; // 제공된 결제통화의 총량
        uint256 usedAmount; // 사용된 결제통화의 총량
        uint256 refundedAmount; // 정산된 결제통화의 총량
        ShopStatus status;
        uint256 itemIndex;
        uint256 accountIndex;
    }

    function setLedger(address _contractAddress) external;

    function isAvailableId(bytes32 _shopId) external view returns (bool);

    function addProvidedAmount(bytes32 _shopId, uint256 _value, string calldata _purchaseId) external;

    function addUsedAmount(bytes32 _shopId, uint256 _value, string calldata _purchaseId, bytes32 _paymentId) external;

    function subUsedAmount(bytes32 _shopId, uint256 _value, string calldata _purchaseId, bytes32 _paymentId) external;

    function shopOf(bytes32 _shopId) external view returns (ShopData memory);

    function getShopsOfAccount(address _account, uint256 _from, uint256 _to) external view returns (bytes32[] memory);

    function getShopsCountOfAccount(address _account) external view returns (uint256);

    function refundableOf(bytes32 _shopId) external view returns (uint256 refundableAmount, uint256 refundableToken);

    function nonceOf(address _account) external view returns (uint256);
}
