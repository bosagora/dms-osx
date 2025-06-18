// SPDX-License-Identifier: AGPL-3.0-or-later

pragma solidity ^0.8.2;

import "kios-contracts-v2/contracts/controllers/LoyaltyBurner.sol";
import "kios-contracts-v2/contracts/controllers/LoyaltyConsumer.sol";
import "kios-contracts-v2/contracts/controllers/LoyaltyProvider.sol";
import "kios-contracts-v2/contracts/controllers/LoyaltyExchanger.sol";
import "kios-contracts-v2/contracts/controllers/LoyaltyTransfer.sol";
import "kios-contracts-v2/contracts/controllers/LoyaltyBridge.sol";
import "kios-contracts-v2/contracts/currency/CurrencyRate.sol";
import "kios-contracts-v2/contracts/phone/PhoneLinkCollection.sol";
import "kios-contracts-v2/contracts/ledger/Ledger.sol";
import "kios-contracts-v2/contracts/shop/Shop.sol";
import "kios-contracts-v2/contracts/validator/Validator.sol";
import "kios-contracts-v2/contracts/token/TestLYT.sol";
import "kios-contracts-v2/contracts/token/TestERC20.sol";

import "multisig-wallet-contracts/contracts/MultiSigWalletFactory.sol";
import "multisig-wallet-contracts/contracts/MultiSigWallet.sol";
import "loyalty-tokens/contracts/LYT.sol";

import "kios-bridge-contracts-v2/contracts/bridge/Bridge.sol";
import "kios-bridge-contracts-v2/contracts/bridge/BridgeValidator.sol";
