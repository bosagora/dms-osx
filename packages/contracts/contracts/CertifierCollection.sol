// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/AccessControl.sol";

contract CertifierCollection is AccessControl {
    bytes32 public constant CERTIFIER_ADMIN_ROLE = keccak256("CERTIFIER_ADMIN_ROLE");
    bytes32 public constant CERTIFIER_ROLE = keccak256("CERTIFIER_ROLE");

    constructor(address certifier) {
        _setRoleAdmin(CERTIFIER_ADMIN_ROLE, CERTIFIER_ADMIN_ROLE);
        _setRoleAdmin(CERTIFIER_ROLE, CERTIFIER_ADMIN_ROLE);

        _setupRole(CERTIFIER_ADMIN_ROLE, certifier);
        _setupRole(CERTIFIER_ROLE, certifier);
    }

    function isCertifier(address account) public view returns (bool) {
        return hasRole(CERTIFIER_ROLE, account);
    }

    function grantCertifier(address account) external {
        grantRole(CERTIFIER_ROLE, account);
    }

    function revokeCertifier(address account) external {
        revokeRole(CERTIFIER_ROLE, account);
    }

    function renounceCertifier(address account) external {
        renounceRole(CERTIFIER_ROLE, account);
    }
}
