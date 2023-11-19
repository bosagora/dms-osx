import "@nomiclabs/hardhat-ethers";
import "@nomiclabs/hardhat-waffle";
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
import "solidity-docgen";

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
                        runs: 128,
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
            deploy: ["./deploy"],
        },
        bosagora_mainnet: {
            url: process.env.MAIN_NET_URL || "",
            chainId: 2151,
            accounts: getAccounts(),
            deploy: ["./deploy/bosagora_mainnet"],
        },
        bosagora_testnet: {
            url: process.env.TEST_NET_URL || "",
            chainId: 2019,
            accounts: getAccounts(),
            deploy: ["./deploy"],
        },
        bosagora_devnet: {
            url: "http://localhost:8545",
            chainId: 24680,
            accounts: getAccounts(),
            deploy: ["./deploy/bosagora_devnet"],
        },
    },
    namedAccounts: {
        deployer: {
            default: 0,
        },
        owner: {
            default: 1,
        },
        validator1: {
            default: 2,
        },
        validator2: {
            default: 3,
        },
        validator3: {
            default: 4,
        },
        validator4: {
            default: 5,
        },
        validator5: {
            default: 6,
        },
        foundation: {
            default: 7,
        },
        settlements: {
            default: 8,
        },
        fee: {
            default: 9,
        },
        certifier: {
            default: 10,
        },
        certifier01: {
            default: 11,
        },
        certifier02: {
            default: 12,
        },
        certifier03: {
            default: 13,
        },
        certifier04: {
            default: 14,
        },
        certifier05: {
            default: 15,
        },
        certifier06: {
            default: 16,
        },
        certifier07: {
            default: 17,
        },
        certifier08: {
            default: 18,
        },
        certifier09: {
            default: 19,
        },
        certifier10: {
            default: 20,
        },
        linkValidator1: {
            default: 21,
        },
        linkValidator2: {
            default: 22,
        },
        linkValidator3: {
            default: 23,
        },
    },
    gasReporter: {
        enabled: process.env.REPORT_GAS !== undefined,
        currency: "USD",
    },
};

export default config;
