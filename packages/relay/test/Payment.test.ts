import "@nomiclabs/hardhat-ethers";
import "@nomiclabs/hardhat-waffle";

import { Amount } from "../src/common/Amount";
import { Config } from "../src/common/Config";
import { ContractManager } from "../src/contract/ContractManager";
import { INotificationEventHandler } from "../src/delegator/NotificationSender";
import { Scheduler } from "../src/scheduler/Scheduler";
import { WatchScheduler } from "../src/scheduler/WatchScheduler";
import { GraphStorage } from "../src/storage/GraphStorage";
import { RelayStorage } from "../src/storage/RelayStorage";
import { LoyaltyPaymentTaskStatus } from "../src/types";
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
import { getPurchaseId, TestClient, TestServer } from "./helper/Utility";

import chai, { expect } from "chai";
import { solidity } from "ethereum-waffle";

import * as assert from "assert";
import { BigNumber, Wallet } from "ethers";
import * as path from "path";
import { URL } from "url";

// tslint:disable-next-line:no-implicit-dependencies
import { AddressZero } from "@ethersproject/constants";

// tslint:disable-next-line:no-var-requires
const URI = require("urijs");

chai.use(solidity);

describe("Test of Server", function () {
    this.timeout(1000 * 60 * 5);

    const config = new Config();
    config.readFromFile(path.resolve(process.cwd(), "config", "config_test.yaml"));
    const contractManager = new ContractManager(config);
    const deployments = new Deployments(config);

    const users = deployments.accounts.users;
    const shops = deployments.accounts.shops;
    const validators = deployments.accounts.validators;

    let validatorContract: Validator;
    let tokenContract: BIP20DelegatedTransfer;
    let linkContract: PhoneLinkCollection;
    let currencyRateContract: CurrencyRate;
    let shopContract: Shop;
    let consumerContract: LoyaltyConsumer;
    let providerContract: LoyaltyProvider;
    let exchangerContract: LoyaltyExchanger;
    let ledgerContract: Ledger;

    const multiple = BigNumber.from(1000000000);
    const price = BigNumber.from(150).mul(multiple);

    const expression = "*/1 * * * * *";

    let client: TestClient;
    let storage: RelayStorage;
    let server: TestServer;
    let serverURL: URL;

    let fakerCallbackServer: FakerCallbackServer;

    interface IShopData {
        shopId: string;
        name: string;
        currency: string;
        wallet: Wallet;
    }

    const shopData: IShopData[] = [
        {
            shopId: "F000100",
            name: "Shop1",
            currency: "krw",
            wallet: shops[0],
        },
        {
            shopId: "F000200",
            name: "Shop2",
            currency: "krw",
            wallet: shops[1],
        },
        {
            shopId: "F000300",
            name: "Shop3",
            currency: "krw",
            wallet: shops[2],
        },
        {
            shopId: "F000400",
            name: "Shop4",
            currency: "krw",
            wallet: shops[3],
        },
        {
            shopId: "F000500",
            name: "Shop5",
            currency: "krw",
            wallet: shops[4],
        },
    ];

    interface IUserData {
        phone: string;
        wallet: Wallet;
        address: string;
        privateKey: string;
    }

    const userData: IUserData[] = [
        {
            phone: "08201012341001",
            wallet: users[0],
            address: users[0].address,
            privateKey: users[0].privateKey,
        },
        {
            phone: "08201012341002",
            wallet: users[1],
            address: users[1].address,
            privateKey: users[1].privateKey,
        },
        {
            phone: "08201012341003",
            wallet: users[2],
            address: users[2].address,
            privateKey: users[2].privateKey,
        },
    ];

    interface IPurchaseData {
        purchaseId: string;
        amount: number;
        providePercent: number;
        currency: string;
        userIndex: number;
        shopIndex: number;
    }

    context("Test point relay endpoints", () => {
        before("Set Shop ID", async () => {
            for (const elem of shopData) {
                elem.shopId = ContractUtils.getShopId(elem.wallet.address, LoyaltyNetworkID.LYT);
            }
        });

        before("Deploy", async () => {
            deployments.setShopData(shopData);
            await deployments.doDeploy();

            validatorContract = deployments.getContract("Validator") as Validator;
            tokenContract = deployments.getContract("TestLYT") as BIP20DelegatedTransfer;
            ledgerContract = deployments.getContract("Ledger") as Ledger;
            linkContract = deployments.getContract("PhoneLinkCollection") as PhoneLinkCollection;
            consumerContract = deployments.getContract("LoyaltyConsumer") as LoyaltyConsumer;
            providerContract = deployments.getContract("LoyaltyProvider") as LoyaltyProvider;
            exchangerContract = deployments.getContract("LoyaltyExchanger") as LoyaltyExchanger;
            currencyRateContract = deployments.getContract("CurrencyRate") as CurrencyRate;
            shopContract = deployments.getContract("Shop") as Shop;
        });

        before("Create Config", async () => {
            config.contracts.sideChain.tokenAddress = deployments.getContractAddress("TestLYT") || "";
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
            config.contracts.sideChain.chainBridgeAddress = deployments.getContractAddress("SideChainBridge") || "";

            config.contracts.mainChain.tokenAddress = deployments.getContractAddress("MainChainKIOS") || "";
            config.contracts.mainChain.loyaltyBridgeAddress =
                deployments.getContractAddress("MainChainLoyaltyBridge") || "";
            config.contracts.mainChain.chainBridgeAddress = deployments.getContractAddress("MainChainBridge") || "";

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

            const schedulers: Scheduler[] = [];
            schedulers.push(new WatchScheduler(expression));
            const graph_sidechain = await GraphStorage.make(config.graph_sidechain);
            const graph_mainchain = await GraphStorage.make(config.graph_mainchain);
            await contractManager.attach();
            server = new TestServer(config, contractManager, storage, graph_sidechain, graph_mainchain, schedulers);
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

        context("Test of Loyalty Point", () => {
            const purchase: IPurchaseData = {
                purchaseId: getPurchaseId(),
                amount: 10000,
                providePercent: 10,
                currency: "krw",
                shopIndex: 1,
                userIndex: 0,
            };

            const purchaseAmount = Amount.make(purchase.amount, 18).value;
            const shop = shopData[purchase.shopIndex];
            const pointAmount = ContractUtils.zeroGWEI(purchaseAmount.mul(purchase.providePercent).div(100));

            const purchaseOfLoyalty: IPurchaseData = {
                purchaseId: getPurchaseId(),
                amount: 10,
                providePercent: 10,
                currency: "krw",
                shopIndex: 1,
                userIndex: 0,
            };
            const amountOfLoyalty = Amount.make(purchaseOfLoyalty.amount, 18).value;

            it("Save Purchase Data", async () => {
                const phoneHash = ContractUtils.getPhoneHash(userData[purchase.userIndex].phone);
                const userAccount =
                    userData[purchase.userIndex].address.trim() !== ""
                        ? userData[purchase.userIndex].address.trim()
                        : AddressZero;
                const purchaseParam = {
                    purchaseId: purchase.purchaseId,
                    amount: purchaseAmount,
                    loyalty: pointAmount,
                    currency: purchase.currency.toLowerCase(),
                    shopId: shop.shopId,
                    account: userAccount,
                    phone: phoneHash,
                    sender: deployments.accounts.foundation.address,
                };
                const purchaseMessage = ContractUtils.getPurchasesMessage(
                    0,
                    [purchaseParam],
                    contractManager.sideChainId
                );
                const signatures = await Promise.all(
                    deployments.accounts.validators.map((m) => ContractUtils.signMessage(m, purchaseMessage))
                );
                const proposeMessage = ContractUtils.getPurchasesProposeMessage(
                    0,
                    [purchaseParam],
                    signatures,
                    contractManager.sideChainId
                );
                const proposerSignature = await ContractUtils.signMessage(
                    deployments.accounts.validators[0],
                    proposeMessage
                );
                await expect(
                    providerContract
                        .connect(deployments.accounts.certifiers[0])
                        .savePurchase(0, [purchaseParam], signatures, proposerSignature)
                )
                    .to.emit(providerContract, "SavedPurchase")
                    .withNamedArgs({
                        purchaseId: purchase.purchaseId,
                        amount: purchaseAmount,
                        loyalty: pointAmount,
                        currency: purchase.currency.toLowerCase(),
                        shopId: shop.shopId,
                        account: userAccount,
                        phone: phoneHash,
                    })
                    .emit(ledgerContract, "ProvidedPoint")
                    .withNamedArgs({
                        account: userAccount,
                        providedPoint: pointAmount,
                        providedValue: pointAmount,
                        purchaseId: purchase.purchaseId,
                        shopId: shop.shopId,
                    });
            });

            it("Get user's balance", async () => {
                const url = URI(serverURL)
                    .directory("/v1/ledger/balance/account")
                    .filename(users[purchase.userIndex].address)
                    .toString();
                const response = await client.get(url);

                assert.deepStrictEqual(response.data.code, 0);
                assert.ok(response.data.data !== undefined);
                assert.deepStrictEqual(response.data.data.point.balance, pointAmount.toString());
            });

            it("Endpoint POST /v1/payment/info", async () => {
                const amount2 = Amount.make(1, 18).value;
                const url = URI(serverURL)
                    .directory("/v1/payment/info")
                    .addQuery("account", users[purchase.userIndex].address)
                    .addQuery("amount", amount2.toString())
                    .addQuery("currency", "USD")
                    .toString();
                const response = await client.get(url);

                assert.deepStrictEqual(response.data.code, 0);
                assert.ok(response.data.data !== undefined);

                assert.deepStrictEqual(response.data.data.account, users[purchase.userIndex].address);
                assert.deepStrictEqual(response.data.data.balance, pointAmount.toString());
                assert.deepStrictEqual(response.data.data.paidPoint, Amount.make(1000).toString());
                assert.deepStrictEqual(response.data.data.feePoint, Amount.make(50).toString());
                assert.deepStrictEqual(response.data.data.totalPoint, Amount.make(1050).toString());
                assert.deepStrictEqual(response.data.data.amount, Amount.make(1).toString());
                assert.deepStrictEqual(response.data.data.currency, "usd");
                assert.deepStrictEqual(response.data.data.feeRate, 0.05);
            });

            let paymentId: string;
            it("Endpoint POST /v1/payment/new/open", async () => {
                const url = URI(serverURL).directory("/v1/payment/new").filename("open").toString();

                const params = {
                    purchaseId: purchaseOfLoyalty.purchaseId,
                    amount: amountOfLoyalty.toString(),
                    currency: "krw",
                    shopId: shopData[purchaseOfLoyalty.shopIndex].shopId,
                    account: users[purchaseOfLoyalty.userIndex].address,
                };
                const response = await client.post(url, params);

                assert.deepStrictEqual(response.data.code, 0);
                assert.ok(response.data.data !== undefined);

                assert.deepStrictEqual(response.data.data.account, users[purchase.userIndex].address);

                paymentId = response.data.data.paymentId;
            });

            it("Endpoint POST /v1/payment/item", async () => {
                const url = URI(serverURL).directory("/v1/payment/item").addQuery("paymentId", paymentId).toString();
                const response = await client.get(url);

                assert.deepStrictEqual(response.data.code, 0);
                assert.ok(response.data.data !== undefined);

                assert.deepStrictEqual(response.data.data.paymentId, paymentId);
                assert.deepStrictEqual(response.data.data.account, users[purchase.userIndex].address);
                assert.deepStrictEqual(response.data.data.amount, amountOfLoyalty.toString());
            });

            it("Endpoint POST /v1/payment/new/approval - deny", async () => {
                const responseItem = await client.get(
                    URI(serverURL).directory("/v1/payment/item").addQuery("paymentId", paymentId).toString()
                );

                const nonce = await ledgerContract.nonceOf(users[purchaseOfLoyalty.userIndex].address);
                const signature = await ContractUtils.signLoyaltyNewPayment(
                    users[purchaseOfLoyalty.userIndex],
                    paymentId,
                    responseItem.data.data.purchaseId,
                    responseItem.data.data.amount,
                    responseItem.data.data.currency,
                    responseItem.data.data.shopId,
                    nonce,
                    contractManager.sideChainId
                );

                const response = await client.post(
                    URI(serverURL).directory("/v1/payment/new").filename("approval").toString(),
                    {
                        paymentId,
                        approval: false,
                        signature,
                    }
                );

                assert.deepStrictEqual(response.data.code, 0);
                assert.ok(response.data.data !== undefined);
                assert.deepStrictEqual(response.data.data.paymentStatus, LoyaltyPaymentTaskStatus.DENIED_NEW);
            });

            it("Waiting", async () => {
                await ContractUtils.delay(2000);
                assert.deepStrictEqual(fakerCallbackServer.responseData.length, 1);
                assert.deepStrictEqual(fakerCallbackServer.responseData[0].code, 4000);
            });

            it("Endpoint POST /v1/payment/new/approval", async () => {
                const responseItem = await client.get(
                    URI(serverURL).directory("/v1/payment/item").addQuery("paymentId", paymentId).toString()
                );
                const nonce = await ledgerContract.nonceOf(users[purchaseOfLoyalty.userIndex].address);
                const signature = await ContractUtils.signLoyaltyNewPayment(
                    users[purchaseOfLoyalty.userIndex],
                    paymentId,
                    responseItem.data.data.purchaseId,
                    responseItem.data.data.amount,
                    responseItem.data.data.currency,
                    responseItem.data.data.shopId,
                    nonce,
                    contractManager.sideChainId
                );

                const response = await client.post(
                    URI(serverURL).directory("/v1/payment/new").filename("approval").toString(),
                    {
                        paymentId,
                        approval: true,
                        signature,
                    }
                );

                assert.deepStrictEqual(response.data.code, 2020);
                assert.ok(response.data.data === undefined);
                assert.ok(response.data.error !== undefined);
                assert.ok(response.data.error.message === "The status code for this payment cannot be approved");
            });

            it("Endpoint POST /v1/payment/new/open", async () => {
                const url = URI(serverURL).directory("/v1/payment/new").filename("open").toString();

                const params = {
                    purchaseId: purchaseOfLoyalty.purchaseId,
                    amount: amountOfLoyalty.toString(),
                    currency: "krw",
                    shopId: shopData[purchaseOfLoyalty.shopIndex].shopId,
                    account: users[purchaseOfLoyalty.userIndex].address,
                };
                const response = await client.post(url, params);

                assert.deepStrictEqual(response.data.code, 0);
                assert.ok(response.data.data !== undefined);

                assert.deepStrictEqual(response.data.data.account, users[purchase.userIndex].address);

                paymentId = response.data.data.paymentId;
            });

            it("Endpoint POST /v1/payment/new/approval - wrong ID", async () => {
                const responseItem = await client.get(
                    URI(serverURL).directory("/v1/payment/item").addQuery("paymentId", paymentId).toString()
                );
                const nonce = await ledgerContract.nonceOf(users[purchaseOfLoyalty.userIndex].address);
                const wrongPaymentId = ContractUtils.getPaymentId(users[purchaseOfLoyalty.userIndex].address, nonce);
                const signature = await ContractUtils.signLoyaltyNewPayment(
                    users[purchaseOfLoyalty.userIndex],
                    wrongPaymentId,
                    responseItem.data.data.purchaseId,
                    responseItem.data.data.amount,
                    responseItem.data.data.currency,
                    responseItem.data.data.shopId,
                    nonce,
                    contractManager.sideChainId
                );

                const response = await client.post(
                    URI(serverURL).directory("/v1/payment/new").filename("approval").toString(),
                    {
                        paymentId: wrongPaymentId,
                        approval: true,
                        signature,
                    }
                );

                assert.deepStrictEqual(response.data.code, 2003);
                assert.ok(response.data.data === undefined);
                assert.ok(response.data.error !== undefined);
                assert.ok(response.data.error.message === "The payment ID is not exist");
            });

            it("Endpoint POST /v1/payment/new/approval - Wrong signature", async () => {
                const responseItem = await client.get(
                    URI(serverURL).directory("/v1/payment/item").addQuery("paymentId", paymentId).toString()
                );
                const nonce = await ledgerContract.nonceOf(users[purchaseOfLoyalty.userIndex].address);
                const signature = await ContractUtils.signLoyaltyNewPayment(
                    users[purchaseOfLoyalty.userIndex + 1],
                    paymentId,
                    responseItem.data.data.purchaseId,
                    responseItem.data.data.amount,
                    responseItem.data.data.currency,
                    responseItem.data.data.shopId,
                    nonce,
                    contractManager.sideChainId
                );

                const response = await client.post(
                    URI(serverURL).directory("/v1/payment/new").filename("approval").toString(),
                    {
                        paymentId,
                        approval: true,
                        signature,
                    }
                );

                assert.deepStrictEqual(response.data.code, 1501);
                assert.ok(response.data.data === undefined);
                assert.ok(response.data.error !== undefined);
                assert.ok(response.data.error.message === "Invalid signature");
            });

            it("Endpoint POST /v1/payment/new/approval", async () => {
                const responseItem = await client.get(
                    URI(serverURL).directory("/v1/payment/item").addQuery("paymentId", paymentId).toString()
                );
                const nonce = await ledgerContract.nonceOf(users[purchaseOfLoyalty.userIndex].address);
                const signature = await ContractUtils.signLoyaltyNewPayment(
                    users[purchaseOfLoyalty.userIndex],
                    paymentId,
                    responseItem.data.data.purchaseId,
                    responseItem.data.data.amount,
                    responseItem.data.data.currency,
                    responseItem.data.data.shopId,
                    nonce,
                    contractManager.sideChainId
                );

                const response = await client.post(
                    URI(serverURL).directory("/v1/payment/new").filename("approval").toString(),
                    {
                        paymentId,
                        approval: true,
                        signature,
                    }
                );

                assert.deepStrictEqual(response.data.code, 0);
                assert.ok(response.data.data !== undefined);
                assert.ok(response.data.data.txHash !== undefined);
                assert.deepStrictEqual(response.data.data.paymentStatus, LoyaltyPaymentTaskStatus.APPROVED_NEW_SENT_TX);
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

            it("Check Response", async () => {
                assert.deepStrictEqual(fakerCallbackServer.responseData.length, 2);
                assert.deepStrictEqual(fakerCallbackServer.responseData[1].code, 0);
            });

            it("Endpoint POST /v1/payment/new/approval", async () => {
                const responseItem = await client.get(
                    URI(serverURL).directory("/v1/payment/item").addQuery("paymentId", paymentId).toString()
                );
                const nonce = await ledgerContract.nonceOf(users[purchaseOfLoyalty.userIndex].address);
                const signature = await ContractUtils.signLoyaltyNewPayment(
                    users[purchaseOfLoyalty.userIndex],
                    paymentId,
                    responseItem.data.data.purchaseId,
                    responseItem.data.data.amount,
                    responseItem.data.data.currency,
                    responseItem.data.data.shopId,
                    nonce,
                    contractManager.sideChainId
                );
                const response = await client.post(
                    URI(serverURL).directory("/v1/payment/new").filename("approval").toString(),
                    {
                        paymentId,
                        approval: false,
                        signature,
                    }
                );

                assert.deepStrictEqual(response.data.code, 2020);
                assert.ok(response.data.data === undefined);
                assert.ok(response.data.error !== undefined);
                assert.ok(response.data.error.message === "The status code for this payment cannot be approved");
            });

            it("Endpoint POST /v1/payment/new/close", async () => {
                const response = await client.post(
                    URI(serverURL).directory("/v1/payment/new").filename("close").toString(),
                    {
                        confirm: true,
                        paymentId,
                    }
                );

                assert.deepStrictEqual(response.data.code, 0);
                assert.ok(response.data.data !== undefined);
                assert.deepStrictEqual(response.data.data.paymentStatus, LoyaltyPaymentTaskStatus.CLOSED_NEW);
            });
        });
    });

    context("Test point relay endpoints - Cancel Confirm", () => {
        before("Set Shop ID", async () => {
            for (const elem of shopData) {
                elem.shopId = ContractUtils.getShopId(elem.wallet.address, LoyaltyNetworkID.LYT);
            }
        });

        before("Deploy", async () => {
            deployments.setShopData(shopData);
            await deployments.doDeploy();

            validatorContract = deployments.getContract("Validator") as Validator;
            tokenContract = deployments.getContract("TestLYT") as BIP20DelegatedTransfer;
            ledgerContract = deployments.getContract("Ledger") as Ledger;
            linkContract = deployments.getContract("PhoneLinkCollection") as PhoneLinkCollection;
            consumerContract = deployments.getContract("LoyaltyConsumer") as LoyaltyConsumer;
            providerContract = deployments.getContract("LoyaltyProvider") as LoyaltyProvider;
            exchangerContract = deployments.getContract("LoyaltyExchanger") as LoyaltyExchanger;
            currencyRateContract = deployments.getContract("CurrencyRate") as CurrencyRate;
            shopContract = deployments.getContract("Shop") as Shop;
        });

        before("Create Config", async () => {
            config.contracts.sideChain.tokenAddress = deployments.getContractAddress("TestLYT") || "";
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
            config.contracts.sideChain.chainBridgeAddress = deployments.getContractAddress("SideChainBridge") || "";

            config.contracts.mainChain.tokenAddress = deployments.getContractAddress("MainChainKIOS") || "";
            config.contracts.mainChain.loyaltyBridgeAddress =
                deployments.getContractAddress("MainChainLoyaltyBridge") || "";
            config.contracts.mainChain.chainBridgeAddress = deployments.getContractAddress("MainChainBridge") || "";

            config.relay.managerKeys = deployments.accounts.certifiers.map((m) => m.privateKey);
            config.relay.callbackEndpoint = "http://127.0.0.1:3400/callback";
            config.relay.relayEndpoint = `http://127.0.0.1:${config.server.port}`;
        });

        before("Create TestServer", async () => {
            serverURL = new URL(`http://127.0.0.1:${config.server.port}`);
            storage = await RelayStorage.make(config.database);
            const graph_sidechain = await GraphStorage.make(config.graph_sidechain);
            const graph_mainchain = await GraphStorage.make(config.graph_mainchain);

            const schedulers: Scheduler[] = [];
            schedulers.push(new WatchScheduler(expression));
            await contractManager.attach();
            server = new TestServer(config, contractManager, storage, graph_sidechain, graph_mainchain, schedulers);
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

        context("Test of Loyalty Point", () => {
            const purchase: IPurchaseData = {
                purchaseId: getPurchaseId(),
                amount: 10000,
                providePercent: 10,
                currency: "krw",
                shopIndex: 1,
                userIndex: 0,
            };

            const purchaseAmount = Amount.make(purchase.amount, 18).value;
            const shop = shopData[purchase.shopIndex];
            const pointAmount = ContractUtils.zeroGWEI(purchaseAmount.mul(purchase.providePercent).div(100));

            const purchaseOfLoyalty: IPurchaseData = {
                purchaseId: getPurchaseId(),
                amount: 10,
                providePercent: 10,
                currency: "krw",
                shopIndex: 1,
                userIndex: 0,
            };
            const amountOfLoyalty = Amount.make(purchaseOfLoyalty.amount, 18).value;
            let totalPoint: BigNumber;

            it("Save Purchase Data", async () => {
                const phoneHash = ContractUtils.getPhoneHash(userData[purchase.userIndex].phone);
                const userAccount =
                    userData[purchase.userIndex].address.trim() !== ""
                        ? userData[purchase.userIndex].address.trim()
                        : AddressZero;
                const purchaseParam = {
                    purchaseId: purchase.purchaseId,
                    amount: purchaseAmount,
                    loyalty: pointAmount,
                    currency: purchase.currency.toLowerCase(),
                    shopId: shop.shopId,
                    account: userAccount,
                    phone: phoneHash,
                    sender: deployments.accounts.foundation.address,
                };
                const purchaseMessage = ContractUtils.getPurchasesMessage(
                    0,
                    [purchaseParam],
                    contractManager.sideChainId
                );
                const signatures = await Promise.all(
                    deployments.accounts.validators.map((m) => ContractUtils.signMessage(m, purchaseMessage))
                );
                const proposeMessage = ContractUtils.getPurchasesProposeMessage(
                    0,
                    [purchaseParam],
                    signatures,
                    contractManager.sideChainId
                );
                const proposerSignature = await ContractUtils.signMessage(
                    deployments.accounts.validators[0],
                    proposeMessage
                );
                await expect(
                    providerContract
                        .connect(deployments.accounts.certifiers[0])
                        .savePurchase(0, [purchaseParam], signatures, proposerSignature)
                )
                    .to.emit(providerContract, "SavedPurchase")
                    .withNamedArgs({
                        purchaseId: purchase.purchaseId,
                        amount: purchaseAmount,
                        loyalty: pointAmount,
                        currency: purchase.currency.toLowerCase(),
                        shopId: shop.shopId,
                        account: userAccount,
                        phone: phoneHash,
                    })
                    .emit(ledgerContract, "ProvidedPoint")
                    .withNamedArgs({
                        account: userAccount,
                        providedPoint: pointAmount,
                        providedValue: pointAmount,
                        purchaseId: purchase.purchaseId,
                        shopId: shop.shopId,
                    });
            });

            it("Get user's balance", async () => {
                const url = URI(serverURL)
                    .directory("/v1/ledger/balance/account")
                    .filename(users[purchase.userIndex].address)
                    .toString();
                const response = await client.get(url);

                assert.deepStrictEqual(response.data.code, 0);
                assert.ok(response.data.data !== undefined);
                assert.deepStrictEqual(response.data.data.point.balance, pointAmount.toString());
            });

            it("Endpoint POST /v1/payment/info", async () => {
                const amount2 = Amount.make(1, 18).value;
                const url = URI(serverURL)
                    .directory("/v1/payment/info")
                    .addQuery("account", users[purchase.userIndex].address)
                    .addQuery("amount", amount2.toString())
                    .addQuery("currency", "USD")
                    .toString();
                const response = await client.get(url);

                assert.deepStrictEqual(response.data.code, 0);
                assert.ok(response.data.data !== undefined);

                assert.deepStrictEqual(response.data.data.account, users[purchase.userIndex].address);
                assert.deepStrictEqual(response.data.data.balance, pointAmount.toString());
                assert.deepStrictEqual(response.data.data.paidPoint, Amount.make(1000).toString());
                assert.deepStrictEqual(response.data.data.feePoint, Amount.make(50).toString());
                assert.deepStrictEqual(response.data.data.totalPoint, Amount.make(1050).toString());
                assert.deepStrictEqual(response.data.data.amount, Amount.make(1).toString());
                assert.deepStrictEqual(response.data.data.currency, "usd");
                assert.deepStrictEqual(response.data.data.feeRate, 0.05);
            });

            let paymentId: string;
            it("Endpoint POST /v1/payment/new/open", async () => {
                const url = URI(serverURL).directory("/v1/payment/new").filename("open").toString();

                const params = {
                    purchaseId: purchaseOfLoyalty.purchaseId,
                    amount: amountOfLoyalty.toString(),
                    currency: "krw",
                    shopId: shopData[purchaseOfLoyalty.shopIndex].shopId,
                    account: users[purchaseOfLoyalty.userIndex].address,
                };
                const response = await client.post(url, params);

                assert.deepStrictEqual(response.data.code, 0);
                assert.ok(response.data.data !== undefined);

                assert.deepStrictEqual(response.data.data.account, users[purchase.userIndex].address);

                paymentId = response.data.data.paymentId;
            });

            it("Endpoint POST /v1/payment/new/approval", async () => {
                const responseItem = await client.get(
                    URI(serverURL).directory("/v1/payment/item").addQuery("paymentId", paymentId).toString()
                );
                const nonce = await ledgerContract.nonceOf(users[purchaseOfLoyalty.userIndex].address);
                const signature = await ContractUtils.signLoyaltyNewPayment(
                    users[purchaseOfLoyalty.userIndex],
                    paymentId,
                    responseItem.data.data.purchaseId,
                    responseItem.data.data.amount,
                    responseItem.data.data.currency,
                    responseItem.data.data.shopId,
                    nonce,
                    contractManager.sideChainId
                );

                const response = await client.post(
                    URI(serverURL).directory("/v1/payment/new").filename("approval").toString(),
                    {
                        paymentId,
                        approval: true,
                        signature,
                    }
                );

                assert.deepStrictEqual(response.data.code, 0);
                assert.ok(response.data.data !== undefined);
                assert.ok(response.data.data.txHash !== undefined);
                assert.deepStrictEqual(response.data.data.paymentStatus, LoyaltyPaymentTaskStatus.APPROVED_NEW_SENT_TX);
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

            it("Endpoint POST /v1/payment/new/close", async () => {
                const response = await client.post(
                    URI(serverURL).directory("/v1/payment/new").filename("close").toString(),
                    {
                        confirm: true,
                        paymentId,
                    }
                );

                assert.deepStrictEqual(response.data.code, 0);
                assert.ok(response.data.data !== undefined);
                assert.deepStrictEqual(response.data.data.paymentStatus, LoyaltyPaymentTaskStatus.CLOSED_NEW);
                totalPoint = BigNumber.from(response.data.data.totalPoint);
            });

            it("Waiting", async () => {
                await ContractUtils.delay(2000);
            });

            it("Check user's balance", async () => {
                const url = URI(serverURL)
                    .directory("/v1/ledger/balance/account")
                    .filename(users[purchase.userIndex].address)
                    .toString();
                const response = await client.get(url);

                assert.deepStrictEqual(response.data.code, 0);
                assert.ok(response.data.data !== undefined);
                assert.deepStrictEqual(response.data.data.point.balance, pointAmount.sub(totalPoint).toString());
            });

            it("Endpoint POST /v1/payment/cancel/open", async () => {
                const url = URI(serverURL).directory("/v1/payment/cancel").filename("open").toString();

                const params = {
                    paymentId,
                };
                const response = await client.post(url, params);

                assert.deepStrictEqual(response.data.code, 0);
                assert.ok(response.data.data !== undefined);

                assert.deepStrictEqual(response.data.data.paymentId, paymentId);
                assert.deepStrictEqual(response.data.data.purchaseId, purchaseOfLoyalty.purchaseId);
                assert.deepStrictEqual(response.data.data.account, users[purchase.userIndex].address);
                assert.deepStrictEqual(response.data.data.paymentStatus, LoyaltyPaymentTaskStatus.OPENED_CANCEL);
            });

            let oldBalance: BigNumber;
            let oldShopInfo: any;

            it("Endpoint POST /v1/payment/cancel/approval - true", async () => {
                const responseItem = await client.get(
                    URI(serverURL).directory("/v1/payment/item").addQuery("paymentId", paymentId).toString()
                );
                oldBalance = await ledgerContract.pointBalanceOf(responseItem.data.data.account);
                oldShopInfo = await shopContract.shopOf(responseItem.data.data.shopId);

                const nonce = await ledgerContract.nonceOf(shopData[purchaseOfLoyalty.shopIndex].wallet.address);
                const signature = await ContractUtils.signLoyaltyCancelPayment(
                    shopData[purchaseOfLoyalty.shopIndex].wallet,
                    paymentId,
                    responseItem.data.data.purchaseId,
                    nonce,
                    contractManager.sideChainId
                );

                const url = URI(serverURL).directory("/v1/payment/cancel").filename("approval").toString();
                const params = {
                    paymentId,
                    approval: true,
                    signature,
                };
                const response = await client.post(url, params);

                assert.deepStrictEqual(response.data.code, 0);
                assert.ok(response.data.data !== undefined);

                assert.ok(response.data.data.txHash !== undefined);
                assert.deepStrictEqual(response.data.data.paymentId, paymentId);
                assert.deepStrictEqual(response.data.data.purchaseId, purchaseOfLoyalty.purchaseId);
                assert.deepStrictEqual(response.data.data.account, users[purchase.userIndex].address);
                assert.deepStrictEqual(
                    response.data.data.paymentStatus,
                    LoyaltyPaymentTaskStatus.APPROVED_CANCEL_SENT_TX
                );
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

            it("Endpoint POST /v1/payment/cancel/close", async () => {
                const response = await client.post(
                    URI(serverURL).directory("/v1/payment/cancel").filename("close").toString(),
                    {
                        confirm: true,
                        paymentId,
                    }
                );

                assert.deepStrictEqual(response.data.code, 0);
                assert.ok(response.data.data !== undefined);
                assert.deepStrictEqual(response.data.data.paymentStatus, LoyaltyPaymentTaskStatus.CLOSED_CANCEL);

                const responseItem = await client.get(
                    URI(serverURL).directory("/v1/payment/item").addQuery("paymentId", paymentId).toString()
                );

                const newBalance = await ledgerContract.pointBalanceOf(users[purchaseOfLoyalty.userIndex].address);
                assert.deepStrictEqual(newBalance, oldBalance.add(BigNumber.from(responseItem.data.data.totalPoint)));

                const newShopInfo = await shopContract.shopOf(responseItem.data.data.shopId);
                assert.deepStrictEqual(
                    newShopInfo.usedAmount,
                    oldShopInfo.usedAmount.sub(BigNumber.from(responseItem.data.data.paidPoint))
                );
            });

            it("Check user's balance", async () => {
                const url = URI(serverURL)
                    .directory("/v1/ledger/balance/account")
                    .filename(users[purchase.userIndex].address)
                    .toString();
                const response = await client.get(url);

                assert.deepStrictEqual(response.data.code, 0);
                assert.ok(response.data.data !== undefined);
                assert.deepStrictEqual(response.data.data.point.balance, pointAmount.toString());
            });
        });
    });

    context("Test point relay endpoints - Cancel Deny", () => {
        before("Set Shop ID", async () => {
            for (const elem of shopData) {
                elem.shopId = ContractUtils.getShopId(elem.wallet.address, LoyaltyNetworkID.LYT);
            }
        });

        before("Deploy", async () => {
            deployments.setShopData(shopData);
            await deployments.doDeploy();

            validatorContract = deployments.getContract("Validator") as Validator;
            tokenContract = deployments.getContract("TestLYT") as BIP20DelegatedTransfer;
            ledgerContract = deployments.getContract("Ledger") as Ledger;
            linkContract = deployments.getContract("PhoneLinkCollection") as PhoneLinkCollection;
            consumerContract = deployments.getContract("LoyaltyConsumer") as LoyaltyConsumer;
            providerContract = deployments.getContract("LoyaltyProvider") as LoyaltyProvider;
            exchangerContract = deployments.getContract("LoyaltyExchanger") as LoyaltyExchanger;
            currencyRateContract = deployments.getContract("CurrencyRate") as CurrencyRate;
            shopContract = deployments.getContract("Shop") as Shop;
        });

        before("Create Config", async () => {
            config.contracts.sideChain.tokenAddress = deployments.getContractAddress("TestLYT") || "";
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
            config.contracts.sideChain.chainBridgeAddress = deployments.getContractAddress("SideChainBridge") || "";

            config.contracts.mainChain.tokenAddress = deployments.getContractAddress("MainChainKIOS") || "";
            config.contracts.mainChain.loyaltyBridgeAddress =
                deployments.getContractAddress("MainChainLoyaltyBridge") || "";
            config.contracts.mainChain.chainBridgeAddress = deployments.getContractAddress("MainChainBridge") || "";

            config.relay.managerKeys = deployments.accounts.certifiers.map((m) => m.privateKey);
            config.relay.callbackEndpoint = "http://127.0.0.1:3400/callback";
            config.relay.relayEndpoint = `http://127.0.0.1:${config.server.port}`;
        });

        before("Create TestServer", async () => {
            serverURL = new URL(`http://127.0.0.1:${config.server.port}`);
            storage = await RelayStorage.make(config.database);
            const graph_sidechain = await GraphStorage.make(config.graph_sidechain);
            const graph_mainchain = await GraphStorage.make(config.graph_mainchain);

            const schedulers: Scheduler[] = [];
            schedulers.push(new WatchScheduler(expression));
            await contractManager.attach();
            server = new TestServer(config, contractManager, storage, graph_sidechain, graph_mainchain, schedulers);
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

        context("Test of Loyalty Point", () => {
            const purchase: IPurchaseData = {
                purchaseId: getPurchaseId(),
                amount: 10000,
                providePercent: 10,
                currency: "krw",
                shopIndex: 1,
                userIndex: 0,
            };

            const purchaseAmount = Amount.make(purchase.amount, 18).value;
            const shop = shopData[purchase.shopIndex];
            const pointAmount = ContractUtils.zeroGWEI(purchaseAmount.mul(purchase.providePercent).div(100));

            const purchaseOfLoyalty: IPurchaseData = {
                purchaseId: getPurchaseId(),
                amount: 10,
                providePercent: 10,
                currency: "krw",
                shopIndex: 1,
                userIndex: 0,
            };
            const amountOfLoyalty = Amount.make(purchaseOfLoyalty.amount, 18).value;
            let totalPoint: BigNumber;

            it("Save Purchase Data", async () => {
                const phoneHash = ContractUtils.getPhoneHash(userData[purchase.userIndex].phone);
                const userAccount =
                    userData[purchase.userIndex].address.trim() !== ""
                        ? userData[purchase.userIndex].address.trim()
                        : AddressZero;
                const purchaseParam = {
                    purchaseId: purchase.purchaseId,
                    amount: purchaseAmount,
                    loyalty: pointAmount,
                    currency: purchase.currency.toLowerCase(),
                    shopId: shop.shopId,
                    account: userAccount,
                    phone: phoneHash,
                    sender: deployments.accounts.foundation.address,
                };
                const purchaseMessage = ContractUtils.getPurchasesMessage(
                    0,
                    [purchaseParam],
                    contractManager.sideChainId
                );
                const signatures = await Promise.all(
                    deployments.accounts.validators.map((m) => ContractUtils.signMessage(m, purchaseMessage))
                );
                const proposeMessage = ContractUtils.getPurchasesProposeMessage(
                    0,
                    [purchaseParam],
                    signatures,
                    contractManager.sideChainId
                );
                const proposerSignature = await ContractUtils.signMessage(
                    deployments.accounts.validators[0],
                    proposeMessage
                );
                await expect(
                    providerContract
                        .connect(deployments.accounts.certifiers[0])
                        .savePurchase(0, [purchaseParam], signatures, proposerSignature)
                )
                    .to.emit(providerContract, "SavedPurchase")
                    .withNamedArgs({
                        purchaseId: purchase.purchaseId,
                        amount: purchaseAmount,
                        loyalty: pointAmount,
                        currency: purchase.currency.toLowerCase(),
                        shopId: shop.shopId,
                        account: userAccount,
                        phone: phoneHash,
                    })
                    .emit(ledgerContract, "ProvidedPoint")
                    .withNamedArgs({
                        account: userAccount,
                        providedPoint: pointAmount,
                        providedValue: pointAmount,
                        purchaseId: purchase.purchaseId,
                        shopId: shop.shopId,
                    });
            });

            it("Get user's balance", async () => {
                const url = URI(serverURL)
                    .directory("/v1/ledger/balance/account")
                    .filename(users[purchase.userIndex].address)
                    .toString();
                const response = await client.get(url);

                assert.deepStrictEqual(response.data.code, 0);
                assert.ok(response.data.data !== undefined);
                assert.deepStrictEqual(response.data.data.point.balance, pointAmount.toString());
            });

            it("Endpoint POST /v1/payment/info", async () => {
                const amount2 = Amount.make(1, 18).value;
                const url = URI(serverURL)
                    .directory("/v1/payment/info")
                    .addQuery("account", users[purchase.userIndex].address)
                    .addQuery("amount", amount2.toString())
                    .addQuery("currency", "USD")
                    .toString();
                const response = await client.get(url);

                assert.deepStrictEqual(response.data.code, 0);
                assert.ok(response.data.data !== undefined);

                assert.deepStrictEqual(response.data.data.account, users[purchase.userIndex].address);
                assert.deepStrictEqual(response.data.data.balance, pointAmount.toString());
                assert.deepStrictEqual(response.data.data.paidPoint, Amount.make(1000).toString());
                assert.deepStrictEqual(response.data.data.feePoint, Amount.make(50).toString());
                assert.deepStrictEqual(response.data.data.totalPoint, Amount.make(1050).toString());
                assert.deepStrictEqual(response.data.data.amount, Amount.make(1).toString());
                assert.deepStrictEqual(response.data.data.currency, "usd");
                assert.deepStrictEqual(response.data.data.feeRate, 0.05);
            });

            let paymentId: string;
            it("Endpoint POST /v1/payment/new/open", async () => {
                const url = URI(serverURL).directory("/v1/payment/new").filename("open").toString();

                const params = {
                    purchaseId: purchaseOfLoyalty.purchaseId,
                    amount: amountOfLoyalty.toString(),
                    currency: "krw",
                    shopId: shopData[purchaseOfLoyalty.shopIndex].shopId,
                    account: users[purchaseOfLoyalty.userIndex].address,
                };
                const response = await client.post(url, params);

                assert.deepStrictEqual(response.data.code, 0);
                assert.ok(response.data.data !== undefined);

                assert.deepStrictEqual(response.data.data.account, users[purchase.userIndex].address);

                paymentId = response.data.data.paymentId;
            });

            it("Endpoint POST /v1/payment/new/approval", async () => {
                const responseItem = await client.get(
                    URI(serverURL).directory("/v1/payment/item").addQuery("paymentId", paymentId).toString()
                );
                const nonce = await ledgerContract.nonceOf(users[purchaseOfLoyalty.userIndex].address);
                const signature = await ContractUtils.signLoyaltyNewPayment(
                    users[purchaseOfLoyalty.userIndex],
                    paymentId,
                    responseItem.data.data.purchaseId,
                    responseItem.data.data.amount,
                    responseItem.data.data.currency,
                    responseItem.data.data.shopId,
                    nonce,
                    contractManager.sideChainId
                );

                const response = await client.post(
                    URI(serverURL).directory("/v1/payment/new").filename("approval").toString(),
                    {
                        paymentId,
                        approval: true,
                        signature,
                    }
                );

                assert.deepStrictEqual(response.data.code, 0);
                assert.ok(response.data.data !== undefined);
                assert.ok(response.data.data.txHash !== undefined);
                assert.deepStrictEqual(response.data.data.paymentStatus, LoyaltyPaymentTaskStatus.APPROVED_NEW_SENT_TX);
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

            it("Endpoint POST /v1/payment/new/close", async () => {
                const response = await client.post(
                    URI(serverURL).directory("/v1/payment/new").filename("close").toString(),
                    {
                        confirm: true,
                        paymentId,
                    }
                );

                assert.deepStrictEqual(response.data.code, 0);
                assert.ok(response.data.data !== undefined);
                assert.deepStrictEqual(response.data.data.paymentStatus, LoyaltyPaymentTaskStatus.CLOSED_NEW);
                totalPoint = BigNumber.from(response.data.data.totalPoint);
            });

            it("Waiting", async () => {
                await ContractUtils.delay(2000);
            });

            it("Check user's balance", async () => {
                const url = URI(serverURL)
                    .directory("/v1/ledger/balance/account")
                    .filename(users[purchase.userIndex].address)
                    .toString();
                const response = await client.get(url);

                assert.deepStrictEqual(response.data.code, 0);
                assert.ok(response.data.data !== undefined);
                assert.deepStrictEqual(response.data.data.point.balance, pointAmount.sub(totalPoint).toString());
            });

            it("Endpoint POST /v1/payment/cancel/open", async () => {
                const url = URI(serverURL).directory("/v1/payment/cancel").filename("open").toString();

                const params = {
                    paymentId,
                };
                const response = await client.post(url, params);

                assert.deepStrictEqual(response.data.code, 0);
                assert.ok(response.data.data !== undefined);

                assert.deepStrictEqual(response.data.data.paymentId, paymentId);
                assert.deepStrictEqual(response.data.data.purchaseId, purchaseOfLoyalty.purchaseId);
                assert.deepStrictEqual(response.data.data.account, users[purchase.userIndex].address);
                assert.deepStrictEqual(response.data.data.paymentStatus, LoyaltyPaymentTaskStatus.OPENED_CANCEL);
            });

            it("Endpoint POST /v1/payment/cancel/approval - false", async () => {
                const responseItem = await client.get(
                    URI(serverURL).directory("/v1/payment/item").addQuery("paymentId", paymentId).toString()
                );
                const nonce = await ledgerContract.nonceOf(shopData[purchaseOfLoyalty.shopIndex].wallet.address);
                const signature = await ContractUtils.signLoyaltyCancelPayment(
                    shopData[purchaseOfLoyalty.shopIndex].wallet,
                    paymentId,
                    responseItem.data.data.purchaseId,
                    nonce,
                    contractManager.sideChainId
                );

                const url = URI(serverURL).directory("/v1/payment/cancel").filename("approval").toString();
                const params = {
                    paymentId,
                    approval: false,
                    signature,
                };
                const response = await client.post(url, params);

                assert.deepStrictEqual(response.data.code, 0);
                assert.ok(response.data.data !== undefined);

                assert.deepStrictEqual(response.data.data.paymentId, paymentId);
                assert.deepStrictEqual(response.data.data.purchaseId, purchaseOfLoyalty.purchaseId);
                assert.deepStrictEqual(response.data.data.account, users[purchase.userIndex].address);
                assert.deepStrictEqual(response.data.data.paymentStatus, LoyaltyPaymentTaskStatus.DENIED_CANCEL);
            });

            it("Endpoint POST /v1/payment/cancel/close", async () => {
                const response = await client.post(
                    URI(serverURL).directory("/v1/payment/cancel").filename("close").toString(),
                    {
                        confirm: true,
                        paymentId,
                    }
                );

                assert.deepStrictEqual(response.data.code, 0);
                assert.ok(response.data.data !== undefined);
                assert.ok(response.data.data.paymentStatus === LoyaltyPaymentTaskStatus.FAILED_CANCEL);
            });

            it("Check user's balance", async () => {
                const url = URI(serverURL)
                    .directory("/v1/ledger/balance/account")
                    .filename(users[purchase.userIndex].address)
                    .toString();
                const response = await client.get(url);

                assert.deepStrictEqual(response.data.code, 0);
                assert.ok(response.data.data !== undefined);
                assert.deepStrictEqual(response.data.data.point.balance, pointAmount.sub(totalPoint).toString());
            });
        });
    });

    context("Mobile Notification", () => {
        const purchase: IPurchaseData = {
            purchaseId: getPurchaseId(),
            amount: 10000,
            providePercent: 10,
            currency: "krw",
            shopIndex: 1,
            userIndex: 0,
        };

        const purchaseAmount = Amount.make(purchase.amount, 18).value;
        const shop = shopData[purchase.shopIndex];
        const pointAmount = ContractUtils.zeroGWEI(purchaseAmount.mul(purchase.providePercent).div(100));

        const purchaseOfLoyalty: IPurchaseData = {
            purchaseId: getPurchaseId(),
            amount: 10,
            providePercent: 10,
            currency: "krw",
            shopIndex: 1,
            userIndex: 0,
        };
        const amountOfLoyalty = Amount.make(purchaseOfLoyalty.amount, 18).value;

        let paymentId: string;

        const mobilePhone: INotificationEventHandler = {
            receive: async (to: string, title: string, body: string, data: any) => {
                await ContractUtils.delay(1000);
                if (data.type === "new") {
                    const receivedPaymentId = data.paymentId;
                    const responseItem = await client.get(
                        URI(serverURL).directory("/v1/payment/item").addQuery("paymentId", receivedPaymentId).toString()
                    );
                    const nonce = await ledgerContract.nonceOf(users[purchaseOfLoyalty.userIndex].address);
                    const signature = await ContractUtils.signLoyaltyNewPayment(
                        users[purchaseOfLoyalty.userIndex],
                        receivedPaymentId,
                        responseItem.data.data.purchaseId,
                        responseItem.data.data.amount,
                        responseItem.data.data.currency,
                        responseItem.data.data.shopId,
                        nonce,
                        contractManager.sideChainId
                    );

                    const response = await client.post(
                        URI(serverURL).directory("/v1/payment/new").filename("approval").toString(),
                        {
                            paymentId: receivedPaymentId,
                            approval: true,
                            signature,
                        }
                    );

                    assert.deepStrictEqual(response.data.code, 0);
                    assert.ok(response.data.data !== undefined);
                    assert.ok(response.data.data.txHash !== undefined);
                    assert.deepStrictEqual(
                        response.data.data.paymentStatus,
                        LoyaltyPaymentTaskStatus.APPROVED_NEW_SENT_TX
                    );
                } else if (data.type === "cancel") {
                    const receivedPaymentId = data.paymentId;
                    const responseItem = await client.get(
                        URI(serverURL).directory("/v1/payment/item").addQuery("paymentId", receivedPaymentId).toString()
                    );
                    const wallet = shopData[purchaseOfLoyalty.shopIndex].wallet;
                    const nonce = await ledgerContract.nonceOf(wallet.address);
                    const signature = await ContractUtils.signLoyaltyCancelPayment(
                        wallet,
                        receivedPaymentId,
                        responseItem.data.data.purchaseId,
                        nonce,
                        contractManager.sideChainId
                    );

                    const response = await client.post(
                        URI(serverURL).directory("/v1/payment/cancel").filename("approval").toString(),
                        {
                            paymentId: receivedPaymentId,
                            approval: true,
                            signature,
                        }
                    );

                    assert.deepStrictEqual(response.data.code, 0);
                    assert.ok(response.data.data !== undefined);
                    assert.ok(response.data.data.txHash !== undefined);
                    assert.deepStrictEqual(
                        response.data.data.paymentStatus,
                        LoyaltyPaymentTaskStatus.APPROVED_CANCEL_SENT_TX
                    );
                }
            },
        };

        before("Set Shop ID", async () => {
            for (const elem of shopData) {
                elem.shopId = ContractUtils.getShopId(elem.wallet.address, LoyaltyNetworkID.LYT);
            }
        });

        before("Deploy", async () => {
            deployments.setShopData(shopData);
            await deployments.doDeploy();

            validatorContract = deployments.getContract("Validator") as Validator;
            tokenContract = deployments.getContract("TestLYT") as BIP20DelegatedTransfer;
            ledgerContract = deployments.getContract("Ledger") as Ledger;
            linkContract = deployments.getContract("PhoneLinkCollection") as PhoneLinkCollection;
            consumerContract = deployments.getContract("LoyaltyConsumer") as LoyaltyConsumer;
            providerContract = deployments.getContract("LoyaltyProvider") as LoyaltyProvider;
            exchangerContract = deployments.getContract("LoyaltyExchanger") as LoyaltyExchanger;
            currencyRateContract = deployments.getContract("CurrencyRate") as CurrencyRate;
            shopContract = deployments.getContract("Shop") as Shop;
        });

        before("Create Config", async () => {
            config.contracts.sideChain.tokenAddress = deployments.getContractAddress("TestLYT") || "";
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
            config.contracts.sideChain.chainBridgeAddress = deployments.getContractAddress("SideChainBridge") || "";

            config.contracts.mainChain.tokenAddress = deployments.getContractAddress("MainChainKIOS") || "";
            config.contracts.mainChain.loyaltyBridgeAddress =
                deployments.getContractAddress("MainChainLoyaltyBridge") || "";
            config.contracts.mainChain.chainBridgeAddress = deployments.getContractAddress("MainChainBridge") || "";

            config.relay.managerKeys = deployments.accounts.certifiers.map((m) => m.privateKey);
            config.relay.callbackEndpoint = "http://127.0.0.1:3400/callback";
            config.relay.relayEndpoint = `http://127.0.0.1:${config.server.port}`;
        });

        before("Create TestServer", async () => {
            serverURL = new URL(`http://127.0.0.1:${config.server.port}`);
            storage = await RelayStorage.make(config.database);
            const graph_sidechain = await GraphStorage.make(config.graph_sidechain);
            const graph_mainchain = await GraphStorage.make(config.graph_mainchain);

            const schedulers: Scheduler[] = [];
            schedulers.push(new WatchScheduler(expression));
            await contractManager.attach();
            server = new TestServer(
                config,
                contractManager,
                storage,
                graph_sidechain,
                graph_mainchain,
                schedulers,
                mobilePhone
            );
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

        it("Register user's mobile token", async () => {
            const param = {
                account: users[purchaseOfLoyalty.userIndex].address,
                type: 0,
                token: "12345678901234567890123456789012345678901234567890",
                language: "kr",
                os: "iOS",
                signature: "",
            };

            param.signature = await ContractUtils.signMobileToken(users[purchaseOfLoyalty.userIndex], param.token);

            const response = await client.post(
                URI(serverURL).directory("/v1/mobile").filename("register").toString(),
                param
            );
            assert.deepStrictEqual(response.data.data.account, users[purchaseOfLoyalty.userIndex].address);
            assert.deepStrictEqual(response.data.data.token, param.token);
            assert.deepStrictEqual(response.data.data.language, param.language);
            assert.deepStrictEqual(response.data.data.os, param.os);
        });

        it("Register shop owner mobile token", async () => {
            const wallet = shopData[purchaseOfLoyalty.shopIndex].wallet;
            const param = {
                account: wallet.address,
                type: 1,
                token: "12345678901234567890123456789012345678901234567890",
                language: "kr",
                os: "iOS",
                signature: "",
            };

            param.signature = await ContractUtils.signMobileToken(wallet, param.token);

            const response = await client.post(
                URI(serverURL).directory("/v1/mobile").filename("register").toString(),
                param
            );
            assert.deepStrictEqual(response.data.data.account, wallet.address);
            assert.deepStrictEqual(response.data.data.token, param.token);
            assert.deepStrictEqual(response.data.data.language, param.language);
            assert.deepStrictEqual(response.data.data.os, param.os);
        });

        it("Save Purchase Data", async () => {
            const phoneHash = ContractUtils.getPhoneHash(userData[purchase.userIndex].phone);
            const userAccount =
                userData[purchase.userIndex].address.trim() !== ""
                    ? userData[purchase.userIndex].address.trim()
                    : AddressZero;
            const purchaseParam = {
                purchaseId: purchase.purchaseId,
                amount: purchaseAmount,
                loyalty: pointAmount,
                currency: purchase.currency.toLowerCase(),
                shopId: shop.shopId,
                account: userAccount,
                phone: phoneHash,
                sender: deployments.accounts.foundation.address,
            };
            const purchaseMessage = ContractUtils.getPurchasesMessage(0, [purchaseParam], contractManager.sideChainId);
            const signatures = await Promise.all(
                deployments.accounts.validators.map((m) => ContractUtils.signMessage(m, purchaseMessage))
            );
            const proposeMessage = ContractUtils.getPurchasesProposeMessage(
                0,
                [purchaseParam],
                signatures,
                contractManager.sideChainId
            );
            const proposerSignature = await ContractUtils.signMessage(
                deployments.accounts.validators[0],
                proposeMessage
            );
            await expect(
                providerContract
                    .connect(deployments.accounts.certifiers[0])
                    .savePurchase(0, [purchaseParam], signatures, proposerSignature)
            )
                .to.emit(providerContract, "SavedPurchase")
                .withNamedArgs({
                    purchaseId: purchase.purchaseId,
                    amount: purchaseAmount,
                    loyalty: pointAmount,
                    currency: purchase.currency.toLowerCase(),
                    shopId: shop.shopId,
                    account: userAccount,
                    phone: phoneHash,
                })
                .emit(ledgerContract, "ProvidedPoint")
                .withNamedArgs({
                    account: userAccount,
                    providedPoint: pointAmount,
                    providedValue: pointAmount,
                    purchaseId: purchase.purchaseId,
                    shopId: shop.shopId,
                });
        });

        it("Get user's balance", async () => {
            const url = URI(serverURL)
                .directory("/v1/ledger/balance/account")
                .filename(users[purchase.userIndex].address)
                .toString();
            const response = await client.get(url);

            assert.deepStrictEqual(response.data.code, 0);
            assert.ok(response.data.data !== undefined);
            assert.deepStrictEqual(response.data.data.point.balance, pointAmount.toString());
        });

        it("Endpoint POST /v1/payment/new/open", async () => {
            const url = URI(serverURL).directory("/v1/payment/new").filename("open").toString();

            const params = {
                purchaseId: purchaseOfLoyalty.purchaseId,
                amount: amountOfLoyalty.toString(),
                currency: "krw",
                shopId: shopData[purchaseOfLoyalty.shopIndex].shopId,
                account: users[purchaseOfLoyalty.userIndex].address,
            };
            const response = await client.post(url, params);

            assert.deepStrictEqual(response.data.code, 0);
            assert.ok(response.data.data !== undefined);

            assert.deepStrictEqual(response.data.data.account, users[purchase.userIndex].address);

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

        it("Check Response", async () => {
            assert.deepStrictEqual(fakerCallbackServer.responseData.length, 1);
            assert.deepStrictEqual(fakerCallbackServer.responseData[0].code, 0);
        });

        it("Endpoint POST /v1/payment/new/close", async () => {
            const response = await client.post(
                URI(serverURL).directory("/v1/payment/new").filename("close").toString(),
                {
                    confirm: true,
                    paymentId,
                }
            );

            assert.deepStrictEqual(response.data.code, 0);
            assert.ok(response.data.data !== undefined);
            assert.deepStrictEqual(response.data.data.paymentStatus, LoyaltyPaymentTaskStatus.CLOSED_NEW);
        });

        it("Waiting", async () => {
            await ContractUtils.delay(2000);
        });

        it("Endpoint POST /v1/payment/cancel/open", async () => {
            const url = URI(serverURL).directory("/v1/payment/cancel").filename("open").toString();

            const params = {
                paymentId,
            };
            const response = await client.post(url, params);

            assert.deepStrictEqual(response.data.code, 0);
            assert.ok(response.data.data !== undefined);

            assert.deepStrictEqual(response.data.data.paymentId, paymentId);
            assert.deepStrictEqual(response.data.data.purchaseId, purchaseOfLoyalty.purchaseId);
            assert.deepStrictEqual(response.data.data.account, users[purchase.userIndex].address);
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

        it("Check Response", async () => {
            assert.deepStrictEqual(fakerCallbackServer.responseData.length, 2);
            assert.deepStrictEqual(fakerCallbackServer.responseData[1].code, 0);
        });

        it("Endpoint POST /v1/payment/cancel/close", async () => {
            const response = await client.post(
                URI(serverURL).directory("/v1/payment/cancel").filename("close").toString(),
                {
                    confirm: true,
                    paymentId,
                }
            );

            assert.deepStrictEqual(response.data.code, 0);
            assert.ok(response.data.data !== undefined);
            assert.deepStrictEqual(response.data.data.paymentStatus, LoyaltyPaymentTaskStatus.CLOSED_CANCEL);
        });
    });
});
