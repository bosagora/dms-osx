import { Amount } from "../src/common/Amount";
import { RelayStorage } from "../src/storage/RelayStorage";
import { ContractUtils } from "../src/utils/ContractUtils";
import {
    CurrencyRate,
    Ledger,
    PhoneLinkCollection,
    ShopCollection,
    Token,
    ValidatorCollection,
} from "../typechain-types";
import { TestClient, TestServer } from "./helper/Utility";

import "@nomiclabs/hardhat-ethers";
import "@nomiclabs/hardhat-waffle";

import chai, { expect } from "chai";
import { solidity } from "ethereum-waffle";

import * as hre from "hardhat";

import { BigNumber, Wallet } from "ethers";

import assert from "assert";
import URI from "urijs";
import { URL } from "url";
import { Config } from "../src/common/Config";

import path from "path";

chai.use(solidity);

describe("Test for ShopCollection", () => {
    const provider = hre.waffle.provider;
    const [
        deployer,
        foundation,
        settlements,
        fee,
        certifier,
        validator1,
        validator2,
        validator3,
        relay,
        user1,
        user2,
        user3,
        user4,
        user5,
        shop1,
        shop2,
        shop3,
        shop4,
        shop5,
        shop6,
    ] = provider.getWallets();

    const validatorWallets = [validator1, validator2, validator3];
    const linkValidators = [validator1];
    const userWallets = [user1, user2, user3, user4, user5];
    const shopWallets = [shop1, shop2, shop3, shop4, shop5, shop6];
    let validatorContract: ValidatorCollection;
    let tokenContract: Token;
    let ledgerContract: Ledger;
    let linkCollectionContract: PhoneLinkCollection;
    let currencyRateContract: CurrencyRate;
    let shopCollection: ShopCollection;

    const multiple = BigNumber.from(1000000000);
    const price = BigNumber.from(150).mul(multiple);

    const amount = Amount.make(20_000, 18);

    const deployToken = async () => {
        const tokenFactory = await hre.ethers.getContractFactory("Token");
        tokenContract = (await tokenFactory.connect(deployer).deploy(deployer.address, "Sample", "SAM")) as Token;
        await tokenContract.deployed();
        await tokenContract.deployTransaction.wait();
        for (const elem of validatorWallets) {
            await tokenContract.connect(deployer).transfer(elem.address, amount.value);
        }
    };

    const deployValidatorCollection = async () => {
        const validatorFactory = await hre.ethers.getContractFactory("ValidatorCollection");
        validatorContract = (await validatorFactory.connect(deployer).deploy(
            tokenContract.address,
            validatorWallets.map((m) => m.address)
        )) as ValidatorCollection;
        await validatorContract.deployed();
        await validatorContract.deployTransaction.wait();
    };

    const depositValidators = async () => {
        for (const elem of validatorWallets) {
            await tokenContract.connect(elem).approve(validatorContract.address, amount.value);
            await expect(validatorContract.connect(elem).deposit(amount.value))
                .to.emit(validatorContract, "DepositedForValidator")
                .withArgs(elem.address, amount.value, amount.value);
            const item = await validatorContract.validatorOf(elem.address);
            assert.deepStrictEqual(item.validator, elem.address);
            assert.deepStrictEqual(item.status, 1);
            assert.deepStrictEqual(item.balance, amount.value);
        }
    };

    const deployLinkCollection = async () => {
        const linkCollectionFactory = await hre.ethers.getContractFactory("PhoneLinkCollection");
        linkCollectionContract = (await linkCollectionFactory
            .connect(deployer)
            .deploy(linkValidators.map((m) => m.address))) as PhoneLinkCollection;
        await linkCollectionContract.deployed();
        await linkCollectionContract.deployTransaction.wait();
    };

    const deployCurrencyRate = async () => {
        const currencyRateFactory = await hre.ethers.getContractFactory("CurrencyRate");
        currencyRateContract = (await currencyRateFactory
            .connect(deployer)
            .deploy(validatorContract.address)) as CurrencyRate;
        await currencyRateContract.deployed();
        await currencyRateContract.deployTransaction.wait();
        await currencyRateContract.connect(validatorWallets[0]).set(await tokenContract.symbol(), price);
    };

    const deployShopCollection = async () => {
        const shopCollectionFactory = await hre.ethers.getContractFactory("ShopCollection");
        shopCollection = (await shopCollectionFactory.connect(deployer).deploy()) as ShopCollection;
        await shopCollection.deployed();
        await shopCollection.deployTransaction.wait();
    };

    const deployLedger = async () => {
        const ledgerFactory = await hre.ethers.getContractFactory("Ledger");
        ledgerContract = (await ledgerFactory
            .connect(deployer)
            .deploy(
                foundation.address,
                settlements.address,
                fee.address,
                certifier.address,
                tokenContract.address,
                validatorContract.address,
                linkCollectionContract.address,
                currencyRateContract.address,
                shopCollection.address
            )) as Ledger;
        await ledgerContract.deployed();
        await ledgerContract.deployTransaction.wait();

        await shopCollection.connect(deployer).setLedgerAddress(ledgerContract.address);
    };

    const deployAllContract = async () => {
        await deployToken();
        await deployValidatorCollection();
        await depositValidators();
        await deployLinkCollection();
        await deployCurrencyRate();
        await deployShopCollection();
        await deployLedger();
    };

    const client = new TestClient();
    let server: TestServer;
    let storage: RelayStorage;
    let serverURL: URL;
    let config: Config;

    context("Add, Update, Delete of shops", () => {
        interface IShopData {
            shopId: string;
            name: string;
            provideWaitTime: number;
            providePercent: number;
            wallet: Wallet;
        }

        const shopData: IShopData[] = [
            {
                shopId: "",
                name: "Shop 1-1",
                provideWaitTime: 0,
                providePercent: 5,
                wallet: shopWallets[0],
            },
            {
                shopId: "",
                name: "Shop 1-2",
                provideWaitTime: 0,
                providePercent: 5,
                wallet: shopWallets[0],
            },
            {
                shopId: "",
                name: "Shop 2-1",
                provideWaitTime: 0,
                providePercent: 5,
                wallet: shopWallets[1],
            },
            {
                shopId: "",
                name: "Shop 2-2",
                provideWaitTime: 0,
                providePercent: 5,
                wallet: shopWallets[1],
            },
            {
                shopId: "",
                name: "Shop 3",
                provideWaitTime: 0,
                providePercent: 5,
                wallet: shopWallets[2],
            },
            {
                shopId: "",
                name: "Shop 4",
                provideWaitTime: 0,
                providePercent: 5,
                wallet: shopWallets[3],
            },
            {
                shopId: "",
                name: "Shop 5",
                provideWaitTime: 0,
                providePercent: 5,
                wallet: shopWallets[4],
            },
        ];

        before("Set Shop ID", async () => {
            for (const elem of shopData) {
                elem.shopId = ContractUtils.getShopId(elem.wallet.address);
            }
        });

        before("Deploy", async () => {
            await deployAllContract();
        });

        before("Create Config", async () => {
            config = new Config();
            config.readFromFile(path.resolve(process.cwd(), "config", "config_test.yaml"));
            config.contracts.tokenAddress = tokenContract.address;
            config.contracts.phoneLinkerAddress = linkCollectionContract.address;
            config.contracts.ledgerAddress = ledgerContract.address;
            config.contracts.shopAddress = shopCollection.address;

            config.relay.managerKeys = [relay.privateKey];
        });

        before("Create TestServer", async () => {
            serverURL = new URL(`http://127.0.0.1:${config.server.port}`);
            storage = await RelayStorage.make(config.database);
            server = new TestServer(config, storage);
        });

        before("Start TestServer", async () => {
            await server.start();
        });

        after("Stop TestServer", async () => {
            await server.stop();
            await storage.close();
        });

        it("Add", async () => {
            for (const elem of shopData) {
                const nonce = await shopCollection.nonceOf(elem.wallet.address);
                const signature = await ContractUtils.signShop(
                    elem.wallet,
                    elem.shopId,
                    elem.name,
                    elem.provideWaitTime,
                    elem.providePercent,
                    nonce
                );

                const uri = URI(serverURL).directory("/v1/shop").filename("add");
                const url = uri.toString();
                const response = await client.post(url, {
                    shopId: elem.shopId,
                    name: elem.name,
                    provideWaitTime: elem.provideWaitTime,
                    providePercent: elem.providePercent,
                    account: elem.wallet.address,
                    signature,
                });

                expect(response.data.code).to.equal(0);
                expect(response.data.data).to.not.equal(undefined);
                expect(response.data.data.txHash).to.match(/^0x[A-Fa-f0-9]{64}$/i);
            }
        });

        it("Check", async () => {
            const ids = await shopCollection.shopsOf(shopWallets[0].address);
            expect(ids).to.deep.equal([shopData[0].shopId, shopData[1].shopId]);
        });

        it("Update", async () => {
            const elem = shopData[0];
            const nonce = await shopCollection.nonceOf(elem.wallet.address);
            elem.name = "New Shop";
            elem.provideWaitTime = 86400 * 7;
            elem.providePercent = 10;
            const signature = await ContractUtils.signShop(
                elem.wallet,
                elem.shopId,
                elem.name,
                elem.provideWaitTime,
                elem.providePercent,
                nonce
            );

            const uri = URI(serverURL).directory("/v1/shop").filename("update");
            const url = uri.toString();
            const response = await client.post(url, {
                shopId: elem.shopId,
                name: elem.name,
                provideWaitTime: elem.provideWaitTime,
                providePercent: elem.providePercent,
                account: elem.wallet.address,
                signature,
            });

            expect(response.data.code).to.equal(0);
            expect(response.data.data).to.not.equal(undefined);
            expect(response.data.data.txHash).to.match(/^0x[A-Fa-f0-9]{64}$/i);
        });

        it("Remove", async () => {
            const elem = shopData[0];
            const nonce = await shopCollection.nonceOf(elem.wallet.address);
            const signature = await ContractUtils.signShopId(elem.wallet, elem.shopId, nonce);

            const uri = URI(serverURL).directory("/v1/shop").filename("remove");
            const url = uri.toString();
            const response = await client.post(url, {
                shopId: elem.shopId,
                account: elem.wallet.address,
                signature,
            });

            expect(response.data.code).to.equal(0);
            expect(response.data.data).to.not.equal(undefined);
            expect(response.data.data.txHash).to.match(/^0x[A-Fa-f0-9]{64}$/i);
        });

        it("Check remove", async () => {
            const ids = await shopCollection.shopsOf(shopWallets[0].address);
            expect(ids).to.deep.equal([shopData[1].shopId]);
        });
    });
});
