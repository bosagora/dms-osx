import { Amount } from "../src/common/Amount";
import { Config } from "../src/common/Config";
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

import chai, { expect } from "chai";
import { solidity } from "ethereum-waffle";
import * as hre from "hardhat";

import * as path from "path";
import { URL } from "url";

import * as assert from "assert";
import { BigNumber, Wallet } from "ethers";

// tslint:disable-next-line:no-implicit-dependencies
import { AddressZero } from "@ethersproject/constants";
import { LoyaltyPaymentInputDataStatus, LoyaltyType } from "../src/types";
import { FakerCallbackServer } from "./helper/FakerCallbackServer";

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
        user1,
        user2,
        user3,
        relay1,
        relay2,
        relay3,
        relay4,
        relay5,
        shop1,
        shop2,
        shop3,
        shop4,
        shop5,
    ] = provider.getWallets();

    const validators = [validator1, validator2, validator3];
    const linkValidators = [validator1];
    const users = [user1, user2, user3];
    const shopWallets = [shop1, shop2, shop3, shop4, shop5];

    let validatorContract: ValidatorCollection;
    let tokenContract: Token;
    let ledgerContract: Ledger;
    let linkCollectionContract: PhoneLinkCollection;
    let currencyRateContract: CurrencyRate;
    let shopCollection: ShopCollection;

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
            .deploy(validatorContract.address)) as CurrencyRate;
        await currencyRateContract.deployed();
        await currencyRateContract.deployTransaction.wait();
        await currencyRateContract.connect(validators[0]).set(await tokenContract.symbol(), price);
        await currencyRateContract.connect(validators[0]).set("krw", multiple);
        await currencyRateContract.connect(validators[0]).set("usd", BigNumber.from(1000).mul(multiple));
        await currencyRateContract.connect(validators[0]).set("point", multiple);
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
                foundation.address,
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
        await deployPhoneLinkCollection();
        await deployCurrencyRate();
        await deployShopCollection();
        await deployLedger();
    };

    const client = new TestClient();
    let storage: RelayStorage;
    let server: TestServer;
    let serverURL: URL;
    let config: Config;

    let fakerCallbackServer: FakerCallbackServer;

    interface IShopData {
        shopId: string;
        name: string;
        provideWaitTime: number;
        providePercent: number;
        wallet: Wallet;
    }

    const shopData: IShopData[] = [
        {
            shopId: "F000100",
            name: "Shop1",
            provideWaitTime: 0,
            providePercent: 10,
            wallet: shopWallets[0],
        },
        {
            shopId: "F000200",
            name: "Shop2",
            provideWaitTime: 0,
            providePercent: 10,
            wallet: shopWallets[1],
        },
        {
            shopId: "F000300",
            name: "Shop3",
            provideWaitTime: 0,
            providePercent: 10,
            wallet: shopWallets[2],
        },
        {
            shopId: "F000400",
            name: "Shop4",
            provideWaitTime: 0,
            providePercent: 10,
            wallet: shopWallets[3],
        },
        {
            shopId: "F000500",
            name: "Shop5",
            provideWaitTime: 0,
            providePercent: 10,
            wallet: shopWallets[4],
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
        timestamp: number;
        amount: number;
        method: number;
        currency: string;
        userIndex: number;
        shopIndex: number;
    }

    context("Test point relay endpoints", () => {
        before("Set Shop ID", async () => {
            for (const elem of shopData) {
                elem.shopId = ContractUtils.getShopId(elem.wallet.address);
            }
        });

        before("Deploy", async () => {
            await deployAllContract();
        });

        before("Prepare Token", async () => {
            for (const elem of users) {
                await tokenContract.connect(deployer).transfer(elem.address, amount.value.mul(10));
            }
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

        before("Start CallbackServer", async () => {
            fakerCallbackServer = new FakerCallbackServer(3400);
            await fakerCallbackServer.start();
        });

        after("Stop CallbackServer", async () => {
            await fakerCallbackServer.stop();
        });

        context("Prepare shop data", () => {
            it("Add Shop Data", async () => {
                for (const elem of shopData) {
                    const nonce = await shopCollection.nonceOf(elem.wallet.address);
                    const signature = ContractUtils.signShop(
                        elem.wallet,
                        elem.shopId,
                        elem.name,
                        elem.provideWaitTime,
                        elem.providePercent,
                        nonce
                    );
                    await expect(
                        shopCollection
                            .connect(elem.wallet)
                            .add(
                                elem.shopId,
                                elem.name,
                                elem.provideWaitTime,
                                elem.providePercent,
                                elem.wallet.address,
                                signature
                            )
                    )
                        .to.emit(shopCollection, "AddedShop")
                        .withNamedArgs({
                            shopId: elem.shopId,
                            name: elem.name,
                            provideWaitTime: elem.provideWaitTime,
                            providePercent: elem.providePercent,
                            account: elem.wallet.address,
                        });
                }
                expect(await shopCollection.shopsLength()).to.equal(shopData.length);
            });
        });

        context("Prepare foundation's asset", () => {
            it("Deposit foundation's token", async () => {
                await tokenContract.connect(deployer).transfer(foundation.address, assetAmount.value);
                await tokenContract.connect(foundation).approve(ledgerContract.address, assetAmount.value);
                await expect(ledgerContract.connect(foundation).deposit(assetAmount.value))
                    .to.emit(ledgerContract, "Deposited")
                    .withNamedArgs({
                        account: foundation.address,
                        depositedToken: assetAmount.value,
                        balanceToken: assetAmount.value,
                    });
            });
        });

        context("Test of Loyalty Point", () => {
            const purchase: IPurchaseData = {
                purchaseId: "P000001",
                timestamp: 1672844400,
                amount: 10000,
                method: 0,
                currency: "krw",
                shopIndex: 1,
                userIndex: 0,
            };

            const purchaseAmount = Amount.make(purchase.amount, 18).value;
            const shop = shopData[purchase.shopIndex];
            const pointAmount = purchaseAmount.mul(shop.providePercent).div(100);

            const purchaseOfLoyalty: IPurchaseData = {
                purchaseId: "P000002",
                timestamp: 1672844500,
                amount: 10,
                method: 0,
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
                await expect(
                    ledgerContract.connect(validators[0]).savePurchase({
                        purchaseId: purchase.purchaseId,
                        timestamp: purchase.timestamp,
                        amount: purchaseAmount,
                        currency: purchase.currency.toLowerCase(),
                        shopId: shop.shopId,
                        method: purchase.method,
                        account: userAccount,
                        phone: phoneHash,
                    })
                )
                    .to.emit(ledgerContract, "SavedPurchase")
                    .withNamedArgs({
                        purchaseId: purchase.purchaseId,
                        timestamp: purchase.timestamp,
                        amount: purchaseAmount,
                        currency: purchase.currency.toLowerCase(),
                        shopId: shop.shopId,
                        method: purchase.method,
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
                    .directory("/v1/payment/user")
                    .filename("balance")
                    .addQuery("account", users[purchase.userIndex].address)
                    .toString();
                const response = await client.get(url);

                assert.deepStrictEqual(response.data.code, 200);
                assert.ok(response.data.data !== undefined);
                assert.deepStrictEqual(response.data.data.loyaltyType, LoyaltyType.POINT);
                assert.deepStrictEqual(response.data.data.balance, pointAmount.toString());
            });

            it("Endpoint POST /v1/payment/info", async () => {
                const url = URI(serverURL).directory("/v1/payment").filename("info").toString();

                const amount2 = Amount.make(1, 18).value;
                const params = {
                    accessKey: config.relay.accessKey,
                    account: users[purchase.userIndex].address,
                    amount: amount2.toString(),
                    currency: "USD",
                };
                const response = await client.post(url, params);

                assert.deepStrictEqual(response.data.code, 200);
                assert.ok(response.data.data !== undefined);

                assert.deepStrictEqual(response.data.data.account, users[purchase.userIndex].address);
                assert.deepStrictEqual(response.data.data.loyaltyType, LoyaltyType.POINT);
                assert.deepStrictEqual(response.data.data.balance, pointAmount.toString());
                assert.deepStrictEqual(response.data.data.paidPoint, Amount.make(1000).toString());
                assert.deepStrictEqual(response.data.data.feePoint, Amount.make(50).toString());
                assert.deepStrictEqual(response.data.data.totalPoint, Amount.make(1050).toString());
                assert.deepStrictEqual(response.data.data.amount, Amount.make(1).toString());
                assert.deepStrictEqual(response.data.data.currency, "USD");
                assert.deepStrictEqual(response.data.data.feeRate, 0.05);
            });

            let paymentId: string;
            it("Endpoint POST /v1/payment/create", async () => {
                const url = URI(serverURL).directory("/v1/payment").filename("create").toString();

                const params = {
                    accessKey: config.relay.accessKey,
                    purchaseId: purchaseOfLoyalty.purchaseId,
                    amount: amountOfLoyalty.toString(),
                    currency: "krw",
                    shopId: shopData[purchaseOfLoyalty.shopIndex].shopId,
                    account: users[purchaseOfLoyalty.userIndex].address,
                };
                const response = await client.post(url, params);

                assert.deepStrictEqual(response.data.code, 200);
                assert.ok(response.data.data !== undefined);

                assert.deepStrictEqual(response.data.data.account, users[purchase.userIndex].address);
                assert.deepStrictEqual(response.data.data.loyaltyType, LoyaltyType.POINT);

                paymentId = response.data.data.paymentId;
            });

            it("Endpoint POST /v1/payment/create/item", async () => {
                const url = URI(serverURL).directory("/v1/payment/create").filename("item").toString();

                const params = {
                    paymentId,
                };
                const response = await client.post(url, params);

                assert.deepStrictEqual(response.data.code, 200);
                assert.ok(response.data.data !== undefined);

                assert.deepStrictEqual(response.data.data.paymentId, paymentId);
                assert.deepStrictEqual(response.data.data.account, users[purchase.userIndex].address);
                assert.deepStrictEqual(response.data.data.loyaltyType, LoyaltyType.POINT);
                assert.deepStrictEqual(response.data.data.amount, amountOfLoyalty.toString());
            });

            it("Endpoint POST /v1/payment/create/deny", async () => {
                const responseItem = await client.post(
                    URI(serverURL).directory("/v1/payment/create").filename("item").toString(),
                    {
                        paymentId,
                    }
                );

                const nonce = await ledgerContract.nonceOf(users[purchaseOfLoyalty.userIndex].address);
                const signature = await ContractUtils.signLoyaltyPayment(
                    users[purchaseOfLoyalty.userIndex],
                    paymentId,
                    responseItem.data.data.purchaseId,
                    responseItem.data.data.amount,
                    responseItem.data.data.currency,
                    responseItem.data.data.shopId,
                    nonce
                );

                const response = await client.post(
                    URI(serverURL).directory("/v1/payment/create").filename("deny").toString(),
                    {
                        paymentId,
                        signature,
                    }
                );

                assert.deepStrictEqual(response.data.code, 200);
                assert.ok(response.data.data !== undefined);
                assert.ok(response.data.data.paymentStatus === LoyaltyPaymentInputDataStatus.CREATE_DENIED);
            });

            it("Waiting", async () => {
                await ContractUtils.delay(2000);
                assert.deepStrictEqual(fakerCallbackServer.responseData.length, 1);
                assert.deepStrictEqual(fakerCallbackServer.responseData[0].code, 1001);
            });

            it("Endpoint POST /v1/payment/create/confirm", async () => {
                const responseItem = await client.post(
                    URI(serverURL).directory("/v1/payment/create").filename("item").toString(),
                    {
                        paymentId,
                    }
                );
                const nonce = await ledgerContract.nonceOf(users[purchaseOfLoyalty.userIndex].address);
                const signature = await ContractUtils.signLoyaltyPayment(
                    users[purchaseOfLoyalty.userIndex],
                    paymentId,
                    responseItem.data.data.purchaseId,
                    responseItem.data.data.amount,
                    responseItem.data.data.currency,
                    responseItem.data.data.shopId,
                    nonce
                );

                const response = await client.post(
                    URI(serverURL).directory("/v1/payment/create").filename("confirm").toString(),
                    {
                        paymentId,
                        signature,
                    }
                );

                assert.deepStrictEqual(response.data.code, 402);
                assert.ok(response.data.data === undefined);
                assert.ok(response.data.error !== undefined);
                assert.ok(response.data.error.message === "This payment has already been closed.");
            });

            it("Endpoint POST /v1/payment/create", async () => {
                const url = URI(serverURL).directory("/v1/payment").filename("create").toString();

                const params = {
                    accessKey: config.relay.accessKey,
                    purchaseId: purchaseOfLoyalty.purchaseId,
                    amount: amountOfLoyalty.toString(),
                    currency: "krw",
                    shopId: shopData[purchaseOfLoyalty.shopIndex].shopId,
                    account: users[purchaseOfLoyalty.userIndex].address,
                };
                const response = await client.post(url, params);

                assert.deepStrictEqual(response.data.code, 200);
                assert.ok(response.data.data !== undefined);

                assert.deepStrictEqual(response.data.data.account, users[purchase.userIndex].address);
                assert.deepStrictEqual(response.data.data.loyaltyType, LoyaltyType.POINT);

                paymentId = response.data.data.paymentId;
            });

            it("Endpoint POST /v1/payment/create/confirm - wrong ID", async () => {
                const responseItem = await client.post(
                    URI(serverURL).directory("/v1/payment/create").filename("item").toString(),
                    {
                        paymentId,
                    }
                );
                const nonce = await ledgerContract.nonceOf(users[purchaseOfLoyalty.userIndex].address);
                const wrongPaymentId = ContractUtils.getPaymentId(users[purchaseOfLoyalty.userIndex].address, nonce);
                const signature = await ContractUtils.signLoyaltyPayment(
                    users[purchaseOfLoyalty.userIndex],
                    wrongPaymentId,
                    responseItem.data.data.purchaseId,
                    responseItem.data.data.amount,
                    responseItem.data.data.currency,
                    responseItem.data.data.shopId,
                    nonce
                );

                const response = await client.post(
                    URI(serverURL).directory("/v1/payment/create").filename("confirm").toString(),
                    {
                        paymentId: wrongPaymentId,
                        signature,
                    }
                );

                assert.deepStrictEqual(response.data.code, 401);
                assert.ok(response.data.data === undefined);
                assert.ok(response.data.error !== undefined);
                assert.ok(response.data.error.message === "Payment ID is not exist.");
            });

            it("Endpoint POST /v1/payment/create/confirm - Wrong signature", async () => {
                const responseItem = await client.post(
                    URI(serverURL).directory("/v1/payment/create").filename("item").toString(),
                    {
                        paymentId,
                    }
                );
                const nonce = await ledgerContract.nonceOf(users[purchaseOfLoyalty.userIndex].address);
                const signature = await ContractUtils.signLoyaltyPayment(
                    users[purchaseOfLoyalty.userIndex + 1],
                    paymentId,
                    responseItem.data.data.purchaseId,
                    responseItem.data.data.amount,
                    responseItem.data.data.currency,
                    responseItem.data.data.shopId,
                    nonce
                );

                const response = await client.post(
                    URI(serverURL).directory("/v1/payment/create").filename("confirm").toString(),
                    {
                        paymentId,
                        signature,
                    }
                );

                assert.deepStrictEqual(response.data.code, 403);
                assert.ok(response.data.data === undefined);
                assert.ok(response.data.error !== undefined);
                assert.ok(response.data.error.message === "The signature value entered is not valid.");
            });

            it("Endpoint POST /v1/payment/create/confirm", async () => {
                const responseItem = await client.post(
                    URI(serverURL).directory("/v1/payment/create").filename("item").toString(),
                    {
                        paymentId,
                    }
                );
                const nonce = await ledgerContract.nonceOf(users[purchaseOfLoyalty.userIndex].address);
                const signature = await ContractUtils.signLoyaltyPayment(
                    users[purchaseOfLoyalty.userIndex],
                    paymentId,
                    responseItem.data.data.purchaseId,
                    responseItem.data.data.amount,
                    responseItem.data.data.currency,
                    responseItem.data.data.shopId,
                    nonce
                );

                const response = await client.post(
                    URI(serverURL).directory("/v1/payment/create").filename("confirm").toString(),
                    {
                        paymentId,
                        signature,
                    }
                );

                assert.deepStrictEqual(response.data.code, 200);
                assert.ok(response.data.data !== undefined);
                assert.ok(response.data.data.txHash !== undefined);
                assert.ok(response.data.data.paymentStatus === LoyaltyPaymentInputDataStatus.CREATE_CONFIRMED);
            });

            it("Waiting", async () => {
                await ContractUtils.delay(2000);
                assert.deepStrictEqual(fakerCallbackServer.responseData.length, 2);
                assert.deepStrictEqual(fakerCallbackServer.responseData[1].code, 0);
            });

            it("Endpoint POST /v1/payment/create/deny", async () => {
                const responseItem = await client.post(
                    URI(serverURL).directory("/v1/payment/create").filename("item").toString(),
                    {
                        paymentId,
                    }
                );
                const nonce = await ledgerContract.nonceOf(users[purchaseOfLoyalty.userIndex].address);
                const signature = await ContractUtils.signLoyaltyPayment(
                    users[purchaseOfLoyalty.userIndex],
                    paymentId,
                    responseItem.data.data.purchaseId,
                    responseItem.data.data.amount,
                    responseItem.data.data.currency,
                    responseItem.data.data.shopId,
                    nonce
                );
                const response = await client.post(
                    URI(serverURL).directory("/v1/payment/create").filename("deny").toString(),
                    {
                        paymentId,
                        signature,
                    }
                );

                assert.deepStrictEqual(response.data.code, 402);
                assert.ok(response.data.data === undefined);
                assert.ok(response.data.error !== undefined);
                assert.ok(response.data.error.message === "This payment has already been closed.");
            });
        });
    });

    context("Test point relay endpoints - Cancel Confirm", () => {
        before("Set Shop ID", async () => {
            for (const elem of shopData) {
                elem.shopId = ContractUtils.getShopId(elem.wallet.address);
            }
        });

        before("Deploy", async () => {
            await deployAllContract();
        });

        before("Prepare Token", async () => {
            for (const elem of users) {
                await tokenContract.connect(deployer).transfer(elem.address, amount.value.mul(10));
            }
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

        before("Start CallbackServer", async () => {
            fakerCallbackServer = new FakerCallbackServer(3400);
            await fakerCallbackServer.start();
        });

        after("Stop CallbackServer", async () => {
            await fakerCallbackServer.stop();
        });

        context("Prepare shop data", () => {
            it("Add Shop Data", async () => {
                for (const elem of shopData) {
                    const nonce = await shopCollection.nonceOf(elem.wallet.address);
                    const signature = ContractUtils.signShop(
                        elem.wallet,
                        elem.shopId,
                        elem.name,
                        elem.provideWaitTime,
                        elem.providePercent,
                        nonce
                    );
                    await expect(
                        shopCollection
                            .connect(elem.wallet)
                            .add(
                                elem.shopId,
                                elem.name,
                                elem.provideWaitTime,
                                elem.providePercent,
                                elem.wallet.address,
                                signature
                            )
                    )
                        .to.emit(shopCollection, "AddedShop")
                        .withNamedArgs({
                            shopId: elem.shopId,
                            name: elem.name,
                            provideWaitTime: elem.provideWaitTime,
                            providePercent: elem.providePercent,
                            account: elem.wallet.address,
                        });
                }
                expect(await shopCollection.shopsLength()).to.equal(shopData.length);
            });
        });

        context("Prepare foundation's asset", () => {
            it("Deposit foundation's token", async () => {
                await tokenContract.connect(deployer).transfer(foundation.address, assetAmount.value);
                await tokenContract.connect(foundation).approve(ledgerContract.address, assetAmount.value);
                await expect(ledgerContract.connect(foundation).deposit(assetAmount.value))
                    .to.emit(ledgerContract, "Deposited")
                    .withNamedArgs({
                        account: foundation.address,
                        depositedToken: assetAmount.value,
                        balanceToken: assetAmount.value,
                    });
            });
        });

        context("Test of Loyalty Point", () => {
            const purchase: IPurchaseData = {
                purchaseId: "P000001",
                timestamp: 1672844400,
                amount: 10000,
                method: 0,
                currency: "krw",
                shopIndex: 1,
                userIndex: 0,
            };

            const purchaseAmount = Amount.make(purchase.amount, 18).value;
            const shop = shopData[purchase.shopIndex];
            const pointAmount = purchaseAmount.mul(shop.providePercent).div(100);

            const purchaseOfLoyalty: IPurchaseData = {
                purchaseId: "P000002",
                timestamp: 1672844500,
                amount: 10,
                method: 0,
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
                await expect(
                    ledgerContract.connect(validators[0]).savePurchase({
                        purchaseId: purchase.purchaseId,
                        timestamp: purchase.timestamp,
                        amount: purchaseAmount,
                        currency: purchase.currency.toLowerCase(),
                        shopId: shop.shopId,
                        method: purchase.method,
                        account: userAccount,
                        phone: phoneHash,
                    })
                )
                    .to.emit(ledgerContract, "SavedPurchase")
                    .withNamedArgs({
                        purchaseId: purchase.purchaseId,
                        timestamp: purchase.timestamp,
                        amount: purchaseAmount,
                        currency: purchase.currency.toLowerCase(),
                        shopId: shop.shopId,
                        method: purchase.method,
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
                    .directory("/v1/payment/user")
                    .filename("balance")
                    .addQuery("account", users[purchase.userIndex].address)
                    .toString();
                const response = await client.get(url);

                assert.deepStrictEqual(response.data.code, 200);
                assert.ok(response.data.data !== undefined);
                assert.deepStrictEqual(response.data.data.loyaltyType, LoyaltyType.POINT);
                assert.deepStrictEqual(response.data.data.balance, pointAmount.toString());
            });

            it("Endpoint POST /v1/payment/info", async () => {
                const url = URI(serverURL).directory("/v1/payment").filename("info").toString();

                const amount2 = Amount.make(1, 18).value;
                const params = {
                    accessKey: config.relay.accessKey,
                    account: users[purchase.userIndex].address,
                    amount: amount2.toString(),
                    currency: "USD",
                };
                const response = await client.post(url, params);

                assert.deepStrictEqual(response.data.code, 200);
                assert.ok(response.data.data !== undefined);

                assert.deepStrictEqual(response.data.data.account, users[purchase.userIndex].address);
                assert.deepStrictEqual(response.data.data.loyaltyType, LoyaltyType.POINT);
                assert.deepStrictEqual(response.data.data.balance, pointAmount.toString());
                assert.deepStrictEqual(response.data.data.paidPoint, Amount.make(1000).toString());
                assert.deepStrictEqual(response.data.data.feePoint, Amount.make(50).toString());
                assert.deepStrictEqual(response.data.data.totalPoint, Amount.make(1050).toString());
                assert.deepStrictEqual(response.data.data.amount, Amount.make(1).toString());
                assert.deepStrictEqual(response.data.data.currency, "USD");
                assert.deepStrictEqual(response.data.data.feeRate, 0.05);
            });

            let paymentId: string;
            it("Endpoint POST /v1/payment/create", async () => {
                const url = URI(serverURL).directory("/v1/payment").filename("create").toString();

                const params = {
                    accessKey: config.relay.accessKey,
                    purchaseId: purchaseOfLoyalty.purchaseId,
                    amount: amountOfLoyalty.toString(),
                    currency: "krw",
                    shopId: shopData[purchaseOfLoyalty.shopIndex].shopId,
                    account: users[purchaseOfLoyalty.userIndex].address,
                };
                const response = await client.post(url, params);

                assert.deepStrictEqual(response.data.code, 200);
                assert.ok(response.data.data !== undefined);

                assert.deepStrictEqual(response.data.data.account, users[purchase.userIndex].address);
                assert.deepStrictEqual(response.data.data.loyaltyType, LoyaltyType.POINT);

                paymentId = response.data.data.paymentId;
            });

            it("Endpoint POST /v1/payment/create/confirm", async () => {
                const responseItem = await client.post(
                    URI(serverURL).directory("/v1/payment/create").filename("item").toString(),
                    {
                        paymentId,
                    }
                );
                const nonce = await ledgerContract.nonceOf(users[purchaseOfLoyalty.userIndex].address);
                const signature = await ContractUtils.signLoyaltyPayment(
                    users[purchaseOfLoyalty.userIndex],
                    paymentId,
                    responseItem.data.data.purchaseId,
                    responseItem.data.data.amount,
                    responseItem.data.data.currency,
                    responseItem.data.data.shopId,
                    nonce
                );

                const response = await client.post(
                    URI(serverURL).directory("/v1/payment/create").filename("confirm").toString(),
                    {
                        paymentId,
                        signature,
                    }
                );

                assert.deepStrictEqual(response.data.code, 200);
                assert.ok(response.data.data !== undefined);
                assert.ok(response.data.data.txHash !== undefined);
                assert.ok(response.data.data.paymentStatus === LoyaltyPaymentInputDataStatus.CREATE_CONFIRMED);
            });

            it("Waiting", async () => {
                await ContractUtils.delay(2000);
            });

            it("Endpoint POST /v1/payment/cancel", async () => {
                const url = URI(serverURL).directory("/v1/payment").filename("cancel").toString();

                const params = {
                    accessKey: config.relay.accessKey,
                    paymentId,
                };
                const response = await client.post(url, params);

                assert.deepStrictEqual(response.data.code, 200);
                assert.ok(response.data.data !== undefined);

                assert.deepStrictEqual(response.data.data.paymentId, paymentId);
                assert.deepStrictEqual(response.data.data.purchaseId, purchaseOfLoyalty.purchaseId);
                assert.deepStrictEqual(response.data.data.account, users[purchase.userIndex].address);
                assert.deepStrictEqual(response.data.data.loyaltyType, LoyaltyType.POINT);
                assert.deepStrictEqual(response.data.data.paymentStatus, LoyaltyPaymentInputDataStatus.CANCELED);
            });

            it("Endpoint POST /v1/payment/cancel/confirm", async () => {
                const responseItem = await client.post(
                    URI(serverURL).directory("/v1/payment/create").filename("item").toString(),
                    {
                        paymentId,
                    }
                );

                const oldBalance = await ledgerContract.pointBalanceOf(responseItem.data.data.account);
                const oldShopInfo = await shopCollection.shopOf(responseItem.data.data.shopId);

                const nonce = await ledgerContract.nonceOf(users[purchaseOfLoyalty.userIndex].address);
                const signature = await ContractUtils.signLoyaltyPaymentCancel(
                    users[purchaseOfLoyalty.userIndex],
                    paymentId,
                    responseItem.data.data.purchaseId,
                    nonce
                );

                const url = URI(serverURL).directory("/v1/payment/cancel").filename("confirm").toString();
                const params = {
                    paymentId,
                    signature,
                };
                const response = await client.post(url, params);

                assert.deepStrictEqual(response.data.code, 200);
                assert.ok(response.data.data !== undefined);

                assert.ok(response.data.data.txHash !== undefined);
                assert.deepStrictEqual(response.data.data.paymentId, paymentId);
                assert.deepStrictEqual(response.data.data.purchaseId, purchaseOfLoyalty.purchaseId);
                assert.deepStrictEqual(response.data.data.account, users[purchase.userIndex].address);
                assert.deepStrictEqual(response.data.data.loyaltyType, LoyaltyType.POINT);
                assert.deepStrictEqual(
                    response.data.data.paymentStatus,
                    LoyaltyPaymentInputDataStatus.CANCEL_CONFIRMED
                );
                const newBalance = await ledgerContract.pointBalanceOf(users[purchaseOfLoyalty.userIndex].address);
                assert.deepStrictEqual(newBalance, oldBalance.add(BigNumber.from(responseItem.data.data.totalPoint)));

                const newShopInfo = await shopCollection.shopOf(responseItem.data.data.shopId);
                assert.deepStrictEqual(
                    newShopInfo.usedPoint,
                    oldShopInfo.usedPoint.sub(BigNumber.from(responseItem.data.data.paidPoint))
                );
            });
        });
    });

    context("Test point relay endpoints - Cancel Deny", () => {
        before("Set Shop ID", async () => {
            for (const elem of shopData) {
                elem.shopId = ContractUtils.getShopId(elem.wallet.address);
            }
        });

        before("Deploy", async () => {
            await deployAllContract();
        });

        before("Prepare Token", async () => {
            for (const elem of users) {
                await tokenContract.connect(deployer).transfer(elem.address, amount.value.mul(10));
            }
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

        before("Start CallbackServer", async () => {
            fakerCallbackServer = new FakerCallbackServer(3400);
            await fakerCallbackServer.start();
        });

        after("Stop CallbackServer", async () => {
            await fakerCallbackServer.stop();
        });

        context("Prepare shop data", () => {
            it("Add Shop Data", async () => {
                for (const elem of shopData) {
                    const nonce = await shopCollection.nonceOf(elem.wallet.address);
                    const signature = ContractUtils.signShop(
                        elem.wallet,
                        elem.shopId,
                        elem.name,
                        elem.provideWaitTime,
                        elem.providePercent,
                        nonce
                    );
                    await expect(
                        shopCollection
                            .connect(elem.wallet)
                            .add(
                                elem.shopId,
                                elem.name,
                                elem.provideWaitTime,
                                elem.providePercent,
                                elem.wallet.address,
                                signature
                            )
                    )
                        .to.emit(shopCollection, "AddedShop")
                        .withNamedArgs({
                            shopId: elem.shopId,
                            name: elem.name,
                            provideWaitTime: elem.provideWaitTime,
                            providePercent: elem.providePercent,
                            account: elem.wallet.address,
                        });
                }
                expect(await shopCollection.shopsLength()).to.equal(shopData.length);
            });
        });

        context("Prepare foundation's asset", () => {
            it("Deposit foundation's token", async () => {
                await tokenContract.connect(deployer).transfer(foundation.address, assetAmount.value);
                await tokenContract.connect(foundation).approve(ledgerContract.address, assetAmount.value);
                await expect(ledgerContract.connect(foundation).deposit(assetAmount.value))
                    .to.emit(ledgerContract, "Deposited")
                    .withNamedArgs({
                        account: foundation.address,
                        depositedToken: assetAmount.value,
                        balanceToken: assetAmount.value,
                    });
            });
        });

        context("Test of Loyalty Point", () => {
            const purchase: IPurchaseData = {
                purchaseId: "P000001",
                timestamp: 1672844400,
                amount: 10000,
                method: 0,
                currency: "krw",
                shopIndex: 1,
                userIndex: 0,
            };

            const purchaseAmount = Amount.make(purchase.amount, 18).value;
            const shop = shopData[purchase.shopIndex];
            const pointAmount = purchaseAmount.mul(shop.providePercent).div(100);

            const purchaseOfLoyalty: IPurchaseData = {
                purchaseId: "P000002",
                timestamp: 1672844500,
                amount: 10,
                method: 0,
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
                await expect(
                    ledgerContract.connect(validators[0]).savePurchase({
                        purchaseId: purchase.purchaseId,
                        timestamp: purchase.timestamp,
                        amount: purchaseAmount,
                        currency: purchase.currency.toLowerCase(),
                        shopId: shop.shopId,
                        method: purchase.method,
                        account: userAccount,
                        phone: phoneHash,
                    })
                )
                    .to.emit(ledgerContract, "SavedPurchase")
                    .withNamedArgs({
                        purchaseId: purchase.purchaseId,
                        timestamp: purchase.timestamp,
                        amount: purchaseAmount,
                        currency: purchase.currency.toLowerCase(),
                        shopId: shop.shopId,
                        method: purchase.method,
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
                    .directory("/v1/payment/user")
                    .filename("balance")
                    .addQuery("account", users[purchase.userIndex].address)
                    .toString();
                const response = await client.get(url);

                assert.deepStrictEqual(response.data.code, 200);
                assert.ok(response.data.data !== undefined);
                assert.deepStrictEqual(response.data.data.loyaltyType, LoyaltyType.POINT);
                assert.deepStrictEqual(response.data.data.balance, pointAmount.toString());
            });

            it("Endpoint POST /v1/payment/info", async () => {
                const url = URI(serverURL).directory("/v1/payment").filename("info").toString();

                const amount2 = Amount.make(1, 18).value;
                const params = {
                    accessKey: config.relay.accessKey,
                    account: users[purchase.userIndex].address,
                    amount: amount2.toString(),
                    currency: "USD",
                };
                const response = await client.post(url, params);

                assert.deepStrictEqual(response.data.code, 200);
                assert.ok(response.data.data !== undefined);

                assert.deepStrictEqual(response.data.data.account, users[purchase.userIndex].address);
                assert.deepStrictEqual(response.data.data.loyaltyType, LoyaltyType.POINT);
                assert.deepStrictEqual(response.data.data.balance, pointAmount.toString());
                assert.deepStrictEqual(response.data.data.paidPoint, Amount.make(1000).toString());
                assert.deepStrictEqual(response.data.data.feePoint, Amount.make(50).toString());
                assert.deepStrictEqual(response.data.data.totalPoint, Amount.make(1050).toString());
                assert.deepStrictEqual(response.data.data.amount, Amount.make(1).toString());
                assert.deepStrictEqual(response.data.data.currency, "USD");
                assert.deepStrictEqual(response.data.data.feeRate, 0.05);
            });

            let paymentId: string;
            it("Endpoint POST /v1/payment/create", async () => {
                const url = URI(serverURL).directory("/v1/payment").filename("create").toString();

                const params = {
                    accessKey: config.relay.accessKey,
                    purchaseId: purchaseOfLoyalty.purchaseId,
                    amount: amountOfLoyalty.toString(),
                    currency: "krw",
                    shopId: shopData[purchaseOfLoyalty.shopIndex].shopId,
                    account: users[purchaseOfLoyalty.userIndex].address,
                };
                const response = await client.post(url, params);

                assert.deepStrictEqual(response.data.code, 200);
                assert.ok(response.data.data !== undefined);

                assert.deepStrictEqual(response.data.data.account, users[purchase.userIndex].address);
                assert.deepStrictEqual(response.data.data.loyaltyType, LoyaltyType.POINT);

                paymentId = response.data.data.paymentId;
            });

            it("Endpoint POST /v1/payment/create/confirm", async () => {
                const responseItem = await client.post(
                    URI(serverURL).directory("/v1/payment/create").filename("item").toString(),
                    {
                        paymentId,
                    }
                );
                const nonce = await ledgerContract.nonceOf(users[purchaseOfLoyalty.userIndex].address);
                const signature = await ContractUtils.signLoyaltyPayment(
                    users[purchaseOfLoyalty.userIndex],
                    paymentId,
                    responseItem.data.data.purchaseId,
                    responseItem.data.data.amount,
                    responseItem.data.data.currency,
                    responseItem.data.data.shopId,
                    nonce
                );

                const response = await client.post(
                    URI(serverURL).directory("/v1/payment/create").filename("confirm").toString(),
                    {
                        paymentId,
                        signature,
                    }
                );

                assert.deepStrictEqual(response.data.code, 200);
                assert.ok(response.data.data !== undefined);
                assert.ok(response.data.data.txHash !== undefined);
                assert.ok(response.data.data.paymentStatus === LoyaltyPaymentInputDataStatus.CREATE_CONFIRMED);
            });

            it("Waiting", async () => {
                await ContractUtils.delay(2000);
            });

            it("Endpoint POST /v1/payment/cancel", async () => {
                const url = URI(serverURL).directory("/v1/payment").filename("cancel").toString();

                const params = {
                    accessKey: config.relay.accessKey,
                    paymentId,
                };
                const response = await client.post(url, params);

                assert.deepStrictEqual(response.data.code, 200);
                assert.ok(response.data.data !== undefined);

                assert.deepStrictEqual(response.data.data.paymentId, paymentId);
                assert.deepStrictEqual(response.data.data.purchaseId, purchaseOfLoyalty.purchaseId);
                assert.deepStrictEqual(response.data.data.account, users[purchase.userIndex].address);
                assert.deepStrictEqual(response.data.data.loyaltyType, LoyaltyType.POINT);
                assert.deepStrictEqual(response.data.data.paymentStatus, LoyaltyPaymentInputDataStatus.CANCELED);
            });

            it("Endpoint POST /v1/payment/cancel/deny", async () => {
                const responseItem = await client.post(
                    URI(serverURL).directory("/v1/payment/create").filename("item").toString(),
                    {
                        paymentId,
                    }
                );
                const nonce = await ledgerContract.nonceOf(users[purchaseOfLoyalty.userIndex].address);
                const signature = await ContractUtils.signLoyaltyPaymentCancel(
                    users[purchaseOfLoyalty.userIndex],
                    paymentId,
                    responseItem.data.data.purchaseId,
                    nonce
                );

                const url = URI(serverURL).directory("/v1/payment/cancel").filename("deny").toString();
                const params = {
                    paymentId,
                    signature,
                };
                const response = await client.post(url, params);

                assert.deepStrictEqual(response.data.code, 200);
                assert.ok(response.data.data !== undefined);

                assert.deepStrictEqual(response.data.data.paymentId, paymentId);
                assert.deepStrictEqual(response.data.data.purchaseId, purchaseOfLoyalty.purchaseId);
                assert.deepStrictEqual(response.data.data.account, users[purchase.userIndex].address);
                assert.deepStrictEqual(response.data.data.loyaltyType, LoyaltyType.POINT);
                assert.deepStrictEqual(response.data.data.paymentStatus, LoyaltyPaymentInputDataStatus.CANCEL_DENIED);
            });
        });
    });

    context("Test token relay endpoints", () => {
        before("Set Shop ID", async () => {
            for (const elem of shopData) {
                elem.shopId = ContractUtils.getShopId(elem.wallet.address);
            }
        });

        before("Deploy", async () => {
            await deployAllContract();
        });

        before("Prepare Token", async () => {
            for (const elem of users) {
                await tokenContract.connect(deployer).transfer(elem.address, amount.value.mul(10));
            }
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

        before("Start CallbackServer", async () => {
            fakerCallbackServer = new FakerCallbackServer(3400);
            await fakerCallbackServer.start();
        });

        after("Stop CallbackServer", async () => {
            await fakerCallbackServer.stop();
        });

        context("Prepare shop data", () => {
            it("Add Shop Data", async () => {
                for (const elem of shopData) {
                    const nonce = await shopCollection.nonceOf(elem.wallet.address);
                    const signature = ContractUtils.signShop(
                        elem.wallet,
                        elem.shopId,
                        elem.name,
                        elem.provideWaitTime,
                        elem.providePercent,
                        nonce
                    );
                    await expect(
                        shopCollection
                            .connect(elem.wallet)
                            .add(
                                elem.shopId,
                                elem.name,
                                elem.provideWaitTime,
                                elem.providePercent,
                                elem.wallet.address,
                                signature
                            )
                    )
                        .to.emit(shopCollection, "AddedShop")
                        .withNamedArgs({
                            shopId: elem.shopId,
                            name: elem.name,
                            provideWaitTime: elem.provideWaitTime,
                            providePercent: elem.providePercent,
                            account: elem.wallet.address,
                        });
                }
                expect(await shopCollection.shopsLength()).to.equal(shopData.length);
            });
        });

        context("Prepare foundation's asset", () => {
            it("Deposit foundation's token", async () => {
                await tokenContract.connect(deployer).transfer(foundation.address, assetAmount.value);
                await tokenContract.connect(foundation).approve(ledgerContract.address, assetAmount.value);
                await expect(ledgerContract.connect(foundation).deposit(assetAmount.value))
                    .to.emit(ledgerContract, "Deposited")
                    .withNamedArgs({
                        account: foundation.address,
                        depositedToken: assetAmount.value,
                        balanceToken: assetAmount.value,
                    });
            });
        });

        context("Test of Loyalty Token", () => {
            const purchase: IPurchaseData = {
                purchaseId: "P000001",
                timestamp: 1672844400,
                amount: 10000,
                method: 0,
                currency: "krw",
                shopIndex: 1,
                userIndex: 0,
            };

            const purchaseAmount = Amount.make(purchase.amount, 18).value;
            const shop = shopData[purchase.shopIndex];
            const pointAmount = purchaseAmount.mul(shop.providePercent).div(100);
            const tokenAmount = pointAmount.mul(multiple).div(price);

            const purchaseOfLoyalty: IPurchaseData = {
                purchaseId: "P000002",
                timestamp: 1672844500,
                amount: 10,
                method: 0,
                currency: "krw",
                shopIndex: 1,
                userIndex: 0,
            };
            const amountOfLoyalty = Amount.make(purchaseOfLoyalty.amount, 18).value;

            it("Change loyalty type", async () => {
                const nonce = await ledgerContract.nonceOf(users[purchase.userIndex].address);
                const signature = await ContractUtils.signLoyaltyType(users[purchase.userIndex], nonce);
                const url = URI(serverURL).directory("v1/ledger").filename("changeToLoyaltyToken").toString();
                const response = await client.post(url, {
                    account: users[purchase.userIndex].address,
                    signature,
                });

                expect(response.data.code).to.equal(200);
                expect(response.data.data).to.not.equal(undefined);
                expect(response.data.data.txHash).to.match(/^0x[A-Fa-f0-9]{64}$/i);
            });

            it("Save Purchase Data", async () => {
                const phoneHash = ContractUtils.getPhoneHash(userData[purchase.userIndex].phone);
                const userAccount =
                    userData[purchase.userIndex].address.trim() !== ""
                        ? userData[purchase.userIndex].address.trim()
                        : AddressZero;
                await expect(
                    ledgerContract.connect(validators[0]).savePurchase({
                        purchaseId: purchase.purchaseId,
                        timestamp: purchase.timestamp,
                        amount: purchaseAmount,
                        currency: purchase.currency.toLowerCase(),
                        shopId: shop.shopId,
                        method: purchase.method,
                        account: userAccount,
                        phone: phoneHash,
                    })
                )
                    .to.emit(ledgerContract, "SavedPurchase")
                    .withNamedArgs({
                        purchaseId: purchase.purchaseId,
                        timestamp: purchase.timestamp,
                        amount: purchaseAmount,
                        currency: purchase.currency.toLowerCase(),
                        shopId: shop.shopId,
                        method: purchase.method,
                        account: userAccount,
                        phone: phoneHash,
                    })
                    .emit(ledgerContract, "ProvidedToken")
                    .withNamedArgs({
                        account: userAccount,
                        providedToken: tokenAmount,
                        providedValue: pointAmount,
                        purchaseId: purchase.purchaseId,
                        shopId: shop.shopId,
                    });
            });

            it("Get user's balance", async () => {
                const url = URI(serverURL)
                    .directory("/v1/payment/user")
                    .filename("balance")
                    .addQuery("account", users[purchase.userIndex].address)
                    .toString();
                const response = await client.get(url);

                assert.deepStrictEqual(response.data.code, 200);
                assert.ok(response.data.data !== undefined);
                assert.deepStrictEqual(response.data.data.loyaltyType, LoyaltyType.TOKEN);
                assert.deepStrictEqual(response.data.data.balance, tokenAmount.toString());
            });

            let paymentId: string;
            it("Endpoint POST /v1/payment/create", async () => {
                const response = await client.post(
                    URI(serverURL).directory("/v1/payment").filename("create").toString(),
                    {
                        accessKey: config.relay.accessKey,
                        purchaseId: purchaseOfLoyalty.purchaseId,
                        amount: amountOfLoyalty.toString(),
                        currency: "krw",
                        shopId: shopData[purchaseOfLoyalty.shopIndex].shopId,
                        account: users[purchaseOfLoyalty.userIndex].address,
                    }
                );

                assert.deepStrictEqual(response.data.code, 200);
                assert.ok(response.data.data !== undefined);

                assert.deepStrictEqual(response.data.data.account, users[purchase.userIndex].address);
                assert.deepStrictEqual(response.data.data.loyaltyType, LoyaltyType.TOKEN);

                paymentId = response.data.data.paymentId;
            });

            it("Endpoint POST /v1/payment/create/item", async () => {
                const response = await client.post(
                    URI(serverURL).directory("/v1/payment/create").filename("item").toString(),
                    {
                        paymentId,
                    }
                );

                assert.deepStrictEqual(response.data.code, 200);
                assert.ok(response.data.data !== undefined);

                assert.deepStrictEqual(response.data.data.paymentId, paymentId);
                assert.deepStrictEqual(response.data.data.account, users[purchase.userIndex].address);
                assert.deepStrictEqual(response.data.data.loyaltyType, LoyaltyType.TOKEN);
            });

            it("Endpoint POST /v1/payment/create/confirm", async () => {
                const responseItem = await client.post(
                    URI(serverURL).directory("/v1/payment/create").filename("item").toString(),
                    {
                        paymentId,
                    }
                );

                const nonce = await ledgerContract.nonceOf(users[purchaseOfLoyalty.userIndex].address);
                const signature = await ContractUtils.signLoyaltyPayment(
                    users[purchaseOfLoyalty.userIndex],
                    paymentId,
                    responseItem.data.data.purchaseId,
                    responseItem.data.data.amount,
                    responseItem.data.data.currency,
                    responseItem.data.data.shopId,
                    nonce
                );

                const response = await client.post(
                    URI(serverURL).directory("/v1/payment/create").filename("confirm").toString(),
                    {
                        paymentId,
                        signature,
                    }
                );

                assert.deepStrictEqual(response.data.code, 200);
                assert.ok(response.data.data !== undefined);
                assert.ok(response.data.data.txHash !== undefined);
            });

            it("Waiting", async () => {
                await ContractUtils.delay(2000);
            });
        });
    });
});
