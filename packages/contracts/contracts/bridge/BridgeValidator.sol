// SPDX-License-Identifier: AGPL-3.0-or-later

pragma solidity ^0.8.2;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";

import "./BridgeValidatorStorage.sol";
import "../interfaces/IBridgeValidator.sol";

contract BridgeValidator is
    BridgeValidatorStorage,
    Initializable,
    OwnableUpgradeable,
    UUPSUpgradeable,
    IBridgeValidator
{
    function initialize(address[] memory _validators, uint256 _required) external initializer {
        __UUPSUpgradeable_init();
        __Ownable_init_unchained();

        require(_validators.length >= 3 && _required <= _validators.length && _required > 0, "1703");
        for (uint256 idx; idx < _validators.length; idx++) {
            items.push(_validators[idx]);
            validators[_validators[idx]] = true;
        }

        required = _required;
    }

    function _authorizeUpgrade(address newImplementation) internal virtual override {
        require(_msgSender() == owner(), "Unauthorized access");
    }

    function isValidator(address _account) external view override returns (bool) {
        return validators[_account];
    }

    function getLength() external view override returns (uint256) {
        return items.length;
    }

    function getRequired() external view override returns (uint256) {
        return required;
    }

    function itemOf(uint256 _idx) external view override returns (address) {
        return items[_idx];
    }

    function addValidator(address _validator) public {
        require(_msgSender() == owner(), "1050");
        require(!validators[_validator]);
        require(_validator != address(0));

        validators[_validator] = true;
        items.push(_validator);
    }

    function removeValidator(address _validator) public {
        require(_msgSender() == owner(), "1050");
        require(validators[_validator]);
        validators[_validator] = false;
        for (uint256 i = 0; i < items.length - 1; i++)
            if (items[i] == _validator) {
                items[i] = items[items.length - 1];
                break;
            }
        items.pop();
    }

    function changeValidator(address[] calldata additionalValidators, address[] calldata removalValidators) public {
        require(_msgSender() == owner(), "1050");
        for (uint256 i = 0; i < additionalValidators.length; i++) {
            addValidator(additionalValidators[i]);
        }
        for (uint256 i = 0; i < removalValidators.length; i++) {
            removeValidator(removalValidators[i]);
        }
    }

    function changeRequire(uint256 _required) public {
        require(_msgSender() == owner(), "1050");
        require(_required <= items.length && _required > 0, "1703");
        required = _required;
    }
}
