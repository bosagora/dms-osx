// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "./ValidatorCollection.sol";

/// @notice 가맹점컬랙션
contract FranchiseeCollection {
    /// @notice 검증자의 상태코드
    enum FranchiseeStatus {
        INVALID,
        ACTIVE
    }

    /// @notice 가맹점의 데이터
    struct FranchiseeData {
        string franchiseeId; // 가맹점 아이디
        uint256 timestamp; // 제품구매 후 마일리지 지급시간
        bytes32 email; // 가맹점주 이메일 해시
        uint256 providedMileage; // 제공된 마일리지 총량
        uint256 usedMileage; // 사용된 마일리지 총량
        uint256 clearedMileage; // 정산된 마일리지 총량
        FranchiseeStatus status;
    }

    /// @notice 가맹점 아이디에 해당하는 가맹점데이터가 저장되는 맵
    mapping(string => FranchiseeData) public franchisees;

    /// @notice 가맹점 아이디가 저장된 배열
    string[] public items;

    address public validatorAddress;
    ValidatorCollection private validatorCollection;

    /// @notice 데아타가 추가될 때 발생되는 이벤트
    event Added(string franchiseeId, uint256 timestamp, bytes32 email);
    /// @notice 데아타가 추가될 때 발생되는 이벤트
    event IncreasedProvidedMileage(string franchiseeId, uint256 increase, uint256 total);
    /// @notice 데아타가 추가될 때 발생되는 이벤트
    event IncreasedUsedMileage(string franchiseeId, uint256 increase, uint256 total);
    /// @notice 정산된 마일리가 증가할 때 발생되는 이벤트
    event IncreasedClearedMileage(string franchiseeId, uint256 increase, uint256 total);

    /// @notice 생성자
    /// @param _validatorAddress 검증자컬랙션의 주소
    constructor(address _validatorAddress) {
        validatorAddress = _validatorAddress;

        validatorCollection = ValidatorCollection(_validatorAddress);
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

    /// @notice 가맹점을 추가한다
    /// @param _franchiseeId 가맹점 아이디
    /// @param _timestamp 제품구매 후 마일리지 지급시간
    /// @param _email 가맹점주 이메일 해시
    function add(string memory _franchiseeId, uint256 _timestamp, bytes32 _email) public onlyValidator(msg.sender) {
        FranchiseeData memory data = FranchiseeData({
            franchiseeId: _franchiseeId,
            timestamp: _timestamp,
            email: _email,
            providedMileage: 0,
            usedMileage: 0,
            clearedMileage: 0,
            status: FranchiseeStatus.ACTIVE
        });
        items.push(_franchiseeId);
        franchisees[_franchiseeId] = data;

        emit Added(_franchiseeId, _timestamp, _email);
    }

    /// @notice 가맹점의 갯수를 리턴한다
    function length() public view returns (uint256) {
        return items.length;
    }

    /// @notice 지급된 총 마일지리를 누적한다
    function addProvidedMileage(string memory _franchiseeId, uint _amount) public {
        // TODO Ledger 에서만 호출할 수 있도록 수정해야 함
        require(franchisees[_franchiseeId].status == FranchiseeStatus.ACTIVE, "Not existed franchisee");

        franchisees[_franchiseeId].providedMileage += _amount;

        emit IncreasedProvidedMileage(_franchiseeId, _amount, franchisees[_franchiseeId].providedMileage);
    }

    /// @notice 사용된 총 마일지리를 누적한다
    function addUsedMileage(string memory _franchiseeId, uint _amount) public {
        // TODO Ledger 에서만 호출할 수 있도록 수정해야 함
        require(franchisees[_franchiseeId].status == FranchiseeStatus.ACTIVE, "Not existed franchisee");

        franchisees[_franchiseeId].usedMileage += _amount;

        emit IncreasedUsedMileage(_franchiseeId, _amount, franchisees[_franchiseeId].usedMileage);
    }

    /// @notice 정산된 총 마일지리를 누적한다
    function addClearedMileage(string memory _franchiseeId, uint _amount) public {
        // TODO Ledger 에서만 호출할 수 있도록 수정해야 함
        require(franchisees[_franchiseeId].status == FranchiseeStatus.ACTIVE, "Not existed franchisee");

        franchisees[_franchiseeId].clearedMileage += _amount;

        emit IncreasedClearedMileage(_franchiseeId, _amount, franchisees[_franchiseeId].clearedMileage);
    }
}
