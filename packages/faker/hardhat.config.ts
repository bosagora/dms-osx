import "@nomiclabs/hardhat-ethers";
import "@nomiclabs/hardhat-waffle";
import "@openzeppelin/hardhat-upgrades";
import "@typechain/hardhat";
import "hardhat-gas-reporter";
import "solidity-coverage";
import "solidity-docgen";

import * as dotenv from "dotenv";
import { utils, Wallet } from "ethers";

dotenv.config({ path: "env/.env" });

// tslint:disable-next-line:no-submodule-imports
import { HardhatNetworkAccountUserConfig } from "hardhat/types/config";
import { HardhatAccount } from "./src/HardhatAccount";

function getAccounts() {
    const accounts: string[] = [];
    const reg_bytes64: RegExp = /^(0x)[0-9a-f]{64}$/i;
    if (
        process.env.DEPLOYER !== undefined &&
        process.env.DEPLOYER.trim() !== "" &&
        reg_bytes64.test(process.env.DEPLOYER)
    ) {
        accounts.push(process.env.DEPLOYER);
    } else {
        process.env.DEPLOYER = Wallet.createRandom().privateKey;
        accounts.push(process.env.DEPLOYER);
    }

    if (process.env.OWNER !== undefined && process.env.OWNER.trim() !== "" && reg_bytes64.test(process.env.OWNER)) {
        accounts.push(process.env.OWNER);
    } else {
        process.env.OWNER = Wallet.createRandom().privateKey;
        accounts.push(process.env.OWNER);
    }

    if (
        process.env.FOUNDATION !== undefined &&
        process.env.FOUNDATION.trim() !== "" &&
        reg_bytes64.test(process.env.FOUNDATION)
    ) {
        accounts.push(process.env.FOUNDATION);
    } else {
        process.env.FOUNDATION = Wallet.createRandom().privateKey;
        accounts.push(process.env.FOUNDATION);
    }

    if (process.env.FEE !== undefined && process.env.FEE.trim() !== "" && reg_bytes64.test(process.env.FEE)) {
        accounts.push(process.env.FEE);
    } else {
        process.env.FEE = Wallet.createRandom().privateKey;
        accounts.push(process.env.FEE);
    }

    if (process.env.TXFEE !== undefined && process.env.TXFEE.trim() !== "" && reg_bytes64.test(process.env.TXFEE)) {
        accounts.push(process.env.TXFEE);
    } else {
        process.env.TXFEE = Wallet.createRandom().privateKey;
        accounts.push(process.env.TXFEE);
    }

    if (
        process.env.CERTIFIER01 !== undefined &&
        process.env.CERTIFIER01.trim() !== "" &&
        reg_bytes64.test(process.env.CERTIFIER01)
    ) {
        accounts.push(process.env.CERTIFIER01);
    } else {
        process.env.CERTIFIER01 = Wallet.createRandom().privateKey;
        accounts.push(process.env.CERTIFIER01);
    }

    if (
        process.env.CERTIFIER02 !== undefined &&
        process.env.CERTIFIER02.trim() !== "" &&
        reg_bytes64.test(process.env.CERTIFIER02)
    ) {
        accounts.push(process.env.CERTIFIER02);
    } else {
        process.env.CERTIFIER02 = Wallet.createRandom().privateKey;
        accounts.push(process.env.CERTIFIER02);
    }

    if (
        process.env.CERTIFIER03 !== undefined &&
        process.env.CERTIFIER03.trim() !== "" &&
        reg_bytes64.test(process.env.CERTIFIER03)
    ) {
        accounts.push(process.env.CERTIFIER03);
    } else {
        process.env.CERTIFIER03 = Wallet.createRandom().privateKey;
        accounts.push(process.env.CERTIFIER03);
    }

    if (
        process.env.CERTIFIER04 !== undefined &&
        process.env.CERTIFIER04.trim() !== "" &&
        reg_bytes64.test(process.env.CERTIFIER04)
    ) {
        accounts.push(process.env.CERTIFIER04);
    } else {
        process.env.CERTIFIER04 = Wallet.createRandom().privateKey;
        accounts.push(process.env.CERTIFIER04);
    }

    if (
        process.env.CERTIFIER05 !== undefined &&
        process.env.CERTIFIER05.trim() !== "" &&
        reg_bytes64.test(process.env.CERTIFIER05)
    ) {
        accounts.push(process.env.CERTIFIER05);
    } else {
        process.env.CERTIFIER05 = Wallet.createRandom().privateKey;
        accounts.push(process.env.CERTIFIER05);
    }

    if (
        process.env.CERTIFIER06 !== undefined &&
        process.env.CERTIFIER06.trim() !== "" &&
        reg_bytes64.test(process.env.CERTIFIER06)
    ) {
        accounts.push(process.env.CERTIFIER06);
    } else {
        process.env.CERTIFIER06 = Wallet.createRandom().privateKey;
        accounts.push(process.env.CERTIFIER06);
    }

    if (
        process.env.CERTIFIER07 !== undefined &&
        process.env.CERTIFIER07.trim() !== "" &&
        reg_bytes64.test(process.env.CERTIFIER07)
    ) {
        accounts.push(process.env.CERTIFIER07);
    } else {
        process.env.CERTIFIER07 = Wallet.createRandom().privateKey;
        accounts.push(process.env.CERTIFIER07);
    }

    if (
        process.env.CERTIFIER08 !== undefined &&
        process.env.CERTIFIER08.trim() !== "" &&
        reg_bytes64.test(process.env.CERTIFIER08)
    ) {
        accounts.push(process.env.CERTIFIER08);
    } else {
        process.env.CERTIFIER08 = Wallet.createRandom().privateKey;
        accounts.push(process.env.CERTIFIER08);
    }

    if (
        process.env.CERTIFIER09 !== undefined &&
        process.env.CERTIFIER09.trim() !== "" &&
        reg_bytes64.test(process.env.CERTIFIER09)
    ) {
        accounts.push(process.env.CERTIFIER09);
    } else {
        process.env.CERTIFIER09 = Wallet.createRandom().privateKey;
        accounts.push(process.env.CERTIFIER09);
    }

    if (
        process.env.CERTIFIER10 !== undefined &&
        process.env.CERTIFIER10.trim() !== "" &&
        reg_bytes64.test(process.env.CERTIFIER10)
    ) {
        accounts.push(process.env.CERTIFIER10);
    } else {
        process.env.CERTIFIER10 = Wallet.createRandom().privateKey;
        accounts.push(process.env.CERTIFIER10);
    }

    if (
        process.env.VALIDATOR01 !== undefined &&
        process.env.VALIDATOR01.trim() !== "" &&
        reg_bytes64.test(process.env.VALIDATOR01)
    ) {
        accounts.push(process.env.VALIDATOR01);
    } else {
        process.env.VALIDATOR01 = Wallet.createRandom().privateKey;
        accounts.push(process.env.VALIDATOR01);
    }

    if (
        process.env.VALIDATOR02 !== undefined &&
        process.env.VALIDATOR02.trim() !== "" &&
        reg_bytes64.test(process.env.VALIDATOR02)
    ) {
        accounts.push(process.env.VALIDATOR02);
    } else {
        process.env.VALIDATOR02 = Wallet.createRandom().privateKey;
        accounts.push(process.env.VALIDATOR02);
    }

    if (
        process.env.VALIDATOR03 !== undefined &&
        process.env.VALIDATOR03.trim() !== "" &&
        reg_bytes64.test(process.env.VALIDATOR03)
    ) {
        accounts.push(process.env.VALIDATOR03);
    } else {
        process.env.VALIDATOR03 = Wallet.createRandom().privateKey;
        accounts.push(process.env.VALIDATOR03);
    }

    if (
        process.env.VALIDATOR04 !== undefined &&
        process.env.VALIDATOR04.trim() !== "" &&
        reg_bytes64.test(process.env.VALIDATOR04)
    ) {
        accounts.push(process.env.VALIDATOR04);
    } else {
        process.env.VALIDATOR04 = Wallet.createRandom().privateKey;
        accounts.push(process.env.VALIDATOR04);
    }

    if (
        process.env.VALIDATOR05 !== undefined &&
        process.env.VALIDATOR05.trim() !== "" &&
        reg_bytes64.test(process.env.VALIDATOR05)
    ) {
        accounts.push(process.env.VALIDATOR05);
    } else {
        process.env.VALIDATOR05 = Wallet.createRandom().privateKey;
        accounts.push(process.env.VALIDATOR05);
    }

    if (
        process.env.VALIDATOR06 !== undefined &&
        process.env.VALIDATOR06.trim() !== "" &&
        reg_bytes64.test(process.env.VALIDATOR06)
    ) {
        accounts.push(process.env.VALIDATOR06);
    } else {
        process.env.VALIDATOR06 = Wallet.createRandom().privateKey;
        accounts.push(process.env.VALIDATOR06);
    }

    if (
        process.env.VALIDATOR07 !== undefined &&
        process.env.VALIDATOR07.trim() !== "" &&
        reg_bytes64.test(process.env.VALIDATOR07)
    ) {
        accounts.push(process.env.VALIDATOR07);
    } else {
        process.env.VALIDATOR07 = Wallet.createRandom().privateKey;
        accounts.push(process.env.VALIDATOR07);
    }

    if (
        process.env.VALIDATOR08 !== undefined &&
        process.env.VALIDATOR08.trim() !== "" &&
        reg_bytes64.test(process.env.VALIDATOR08)
    ) {
        accounts.push(process.env.VALIDATOR08);
    } else {
        process.env.VALIDATOR08 = Wallet.createRandom().privateKey;
        accounts.push(process.env.VALIDATOR08);
    }

    if (
        process.env.VALIDATOR09 !== undefined &&
        process.env.VALIDATOR09.trim() !== "" &&
        reg_bytes64.test(process.env.VALIDATOR09)
    ) {
        accounts.push(process.env.VALIDATOR09);
    } else {
        process.env.VALIDATOR09 = Wallet.createRandom().privateKey;
        accounts.push(process.env.VALIDATOR09);
    }

    if (
        process.env.VALIDATOR10 !== undefined &&
        process.env.VALIDATOR10.trim() !== "" &&
        reg_bytes64.test(process.env.VALIDATOR10)
    ) {
        accounts.push(process.env.VALIDATOR10);
    } else {
        process.env.VALIDATOR10 = Wallet.createRandom().privateKey;
        accounts.push(process.env.VALIDATOR10);
    }

    if (
        process.env.VALIDATOR11 !== undefined &&
        process.env.VALIDATOR11.trim() !== "" &&
        reg_bytes64.test(process.env.VALIDATOR11)
    ) {
        accounts.push(process.env.VALIDATOR11);
    } else {
        process.env.VALIDATOR11 = Wallet.createRandom().privateKey;
        accounts.push(process.env.VALIDATOR11);
    }

    if (
        process.env.VALIDATOR12 !== undefined &&
        process.env.VALIDATOR12.trim() !== "" &&
        reg_bytes64.test(process.env.VALIDATOR12)
    ) {
        accounts.push(process.env.VALIDATOR12);
    } else {
        process.env.VALIDATOR12 = Wallet.createRandom().privateKey;
        accounts.push(process.env.VALIDATOR12);
    }

    if (
        process.env.VALIDATOR13 !== undefined &&
        process.env.VALIDATOR13.trim() !== "" &&
        reg_bytes64.test(process.env.VALIDATOR13)
    ) {
        accounts.push(process.env.VALIDATOR13);
    } else {
        process.env.VALIDATOR13 = Wallet.createRandom().privateKey;
        accounts.push(process.env.VALIDATOR13);
    }

    if (
        process.env.VALIDATOR14 !== undefined &&
        process.env.VALIDATOR14.trim() !== "" &&
        reg_bytes64.test(process.env.VALIDATOR14)
    ) {
        accounts.push(process.env.VALIDATOR14);
    } else {
        process.env.VALIDATOR14 = Wallet.createRandom().privateKey;
        accounts.push(process.env.VALIDATOR14);
    }

    if (
        process.env.VALIDATOR15 !== undefined &&
        process.env.VALIDATOR15.trim() !== "" &&
        reg_bytes64.test(process.env.VALIDATOR15)
    ) {
        accounts.push(process.env.VALIDATOR15);
    } else {
        process.env.VALIDATOR15 = Wallet.createRandom().privateKey;
        accounts.push(process.env.VALIDATOR15);
    }

    if (
        process.env.VALIDATOR16 !== undefined &&
        process.env.VALIDATOR16.trim() !== "" &&
        reg_bytes64.test(process.env.VALIDATOR16)
    ) {
        accounts.push(process.env.VALIDATOR16);
    } else {
        process.env.VALIDATOR16 = Wallet.createRandom().privateKey;
        accounts.push(process.env.VALIDATOR16);
    }

    if (
        process.env.LINK_VALIDATOR1 !== undefined &&
        process.env.LINK_VALIDATOR1.trim() !== "" &&
        reg_bytes64.test(process.env.LINK_VALIDATOR1)
    ) {
        accounts.push(process.env.LINK_VALIDATOR1);
    } else {
        process.env.LINK_VALIDATOR1 = Wallet.createRandom().privateKey;
        accounts.push(process.env.LINK_VALIDATOR1);
    }

    if (
        process.env.LINK_VALIDATOR2 !== undefined &&
        process.env.LINK_VALIDATOR2.trim() !== "" &&
        reg_bytes64.test(process.env.LINK_VALIDATOR2)
    ) {
        accounts.push(process.env.LINK_VALIDATOR2);
    } else {
        process.env.LINK_VALIDATOR2 = Wallet.createRandom().privateKey;
        accounts.push(process.env.LINK_VALIDATOR2);
    }

    if (
        process.env.LINK_VALIDATOR3 !== undefined &&
        process.env.LINK_VALIDATOR3.trim() !== "" &&
        reg_bytes64.test(process.env.LINK_VALIDATOR3)
    ) {
        accounts.push(process.env.LINK_VALIDATOR3);
    } else {
        process.env.LINK_VALIDATOR3 = Wallet.createRandom().privateKey;
        accounts.push(process.env.LINK_VALIDATOR3);
    }

    if (
        process.env.BRIDGE_VALIDATOR1 !== undefined &&
        process.env.BRIDGE_VALIDATOR1.trim() !== "" &&
        reg_bytes64.test(process.env.BRIDGE_VALIDATOR1)
    ) {
        accounts.push(process.env.BRIDGE_VALIDATOR1);
    } else {
        process.env.BRIDGE_VALIDATOR1 = Wallet.createRandom().privateKey;
        accounts.push(process.env.BRIDGE_VALIDATOR1);
    }

    if (
        process.env.BRIDGE_VALIDATOR2 !== undefined &&
        process.env.BRIDGE_VALIDATOR2.trim() !== "" &&
        reg_bytes64.test(process.env.BRIDGE_VALIDATOR2)
    ) {
        accounts.push(process.env.BRIDGE_VALIDATOR2);
    } else {
        process.env.BRIDGE_VALIDATOR2 = Wallet.createRandom().privateKey;
        accounts.push(process.env.BRIDGE_VALIDATOR2);
    }

    if (
        process.env.BRIDGE_VALIDATOR3 !== undefined &&
        process.env.BRIDGE_VALIDATOR3.trim() !== "" &&
        reg_bytes64.test(process.env.BRIDGE_VALIDATOR3)
    ) {
        accounts.push(process.env.BRIDGE_VALIDATOR3);
    } else {
        process.env.BRIDGE_VALIDATOR3 = Wallet.createRandom().privateKey;
        accounts.push(process.env.BRIDGE_VALIDATOR3);
    }

    if (
        process.env.BRIDGE_VALIDATOR4 !== undefined &&
        process.env.BRIDGE_VALIDATOR4.trim() !== "" &&
        reg_bytes64.test(process.env.BRIDGE_VALIDATOR4)
    ) {
        accounts.push(process.env.BRIDGE_VALIDATOR4);
    } else {
        process.env.BRIDGE_VALIDATOR4 = Wallet.createRandom().privateKey;
        accounts.push(process.env.BRIDGE_VALIDATOR4);
    }

    if (
        process.env.BRIDGE_VALIDATOR5 !== undefined &&
        process.env.BRIDGE_VALIDATOR5.trim() !== "" &&
        reg_bytes64.test(process.env.BRIDGE_VALIDATOR5)
    ) {
        accounts.push(process.env.BRIDGE_VALIDATOR5);
    } else {
        process.env.BRIDGE_VALIDATOR5 = Wallet.createRandom().privateKey;
        accounts.push(process.env.BRIDGE_VALIDATOR5);
    }

    while (accounts.length < 50) {
        accounts.push(Wallet.createRandom().privateKey);
    }

    if (HardhatAccount.keys.length === 0) {
        for (const account of accounts) {
            HardhatAccount.keys.push(account);
        }
    }

    return accounts;
}

