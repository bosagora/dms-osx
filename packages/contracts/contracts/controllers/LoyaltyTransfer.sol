// SPDX-License-Identifier: AGPL-3.0-or-later

pragma solidity ^0.8.2;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";

import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

import "../interfaces/ILedger.sol";
import "./LoyaltyTransferStorage.sol";

contract LoyaltyTransfer is LoyaltyTransferStorage, Initializable, OwnableUpgradeable, UUPSUpgradeable {
    /// @notice 토큰이 전송될 때 발생되는 이벤트
    event TransferredLoyaltyToken(address from, address to, uint256 amount, uint256 balanceOfFrom, uint256 balanceOfTo);

    function initialize() external initializer {
        __UUPSUpgradeable_init();
        __Ownable_init_unchained();
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

    function transferToken(address _from, address _to, uint256 _amount, bytes calldata _signature) external {
        bytes32 dataHash = keccak256(abi.encode(_from, _to, _amount, ledgerContract.nonceOf(_from)));
        require(ECDSA.recover(ECDSA.toEthSignedMessageHash(dataHash), _signature) == _from, "1501");
        require(ledgerContract.loyaltyTypeOf(_from) == ILedger.LoyaltyType.TOKEN, "1520");
        require(ledgerContract.loyaltyTypeOf(_to) == ILedger.LoyaltyType.TOKEN, "1520");
        require(ledgerContract.tokenBalanceOf(_from) >= _amount, "1511");

        ledgerContract.transferToken(_from, _to, _amount);
        ledgerContract.increaseNonce(_from);

        emit TransferredLoyaltyToken(
            _from,
            _to,
            _amount,
            ledgerContract.tokenBalanceOf(_from),
            ledgerContract.tokenBalanceOf(_to)
        );
    }
}
