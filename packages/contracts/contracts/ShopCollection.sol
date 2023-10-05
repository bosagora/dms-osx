// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "./ValidatorCollection.sol";

/// @notice 상점컬랙션
contract ShopCollection {
    /// @notice 검증자의 상태코드
    enum WithdrawStatus {
        CLOSE,
        OPEN
    }

    struct WithdrawData {
        uint256 amount;
        address account;
        WithdrawStatus status;
    }

    /// @notice 검증자의 상태코드
    enum ShopStatus {
        INVALID,
        ACTIVE
    }

    /// @notice 상점의 데이터
    struct ShopData {
        string shopId; // 상점 아이디
        uint256 provideWaitTime; // 제품구매 후 포인트 지급시간
        uint256 providePercent; // 구매금액에 대한 포인트 지급량
        address account; // 상점주의 지갑주소
        uint256 providedPoint; // 제공된 포인트 총량
        uint256 usedPoint; // 사용된 포인트 총량
        uint256 settledPoint; // 정산된 포인트 총량
        uint256 withdrawnPoint; // 정산된 포인트 총량
        ShopStatus status;
        WithdrawData withdrawData;
    }

    mapping(string => ShopData) private shops;

    string[] private items;

    address public validatorAddress;

    ValidatorCollection private validatorCollection;

    /// @notice 상점이 추가될 때 발생되는 이벤트
    event AddedShop(string shopId, uint256 provideWaitTime, uint256 providePercent, address account);
    /// @notice 상점의 포인트가 증가할 때 발생되는 이벤트
    event IncreasedProvidedPoint(string shopId, uint256 increase, uint256 total, string purchaseId);
    /// @notice 사용자의 포인트가 증가할 때 발생되는 이벤트
    event IncreasedUsedPoint(string shopId, uint256 increase, uint256 total, string purchaseId);
    /// @notice 정산된 마일리가 증가할 때 발생되는 이벤트
    event IncreasedSettledPoint(string shopId, uint256 increase, uint256 total, string purchaseId);

    event OpenedWithdrawal(string shopId, uint256 amount, address account);
    event ClosedWithdrawal(string shopId, uint256 amount, address account);

    address public ledgerAddress;
    address public deployer;

    /// @notice 생성자
    /// @param _validatorAddress 검증자컬랙션의 주소
    constructor(address _validatorAddress) {
        validatorAddress = _validatorAddress;

        validatorCollection = ValidatorCollection(_validatorAddress);

        ledgerAddress = address(0x00);
        deployer = msg.sender;
    }

    /// @notice 원장 컨트랙트의 주소를 호출한다.
    function setLedgerAddress(address _ledgerAddress) public {
        require(msg.sender == deployer, "No permissions");
        ledgerAddress = _ledgerAddress;
        deployer = address(0x00);
    }

    /// @notice 검증자들만 호출할 수 있도록 해준다.
    modifier onlyValidator(address _account) {
        require(validatorCollection.isActiveValidator(_account), "Not validator");
        _;
    }

    /// @notice 원장 컨트랙트에서만 호출될 수 있도록 해준다.
    modifier onlyLedger() {
        require(msg.sender == ledgerAddress, "Not ledger");
        _;
    }

    /// @notice 상점을 추가한다
    /// @param _shopId 상점 아이디
    /// @param _provideWaitTime 제품구매 후 포인트가 지급될 시간
    /// @param _providePercent 구매금액에 대한 포인트 지급량
    function add(
        string calldata _shopId,
        uint256 _provideWaitTime,
        uint256 _providePercent,
        address _account
    ) public onlyValidator(msg.sender) {
        _add(_shopId, _provideWaitTime, _providePercent, _account);
    }

    function _add(
        string calldata _shopId,
        uint256 _provideWaitTime,
        uint256 _providePercent,
        address _account
    ) internal {
        require(_account != address(0x0), "Invalid address");
        require(shops[_shopId].status == ShopStatus.INVALID, "Invalid shopId");

        ShopData memory data = ShopData({
            shopId: _shopId,
            provideWaitTime: _provideWaitTime,
            providePercent: _providePercent,
            account: _account,
            providedPoint: 0,
            usedPoint: 0,
            settledPoint: 0,
            withdrawnPoint: 0,
            status: ShopStatus.ACTIVE,
            withdrawData: WithdrawData({ amount: 0, account: address(0x0), status: WithdrawStatus.CLOSE })
        });
        items.push(_shopId);
        shops[_shopId] = data;
        emit AddedShop(_shopId, _provideWaitTime, _providePercent, _account);
    }

    /// @notice 지급된 총 마일지리를 누적한다
    function addProvidedPoint(string calldata _shopId, uint256 _amount, string calldata _purchaseId) public onlyLedger {
        if (shops[_shopId].status != ShopStatus.INVALID) {
            shops[_shopId].providedPoint += _amount;
            emit IncreasedProvidedPoint(_shopId, _amount, shops[_shopId].providedPoint, _purchaseId);
        }
    }

    /// @notice 사용된 총 마일지리를 누적한다
    function addUsedPoint(string calldata _shopId, uint256 _amount, string calldata _purchaseId) public onlyLedger {
        if (shops[_shopId].status != ShopStatus.INVALID) {
            shops[_shopId].usedPoint += _amount;
            emit IncreasedUsedPoint(_shopId, _amount, shops[_shopId].usedPoint, _purchaseId);
        }
    }

    /// @notice 정산된 총 마일지리를 누적한다
    function addSettledPoint(string calldata _shopId, uint256 _amount, string calldata _purchaseId) public onlyLedger {
        if (shops[_shopId].status != ShopStatus.INVALID) {
            shops[_shopId].settledPoint += _amount;
            emit IncreasedSettledPoint(_shopId, _amount, shops[_shopId].settledPoint, _purchaseId);
        }
    }

    /// @notice 정산되어야 할 마일지리의 량을 리턴합니다.
    function getSettlementPoint(string calldata _shopId) public view returns (uint256) {
        if (shops[_shopId].status == ShopStatus.ACTIVE) {
            ShopData memory data = shops[_shopId];
            if (data.providedPoint + data.settledPoint < data.usedPoint) {
                return (data.usedPoint - data.providedPoint - data.settledPoint);
            } else {
                return 0;
            }
        } else {
            return 0;
        }
    }

    /// @notice 상점 데이터를 리턴한다
    /// @param _shopId 상점의 아이디
    function shopOf(string calldata _shopId) public view returns (ShopData memory) {
        return shops[_shopId];
    }

    /// @notice 상점의 아이디를 리턴한다
    /// @param _idx 배열의 순번
    function shopIdOf(uint256 _idx) public view returns (string memory) {
        return items[_idx];
    }

    /// @notice 상점의 갯수를 리턴한다
    function shopsLength() public view returns (uint256) {
        return items.length;
    }

    /// @notice 인출가능한 정산금액을 리턴한다.
    /// @param _shopId 상점의 아이디
    function withdrawableOf(string calldata _shopId) public view returns (uint256) {
        ShopData memory shop = shops[_shopId];
        return shop.settledPoint - shop.withdrawnPoint;
    }

    /// @notice 정산금의 인출을 요청한다. 상점주인만이 실행가능
    /// @param _shopId 상점아이디
    /// @param _amount 인출금
    function openWithdrawal(string calldata _shopId, uint256 _amount) public {
        ShopData memory shop = shops[_shopId];

        require(shop.account == msg.sender, "Invalid address");

        require(_amount <= shop.settledPoint - shop.withdrawnPoint, "Insufficient withdrawal amount");
        require(shop.withdrawData.status == WithdrawStatus.CLOSE, "Already opened");

        shops[_shopId].withdrawData.account = msg.sender;
        shops[_shopId].withdrawData.amount = _amount;
        shops[_shopId].withdrawData.status = WithdrawStatus.OPEN;

        emit OpenedWithdrawal(_shopId, _amount, msg.sender);
    }

    /// @notice 정산금의 인출을 마감한다. 상점주인만이 실행가능
    /// @param _shopId 상점아이디
    function closeWithdrawal(string calldata _shopId) public {
        ShopData memory shop = shops[_shopId];

        require(shop.account == msg.sender, "Invalid address");

        require(shop.withdrawData.status == WithdrawStatus.OPEN, "Not opened");

        shops[_shopId].withdrawData.status = WithdrawStatus.CLOSE;
        shops[_shopId].withdrawnPoint += shop.withdrawData.amount;

        emit ClosedWithdrawal(_shopId, shops[_shopId].withdrawData.amount, msg.sender);
    }
}
