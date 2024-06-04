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
    /// @notice 상점의 위임자가 변경될 때 발생되는 이벤트
    event ChangedDelegator(bytes32 shopId, address delegator);
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

    event Refunded(
        bytes32 shopId,
        address account,
        uint256 refundAmount,
        uint256 refundedTotal,
        string currency,
        uint256 amountToken,
        uint256 balanceToken
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

    /// @notice 원장 컨트랙트를 등록한다.
    function setLedger(address _contractAddress) external override {
        require(_msgSender() == owner(), "1050");
        if (!isSetLedger) {
            ledgerContract = ILedger(_contractAddress);
            isSetLedger = true;
        }
    }

    /// @notice 이용할 수 있는 아이디 인지 알려준다.
    /// @param _shopId 상점 아이디
    function isAvailableId(bytes32 _shopId) external view override returns (bool) {
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
            delegator: address(0x0),
            providedAmount: 0,
            usedAmount: 0,
            refundedAmount: 0,
            status: ShopStatus.ACTIVE,
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
        require(
            shops[id].account == _account || (shops[id].delegator != address(0x0) && shops[id].delegator == _account),
            "1050"
        );

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
            shops[id].refundedAmount = currencyRate.convertCurrency(
                shops[id].refundedAmount,
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
        require(
            shops[id].account == _account || (shops[id].delegator != address(0x0) && shops[id].delegator == _account),
            "1050"
        );

        bytes32 dataHash = keccak256(abi.encode(id, _account, block.chainid, nonce[_account]));
        require(ECDSA.recover(ECDSA.toEthSignedMessageHash(dataHash), _signature) == _account, "1501");

        shops[id].status = _status;

        nonce[_account]++;

        emit ChangedShopStatus(shops[id].shopId, shops[id].status);
    }

    /// @notice 상점상태를 수정합니다
    /// @param _shopId 상점 아이디
    /// @param _delegator 상점의 위임자의 주소
    /// @dev 중계서버를 통해서 호출됩니다.
    function changeDelegator(
        bytes32 _shopId,
        address _delegator,
        address _account,
        bytes calldata _signature
    ) external virtual {
        bytes32 id = _shopId;
        require(shops[id].status != ShopStatus.INVALID, "1201");
        require(shops[id].account == _account, "1050");

        bytes32 dataHash = keccak256(abi.encode(id, _delegator, _account, block.chainid, nonce[_account]));
        require(ECDSA.recover(ECDSA.toEthSignedMessageHash(dataHash), _signature) == _account, "1501");

        shops[id].delegator = _delegator;

        nonce[_account]++;

        emit ChangedDelegator(shops[id].shopId, shops[id].delegator);
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

    /// @notice 반환가능한 정산금액을 리턴한다.
    /// @param _shopId 상점의 아이디
    function refundableOf(
        bytes32 _shopId
    ) external view override returns (uint256 refundableAmount, uint256 refundableToken) {
        ShopData memory shop = shops[_shopId];
        uint256 settlementAmount = (shop.usedAmount > shop.providedAmount) ? shop.usedAmount - shop.providedAmount : 0;
        refundableAmount = (settlementAmount > shop.refundedAmount) ? settlementAmount - shop.refundedAmount : 0;
        refundableToken = currencyRate.convertCurrencyToToken(refundableAmount, shops[_shopId].currency);
    }

    /// @notice 정산금의 반환한다.
    /// @param _shopId 상점아이디
    /// @param _amount 인출금
    /// @dev 중계서버를 통해서 상점주의 서명을 가지고 호출됩니다.
    function refund(bytes32 _shopId, address _account, uint256 _amount, bytes calldata _signature) external virtual {
        require(shops[_shopId].status == ShopStatus.ACTIVE, "1202");
        bytes32 dataHash = keccak256(abi.encode(_shopId, _account, _amount, block.chainid, nonce[_account]));
        require(ECDSA.recover(ECDSA.toEthSignedMessageHash(dataHash), _signature) == _account, "1501");
        require(shops[_shopId].account == _account, "1050");
        require(_amount % 1 gwei == 0, "1030");

        ShopData memory shop = shops[_shopId];
        uint256 settlementAmount = (shop.usedAmount > shop.providedAmount) ? shop.usedAmount - shop.providedAmount : 0;
        uint256 refundableAmount = (settlementAmount > shop.refundedAmount)
            ? settlementAmount - shop.refundedAmount
            : 0;

        require(_amount <= refundableAmount, "1220");

        uint256 amountToken = currencyRate.convertCurrencyToToken(_amount, shops[_shopId].currency);
        ledgerContract.refund(_account, _amount, shops[_shopId].currency, amountToken, _shopId);

        shops[_shopId].refundedAmount += _amount;
        nonce[_account]++;

        uint256 balanceToken = ledgerContract.tokenBalanceOf(_account);
        uint256 refundedTotal = shops[_shopId].refundedAmount;
        string memory currency = shops[_shopId].currency;
        emit Refunded(_shopId, _account, _amount, refundedTotal, currency, amountToken, balanceToken);
    }

    /// @notice nonce를  리턴한다
    /// @param _account 지갑주소
    function nonceOf(address _account) external view override returns (uint256) {
        return nonce[_account];
    }
}
