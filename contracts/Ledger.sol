// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "link-email-wallet/contracts/LinkCollection.sol";
import "./ValidatorCollection.sol";

/// @notice 마일리지와 토큰의 원장
contract Ledger {
    /// @notice 마일리지의 원장
    mapping(bytes32 => uint256) public mileageLedger;
    /// @notice 토큰의 원장
    mapping(bytes32 => uint256) public tokenLedger;
    /// @notice 서명검증에 사용될 Nonce
    mapping(address => uint256) public nonce;

    struct PurchaseData {
        string purchaseId;
        uint256 timestamp;
        uint256 amount;
        bytes32 userEmail;
        string franchiseeId;
    }

    mapping(string => PurchaseData) public purchaseMap;
    string[] public purchaseIdList;

    address public tokenAddress;
    address public validatorAddress;
    address public linkCollectionAddress;

    IERC20 private token;
    ValidatorCollection private validatorCollection;
    LinkCollection private linkCollection;

    /// @notice 검증자가 추가될 때 발생되는 이벤트
    event SavedPurchase(string purchaseId, uint256 timestamp, uint256 amount, bytes32 userEmail, string franchiseeId);
    /// @notice 마일리지가 지급될 때 발생되는 이벤트
    event ProvidedMileage(bytes32 email, uint256 amount);
    /// @notice 토큰이 지급될 때 발생되는 이벤트
    event ProvidedToken(bytes32 email, uint256 amount, uint256 amountToken);
    /// @notice 마일리지로 지불을 완료했을 때 발생하는 이벤트
    event PaidMileage(string purchaseId, uint256 timestamp, uint256 amount, bytes32 userEmail, string franchiseeId);
    /// @notice 토큰으로 지불을 완료했을 때 발생하는 이벤트
    event PaidToken(
        string purchaseId,
        uint256 timestamp,
        uint256 amount,
        uint256 amountToken,
        bytes32 userEmail,
        string franchiseeId
    );

    /// @notice 생성자
    /// @param _tokenAddress 토큰의 주소
    /// @param _validatorAddress 검증자컬랙션의 주소
    constructor(address _tokenAddress, address _validatorAddress, address _linkCollectionAddress) {
        tokenAddress = _tokenAddress;
        validatorAddress = _validatorAddress;
        linkCollectionAddress = _linkCollectionAddress;

        token = IERC20(_tokenAddress);
        validatorCollection = ValidatorCollection(_validatorAddress);
        linkCollection = LinkCollection(_linkCollectionAddress);
    }

    modifier onlyValidator(address _account) {
        bool isValidator = false;
        for (uint256 i = 0; i < validatorCollection.getActiveItemsLength(); ++i) {
            if (_account == validatorCollection.activeItems(i)) {
                isValidator = true;
                break;
            }
        }
        require(isValidator, "Not validator");
        _;
    }

    /// @notice 구매내역을 저장합니다.
    /// @dev 이것은 검증자들에 의해 호출되어야 합니다.
    /// @param _purchaseId 구매 아이디
    /// @param _timestamp 구매 시간
    /// @param _amount 구매 금액
    /// @param _userEmail 구매한 사용자의 이메일 해시
    /// @param _franchiseeId 구매한 가맹점 아이디
    function savePurchase(
        string memory _purchaseId,
        uint256 _timestamp,
        uint256 _amount,
        bytes32 _userEmail,
        string memory _franchiseeId
    ) public onlyValidator(msg.sender) {
        PurchaseData memory data = PurchaseData({
            purchaseId: _purchaseId,
            timestamp: _timestamp,
            amount: _amount,
            userEmail: _userEmail,
            franchiseeId: _franchiseeId
        });
        purchaseIdList.push(_purchaseId);
        purchaseMap[_purchaseId] = data;

        if (linkCollection.toAddress(_userEmail) == address(0x00)) {
            uint256 mileage = _amount / 100;
            provideMileage(_userEmail, mileage);
        } else {
            uint256 amount = _amount / 100;
            provideToken(_userEmail, amount);
        }

        emit SavedPurchase(_purchaseId, _timestamp, _amount, _userEmail, _franchiseeId);
    }

    /// @notice 마일리지를 지급합니다.
    /// @dev 구매데아타를 확인한 후 호출됩니다.
    /// @param _email 이메일 해시
    /// @param _amount 지급할 마일리지
    function provideMileage(bytes32 _email, uint256 _amount) internal {
        mileageLedger[_email] += _amount;

        emit ProvidedMileage(_email, _amount);
    }

    /// @notice 토큰을 지급합니다.
    /// @dev 구매데아타를 확인한 후 호출됩니다.
    /// @param _email 이메일 해시
    /// @param _amount 지급할 토큰
    function provideToken(bytes32 _email, uint256 _amount) internal {
        // TODO 예치기능이 완료시 재단의 잔고를 빼주는 기능 추가
        // TODO 토큰가격에 의해 지급량을 결정하도록 수정
        uint256 amountToken = _amount;
        tokenLedger[_email] += amountToken;

        emit ProvidedToken(_email, _amount, amountToken);
    }

    /// @notice 마일리지를 구매에 사용하는 함수
    /// @param _purchaseId 구매 아이디
    /// @param _amount 구매 금액
    /// @param _userEmail 구매한 사용자의 이메일 해시
    /// @param _franchiseeId 구매한 가맹점 아이디
    /// @param _signer 구매자의 주소
    /// @param _signature 서명
    function payMileage(
        string memory _purchaseId,
        uint256 _amount,
        bytes32 _userEmail,
        string memory _franchiseeId,
        address _signer,
        bytes calldata _signature
    ) public {
        bytes32 dataHash = keccak256(
            abi.encode(_purchaseId, _amount, _userEmail, _franchiseeId, _signer, nonce[_signer])
        );
        require(ECDSA.recover(dataHash, _signature) == _signer, "Invalid signature");
        address userAddress = linkCollection.toAddress(_userEmail);
        require(userAddress != address(0x00), "Unregistered email-address");
        require(userAddress == _signer, "Invalid address");
        require(mileageLedger[_userEmail] >= _amount, "Insufficient balance");

        mileageLedger[_userEmail] -= _amount;

        nonce[_signer]++;

        emit PaidMileage(_purchaseId, block.timestamp, _amount, _userEmail, _franchiseeId);
    }

    /// @notice 토큰을 구매에 사용하는 함수
    /// @param _purchaseId 구매 아이디
    /// @param _amount 구매 금액
    /// @param _userEmail 구매한 사용자의 이메일 해시
    /// @param _franchiseeId 구매한 가맹점 아이디
    /// @param _signer 구매자의 주소
    /// @param _signature 서명
    function payToken(
        string memory _purchaseId,
        uint256 _amount,
        bytes32 _userEmail,
        string memory _franchiseeId,
        address _signer,
        bytes calldata _signature
    ) public {
        bytes32 dataHash = keccak256(
            abi.encode(_purchaseId, _amount, _userEmail, _franchiseeId, _signer, nonce[_signer])
        );
        require(ECDSA.recover(dataHash, _signature) == _signer, "Invalid signature");
        address userAddress = linkCollection.toAddress(_userEmail);
        require(userAddress != address(0x00), "Unregistered email-address");
        require(userAddress == _signer, "Invalid address");

        // TODO 예치기능이 완료시 재단의 잔고를 더해 주는 기능 추가
        // TODO 토큰가격에 의해 사용량을 결정하도록 수정
        uint256 amountToken = _amount;
        require(tokenLedger[_userEmail] >= amountToken, "Insufficient balance");

        tokenLedger[_userEmail] -= amountToken;

        nonce[_signer]++;

        emit PaidToken(_purchaseId, block.timestamp, _amount, amountToken, _userEmail, _franchiseeId);
    }
}
