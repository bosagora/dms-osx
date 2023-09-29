// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "del-osx-artifacts/contracts/PhoneLinkCollection.sol";
import "./ValidatorCollection.sol";
import "./CurrencyRate.sol";
import "./ShopCollection.sol";

/// @notice 포인트와 토큰의 원장
contract Ledger {
    /// @notice Hash value of a blank string
    bytes32 public constant NULL = 0x32105b1d0b88ada155176b58ee08b45c31e4f2f7337475831982c313533b880c;
    bytes32 public constant BASE_CURRENCY = keccak256(bytes("krw"));
    bytes32 public constant NULL_CURRENCY = keccak256(bytes(""));

    mapping(bytes32 => uint256) private unPayablePointBalances;
    mapping(address => uint256) private pointBalances;
    mapping(address => uint256) private tokenBalances;
    mapping(address => uint256) private nonce;

    enum PointType {
        POINT,
        TOKEN
    }
    mapping(address => PointType) private pointTypes;

    struct PurchaseData {
        string purchaseId;
        uint256 timestamp;
        uint256 amount;
        string currency;
        string shopId;
        uint32 method;
        address userAccount;
        bytes32 userPhone;
    }

    mapping(string => PurchaseData) private purchases;
    string[] private purchaseIds;

    address public foundationAccount;
    address public tokenAddress;
    address public validatorAddress;
    address public linkCollectionAddress;
    address public currencyRateAddress;
    address public shopCollectionAddress;

    ERC20 private token;
    ValidatorCollection private validatorCollection;
    PhoneLinkCollection private linkCollection;
    CurrencyRate private currencyRate;
    ShopCollection private shopCollection;

    /// @notice 검증자가 추가될 때 발생되는 이벤트
    event SavedPurchase(
        string purchaseId,
        uint256 timestamp,
        uint256 amount,
        string currency,
        string shopId,
        uint32 method,
        address userAccount,
        bytes32 userPhone
    );
    /// @notice 포인트가 지급될 때 발생되는 이벤트
    event ProvidedPoint(
        address account,
        bytes32 phone,
        uint256 providedAmountPoint,
        uint256 value,
        uint256 balancePoint,
        string purchaseId,
        string shopId
    );
    /// @notice 포인트가 정산될 때 발생되는 이벤트
    event ProvidedPointToShop(string shopId, uint256 providedAmountPoint, string purchaseId);
    /// @notice 토큰이 지급될 때 발생되는 이벤트
    event ProvidedToken(
        address account,
        bytes32 phone,
        uint256 providedAmountToken,
        uint256 value,
        uint256 balanceToken,
        string purchaseId,
        string shopId
    );
    /// @notice 포인트로 지불을 완료했을 때 발생하는 이벤트
    event PaidPoint(
        address account,
        uint256 paidAmountPoint,
        uint256 value,
        uint256 balancePoint,
        string purchaseId,
        string shopId
    );
    /// @notice 토큰으로 지불을 완료했을 때 발생하는 이벤트
    event PaidToken(
        address account,
        uint256 paidAmountToken,
        uint256 value,
        uint256 balanceToken,
        string purchaseId,
        string shopId
    );
    /// @notice 토큰을 예치했을 때 발생하는 이벤트
    event Deposited(address account, uint256 depositAmount, uint256 value, uint256 balanceToken);
    /// @notice 토큰을 인출했을 때 발생하는 이벤트
    event Withdrawn(address account, uint256 withdrawAmount, uint256 value, uint256 balanceToken);

    /// @notice 생성자
    /// @param _foundationAccount 재단의 계정
    /// @param _tokenAddress 토큰 컨트랙트의 주소
    /// @param _validatorAddress 검증자 컬랙션 컨트랙트의 주소
    /// @param _linkCollectionAddress 전화번호-지갑주소 링크 컨트랙트의 주소
    /// @param _currencyRateAddress 환률을 제공하는 컨트랙트의 주소
    /// @param _shopCollectionAddress 가맹점 컬랙션 컨트랙트의 주소
    constructor(
        address _foundationAccount,
        address _tokenAddress,
        address _validatorAddress,
        address _linkCollectionAddress,
        address _currencyRateAddress,
        address _shopCollectionAddress
    ) {
        foundationAccount = _foundationAccount;
        tokenAddress = _tokenAddress;
        validatorAddress = _validatorAddress;
        linkCollectionAddress = _linkCollectionAddress;
        currencyRateAddress = _currencyRateAddress;
        shopCollectionAddress = _shopCollectionAddress;

        token = ERC20(_tokenAddress);
        validatorCollection = ValidatorCollection(_validatorAddress);
        linkCollection = PhoneLinkCollection(_linkCollectionAddress);
        currencyRate = CurrencyRate(_currencyRateAddress);
        shopCollection = ShopCollection(_shopCollectionAddress);
    }

    modifier onlyValidator(address _account) {
        require(validatorCollection.isActiveValidator(_account), "Not validator");
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
                if (data.userAccount != address(0x0)) {
                    uint256 point = (convertCurrencyToPoint(data.amount, data.currency) * shop.providePercent) / 100;
                    if (pointTypes[data.userAccount] == PointType.POINT) {
                        providePoint(data.userAccount, data.userPhone, point, data.purchaseId, data.shopId);
                    } else {
                        provideToken(data.userAccount, data.userPhone, point, data.purchaseId, data.shopId);
                    }
                    shopCollection.addProvidedPoint(data.shopId, point, data.purchaseId);
                } else if (data.userPhone != NULL) {
                    uint256 point = (convertCurrencyToPoint(data.amount, data.currency) * shop.providePercent) / 100;
                    address account = linkCollection.toAddress(data.userPhone);
                    if (account == address(0x00)) {
                        provideUnPayablePoint(account, data.userPhone, point, data.purchaseId, data.shopId);
                    } else {
                        if (pointTypes[account] == PointType.POINT) {
                            providePoint(account, data.userPhone, point, data.purchaseId, data.shopId);
                        } else {
                            provideToken(account, data.userPhone, point, data.purchaseId, data.shopId);
                        }
                    }
                    shopCollection.addProvidedPoint(data.shopId, point, data.purchaseId);
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
            data.userAccount,
            data.userPhone
        );
    }

    /// @notice 포인트를 지급합니다.
    /// @dev 구매 데이터를 확인한 후 호출됩니다.
    /// @param _account 사용자의 지갑주소
    /// @param _phone 전화번호 해시
    /// @param _amount 지급할 포인트
    /// @param _purchaseId 구매 아이디
    /// @param _shopId 구매한 가맹점 아이디
    function providePoint(
        address _account,
        bytes32 _phone,
        uint256 _amount,
        string memory _purchaseId,
        string memory _shopId
    ) internal {
        pointBalances[_account] += _amount;
        emit ProvidedPoint(_account, _phone, _amount, _amount, pointBalances[_account], _purchaseId, _shopId);
    }

    /// @notice 포인트를 지급합니다.
    /// @dev 구매 데이터를 확인한 후 호출됩니다.
    /// @param _account 사용자의 지갑주소
    /// @param _phone 전화번호 해시
    /// @param _amount 지급할 포인트
    /// @param _purchaseId 구매 아이디
    /// @param _shopId 구매한 가맹점 아이디
    function provideUnPayablePoint(
        address _account,
        bytes32 _phone,
        uint256 _amount,
        string memory _purchaseId,
        string memory _shopId
    ) internal {
        unPayablePointBalances[_phone] += _amount;
        emit ProvidedPoint(_account, _phone, _amount, _amount, unPayablePointBalances[_phone], _purchaseId, _shopId);
    }

    /// @notice 토큰을 지급합니다.
    /// @dev 구매 데이터를 확인한 후 호출됩니다.
    /// @param _account 사용자의 지갑주소
    /// @param _phone 전화번호 해시
    /// @param _amount 지급할 토큰
    /// @param _purchaseId 구매 아이디
    /// @param _shopId 구매한 가맹점 아이디
    function provideToken(
        address _account,
        bytes32 _phone,
        uint256 _amount,
        string memory _purchaseId,
        string memory _shopId
    ) internal {
        uint256 amountToken = convertPointToToken(_amount);

        require(tokenBalances[foundationAccount] >= amountToken, "Insufficient foundation balance");
        tokenBalances[_account] += amountToken;
        tokenBalances[foundationAccount] -= amountToken;

        emit ProvidedToken(_account, _phone, amountToken, _amount, tokenBalances[_account], _purchaseId, _shopId);
    }

    /// @notice 포인트를 구매에 사용하는 함수
    /// @dev 중계서버를 통해서 호출됩니다.
    /// @param _purchaseId 구매 아이디
    /// @param _amount 구매 금액
    /// @param _shopId 구매한 가맹점 아이디
    /// @param _signer 구매자의 주소
    /// @param _signature 서명
    function payPoint(
        string memory _purchaseId,
        uint256 _amount,
        string memory _shopId,
        address _signer,
        bytes calldata _signature
    ) public {
        bytes32 dataHash = keccak256(abi.encode(_purchaseId, _amount, _shopId, _signer, nonce[_signer]));
        require(ECDSA.recover(ECDSA.toEthSignedMessageHash(dataHash), _signature) == _signer, "Invalid signature");
        require(pointBalances[_signer] >= _amount, "Insufficient balance");

        pointBalances[_signer] -= _amount;
        shopCollection.addUsedPoint(_shopId, _amount, _purchaseId);

        uint256 clearAmount = shopCollection.getClearPoint(_shopId);
        if (clearAmount > 0) {
            shopCollection.addClearedPoint(_shopId, clearAmount, _purchaseId);
            emit ProvidedPointToShop(_shopId, clearAmount, _purchaseId);
        }

        nonce[_signer]++;

        emit PaidPoint(_signer, _amount, _amount, pointBalances[_signer], _purchaseId, _shopId);
    }

    /// @notice 토큰을 구매에 사용하는 함수
    /// @dev 중계서버를 통해서 호출됩니다.
    /// @param _purchaseId 구매 아이디
    /// @param _amount 구매 금액
    /// @param _shopId 구매한 가맹점 아이디
    /// @param _signer 구매자의 주소
    /// @param _signature 서명
    function payToken(
        string memory _purchaseId,
        uint256 _amount,
        string memory _shopId,
        address _signer,
        bytes calldata _signature
    ) public {
        bytes32 dataHash = keccak256(abi.encode(_purchaseId, _amount, _shopId, _signer, nonce[_signer]));
        require(ECDSA.recover(ECDSA.toEthSignedMessageHash(dataHash), _signature) == _signer, "Invalid signature");

        uint256 amountToken = convertPointToToken(_amount);
        require(tokenBalances[_signer] >= amountToken, "Insufficient balance");

        uint256 lAmount = _amount;
        string memory lPurchaseId = _purchaseId;
        string memory lShopId = _shopId;
        tokenBalances[_signer] -= amountToken;
        tokenBalances[foundationAccount] += amountToken;
        shopCollection.addUsedPoint(lShopId, lAmount, lPurchaseId);

        uint256 clearAmount = shopCollection.getClearPoint(lShopId);
        if (clearAmount > 0) {
            shopCollection.addClearedPoint(lShopId, clearAmount, lPurchaseId);
            emit ProvidedPointToShop(lShopId, clearAmount, lPurchaseId);
        }

        nonce[_signer]++;

        emit PaidToken(_signer, amountToken, lAmount, tokenBalances[_signer], lPurchaseId, lShopId);
    }

    function convertPointToToken(uint256 amount) internal view returns (uint256) {
        uint256 price = currencyRate.get(token.symbol());
        return (amount * currencyRate.MULTIPLE()) / price;
    }

    function convertTokenToPoint(uint256 amount) internal view returns (uint256) {
        uint256 price = currencyRate.get(token.symbol());
        return (amount * price) / currencyRate.MULTIPLE();
    }

    function convertCurrencyToPoint(uint256 _amount, string memory _currency) internal view returns (uint256) {
        bytes32 byteCurrency = keccak256(bytes(_currency));
        if ((byteCurrency == BASE_CURRENCY) || (byteCurrency == NULL_CURRENCY)) {
            return _amount;
        } else {
            uint256 rate = currencyRate.get(_currency);
            return (_amount * rate) / currencyRate.MULTIPLE();
        }
    }

    /// @notice 토큰을 예치합니다.
    /// @param _amount 금액
    function deposit(uint256 _amount) public {
        require(_amount <= token.allowance(msg.sender, address(this)), "Not allowed deposit");
        token.transferFrom(msg.sender, address(this), _amount);

        tokenBalances[msg.sender] += _amount;

        uint256 amountPoint = convertTokenToPoint(_amount);
        emit Deposited(msg.sender, _amount, amountPoint, tokenBalances[msg.sender]);
    }

    /// @notice 토큰을 인출합니다.
    /// @param _amount 금액
    function withdraw(uint256 _amount) public {
        require(_amount <= tokenBalances[msg.sender], "Insufficient balance");
        token.transfer(msg.sender, _amount);

        tokenBalances[msg.sender] -= _amount;

        uint256 amountPoint = convertTokenToPoint(_amount);
        emit Withdrawn(msg.sender, _amount, amountPoint, tokenBalances[msg.sender]);
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
    function purchaseOf(string memory _purchaseId) public view returns (PurchaseData memory) {
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
    function pointTypeOf(address _account) public view returns (PointType) {
        return pointTypes[_account];
    }

    /// @notice 사용자가 적립할 포인트의 종류를 리턴한다
    /// @param _type 0: 포인트, 1: 토큰
    function setPointType(PointType _type) public {
        require(PointType.POINT <= _type && _type <= PointType.TOKEN);
        pointTypes[msg.sender] = _type;
    }
}
