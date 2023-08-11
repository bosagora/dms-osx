import "@nomiclabs/hardhat-ethers";
import "@nomiclabs/hardhat-waffle";
import "@nomiclabs/hardhat-web3";
import "@typechain/hardhat";
import * as dotenv from "dotenv";
import { utils, Wallet } from "ethers";
import "hardhat-deploy";
import "hardhat-gas-reporter";
// tslint:disable-next-line:no-submodule-imports
import { HardhatUserConfig, task } from "hardhat/config";
// tslint:disable-next-line:no-submodule-imports
import { HardhatNetworkAccountUserConfig } from "hardhat/types/config";
import "solidity-coverage";

dotenv.config({ path: "env/.env" });

// This is a sample Hardhat task. To learn how to create your own go to
// https://hardhat.org/guides/create-task.html
task("accounts", "Prints the list of accounts", async (taskArgs, hre) => {
    const accounts = await hre.ethers.getSigners();

    for (const account of accounts) {
        console.log(account.address);
    }
});

function getAccounts() {
    const accounts: string[] = [];
    const reg_bytes64: RegExp = /^(0x)[0-9a-f]{64}$/i;
    if (
        process.env.DEPLOYER !== undefined &&
        process.env.DEPLOYER.trim() !== "" &&
        reg_bytes64.test(process.env.DEPLOYER)
    ) {
        accounts.push(process.env.DEPLOYER);
    }
    if (process.env.OWNER !== undefined && process.env.OWNER.trim() !== "" && reg_bytes64.test(process.env.OWNER)) {
        accounts.push(process.env.OWNER);
    }

    if (
        process.env.VALIDATOR1 !== undefined &&
        process.env.VALIDATOR1.trim() !== "" &&
        reg_bytes64.test(process.env.VALIDATOR1)
    ) {
        accounts.push(process.env.VALIDATOR1);
    }

    if (
        process.env.VALIDATOR2 !== undefined &&
        process.env.VALIDATOR2.trim() !== "" &&
        reg_bytes64.test(process.env.VALIDATOR2)
    ) {
        accounts.push(process.env.VALIDATOR2);
    }

    if (
        process.env.VALIDATOR3 !== undefined &&
        process.env.VALIDATOR3.trim() !== "" &&
        reg_bytes64.test(process.env.VALIDATOR3)
    ) {
        accounts.push(process.env.VALIDATOR3);
    }

    if (
        process.env.VALIDATOR4 !== undefined &&
        process.env.VALIDATOR4.trim() !== "" &&
        reg_bytes64.test(process.env.VALIDATOR4)
    ) {
        accounts.push(process.env.VALIDATOR4);
    }

    if (
        process.env.VALIDATOR5 !== undefined &&
        process.env.VALIDATOR5.trim() !== "" &&
        reg_bytes64.test(process.env.VALIDATOR5)
    ) {
        accounts.push(process.env.VALIDATOR5);
    }

    if (
        process.env.MANAGER !== undefined &&
        process.env.MANAGER.trim() !== "" &&
        reg_bytes64.test(process.env.MANAGER)
    ) {
        accounts.push(process.env.MANAGER);
    } else {
        process.env.MANAGER = Wallet.createRandom().privateKey;
        accounts.push(process.env.MANAGER);
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
                version: "0.8.0",
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
        mainnet: {
            url: process.env.MAIN_NET_URL || "",
            chainId: 2151,
            accounts: getAccounts(),
        },
        testnet: {
            url: process.env.TEST_NET_URL || "",
            chainId: 2019,
            accounts: getAccounts(),
        },
        localhost: {
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
