import { Config } from "../src/common/Config";
import { GraphStorage } from "../src/storage/GraphStorage";
import { RelayStorage } from "../src/storage/RelayStorage";
import { ContractUtils } from "../src/utils/ContractUtils";
import {
    CurrencyRate,
    ERC20DelegatedTransfer,
    Ledger,
    LoyaltyConsumer,
    LoyaltyExchanger,
    LoyaltyProvider,
    PhoneLinkCollection,
    Shop,
    Validator,
} from "../typechain-types";

import "@nomiclabs/hardhat-ethers";
import "@nomiclabs/hardhat-waffle";

import chai, { expect } from "chai";
import { solidity } from "ethereum-waffle";

import { Wallet } from "ethers";

import assert from "assert";
import URI from "urijs";
import { URL } from "url";
import { ContractShopStatus, ShopTaskStatus, TaskResultType } from "../src/types";

import path from "path";

import { Scheduler } from "../src/scheduler/Scheduler";
import { WatchScheduler } from "../src/scheduler/WatchScheduler";

import { Deployments } from "./helper/Deployments";
import { FakerCallbackServer } from "./helper/FakerCallbackServer";
import { TestClient, TestServer } from "./helper/Utility";

chai.use(solidity);

describe("Test for Shop", function () {
    this.timeout(1000 * 60 * 5);
    const deployments = new Deployments();

    let validatorContract: Validator;
    let tokenContract: ERC20DelegatedTransfer;
    let linkContract: PhoneLinkCollection;
    let currencyRateContract: CurrencyRate;
    let shopContract: Shop;
    let consumerContract: LoyaltyConsumer;
    let providerContract: LoyaltyProvider;
    let exchangerContract: LoyaltyExchanger;
    let ledgerContract: Ledger;

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
            wallet: Wallet;
        }

        const shopData: IShopData[] = [
            {
                shopId: "",
                name: "Shop 1-1",
                currency: "krw",
                wallet: deployments.accounts.shops[0],
            },
            {
                shopId: "",
                name: "Shop 1-2",
                currency: "krw",
                wallet: deployments.accounts.shops[0],
            },
            {
                shopId: "",
                name: "Shop 2-1",
                currency: "krw",
                wallet: deployments.accounts.shops[1],
            },
            {
                shopId: "",
                name: "Shop 2-2",
                currency: "krw",
                wallet: deployments.accounts.shops[1],
            },
            {
                shopId: "",
                name: "Shop 3",
                currency: "krw",
                wallet: deployments.accounts.shops[2],
            },
            {
                shopId: "",
                name: "Shop 4",
                currency: "krw",
                wallet: deployments.accounts.shops[3],
            },
            {
                shopId: "",
                name: "Shop 5",
                currency: "krw",
                wallet: deployments.accounts.shops[4],
            },
        ];

        before("Set Shop ID", async () => {
            for (const elem of shopData) {
                elem.shopId = ContractUtils.getShopId(elem.wallet.address);
            }
        });

        before("Deploy", async () => {
            await deployments.doDeploy();

            validatorContract = deployments.getContract("Validator") as Validator;
            tokenContract = deployments.getContract("TestKIOS") as ERC20DelegatedTransfer;
            ledgerContract = deployments.getContract("Ledger") as Ledger;
            linkContract = deployments.getContract("PhoneLinkCollection") as PhoneLinkCollection;
            consumerContract = deployments.getContract("LoyaltyConsumer") as LoyaltyConsumer;
            providerContract = deployments.getContract("LoyaltyProvider") as LoyaltyProvider;
            exchangerContract = deployments.getContract("LoyaltyExchanger") as LoyaltyExchanger;
            currencyRateContract = deployments.getContract("CurrencyRate") as CurrencyRate;
            shopContract = deployments.getContract("Shop") as Shop;
        });

        before("Create Config", async () => {
            config = new Config();
            config.readFromFile(path.resolve(process.cwd(), "config", "config_test.yaml"));
            config.contracts.tokenAddress = tokenContract.address;
            config.contracts.phoneLinkerAddress = linkContract.address;
            config.contracts.shopAddress = shopContract.address;
            config.contracts.ledgerAddress = ledgerContract.address;
            config.contracts.consumerAddress = consumerContract.address;
            config.contracts.providerAddress = providerContract.address;
            config.contracts.exchangerAddress = exchangerContract.address;
            config.contracts.currencyRateAddress = currencyRateContract.address;

            config.relay.managerKeys = deployments.accounts.certifiers.map((m) => m.privateKey);
            config.relay.callbackEndpoint = "http://127.0.0.1:3400/callback";
        });

        before("Create TestServer", async () => {
            serverURL = new URL(`http://127.0.0.1:${config.server.port}`);
            storage = await RelayStorage.make(config.database);
            const graph = await GraphStorage.make(config.graph);
            const schedulers: Scheduler[] = [];
            schedulers.push(new WatchScheduler("*/1 * * * * *"));
            server = new TestServer(config, storage, graph, schedulers);
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
                const nonce = await shopContract.nonceOf(elem.wallet.address);
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
                const shop = await shopContract.shopOf(elem.shopId);
                expect(shop.status).to.deep.equal(ContractShopStatus.ACTIVE);
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
                assert.deepStrictEqual(response.data.data.status, ContractShopStatus.ACTIVE);
                assert.deepStrictEqual(response.data.data.taskStatus, ShopTaskStatus.OPENED);
            });

            it("Endpoint POST /v1/shop/update/approval", async () => {
                const responseItem = await client.get(
                    URI(serverURL).directory("/v1/shop/task").addQuery("taskId", taskId).toString()
                );
                const nonce = await shopContract.nonceOf(shopData[0].wallet.address);
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
                assert.deepStrictEqual(response.data.data.status, ContractShopStatus.ACTIVE);
                assert.deepStrictEqual(response.data.data.taskStatus, ShopTaskStatus.COMPLETED);
            });

            it("Check update", async () => {
                const shop = await shopContract.shopOf(shopData[0].shopId);
                expect(shop.name).to.deep.equal("새로운 이름");
            });
        });

        context("Shop status", () => {
            it("Endpoint POST /v1/shop/status/create", async () => {
                const url = URI(serverURL).directory("/v1/shop/status").filename("create").toString();

                const params = {
                    accessKey: config.relay.accessKey,
                    shopId: shopData[0].shopId,
                    status: ContractShopStatus.INACTIVE,
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
                assert.deepStrictEqual(response.data.data.status, ContractShopStatus.INACTIVE);
                assert.deepStrictEqual(response.data.data.taskStatus, ShopTaskStatus.OPENED);
            });

            it("Endpoint POST /v1/shop/status/approval", async () => {
                const responseItem = await client.get(
                    URI(serverURL).directory("/v1/shop/task").addQuery("taskId", taskId).toString()
                );
                const nonce = await shopContract.nonceOf(shopData[0].wallet.address);
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
                assert.deepStrictEqual(response.data.data.status, ContractShopStatus.INACTIVE);
                assert.deepStrictEqual(response.data.data.taskStatus, ShopTaskStatus.COMPLETED);
            });

            it("Check status", async () => {
                const shop = await shopContract.shopOf(shopData[0].shopId);
                expect(shop.status).to.deep.equal(ContractShopStatus.INACTIVE);
            });
        });
    });
});
