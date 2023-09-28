// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "del-osx-artifacts/contracts/LinkCollection.sol";
import "./ValidatorCollection.sol";
import "./CurrencyRate.sol";
import "./ShopCollection.sol";

/// @notice 포인트와 토큰의 원장
contract Ledger {
    /// @notice Hash value of a blank string
    bytes32 public constant NULL = 0xe3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855;
    bytes32 public constant BASE_CURRENCY = keccak256(bytes("krw"));
    bytes32 public constant NULL_CURRENCY = keccak256(bytes(""));

    mapping(bytes32 => uint256) private pointLedger;
    mapping(bytes32 => uint256) private tokenLedger;
    mapping(address => uint256) private nonce;

    struct PurchaseData {
        string purchaseId;
        uint256 timestamp;
        uint256 amount;
        bytes32 email;
        string shopId;
        uint32 method;
        string currency;
    }

    mapping(string => PurchaseData) private purchases;
    string[] private purchaseIds;

    bytes32 public foundationAccount;
    address public tokenAddress;
    address public validatorAddress;
    address public linkCollectionAddress;
    address public currencyRateAddress;
    address public shopCollectionAddress;

    ERC20 private token;
    ValidatorCollection private validatorCollection;
    LinkCollection private linkCollection;
    CurrencyRate private currencyRate;
    ShopCollection private shopCollection;

    /// @notice 검증자가 추가될 때 발생되는 이벤트
    event SavedPurchase(
        string purchaseId,
        uint256 timestamp,
        uint256 amount,
        bytes32 email,
        string shopId,
        uint32 method,
        string currency
    );
    /// @notice 포인트가 지급될 때 발생되는 이벤트
    event ProvidedPoint(
        bytes32 email,
        uint256 providedAmountPoint,
        uint256 value,
        uint256 balancePoint,
        string purchaseId,
        string shopId
    );
    /// @notice 포인트가 정산될 때 발생되는 이벤트
    event ProvidedPointToShop(
        bytes32 email,
        uint256 providedAmountPoint,
        uint256 value,
        uint256 balancePoint,
        string purchaseId,
        string shopId
    );
    /// @notice 토큰이 지급될 때 발생되는 이벤트
    event ProvidedToken(
        bytes32 email,
        uint256 providedAmountToken,
        uint256 value,
        uint256 balanceToken,
        string purchaseId,
        string shopId
    );
    /// @notice 포인트로 지불을 완료했을 때 발생하는 이벤트
    event PaidPoint(
        bytes32 email,
        uint256 paidAmountPoint,
        uint256 value,
        uint256 balancePoint,
        string purchaseId,
        string shopId
    );
    /// @notice 토큰으로 지불을 완료했을 때 발생하는 이벤트
    event PaidToken(
        bytes32 email,
        uint256 paidAmountToken,
        uint256 value,
        uint256 balanceToken,
        string purchaseId,
        string shopId
    );
    /// @notice 토큰을 예치했을 때 발생하는 이벤트
    event Deposited(bytes32 email, uint256 depositAmount, uint256 value, uint256 balanceToken, address account);
    /// @notice 토큰을 인출했을 때 발생하는 이벤트
    event Withdrawn(bytes32 email, uint256 withdrawAmount, uint256 value, uint256 balanceToken, address account);

    /// @notice 생성자
    /// @param _foundationAccount 재단의 계정
    /// @param _tokenAddress 토큰 컨트랙트의 주소
    /// @param _validatorAddress 검증자 컬랙션 컨트랙트의 주소
    /// @param _linkCollectionAddress 이메일-지갑주소 링크 컨트랙트의 주소
    /// @param _currencyRateAddress 환률을 제공하는 컨트랙트의 주소
    /// @param _shopCollectionAddress 가맹점 컬랙션 컨트랙트의 주소
    constructor(
        bytes32 _foundationAccount,
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
        linkCollection = LinkCollection(_linkCollectionAddress);
        currencyRate = CurrencyRate(_currencyRateAddress);
        shopCollection = ShopCollection(_shopCollectionAddress);
    }

    modifier onlyValidator(address _account) {
        require(validatorCollection.isActiveValidator(_account), "Not validator");
        _;
    }

    /// @notice 구매내역을 저장합니다.
    /// @dev 이것은 검증자들에 의해 호출되어야 합니다.
    /// @param _purchaseId 구매 아이디
    /// @param _timestamp 구매 시간
    /// @param _amount 구매 금액
    /// @param _email 구매한 사용자의 이메일 해시
    /// @param _shopId 구매한 가맹점 아이디
    /// @param _method 0: 현금또는 카드, 1 : 포인트, 2: 토큰
    /// @param _currency 통화코드
    function savePurchase(
        string memory _purchaseId,
        uint256 _timestamp,
        uint256 _amount,
        bytes32 _email,
        string memory _shopId,
        uint32 _method,
        string memory _currency
    ) public onlyValidator(msg.sender) {
        PurchaseData memory data = PurchaseData({
            purchaseId: _purchaseId,
            timestamp: _timestamp,
            amount: _amount,
            email: _email,
            shopId: _shopId,
            method: _method,
            currency: _currency
        });
        purchaseIds.push(_purchaseId);
        purchases[_purchaseId] = data;

        if ((_method == 0) && (_email != NULL)) {
            ShopCollection.ShopData memory shop = shopCollection.shopOf(_shopId);
            if (shop.status == ShopCollection.ShopStatus.ACTIVE) {
                uint256 point = (convertCurrencyToPoint(_amount, _currency) * shop.providePercent) / 100;
                address account = linkCollection.toAddress(_email);
                if (account == address(0x00)) {
                    providePoint(_email, point, _purchaseId, _shopId);
                } else {
                    provideToken(_email, point, _purchaseId, _shopId);
                }
                shopCollection.addProvidedPoint(_shopId, point, _purchaseId);
            }
        }
        emit SavedPurchase(_purchaseId, _timestamp, _amount, _email, _shopId, _method, _currency);
    }

    /// @notice 포인트를 지급합니다.
    /// @dev 구매 데이터를 확인한 후 호출됩니다.
    /// @param _email 이메일 해시
    /// @param _amount 지급할 포인트
    /// @param _purchaseId 구매 아이디
    /// @param _shopId 구매한 가맹점 아이디
    function providePoint(bytes32 _email, uint256 _amount, string memory _purchaseId, string memory _shopId) internal {
        pointLedger[_email] += _amount;
        emit ProvidedPoint(_email, _amount, _amount, pointLedger[_email], _purchaseId, _shopId);
    }

    /// @notice 토큰을 지급합니다.
    /// @dev 구매 데이터를 확인한 후 호출됩니다.
    /// @param _email 이메일 해시
    /// @param _amount 지급할 토큰
    /// @param _purchaseId 구매 아이디
    /// @param _shopId 구매한 가맹점 아이디
    function provideToken(bytes32 _email, uint256 _amount, string memory _purchaseId, string memory _shopId) internal {
        uint256 amountToken = convertPointToToken(_amount);

        require(tokenLedger[foundationAccount] >= amountToken, "Insufficient foundation balance");
        tokenLedger[_email] += amountToken;
        tokenLedger[foundationAccount] -= amountToken;

        emit ProvidedToken(_email, amountToken, _amount, tokenLedger[_email], _purchaseId, _shopId);
    }

    /// @notice 포인트를 구매에 사용하는 함수
    /// @dev 중계서버를 통해서 호출됩니다.
    /// @param _purchaseId 구매 아이디
    /// @param _amount 구매 금액
    /// @param _email 구매한 사용자의 이메일 해시
    /// @param _shopId 구매한 가맹점 아이디
    /// @param _signer 구매자의 주소
    /// @param _signature 서명
    function payPoint(
        string memory _purchaseId,
        uint256 _amount,
        bytes32 _email,
        string memory _shopId,
        address _signer,
        bytes calldata _signature
    ) public {
        bytes32 dataHash = keccak256(abi.encode(_purchaseId, _amount, _email, _shopId, _signer, nonce[_signer]));
        require(ECDSA.recover(ECDSA.toEthSignedMessageHash(dataHash), _signature) == _signer, "Invalid signature");
        address userAddress = linkCollection.toAddress(_email);
        require(userAddress != address(0x00), "Unregistered email-address");
        require(userAddress == _signer, "Invalid address");
        require(pointLedger[_email] >= _amount, "Insufficient balance");

        pointLedger[_email] -= _amount;
        shopCollection.addUsedPoint(_shopId, _amount, _purchaseId);

        uint256 clearAmount = shopCollection.getClearPoint(_shopId);
        if (clearAmount > 0) {
            shopCollection.addClearedPoint(_shopId, clearAmount, _purchaseId);
            ShopCollection.ShopData memory shop = shopCollection.shopOf(_shopId);
            if (shop.email != NULL) {
                pointLedger[shop.email] += clearAmount;
                emit ProvidedPointToShop(
                    shop.email,
                    clearAmount,
                    clearAmount,
                    pointLedger[shop.email],
                    _purchaseId,
                    _shopId
                );
            }
        }

        nonce[_signer]++;

        emit PaidPoint(_email, _amount, _amount, pointLedger[_email], _purchaseId, _shopId);
    }

    /// @notice 토큰을 구매에 사용하는 함수
    /// @dev 중계서버를 통해서 호출됩니다.
    /// @param _purchaseId 구매 아이디
    /// @param _amount 구매 금액
    /// @param _email 구매한 사용자의 이메일 해시
    /// @param _shopId 구매한 가맹점 아이디
    /// @param _signer 구매자의 주소
    /// @param _signature 서명
    function payToken(
        string memory _purchaseId,
        uint256 _amount,
        bytes32 _email,
        string memory _shopId,
        address _signer,
        bytes calldata _signature
    ) public {
        bytes32 dataHash = keccak256(abi.encode(_purchaseId, _amount, _email, _shopId, _signer, nonce[_signer]));
        require(ECDSA.recover(ECDSA.toEthSignedMessageHash(dataHash), _signature) == _signer, "Invalid signature");
        address userAddress = linkCollection.toAddress(_email);
        require(userAddress != address(0x00), "Unregistered email-address");
        require(userAddress == _signer, "Invalid address");

        uint256 amountToken = convertPointToToken(_amount);
        require(tokenLedger[_email] >= amountToken, "Insufficient balance");

        uint256 lAmount = _amount;
        bytes32 lEmail = _email;
        string memory lPurchaseId = _purchaseId;
        string memory lShopId = _shopId;
        tokenLedger[lEmail] -= amountToken;
        tokenLedger[foundationAccount] += amountToken;
        shopCollection.addUsedPoint(lShopId, lAmount, lPurchaseId);

        uint256 clearAmount = shopCollection.getClearPoint(lShopId);
        if (clearAmount > 0) {
            shopCollection.addClearedPoint(lShopId, clearAmount, lPurchaseId);
            ShopCollection.ShopData memory shop = shopCollection.shopOf(lShopId);
            if (shop.email != NULL) {
                pointLedger[shop.email] += clearAmount;
                emit ProvidedPointToShop(
                    shop.email,
                    clearAmount,
                    clearAmount,
                    pointLedger[shop.email],
                    lPurchaseId,
                    lShopId
                );
            }
        }

        nonce[_signer]++;

        emit PaidToken(lEmail, amountToken, lAmount, tokenLedger[lEmail], lPurchaseId, lShopId);
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
        bytes32 email = linkCollection.toEmail(msg.sender);
        require(email != bytes32(0x00), "Unregistered email-address");

        require(_amount <= token.allowance(msg.sender, address(this)), "Not allowed deposit");
        token.transferFrom(msg.sender, address(this), _amount);

        tokenLedger[email] += _amount;

        uint256 amountPoint = convertTokenToPoint(_amount);
        emit Deposited(email, _amount, amountPoint, tokenLedger[email], msg.sender);
    }

    /// @notice 토큰을 인출합니다.
    /// @param _amount 금액
    function withdraw(uint256 _amount) public {
        bytes32 email = linkCollection.toEmail(msg.sender);
        require(email != bytes32(0x00), "Unregistered email-address");

        require(_amount <= tokenLedger[email], "Insufficient balance");
        token.transfer(msg.sender, _amount);

        tokenLedger[email] -= _amount;

        uint256 amountPoint = convertTokenToPoint(_amount);
        emit Withdrawn(email, _amount, amountPoint, tokenLedger[email], msg.sender);
    }

    /// @notice 포인트의 잔고를 리턴한다
    /// @param _hash 이메일의 해시
    function pointBalanceOf(bytes32 _hash) public view returns (uint256) {
        return pointLedger[_hash];
    }

    /// @notice 토큰의 잔고를 리턴한다
    /// @param _hash 이메일의 해시
    function tokenBalanceOf(bytes32 _hash) public view returns (uint256) {
        return tokenLedger[_hash];
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
}
