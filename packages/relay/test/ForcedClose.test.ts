import { Amount } from "../src/common/Amount";
import { Config } from "../src/common/Config";
import { RelayStorage } from "../src/storage/RelayStorage";
import { ContractUtils } from "../src/utils/ContractUtils";
import {
    CertifierCollection,
    CurrencyRate,
    Ledger,
    PhoneLinkCollection,
    ShopCollection,
    Token,
    ValidatorCollection,
} from "../typechain-types";
import { TestClient, TestServer } from "./helper/Utility";

import chai, { expect } from "chai";
import { solidity } from "ethereum-waffle";
import * as hre from "hardhat";

import * as path from "path";
import { URL } from "url";

import * as assert from "assert";
import { BigNumber, Wallet } from "ethers";

import { ApprovalScheduler } from "../src/scheduler/ApprovalScheduler";
import { CloseScheduler } from "../src/scheduler/CloseScheduler";
import { Scheduler } from "../src/scheduler/Scheduler";
import { WatchScheduler } from "../src/scheduler/WatchScheduler";
import { ContractLoyaltyType, ContractShopStatus, IShopData, IUserData, LoyaltyPaymentTaskStatus } from "../src/types";
import { FakerCallbackServer } from "./helper/FakerCallbackServer";

import fs from "fs";

// tslint:disable-next-line:no-var-requires
const URI = require("urijs");

chai.use(solidity);

