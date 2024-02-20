// SPDX-License-Identifier: AGPL-3.0-or-later

pragma solidity ^0.8.2;

interface IBridge {
    struct DepositData {
        address account;
        uint256 amount;
    }

    struct WithdrawData {
        address account;
        uint256 amount;
        bool executed;
    }

    function isAvailableDepositId(bytes32 _depositId) external view returns (bool);

    function isAvailableWithdrawId(bytes32 _withdrawId) external view returns (bool);

    function depositToBridge(bytes32 _depositId, address _account, uint256 _amount, bytes calldata _signature) external;

    function withdrawFromBridge(bytes32 _withdrawId, address _account, uint256 _amount) external;

    function executeWithdraw(bytes32 _withdrawId) external;

    function isConfirmed(bytes32 _withdrawId) external view returns (bool);

    function getDepositInfo(bytes32 _depositId) external view returns (DepositData memory);

    function getWithdrawInfo(bytes32 _withdrawId) external view returns (WithdrawData memory);

    function getFee() external view returns (uint256);

    function changeFee(uint256 _fee) external;
}
