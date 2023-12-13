// SPDX-License-Identifier: AGPL-3.0-or-later

pragma solidity ^0.8.2;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";

import "del-osx-artifacts/contracts/interfaces/IPhoneLinkCollection.sol";

import "../interfaces/ICurrencyRate.sol";
import "../interfaces/IValidator.sol";
import "../interfaces/IShop.sol";
import "../interfaces/ILedger.sol";
import "./LoyaltyProviderStorage.sol";

contract LoyaltyProvider is LoyaltyProviderStorage, Initializable, OwnableUpgradeable, UUPSUpgradeable {
    struct PurchaseData {
        string purchaseId;
        uint256 timestamp;
        uint256 amount;
        string currency;
        bytes32 shopId;
        uint32 method;
        address account;
        bytes32 phone;
    }

    /// @notice 검증자가 추가될 때 발생되는 이벤트
    event SavedPurchase(
        string purchaseId,
        uint256 timestamp,
        uint256 amount,
        string currency,
        bytes32 shopId,
        uint32 method,
        address account,
        bytes32 phone
    );

    function initialize(
        address _validatorAddress,
        address _linkAddress,
        address _currencyRateAddress
    ) external initializer {
        __UUPSUpgradeable_init();
        __Ownable_init_unchained();

        validatorContract = IValidator(_validatorAddress);
        linkContract = IPhoneLinkCollection(_linkAddress);
        currencyRateContract = ICurrencyRate(_currencyRateAddress);
        isSetLedger = false;
        isSetShop = false;
    }

    /// @notice 원장 컨트랙트를 등록한다.
    function setLedger(address _contractAddress) public {
        require(_msgSender() == owner(), "1050");
        if (!isSetLedger) {
            ledgerContract = ILedger(_contractAddress);
            isSetLedger = true;
        }
    }

    /// @notice 상점 컨트랙트를 등록한다.
    function setShop(address _contractAddress) public {
        require(_msgSender() == owner(), "1050");
        if (!isSetShop) {
            shopContract = IShop(_contractAddress);
            isSetShop = true;
        }
    }

    function _authorizeUpgrade(address newImplementation) internal virtual override {
        require(_msgSender() == owner(), "Unauthorized access");
    }

    modifier onlyValidator(address _account) {
        require(validatorContract.isActiveValidator(_account), "1000");
        _;
    }

    /// @notice 구매내역을 저장합니다.
    /// @dev 이것은 검증자들에 의해 호출되어야 합니다.
    function savePurchase(PurchaseData calldata data) external onlyValidator(_msgSender()) {
        if (data.method == 0) {
            IShop.ShopData memory shop = shopContract.shopOf(data.shopId);
            if (shop.status == IShop.ShopStatus.ACTIVE) {
                if (data.account != address(0x0)) {
                    uint256 loyaltyValue = (data.amount * shop.providePercent) / 100;
                    uint256 loyaltyPoint = currencyRateContract.convertCurrencyToPoint(loyaltyValue, data.currency);
                    if (ledgerContract.loyaltyTypeOf(data.account) == ILedger.LoyaltyType.POINT) {
                        ledgerContract.providePoint(
                            data.account,
                            loyaltyPoint,
                            loyaltyValue,
                            data.currency,
                            data.purchaseId,
                            data.shopId
                        );
                    } else {
                        ledgerContract.provideToken(
                            data.account,
                            loyaltyPoint,
                            loyaltyValue,
                            data.currency,
                            data.purchaseId,
                            data.shopId
                        );
                    }
                    shopContract.addProvidedAmount(
                        data.shopId,
                        currencyRateContract.convertCurrency(loyaltyValue, data.currency, shop.currency),
                        data.purchaseId
                    );
                } else if (data.phone != NULL) {
                    uint256 loyaltyValue = (data.amount * shop.providePercent) / 100;
                    uint256 loyaltyPoint = currencyRateContract.convertCurrencyToPoint(loyaltyValue, data.currency);
                    address account = linkContract.toAddress(data.phone);
                    if (account == address(0x00)) {
                        ledgerContract.provideUnPayablePoint(
                            data.phone,
                            loyaltyPoint,
                            loyaltyValue,
                            data.currency,
                            data.purchaseId,
                            data.shopId
                        );
                    } else {
                        if (ledgerContract.loyaltyTypeOf(account) == ILedger.LoyaltyType.POINT) {
                            ledgerContract.providePoint(
                                account,
                                loyaltyPoint,
                                loyaltyValue,
                                data.currency,
                                data.purchaseId,
                                data.shopId
                            );
                        } else {
                            ledgerContract.provideToken(
                                account,
                                loyaltyPoint,
                                loyaltyValue,
                                data.currency,
                                data.purchaseId,
                                data.shopId
                            );
                        }
                    }
                    shopContract.addProvidedAmount(
                        data.shopId,
                        currencyRateContract.convertCurrency(loyaltyValue, data.currency, shop.currency),
                        data.purchaseId
                    );
                }
            }
        }

        emit SavedPurchase(
            data.purchaseId,
            data.timestamp,
            data.amount,
            data.currency,
            data.shopId,
            data.method,
            data.account,
            data.phone
        );
    }
}
