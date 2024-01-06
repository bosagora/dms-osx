// SPDX-License-Identifier: AGPL-3.0-or-later

pragma solidity ^0.8.2;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";

import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

import "del-osx-artifacts/contracts/interfaces/IPhoneLinkCollection.sol";

import "../interfaces/IValidator.sol";
import "../interfaces/ILedger.sol";
import "./LoyaltyBurnerStorage.sol";

import "../lib/DMS.sol";

contract LoyaltyBurner is LoyaltyBurnerStorage, Initializable, OwnableUpgradeable, UUPSUpgradeable {
    struct PointData {
        uint256 pointType;
        address account;
        bytes32 phone;
        uint256 amount;
    }

    event BurnedUnPayablePoint(bytes32 phone, uint256 amount);
    event BurnedPoint(address account, uint256 amount);

    function initialize(address _validatorAddress, address _linkAddress) external initializer {
        __UUPSUpgradeable_init();
        __Ownable_init_unchained();

        validatorContract = IValidator(_validatorAddress);
        linkContract = IPhoneLinkCollection(_linkAddress);
        isSetLedger = false;
    }

    /// @notice 원장 컨트랙트를 등록한다.
    function setLedger(address _contractAddress) public {
        require(_msgSender() == owner(), "1050");
        if (!isSetLedger) {
            ledgerContract = ILedger(_contractAddress);
            isSetLedger = true;
        }
    }

    function _authorizeUpgrade(address newImplementation) internal virtual override {
        require(_msgSender() == owner(), "Unauthorized access");
    }

    modifier onlyValidator(address _account) {
        require(validatorContract.isCurrentActiveValidator(_account), "1000");
        _;
    }

    /// @notice 구매내역을 저장합니다.
    /// @dev 이것은 검증자들에 의해 호출되어야 합니다.
    function burnPoint(
        uint256 _height,
        PointData[] calldata _data,
        bytes[] calldata _signatures
    ) external onlyValidator(_msgSender()) {
        // Check the number of voters and signatories
        uint256 numberOfVoters = validatorContract.lengthOfCurrentActiveValidator();
        require(numberOfVoters > 0, "1162");
        require(_signatures.length <= numberOfVoters, "1163");

        // Get a hash of all the data
        bytes32[] memory messages = new bytes32[](_data.length);
        for (uint256 i = 0; i < _data.length; i++) {
            messages[i] = keccak256(abi.encode(_data[i].account, _data[i].phone, _data[i].amount));
        }
        bytes32 dataHash = keccak256(abi.encode(_height, messages.length, messages));

        // Counting by signature
        address[] memory participants = new address[](_signatures.length);
        uint256 length = 0;
        for (uint256 idx = 0; idx < _signatures.length; idx++) {
            address participant = ECDSA.recover(ECDSA.toEthSignedMessageHash(dataHash), _signatures[idx]);
            bool exist = false;
            for (uint256 j = 0; j < length; j++) {
                if (participants[j] == participant) {
                    exist = true;
                    break;
                }
            }
            if (!exist && validatorContract.isCurrentActiveValidator(participant)) {
                participants[length] = participant;
                length++;
            }
        }

        require(((length * 1000) / numberOfVoters) >= DMS.QUORUM, "1164");

        for (uint256 i = 0; i < _data.length; i++) {
            PointData memory data = _data[i];
            if (data.amount == 0) continue;

            if (data.pointType == 0) {
                uint256 balance = ledgerContract.unPayablePointBalanceOf(data.phone);
                uint256 burnAmount;
                if (balance >= data.amount) {
                    burnAmount = data.amount;
                } else if (balance > 0) {
                    burnAmount = balance;
                } else {
                    burnAmount = 0;
                }
                if (burnAmount > 0) {
                    ledgerContract.burnUnPayablePoint(data.phone, burnAmount);
                    emit BurnedUnPayablePoint(data.phone, burnAmount);
                }
            } else if (data.pointType == 1) {
                uint256 balance = ledgerContract.pointBalanceOf(data.account);
                uint256 burnAmount;
                if (balance >= data.amount) {
                    burnAmount = data.amount;
                } else if (balance > 0) {
                    burnAmount = balance;
                } else {
                    burnAmount = 0;
                }
                if (burnAmount > 0) {
                    ledgerContract.burnPoint(data.account, burnAmount);
                    emit BurnedPoint(data.account, burnAmount);
                }
            }
        }
    }
}
