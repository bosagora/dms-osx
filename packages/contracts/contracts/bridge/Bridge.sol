// SPDX-License-Identifier: AGPL-3.0-or-later

pragma solidity ^0.8.2;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";

import "./BridgeValidator.sol";
import "./BridgeStorage.sol";

contract Bridge is BridgeStorage, Initializable, OwnableUpgradeable, UUPSUpgradeable {
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

    function initialize(address _validatorAddress, address _tokenAddress) external initializer {
        __UUPSUpgradeable_init();
        __Ownable_init_unchained();

        validatorContract = IBridgeValidator(_validatorAddress);
        tokenContract = IBIP20DelegatedTransfer(_tokenAddress);
    }

    function _authorizeUpgrade(address newImplementation) internal virtual override {
        require(_msgSender() == owner(), "Unauthorized access");
    }

    function isAvailableDeposit(bytes32 _depositId) public view returns (bool) {
        if (deposits[_depositId].account == address(0x0)) return true;
        else return false;
    }

    function isAvailableWithdraw(bytes32 _withdrawId) public view returns (bool) {
        if (deposits[_withdrawId].account == address(0x0)) return true;
        else return false;
    }

    /// @notice 브리지에 자금을 에치합니다.
    function depositToBridge(
        bytes32 _depositId,
        address _account,
        uint256 _amount,
        bytes calldata _signature
    ) external notExistDeposit(_depositId) {
        require(_amount % 1 gwei == 0, "1030");

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
    ) external onlyValidator(_msgSender()) notConfirmed(_withdrawId, _msgSender()) {
        require(_amount % 1 gwei == 0, "1030");

        if (withdraws[_withdrawId].account == address(0x0)) {
            WithdrawData memory data = WithdrawData({ account: _account, amount: _amount, executed: false });
            withdraws[_withdrawId] = data;
        } else {
            require(withdraws[_withdrawId].account == _account, "1717");
            require(withdraws[_withdrawId].amount == _amount, "1718");
        }
        confirmations[_withdrawId][_msgSender()] = true;

        if (!withdraws[_withdrawId].executed && isConfirmed(_withdrawId)) {
            if (tokenContract.balanceOf(address(this)) >= _amount) {
                tokenContract.transfer(_account, _amount);
                withdraws[_withdrawId].executed = true;
                emit BridgeWithdrawn(_withdrawId, _account, _amount);
            }
        }
    }

    /// @notice 브리지에 자금을 인출합니다.
    function executeWithdraw(bytes32 _withdrawId) external onlyValidator(_msgSender()) existWithdraw(_withdrawId) {
        if (!withdraws[_withdrawId].executed && isConfirmed(_withdrawId)) {
            if (tokenContract.balanceOf(address(this)) >= withdraws[_withdrawId].amount) {
                tokenContract.transferFrom(
                    address(this),
                    withdraws[_withdrawId].account,
                    withdraws[_withdrawId].amount
                );
                withdraws[_withdrawId].executed = true;
                emit BridgeWithdrawn(_withdrawId, withdraws[_withdrawId].account, withdraws[_withdrawId].amount);
            }
        }
    }

    /// @notice 검증자들의 합의가 완료되었는지 체크합니다.
    function isConfirmed(bytes32 _withdrawId) public view returns (bool) {
        uint256 count = 0;
        for (uint256 i = 0; i < validatorContract.getLength(); i++) {
            address validator = validatorContract.itemOf(i);
            if (confirmations[_withdrawId][validator]) count += 1;
            if (count >= validatorContract.getRequired()) return true;
        }
        return false;
    }

    /// @notice 예치정보를 조회합니다
    function getDepositInfo(bytes32 _depositId) public view returns (DepositData memory) {
        return deposits[_depositId];
    }

    /// @notice 인출정보를 조회합니다
    function getWithdrawInfo(bytes32 _withdrawId) public view returns (WithdrawData memory) {
        return withdraws[_withdrawId];
    }

    /// @notice 브리지를 위한 유동성 자금을 예치합니다.
    function depositLiquidity(uint256 _amount, bytes calldata _signature) external {
        require(tokenContract.balanceOf(_msgSender()) >= _amount, "1511");
        require(_amount % 1 gwei == 0, "1030");

        if (tokenContract.delegatedTransfer(_msgSender(), address(this), _amount, _signature)) {
            liquidity[_msgSender()] += _amount;
            emit DepositedLiquidity(_msgSender(), _amount, liquidity[_msgSender()]);
        }
    }

    /// @notice 브리지를 위한 유동성 자금을 인출합니다.
    function withdrawLiquidity(uint256 _amount) external {
        require(liquidity[_msgSender()] > _amount, "1514");
        require(tokenContract.balanceOf(address(this)) > _amount, "1511");
        require(_amount % 1 gwei == 0, "1030");

        tokenContract.transferFrom(address(this), _msgSender(), _amount);
        liquidity[_msgSender()] -= _amount;
        emit WithdrawnLiquidity(_msgSender(), _amount, liquidity[_msgSender()]);
    }

    /// @notice 브리지를 위한 유동성 자금을 조회합니다.
    function getLiquidity(address _account) external view returns (uint256) {
        return liquidity[_account];
    }
}
