import { Amount } from "../src/common/Amount";
import { Config } from "../src/common/Config";
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
    let server: TestServer;
    let serverURL: URL;
    let config: Config;

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
            providePercent: 20,
            wallet: shopWallets[1],
        },
        {
            shopId: "F000300",
            name: "Shop3",
            provideWaitTime: 0,
            providePercent: 20,
            wallet: shopWallets[2],
        },
        {
            shopId: "F000400",
            name: "Shop4",
            provideWaitTime: 0,
            providePercent: 20,
            wallet: shopWallets[3],
        },
        {
            shopId: "F000500",
            name: "Shop5",
            provideWaitTime: 0,
            providePercent: 20,
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

    context("Test token & point relay endpoints", () => {
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
            server = new TestServer(config);
        });

        before("Start TestServer", async () => {
            await server.start();
        });

        after("Stop TestServer", async () => {
            await server.stop();
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

        context("Save Purchase Data", () => {
            const purchase: IPurchaseData = {
                purchaseId: "P000001",
                timestamp: 1672844400,
                amount: 10000,
                method: 0,
                currency: "krw",
                shopIndex: 1,
                userIndex: 0,
            };

            it("Save Purchase Data", async () => {
                const phoneHash = ContractUtils.getPhoneHash(userData[purchase.userIndex].phone);
                const userAccount =
                    userData[purchase.userIndex].address.trim() !== ""
                        ? userData[purchase.userIndex].address.trim()
                        : AddressZero;
                const purchaseAmount = Amount.make(purchase.amount, 18).value;
                const shop = shopData[purchase.shopIndex];
                const pointAmount = purchaseAmount.mul(shop.providePercent).div(100);
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
        });

        context("payPoint & payToken", () => {
            const purchase: IPurchaseData = {
                purchaseId: "P000001",
                timestamp: 100,
                amount: 100,
                method: 0,
                currency: "krw",
                shopIndex: 1,
                userIndex: 0,
            };

            const amountDepositToken = BigNumber.from(amount.value.mul(2));
            const amountToken = BigNumber.from(amount.value);
            const amountPoint = amountToken.mul(price).div(multiple);
            const shop = shopData[purchase.shopIndex];

            before("Deposit token", async () => {
                await tokenContract.connect(users[0]).approve(ledgerContract.address, amountDepositToken);
                await expect(ledgerContract.connect(users[0]).deposit(amountDepositToken)).to.emit(
                    ledgerContract,
                    "Deposited"
                );
            });

            it("Failure test of the path /v1/ledger/payPoint 'Insufficient balance'", async () => {
                const over_purchaseAmount = Amount.make(90_000_000, 18).value;
                const nonce = await ledgerContract.nonceOf(users[purchase.userIndex].address);
                const signature = await ContractUtils.signPayment(
                    users[purchase.userIndex],
                    purchase.purchaseId,
                    over_purchaseAmount,
                    purchase.currency,
                    shop.shopId,
                    nonce
                );
                const uri = URI(serverURL).directory("/v1/ledger/payPoint");
                const url = uri.toString();
                const response = await client.post(url, {
                    purchaseId: purchase.purchaseId,
                    amount: over_purchaseAmount.toString(),
                    currency: purchase.currency,
                    shopId: shop.shopId,
                    account: users[purchase.userIndex].address,
                    signature,
                });

                assert.deepStrictEqual(response.data.code, 500);
                assert.ok(response.data.error.message === "Insufficient balance");
            });

            it("Failure test of the path /v1/ledger/payPoint 'Invalid signature'", async () => {
                const purchaseAmount = Amount.make(purchase.amount, 18).value;
                const nonce = await ledgerContract.nonceOf(users[0].address);
                const signature = await ContractUtils.signPayment(
                    users[purchase.userIndex + 1],
                    purchase.purchaseId,
                    purchaseAmount,
                    purchase.currency,
                    shop.shopId,
                    nonce
                );
                const uri = URI(serverURL).directory("/v1/ledger/payPoint");
                const url = uri.toString();
                const response = await client.post(url, {
                    purchaseId: purchase.purchaseId,
                    amount: purchaseAmount.toString(),
                    currency: purchase.currency,
                    shopId: shop.shopId,
                    account: users[purchase.userIndex].address,
                    signature,
                });

                assert.deepStrictEqual(response.data.code, 500);
                assert.ok(response.data.error.message === "Signature is not valid.");
            });

            it("Success Test of the path /v1/ledger/payPoint", async () => {
                const purchaseAmount = Amount.make(purchase.amount, 18).value;
                const nonce = await ledgerContract.nonceOf(users[0].address);
                const signature = await ContractUtils.signPayment(
                    users[purchase.userIndex],
                    purchase.purchaseId,
                    purchaseAmount,
                    purchase.currency,
                    shop.shopId,
                    nonce
                );
                const uri = URI(serverURL).directory("/v1/ledger/payPoint");
                const url = uri.toString();
                const response = await client.post(url, {
                    purchaseId: purchase.purchaseId,
                    amount: purchaseAmount.toString(),
                    currency: purchase.currency,
                    shopId: shop.shopId,
                    account: users[purchase.userIndex].address,
                    signature,
                });

                console.log(response.data);

                assert.deepStrictEqual(response.data.code, 200);
                assert.ok(response.data.data !== undefined);
                assert.ok(response.data.data.txHash !== undefined);
            });

            it("Failure test of the path /v1/ledger/payToken 'Insufficient balance'", async () => {
                const over_purchaseAmount = Amount.make(90_000_000, 18).value;
                const nonce = await ledgerContract.nonceOf(users[0].address);
                const signature = await ContractUtils.signPayment(
                    users[purchase.userIndex],
                    purchase.purchaseId,
                    over_purchaseAmount,
                    purchase.currency,
                    shop.shopId,
                    nonce
                );
                const uri = URI(serverURL).directory("/v1/ledger/payToken");
                const url = uri.toString();
                const response = await client.post(url, {
                    purchaseId: purchase.purchaseId,
                    amount: over_purchaseAmount.toString(),
                    currency: purchase.currency,
                    shopId: shop.shopId,
                    account: users[purchase.userIndex].address,
                    signature,
                });

                assert.deepStrictEqual(response.data.code, 500);
                assert.ok(response.data.error.message === "Insufficient balance");
            });

            it("Failure test of the path /v1/ledger/payToken 'Invalid signature'", async () => {
                const purchaseAmount = Amount.make(purchase.amount, 18).value;
                const nonce = await ledgerContract.nonceOf(users[0].address);
                const signature = await ContractUtils.signPayment(
                    users[purchase.userIndex + 1],
                    purchase.purchaseId,
                    purchaseAmount,
                    purchase.currency,
                    shop.shopId,
                    nonce
                );
                const uri = URI(serverURL).directory("/v1/ledger/payToken");
                const url = uri.toString();
                const response = await client.post(url, {
                    purchaseId: purchase.purchaseId,
                    amount: purchaseAmount.toString(),
                    currency: purchase.currency,
                    shopId: shop.shopId,
                    account: users[purchase.userIndex].address,
                    signature,
                });

                assert.deepStrictEqual(response.data.code, 500);
                assert.ok(response.data.error.message === "Signature is not valid.");
            });

            it("Success Test of the path /v1/ledger/payToken", async () => {
                const purchaseAmount = Amount.make(purchase.amount, 18).value;
                const nonce = await ledgerContract.nonceOf(users[0].address);
                const signature = await ContractUtils.signPayment(
                    users[purchase.userIndex],
                    purchase.purchaseId,
                    purchaseAmount,
                    purchase.currency,
                    shop.shopId,
                    nonce
                );
                const uri = URI(serverURL).directory("/v1/ledger/payToken");
                const url = uri.toString();
                const response = await client.post(url, {
                    purchaseId: purchase.purchaseId,
                    amount: purchaseAmount.toString(),
                    currency: purchase.currency,
                    shopId: shop.shopId,
                    account: users[purchase.userIndex].address,
                    signature,
                });

                assert.deepStrictEqual(response.data.code, 200);
                assert.ok(response.data.data !== undefined);
                assert.ok(response.data.data.txHash !== undefined);
            });
        });

        context("Change loyalty type", () => {
            it("Check loyalty type - before", async () => {
                const userIndex = 0;
                const loyaltyType = await ledgerContract.loyaltyTypeOf(users[userIndex].address);
                expect(loyaltyType).to.equal(0);
            });

            it("Send loyalty type", async () => {
                const userIndex = 0;
                const nonce = await ledgerContract.nonceOf(users[userIndex].address);
                const signature = await ContractUtils.signLoyaltyType(users[userIndex], nonce);
                const uri = URI(serverURL).directory("/v1/ledger/changeToLoyaltyToken");
                const url = uri.toString();
                const response = await client.post(url, {
                    account: users[userIndex].address,
                    signature,
                });

                expect(response.data.code).to.equal(200);
                expect(response.data.data).to.not.equal(undefined);
                expect(response.data.data.txHash).to.match(/^0x[A-Fa-f0-9]{64}$/i);
            });

            it("Check point type - after", async () => {
                const userIndex = 0;
                const loyaltyType = await ledgerContract.loyaltyTypeOf(users[userIndex].address);
                expect(loyaltyType).to.equal(1);
            });
        });
    });

    context("Test token & point relay endpoints - using phone", () => {
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
            server = new TestServer(config);
        });

        before("Start TestServer", async () => {
            await server.start();
        });

        after("Stop TestServer", async () => {
            await server.stop();
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

        context("Save Purchase Data", () => {
            const userIndex = 0;
            const purchase: IPurchaseData = {
                purchaseId: "P000001",
                timestamp: 1672844400,
                amount: 10000,
                method: 0,
                currency: "krw",
                shopIndex: 1,
                userIndex,
            };

            it("Save Purchase Data", async () => {
                const phoneHash = ContractUtils.getPhoneHash(userData[userIndex].phone);
                const userAccount = AddressZero;
                const purchaseAmount = Amount.make(purchase.amount, 18).value;
                const shop = shopData[purchase.shopIndex];
                const pointAmount = purchaseAmount.mul(shop.providePercent).div(100);
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
                    .emit(ledgerContract, "ProvidedUnPayablePoint")
                    .withNamedArgs({
                        phone: phoneHash,
                        providedPoint: pointAmount,
                        providedValue: pointAmount,
                        balancePoint: pointAmount,
                        purchaseId: purchase.purchaseId,
                        shopId: shop.shopId,
                    });
            });

            it("Link phone and wallet address", async () => {
                const phoneHash = ContractUtils.getPhoneHash(userData[userIndex].phone);
                const nonce = await linkCollectionContract.nonceOf(userData[userIndex].address);
                const signature = await ContractUtils.signRequestHash(userData[userIndex].wallet, phoneHash, nonce);
                const requestId = ContractUtils.getRequestId(phoneHash, userData[userIndex].address, nonce);
                await expect(
                    linkCollectionContract
                        .connect(relay1)
                        .addRequest(requestId, phoneHash, userData[userIndex].address, signature)
                )
                    .to.emit(linkCollectionContract, "AddedRequestItem")
                    .withArgs(requestId, phoneHash, userData[userIndex].address);
                await linkCollectionContract.connect(linkValidators[0]).voteRequest(requestId);
                await linkCollectionContract.connect(linkValidators[0]).countVote(requestId);
            });

            it("Change to payable point", async () => {
                const phoneHash = ContractUtils.getPhoneHash(userData[userIndex].phone);
                const payableBalance = await ledgerContract.pointBalanceOf(userData[userIndex].address);
                const unPayableBalance = await ledgerContract.unPayablePointBalanceOf(phoneHash);

                const nonce = await ledgerContract.nonceOf(userData[userIndex].address);
                const signature = await ContractUtils.signChangePayablePoint(
                    userData[userIndex].wallet,
                    phoneHash,
                    nonce
                );

                const uri = URI(serverURL).directory("/v1/ledger/changeToPayablePoint");
                const url = uri.toString();
                const response = await client.post(url, {
                    phone: phoneHash,
                    account: users[userIndex].address,
                    signature,
                });

                expect(response.data.code).to.equal(200);
                expect(response.data.data).to.not.equal(undefined);
                expect(response.data.data.txHash).to.match(/^0x[A-Fa-f0-9]{64}$/i);

                expect(await ledgerContract.pointBalanceOf(userData[userIndex].address)).to.equal(
                    payableBalance.add(unPayableBalance)
                );
                expect(await ledgerContract.unPayablePointBalanceOf(phoneHash)).to.equal(0);
            });
        });
    });
});
