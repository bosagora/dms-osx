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
    function lengthOfActiveValidator() external view override returns (uint256) {
        return _lengthOfActiveValidator();
    }

    /// @notice 유효한 검증자의 수를 리턴합니다.
    function _lengthOfActiveValidator() internal view virtual returns (uint256) {
        uint256 value = 0;
        for (uint256 i = 0; i < items.length; ++i) {
            ValidatorData memory item = validators[items[i]];
            if (item.status == Status.ACTIVE && item.start <= block.timestamp) {
                value++;
            }
        }
        return value;
    }

    function isCurrentActiveValidator(address _account) external view override returns (bool) {
        ValidatorData memory item = validators[_account];

        if (item.status == Status.ACTIVE && item.start <= block.timestamp) {
            return true;
        } else {
            return false;
        }
    }

    function lengthOfCurrentActiveValidator() external view override returns (uint256) {
        return _lengthOfActiveValidator();
    }

    /// @notice 검증자의 데이타를 리턴합니다.
    /// @param _account 지갑주소
    function validatorOf(address _account) external view override returns (ValidatorData memory) {
        return validators[_account];
    }
}