describe("Test of Server", function () {
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
    ] = provider.getWallets();

    const validators = [validator1, validator2, validator3];
    const linkValidators = [validator1];

    let validatorContract: ValidatorCollection;
    let tokenContract: Token;
    let ledgerContract: Ledger;
    let linkCollectionContract: PhoneLinkCollection;
    let currencyRateContract: CurrencyRate;
    let shopCollection: ShopCollection;
    let certifierCollection: CertifierCollection;

    const multiple = BigNumber.from(1000000000);
    const price = BigNumber.from(150).mul(multiple);

    const amount = Amount.make(20_000, 18);
    const assetAmount = Amount.make(10_000_000, 18);

    const deployToken = async () => {
        const tokenFactory = await hre.ethers.getContractFactory("Token");
        tokenContract = (await tokenFactory.connect(deployer).deploy(deployer.address, "Sample", "SAM")) as Token;
        await tokenContract.deployed();
        await tokenContract.deployTransaction.wait();
        for (const elem of validators) {
            await tokenContract.connect(deployer).transfer(elem.address, amount.value);
        }
    };

    const deployValidatorCollection = async () => {
        const validatorFactory = await hre.ethers.getContractFactory("ValidatorCollection");
        validatorContract = (await validatorFactory.connect(deployer).deploy(
            tokenContract.address,
            validators.map((m) => m.address)
        )) as ValidatorCollection;
        await validatorContract.deployed();
        await validatorContract.deployTransaction.wait();
    };

    const depositValidators = async () => {
        for (const elem of validators) {
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

    const deployPhoneLinkCollection = async () => {
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
        await currencyRateContract.connect(validators[0]).set(await tokenContract.symbol(), price);
        await currencyRateContract.connect(validators[0]).set("krw", multiple);
        await currencyRateContract.connect(validators[0]).set("usd", BigNumber.from(1000).mul(multiple));
        await currencyRateContract.connect(validators[0]).set("point", multiple);
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
        const shopCollectionFactory = await hre.ethers.getContractFactory("ShopCollection");
        shopCollection = (await shopCollectionFactory
            .connect(deployer)
            .deploy(certifierCollection.address, currencyRateContract.address)) as ShopCollection;
        await shopCollection.deployed();
        await shopCollection.deployTransaction.wait();
    };

    const addShopData = async (shops: IShopData[]) => {
        for (const shop of shops) {
            const nonce = await shopCollection.nonceOf(shop.address);
            const signature = await ContractUtils.signShop(new Wallet(shop.privateKey), shop.shopId, nonce);
            await shopCollection.connect(deployer).add(shop.shopId, shop.name, shop.currency, shop.address, signature);
        }

        for (const shop of shops) {
            const signature1 = ContractUtils.signShop(
                new Wallet(shop.privateKey),
                shop.shopId,
                await shopCollection.nonceOf(shop.address)
            );
            await shopCollection
                .connect(certifier)
                .update(
                    shop.shopId,
                    shop.name,
                    shop.currency,
                    shop.provideWaitTime,
                    shop.providePercent,
                    shop.address,
                    signature1
                );
        }

        for (const shop of shops) {
            const signature1 = ContractUtils.signShop(
                new Wallet(shop.privateKey),
                shop.shopId,
                await shopCollection.nonceOf(shop.address)
            );
            const signature2 = ContractUtils.signShop(
                certifier,
                shop.shopId,
                await shopCollection.nonceOf(certifier.address)
            );
            await shopCollection
                .connect(certifier)
                .changeStatus(shop.shopId, ContractShopStatus.ACTIVE, shop.address, signature1);
        }
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
        await deployPhoneLinkCollection();
        await deployCurrencyRate();
        await deployCertifierCollection();
        await deployShopCollection();
        await deployLedger();
    };

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
        timestamp: number;
        amount: number;
        method: number;
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
            config.contracts.currencyRateAddress = currencyRateContract.address;

            config.relay.managerKeys = [
                relay1.privateKey,
                relay2.privateKey,
                relay3.privateKey,
                relay4.privateKey,
                relay5.privateKey,
            ];
            config.relay.certifierKey = certifier.privateKey;
            config.relay.forcedCloseSecond = 5;
        });

        before("Create TestServer", async () => {
            serverURL = new URL(`http://127.0.0.1:${config.server.port}`);
            storage = await RelayStorage.make(config.database);

            const schedulers: Scheduler[] = [];
            schedulers.push(new CloseScheduler("*/1 * * * * *"));
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

        it("Add Shop", async () => {
            await addShopData(shopData);
        });

        it("Prepare foundation token", async () => {
            await tokenContract.connect(deployer).transfer(foundation.address, assetAmount.value);
            await tokenContract.connect(foundation).approve(ledgerContract.address, assetAmount.value);
            await ledgerContract.connect(foundation).deposit(assetAmount.value);
        });

        it("Transfer native token", async () => {
            for (const user of userData) {
                await deployer.sendTransaction({
                    to: user.address,
                    value: Amount.make("100").value,
                });
            }
        });

        it("Transfer token", async () => {
            const addresses = userData.map((m: { address: string }) => m.address);
            await tokenContract.connect(deployer).multiTransfer(addresses, amount.value);
            const addresses2 = shopData.map((m: { address: string }) => m.address);
            await tokenContract.connect(deployer).multiTransfer(addresses2, amount.value);
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
            const depositAmount = amount.value.div(2);
            for (const user of userData) {
                const sender = new Wallet(user.privateKey, provider);
                await tokenContract.connect(sender).approve(ledgerContract.address, depositAmount);
                await ledgerContract.connect(sender).deposit(depositAmount);
            }
        });

        context("Test of payment", async () => {
            const purchase: IPurchaseData = {
                purchaseId: "P000002",
                timestamp: 1672844500,
                amount: 1000,
                method: 0,
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
            config.contracts.currencyRateAddress = currencyRateContract.address;

            config.relay.managerKeys = [
                relay1.privateKey,
                relay2.privateKey,
                relay3.privateKey,
                relay4.privateKey,
                relay5.privateKey,
            ];
            config.relay.certifierKey = certifier.privateKey;
            config.relay.approvalSecond = 2;
            config.relay.forcedCloseSecond = 5;
        });

        before("Create TestServer", async () => {
            serverURL = new URL(`http://127.0.0.1:${config.server.port}`);
            storage = await RelayStorage.make(config.database);

            const schedulers: Scheduler[] = [];
            schedulers.push(new ApprovalScheduler("*/1 * * * * *"));
            schedulers.push(new CloseScheduler("*/1 * * * * *"));
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

        it("Add Shop", async () => {
            await addShopData(shopData);
        });

        it("Prepare foundation token", async () => {
            await tokenContract.connect(deployer).transfer(foundation.address, assetAmount.value);
            await tokenContract.connect(foundation).approve(ledgerContract.address, assetAmount.value);
            await ledgerContract.connect(foundation).deposit(assetAmount.value);
        });

        it("Transfer native token", async () => {
            for (const user of userData) {
                await deployer.sendTransaction({
                    to: user.address,
                    value: Amount.make("100").value,
                });
            }
        });

        it("Transfer token", async () => {
            const addresses = userData.map((m: { address: string }) => m.address);
            await tokenContract.connect(deployer).multiTransfer(addresses, amount.value);
            const addresses2 = shopData.map((m: { address: string }) => m.address);
            await tokenContract.connect(deployer).multiTransfer(addresses2, amount.value);
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
            const depositAmount = amount.value.div(2);
            for (const user of userData) {
                const sender = new Wallet(user.privateKey, provider);
                await tokenContract.connect(sender).approve(ledgerContract.address, depositAmount);
                await ledgerContract.connect(sender).deposit(depositAmount);
            }
        });

        context("Test of payment", async () => {
            const purchase: IPurchaseData = {
                purchaseId: "P000002",
                timestamp: 1672844500,
                amount: 1000,
                method: 0,
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
