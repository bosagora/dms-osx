import { Amount } from "../src/common/Amount";
import { Config } from "../src/common/Config";
import { GraphStorage } from "../src/storage/GraphStorage";
import { RelayStorage } from "../src/storage/RelayStorage";
import { ContractUtils } from "../src/utils/ContractUtils";
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

import chai, { expect } from "chai";
import { solidity } from "ethereum-waffle";

import { Wallet } from "ethers";

import { ApprovalScheduler } from "../src/scheduler/ApprovalScheduler";
import { CloseScheduler } from "../src/scheduler/CloseScheduler";
import { Scheduler } from "../src/scheduler/Scheduler";
import { WatchScheduler } from "../src/scheduler/WatchScheduler";
import { ContractLoyaltyType, IShopData, IUserData, LoyaltyPaymentTaskStatus } from "../src/types";

import { Deployments } from "./helper/Deployments";
import { FakerCallbackServer } from "./helper/FakerCallbackServer";
import { getPurchaseId, TestClient, TestServer } from "./helper/Utility";

import * as assert from "assert";
import * as fs from "fs";
import { ethers } from "hardhat";
import * as path from "path";
import { URL } from "url";

// tslint:disable-next-line:no-var-requires
const URI = require("urijs");

chai.use(solidity);

describe("Test of Server", function () {
    this.timeout(1000 * 60 * 5);
    const deployments = new Deployments();

    let validatorContract: Validator;
    let tokenContract: BIP20DelegatedTransfer;
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

    context("Test forced close 1", () => {
        before("Load User & Shop", async () => {
            const users = JSON.parse(fs.readFileSync("./src/data/users.json", "utf8")) as IUserData[];
            const userIdx = Math.floor(Math.random() * users.length);
            while (userData.length > 0) userData.pop();
            userData.push(users[userIdx]);

            const shops = JSON.parse(fs.readFileSync("./src/data/shops.json", "utf8")) as IShopData[];
            const shopIdx = Math.floor(Math.random() * shops.length);
            while (shopData.length > 0) shopData.pop();
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
            config.relay.forcedCloseSecond = 5;
            config.relay.paymentTimeoutSecond = 2;
            config.relay.callbackEndpoint = "http://127.0.0.1:3400/callback";
            config.relay.relayEndpoint = `http://127.0.0.1:${config.server.port}`;
        });

        before("Create TestServer", async () => {
            serverURL = new URL(`http://127.0.0.1:${config.server.port}`);
            storage = await RelayStorage.make(config.database);

            const schedulers: Scheduler[] = [];
            schedulers.push(new CloseScheduler("*/1 * * * * *"));
            schedulers.push(new WatchScheduler("*/1 * * * * *"));
            const graph = await GraphStorage.make(config.graph);
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

            it("...Waiting for FAILED_NEW", async () => {
                const t1 = ContractUtils.getTimeStamp();
                while (true) {
                    const responseItem = await client.get(
                        URI(serverURL).directory("/v1/payment/item").addQuery("paymentId", paymentId).toString()
                    );
                    if (responseItem.data.data.paymentStatus === LoyaltyPaymentTaskStatus.FAILED_NEW) break;
                    else if (ContractUtils.getTimeStamp() - t1 > 60) break;
                    await ContractUtils.delay(2000);
                }
            });

            it("...Check Payment Status - FAILED_NEW", async () => {
                const response = await client.get(
                    URI(serverURL).directory("/v1/payment/item").addQuery("paymentId", paymentId).toString()
                );
                assert.deepStrictEqual(response.data.data.paymentStatus, LoyaltyPaymentTaskStatus.FAILED_NEW);
            });
        });
    });

    context("Test forced close 2", () => {
        before("Load User & Shop", async () => {
            const users = JSON.parse(fs.readFileSync("./src/data/users.json", "utf8")) as IUserData[];
            const userIdx = Math.floor(Math.random() * users.length);
            while (userData.length > 0) userData.pop();
            userData.push(users[userIdx]);

            const shops = JSON.parse(fs.readFileSync("./src/data/shops.json", "utf8")) as IShopData[];
            const shopIdx = Math.floor(Math.random() * shops.length);
            while (shopData.length > 0) shopData.pop();
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
            config.relay.forcedCloseSecond = 5;
            config.relay.callbackEndpoint = "http://127.0.0.1:3400/callback";
            config.relay.relayEndpoint = `http://127.0.0.1:${config.server.port}`;
        });

        before("Create TestServer", async () => {
            serverURL = new URL(`http://127.0.0.1:${config.server.port}`);
            storage = await RelayStorage.make(config.database);

            const schedulers: Scheduler[] = [];
            schedulers.push(new ApprovalScheduler("*/1 * * * * *"));
            schedulers.push(new CloseScheduler("*/1 * * * * *"));
            schedulers.push(new WatchScheduler("*/1 * * * * *"));
            const graph = await GraphStorage.make(config.graph);
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

            it("...Waiting for REPLY_COMPLETED_NEW", async () => {
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

            it("Close New Payment", async () => {
                const url = URI(serverURL).directory("/v1/payment/new").filename("close").toString();
                const params = {
                    accessKey: config.relay.accessKey,
                    confirm: true,
                    paymentId,
                };
                const response = await client.post(url, params);
                assert.deepStrictEqual(response.data.code, 0, response.data?.error?.message);
                assert.ok(response.data.data !== undefined);
                assert.deepStrictEqual(response.data.data.paymentStatus, LoyaltyPaymentTaskStatus.CLOSED_NEW);
            });

            it("...Waiting", async () => {
                await ContractUtils.delay(3000);
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

            it("...Waiting for REPLY_COMPLETED_CANCEL", async () => {
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

            it("...Waiting for FAILED_CANCEL", async () => {
                const t1 = ContractUtils.getTimeStamp();
                while (true) {
                    const responseItem = await client.get(
                        URI(serverURL).directory("/v1/payment/item").addQuery("paymentId", paymentId).toString()
                    );
                    if (responseItem.data.data.paymentStatus === LoyaltyPaymentTaskStatus.FAILED_CANCEL) break;
                    else if (ContractUtils.getTimeStamp() - t1 > 60) break;
                    await ContractUtils.delay(1000);
                }
            });

            it("...Check Payment Status - FAILED_CANCEL", async () => {
                const response = await client.get(
                    URI(serverURL).directory("/v1/payment/item").addQuery("paymentId", paymentId).toString()
                );
                assert.deepStrictEqual(response.data.data.paymentStatus, LoyaltyPaymentTaskStatus.FAILED_CANCEL);
            });
        });
    });
});
