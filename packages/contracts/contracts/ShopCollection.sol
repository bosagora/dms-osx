// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

/// @notice 상점컬랙션
contract ShopCollection {
    /// @notice 검증자의 상태코드
    enum WithdrawStatus {
        CLOSE,
        OPEN
    }

    struct WithdrawData {
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
        uint256 provideWaitTime; // 제품구매 후 포인트 지급시간
        uint256 providePercent; // 구매금액에 대한 포인트 지급량
        address account; // 상점주의 지갑주소
        uint256 providedPoint; // 제공된 포인트 총량
        uint256 usedPoint; // 사용된 포인트 총량
        uint256 settledPoint; // 정산된 포인트 총량
        uint256 withdrawnPoint; // 정산된 포인트 총량
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
        uint256 provideWaitTime,
        uint256 providePercent,
        address account,
        ShopStatus status
    );
    /// @notice 상점의 정보가 변경될 때 발생되는 이벤트
    event UpdatedShop(
        bytes32 shopId,
        string name,
        uint256 provideWaitTime,
        uint256 providePercent,
        address account,
        ShopStatus status
    );
    /// @notice 상점의 정보가 변경될 때 발생되는 이벤트
    event ChangedShopStatus(bytes32 shopId, ShopStatus status);
    /// @notice 상점의 포인트가 증가할 때 발생되는 이벤트
    event IncreasedProvidedPoint(bytes32 shopId, uint256 increase, uint256 total, string purchaseId);
    /// @notice 사용자의 포인트가 증가할 때 발생되는 이벤트
    event IncreasedUsedPoint(bytes32 shopId, uint256 increase, uint256 total, string purchaseId, bytes32 paymentId);
    /// @notice 사용자의 포인트가 감소할 때 발생되는 이벤트
    event DecreasedUsedPoint(bytes32 shopId, uint256 increase, uint256 total, string purchaseId);
    /// @notice 정산된 마일리가 증가할 때 발생되는 이벤트
    event IncreasedSettledPoint(bytes32 shopId, uint256 increase, uint256 total, string purchaseId);

    event OpenedWithdrawal(bytes32 shopId, uint256 amount, address account);
    event ClosedWithdrawal(bytes32 shopId, uint256 amount, uint256 total, address account);

    address public ledgerAddress;
    address public deployer;
    address public certifierAddress;
    mapping(address => uint256) private nonce;

    /// @notice 생성자
    constructor(address _certifierAddress) {
        certifierAddress = _certifierAddress;
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
    function add(bytes32 _shopId, string calldata _name, address _account, bytes calldata _signature) public {
        require(shops[_shopId].status == ShopStatus.INVALID, "1200");
        bytes32 dataHash = keccak256(abi.encode(_shopId, _account, nonce[_account]));
        require(ECDSA.recover(ECDSA.toEthSignedMessageHash(dataHash), _signature) == _account, "1501");

        ShopData memory data = ShopData({
            shopId: _shopId,
            name: _name,
            provideWaitTime: 7 * 86400,
            providePercent: 5,
            account: _account,
            providedPoint: 0,
            usedPoint: 0,
            settledPoint: 0,
            withdrawnPoint: 0,
            status: ShopStatus.INACTIVE,
            withdrawData: WithdrawData({ amount: 0, status: WithdrawStatus.CLOSE }),
            itemIndex: items.length,
            accountIndex: shopIdByAddress[_account].length
        });
        items.push(_shopId);
        shops[_shopId] = data;
        shopIdByAddress[_account].push(_shopId);

        nonce[_account]++;

        ShopData memory shop = shops[_shopId];
        emit AddedShop(shop.shopId, shop.name, shop.provideWaitTime, shop.providePercent, shop.account, shop.status);
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
        uint256 _provideWaitTime,
        uint256 _providePercent,
        address _account,
        bytes calldata _signature1,
        bytes calldata _signature2
    ) public {
        require(shops[_shopId].status != ShopStatus.INVALID, "1201");
        require(shops[_shopId].account == _account, "1050");

        bytes32 dataHash1 = keccak256(abi.encode(_shopId, _account, nonce[_account]));
        require(ECDSA.recover(ECDSA.toEthSignedMessageHash(dataHash1), _signature1) == _account, "1501");

        bytes32 dataHash2 = keccak256(abi.encode(_shopId, certifierAddress, nonce[certifierAddress]));
        require(ECDSA.recover(ECDSA.toEthSignedMessageHash(dataHash2), _signature2) == certifierAddress, "1501");

        shops[_shopId].name = _name;
        shops[_shopId].provideWaitTime = _provideWaitTime;
        shops[_shopId].providePercent = _providePercent;

        nonce[_account]++;
        nonce[certifierAddress]++;

        ShopData memory shop = shops[_shopId];
        emit UpdatedShop(shop.shopId, shop.name, shop.provideWaitTime, shop.providePercent, shop.account, shop.status);
    }

    /// @notice 상점상태를 수정합니다
    /// @param _shopId 상점 아이디
    /// @param _status 상점의 상태
    /// @dev 중계서버를 통해서 호출됩니다.
    function changeStatus(
        bytes32 _shopId,
        ShopStatus _status,
        address _account,
        bytes calldata _signature1,
        bytes calldata _signature2
    ) public {
        require(_status != ShopStatus.INVALID, "1201");
        require(shops[_shopId].status != ShopStatus.INVALID, "1201");
        require(shops[_shopId].account == _account, "1050");

        bytes32 dataHash1 = keccak256(abi.encode(_shopId, _account, nonce[_account]));
        require(ECDSA.recover(ECDSA.toEthSignedMessageHash(dataHash1), _signature1) == _account, "1501");

        bytes32 dataHash2 = keccak256(abi.encode(_shopId, certifierAddress, nonce[certifierAddress]));
        require(ECDSA.recover(ECDSA.toEthSignedMessageHash(dataHash2), _signature2) == certifierAddress, "1501");

        shops[_shopId].status = _status;

        nonce[_account]++;
        nonce[certifierAddress]++;

        ShopData memory shop = shops[_shopId];
        emit ChangedShopStatus(shop.shopId, shop.status);
    }

    /// @notice 지갑주소로 등록한 상점의 아이디들을 리턴한다.
    /// @param _account 지갑주소
    function shopsOf(address _account) public view returns (bytes32[] memory) {
        return shopIdByAddress[_account];
    }

    /// @notice 지급된 총 마일지리를 누적한다
    function addProvidedPoint(bytes32 _shopId, uint256 _amount, string calldata _purchaseId) public onlyLedger {
        if (shops[_shopId].status != ShopStatus.INVALID) {
            shops[_shopId].providedPoint += _amount;
            emit IncreasedProvidedPoint(_shopId, _amount, shops[_shopId].providedPoint, _purchaseId);
        }
    }

    /// @notice 사용된 총 마일지리를 누적한다
    function addUsedPoint(
        bytes32 _shopId,
        uint256 _amount,
        string calldata _purchaseId,
        bytes32 _paymentId
    ) public onlyLedger {
        if (shops[_shopId].status == ShopStatus.ACTIVE) {
            shops[_shopId].usedPoint += _amount;
            emit IncreasedUsedPoint(_shopId, _amount, shops[_shopId].usedPoint, _purchaseId, _paymentId);
        }
    }

    /// @notice 사용된 총 마일지리를 빼준다
    function subUsedPoint(bytes32 _shopId, uint256 _amount, string calldata _purchaseId) public onlyLedger {
        if (shops[_shopId].status == ShopStatus.ACTIVE) {
            if (shops[_shopId].usedPoint >= _amount) {
                shops[_shopId].usedPoint -= _amount;
                emit DecreasedUsedPoint(_shopId, _amount, shops[_shopId].usedPoint, _purchaseId);
            }
        }
    }

    /// @notice 정산된 총 마일지리를 누적한다
    function addSettledPoint(bytes32 _shopId, uint256 _amount, string calldata _purchaseId) public onlyLedger {
        if (shops[_shopId].status == ShopStatus.ACTIVE) {
            shops[_shopId].settledPoint += _amount;
            emit IncreasedSettledPoint(_shopId, _amount, shops[_shopId].settledPoint, _purchaseId);
        }
    }

    /// @notice 정산되어야 할 마일지리의 량을 리턴합니다.
    function getSettlementPoint(bytes32 _shopId) public view returns (uint256) {
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
    function shopOf(bytes32 _shopId) public view returns (ShopData memory) {
        return shops[_shopId];
    }

    /// @notice 상점의 아이디를 리턴한다
    /// @param _idx 배열의 순번
    function shopIdOf(uint256 _idx) public view returns (bytes32) {
        return items[_idx];
    }

    /// @notice 상점의 갯수를 리턴한다
    function shopsLength() public view returns (uint256) {
        return items.length;
    }

    /// @notice 인출가능한 정산금액을 리턴한다.
    /// @param _shopId 상점의 아이디
    function withdrawableOf(bytes32 _shopId) public view returns (uint256) {
        ShopData memory shop = shops[_shopId];
        return shop.settledPoint - shop.withdrawnPoint;
    }

    /// @notice 정산금의 인출을 요청한다.
    /// @param _shopId 상점아이디
    /// @param _amount 인출금
    /// @dev 중계서버를 통해서 상점주의 서명을 가지고 호출됩니다.
    function openWithdrawal(bytes32 _shopId, uint256 _amount, address _account, bytes calldata _signature) public {
        require(shops[_shopId].status == ShopStatus.ACTIVE, "1202");
        bytes32 dataHash = keccak256(abi.encode(_shopId, _account, nonce[_account]));
        require(ECDSA.recover(ECDSA.toEthSignedMessageHash(dataHash), _signature) == _account, "1501");

        _openWithdrawal(_shopId, _amount, _account);
    }

    /// @notice 정산금의 인출을 요청한다.
    /// @param _shopId 상점아이디
    /// @param _amount 인출금
    /// @dev 상점주에 의해 직접 호출됩니다.
    function openWithdrawalDirect(bytes32 _shopId, uint256 _amount) public {
        require(shops[_shopId].status == ShopStatus.ACTIVE, "1202");
        _openWithdrawal(_shopId, _amount, msg.sender);
    }

    function _openWithdrawal(bytes32 _shopId, uint256 _amount, address _account) internal {
        ShopData memory shop = shops[_shopId];

        require(shop.account == _account, "1050");

        require(_amount <= shop.settledPoint - shop.withdrawnPoint, "1220");
        require(shop.withdrawData.status == WithdrawStatus.CLOSE, "1221");

        shops[_shopId].withdrawData.amount = _amount;
        shops[_shopId].withdrawData.status = WithdrawStatus.OPEN;

        nonce[_account]++;

        emit OpenedWithdrawal(_shopId, _amount, _account);
    }

    /// @notice 정산금의 인출을 마감한다. 상점주인만이 실행가능
    /// @param _shopId 상점아이디
    function closeWithdrawal(bytes32 _shopId, address _account, bytes calldata _signature) public {
        require(shops[_shopId].status == ShopStatus.ACTIVE, "1202");
        bytes32 dataHash = keccak256(abi.encode(_shopId, _account, nonce[_account]));
        require(ECDSA.recover(ECDSA.toEthSignedMessageHash(dataHash), _signature) == _account, "1501");

        _closeWithdrawal(_shopId, _account);
    }

    /// @notice 정산금의 인출을 마감한다. 상점주인만이 실행가능
    /// @param _shopId 상점아이디
    function closeWithdrawalDirect(bytes32 _shopId) public {
        require(shops[_shopId].status == ShopStatus.ACTIVE, "1202");
        _closeWithdrawal(_shopId, msg.sender);
    }

    function _closeWithdrawal(bytes32 _shopId, address _account) internal {
        ShopData memory shop = shops[_shopId];

        require(shop.account == _account, "1050");

        require(shop.withdrawData.status == WithdrawStatus.OPEN, "1222");

        shops[_shopId].withdrawData.status = WithdrawStatus.CLOSE;
        shops[_shopId].withdrawnPoint += shop.withdrawData.amount;

        nonce[_account]++;

        emit ClosedWithdrawal(_shopId, shops[_shopId].withdrawData.amount, shops[_shopId].withdrawnPoint, _account);
    }

    /// @notice nonce를  리턴한다
    /// @param _account 지갑주소
    function nonceOf(address _account) public view returns (uint256) {
        return nonce[_account];
    }
}
