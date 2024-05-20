// SPDX-License-Identifier: AGPL-3.0-or-later

pragma solidity ^0.8.2;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";

import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

import "loyalty-tokens/contracts/BIP20/BIP20DelegatedTransfer.sol";
import "dms-bridge-contracts/contracts/interfaces/IBridgeLiquidity.sol";
import "dms-bridge-contracts/contracts/lib/BridgeLib.sol";

import "../interfaces/ICurrencyRate.sol";
import "../interfaces/ILedger.sol";
import "./LedgerStorage.sol";

import "../lib/DMS.sol";

/// @notice 포인트와 토큰의 원장
contract Ledger is LedgerStorage, Initializable, OwnableUpgradeable, UUPSUpgradeable, ILedger, IBridgeLiquidity {
    /// @notice 포인트가 지급될 때 발생되는 이벤트
    event ProvidedPoint(
        address account,
        uint256 providedPoint,
        uint256 providedValue,
        string currency,
        uint256 balancePoint,
        string purchaseId,
        bytes32 shopId
    );

    /// @notice 포인트가 지급될 때 발생되는 이벤트
    event ProvidedUnPayablePoint(
        bytes32 phone,
        uint256 providedPoint,
        uint256 providedValue,
        string currency,
        uint256 balancePoint,
        string purchaseId,
        bytes32 shopId
    );

    /// @notice 토큰을 예치했을 때 발생하는 이벤트
    event Deposited(address account, uint256 depositedToken, uint256 depositedValue, uint256 balanceToken);
    /// @notice 토큰을 인출했을 때 발생하는 이벤트
    event Withdrawn(address account, uint256 withdrawnToken, uint256 withdrawnValue, uint256 balanceToken);

    event RemovedPhoneInfo(bytes32 phone, address account);

    struct ManagementAddresses {
        address foundation;
        address settlement;
        address fee;
        address txFee;
    }

    struct ContractAddresses {
        address token;
        address phoneLink;
        address currencyRate;
        address provider;
        address consumer;
        address exchanger;
        address burner;
        address transfer;
        address bridge;
    }

    /// @notice 생성자
    function initialize(
        ManagementAddresses memory managements,
        ContractAddresses memory contracts
    ) external initializer {
        __UUPSUpgradeable_init();
        __Ownable_init_unchained();

        foundationAccount = managements.foundation;
        settlementAccount = managements.settlement;
        feeAccount = managements.fee;
        txFeeAccount = managements.txFee;

        providerAddress = contracts.provider;
        consumerAddress = contracts.consumer;
        exchangerAddress = contracts.exchanger;
        burnerAddress = contracts.burner;
        transferAddress = contracts.transfer;
        tokenAddress = contracts.token;
        bridgeAddress = contracts.bridge;

        tokenContract = IBIP20DelegatedTransfer(contracts.token);
        linkContract = IPhoneLinkCollection(contracts.phoneLink);
        currencyRateContract = ICurrencyRate(contracts.currencyRate);
        fee = MAX_FEE;
        BIP20DelegatedTransfer token = BIP20DelegatedTransfer(contracts.token);
        tokenId = BridgeLib.getTokenId(token.name(), token.symbol());

        temporaryAddress = address(0x0);
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

    modifier onlyExchanger() {
        require(_msgSender() == exchangerAddress, "1007");
        _;
    }

    modifier onlyAccessNonce() {
        require(
            _msgSender() == consumerAddress ||
                _msgSender() == exchangerAddress ||
                _msgSender() == transferAddress ||
                _msgSender() == bridgeAddress,
            "1007"
        );
        _;
    }

    modifier onlyAccessLedger() {
        require(
            _msgSender() == consumerAddress ||
                _msgSender() == exchangerAddress ||
                _msgSender() == transferAddress ||
                _msgSender() == bridgeAddress,
            "1007"
        );
        _;
    }

    modifier onlyAccessBurner() {
        require(_msgSender() == burnerAddress, "1007");
        _;
    }

    /// @notice 토큰을 예치합니다.
    /// @param _amount 금액
    function deposit(uint256 _amount) external virtual {
        require(_amount % 1 gwei == 0, "1030");
        require(_amount <= tokenContract.allowance(_msgSender(), address(this)), "1512");
        tokenContract.transferFrom(_msgSender(), address(this), _amount);

        tokenBalances[_msgSender()] += _amount;

        emit Deposited(
            _msgSender(),
            _amount,
            currencyRateContract.convertTokenToPoint(_amount),
            tokenBalances[_msgSender()]
        );
    }

    /// @notice 토큰을 인출합니다.
    /// @param _amount 금액
    function withdraw(uint256 _amount) external virtual {
        require(_msgSender() != foundationAccount, "1053");
        require(_amount % 1 gwei == 0, "1030");
        require(_amount <= tokenBalances[_msgSender()], "1511");
        tokenContract.transfer(_msgSender(), _amount);

        tokenBalances[_msgSender()] -= _amount;

        emit Withdrawn(
            _msgSender(),
            _amount,
            currencyRateContract.convertTokenToPoint(_amount),
            tokenBalances[_msgSender()]
        );
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
        string calldata _currency,
        string calldata _purchaseId,
        bytes32 _shopId,
        address _sender
    ) external override onlyProvider {
        _provideUnPayablePoint(_phone, _loyaltyPoint, _loyaltyValue, _currency, _purchaseId, _shopId, _sender);
    }

    function _provideUnPayablePoint(
        bytes32 _phone,
        uint256 _loyaltyPoint,
        uint256 _loyaltyValue,
        string calldata _currency,
        string calldata _purchaseId,
        bytes32 _shopId,
        address _sender
    ) internal {
        if (_sender == foundationAccount) {
            unPayablePointBalances[_phone] += _loyaltyPoint;
        } else {
            uint256 amountToken = currencyRateContract.convertPointToToken(_loyaltyPoint);
            require(tokenBalances[_sender] >= amountToken, "1511");

            unPayablePointBalances[_phone] += _loyaltyPoint;
            tokenBalances[_sender] -= amountToken;
        }
        uint256 balance = unPayablePointBalances[_phone];
        emit ProvidedUnPayablePoint(_phone, _loyaltyPoint, _loyaltyValue, _currency, balance, _purchaseId, _shopId);
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
        string calldata _currency,
        string calldata _purchaseId,
        bytes32 _shopId,
        address _sender
    ) external override onlyProvider {
        _providePoint(_account, _loyaltyPoint, _loyaltyValue, _currency, _purchaseId, _shopId, _sender);
    }

    function _providePoint(
        address _account,
        uint256 _loyaltyPoint,
        uint256 _loyaltyValue,
        string calldata _currency,
        string calldata _purchaseId,
        bytes32 _shopId,
        address _sender
    ) internal {
        if (_sender == foundationAccount) {
            pointBalances[_account] += _loyaltyPoint;
        } else {
            uint256 amountToken = currencyRateContract.convertPointToToken(_loyaltyPoint);
            require(tokenBalances[_sender] >= amountToken, "1511");

            pointBalances[_account] += _loyaltyPoint;
            tokenBalances[_sender] -= amountToken;
            tokenBalances[foundationAccount] += amountToken;
        }
        uint256 balance = pointBalances[_account];
        emit ProvidedPoint(_account, _loyaltyPoint, _loyaltyValue, _currency, balance, _purchaseId, _shopId);
    }

    /// @notice 포인트의 잔고에 더한다. Consumer 컨트랙트만 호출할 수 있다.
    function addPointBalance(address _account, uint256 _amount) external override onlyAccessLedger {
        pointBalances[_account] += _amount;
    }

    /// @notice 포인트의 잔고에서 뺀다. Consumer 컨트랙트만 호출할 수 있다.
    function subPointBalance(address _account, uint256 _amount) external override onlyAccessLedger {
        if (pointBalances[_account] >= _amount) pointBalances[_account] -= _amount;
    }

    /// @notice 토큰의 잔고에 더한다. Consumer 컨트랙트만 호출할 수 있다.
    function addTokenBalance(address _account, uint256 _amount) external override onlyAccessLedger {
        tokenBalances[_account] += _amount;
    }

    /// @notice 토큰의 잔고에서 뺀다. Consumer 컨트랙트만 호출할 수 있다.
    function subTokenBalance(address _account, uint256 _amount) external override onlyAccessLedger {
        if (tokenBalances[_account] >= _amount) tokenBalances[_account] -= _amount;
    }

    /// @notice 토큰을 전달한다. Consumer 컨트랙트만 호출할 수 있다.
    function transferToken(address _from, address _to, uint256 _amount) external override onlyAccessLedger {
        if (tokenBalances[_from] >= _amount) {
            tokenBalances[_from] -= _amount;
            tokenBalances[_to] += _amount;
        }
    }

    /// @notice 포인트의 잔고를 리턴한다
    /// @param _phone 전화번호의 해시
    function unPayablePointBalanceOf(bytes32 _phone) external view override returns (uint256) {
        return unPayablePointBalances[_phone];
    }

    /// @notice 포인트의 잔고를 리턴한다
    /// @param _account 지갑주소
    function pointBalanceOf(address _account) external view override returns (uint256) {
        return pointBalances[_account];
    }

    /// @notice 토큰의 잔고를 리턴한다
    /// @param _account 지갑주소
    function tokenBalanceOf(address _account) external view override returns (uint256) {
        return tokenBalances[_account];
    }

    /// @notice nonce를 리턴한다
    /// @param _account 지갑주소
    function nonceOf(address _account) external view override returns (uint256) {
        return nonce[_account];
    }

    /// @notice nonce를 증가한다
    /// @param _account 지갑주소
    function increaseNonce(address _account) external override onlyAccessNonce {
        nonce[_account]++;
    }

    /// @notice 사용자가 적립할 포인트의 종류를 리턴한다
    /// @param _account 지갑주소
    function loyaltyTypeOf(address _account) external view override returns (LoyaltyType) {
        return loyaltyTypes[_account];
    }

    /// @notice 포인트와 토큰의 사용수수료률을 설정합니다. 5%를 초과한 값은 설정할 수 없습니다.
    /// @param _fee % 단위 입니다.
    function setFee(uint32 _fee) external override {
        require(_fee <= MAX_FEE, "1521");
        require(_msgSender() == feeAccount, "1050");
        fee = _fee;
    }

    /// @notice 포인트와 토큰의 사용수수료률을 리턴합니다.
    function getFee() external view override returns (uint32) {
        return fee;
    }

    /// @notice 사용가능한 포인트로 전환합니다.
    function changeToPayablePoint(bytes32 _phone, address _account) external override onlyExchanger {
        uint256 amount = unPayablePointBalances[_phone];
        unPayablePointBalances[_phone] = 0;
        pointBalances[_account] += amount;
    }

    /// @notice 사용자가 적립할 로열티를 토큰으로 변경한다.
    function changeToLoyaltyToken(address _account) external override onlyExchanger {
        loyaltyTypes[_account] = LoyaltyType.TOKEN;
    }

    function getFoundationAccount() external view override returns (address) {
        return foundationAccount;
    }

    function getSettlementAccount() external view override returns (address) {
        return settlementAccount;
    }

    function getFeeAccount() external view override returns (address) {
        return feeAccount;
    }

    function getTxFeeAccount() external view override returns (address) {
        return txFeeAccount;
    }

    function getTokenAddress() external view override returns (address) {
        return tokenAddress;
    }

    function burnUnPayablePoint(bytes32 _phone, uint256 _amount) external override onlyAccessBurner {
        if (unPayablePointBalances[_phone] >= _amount) unPayablePointBalances[_phone] -= _amount;
    }

    function burnPoint(address _account, uint256 _amount) external override onlyAccessBurner {
        if (pointBalances[_account] >= _amount) pointBalances[_account] -= _amount;
    }

    function removePhoneInfo(address _account, bytes calldata _signature) external {
        bytes32 dataHash = keccak256(abi.encode(_account, block.chainid, nonce[_account]));
        require(ECDSA.recover(ECDSA.toEthSignedMessageHash(dataHash), _signature) == _account, "1501");

        nonce[_account]++;

        bytes32 phone = linkContract.toPhone(_account);
        if (phone != 0) {
            delete unPayablePointBalances[phone];
            emit RemovedPhoneInfo(phone, _account);
        }
    }

    /// @notice 브리지를 위한 유동성 자금을 예치합니다.
    function depositLiquidity(bytes32 _tokenId, uint256 _amount, bytes calldata _signature) external payable override {
        require(_tokenId == tokenId, "1713");
        require(tokenContract.balanceOf(_msgSender()) >= _amount, "1511");
        require(_amount % 1 gwei == 0, "1030");

        if (tokenContract.delegatedTransfer(_msgSender(), address(this), _amount, _signature)) {
            tokenBalances[bridgeAddress] += _amount;
            liquidity[_msgSender()] += _amount;
            emit DepositedLiquidity(_tokenId, _msgSender(), _amount, liquidity[_msgSender()]);
        }
    }

    /// @notice 브리지를 위한 유동성 자금을 인출합니다.
    function withdrawLiquidity(bytes32 _tokenId, uint256 _amount) external override {
        require(_tokenId == tokenId, "1713");
        require(liquidity[_msgSender()] >= _amount, "1514");
        require(tokenBalances[bridgeAddress] >= _amount, "1511");
        require(tokenContract.balanceOf(address(this)) >= _amount, "1511");
        require(_amount % 1 gwei == 0, "1030");

        tokenContract.transfer(_msgSender(), _amount);
        liquidity[_msgSender()] -= _amount;
        tokenBalances[bridgeAddress] -= _amount;
        emit WithdrawnLiquidity(_tokenId, _msgSender(), _amount, liquidity[_msgSender()]);
    }

    /// @notice 브리지를 위한 유동성 자금을 조회합니다.
    function getLiquidity(bytes32 _tokenId, address _account) external view override returns (uint256) {
        require(_tokenId != tokenId, "1713");
        return liquidity[_account];
    }
}
