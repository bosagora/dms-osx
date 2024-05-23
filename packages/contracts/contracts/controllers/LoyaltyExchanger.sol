// SPDX-License-Identifier: AGPL-3.0-or-later

pragma solidity ^0.8.2;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";

import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

import "../interfaces/IPhoneLinkCollection.sol";

import "../interfaces/ICurrencyRate.sol";
import "../interfaces/ILedger.sol";
import "./LoyaltyExchangerStorage.sol";

contract LoyaltyExchanger is LoyaltyExchangerStorage, Initializable, OwnableUpgradeable, UUPSUpgradeable {
    /// @notice 사용가능한 포인트로 변환될 때 발생되는 이벤트
    event ChangedToPayablePoint(
        bytes32 phone,
        address account,
        uint256 changedPoint,
        uint256 changedValue,
        uint256 balancePoint
    );

    /// @notice 구매 후 적립되는 로열티를 토큰으로 변경했을 때 발생하는 이벤트
    event ChangedPointToToken(
        address account,
        uint256 amountPoint,
        uint256 amountToken,
        uint256 balancePoint,
        uint256 balanceToken
    );

    function initialize(address _linkAddress, address _currencyRateAddress) external initializer {
        __UUPSUpgradeable_init();
        __Ownable_init_unchained();

        linkContract = IPhoneLinkCollection(_linkAddress);
        currencyRateContract = ICurrencyRate(_currencyRateAddress);
        isSetLedger = false;
    }

    /// @notice 원장 컨트랙트를 등록한다.
    function setLedger(address _contractAddress) public {
        require(_msgSender() == owner(), "1050");
        if (!isSetLedger) {
            ledgerContract = ILedger(_contractAddress);
            foundationAccount = ledgerContract.getFoundationAccount();
            isSetLedger = true;
        }
    }

    function _authorizeUpgrade(address newImplementation) internal virtual override {
        require(_msgSender() == owner(), "Unauthorized access");
    }

    /// @notice 사용가능한 포인트로 전환합니다.
    /// @dev 중계서버를 통해서 호출됩니다.
    function changeToPayablePoint(bytes32 _phone, address _account, bytes calldata _signature) external virtual {
        bytes32 dataHash = keccak256(abi.encode(_phone, _account, block.chainid, ledgerContract.nonceOf(_account)));
        require(ECDSA.recover(ECDSA.toEthSignedMessageHash(dataHash), _signature) == _account, "1501");

        address userAddress = linkContract.toAddress(_phone);
        require(userAddress != address(0x00), "1502");
        require(userAddress == _account, "1503");
        require(ledgerContract.unPayablePointBalanceOf(_phone) > 0, "1511");

        uint256 amount = ledgerContract.unPayablePointBalanceOf(_phone);
        if (amount > 0) {
            ledgerContract.changeToPayablePoint(_phone, _account);
            ledgerContract.increaseNonce(_account);
            emit ChangedToPayablePoint(_phone, _account, amount, amount, ledgerContract.pointBalanceOf(_account));
        }
    }

    /// @notice 사용자가 적립할 로열티를 토큰으로 변경한다.
    /// @param _account 지갑주소
    /// @param _amount 변경할 포인트량
    /// @param _signature 서명
    /// @dev 중계서버를 통해서 호출됩니다.
    function exchangePointToToken(address _account, uint256 _amount, bytes calldata _signature) external virtual {
        bytes32 dataHash = keccak256(abi.encode(_account, _amount, block.chainid, ledgerContract.nonceOf(_account)));
        require(ECDSA.recover(ECDSA.toEthSignedMessageHash(dataHash), _signature) == _account, "1501");

        require(ledgerContract.pointBalanceOf(_account) >= _amount, "1511");
        uint256 amountToken = currencyRateContract.convertPointToToken(_amount);
        require(ledgerContract.tokenBalanceOf(foundationAccount) >= amountToken, "1510");
        ledgerContract.transferToken(foundationAccount, _account, amountToken);
        ledgerContract.subPointBalance(_account, _amount);
        ledgerContract.increaseNonce(_account);
        emit ChangedPointToToken(
            _account,
            _amount,
            amountToken,
            ledgerContract.pointBalanceOf(_account),
            ledgerContract.tokenBalanceOf(_account)
        );
    }
}
