import "@nomiclabs/hardhat-ethers";
import "@nomiclabs/hardhat-waffle";

import { Config } from "../src/common/Config";
import { ContractManager } from "../src/contract/ContractManager";
import { Scheduler } from "../src/scheduler/Scheduler";
import { WatchScheduler } from "../src/scheduler/WatchScheduler";
import { GraphStorage } from "../src/storage/GraphStorage";
import { RelayStorage } from "../src/storage/RelayStorage";
import { ContractShopStatus, ShopTaskStatus, TaskResultType } from "../src/types";
import { ContractUtils, LoyaltyNetworkID } from "../src/utils/ContractUtils";
import {
    BIP20DelegatedTransfer,
    CurrencyRate,
    Ledger,
    LoyaltyConsumer,
    LoyaltyExchanger,
    LoyaltyProvider,
    PhoneLinkCollection,
    Shop,
    Validator,
} from "../typechain-types";
import { Deployments } from "./helper/Deployments";
import { FakerCallbackServer } from "./helper/FakerCallbackServer";
import { TestClient, TestServer } from "./helper/Utility";

import chai, { expect } from "chai";
import { solidity } from "ethereum-waffle";

import assert from "assert";
import { Wallet } from "ethers";
import path from "path";
import URI from "urijs";
import { URL } from "url";

chai.use(solidity);

