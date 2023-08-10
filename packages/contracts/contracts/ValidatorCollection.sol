// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/// @notice 검증자들을 저장하는 컨트랙트
contract ValidatorCollection {
    uint256 public constant MINIMUM_DEPOSIT_AMOUNT = 50000000000000000000000;

    address private tokenAddress;

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

    /// @notice 검증자 데이터가 저장되는 배열
    address[] public items;

    /// @notice 유효한 검증자 데이터가 저장되는 배열
    address[] public activeItems;

    mapping(address => ValidatorData) public validators;

    /// @notice 검증자가 추가될 때 발생되는 이벤트
    event Added(address validator, uint256 start, uint256 balance, Status status);
    /// @notice 자금이 입급될 때 발생되는 이벤트
    event Deposited(address validator, uint256 amount, uint256 balance);
    /// @notice 검증자의 등록이 요청 되었을 때 발생되는 이벤트
    event RequestedRegistration(address requester);
    /// @notice 검증자의 강제 탈퇴가 요청 되었을 때 발생되는 이벤트
    event RequestedExit(address requester, address validator);
    /// @notice 검증자의 자발적 탈퇴가 완료되었을 때 발생되는 이벤트
    event Exited(address validator);

    /// @notice 생성자
    /// @param _validators 초기에 설정될 검증자, 예치금이 예치된 후 그 즉시 활성화 된다.
    constructor(address _tokenAddress, address[] memory _validators) {
        tokenAddress = _tokenAddress;

        for (uint256 i = 0; i < _validators.length; ++i) {
            ValidatorData memory item = ValidatorData({
                validator: _validators[i],
                start: block.timestamp,
                balance: 0,
                status: Status.STOP
            });
            items.push(_validators[i]);
            validators[_validators[i]] = item;

            emit Added(item.validator, item.start, item.balance, item.status);
        }
    }

    /// @notice 예치금을 추가로 입급합니다.
    /// @param _amount 추가로 입금할 예치 금액
    function deposit(uint256 _amount) public {
        ValidatorData memory item = validators[msg.sender];
        require(item.validator == msg.sender, "Not validator");
        require(item.status != Status.INVALID, "Not validator");
        require(item.status != Status.EXIT, "Already exited");

        IERC20 token = IERC20(tokenAddress);
        require(_amount <= token.allowance(msg.sender, address(this)), "Not allowed deposit");
        token.transferFrom(msg.sender, address(this), _amount);

        validators[msg.sender].balance += _amount;

        if (validators[msg.sender].balance >= MINIMUM_DEPOSIT_AMOUNT) validators[msg.sender].status = Status.ACTIVE;

        emit Deposited(msg.sender, _amount, validators[msg.sender].balance);
    }

    /// @notice 신규 검증자 등록을 신청합니다.
    function requestRegistration() public {
        require(validators[msg.sender].status == Status.INVALID, "Already validator");

        IERC20 token = IERC20(tokenAddress);
        require(MINIMUM_DEPOSIT_AMOUNT <= token.allowance(msg.sender, address(this)), "Not allowed deposit");
        token.transferFrom(msg.sender, address(this), MINIMUM_DEPOSIT_AMOUNT);

        ValidatorData memory item = ValidatorData({
            validator: msg.sender,
            start: block.timestamp + 86500 * 7,
            balance: MINIMUM_DEPOSIT_AMOUNT,
            status: Status.ACTIVE
        });

        items.push(msg.sender);
        validators[msg.sender] = item;

        emit RequestedRegistration(msg.sender);
    }

    /// @notice 검증자의 강제탈퇴를 신청합니다.
    function requestExit(address validator) public {
        ValidatorData memory item = validators[msg.sender];
        require(item.validator == msg.sender, "Not validator");
        require(item.status == Status.ACTIVE && item.start <= block.timestamp, "Invalid validator");

        require(validators[validator].status != Status.INVALID, "Not validator");
        validators[validator].status = Status.EXIT;

        if (validators[validator].balance > 0) {
            IERC20 token = IERC20(tokenAddress);
            token.transfer(validator, validators[validator].balance);
            validators[validator].balance = 0;
        }

        emit RequestedExit(msg.sender, validator);
    }

    function makeActiveItems() public {
        ValidatorData memory item = validators[msg.sender];
        require(item.validator == msg.sender, "Not validator");
        require(item.status == Status.ACTIVE && item.start <= block.timestamp, "Invalid validator");

        _makeActiveItems();
    }

    /// @notice 유효한 검증자의 수를 리턴합니다.
    function getActiveItemsLength() public view returns (uint256 length) {
        return activeItems.length;
    }

    function _makeActiveItems() internal {
        while (activeItems.length > 0) activeItems.pop();
        for (uint256 i = 0; i < items.length; ++i) {
            ValidatorData memory item = validators[items[i]];

            if (item.status == Status.ACTIVE && item.start <= block.timestamp) {
                activeItems.push(items[i]);
            }
        }
    }

    /// @notice 자발적으로 탈퇴하기 위해 사용되는 함수입니다.
    function exit() public {
        ValidatorData memory item = validators[msg.sender];
        require(item.validator == msg.sender, "Not validator");
        require(item.status == Status.ACTIVE && item.start <= block.timestamp, "Invalid validator");

        makeActiveItems();
        require(activeItems.length > 1, "Last validator");

        validators[msg.sender].status = Status.EXIT;

        if (validators[msg.sender].balance > 0) {
            IERC20 token = IERC20(tokenAddress);
            token.transfer(msg.sender, validators[msg.sender].balance);
            validators[msg.sender].balance = 0;
        }

        emit Exited(msg.sender);
    }
}