function getTestAccounts() {
    const accounts: HardhatNetworkAccountUserConfig[] = [];
    const defaultBalance = utils.parseEther("2000000").toString();

    const n = 50;
    for (let i = 0; i < n; ++i) {
        accounts.push({
            privateKey: Wallet.createRandom().privateKey,
            balance: defaultBalance,
        });
    }
    const acc = getAccounts();
    for (let idx = 0; idx < acc.length; idx++) accounts[idx].privateKey = acc[idx];
    accounts[0].balance = utils.parseEther("100000000").toString();

    return accounts;
}

// You need to export an object to set up your config
// Go to https://hardhat.org/config/ to learn more

const config = {
    solidity: {
        compilers: [
            {
                version: "0.8.2",
                settings: {
                    optimizer: {
                        enabled: true,
                        runs: 2000,
                    },
                },
            },
        ],
    },
    defaultNetwork: "hardhat",
    networks: {
        hardhat: {
            accounts: getTestAccounts(),
            gas: 8000000,
            gasPrice: 8000000000,
            blockGasLimit: 8000000,
        },
        devnet: {
            url: "http://localhost:8545",
            chainId: 24680,
            accounts: getAccounts(),
        },
        production_net: {
            url: process.env.PRODUCTION_NET_URL || "",
            chainId: Number(process.env.PRODUCTION_CHAIN_ID || "2151"),
            accounts: getAccounts(),
        },
    },
    gasReporter: {
        enabled: process.env.REPORT_GAS !== undefined,
        currency: "USD",
    },
};

export default config;
