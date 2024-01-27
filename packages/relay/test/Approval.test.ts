import { Amount } from "../src/common/Amount";
import { Config } from "../src/common/Config";
import { ApprovalScheduler } from "../src/scheduler/ApprovalScheduler";
import { Scheduler } from "../src/scheduler/Scheduler";
import { WatchScheduler } from "../src/scheduler/WatchScheduler";
import { GraphStorage } from "../src/storage/GraphStorage";
import { RelayStorage } from "../src/storage/RelayStorage";
import {
    ContractLoyaltyType,
    ContractShopStatus,
    IShopData,
    IUserData,
    LoyaltyPaymentTaskStatus,
    ShopTaskStatus,
    TaskResultType,
} from "../src/types";
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

import chai, { expect } from "chai";
import { solidity } from "ethereum-waffle";

import { Wallet } from "ethers";
import { ethers } from "hardhat";

import { Deployments } from "./helper/Deployments";
import { FakerCallbackServer } from "./helper/FakerCallbackServer";
import { getPurchaseId, TestClient, TestServer } from "./helper/Utility";

import * as assert from "assert";
import * as fs from "fs";
import * as path from "path";
import { URL } from "url";

// tslint:disable-next-line:no-var-requires
const URI = require("urijs");

chai.use(solidity);

