// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "del-osx-artifacts/contracts/PhoneLinkCollection.sol";
import "./ValidatorCollection.sol";
import "./CurrencyRate.sol";
import "./ShopCollection.sol";
import "./CertifierCollection.sol";

/// @notice 포인트와 토큰의 원장
contract Ledger {
    /// @notice Hash value of a blank string
    bytes32 public constant NULL = 0x32105b1d0b88ada155176b58ee08b45c31e4f2f7337475831982c313533b880c;
    bytes32 public constant BASE_CURRENCY = keccak256(bytes("krw"));
    bytes32 public constant NULL_CURRENCY = keccak256(bytes(""));
    uint32 public constant MAX_FEE = 5;

    mapping(bytes32 => uint256) private unPayablePointBalances;
    mapping(address => uint256) private pointBalances;
    mapping(address => uint256) private tokenBalances;
    mapping(address => uint256) private nonce;

    enum LoyaltyType {
        POINT,
        TOKEN
    }
    mapping(address => LoyaltyType) private loyaltyTypes;

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
    mapping(string => PurchaseData) private purchases;
    string[] private purchaseIds;

    struct LoyaltyPaymentInputData {
        bytes32 paymentId;
        string purchaseId;
        uint256 amount;
        string currency;
        bytes32 shopId;
        address account;
        bytes signature;
    }

    enum LoyaltyPaymentStatus {
        INVALID,
        OPENED_PAYMENT,
        CLOSED_PAYMENT,
        FAILED_PAYMENT,
        OPENED_CANCEL,
        CLOSED_CANCEL,
        FAILED_CANCEL
    }

    struct LoyaltyPaymentData {
        bytes32 paymentId;
        string purchaseId;
        string currency;
        bytes32 shopId;
        address account;
        uint256 timestamp;
        LoyaltyType loyaltyType;
        uint256 paidPoint;
        uint256 paidToken;
        uint256 paidValue;
        uint256 feePoint;
        uint256 feeToken;
        uint256 feeValue;
        LoyaltyPaymentStatus status;
    }

    mapping(bytes32 => LoyaltyPaymentData) private loyaltyPayments;

    address public foundationAccount;
    address public settlementAccount;
    address public feeAccount;
    address public tokenAddress;
    address public validatorAddress;
    address public linkCollectionAddress;
    address public currencyRateAddress;
    address public shopCollectionAddress;
    address public certifierAddress;
    uint32 public fee;

    address public temporaryAddress;

    ERC20 private token;
    ValidatorCollection private validatorCollection;
    PhoneLinkCollection private linkCollection;
    CurrencyRate private currencyRate;
    ShopCollection private shopCollection;
    CertifierCollection private certifierCollection;

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
    /// @notice 포인트가 지급될 때 발생되는 이벤트
    event ProvidedPoint(
        address account,
        uint256 providedPoint,
        uint256 providedValue,
        uint256 balancePoint,
        string purchaseId,
        bytes32 shopId
    );
    /// @notice 포인트가 지급될 때 발생되는 이벤트
    event ProvidedUnPayablePoint(
        bytes32 phone,
        uint256 providedPoint,
        uint256 providedValue,
        uint256 balancePoint,
        string purchaseId,
        bytes32 shopId
    );
    /// @notice 사용가능한 포인트로 변환될 때 발생되는 이벤트
    event ChangedToPayablePoint(
        bytes32 phone,
        address account,
        uint256 changedPoint,
        uint256 changedValue,
        uint256 balancePoint
    );
    /// @notice 포인트가 정산될 때 발생되는 이벤트
    event ProvidedTokenForSettlement(
        address account,
        bytes32 shopId,
        uint256 providedPoint,
        uint256 providedToken,
        uint256 balanceToken,
        string purchaseId
    );
    /// @notice 토큰이 지급될 때 발생되는 이벤트
    event ProvidedToken(
        address account,
        uint256 providedToken,
        uint256 providedValue,
        uint256 balanceToken,
        string purchaseId,
        bytes32 shopId
    );

    /// @notice 토큰/포인트로 지불을 완료했을 때 발생하는 이벤트
    event LoyaltyPaymentEvent(LoyaltyPaymentData payment, uint256 balance);
    /// @notice 토큰을 예치했을 때 발생하는 이벤트
    event Deposited(address account, uint256 depositedToken, uint256 depositedValue, uint256 balanceToken);
    /// @notice 토큰을 인출했을 때 발생하는 이벤트
    event Withdrawn(address account, uint256 withdrawnToken, uint256 withdrawnValue, uint256 balanceToken);
    /// @notice 구매 후 적립되는 로열티를 토큰으로 변경했을 때 발생하는 이벤트
    event ChangedToLoyaltyToken(address account, uint256 amountToken, uint256 amountPoint, uint256 balanceToken);

    /// @notice 생성자
    /// @param _foundationAccount 재단의 계정
    /// @param _settlementAccount 정산금 계정
    /// @param _feeAccount 수수료 계정
    /// @param _certifierAddress 거래 취소를 인증하는 계정
    /// @param _tokenAddress 토큰 컨트랙트의 주소
    /// @param _validatorAddress 검증자 컬랙션 컨트랙트의 주소
    /// @param _linkCollectionAddress 전화번호-지갑주소 링크 컨트랙트의 주소
    /// @param _currencyRateAddress 환률을 제공하는 컨트랙트의 주소
    /// @param _shopCollectionAddress 가맹점 컬랙션 컨트랙트의 주소
    constructor(
        address _foundationAccount,
        address _settlementAccount,
        address _feeAccount,
        address _certifierAddress,
        address _tokenAddress,
        address _validatorAddress,
        address _linkCollectionAddress,
        address _currencyRateAddress,
        address _shopCollectionAddress
    ) {
        foundationAccount = _foundationAccount;
        settlementAccount = _settlementAccount;
        feeAccount = _feeAccount;
        tokenAddress = _tokenAddress;
        validatorAddress = _validatorAddress;
        linkCollectionAddress = _linkCollectionAddress;
        currencyRateAddress = _currencyRateAddress;
        shopCollectionAddress = _shopCollectionAddress;
        certifierAddress = _certifierAddress;

        token = ERC20(_tokenAddress);
        validatorCollection = ValidatorCollection(_validatorAddress);
        linkCollection = PhoneLinkCollection(_linkCollectionAddress);
        currencyRate = CurrencyRate(_currencyRateAddress);
        shopCollection = ShopCollection(_shopCollectionAddress);
        certifierCollection = CertifierCollection(certifierAddress);
        fee = MAX_FEE;

        loyaltyTypes[foundationAccount] = LoyaltyType.TOKEN;
        loyaltyTypes[settlementAccount] = LoyaltyType.TOKEN;
        loyaltyTypes[feeAccount] = LoyaltyType.TOKEN;

        temporaryAddress = address(0x0);
    }

    modifier onlyValidator(address _account) {
        require(validatorCollection.isActiveValidator(_account), "1000");
        _;
    }

    /// @notice 구매내역을 저장합니다.
    /// @dev 이것은 검증자들에 의해 호출되어야 합니다.
    function savePurchase(PurchaseData calldata data) public onlyValidator(msg.sender) {
        purchaseIds.push(data.purchaseId);
        purchases[data.purchaseId] = data;

        if (data.method == 0) {
            ShopCollection.ShopData memory shop = shopCollection.shopOf(data.shopId);
            if (shop.status == ShopCollection.ShopStatus.ACTIVE) {
                if (data.account != address(0x0)) {
                    uint256 loyaltyValue = (data.amount * shop.providePercent) / 100;
                    uint256 loyaltyPoint = convertCurrencyToPoint(loyaltyValue, data.currency);
                    if (loyaltyTypes[data.account] == LoyaltyType.POINT) {
                        providePoint(data.account, loyaltyPoint, loyaltyValue, data.purchaseId, data.shopId);
                    } else {
                        provideToken(data.account, loyaltyPoint, loyaltyValue, data.purchaseId, data.shopId);
                    }
                    shopCollection.addProvidedPoint(data.shopId, loyaltyPoint, data.purchaseId);
                } else if (data.phone != NULL) {
                    uint256 loyaltyValue = (data.amount * shop.providePercent) / 100;
                    uint256 loyaltyPoint = convertCurrencyToPoint(loyaltyValue, data.currency);
                    address account = linkCollection.toAddress(data.phone);
                    if (account == address(0x00)) {
                        provideUnPayablePoint(data.phone, loyaltyPoint, loyaltyValue, data.purchaseId, data.shopId);
                    } else {
                        if (loyaltyTypes[account] == LoyaltyType.POINT) {
                            providePoint(account, loyaltyPoint, loyaltyValue, data.purchaseId, data.shopId);
                        } else {
                            provideToken(account, loyaltyPoint, loyaltyValue, data.purchaseId, data.shopId);
                        }
                    }
                    shopCollection.addProvidedPoint(data.shopId, loyaltyPoint, data.purchaseId);
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

    /// @notice 포인트를 지급합니다.
    /// @dev 구매 데이터를 확인한 후 호출됩니다.
    /// @param _account 사용자의 지갑주소
    /// @param _loyaltyPoint 지급할 포인트(단위:포인트)
    /// @param _loyaltyValue 지급할 포인트가치(단위:구매한 화폐의 통화)
    /// @param _purchaseId 구매 아이디
    /// @param _shopId 구매한 가맹점 아이디
    function providePoint(
        address _account,
        uint256 _loyaltyPoint,
        uint256 _loyaltyValue,
        string calldata _purchaseId,
        bytes32 _shopId
    ) internal {
        pointBalances[_account] += _loyaltyPoint;
        emit ProvidedPoint(_account, _loyaltyPoint, _loyaltyValue, pointBalances[_account], _purchaseId, _shopId);
    }

    /// @notice 포인트를 지급합니다.
    /// @dev 구매 데이터를 확인한 후 호출됩니다.
    /// @param _phone 전화번호 해시
    /// @param _loyaltyPoint 지급할 포인트(단위:포인트)
    /// @param _loyaltyValue 지급할 포인트가치(단위:구매한 화폐의 통화)
    /// @param _purchaseId 구매 아이디
    /// @param _shopId 구매한 가맹점 아이디
    function provideUnPayablePoint(
        bytes32 _phone,
        uint256 _loyaltyPoint,
        uint256 _loyaltyValue,
        string calldata _purchaseId,
        bytes32 _shopId
    ) internal {
        unPayablePointBalances[_phone] += _loyaltyPoint;
        emit ProvidedUnPayablePoint(
            _phone,
            _loyaltyPoint,
            _loyaltyValue,
            unPayablePointBalances[_phone],
            _purchaseId,
            _shopId
        );
    }

    /// @notice 토큰을 지급합니다.
    /// @dev 구매 데이터를 확인한 후 호출됩니다.
    /// @param _account 사용자의 지갑주소
    /// @param _loyaltyPoint 지급할 포인트(단위:포인트)
    /// @param _loyaltyValue 지급할 포인트가치(단위:구매한 화폐의 통화)
    /// @param _purchaseId 구매 아이디
    /// @param _shopId 구매한 가맹점 아이디
    function provideToken(
        address _account,
        uint256 _loyaltyPoint,
        uint256 _loyaltyValue,
        string calldata _purchaseId,
        bytes32 _shopId
    ) internal {
        uint256 amountToken = convertPointToToken(_loyaltyPoint);

        require(tokenBalances[foundationAccount] >= amountToken, "1510");
        tokenBalances[_account] += amountToken;
        tokenBalances[foundationAccount] -= amountToken;

        emit ProvidedToken(_account, amountToken, _loyaltyValue, tokenBalances[_account], _purchaseId, _shopId);
    }

    /// @notice 사용가능한 포인트로 전환합니다.
    /// @dev 중계서버를 통해서 호출됩니다.
    function changeToPayablePoint(bytes32 _phone, address _account, bytes calldata _signature) public {
        bytes32 dataHash = keccak256(abi.encode(_phone, _account, nonce[_account]));
        require(ECDSA.recover(ECDSA.toEthSignedMessageHash(dataHash), _signature) == _account, "1501");

        _changeToPayablePoint(_phone, _account);
    }

    /// @notice 사용가능한 포인트로 전환합니다.
    /// @dev 사용자에 의해 직접 호출됩니다.
    function changeToPayablePointDirect(bytes32 _phone) public {
        _changeToPayablePoint(_phone, msg.sender);
    }

    /// @notice 사용가능한 포인트로 전환합니다.
    function _changeToPayablePoint(bytes32 _phone, address _account) internal {
        address userAddress = linkCollection.toAddress(_phone);
        require(userAddress != address(0x00), "1502");
        require(userAddress == _account, "1503");
        require(unPayablePointBalances[_phone] > 0, "1511");

        uint256 amount = unPayablePointBalances[_phone];
        uint256 value = amount;
        unPayablePointBalances[_phone] = 0;
        pointBalances[_account] += amount;

        nonce[_account]++;

        emit ChangedToPayablePoint(_phone, _account, amount, value, pointBalances[_account]);

        if (loyaltyTypes[_account] == LoyaltyType.TOKEN) {
            _exchangePointToToken(_account);
        }
    }

    /// @notice 이용할 수 있는 지불 아이디 인지 알려준다.
    /// @param _paymentId 지불 아이디
    function isAvailablePaymentId(bytes32 _paymentId) public view returns (bool) {
        if (loyaltyPayments[_paymentId].status == LoyaltyPaymentStatus.INVALID) return true;
        else return false;
    }

    /// @notice 로얄티(포인트/토큰)을 구매데아타를 제공하는 함수
    /// @param _paymentId 지불 아이디
    function loyaltyPaymentOf(bytes32 _paymentId) public view returns (LoyaltyPaymentData memory) {
        return loyaltyPayments[_paymentId];
    }

    /// @notice 로얄티(포인트/토큰)을 사용하여 구매요청을 시작하는 함수
    /// @dev 중계서버를 통해서 호출됩니다.
    function openNewLoyaltyPayment(LoyaltyPaymentInputData calldata data) public {
        require(loyaltyPayments[data.paymentId].status == LoyaltyPaymentStatus.INVALID, "1530");

        bytes32 dataHash = keccak256(
            abi.encode(
                data.paymentId,
                data.purchaseId,
                data.amount,
                data.currency,
                data.shopId,
                data.account,
                nonce[data.account]
            )
        );
        require(ECDSA.recover(ECDSA.toEthSignedMessageHash(dataHash), data.signature) == data.account, "1501");

        nonce[data.account]++;

        if (loyaltyTypes[data.account] == LoyaltyType.POINT) {
            _openNewLoyaltyPaymentPoint(data);
        } else {
            _openNewLoyaltyPaymentToken(data);
        }
    }

    /// @notice 포인트를 사용한 구매요청을 시작하는 함수
    function _openNewLoyaltyPaymentPoint(LoyaltyPaymentInputData memory data) internal {
        uint256 paidPoint = convertCurrencyToPoint(data.amount, data.currency);
        uint256 paidToken = convertPointToToken(paidPoint);
        uint256 feeValue = (data.amount * fee) / 100;
        uint256 feePoint = convertCurrencyToPoint(feeValue, data.currency);
        uint256 feeToken = convertPointToToken(feePoint);

        require(pointBalances[data.account] >= (paidPoint + feePoint), "1511");

        pointBalances[data.account] -= (paidPoint + feePoint);
        pointBalances[temporaryAddress] += (paidPoint + feePoint);

        loyaltyPayments[data.paymentId] = LoyaltyPaymentData({
            paymentId: data.paymentId,
            purchaseId: data.purchaseId,
            currency: data.currency,
            shopId: data.shopId,
            account: data.account,
            timestamp: block.timestamp,
            loyaltyType: LoyaltyType.POINT,
            paidPoint: paidPoint,
            paidToken: paidToken,
            paidValue: data.amount,
            feePoint: feePoint,
            feeToken: feeToken,
            feeValue: feeValue,
            status: LoyaltyPaymentStatus.OPENED_PAYMENT
        });

        emit LoyaltyPaymentEvent(loyaltyPayments[data.paymentId], pointBalanceOf(data.account));
    }

    /// @notice 토큰을 사용한 구매요청을 시작하는 함수
    function _openNewLoyaltyPaymentToken(LoyaltyPaymentInputData memory data) internal {
        uint256 paidPoint = convertCurrencyToPoint(data.amount, data.currency);
        uint256 paidToken = convertPointToToken(paidPoint);
        uint256 feeValue = (data.amount * fee) / 100;
        uint256 feePoint = convertCurrencyToPoint(feeValue, data.currency);
        uint256 feeToken = convertPointToToken(feePoint);
        uint256 totalToken = paidToken + feeToken;

        require(tokenBalances[data.account] >= totalToken, "1511");

        tokenBalances[data.account] -= totalToken;
        tokenBalances[temporaryAddress] += totalToken;

        loyaltyPayments[data.paymentId] = LoyaltyPaymentData({
            paymentId: data.paymentId,
            purchaseId: data.purchaseId,
            currency: data.currency,
            shopId: data.shopId,
            account: data.account,
            timestamp: block.timestamp,
            loyaltyType: LoyaltyType.TOKEN,
            paidPoint: paidPoint,
            paidToken: paidToken,
            paidValue: data.amount,
            feePoint: feePoint,
            feeToken: feeToken,
            feeValue: feeValue,
            status: LoyaltyPaymentStatus.OPENED_PAYMENT
        });

        emit LoyaltyPaymentEvent(loyaltyPayments[data.paymentId], tokenBalanceOf(data.account));
    }

    /// @notice 로얄티(포인트/토큰)을 사용하여 구매요청을 종료 함수
    /// @dev 중계서버를 통해서 호출됩니다.
    function closeNewLoyaltyPayment(bytes32 _paymentId, bool _confirm) public {
        require(loyaltyPayments[_paymentId].status == LoyaltyPaymentStatus.OPENED_PAYMENT, "1531");

        require(certifierCollection.isCertifier(msg.sender), "1505");

        if (loyaltyTypes[loyaltyPayments[_paymentId].account] == LoyaltyType.POINT) {
            _closeNewLoyaltyPaymentPoint(_paymentId, _confirm);
        } else {
            _closeNewLoyaltyPaymentToken(_paymentId, _confirm);
        }
    }

    /// @notice 포인트를 사용한 구매요청을 종료하는 함수
    function _closeNewLoyaltyPaymentPoint(bytes32 _paymentId, bool _confirm) internal {
        uint256 totalPoint = loyaltyPayments[_paymentId].paidPoint + loyaltyPayments[_paymentId].feePoint;
        if (_confirm) {
            pointBalances[temporaryAddress] -= totalPoint;

            // 재단의 토큰으로 교환해 수수료계좌에 지급한다.
            if (tokenBalances[foundationAccount] >= loyaltyPayments[_paymentId].feeToken) {
                tokenBalances[foundationAccount] -= loyaltyPayments[_paymentId].feeToken;
                tokenBalances[feeAccount] += loyaltyPayments[_paymentId].feeToken;
            }

            shopCollection.addUsedPoint(
                loyaltyPayments[_paymentId].shopId,
                loyaltyPayments[_paymentId].paidPoint,
                loyaltyPayments[_paymentId].purchaseId,
                _paymentId
            );

            uint256 settlementPoint = shopCollection.getSettlementPoint(loyaltyPayments[_paymentId].shopId);
            if (settlementPoint > 0) {
                uint256 settlementToken = convertPointToToken(settlementPoint);
                if (tokenBalances[foundationAccount] >= settlementToken) {
                    tokenBalances[settlementAccount] += settlementToken;
                    tokenBalances[foundationAccount] -= settlementToken;
                    shopCollection.addSettledPoint(
                        loyaltyPayments[_paymentId].shopId,
                        settlementPoint,
                        loyaltyPayments[_paymentId].purchaseId
                    );
                    emit ProvidedTokenForSettlement(
                        settlementAccount,
                        loyaltyPayments[_paymentId].shopId,
                        settlementPoint,
                        settlementToken,
                        tokenBalances[settlementAccount],
                        loyaltyPayments[_paymentId].purchaseId
                    );
                }
            }

            loyaltyPayments[_paymentId].status = LoyaltyPaymentStatus.CLOSED_PAYMENT;

            emit LoyaltyPaymentEvent(loyaltyPayments[_paymentId], pointBalanceOf(loyaltyPayments[_paymentId].account));
        } else {
            // 임시저장 포인트를 소각한다.
            pointBalances[temporaryAddress] -= totalPoint;

            // 사용자에게 포인트를 반환한다
            pointBalances[loyaltyPayments[_paymentId].account] += totalPoint;

            loyaltyPayments[_paymentId].status = LoyaltyPaymentStatus.FAILED_PAYMENT;

            emit LoyaltyPaymentEvent(loyaltyPayments[_paymentId], pointBalanceOf(loyaltyPayments[_paymentId].account));
        }
    }

    /// @notice 토큰을 사용한 구매요청을 종료하는 함수
    function _closeNewLoyaltyPaymentToken(bytes32 _paymentId, bool _confirm) internal {
        if (_confirm) {
            tokenBalances[temporaryAddress] -= loyaltyPayments[_paymentId].paidToken;
            tokenBalances[foundationAccount] += loyaltyPayments[_paymentId].paidToken;
            tokenBalances[temporaryAddress] -= loyaltyPayments[_paymentId].feeToken;
            tokenBalances[feeAccount] += loyaltyPayments[_paymentId].feeToken;

            shopCollection.addUsedPoint(
                loyaltyPayments[_paymentId].shopId,
                loyaltyPayments[_paymentId].paidPoint,
                loyaltyPayments[_paymentId].purchaseId,
                _paymentId
            );

            uint256 settlementPoint = shopCollection.getSettlementPoint(loyaltyPayments[_paymentId].shopId);
            if (settlementPoint > 0) {
                uint256 settlementToken = convertPointToToken(settlementPoint);
                if (tokenBalances[foundationAccount] >= settlementToken) {
                    tokenBalances[settlementAccount] += settlementToken;
                    tokenBalances[foundationAccount] -= settlementToken;
                    shopCollection.addSettledPoint(
                        loyaltyPayments[_paymentId].shopId,
                        settlementPoint,
                        loyaltyPayments[_paymentId].purchaseId
                    );
                    emit ProvidedTokenForSettlement(
                        settlementAccount,
                        loyaltyPayments[_paymentId].shopId,
                        settlementPoint,
                        settlementToken,
                        tokenBalances[settlementAccount],
                        loyaltyPayments[_paymentId].purchaseId
                    );
                }
            }

            loyaltyPayments[_paymentId].status = LoyaltyPaymentStatus.CLOSED_PAYMENT;

            emit LoyaltyPaymentEvent(loyaltyPayments[_paymentId], tokenBalanceOf(loyaltyPayments[_paymentId].account));
        } else {
            tokenBalances[temporaryAddress] -= loyaltyPayments[_paymentId].paidToken;
            tokenBalances[loyaltyPayments[_paymentId].account] += loyaltyPayments[_paymentId].paidToken;
            tokenBalances[temporaryAddress] -= loyaltyPayments[_paymentId].feeToken;
            tokenBalances[loyaltyPayments[_paymentId].account] += loyaltyPayments[_paymentId].feeToken;

            loyaltyPayments[_paymentId].status = LoyaltyPaymentStatus.FAILED_PAYMENT;

            emit LoyaltyPaymentEvent(loyaltyPayments[_paymentId], tokenBalanceOf(loyaltyPayments[_paymentId].account));
        }
    }

    /// @notice 로얄티(포인트/토큰)을 사용한 구매에 대하여 취소를 시작하는 함수
    /// @dev 상점주가 중계서버를 통해서 호출됩니다.
    function openCancelLoyaltyPayment(bytes32 _paymentId, bytes calldata _signature) public {
        require(
            (loyaltyPayments[_paymentId].status != LoyaltyPaymentStatus.CLOSED_PAYMENT) ||
                (loyaltyPayments[_paymentId].status != LoyaltyPaymentStatus.FAILED_CANCEL),
            "1532"
        );
        require(block.timestamp <= loyaltyPayments[_paymentId].timestamp + 86400 * 7, "1534");

        ShopCollection.ShopData memory shopInfo = shopCollection.shopOf(loyaltyPayments[_paymentId].shopId);
        bytes32 dataHash = keccak256(
            abi.encode(_paymentId, loyaltyPayments[_paymentId].purchaseId, shopInfo.account, nonce[shopInfo.account])
        );
        require(ECDSA.recover(ECDSA.toEthSignedMessageHash(dataHash), _signature) == shopInfo.account, "1501");

        nonce[shopInfo.account]++;

        if (loyaltyPayments[_paymentId].loyaltyType == LoyaltyType.POINT) {
            if (tokenBalances[feeAccount] >= loyaltyPayments[_paymentId].feeToken) {
                tokenBalances[feeAccount] -= loyaltyPayments[_paymentId].feeToken;
                tokenBalances[temporaryAddress] += loyaltyPayments[_paymentId].feeToken;
                pointBalances[temporaryAddress] += (loyaltyPayments[_paymentId].paidPoint +
                    loyaltyPayments[_paymentId].feePoint);
                loyaltyPayments[_paymentId].status = LoyaltyPaymentStatus.OPENED_CANCEL;
                emit LoyaltyPaymentEvent(
                    loyaltyPayments[_paymentId],
                    pointBalanceOf(loyaltyPayments[_paymentId].account)
                );
            } else {
                revert("1513");
            }
        } else {
            if (
                (tokenBalances[foundationAccount] >= loyaltyPayments[_paymentId].paidToken) &&
                (tokenBalances[feeAccount] >= loyaltyPayments[_paymentId].feeToken)
            ) {
                tokenBalances[foundationAccount] -= loyaltyPayments[_paymentId].paidToken;
                tokenBalances[feeAccount] -= loyaltyPayments[_paymentId].feeToken;
                tokenBalances[temporaryAddress] += (loyaltyPayments[_paymentId].paidToken +
                    loyaltyPayments[_paymentId].feeToken);
                loyaltyPayments[_paymentId].status = LoyaltyPaymentStatus.OPENED_CANCEL;
                emit LoyaltyPaymentEvent(
                    loyaltyPayments[_paymentId],
                    tokenBalanceOf(loyaltyPayments[_paymentId].account)
                );
            } else {
                revert("1513");
            }
        }
    }

    /// @notice 로얄티(포인트/토큰)을 사용한 구매에 대하여 취소를 종료하는 함수
    /// @dev 사용자가 중계서버를 통해서 호출됩니다.
    function closeCancelLoyaltyPayment(bytes32 _paymentId, bool _confirm) public {
        require(loyaltyPayments[_paymentId].status == LoyaltyPaymentStatus.OPENED_CANCEL, "1533");

        require(certifierCollection.isCertifier(msg.sender), "1505");

        if (_confirm) {
            loyaltyPayments[_paymentId].status = LoyaltyPaymentStatus.CLOSED_CANCEL;
            if (loyaltyPayments[_paymentId].loyaltyType == LoyaltyType.POINT) {
                tokenBalances[foundationAccount] += loyaltyPayments[_paymentId].feeToken;
                tokenBalances[temporaryAddress] -= loyaltyPayments[_paymentId].feeToken;
                pointBalances[loyaltyPayments[_paymentId].account] += (loyaltyPayments[_paymentId].paidPoint +
                    loyaltyPayments[_paymentId].feePoint);
                shopCollection.subUsedPoint(
                    loyaltyPayments[_paymentId].shopId,
                    loyaltyPayments[_paymentId].paidPoint,
                    loyaltyPayments[_paymentId].purchaseId,
                    _paymentId
                );
                emit LoyaltyPaymentEvent(
                    loyaltyPayments[_paymentId],
                    pointBalanceOf(loyaltyPayments[_paymentId].account)
                );
            } else {
                tokenBalances[temporaryAddress] -= (loyaltyPayments[_paymentId].paidToken +
                    loyaltyPayments[_paymentId].feeToken);
                tokenBalances[loyaltyPayments[_paymentId].account] += (loyaltyPayments[_paymentId].paidToken +
                    loyaltyPayments[_paymentId].feeToken);
                shopCollection.subUsedPoint(
                    loyaltyPayments[_paymentId].shopId,
                    loyaltyPayments[_paymentId].paidPoint,
                    loyaltyPayments[_paymentId].purchaseId,
                    _paymentId
                );
                emit LoyaltyPaymentEvent(
                    loyaltyPayments[_paymentId],
                    tokenBalanceOf(loyaltyPayments[_paymentId].account)
                );
            }
        } else {
            loyaltyPayments[_paymentId].status = LoyaltyPaymentStatus.FAILED_CANCEL;
            if (loyaltyPayments[_paymentId].loyaltyType == LoyaltyType.POINT) {
                tokenBalances[temporaryAddress] -= loyaltyPayments[_paymentId].feeToken;
                tokenBalances[feeAccount] += loyaltyPayments[_paymentId].feeToken;
                pointBalances[temporaryAddress] -= (loyaltyPayments[_paymentId].paidPoint +
                    loyaltyPayments[_paymentId].feePoint);
                emit LoyaltyPaymentEvent(
                    loyaltyPayments[_paymentId],
                    pointBalanceOf(loyaltyPayments[_paymentId].account)
                );
            } else {
                tokenBalances[temporaryAddress] -= (loyaltyPayments[_paymentId].paidToken +
                    loyaltyPayments[_paymentId].feeToken);
                tokenBalances[foundationAccount] += loyaltyPayments[_paymentId].paidToken;
                tokenBalances[feeAccount] += loyaltyPayments[_paymentId].feeToken;
                emit LoyaltyPaymentEvent(
                    loyaltyPayments[_paymentId],
                    tokenBalanceOf(loyaltyPayments[_paymentId].account)
                );
            }
        }
    }

    function convertPointToToken(uint256 amount) internal view returns (uint256) {
        return (amount * currencyRate.MULTIPLE()) / currencyRate.get(token.symbol());
    }

    function convertTokenToPoint(uint256 amount) internal view returns (uint256) {
        return (amount * currencyRate.get(token.symbol())) / currencyRate.MULTIPLE();
    }

    function convertCurrencyToPoint(uint256 _amount, string memory _currency) internal view returns (uint256) {
        bytes32 byteCurrency = keccak256(bytes(_currency));
        if ((byteCurrency == BASE_CURRENCY) || (byteCurrency == NULL_CURRENCY)) {
            return _amount;
        } else {
            return (_amount * currencyRate.get(_currency)) / currencyRate.MULTIPLE();
        }
    }

    /// @notice 토큰을 예치합니다.
    /// @param _amount 금액
    function deposit(uint256 _amount) public {
        require(loyaltyTypes[msg.sender] == LoyaltyType.TOKEN, "1520");
        require(_amount <= token.allowance(msg.sender, address(this)), "1512");
        token.transferFrom(msg.sender, address(this), _amount);

        tokenBalances[msg.sender] += _amount;

        emit Deposited(msg.sender, _amount, convertTokenToPoint(_amount), tokenBalances[msg.sender]);
    }

    /// @notice 토큰을 인출합니다.
    /// @param _amount 금액
    function withdraw(uint256 _amount) public {
        require(_amount <= tokenBalances[msg.sender], "1511");
        token.transfer(msg.sender, _amount);

        tokenBalances[msg.sender] -= _amount;

        emit Withdrawn(msg.sender, _amount, convertTokenToPoint(_amount), tokenBalances[msg.sender]);
    }

    /// @notice 포인트의 잔고를 리턴한다
    /// @param _hash 전화번호의 해시
    function unPayablePointBalanceOf(bytes32 _hash) public view returns (uint256) {
        return unPayablePointBalances[_hash];
    }

    /// @notice 포인트의 잔고를 리턴한다
    /// @param _account 지갑주소
    function pointBalanceOf(address _account) public view returns (uint256) {
        return pointBalances[_account];
    }

    /// @notice 토큰의 잔고를 리턴한다
    /// @param _account 지갑주소
    function tokenBalanceOf(address _account) public view returns (uint256) {
        return tokenBalances[_account];
    }

    /// @notice nonce를  리턴한다
    /// @param _account 지갑주소
    function nonceOf(address _account) public view returns (uint256) {
        return nonce[_account];
    }

    /// @notice 구매 데이터를 리턴한다
    /// @param _purchaseId 구매 아이디
    function purchaseOf(string calldata _purchaseId) public view returns (PurchaseData memory) {
        return purchases[_purchaseId];
    }

    /// @notice 구매 데이터의 아이디를 리턴한다
    /// @param _idx 배열의 순번
    function purchaseIdOf(uint256 _idx) public view returns (string memory) {
        return purchaseIds[_idx];
    }

    /// @notice 구매 데이터의 갯수를 리턴한다
    function purchasesLength() public view returns (uint256) {
        return purchaseIds.length;
    }

    /// @notice 사용자가 적립할 포인트의 종류를 리턴한다
    /// @param _account 지갑주소
    function loyaltyTypeOf(address _account) public view returns (LoyaltyType) {
        return loyaltyTypes[_account];
    }

    /// @notice 사용자가 적립할 로열티를 토큰으로 변경한다.
    /// @param _account 지갑주소
    /// @param _signature 서명
    /// @dev 중계서버를 통해서 호출됩니다.
    function changeToLoyaltyToken(address _account, bytes calldata _signature) public {
        bytes32 dataHash = keccak256(abi.encode(_account, nonce[_account]));
        require(ECDSA.recover(ECDSA.toEthSignedMessageHash(dataHash), _signature) == _account, "1501");

        _changeToLoyaltyToken(_account);
    }

    /// @notice 사용자가 적립할 포인트의 종류를 리턴한다
    /// @dev 사용자에 의해 직접 호출됩니다.
    function changeToLoyaltyTokenDirect() public {
        _changeToLoyaltyToken(msg.sender);
    }

    function _changeToLoyaltyToken(address _account) internal {
        if (loyaltyTypes[_account] != LoyaltyType.TOKEN) {
            loyaltyTypes[_account] = LoyaltyType.TOKEN;
            _exchangePointToToken(_account);
        }
    }

    function _exchangePointToToken(address _account) internal {
        uint256 amountPoint;
        uint256 amountToken;
        if (pointBalances[_account] > 0) {
            amountPoint = pointBalances[_account];
            amountToken = convertPointToToken(amountPoint);
            require(tokenBalances[foundationAccount] >= amountToken, "1510");
            tokenBalances[_account] += amountToken;
            tokenBalances[foundationAccount] -= amountToken;
            pointBalances[_account] = 0;
        } else {
            amountPoint = 0;
            amountToken = 0;
        }
        nonce[_account]++;
        emit ChangedToLoyaltyToken(_account, amountToken, amountPoint, tokenBalances[_account]);
    }

    /// @notice 포인트와 토큰의 사용수수료률을 설정합니다. 5%를 초과한 값은 설정할 수 없습니다.
    /// @param _fee % 단위 입니다.
    function setFee(uint32 _fee) public {
        require(_fee <= MAX_FEE, "1521");
        require(msg.sender == feeAccount, "1050");
        fee = _fee;
    }
}
