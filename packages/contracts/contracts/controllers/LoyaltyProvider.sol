// SPDX-License-Identifier: AGPL-3.0-or-later

pragma solidity ^0.8.2;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";

import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

import "del-osx-artifacts/contracts/interfaces/IPhoneLinkCollection.sol";

import "../interfaces/ICurrencyRate.sol";
import "../interfaces/IValidator.sol";
import "../interfaces/IShop.sol";
import "../interfaces/ILedger.sol";
import "./LoyaltyProviderStorage.sol";

import "../lib/DMS.sol";

contract LoyaltyProvider is LoyaltyProviderStorage, Initializable, OwnableUpgradeable, UUPSUpgradeable {
    uint256 public constant QUORUM = (uint256(2000) / uint256(3));
    struct PurchaseData {
        string purchaseId;
        uint256 amount;
        uint256 loyalty;
        string currency;
        bytes32 shopId;
        address account;
        bytes32 phone;
        bytes[] signatures;
    }

    /// @notice 검증자가 추가될 때 발생되는 이벤트
    event SavedPurchase(
        string purchaseId,
        uint256 amount,
        uint256 loyalty,
        string currency,
        bytes32 shopId,
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
        require(validatorContract.isCurrentActiveValidator(_account), "1000");
        _;
    }

    /// @notice 구매내역을 저장합니다.
    /// @dev 이것은 검증자들에 의해 호출되어야 합니다.
    function savePurchase(PurchaseData calldata _data) external onlyValidator(_msgSender()) {
        require(purchases[_data.purchaseId] == false, "1160");
        require(_data.loyalty % 1 gwei == 0, "1030");
        if (_data.loyalty > 0) {
            PurchaseData memory data = _data;
            require(data.loyalty <= DMS.zeroGWEI(data.amount / 10), "1161");
            uint256 numberOfVoters = validatorContract.lengthOfCurrentActiveValidator();
            require(numberOfVoters > 0, "1162");
            require(data.signatures.length <= numberOfVoters, "1163");

            bytes32 dataHash = keccak256(
                abi.encode(
                    data.purchaseId,
                    data.amount,
                    data.loyalty,
                    data.currency,
                    data.shopId,
                    data.account,
                    data.phone
                )
            );

            address[] memory participants = new address[](data.signatures.length);
            uint256 length = 0;
            for (uint256 idx = 0; idx < data.signatures.length; idx++) {
                address participant = ECDSA.recover(ECDSA.toEthSignedMessageHash(dataHash), data.signatures[idx]);
                bool exist = false;
                for (uint256 j = 0; j < length; j++) {
                    if (participants[j] == participant) {
                        exist = true;
                        break;
                    }
                }
                if (!exist && validatorContract.isCurrentActiveValidator(participant)) {
                    participants[length] = participant;
                    length++;
                }
            }

            require(((length * 1000) / numberOfVoters) >= QUORUM, "1164");

            uint256 loyaltyValue = data.loyalty;
            uint256 loyaltyPoint = currencyRateContract.convertCurrencyToPoint(loyaltyValue, data.currency);

            IShop.ShopData memory shop = shopContract.shopOf(data.shopId);
            if (shop.status == IShop.ShopStatus.ACTIVE) {
                if (data.account != address(0x0)) {
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

        purchases[_data.purchaseId] = true;
        emit SavedPurchase(
            _data.purchaseId,
            _data.amount,
            _data.loyalty,
            _data.currency,
            _data.shopId,
            _data.account,
            _data.phone
        );
    }
}
