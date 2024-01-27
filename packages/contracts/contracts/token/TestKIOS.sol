// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.0;

import "kios-token-contracts/contracts/ERC20DelegatedTransfer.sol";

contract TestKIOS is ERC20DelegatedTransfer {
    /*
     * Public functions
     */
    constructor(address owner) ERC20DelegatedTransfer("KIOS", "KIOS") {
        _mint(owner, 1e10 * 1e18);
    }

    function multiTransfer(address[] calldata to, uint256 amount) public returns (bool) {
        address owner = _msgSender();
        for (uint256 idx = 0; idx < to.length; idx++) {
            _transfer(owner, to[idx], amount);
        }
        return true;
    }
}
