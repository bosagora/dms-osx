import { Amount } from "../src/common/Amount";
import { RelayStorage } from "../src/storage/RelayStorage";
import { ContractUtils } from "../src/utils/ContractUtils";
import {
    CertifierCollection,
    CurrencyRate,
    Ledger,
    PhoneLinkCollection,
    Shop,
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
import { ContractShopStatus, ShopTaskStatus, TaskResultType } from "../src/types";

import path from "path";
import { FakerCallbackServer } from "./helper/FakerCallbackServer";

import { Scheduler } from "../src/scheduler/Scheduler";
import { WatchScheduler } from "../src/scheduler/WatchScheduler";

chai.use(solidity);

describe("Test for Shop", function () {
    this.timeout(1000 * 60 * 5);
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
        relay1,
        relay2,
        relay3,
        relay4,
        relay5,
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
    let shopCollection: Shop;
    let certifierCollection: CertifierCollection;

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
            .deploy(validatorContract.address, await tokenContract.symbol())) as CurrencyRate;
        await currencyRateContract.deployed();
        await currencyRateContract.deployTransaction.wait();
        await currencyRateContract.connect(validatorWallets[0]).set(await tokenContract.symbol(), price);
    };

    const deployCertifierCollection = async () => {
        const factory = await hre.ethers.getContractFactory("CertifierCollection");
        certifierCollection = (await factory.connect(deployer).deploy(certifier.address)) as CertifierCollection;
        await certifierCollection.deployed();
        await certifierCollection.deployTransaction.wait();
        await certifierCollection.connect(certifier).grantCertifier(relay1.address);
        await certifierCollection.connect(certifier).grantCertifier(relay2.address);
        await certifierCollection.connect(certifier).grantCertifier(relay3.address);
        await certifierCollection.connect(certifier).grantCertifier(relay4.address);
        await certifierCollection.connect(certifier).grantCertifier(relay5.address);
    };

    const deployShopCollection = async () => {
        const shopCollectionFactory = await hre.ethers.getContractFactory("Shop");
        shopCollection = (await shopCollectionFactory
            .connect(deployer)
            .deploy(certifierCollection.address, currencyRateContract.address)) as Shop;
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
                certifierCollection.address,
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
        await deployCertifierCollection();
        await deployShopCollection();
        await deployLedger();
    };

    const client = new TestClient();
    let server: TestServer;
    let storage: RelayStorage;
    let serverURL: URL;
    let config: Config;

    let fakerCallbackServer: FakerCallbackServer;

    context("Add of shops", () => {
        interface IShopData {
            shopId: string;
            name: string;
            currency: string;
            provideWaitTime: number;
            providePercent: number;
            wallet: Wallet;
        }

        const shopData: IShopData[] = [
            {
                shopId: "",
                name: "Shop 1-1",
                currency: "krw",
                provideWaitTime: 0,
                providePercent: 5,
                wallet: shopWallets[0],
            },
            {
                shopId: "",
                name: "Shop 1-2",
                currency: "krw",
                provideWaitTime: 0,
                providePercent: 5,
                wallet: shopWallets[0],
            },
            {
                shopId: "",
                name: "Shop 2-1",
                currency: "krw",
                provideWaitTime: 0,
                providePercent: 5,
                wallet: shopWallets[1],
            },
            {
                shopId: "",
                name: "Shop 2-2",
                currency: "krw",
                provideWaitTime: 0,
                providePercent: 5,
                wallet: shopWallets[1],
            },
            {
                shopId: "",
                name: "Shop 3",
                currency: "krw",
                provideWaitTime: 0,
                providePercent: 5,
                wallet: shopWallets[2],
            },
            {
                shopId: "",
                name: "Shop 4",
                currency: "krw",
                provideWaitTime: 0,
                providePercent: 5,
                wallet: shopWallets[3],
            },
            {
                shopId: "",
                name: "Shop 5",
                currency: "krw",
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

            config.relay.managerKeys = [
                relay1.privateKey,
                relay2.privateKey,
                relay3.privateKey,
                relay4.privateKey,
                relay5.privateKey,
            ];
            config.relay.certifierKey = certifier.privateKey;
        });

        before("Create TestServer", async () => {
            serverURL = new URL(`http://127.0.0.1:${config.server.port}`);
            storage = await RelayStorage.make(config.database);
            server = new TestServer(config, storage);
            const schedulers: Scheduler[] = [];
            schedulers.push(new WatchScheduler("*/1 * * * * *"));
            server = new TestServer(config, storage, schedulers);
        });

        before("Start TestServer", async () => {
            await server.start();
        });

        after("Stop TestServer", async () => {
            await server.stop();
            await storage.dropTestDB();
        });

        before("Start CallbackServer", async () => {
            fakerCallbackServer = new FakerCallbackServer(3400);
            await fakerCallbackServer.start();
        });

        after("Stop CallbackServer", async () => {
            await fakerCallbackServer.stop();
        });

        let taskId: string;
        it("Add", async () => {
            for (const elem of shopData) {
                const nonce = await shopCollection.nonceOf(elem.wallet.address);
                const signature = await ContractUtils.signShop(elem.wallet, elem.shopId, nonce);

                const uri = URI(serverURL).directory("/v1/shop").filename("add");
                const url = uri.toString();
                const response = await client.post(url, {
                    shopId: elem.shopId,
                    name: elem.name,
                    currency: elem.currency,
                    account: elem.wallet.address,
                    signature,
                });

                expect(response.data.code).to.equal(0);
                expect(response.data.data).to.not.equal(undefined);
                expect(response.data.data.txHash).to.match(/^0x[A-Fa-f0-9]{64}$/i);
                assert.deepStrictEqual(response.data.data.taskStatus, ShopTaskStatus.SENT_TX);

                taskId = response.data.data.taskId;
                const t1 = ContractUtils.getTimeStamp();
                while (true) {
                    const responseItem = await client.get(
                        URI(serverURL).directory("/v1/shop/task").addQuery("taskId", taskId).toString()
                    );
                    if (responseItem.data.data.taskStatus === ShopTaskStatus.COMPLETED) break;
                    else if (ContractUtils.getTimeStamp() - t1 > 60) break;
                    await ContractUtils.delay(1000);
                }
            }
        });

        it("Check", async () => {
            for (const elem of shopData) {
                const shop = await shopCollection.shopOf(elem.shopId);
                expect(shop.status).to.deep.equal(ContractShopStatus.INACTIVE);
            }
        });

        context("Shop update", () => {
            it("Endpoint POST /v1/shop/update/create", async () => {
                const url = URI(serverURL).directory("/v1/shop/update").filename("create").toString();

                const params = {
                    accessKey: config.relay.accessKey,
                    shopId: shopData[0].shopId,
                    name: "새로운 이름",
                    currency: shopData[0].currency,
                    provideWaitTime: 86400,
                    providePercent: 10,
                };
                const response = await client.post(url, params);

                assert.deepStrictEqual(response.data.code, 0);
                assert.ok(response.data.data !== undefined);

                assert.deepStrictEqual(response.data.data.taskStatus, ShopTaskStatus.OPENED);
                taskId = response.data.data.taskId;
            });

            it("Endpoint GET /v1/shop/task", async () => {
                const url = URI(serverURL).directory("/v1/shop/task").addQuery("taskId", taskId).toString();

                const response = await client.get(url);

                assert.deepStrictEqual(response.data.code, 0);
                assert.ok(response.data.data !== undefined);

                assert.deepStrictEqual(response.data.data.type, TaskResultType.UPDATE);
                assert.deepStrictEqual(response.data.data.shopId, shopData[0].shopId);
                assert.deepStrictEqual(response.data.data.status, ContractShopStatus.INACTIVE);
                assert.deepStrictEqual(response.data.data.taskStatus, ShopTaskStatus.OPENED);
            });

            it("Endpoint POST /v1/shop/update/approval", async () => {
                const responseItem = await client.get(
                    URI(serverURL).directory("/v1/shop/task").addQuery("taskId", taskId).toString()
                );
                const nonce = await shopCollection.nonceOf(shopData[0].wallet.address);
                const signature = await ContractUtils.signShop(shopData[0].wallet, shopData[0].shopId, nonce);

                const response = await client.post(
                    URI(serverURL).directory("/v1/shop/update").filename("approval").toString(),
                    {
                        taskId,
                        approval: true,
                        signature,
                    }
                );

                assert.deepStrictEqual(response.data.code, 0, response.data?.error?.message);
                assert.ok(response.data.data !== undefined);
                assert.ok(response.data.data.txHash !== undefined);
                assert.deepStrictEqual(response.data.data.taskStatus, ShopTaskStatus.SENT_TX);
            });

            it("...Waiting", async () => {
                const t1 = ContractUtils.getTimeStamp();
                while (true) {
                    const responseItem = await client.get(
                        URI(serverURL).directory("/v1/shop/task").addQuery("taskId", taskId).toString()
                    );
                    if (responseItem.data.data.taskStatus === ShopTaskStatus.COMPLETED) break;
                    else if (ContractUtils.getTimeStamp() - t1 > 60) break;
                    await ContractUtils.delay(1000);
                }
            });

            it("Endpoint GET /v1/shop/task", async () => {
                const url = URI(serverURL).directory("/v1/shop/task").addQuery("taskId", taskId).toString();

                const response = await client.get(url);

                assert.deepStrictEqual(response.data.code, 0, response.data?.error?.message);
                assert.ok(response.data.data !== undefined);

                assert.deepStrictEqual(response.data.data.type, TaskResultType.UPDATE);
                assert.deepStrictEqual(response.data.data.shopId, shopData[0].shopId);
                assert.deepStrictEqual(response.data.data.status, ContractShopStatus.INACTIVE);
                assert.deepStrictEqual(response.data.data.taskStatus, ShopTaskStatus.COMPLETED);
            });

            it("Check update", async () => {
                const shop = await shopCollection.shopOf(shopData[0].shopId);
                expect(shop.name).to.deep.equal("새로운 이름");
                expect(shop.provideWaitTime.toNumber()).to.deep.equal(86400);
                expect(shop.providePercent.toNumber()).to.deep.equal(10);
            });
        });

        context("Shop status", () => {
            it("Endpoint POST /v1/shop/status/create", async () => {
                const url = URI(serverURL).directory("/v1/shop/status").filename("create").toString();

                const params = {
                    accessKey: config.relay.accessKey,
                    shopId: shopData[0].shopId,
                    status: ContractShopStatus.ACTIVE,
                };
                const response = await client.post(url, params);

                assert.deepStrictEqual(response.data.code, 0);
                assert.ok(response.data.data !== undefined);

                assert.deepStrictEqual(response.data.data.taskStatus, ShopTaskStatus.OPENED);
                taskId = response.data.data.taskId;
            });

            it("Endpoint GET /v1/shop/task", async () => {
                const url = URI(serverURL).directory("/v1/shop/task").addQuery("taskId", taskId).toString();

                const response = await client.get(url);

                assert.deepStrictEqual(response.data.code, 0);
                assert.ok(response.data.data !== undefined);

                assert.deepStrictEqual(response.data.data.type, TaskResultType.STATUS);
                assert.deepStrictEqual(response.data.data.shopId, shopData[0].shopId);
                assert.deepStrictEqual(response.data.data.status, ContractShopStatus.ACTIVE);
                assert.deepStrictEqual(response.data.data.taskStatus, ShopTaskStatus.OPENED);
            });

            it("Endpoint POST /v1/shop/status/approval", async () => {
                const responseItem = await client.get(
                    URI(serverURL).directory("/v1/shop/task").addQuery("taskId", taskId).toString()
                );
                const nonce = await shopCollection.nonceOf(shopData[0].wallet.address);
                const signature = await ContractUtils.signShop(shopData[0].wallet, shopData[0].shopId, nonce);

                const response = await client.post(
                    URI(serverURL).directory("/v1/shop/status").filename("approval").toString(),
                    {
                        taskId,
                        approval: true,
                        signature,
                    }
                );

                assert.deepStrictEqual(response.data.code, 0, response.data?.error?.message);
                assert.ok(response.data.data !== undefined);
                assert.ok(response.data.data.txHash !== undefined);
                assert.deepStrictEqual(response.data.data.taskStatus, ShopTaskStatus.SENT_TX);
            });

            it("...Waiting", async () => {
                const t1 = ContractUtils.getTimeStamp();
                while (true) {
                    const responseItem = await client.get(
                        URI(serverURL).directory("/v1/shop/task").addQuery("taskId", taskId).toString()
                    );
                    if (responseItem.data.data.taskStatus === ShopTaskStatus.COMPLETED) break;
                    else if (ContractUtils.getTimeStamp() - t1 > 60) break;
                    await ContractUtils.delay(1000);
                }
            });

            it("Endpoint GET /v1/shop/task", async () => {
                const url = URI(serverURL).directory("/v1/shop/task").addQuery("taskId", taskId).toString();

                const response = await client.get(url);

                assert.deepStrictEqual(response.data.code, 0, response.data?.error?.message);
                assert.ok(response.data.data !== undefined);

                assert.deepStrictEqual(response.data.data.type, TaskResultType.STATUS);
                assert.deepStrictEqual(response.data.data.shopId, shopData[0].shopId);
                assert.deepStrictEqual(response.data.data.status, ContractShopStatus.ACTIVE);
                assert.deepStrictEqual(response.data.data.taskStatus, ShopTaskStatus.COMPLETED);
            });

            it("Check status", async () => {
                const shop = await shopCollection.shopOf(shopData[0].shopId);
                expect(shop.status).to.deep.equal(ContractShopStatus.ACTIVE);
            });
        });
    });
});