describe("Test of Server", function () {
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

    const amount = Amount.make(20_000, 18);

    const client = new TestClient();
    let storage: RelayStorage;
    let server: TestServer;
    let serverURL: URL;
    let config: Config;

    let fakerCallbackServer: FakerCallbackServer;

    const userData: IUserData[] = [];
    const shopData: IShopData[] = [];

    interface IPurchaseData {
        purchaseId: string;
        amount: number;
        providePercent: number;
        currency: string;
        userIndex: number;
        shopIndex: number;
    }

    context("Test auto approval", () => {
        before("Load User & Shop", async () => {
            const users = JSON.parse(fs.readFileSync("./src/data/users.json", "utf8")) as IUserData[];
            const userIdx = Math.floor(Math.random() * users.length);
            userData.push(users[userIdx]);

            const shops = JSON.parse(fs.readFileSync("./src/data/shops.json", "utf8")) as IShopData[];
            const shopIdx = Math.floor(Math.random() * shops.length);
            shopData.push(shops[shopIdx]);
        });

        before("Transfer native token", async () => {
            for (const user of userData) {
                await deployments.accounts.deployer.sendTransaction({
                    to: user.address,
                    value: Amount.make("100").value,
                });
            }
            for (const shop of shopData) {
                await deployments.accounts.deployer.sendTransaction({
                    to: shop.address,
                    value: Amount.make("100").value,
                });
            }
        });

        before("Deploy", async () => {
            deployments.setShopData(
                shopData.map((m) => {
                    return {
                        shopId: m.shopId,
                        name: m.name,
                        currency: m.currency,
                        wallet: new Wallet(m.privateKey, ethers.provider),
                    };
                })
            );
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
            config.relay.approvalSecond = 2;
            config.relay.callbackEndpoint = "http://127.0.0.1:3400/callback";
        });

        before("Create TestServer", async () => {
            serverURL = new URL(`http://127.0.0.1:${config.server.port}`);
            console.log(`serverURL: ${serverURL}`);
            storage = await RelayStorage.make(config.database);
            const graph = await GraphStorage.make(config.graph);

            const schedulers: Scheduler[] = [];
            schedulers.push(new ApprovalScheduler("*/1 * * * * *"));
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

        it("Transfer token", async () => {
            for (const account of userData) {
                await tokenContract.connect(deployments.accounts.owner).transfer(account.address, amount.value);
            }

            for (const account of shopData) {
                await tokenContract.connect(deployments.accounts.owner).transfer(account.address, amount.value);
            }
        });

        it("Change loyalty type", async () => {
            for (const user of userData) {
                const nonce = await ledgerContract.nonceOf(user.address);
                const signature = await ContractUtils.signLoyaltyType(new Wallet(user.privateKey), nonce);
                const url = URI(serverURL).directory("v1/ledger").filename("changeToLoyaltyToken").toString();
                const response = await client.post(url, {
                    account: user.address,
                    signature,
                });

                expect(response.data.code).to.equal(0);
                expect(response.data.data).to.not.equal(undefined);
                expect(response.data.data.txHash).to.match(/^0x[A-Fa-f0-9]{64}$/i);
            }
        });

        it("Deposit token", async () => {
            const depositAmount = ContractUtils.zeroGWEI(amount.value.div(2));
            for (const user of userData) {
                const sender = new Wallet(user.privateKey, ethers.provider);
                await tokenContract.connect(sender).approve(ledgerContract.address, depositAmount);
                await ledgerContract.connect(sender).deposit(depositAmount);
            }
        });

        context("Test of payment", async () => {
            const purchase: IPurchaseData = {
                purchaseId: getPurchaseId(),
                amount: 1000,
                providePercent: 10,
                currency: "krw",
                shopIndex: 0,
                userIndex: 0,
            };
            const purchaseAmount = Amount.make(purchase.amount, 18).value;

            let paymentId: string;
            it("Open New Payment", async () => {
                const url = URI(serverURL).directory("/v1/payment/new").filename("open").toString();

                const params = {
                    accessKey: config.relay.accessKey,
                    purchaseId: purchase.purchaseId,
                    amount: purchaseAmount.toString(),
                    currency: "krw",
                    shopId: shopData[purchase.shopIndex].shopId,
                    account: userData[purchase.userIndex].address,
                };
                const response = await client.post(url, params);

                assert.deepStrictEqual(response.data.code, 0, response.data?.error?.message);
                assert.ok(response.data.data !== undefined);

                assert.deepStrictEqual(response.data.data.account, userData[purchase.userIndex].address);
                assert.deepStrictEqual(response.data.data.loyaltyType, ContractLoyaltyType.TOKEN);
                assert.deepStrictEqual(response.data.data.paymentStatus, LoyaltyPaymentTaskStatus.OPENED_NEW);

                paymentId = response.data.data.paymentId;
            });

            it("...Waiting", async () => {
                const t1 = ContractUtils.getTimeStamp();
                while (true) {
                    const responseItem = await client.get(
                        URI(serverURL).directory("/v1/payment/item").addQuery("paymentId", paymentId).toString()
                    );
                    if (responseItem.data.data.paymentStatus === LoyaltyPaymentTaskStatus.REPLY_COMPLETED_NEW) break;
                    else if (ContractUtils.getTimeStamp() - t1 > 60) break;
                    await ContractUtils.delay(1000);
                }
            });

            it("...Check Payment Status - REPLY_COMPLETED_NEW", async () => {
                const response = await client.get(
                    URI(serverURL).directory("/v1/payment/item").addQuery("paymentId", paymentId).toString()
                );
                assert.deepStrictEqual(response.data.data.paymentStatus, LoyaltyPaymentTaskStatus.REPLY_COMPLETED_NEW);
            });

            it("Close New Payment", async () => {
                const response = await client.post(
                    URI(serverURL).directory("/v1/payment/new").filename("close").toString(),
                    {
                        accessKey: config.relay.accessKey,
                        confirm: true,
                        paymentId,
                    }
                );

                assert.deepStrictEqual(response.data.code, 0);
                assert.ok(response.data.data !== undefined);
                assert.deepStrictEqual(response.data.data.paymentStatus, LoyaltyPaymentTaskStatus.CLOSED_NEW);
            });

            it("Open Cancel Payment", async () => {
                const url = URI(serverURL).directory("/v1/payment/cancel").filename("open").toString();

                const params = {
                    accessKey: config.relay.accessKey,
                    paymentId,
                };
                const response = await client.post(url, params);

                assert.deepStrictEqual(response.data.code, 0);
                assert.ok(response.data.data !== undefined);

                assert.deepStrictEqual(response.data.data.paymentId, paymentId);
                assert.deepStrictEqual(response.data.data.purchaseId, purchase.purchaseId);
                assert.deepStrictEqual(response.data.data.account, userData[purchase.userIndex].address);
                assert.deepStrictEqual(response.data.data.loyaltyType, ContractLoyaltyType.TOKEN);
                assert.deepStrictEqual(response.data.data.paymentStatus, LoyaltyPaymentTaskStatus.OPENED_CANCEL);
            });

            it("...Waiting", async () => {
                const t1 = ContractUtils.getTimeStamp();
                while (true) {
                    const responseItem = await client.get(
                        URI(serverURL).directory("/v1/payment/item").addQuery("paymentId", paymentId).toString()
                    );
                    if (responseItem.data.data.paymentStatus === LoyaltyPaymentTaskStatus.REPLY_COMPLETED_CANCEL) break;
                    else if (ContractUtils.getTimeStamp() - t1 > 60) break;
                    await ContractUtils.delay(1000);
                }
            });

            it("...Check Payment Status - REPLY_COMPLETED_CANCEL", async () => {
                const response = await client.get(
                    URI(serverURL).directory("/v1/payment/item").addQuery("paymentId", paymentId).toString()
                );
                assert.deepStrictEqual(
                    response.data.data.paymentStatus,
                    LoyaltyPaymentTaskStatus.REPLY_COMPLETED_CANCEL
                );
            });

            it("Close Cancel Payment", async () => {
                const response = await client.post(
                    URI(serverURL).directory("/v1/payment/cancel").filename("close").toString(),
                    {
                        accessKey: config.relay.accessKey,
                        confirm: true,
                        paymentId,
                    }
                );

                assert.deepStrictEqual(response.data.code, 0);
                assert.ok(response.data.data !== undefined);

                assert.deepStrictEqual(response.data.data.paymentStatus, LoyaltyPaymentTaskStatus.CLOSED_CANCEL);
            });
        });

        context("Test of shop update", async () => {
            let taskId: string;
            it("Create New Task for updating shop's information", async () => {
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

            it("...Check Shop Task Status - COMPLETED", async () => {
                const url = URI(serverURL).directory("/v1/shop/task").addQuery("taskId", taskId).toString();
                const response = await client.get(url);
                assert.deepStrictEqual(response.data.code, 0);
                assert.ok(response.data.data !== undefined);
                assert.deepStrictEqual(response.data.data.taskStatus, ShopTaskStatus.COMPLETED);
            });

            it("...Waiting", async () => {
                await ContractUtils.delay(2000);
            });
        });

        context("Test of shop status", async () => {
            let taskId: string;
            it("Create New Task for updating shop's status", async () => {
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

            it("...Check Shop Task Status - COMPLETED", async () => {
                const url = URI(serverURL).directory("/v1/shop/task").addQuery("taskId", taskId).toString();
                const response = await client.get(url);
                assert.deepStrictEqual(response.data.code, 0);
                assert.ok(response.data.data !== undefined);
                assert.deepStrictEqual(response.data.data.type, TaskResultType.STATUS);
                assert.deepStrictEqual(response.data.data.taskStatus, ShopTaskStatus.COMPLETED);
            });

            it("...Waiting", async () => {
                await ContractUtils.delay(2000);
            });
        });
    });
});
