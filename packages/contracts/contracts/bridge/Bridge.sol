// SPDX-License-Identifier: AGPL-3.0-or-later

pragma solidity ^0.8.2;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";

import "loyalty-tokens/contracts/BIP20/IBIP20DelegatedTransfer.sol";

import "../interfaces/IBridge.sol";
import "../interfaces/IBridgeLiquidity.sol";
import "../interfaces/IBridgeValidator.sol";
import "./BridgeStorage.sol";

contract Bridge is BridgeStorage, Initializable, OwnableUpgradeable, UUPSUpgradeable, IBridge, IBridgeLiquidity {
    event BridgeDeposited(bytes32 depositId, address account, uint256 amount);
    event BridgeWithdrawn(bytes32 withdrawId, address account, uint256 amount);

    event DepositedLiquidity(address account, uint256 amount, uint256 liquidity);
    event WithdrawnLiquidity(address account, uint256 amount, uint256 liquidity);

    modifier onlyValidator(address _account) {
        require(validatorContract.isValidator(_account), "1000");
        _;
    }

    modifier notExistDeposit(bytes32 _depositId) {
        require(deposits[_depositId].account == address(0x0), "1711");
        _;
    }

    modifier existWithdraw(bytes32 _withdrawId) {
        require(withdraws[_withdrawId].account != address(0x0), "1712");
        _;
    }

    modifier notConfirmed(bytes32 _withdrawId, address _validator) {
        require(!confirmations[_withdrawId][_validator], "1715");
        _;
    }

    function initialize(address _validatorAddress, address _tokenAddress, address _feeAccount) external initializer {
        __UUPSUpgradeable_init();
        __Ownable_init_unchained();

        feeAccount = _feeAccount;
        fee = 5e18;
        validatorContract = IBridgeValidator(_validatorAddress);
        tokenContract = IBIP20DelegatedTransfer(_tokenAddress);
    }

    function _authorizeUpgrade(address newImplementation) internal virtual override {
        require(_msgSender() == owner(), "Unauthorized access");
    }

    function isAvailableDepositId(bytes32 _depositId) external view override returns (bool) {
        if (deposits[_depositId].account == address(0x0)) return true;
        else return false;
    }

    function isAvailableWithdrawId(bytes32 _withdrawId) external view override returns (bool) {
        if (withdraws[_withdrawId].account == address(0x0)) return true;
        else return false;
    }

    /// @notice 브리지에 자금을 에치합니다.
    function depositToBridge(
        bytes32 _depositId,
        address _account,
        uint256 _amount,
        bytes calldata _signature
    ) external override notExistDeposit(_depositId) {
        require(_amount % 1 gwei == 0, "1030");
        require(_amount > fee * 2, "1031");

        if (tokenContract.delegatedTransfer(_account, address(this), _amount, _signature)) {
            DepositData memory data = DepositData({ account: _account, amount: _amount });
            deposits[_depositId] = data;
            emit BridgeDeposited(_depositId, data.account, data.amount);
        }
    }

    /// @notice 브리지에서 자금을 인출합니다. 검증자들의 합의가 완료되면 인출이 됩니다.
    function withdrawFromBridge(
        bytes32 _withdrawId,
        address _account,
        uint256 _amount
    ) external override onlyValidator(_msgSender()) notConfirmed(_withdrawId, _msgSender()) {
        require(_amount % 1 gwei == 0, "1030");
        require(_amount > fee * 2, "1031");

        if (withdraws[_withdrawId].account == address(0x0)) {
            WithdrawData memory data = WithdrawData({ account: _account, amount: _amount, executed: false });
            withdraws[_withdrawId] = data;
        } else {
            require(withdraws[_withdrawId].account == _account, "1717");
            require(withdraws[_withdrawId].amount == _amount, "1718");
        }
        confirmations[_withdrawId][_msgSender()] = true;

        if (!withdraws[_withdrawId].executed && _isConfirmed(_withdrawId)) {
            uint256 withdrawalAmount = _amount - fee;
            if (tokenContract.balanceOf(address(this)) >= withdraws[_withdrawId].amount) {
                tokenContract.transfer(_account, withdrawalAmount);
                tokenContract.transfer(feeAccount, fee);
                withdraws[_withdrawId].executed = true;
                emit BridgeWithdrawn(_withdrawId, _account, withdrawalAmount);
            }
        }
    }

    /// @notice 브리지에 자금을 인출합니다.
    function executeWithdraw(
        bytes32 _withdrawId
    ) external override onlyValidator(_msgSender()) existWithdraw(_withdrawId) {
        if (!withdraws[_withdrawId].executed && _isConfirmed(_withdrawId)) {
            uint256 withdrawalAmount = withdraws[_withdrawId].amount - fee;
            if (tokenContract.balanceOf(address(this)) >= withdraws[_withdrawId].amount) {
                tokenContract.transfer(withdraws[_withdrawId].account, withdrawalAmount);
                tokenContract.transfer(feeAccount, fee);
                withdraws[_withdrawId].executed = true;
                emit BridgeWithdrawn(_withdrawId, withdraws[_withdrawId].account, withdrawalAmount);
            }
        }
    }

    /// @notice 검증자들의 합의가 완료되었는지 체크합니다.
    function isConfirmed(bytes32 _withdrawId) external view override returns (bool) {
        return _isConfirmed(_withdrawId);
    }

    /// @notice 검증자들의 합의가 완료되었는지 체크합니다.
    function _isConfirmed(bytes32 _withdrawId) internal view returns (bool) {
        uint256 count = 0;
        for (uint256 i = 0; i < validatorContract.getLength(); i++) {
            address validator = validatorContract.itemOf(i);
            if (confirmations[_withdrawId][validator]) count += 1;
            if (count >= validatorContract.getRequired()) return true;
        }
        return false;
    }

    /// @notice 예치정보를 조회합니다
    function getDepositInfo(bytes32 _depositId) external view override returns (DepositData memory) {
        return deposits[_depositId];
    }

    /// @notice 인출정보를 조회합니다
    function getWithdrawInfo(bytes32 _withdrawId) external view override returns (WithdrawData memory) {
        return withdraws[_withdrawId];
    }

    function getFee() external view override returns (uint256) {
        return fee;
    }

    function changeFee(uint256 _fee) external override {
        require(_msgSender() == owner(), "1050");
        fee = _fee;
    }

    /// @notice 브리지를 위한 유동성 자금을 예치합니다.
    function depositLiquidity(uint256 _amount, bytes calldata _signature) external override {
        require(tokenContract.balanceOf(_msgSender()) >= _amount, "1511");
        require(_amount % 1 gwei == 0, "1030");

        if (tokenContract.delegatedTransfer(_msgSender(), address(this), _amount, _signature)) {
            liquidity[_msgSender()] += _amount;
            emit DepositedLiquidity(_msgSender(), _amount, liquidity[_msgSender()]);
        }
    }

    /// @notice 브리지를 위한 유동성 자금을 인출합니다.
    function withdrawLiquidity(uint256 _amount) external override {
        require(liquidity[_msgSender()] > _amount, "1514");
        require(tokenContract.balanceOf(address(this)) > _amount, "1511");
        require(_amount % 1 gwei == 0, "1030");

        tokenContract.transferFrom(address(this), _msgSender(), _amount);
        liquidity[_msgSender()] -= _amount;
        emit WithdrawnLiquidity(_msgSender(), _amount, liquidity[_msgSender()]);
    }

    /// @notice 브리지를 위한 유동성 자금을 조회합니다.
    function getLiquidity(address _account) external view override returns (uint256) {
        return liquidity[_account];
    }
}
