// SPDX-License-Identifier: AGPL-3.0-or-later

pragma solidity ^0.8.2;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";

import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

import "../interfaces/ICurrencyRate.sol";
import "../interfaces/IShop.sol";
import "./ShopStorage.sol";

import "../lib/DMS.sol";

/// @notice 상점컬랙션
contract Shop is ShopStorage, Initializable, OwnableUpgradeable, UUPSUpgradeable, IShop {
    /// @notice 상점이 추가될 때 발생되는 이벤트
    event AddedShop(bytes32 shopId, string name, string currency, address account, ShopStatus status);
    /// @notice 상점의 정보가 변경될 때 발생되는 이벤트
    event UpdatedShop(bytes32 shopId, string name, string currency, address account, ShopStatus status);
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

    /// @notice 생성자
    function initialize(
        address _currencyRate,
        address _providerAddress,
        address _consumerAddress
    ) external initializer {
        __UUPSUpgradeable_init();
        __Ownable_init_unchained();

        providerAddress = _providerAddress;
        consumerAddress = _consumerAddress;

        currencyRate = ICurrencyRate(_currencyRate);
    }

    function _authorizeUpgrade(address newImplementation) internal virtual override {
        require(_msgSender() == owner(), "Unauthorized access");
    }

    modifier onlyProvider() {
        require(_msgSender() == providerAddress, "1005");
        _;
    }

    modifier onlyConsumer() {
        require(_msgSender() == consumerAddress, "1006");
        _;
    }

    /// @notice 이용할 수 있는 아이디 인지 알려준다.
    /// @param _shopId 상점 아이디
    function isAvailableId(bytes32 _shopId) public view override returns (bool) {
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
    ) external virtual {
        require(shops[_shopId].status == ShopStatus.INVALID, "1200");
        require(currencyRate.support(_currency), "1211");
        bytes32 dataHash = keccak256(abi.encode(_shopId, _account, block.chainid, nonce[_account]));
        require(ECDSA.recover(ECDSA.toEthSignedMessageHash(dataHash), _signature) == _account, "1501");

        ShopData memory data = ShopData({
            shopId: _shopId,
            name: _name,
            currency: _currency,
            account: _account,
            providedAmount: 0,
            usedAmount: 0,
            settledAmount: 0,
            withdrawnAmount: 0,
            status: ShopStatus.ACTIVE,
            withdrawData: WithdrawData({ id: 0, amount: 0, status: WithdrawStatus.CLOSE }),
            itemIndex: items.length,
            accountIndex: shopIdByAddress[_account].length
        });
        items.push(_shopId);
        shops[_shopId] = data;
        shopIdByAddress[_account].push(_shopId);

        nonce[_account]++;

        ShopData memory shop = shops[_shopId];
        emit AddedShop(shop.shopId, shop.name, shop.currency, shop.account, shop.status);
    }

    /// @notice 상점정보를 수정합니다
    /// @param _shopId 상점 아이디
    /// @param _name 상점이름
    /// @dev 중계서버를 통해서 호출됩니다.
    function update(
        bytes32 _shopId,
        string calldata _name,
        string calldata _currency,
        address _account,
        bytes calldata _signature
    ) external virtual {
        bytes32 id = _shopId;
        require(shops[id].status != ShopStatus.INVALID, "1201");
        require(currencyRate.support(_currency), "1211");
        require(shops[id].account == _account, "1050");

        bytes32 dataHash = keccak256(abi.encode(id, _account, block.chainid, nonce[_account]));
        require(ECDSA.recover(ECDSA.toEthSignedMessageHash(dataHash), _signature) == _account, "1501");

        shops[id].name = _name;
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

        emit UpdatedShop(shops[id].shopId, shops[id].name, shops[id].currency, shops[id].account, shops[id].status);
    }

    /// @notice 상점상태를 수정합니다
    /// @param _shopId 상점 아이디
    /// @param _status 상점의 상태
    /// @dev 중계서버를 통해서 호출됩니다.
    function changeStatus(
        bytes32 _shopId,
        ShopStatus _status,
        address _account,
        bytes calldata _signature
    ) external virtual {
        bytes32 id = _shopId;
        require(_status != ShopStatus.INVALID, "1201");
        require(shops[id].status != ShopStatus.INVALID, "1201");
        require(shops[id].account == _account, "1050");

        bytes32 dataHash = keccak256(abi.encode(id, _account, block.chainid, nonce[_account]));
        require(ECDSA.recover(ECDSA.toEthSignedMessageHash(dataHash), _signature) == _account, "1501");

        shops[id].status = _status;

        nonce[_account]++;

        emit ChangedShopStatus(shops[id].shopId, shops[id].status);
    }

    /// @notice 지갑주소로 등록한 상점의 아이디들을 리턴한다.
    /// @param _account 지갑주소
    function getShopsOfAccount(
        address _account,
        uint256 _from,
        uint256 _to
    ) external view override returns (bytes32[] memory) {
        bytes32[] memory values = new bytes32[](_to - _from);
        for (uint256 i = _from; i < _to; i++) {
            values[i - _from] = shopIdByAddress[_account][i];
        }
        return values;
    }

    /// @notice 지갑주소로 등록한 상점의 갯수를 리턴한다.
    /// @param _account 지갑주소
    function getShopsCountOfAccount(address _account) external view override returns (uint256) {
        return shopIdByAddress[_account].length;
    }

    /// @notice 지급된 총 마일지리를 누적한다
    function addProvidedAmount(
        bytes32 _shopId,
        uint256 _value,
        string calldata _purchaseId
    ) external override onlyProvider {
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
    ) external override onlyConsumer {
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
    ) external override onlyConsumer {
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
    function addSettledAmount(
        bytes32 _shopId,
        uint256 _value,
        string calldata _purchaseId
    ) external override onlyConsumer {
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
    function getSettlementAmount(bytes32 _shopId) external view override returns (uint256) {
        if (shops[_shopId].status == ShopStatus.ACTIVE) {
            ShopData memory data = shops[_shopId];
            if (data.providedAmount + data.settledAmount < data.usedAmount) {
                return DMS.zeroGWEI(data.usedAmount - data.providedAmount - data.settledAmount);
            } else {
                return 0;
            }
        } else {
            return 0;
        }
    }

    /// @notice 상점 데이터를 리턴한다
    /// @param _shopId 상점의 아이디
    function shopOf(bytes32 _shopId) external view override returns (ShopData memory) {
        return shops[_shopId];
    }

    /// @notice 상점의 아이디를 리턴한다
    /// @param _idx 배열의 순번
    function shopIdOf(uint256 _idx) external view virtual returns (bytes32) {
        return items[_idx];
    }

    /// @notice 상점의 갯수를 리턴한다
    function shopsLength() external view virtual returns (uint256) {
        return items.length;
    }

    /// @notice 인출가능한 정산금액을 리턴한다.
    /// @param _shopId 상점의 아이디
    function withdrawableOf(bytes32 _shopId) external view override returns (uint256) {
        ShopData memory shop = shops[_shopId];
        return shop.settledAmount - shop.withdrawnAmount;
    }

    /// @notice 정산금의 인출을 요청한다.
    /// @param _shopId 상점아이디
    /// @param _amount 인출금
    /// @dev 중계서버를 통해서 상점주의 서명을 가지고 호출됩니다.
    function openWithdrawal(
        bytes32 _shopId,
        uint256 _amount,
        address _account,
        bytes calldata _signature
    ) external virtual {
        require(shops[_shopId].status == ShopStatus.ACTIVE, "1202");
        bytes32 dataHash = keccak256(abi.encode(_shopId, _account, block.chainid, nonce[_account]));
        require(ECDSA.recover(ECDSA.toEthSignedMessageHash(dataHash), _signature) == _account, "1501");

        require(_amount % 1 gwei == 0, "1030");

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
    function closeWithdrawal(bytes32 _shopId, address _account, bytes calldata _signature) external virtual {
        require(shops[_shopId].status == ShopStatus.ACTIVE, "1202");
        bytes32 dataHash = keccak256(abi.encode(_shopId, _account, block.chainid, nonce[_account]));
        require(ECDSA.recover(ECDSA.toEthSignedMessageHash(dataHash), _signature) == _account, "1501");

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
    function nonceOf(address _account) external view override returns (uint256) {
        return nonce[_account];
    }
}
