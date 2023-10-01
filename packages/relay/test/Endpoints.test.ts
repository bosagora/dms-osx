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
import { BigNumber } from "ethers";

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
    ] = provider.getWallets();

    const validators = [validator1, validator2, validator3];
    const linkValidators = [validator1];
    const users = [user1, user2, user3];
    const phoneHashes: string[] = [
        ContractUtils.getPhoneHash("08201012341001"),
        ContractUtils.getPhoneHash("08201012341002"),
        ContractUtils.getPhoneHash("08201012341003"),
        ContractUtils.getPhoneHash("08201012341004"),
    ];
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
        shopCollection = (await shopCollectionFactory
            .connect(deployer)
            .deploy(validatorContract.address)) as ShopCollection;
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
        provideWaitTime: number;
        providePercent: number;
        phone: string;
    }

    const shopData: IShopData[] = [
        {
            shopId: "F000100",
            provideWaitTime: 0,
            providePercent: 1,
            phone: "08201020001000",
        },
        {
            shopId: "F000200",
            provideWaitTime: 0,
            providePercent: 1,
            phone: "08201020001001",
        },
        {
            shopId: "F000300",
            provideWaitTime: 0,
            providePercent: 1,
            phone: "08201020001002",
        },
        {
            shopId: "F000400",
            provideWaitTime: 0,
            providePercent: 1,
            phone: "08201020001003",
        },
        {
            shopId: "F000500",
            provideWaitTime: 0,
            providePercent: 1,
            phone: "08201020001004",
        },
    ];

    interface IUserData {
        phone: string;
        address: string;
        privateKey: string;
    }

    const userData: IUserData[] = [
        {
            phone: "08201012341001",
            address: users[0].address,
            privateKey: users[0].privateKey,
        },
        {
            phone: "08201012341002",
            address: users[1].address,
            privateKey: users[1].privateKey,
        },
        {
            phone: "08201012341003",
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
                    const phoneHash = ContractUtils.getPhoneHash(elem.phone);
                    await expect(
                        shopCollection
                            .connect(validator1)
                            .add(elem.shopId, elem.provideWaitTime, elem.providePercent, phoneHash)
                    )
                        .to.emit(shopCollection, "AddedShop")
                        .withArgs(elem.shopId, elem.provideWaitTime, elem.providePercent, phoneHash);
                }
                expect(await shopCollection.shopsLength()).to.equal(shopData.length);
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
                        providedAmountPoint: pointAmount,
                        value: pointAmount,
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

            it("Failure test of the path /payPoint 'Insufficient balance'", async () => {
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
                const uri = URI(serverURL).directory("payPoint");
                const url = uri.toString();
                const response = await client.post(url, {
                    purchaseId: purchase.purchaseId,
                    amount: over_purchaseAmount.toString(),
                    currency: purchase.currency,
                    shopId: shop.shopId,
                    signer: users[purchase.userIndex].address,
                    signature,
                });

                assert.deepStrictEqual(response.data.code, 500);
                assert.ok(response.data.error.message === "Insufficient balance");
            });

            it("Failure test of the path /payPoint 'Invalid signature'", async () => {
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
                const uri = URI(serverURL).directory("payPoint");
                const url = uri.toString();
                const response = await client.post(url, {
                    purchaseId: purchase.purchaseId,
                    amount: purchaseAmount.toString(),
                    currency: purchase.currency,
                    shopId: shop.shopId,
                    signer: users[purchase.userIndex].address,
                    signature,
                });

                assert.deepStrictEqual(response.data.code, 500);
                assert.ok(response.data.error.message === "Signature is not valid.");
            });

            it("Success Test of the path /payPoint", async () => {
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
                const uri = URI(serverURL).directory("payPoint");
                const url = uri.toString();
                const response = await client.post(url, {
                    purchaseId: purchase.purchaseId,
                    amount: purchaseAmount.toString(),
                    currency: purchase.currency,
                    shopId: shop.shopId,
                    signer: users[purchase.userIndex].address,
                    signature,
                });

                console.log(response.data);

                assert.deepStrictEqual(response.data.code, 200);
                assert.ok(response.data.data !== undefined);
                assert.ok(response.data.data.txHash !== undefined);
            });

            it("Failure test of the path /payToken 'Insufficient balance'", async () => {
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
                const uri = URI(serverURL).directory("payToken");
                const url = uri.toString();
                const response = await client.post(url, {
                    purchaseId: purchase.purchaseId,
                    amount: over_purchaseAmount.toString(),
                    currency: purchase.currency,
                    shopId: shop.shopId,
                    signer: users[purchase.userIndex].address,
                    signature,
                });

                assert.deepStrictEqual(response.data.code, 500);
                assert.ok(response.data.error.message === "Insufficient balance");
            });

            it("Failure test of the path /payToken 'Invalid signature'", async () => {
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
                const uri = URI(serverURL).directory("payToken");
                const url = uri.toString();
                const response = await client.post(url, {
                    purchaseId: purchase.purchaseId,
                    amount: purchaseAmount.toString(),
                    currency: purchase.currency,
                    shopId: shop.shopId,
                    signer: users[purchase.userIndex].address,
                    signature,
                });

                assert.deepStrictEqual(response.data.code, 500);
                assert.ok(response.data.error.message === "Signature is not valid.");
            });

            it("Success Test of the path /payToken", async () => {
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
                const uri = URI(serverURL).directory("payToken");
                const url = uri.toString();
                const response = await client.post(url, {
                    purchaseId: purchase.purchaseId,
                    amount: purchaseAmount.toString(),
                    currency: purchase.currency,
                    shopId: shop.shopId,
                    signer: users[purchase.userIndex].address,
                    signature,
                });

                assert.deepStrictEqual(response.data.code, 200);
                assert.ok(response.data.data !== undefined);
                assert.ok(response.data.data.txHash !== undefined);
            });
        });
    });
});