describe("Test for Shop", function () {
    this.timeout(1000 * 60 * 5);
    const config = new Config();
    config.readFromFile(path.resolve(process.cwd(), "config", "config_test.yaml"));
    const contractManager = new ContractManager(config);
    const deployments = new Deployments(config);

    let validatorContract: Validator;
    let tokenContract: BIP20DelegatedTransfer;
    let linkContract: PhoneLinkCollection;
    let currencyRateContract: CurrencyRate;
    let shopContract: Shop;
    let consumerContract: LoyaltyConsumer;
    let providerContract: LoyaltyProvider;
    let exchangerContract: LoyaltyExchanger;
    let ledgerContract: Ledger;

    let client: TestClient;
    let server: TestServer;
    let storage: RelayStorage;
    let serverURL: URL;

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
                elem.shopId = ContractUtils.getShopId(elem.wallet.address, LoyaltyNetworkID.KIOS);
            }
        });

        before("Deploy", async () => {
            await deployments.doDeploy();

            validatorContract = deployments.getContract("Validator") as Validator;
            tokenContract = deployments.getContract("TestKIOS") as BIP20DelegatedTransfer;
            ledgerContract = deployments.getContract("Ledger") as Ledger;
            linkContract = deployments.getContract("PhoneLinkCollection") as PhoneLinkCollection;
            consumerContract = deployments.getContract("LoyaltyConsumer") as LoyaltyConsumer;
            providerContract = deployments.getContract("LoyaltyProvider") as LoyaltyProvider;
            exchangerContract = deployments.getContract("LoyaltyExchanger") as LoyaltyExchanger;
            currencyRateContract = deployments.getContract("CurrencyRate") as CurrencyRate;
            shopContract = deployments.getContract("Shop") as Shop;
        });

        before("Create Config", async () => {
            config.contracts.sideChain.tokenAddress = deployments.getContractAddress("TestKIOS") || "";
            config.contracts.sideChain.currencyRateAddress = deployments.getContractAddress("CurrencyRate") || "";
            config.contracts.sideChain.phoneLinkerAddress = deployments.getContractAddress("PhoneLinkCollection") || "";
            config.contracts.sideChain.ledgerAddress = deployments.getContractAddress("Ledger") || "";
            config.contracts.sideChain.shopAddress = deployments.getContractAddress("Shop") || "";
            config.contracts.sideChain.loyaltyProviderAddress = deployments.getContractAddress("LoyaltyProvider") || "";
            config.contracts.sideChain.loyaltyConsumerAddress = deployments.getContractAddress("LoyaltyConsumer") || "";
            config.contracts.sideChain.loyaltyExchangerAddress =
                deployments.getContractAddress("LoyaltyExchanger") || "";
            config.contracts.sideChain.loyaltyTransferAddress = deployments.getContractAddress("LoyaltyTransfer") || "";
            config.contracts.sideChain.loyaltyBridgeAddress = deployments.getContractAddress("LoyaltyBridge") || "";
            config.contracts.sideChain.bridgeMainSideAddress = deployments.getContractAddress("SideChainBridge") || "";

            config.contracts.mainChain.tokenAddress = deployments.getContractAddress("MainChainKIOS") || "";
            config.contracts.mainChain.loyaltyBridgeAddress =
                deployments.getContractAddress("MainChainLoyaltyBridge") || "";
            config.contracts.mainChain.bridgeMainSideAddress = deployments.getContractAddress("MainChainBridge") || "";

            config.relay.managerKeys = deployments.accounts.certifiers.map((m) => m.privateKey);
            config.relay.callbackEndpoint = "http://127.0.0.1:3400/callback";
            config.relay.relayEndpoint = `http://127.0.0.1:${config.server.port}`;

            client = new TestClient({
                headers: {
                    Authorization: config.relay.accessKey,
                },
            });
        });

        before("Create TestServer", async () => {
            serverURL = new URL(`http://127.0.0.1:${config.server.port}`);
            storage = await RelayStorage.make(config.database);
            const graph = await GraphStorage.make(config.graph);
            const schedulers: Scheduler[] = [];
            schedulers.push(new WatchScheduler("*/1 * * * * *"));
            await contractManager.attach();
            server = new TestServer(config, contractManager, storage, graph, schedulers);
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
                const message = ContractUtils.getShopAccountMessage(
                    elem.shopId,
                    elem.wallet.address,
                    nonce,
                    contractManager.sideChainId
                );
                const signature = await ContractUtils.signMessage(elem.wallet, message);

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
                const message = ContractUtils.getShopAccountMessage(
                    responseItem.data.data.shopId,
                    shopData[0].wallet.address,
                    nonce,
                    contractManager.sideChainId
                );
                const signature = await ContractUtils.signMessage(shopData[0].wallet, message);

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
                const message = ContractUtils.getShopAccountMessage(
                    responseItem.data.data.shopId,
                    shopData[0].wallet.address,
                    nonce,
                    contractManager.sideChainId
                );
                const signature = await ContractUtils.signMessage(shopData[0].wallet, message);

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

        context("Shop delegator", () => {
            let delegator: string;
            it("Endpoint POST /v1/shop/account/delegator/create", async () => {
                const url = URI(serverURL).directory("/v1/shop/account/delegator").filename("create").toString();

                const nonce = await shopContract.nonceOf(shopData[0].wallet.address);
                const message = ContractUtils.getShopAccountMessage(
                    shopData[0].shopId,
                    shopData[0].wallet.address,
                    nonce,
                    contractManager.sideChainId
                );
                const signature = await ContractUtils.signMessage(shopData[0].wallet, message);
                const params = {
                    shopId: shopData[0].shopId,
                    account: shopData[0].wallet.address,
                    signature,
                };
                const response = await client.post(url, params);

                assert.deepStrictEqual(response.data.code, 0);
                assert.ok(response.data.data !== undefined);

                delegator = response.data.data.delegator;
            });

            it("Endpoint POST /v1/shop/account/delegator/save", async () => {
                const url = URI(serverURL).directory("/v1/shop/account/delegator").filename("save").toString();

                const nonce = await shopContract.nonceOf(shopData[0].wallet.address);
                const message = ContractUtils.getShopDelegatorAccountMessage(
                    shopData[0].shopId,
                    delegator,
                    shopData[0].wallet.address,
                    nonce,
                    contractManager.sideChainId
                );
                const signature = await ContractUtils.signMessage(shopData[0].wallet, message);
                const params = {
                    shopId: shopData[0].shopId,
                    delegator,
                    account: shopData[0].wallet.address,
                    signature,
                };
                const response = await client.post(url, params);

                assert.deepStrictEqual(response.data.code, 0);
                assert.ok(response.data.data !== undefined);
            });

            it("Check delegator", async () => {
                const shop = await shopContract.shopOf(shopData[0].shopId);
                expect(shop.delegator).to.deep.equal(delegator);
            });
        });
    });
});
