// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/// @notice 검증자들을 저장하는 컨트랙트
contract ValidatorCollection {
    uint256 public constant MINIMUM_DEPOSIT_AMOUNT = 20000000000000000000000;

    address public tokenAddress;

    IERC20 private token;

    /// @notice 검증자의 상태코드
    enum Status {
        INVALID, //  초기값
        ACTIVE, //  검증자의 기능이 활성화됨
        STOP, //  예치금 부족으로 정지된 상태
        EXIT //  탈퇴한 상태
    }

    struct ValidatorData {
        address validator; // 검증자의 지갑주소
        uint256 start; // 검증자로서 역할을 수행할 수 있는 시작 시간
        uint256 balance; // 검증자의 예치금
        Status status; // 검증자의 상태
    }

    address[] private items;

    address[] private activeItems;

    mapping(address => ValidatorData) private validators;

    /// @notice 검증자가 추가될 때 발생되는 이벤트
    event AddedValidator(address validator, uint256 start, uint256 balance, Status status);
    /// @notice 자금이 입급될 때 발생되는 이벤트
    event DepositedForValidator(address validator, uint256 amount, uint256 balance);
    /// @notice 검증자의 등록이 요청 되었을 때 발생되는 이벤트
    event RequestedToJoinValidator(address requester);
    /// @notice 검증자의 강제 탈퇴가 요청 되었을 때 발생되는 이벤트
    event RequestedToExitValidator(address requester, address validator);
    /// @notice 검증자의 자발적 탈퇴가 완료되었을 때 발생되는 이벤트
    event ExitedFromValidator(address validator);

    /// @notice 생성자
    /// @param _validators 초기에 설정될 검증자, 예치금이 예치된 후 그 즉시 활성화 된다.
    constructor(address _tokenAddress, address[] memory _validators) {
        tokenAddress = _tokenAddress;
        token = IERC20(_tokenAddress);

        for (uint256 i = 0; i < _validators.length; ++i) {
            ValidatorData memory item = ValidatorData({
                validator: _validators[i],
                start: block.timestamp,
                balance: 0,
                status: Status.STOP
            });
            items.push(_validators[i]);
            validators[_validators[i]] = item;

            emit AddedValidator(item.validator, item.start, item.balance, item.status);
        }
    }

    /// @notice 예치금을 추가로 입급합니다.
    /// @param _amount 추가로 입금할 예치 금액
    function deposit(uint256 _amount) public {
        ValidatorData memory item = validators[msg.sender];
        require(item.validator == msg.sender, "1000");
        require(item.status != Status.INVALID, "1001");
        require(item.status != Status.EXIT, "1003");

        require(_amount <= token.allowance(msg.sender, address(this)), "1020");
        token.transferFrom(msg.sender, address(this), _amount);

        validators[msg.sender].balance += _amount;

        if (validators[msg.sender].balance >= MINIMUM_DEPOSIT_AMOUNT) validators[msg.sender].status = Status.ACTIVE;

        emit DepositedForValidator(msg.sender, _amount, validators[msg.sender].balance);
    }

    /// @notice 신규 검증자 등록을 신청합니다.
    function requestRegistration() public {
        require(validators[msg.sender].status == Status.INVALID, "1003");

        require(MINIMUM_DEPOSIT_AMOUNT <= token.allowance(msg.sender, address(this)), "1020");
        token.transferFrom(msg.sender, address(this), MINIMUM_DEPOSIT_AMOUNT);

        ValidatorData memory item = ValidatorData({
            validator: msg.sender,
            start: block.timestamp + 86500 * 7,
            balance: MINIMUM_DEPOSIT_AMOUNT,
            status: Status.ACTIVE
        });

        items.push(msg.sender);
        validators[msg.sender] = item;

        emit RequestedToJoinValidator(msg.sender);
    }

    /// @notice 검증자의 강제탈퇴를 신청합니다.
    function requestExit(address validator) public {
        ValidatorData memory item = validators[msg.sender];
        require(item.validator == msg.sender, "1000");
        require(item.status == Status.ACTIVE && item.start <= block.timestamp, "1001");

        require(validators[validator].status != Status.INVALID, "1001");
        validators[validator].status = Status.EXIT;

        if (validators[validator].balance > 0) {
            token.transfer(validator, validators[validator].balance);
            validators[validator].balance = 0;
        }

        emit RequestedToExitValidator(msg.sender, validator);
    }

    /// @notice 등록된 검증자를 리턴한다.
    /// @param _idx 배열의 순번
    function itemOf(uint256 _idx) public view returns (address) {
        return items[_idx];
    }

    /// @notice 등록된 검증자의 수를 리턴합니다.
    function itemsLength() public view returns (uint256) {
        return items.length;
    }

    function isActiveValidator(address _account) public view returns (bool) {
        ValidatorData memory item = validators[_account];

        if (item.status == Status.ACTIVE && item.start <= block.timestamp) {
            return true;
        } else {
            return false;
        }
    }

    /// @notice 유효한 검증자의 수를 리턴합니다.
    function activeItemsLength() public view returns (uint256) {
        uint256 value = 0;
        for (uint256 i = 0; i < items.length; ++i) {
            ValidatorData memory item = validators[items[i]];
            if (item.status == Status.ACTIVE && item.start <= block.timestamp) {
                value++;
            }
        }
        return value;
    }

    /// @notice 검증자의 데이타를 리턴합니다.
    /// @param _account 지갑주소
    function validatorOf(address _account) public view returns (ValidatorData memory) {
        return validators[_account];
    }

    /// @notice 자발적으로 탈퇴하기 위해 사용되는 함수입니다.
    function exit() public {
        ValidatorData memory item = validators[msg.sender];
        require(item.validator == msg.sender, "1000");
        require(item.status == Status.ACTIVE && item.start <= block.timestamp, "1001");

        require(activeItemsLength() > 1, "1010");

        validators[msg.sender].status = Status.EXIT;

        if (validators[msg.sender].balance > 0) {
            token.transfer(msg.sender, validators[msg.sender].balance);
            validators[msg.sender].balance = 0;
        }

        emit ExitedFromValidator(msg.sender);
    }
}
