// SPDX-License-Identifier: AGPL-3.0-or-later

pragma solidity ^0.8.2;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "./ValidatorStorage.sol";
import "../interfaces/IValidator.sol";

/// @notice 검증자들을 저장하는 컨트랙트
contract Validator is ValidatorStorage, Initializable, OwnableUpgradeable, UUPSUpgradeable, IValidator {
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
    /// @param _tokenAddress 토큰컽트랙트의 주소
    /// @param _validators 검증자들
    function initialize(address _tokenAddress, address[] memory _validators) external initializer {
        __UUPSUpgradeable_init();
        __Ownable_init_unchained();

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

    function _authorizeUpgrade(address newImplementation) internal virtual override {
        require(_msgSender() == owner(), "Unauthorized access");
    }

    /// @notice 예치금을 추가로 입급합니다.
    /// @param _amount 추가로 입금할 예치 금액
    function deposit(uint256 _amount) external virtual {
        ValidatorData memory item = validators[_msgSender()];
        require(item.validator == _msgSender(), "1000");
        require(item.status != Status.INVALID, "1001");
        require(item.status != Status.EXIT, "1003");

        require(_amount <= token.allowance(_msgSender(), address(this)), "1020");
        token.transferFrom(_msgSender(), address(this), _amount);

        validators[_msgSender()].balance += _amount;

        if (validators[_msgSender()].balance >= MINIMUM_DEPOSIT_AMOUNT) validators[_msgSender()].status = Status.ACTIVE;

        emit DepositedForValidator(_msgSender(), _amount, validators[_msgSender()].balance);
    }

    /// @notice 신규 검증자 등록을 신청합니다.
    function requestRegistration() external virtual {
        require(validators[_msgSender()].status == Status.INVALID, "1003");

        require(MINIMUM_DEPOSIT_AMOUNT <= token.allowance(_msgSender(), address(this)), "1020");
        token.transferFrom(_msgSender(), address(this), MINIMUM_DEPOSIT_AMOUNT);

        ValidatorData memory item = ValidatorData({
            validator: _msgSender(),
            start: block.timestamp + 86500 * 7,
            balance: MINIMUM_DEPOSIT_AMOUNT,
            status: Status.ACTIVE
        });

        items.push(_msgSender());
        validators[_msgSender()] = item;

        emit RequestedToJoinValidator(_msgSender());
    }

    /// @notice 검증자의 강제탈퇴를 신청합니다.
    function requestExit(address validator) external virtual {
        ValidatorData memory item = validators[_msgSender()];
        require(item.validator == _msgSender(), "1000");
        require(item.status == Status.ACTIVE && item.start <= block.timestamp, "1001");

        require(validators[validator].status != Status.INVALID, "1001");
        validators[validator].status = Status.EXIT;

        if (validators[validator].balance > 0) {
            token.transfer(validator, validators[validator].balance);
            validators[validator].balance = 0;
        }

        emit RequestedToExitValidator(_msgSender(), validator);
    }

    /// @notice 등록된 검증자를 리턴한다.
    /// @param _idx 배열의 순번
    function itemOf(uint256 _idx) external view override returns (address) {
        return items[_idx];
    }

    /// @notice 등록된 검증자의 수를 리턴합니다.
    function itemsLength() external view override returns (uint256) {
        return items.length;
    }

    function isActiveValidator(address _account) external view override returns (bool) {
        ValidatorData memory item = validators[_account];

        if (item.status == Status.ACTIVE && item.start <= block.timestamp) {
            return true;
        } else {
            return false;
        }
    }

    /// @notice 유효한 검증자의 수를 리턴합니다.
    function activeItemsLength() external view override returns (uint256) {
        return _activeItemsLength();
    }

    /// @notice 유효한 검증자의 수를 리턴합니다.
    function _activeItemsLength() internal view virtual returns (uint256) {
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
    function validatorOf(address _account) external view override returns (ValidatorData memory) {
        return validators[_account];
    }

    /// @notice 자발적으로 탈퇴하기 위해 사용되는 함수입니다.
    function exit() external virtual {
        ValidatorData memory item = validators[_msgSender()];
        require(item.validator == _msgSender(), "1000");
        require(item.status == Status.ACTIVE && item.start <= block.timestamp, "1001");

        require(_activeItemsLength() > 1, "1010");

        validators[_msgSender()].status = Status.EXIT;

        if (validators[_msgSender()].balance > 0) {
            token.transfer(_msgSender(), validators[_msgSender()].balance);
            validators[_msgSender()].balance = 0;
        }

        emit ExitedFromValidator(_msgSender());
    }
}
