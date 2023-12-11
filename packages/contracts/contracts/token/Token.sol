// SPDX-License-Identifier: AGPL-3.0-or-later

pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract Token is ERC20 {
    uint256 public constant INITIAL_SUPPLY = 10000000000000000000000000000;

    constructor(address owner, string memory tokenName, string memory tokenSymbol) ERC20(tokenName, tokenSymbol) {
        _mint(owner, INITIAL_SUPPLY);
    }

    function decimals() public view virtual override returns (uint8) {
        return 18;
    }

    function multiTransfer(address[] calldata to, uint256 amount) public returns (bool) {
        address owner = _msgSender();
        for (uint256 idx = 0; idx < to.length; idx++) {
            _transfer(owner, to[idx], amount);
        }
        return true;
    }
}
