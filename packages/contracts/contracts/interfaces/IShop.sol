// SPDX-License-Identifier: AGPL-3.0-or-later

pragma solidity ^0.8.2;

interface IShop {
    enum WithdrawStatus {
        CLOSE,
        OPEN
    }
    struct WithdrawData {
        uint256 id;
        uint256 amount;
        WithdrawStatus status;
    }
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
        uint256 providedAmount; // 제공된 결제통화의 총량
        uint256 usedAmount; // 사용된 결제통화의 총량
        uint256 settledAmount; // 정산된 결제통화의 총량
        uint256 withdrawnAmount; // 정산된 결제통화의 총량
        ShopStatus status;
        WithdrawData withdrawData;
        uint256 itemIndex;
        uint256 accountIndex;
    }

    function isAvailableId(bytes32 _shopId) external view returns (bool);

    function addProvidedAmount(bytes32 _shopId, uint256 _value, string calldata _purchaseId) external;

    function addUsedAmount(bytes32 _shopId, uint256 _value, string calldata _purchaseId, bytes32 _paymentId) external;

    function subUsedAmount(bytes32 _shopId, uint256 _value, string calldata _purchaseId, bytes32 _paymentId) external;

    function addSettledAmount(bytes32 _shopId, uint256 _value, string calldata _purchaseId) external;

    function getSettlementAmount(bytes32 _shopId) external view returns (uint256);

    function shopOf(bytes32 _shopId) external view returns (ShopData memory);

    function withdrawableOf(bytes32 _shopId) external view returns (uint256);

    function nonceOf(address _account) external view returns (uint256);
}
