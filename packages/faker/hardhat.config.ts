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
