// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.2;

import "loyalty-tokens/contracts/BIP20/BIP20DelegatedTransfer.sol";

contract TestLYT is BIP20DelegatedTransfer {
    constructor(address owner) BIP20DelegatedTransfer("LYT", "LYT") {
        _mint(owner, 1e10 * 1e18);
    }

    function multiTransfer(address[] calldata to, uint256 amount) public returns (bool) {
        for (uint256 idx = 0; idx < to.length; idx++) {
            _transfer(msg.sender, to[idx], amount);
        }
        return true;
    }
}
