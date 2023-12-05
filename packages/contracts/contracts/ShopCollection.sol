// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "./CertifierCollection.sol";
import "./CurrencyRate.sol";

/// @notice 상점컬랙션
contract ShopCollection {
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

    mapping(bytes32 => ShopData) private shops;
    mapping(address => bytes32[]) private shopIdByAddress;

    bytes32[] private items;

    /// @notice 상점이 추가될 때 발생되는 이벤트
    event AddedShop(
        bytes32 shopId,
        string name,
        string currency,
        uint256 provideWaitTime,
        uint256 providePercent,
        address account,
        ShopStatus status
    );
    /// @notice 상점의 정보가 변경될 때 발생되는 이벤트
    event UpdatedShop(
        bytes32 shopId,
        string name,
        string currency,
        uint256 provideWaitTime,
        uint256 providePercent,
        address account,
        ShopStatus status
    );
    /// @notice 상점의 정보가 변경될 때 발생되는 이벤트
    event ChangedShopStatus(bytes32 shopId, ShopStatus status);
    /// @notice 상점에서 제공한 마일리지가 증가할 때 발생되는 이벤트
    event IncreasedProvidedAmount(bytes32 shopId, uint256 increase, uint256 total, string currency, string purchaseId);
    /// @notice 상점에서 사용된 마일리지가 증가할 때 발생되는 이벤트
    event IncreasedUsedAmount(
        bytes32 shopId,
        uint256 increase,
        uint256 total,
        string currency,
        string purchaseId,
        bytes32 paymentId
    );
    /// @notice 상점에서 사용된 마일리지가 취소될 때 발생되는 이벤트
    event DecreasedUsedAmount(
        bytes32 shopId,
        uint256 increase,
        uint256 total,
        string currency,
        string purchaseId,
        bytes32 paymentId
    );
    /// @notice 정산된 마일리지가 증가할 때 발생되는 이벤트
    event IncreasedSettledAmount(bytes32 shopId, uint256 increase, uint256 total, string currency, string purchaseId);

    event OpenedWithdrawal(bytes32 shopId, uint256 amount, string currency, address account, uint256 withdrawId);
    event ClosedWithdrawal(
        bytes32 shopId,
        uint256 amount,
        uint256 total,
        string currency,
        address account,
        uint256 withdrawId
    );

    address public ledgerAddress;
    address public deployer;
    mapping(address => uint256) private nonce;

    CertifierCollection private certifierCollection;
    CurrencyRate private currencyRate;

    /// @notice 생성자
    constructor(address _certifierAddress, address _currencyRateAddress) {
        certifierCollection = CertifierCollection(_certifierAddress);
        currencyRate = CurrencyRate(_currencyRateAddress);

        ledgerAddress = address(0x00);
        deployer = msg.sender;
    }

    /// @notice 원장 컨트랙트의 주소를 호출한다.
    function setLedgerAddress(address _ledgerAddress) public {
        require(msg.sender == deployer, "1050");
        ledgerAddress = _ledgerAddress;
        deployer = address(0x00);
    }

    /// @notice 원장 컨트랙트에서만 호출될 수 있도록 해준다.
    modifier onlyLedger() {
        require(msg.sender == ledgerAddress, "1050");
        _;
    }

    /// @notice 이용할 수 있는 아이디 인지 알려준다.
    /// @param _shopId 상점 아이디
    function isAvailableId(bytes32 _shopId) public view returns (bool) {
        if (shops[_shopId].status == ShopStatus.INVALID) return true;
        else return false;
    }

    /// @notice 상점을 추가한다
    /// @param _shopId 상점 아이디
    /// @param _name 상점이름
    /// @dev 중계서버를 통해서 호출됩니다.
    function add(
        bytes32 _shopId,
        string calldata _name,
        string calldata _currency,
        address _account,
        bytes calldata _signature
    ) external {
        require(shops[_shopId].status == ShopStatus.INVALID, "1200");
        require(currencyRate.support(_currency), "1211");
        bytes32 dataHash = keccak256(abi.encode(_shopId, _account, nonce[_account]));
        require(ECDSA.recover(ECDSA.toEthSignedMessageHash(dataHash), _signature) == _account, "1501");

        ShopData memory data = ShopData({
            shopId: _shopId,
            name: _name,
            currency: _currency,
            provideWaitTime: 7 * 86400,
            providePercent: 5,
            account: _account,
            providedAmount: 0,
            usedAmount: 0,
            settledAmount: 0,
            withdrawnAmount: 0,
            status: ShopStatus.INACTIVE,
            withdrawData: WithdrawData({ id: 0, amount: 0, status: WithdrawStatus.CLOSE }),
            itemIndex: items.length,
            accountIndex: shopIdByAddress[_account].length
        });
        items.push(_shopId);
        shops[_shopId] = data;
        shopIdByAddress[_account].push(_shopId);

        nonce[_account]++;

        ShopData memory shop = shops[_shopId];
        emit AddedShop(
            shop.shopId,
            shop.name,
            shop.currency,
            shop.provideWaitTime,
            shop.providePercent,
            shop.account,
            shop.status
        );
    }

    /// @notice 상점정보를 수정합니다
    /// @param _shopId 상점 아이디
    /// @param _name 상점이름
    /// @param _provideWaitTime 제품구매 후 포인트가 지급될 시간
    /// @param _providePercent 구매금액에 대한 포인트 지급량
    /// @dev 중계서버를 통해서 호출됩니다.
    function update(
        bytes32 _shopId,
        string calldata _name,
        string calldata _currency,
        uint256 _provideWaitTime,
        uint256 _providePercent,
        address _account,
        bytes calldata _signature
    ) external {
        bytes32 id = _shopId;
        require(shops[id].status != ShopStatus.INVALID, "1201");
        require(currencyRate.support(_currency), "1211");
        require(shops[id].account == _account, "1050");

        require(certifierCollection.isCertifier(msg.sender), "1505");

        bytes32 dataHash = keccak256(abi.encode(id, _account, nonce[_account]));
        require(ECDSA.recover(ECDSA.toEthSignedMessageHash(dataHash), _signature) == _account, "1501");

        shops[id].name = _name;
        shops[id].provideWaitTime = _provideWaitTime;
        shops[id].providePercent = _providePercent;
        if (keccak256(abi.encodePacked(shops[id].currency)) != keccak256(abi.encodePacked(_currency))) {
            shops[id].providedAmount = currencyRate.convertCurrency(
                shops[id].providedAmount,
                shops[id].currency,
                _currency
            );
            shops[id].usedAmount = currencyRate.convertCurrency(shops[id].usedAmount, shops[id].currency, _currency);
            shops[id].settledAmount = currencyRate.convertCurrency(
                shops[id].settledAmount,
                shops[id].currency,
                _currency
            );
            shops[id].withdrawnAmount = currencyRate.convertCurrency(
                shops[id].withdrawnAmount,
                shops[id].currency,
                _currency
            );
            shops[id].currency = _currency;
        }

        nonce[_account]++;

        emit UpdatedShop(
            shops[id].shopId,
            shops[id].name,
            shops[id].currency,
            shops[id].provideWaitTime,
            shops[id].providePercent,
            shops[id].account,
            shops[id].status
        );
    }

    /// @notice 상점상태를 수정합니다
    /// @param _shopId 상점 아이디
    /// @param _status 상점의 상태
    /// @dev 중계서버를 통해서 호출됩니다.
    function changeStatus(bytes32 _shopId, ShopStatus _status, address _account, bytes calldata _signature) external {
        bytes32 id = _shopId;
        require(_status != ShopStatus.INVALID, "1201");
        require(shops[id].status != ShopStatus.INVALID, "1201");
        require(shops[id].account == _account, "1050");

        require(certifierCollection.isCertifier(msg.sender), "1505");

        bytes32 dataHash = keccak256(abi.encode(id, _account, nonce[_account]));
        require(ECDSA.recover(ECDSA.toEthSignedMessageHash(dataHash), _signature) == _account, "1501");

        shops[id].status = _status;

        nonce[_account]++;

        emit ChangedShopStatus(shops[id].shopId, shops[id].status);
    }

    /// @notice 지갑주소로 등록한 상점의 아이디들을 리턴한다.
    /// @param _account 지갑주소
    function shopsOf(address _account) external view returns (bytes32[] memory) {
        return shopIdByAddress[_account];
    }

    /// @notice 지급된 총 마일지리를 누적한다
    function addProvidedAmount(bytes32 _shopId, uint256 _value, string calldata _purchaseId) external onlyLedger {
        if (shops[_shopId].status != ShopStatus.INVALID) {
            shops[_shopId].providedAmount += _value;
            emit IncreasedProvidedAmount(
                _shopId,
                _value,
                shops[_shopId].providedAmount,
                shops[_shopId].currency,
                _purchaseId
            );
        }
    }

    /// @notice 사용된 총 마일지리를 누적한다
    function addUsedAmount(
        bytes32 _shopId,
        uint256 _value,
        string calldata _purchaseId,
        bytes32 _paymentId
    ) external onlyLedger {
        if (shops[_shopId].status == ShopStatus.ACTIVE) {
            shops[_shopId].usedAmount += _value;
            emit IncreasedUsedAmount(
                _shopId,
                _value,
                shops[_shopId].usedAmount,
                shops[_shopId].currency,
                _purchaseId,
                _paymentId
            );
        }
    }

    /// @notice 사용된 총 마일지리를 빼준다
    function subUsedAmount(
        bytes32 _shopId,
        uint256 _value,
        string calldata _purchaseId,
        bytes32 _paymentId
    ) external onlyLedger {
        if (shops[_shopId].status == ShopStatus.ACTIVE) {
            if (shops[_shopId].usedAmount >= _value) {
                shops[_shopId].usedAmount -= _value;
                emit DecreasedUsedAmount(
                    _shopId,
                    _value,
                    shops[_shopId].usedAmount,
                    shops[_shopId].currency,
                    _purchaseId,
                    _paymentId
                );
            }
        }
    }

    /// @notice 정산된 총 마일지리를 누적한다
    function addSettledAmount(bytes32 _shopId, uint256 _value, string calldata _purchaseId) external onlyLedger {
        if (shops[_shopId].status == ShopStatus.ACTIVE) {
            shops[_shopId].settledAmount += _value;
            emit IncreasedSettledAmount(
                _shopId,
                _value,
                shops[_shopId].settledAmount,
                shops[_shopId].currency,
                _purchaseId
            );
        }
    }

    /// @notice 정산되어야 할 마일지리의 량을 리턴합니다.
    function getSettlementAmount(bytes32 _shopId) external view returns (uint256) {
        if (shops[_shopId].status == ShopStatus.ACTIVE) {
            ShopData memory data = shops[_shopId];
            if (data.providedAmount + data.settledAmount < data.usedAmount) {
                return (data.usedAmount - data.providedAmount - data.settledAmount);
            } else {
                return 0;
            }
        } else {
            return 0;
        }
    }

    /// @notice 상점 데이터를 리턴한다
    /// @param _shopId 상점의 아이디
    function shopOf(bytes32 _shopId) external view returns (ShopData memory) {
        return shops[_shopId];
    }

    /// @notice 상점의 아이디를 리턴한다
    /// @param _idx 배열의 순번
    function shopIdOf(uint256 _idx) external view returns (bytes32) {
        return items[_idx];
    }

    /// @notice 상점의 갯수를 리턴한다
    function shopsLength() external view returns (uint256) {
        return items.length;
    }

    /// @notice 인출가능한 정산금액을 리턴한다.
    /// @param _shopId 상점의 아이디
    function withdrawableOf(bytes32 _shopId) external view returns (uint256) {
        ShopData memory shop = shops[_shopId];
        return shop.settledAmount - shop.withdrawnAmount;
    }

    /// @notice 정산금의 인출을 요청한다.
    /// @param _shopId 상점아이디
    /// @param _amount 인출금
    /// @dev 중계서버를 통해서 상점주의 서명을 가지고 호출됩니다.
    function openWithdrawal(bytes32 _shopId, uint256 _amount, address _account, bytes calldata _signature) external {
        require(shops[_shopId].status == ShopStatus.ACTIVE, "1202");
        bytes32 dataHash = keccak256(abi.encode(_shopId, _account, nonce[_account]));
        require(ECDSA.recover(ECDSA.toEthSignedMessageHash(dataHash), _signature) == _account, "1501");

        _openWithdrawal(_shopId, _amount, _account);
    }

    /// @notice 정산금의 인출을 요청한다.
    /// @param _shopId 상점아이디
    /// @param _amount 인출금
    /// @dev 상점주에 의해 직접 호출됩니다.
    function openWithdrawalDirect(bytes32 _shopId, uint256 _amount) external {
        require(shops[_shopId].status == ShopStatus.ACTIVE, "1202");
        _openWithdrawal(_shopId, _amount, msg.sender);
    }

    function _openWithdrawal(bytes32 _shopId, uint256 _amount, address _account) internal {
        ShopData memory shop = shops[_shopId];

        require(shop.account == _account, "1050");

        require(_amount <= shop.settledAmount - shop.withdrawnAmount, "1220");
        require(shop.withdrawData.status == WithdrawStatus.CLOSE, "1221");

        shops[_shopId].withdrawData.id++;
        shops[_shopId].withdrawData.amount = _amount;
        shops[_shopId].withdrawData.status = WithdrawStatus.OPEN;

        nonce[_account]++;

        emit OpenedWithdrawal(_shopId, _amount, shops[_shopId].currency, _account, shops[_shopId].withdrawData.id);
    }

    /// @notice 정산금의 인출을 마감한다. 상점주인만이 실행가능
    /// @param _shopId 상점아이디
    function closeWithdrawal(bytes32 _shopId, address _account, bytes calldata _signature) external {
        require(shops[_shopId].status == ShopStatus.ACTIVE, "1202");
        bytes32 dataHash = keccak256(abi.encode(_shopId, _account, nonce[_account]));
        require(ECDSA.recover(ECDSA.toEthSignedMessageHash(dataHash), _signature) == _account, "1501");

        _closeWithdrawal(_shopId, _account);
    }

    /// @notice 정산금의 인출을 마감한다. 상점주인만이 실행가능
    /// @param _shopId 상점아이디
    function closeWithdrawalDirect(bytes32 _shopId) external {
        require(shops[_shopId].status == ShopStatus.ACTIVE, "1202");
        _closeWithdrawal(_shopId, msg.sender);
    }

    function _closeWithdrawal(bytes32 _shopId, address _account) internal {
        ShopData memory shop = shops[_shopId];

        require(shop.account == _account, "1050");

        require(shop.withdrawData.status == WithdrawStatus.OPEN, "1222");

        shops[_shopId].withdrawData.status = WithdrawStatus.CLOSE;
        shops[_shopId].withdrawnAmount += shop.withdrawData.amount;

        nonce[_account]++;

        emit ClosedWithdrawal(
            _shopId,
            shops[_shopId].withdrawData.amount,
            shops[_shopId].withdrawnAmount,
            shops[_shopId].currency,
            _account,
            shops[_shopId].withdrawData.id
        );
    }

    /// @notice nonce를  리턴한다
    /// @param _account 지갑주소
    function nonceOf(address _account) external view returns (uint256) {
        return nonce[_account];
    }
}
