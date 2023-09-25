// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "./ValidatorCollection.sol";

/// @notice 가맹점컬랙션
contract FranchiseeCollection {
    /// @notice Hash value of a blank string
    bytes32 public constant NULL = 0xe3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855;

    /// @notice 검증자의 상태코드
    enum FranchiseeStatus {
        INVALID,
        ACTIVE
    }

    /// @notice 가맹점의 데이터
    struct FranchiseeData {
        string franchiseeId; // 가맹점 아이디
        uint256 provideWaitTime; // 제품구매 후 포인트 지급시간
        bytes32 email; // 가맹점주 이메일 해시
        uint256 providedPoint; // 제공된 포인트 총량
        uint256 usedPoint; // 사용된 포인트 총량
        uint256 clearedPoint; // 정산된 포인트 총량
        FranchiseeStatus status;
    }

    mapping(string => FranchiseeData) private franchisees;

    string[] private items;

    address public validatorAddress;
    ValidatorCollection private validatorCollection;

    /// @notice 가맹점이 추가될 때 발생되는 이벤트
    event AddedFranchisee(string franchiseeId, uint256 provideWaitTime, bytes32 email);
    /// @notice 가맹점의 포인트가 증가할 때 발생되는 이벤트
    event IncreasedProvidedPoint(string franchiseeId, uint256 increase, uint256 total, string purchaseId);
    /// @notice 사용자의 포인트가 증가할 때 발생되는 이벤트
    event IncreasedUsedPoint(string franchiseeId, uint256 increase, uint256 total, string purchaseId);
    /// @notice 정산된 마일리가 증가할 때 발생되는 이벤트
    event IncreasedClearedPoint(string franchiseeId, uint256 increase, uint256 total, string purchaseId);

    address public ledgerAddress;
    address public deployer;

    /// @notice 생성자
    /// @param _validatorAddress 검증자컬랙션의 주소
    constructor(address _validatorAddress) {
        validatorAddress = _validatorAddress;

        validatorCollection = ValidatorCollection(_validatorAddress);
        ledgerAddress = address(0x00);
        deployer = msg.sender;
    }

    /// @notice 원장 컨트랙트의 주소를 호출한다.
    function setLedgerAddress(address _ledgerAddress) public {
        require(msg.sender == deployer, "No permissions");
        ledgerAddress = _ledgerAddress;
        deployer = address(0x00);
    }

    /// @notice 검증자들만 호출할 수 있도록 해준다.
    modifier onlyValidator(address _account) {
        bool isValidator = false;
        for (uint256 i = 0; i < validatorCollection.activeItemsLength(); ++i) {
            if (_account == validatorCollection.activeItemOf(i)) {
                isValidator = true;
                break;
            }
        }
        require(isValidator, "Not validator");
        _;
    }

    /// @notice 원장 컨트랙트에서만 호출될 수 있도록 해준다.
    modifier onlyLedger() {
        require(msg.sender == ledgerAddress, "Not ledger");
        _;
    }

    /// @notice 가맹점을 추가한다
    /// @param _franchiseeId 가맹점 아이디
    /// @param _payoutWaitTime 제품구매 후 포인트가 지급될 시간
    /// @param _email 가맹점주 이메일 해시
    function add(
        string memory _franchiseeId,
        uint256 _payoutWaitTime,
        bytes32 _email
    ) public onlyValidator(msg.sender) {
        _add(_franchiseeId, _payoutWaitTime, _email);
    }

    function _add(string memory _franchiseeId, uint256 _payoutWaitTime, bytes32 _email) internal {
        FranchiseeData memory data = FranchiseeData({
            franchiseeId: _franchiseeId,
            provideWaitTime: _payoutWaitTime,
            email: _email,
            providedPoint: 0,
            usedPoint: 0,
            clearedPoint: 0,
            status: FranchiseeStatus.ACTIVE
        });
        items.push(_franchiseeId);
        franchisees[_franchiseeId] = data;

        emit AddedFranchisee(_franchiseeId, _payoutWaitTime, _email);
    }

    /// @notice 지급된 총 마일지리를 누적한다
    function addProvidedPoint(
        string memory _franchiseeId,
        uint256 _amount,
        string memory _purchaseId
    ) public onlyLedger {
        if (franchisees[_franchiseeId].status == FranchiseeStatus.INVALID) {
            _add(_franchiseeId, 0, NULL);
        }

        franchisees[_franchiseeId].providedPoint += _amount;
        emit IncreasedProvidedPoint(_franchiseeId, _amount, franchisees[_franchiseeId].providedPoint, _purchaseId);
    }

    /// @notice 사용된 총 마일지리를 누적한다
    function addUsedPoint(string memory _franchiseeId, uint256 _amount, string memory _purchaseId) public onlyLedger {
        if (franchisees[_franchiseeId].status == FranchiseeStatus.INVALID) {
            _add(_franchiseeId, 0, NULL);
        }
        franchisees[_franchiseeId].usedPoint += _amount;
        emit IncreasedUsedPoint(_franchiseeId, _amount, franchisees[_franchiseeId].usedPoint, _purchaseId);
    }

    /// @notice 정산된 총 마일지리를 누적한다
    function addClearedPoint(
        string memory _franchiseeId,
        uint256 _amount,
        string memory _purchaseId
    ) public onlyLedger {
        if (franchisees[_franchiseeId].status == FranchiseeStatus.INVALID) {
            _add(_franchiseeId, 0, NULL);
        }
        franchisees[_franchiseeId].clearedPoint += _amount;
        emit IncreasedClearedPoint(_franchiseeId, _amount, franchisees[_franchiseeId].clearedPoint, _purchaseId);
    }

    /// @notice 정산되어야 할 마일지리의 량을 리턴합니다.
    function getClearPoint(string memory _franchiseeId) public view returns (uint256) {
        if (franchisees[_franchiseeId].status == FranchiseeStatus.ACTIVE) {
            FranchiseeData memory data = franchisees[_franchiseeId];
            if (data.providedPoint + data.clearedPoint < data.usedPoint) {
                return (data.usedPoint - data.providedPoint - data.clearedPoint);
            } else {
                return 0;
            }
        } else {
            return 0;
        }
    }

    /// @notice 가맹점 데이터를 리턴한다
    /// @param _franchiseeId 가맹점의 아이디
    function franchiseeOf(string memory _franchiseeId) public view returns (FranchiseeData memory) {
        return franchisees[_franchiseeId];
    }

    /// @notice 가맹점의 아이디를 리턴한다
    /// @param _idx 배열의 순번
    function franchiseeIdOf(uint256 _idx) public view returns (string memory) {
        return items[_idx];
    }

    /// @notice 가맹점의 갯수를 리턴한다
    function franchiseesLength() public view returns (uint256) {
        return items.length;
    }
}
