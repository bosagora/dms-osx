import "@nomiclabs/hardhat-ethers";
import "@nomiclabs/hardhat-waffle";
import "@openzeppelin/hardhat-upgrades";
import "@typechain/hardhat";
import "hardhat-gas-reporter";
import "solidity-coverage";
import "solidity-docgen";

import * as dotenv from "dotenv";
import { Wallet } from "ethers";

dotenv.config({ path: "env/.env" });

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
        process.env.VALIDATOR1 !== undefined &&
        process.env.VALIDATOR1.trim() !== "" &&
        reg_bytes64.test(process.env.VALIDATOR1)
    ) {
        accounts.push(process.env.VALIDATOR1);
    } else {
        process.env.VALIDATOR1 = Wallet.createRandom().privateKey;
        accounts.push(process.env.VALIDATOR1);
    }

    if (
        process.env.VALIDATOR2 !== undefined &&
        process.env.VALIDATOR2.trim() !== "" &&
        reg_bytes64.test(process.env.VALIDATOR2)
    ) {
        accounts.push(process.env.VALIDATOR2);
    } else {
        process.env.VALIDATOR2 = Wallet.createRandom().privateKey;
        accounts.push(process.env.VALIDATOR2);
    }

    if (
        process.env.VALIDATOR3 !== undefined &&
        process.env.VALIDATOR3.trim() !== "" &&
        reg_bytes64.test(process.env.VALIDATOR3)
    ) {
        accounts.push(process.env.VALIDATOR3);
    } else {
        process.env.VALIDATOR3 = Wallet.createRandom().privateKey;
        accounts.push(process.env.VALIDATOR3);
    }

    if (
        process.env.VALIDATOR4 !== undefined &&
        process.env.VALIDATOR4.trim() !== "" &&
        reg_bytes64.test(process.env.VALIDATOR4)
    ) {
        accounts.push(process.env.VALIDATOR4);
    } else {
        process.env.VALIDATOR4 = Wallet.createRandom().privateKey;
        accounts.push(process.env.VALIDATOR4);
    }

    if (
        process.env.VALIDATOR5 !== undefined &&
        process.env.VALIDATOR5.trim() !== "" &&
        reg_bytes64.test(process.env.VALIDATOR5)
    ) {
        accounts.push(process.env.VALIDATOR5);
    } else {
        process.env.VALIDATOR5 = Wallet.createRandom().privateKey;
        accounts.push(process.env.VALIDATOR5);
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

    if (
        process.env.SETTLEMENTS !== undefined &&
        process.env.SETTLEMENTS.trim() !== "" &&
        reg_bytes64.test(process.env.SETTLEMENTS)
    ) {
        accounts.push(process.env.SETTLEMENTS);
    } else {
        process.env.SETTLEMENTS = Wallet.createRandom().privateKey;
        accounts.push(process.env.SETTLEMENTS);
    }

    if (process.env.FEE !== undefined && process.env.FEE.trim() !== "" && reg_bytes64.test(process.env.FEE)) {
        accounts.push(process.env.FEE);
    } else {
        process.env.FEE = Wallet.createRandom().privateKey;
        accounts.push(process.env.FEE);
    }

    if (
        process.env.CERTIFIER !== undefined &&
        process.env.CERTIFIER.trim() !== "" &&
        reg_bytes64.test(process.env.CERTIFIER)
    ) {
        accounts.push(process.env.CERTIFIER);
    } else {
        process.env.CERTIFIER = Wallet.createRandom().privateKey;
        accounts.push(process.env.CERTIFIER);
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
    const defaultBalance = "2000000000000000000000000";
    const acc = getAccounts();
    return acc.map((m) => {
        return {
            privateKey: m,
            balance: defaultBalance,
        };
    });
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
        bosagora_mainnet: {
            url: process.env.MAIN_NET_URL || "",
            chainId: 2151,
            accounts: getAccounts(),
        },
        bosagora_testnet: {
            url: process.env.TEST_NET_URL || "",
            chainId: 2019,
            accounts: getAccounts(),
        },
        bosagora_devnet: {
            url: "http://localhost:8545",
            chainId: 24680,
            accounts: getAccounts(),
        },
    },
    gasReporter: {
        enabled: process.env.REPORT_GAS !== undefined,
        currency: "USD",
    },
};

export default config;
