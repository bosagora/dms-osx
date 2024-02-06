// SPDX-License-Identifier: AGPL-3.0-or-later

pragma solidity ^0.8.2;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";

import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

import "../interfaces/ICurrencyRate.sol";
import "./CurrencyStorage.sol";

import "../lib/DMS.sol";

/// @notice 토큰 가격을 제공하는 스마트컨트랙트
contract CurrencyRate is CurrencyStorage, Initializable, OwnableUpgradeable, UUPSUpgradeable, ICurrencyRate {
    /// @notice 환률이 저장될 때 발생되는 이벤트
    event SetRate(string currency, uint256 rate);

    /// @notice 생성자
    /// @param _validator 검증자컨트랙트의 주소
    /// @param _tokenSymbol 토큰의 심벌
    function initialize(address _validator, string memory _tokenSymbol) external initializer {
        __UUPSUpgradeable_init();
        __Ownable_init_unchained();

        validator = IValidator(_validator);
        tokenSymbol = _tokenSymbol;

        rates["krw"] = MULTIPLE;
        rates["point"] = MULTIPLE;

        prevHeight = 0;
    }

    function _authorizeUpgrade(address newImplementation) internal virtual override {
        require(_msgSender() == owner(), "Unauthorized access");
    }

    modifier onlyValidator(address _account) {
        require(validator.isCurrentActiveValidator(_account), "1000");
        _;
    }

    /// @notice 통화에 대한 가격을 저장한다.
    function set(
        uint256 _height,
        CurrencyData[] calldata _data,
        bytes[] calldata _signatures
    ) external override onlyValidator(_msgSender()) {
        require(_height >= prevHeight, "1171");

        // Check the number of voters and signatories
        uint256 numberOfVoters = validator.lengthOfCurrentActiveValidator();
        require(numberOfVoters > 0, "1172");
        require(_signatures.length <= numberOfVoters, "1173");

        // Get a hash of all the data
        bytes32[] memory messages = new bytes32[](_data.length);
        for (uint256 i = 0; i < _data.length; i++) {
            messages[i] = keccak256(abi.encode(_data[i].symbol, _data[i].rate));
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
            if (!exist && validator.isCurrentActiveValidator(participant)) {
                participants[length] = participant;
                length++;
            }
        }

        require(((length * 1000) / numberOfVoters) >= DMS.QUORUM, "1174");

        prevHeight = _height;

        for (uint256 idx = 0; idx < _data.length; idx++) {
            rates[_data[idx].symbol] = _data[idx].rate;
            emit SetRate(_data[idx].symbol, _data[idx].rate);
        }
        rates["krw"] = MULTIPLE;
        rates["KRW"] = MULTIPLE;
        rates["point"] = MULTIPLE;
        rates["POINT"] = MULTIPLE;
    }

    /// @notice 통화에 대한 가격을 제공한다.
    /// @param _symbol 통화명
    function get(string calldata _symbol) external view override returns (uint256) {
        return _get(_symbol);
    }

    /// @notice 통화에 대한 가격을 제공한다.
    /// @param _symbol 통화명
    function _get(string memory _symbol) internal view returns (uint256) {
        uint256 p = rates[_symbol];
        require(p != 0, "1211");
        return p;
    }

    /// @notice 통화심벌을 제공하는지 검사한다.
    /// @param _symbol 통화명
    function support(string memory _symbol) external view override returns (bool) {
        return rates[_symbol] != 0;
    }

    /// @notice 포인트를 토큰으로 환산한다.
    /// @param _amount 포인트량
    function convertPointToToken(uint256 _amount) external view override returns (uint256) {
        return DMS.zeroGWEI((_amount * MULTIPLE) / _get(tokenSymbol));
    }

    /// @notice 토큰을 포인트로 환산한다.
    /// @param _amount 토큰량
    function convertTokenToPoint(uint256 _amount) external view override returns (uint256) {
        return DMS.zeroGWEI((_amount * _get(tokenSymbol)) / MULTIPLE);
    }

    /// @notice 화폐를 포인트로 환산한다.
    /// @param _amount 화폐량
    /// @param _symbol 통화명
    function convertCurrencyToPoint(uint256 _amount, string calldata _symbol) external view override returns (uint256) {
        bytes32 byteCurrency = keccak256(abi.encodePacked(_symbol));
        if ((byteCurrency == BASE_CURRENCY) || (byteCurrency == NULL_CURRENCY)) {
            return _amount;
        } else {
            return DMS.zeroGWEI((_amount * _get(_symbol)) / MULTIPLE);
        }
    }

    /// @notice 화폐를 토큰으로 환산한다.
    /// @param _amount 화폐량
    /// @param _symbol 토큰심벌
    function convertCurrencyToToken(uint256 _amount, string calldata _symbol) external view override returns (uint256) {
        return _convertCurrency(_amount, _symbol, tokenSymbol);
    }

    /// @notice 화폐들을 환산한다.
    /// @param _amount 화폐량
    /// @param _symbol1 변경전의 화폐심벌
    /// @param _symbol2 변경후의 화폐심벌
    function convertCurrency(
        uint256 _amount,
        string calldata _symbol1,
        string calldata _symbol2
    ) external view override returns (uint256) {
        return _convertCurrency(_amount, _symbol1, _symbol2);
    }

    function _convertCurrency(
        uint256 _amount,
        string memory _symbol1,
        string memory _symbol2
    ) internal view returns (uint256) {
        bytes32 bSymbol1 = keccak256(abi.encodePacked(_symbol1));
        bytes32 bSymbol2 = keccak256(abi.encodePacked(_symbol2));
        if (bSymbol1 == bSymbol2) return _amount;
        uint256 rate1 = ((bSymbol1 == BASE_CURRENCY) || (bSymbol1 == NULL_CURRENCY)) ? MULTIPLE : _get(_symbol1);
        uint256 rate2 = ((bSymbol2 == BASE_CURRENCY) || (bSymbol2 == NULL_CURRENCY)) ? MULTIPLE : _get(_symbol2);
        return DMS.zeroGWEI((_amount * rate1) / rate2);
    }

    /// @notice 환률은 실수이기 때문에 이를 정수로 관리하기 위해 배수를 곱한 값을 사용한다
    function multiple() external view override returns (uint256) {
        return MULTIPLE;
    }
}
