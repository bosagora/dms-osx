// SPDX-License-Identifier: AGPL-3.0-or-later

pragma solidity ^0.8.20;

import "../certifier/Certifier.sol";
import "../currency/CurrencyRate.sol";

/// @notice 상점컬랙션
contract ShopStorage {
    /// @notice 검증자의 상태코드
    enum WithdrawStatus {
        CLOSE,
        OPEN
    }

    struct WithdrawData {
        uint256 id;
        uint256 amount;
        WithdrawStatus status;
    }

    /// @notice 검증자의 상태코드
    enum ShopStatus {
        INVALID,
        ACTIVE,
        INACTIVE
    }

    /// @notice 상점의 데이터
    struct ShopData {
        bytes32 shopId; // 상점 아이디
        string name; // 상점 이름
        string currency; // 상점의 결제 통화
        uint256 provideWaitTime; // 제품구매 후 포인트 지급시간
        uint256 providePercent; // 구매금액에 대한 포인트 지급량
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

    mapping(bytes32 => ShopData) internal shops;
    mapping(address => bytes32[]) internal shopIdByAddress;

    bytes32[] internal items;

    address public ledgerAddress;
    address public deployer;
    mapping(address => uint256) internal nonce;

    Certifier internal certifier;
    CurrencyRate internal currencyRate;
}
