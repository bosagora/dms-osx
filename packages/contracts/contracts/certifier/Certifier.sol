// SPDX-License-Identifier: AGPL-3.0-or-later

pragma solidity ^0.8.20;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "../interfaces/ICertifier.sol";

contract Certifier is Initializable, AccessControlUpgradeable, OwnableUpgradeable, UUPSUpgradeable, ICertifier {
    bytes32 public constant CERTIFIER_ADMIN_ROLE = keccak256("CERTIFIER_ADMIN_ROLE");
    bytes32 public constant CERTIFIER_ROLE = keccak256("CERTIFIER_ROLE");

    function initialize(address certifier) external initializer {
        __AccessControl_init();
        __UUPSUpgradeable_init();
        __Ownable_init_unchained(_msgSender());

        _setRoleAdmin(CERTIFIER_ADMIN_ROLE, CERTIFIER_ADMIN_ROLE);
        _setRoleAdmin(CERTIFIER_ROLE, CERTIFIER_ADMIN_ROLE);

        _grantRole(DEFAULT_ADMIN_ROLE, certifier);
        _grantRole(CERTIFIER_ADMIN_ROLE, certifier);
        _grantRole(CERTIFIER_ROLE, certifier);
    }

    function _authorizeUpgrade(address newImplementation) internal virtual override {
        require(_msgSender() == owner(), "Unauthorized access");
    }

    function isCertifier(address account) external view virtual returns (bool) {
        return hasRole(CERTIFIER_ROLE, account);
    }

    function grantCertifier(address account) external virtual {
        grantRole(CERTIFIER_ROLE, account);
    }

    function revokeCertifier(address account) external virtual {
        revokeRole(CERTIFIER_ROLE, account);
    }

    function renounceCertifier(address account) external virtual {
        renounceRole(CERTIFIER_ROLE, account);
    }
}
