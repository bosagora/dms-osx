// SPDX-License-Identifier: AGPL-3.0-or-later

pragma solidity ^0.8.2;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract TestERC20 is ERC20 {
    constructor(address owner_, string memory name_, string memory symbol_) ERC20(name_, symbol_) {
        _mint(owner_, 2e9 * 1e18);
    }
}
