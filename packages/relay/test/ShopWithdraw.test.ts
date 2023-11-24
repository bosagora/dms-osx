import { Amount } from "../src/common/Amount";
import { RelayStorage } from "../src/storage/RelayStorage";
import { ContractShopStatus } from "../src/types";
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

import path from "path";

// tslint:disable-next-line:no-implicit-dependencies
import { AddressZero } from "@ethersproject/constants";

chai.use(solidity);

interface IPurchaseData {
    purchaseId: string;
    timestamp: number;
    amount: number;
    method: number;
    currency: string;
    userIndex: number;
    shopIndex: number;
}

interface IShopData {
    shopId: string;
    name: string;
    provideWaitTime: number;
    providePercent: number;
    wallet: Wallet;
}

interface IUserData {
    phone: string;
    address: string;
    privateKey: string;
}

describe("Test for ShopCollection", () => {
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
        relay,
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
            .deploy(validatorContract.address)) as CurrencyRate;
        await currencyRateContract.deployed();
        await currencyRateContract.deployTransaction.wait();
        await currencyRateContract.connect(validatorWallets[0]).set(await tokenContract.symbol(), price);
    };

    const deployCertifierCollection = async () => {
        const factory = await hre.ethers.getContractFactory("CertifierCollection");
        certifierCollection = (await factory.connect(deployer).deploy(certifier.address)) as CertifierCollection;
        await certifierCollection.deployed();
        await certifierCollection.deployTransaction.wait();
        await certifierCollection.connect(certifier).grantCertifier(relay.address);
    };

    const deployShopCollection = async () => {
        const shopCollectionFactory = await hre.ethers.getContractFactory("ShopCollection");
        shopCollection = (await shopCollectionFactory
            .connect(deployer)
            .deploy(certifierCollection.address)) as ShopCollection;
        await shopCollection.deployed();
        await shopCollection.deployTransaction.wait();
    };

    const addShopData = async (shops: IShopData[]) => {
        for (const shop of shops) {
            const nonce = await shopCollection.nonceOf(shop.wallet.address);
            const signature = await ContractUtils.signShop(shop.wallet, shop.shopId, nonce);
            await shopCollection.connect(deployer).add(shop.shopId, shop.name, shop.wallet.address, signature);
        }

        for (const shop of shops) {
            const signature1 = ContractUtils.signShop(
                shop.wallet,
                shop.shopId,
                await shopCollection.nonceOf(shop.wallet.address)
            );
            await shopCollection
                .connect(certifier)
                .update(
                    shop.shopId,
                    shop.name,
                    shop.provideWaitTime,
                    shop.providePercent,
                    shop.wallet.address,
                    signature1
                );
        }

        for (const shop of shops) {
            const signature1 = ContractUtils.signShop(
                shop.wallet,
                shop.shopId,
                await shopCollection.nonceOf(shop.wallet.address)
            );
            await shopCollection
                .connect(certifier)
                .changeStatus(shop.shopId, ContractShopStatus.ACTIVE, shop.wallet.address, signature1);
        }
    };

    const prepareToken = async () => {
        for (const elem of userWallets) {
            await tokenContract.connect(deployer).transfer(elem.address, amount.value);
        }
        await tokenContract.connect(deployer).transfer(foundation.address, assetAmount.value);
        await tokenContract.connect(foundation).approve(ledgerContract.address, assetAmount.value);
        await ledgerContract.connect(foundation).deposit(assetAmount.value);
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

    const deployAllContract = async (shops: IShopData[]) => {
        await deployToken();
        await deployValidatorCollection();
        await depositValidators();
        await deployLinkCollection();
        await deployCurrencyRate();
        await deployCertifierCollection();
        await deployShopCollection();
        await deployLedger();
        await addShopData(shops);
        await prepareToken();
    };

    const client = new TestClient();
    let server: TestServer;
    let storage: RelayStorage;
    let serverURL: URL;
    let config: Config;

    context("Settlement of shops", () => {
        const userData: IUserData[] = [
            {
                phone: "08201012341001",
                address: userWallets[0].address,
                privateKey: userWallets[0].privateKey,
            },
            {
                phone: "08201012341002",
                address: userWallets[1].address,
                privateKey: userWallets[1].privateKey,
            },
            {
                phone: "08201012341003",
                address: userWallets[2].address,
                privateKey: userWallets[2].privateKey,
            },
            {
                phone: "08201012341004",
                address: userWallets[3].address,
                privateKey: userWallets[3].privateKey,
            },
            {
                phone: "08201012341005",
                address: userWallets[4].address,
                privateKey: userWallets[4].privateKey,
            },
        ];

        const purchaseData: IPurchaseData[] = [
            {
                purchaseId: "P000001",
                timestamp: 1672844400,
                amount: 10000,
                method: 0,
                currency: "krw",
                shopIndex: 0,
                userIndex: 0,
            },
            {
                purchaseId: "P000002",
                timestamp: 1675522800,
                amount: 10000,
                method: 0,
                currency: "krw",
                shopIndex: 0,
                userIndex: 0,
            },
            {
                purchaseId: "P000003",
                timestamp: 1677942000,
                amount: 10000,
                method: 0,
                currency: "krw",
                shopIndex: 0,
                userIndex: 0,
            },
            {
                purchaseId: "P000004",
                timestamp: 1680620400,
                amount: 10000,
                method: 0,
                currency: "krw",
                shopIndex: 1,
                userIndex: 0,
            },
            {
                purchaseId: "P000005",
                timestamp: 1683212400,
                amount: 10000,
                method: 0,
                currency: "krw",
                shopIndex: 2,
                userIndex: 0,
            },
            {
                purchaseId: "P000005",
                timestamp: 1683212400,
                amount: 10000,
                method: 0,
                currency: "krw",
                shopIndex: 3,
                userIndex: 0,
            },
        ];

        const shopData: IShopData[] = [
            {
                shopId: "F000100",
                name: "Shop1",
                provideWaitTime: 0,
                providePercent: 1,
                wallet: shopWallets[0],
            },
            {
                shopId: "F000200",
                name: "Shop2",
                provideWaitTime: 0,
                providePercent: 1,
                wallet: shopWallets[1],
            },
            {
                shopId: "F000300",
                name: "Shop3",
                provideWaitTime: 0,
                providePercent: 1,
                wallet: shopWallets[2],
            },
            {
                shopId: "F000400",
                name: "Shop4",
                provideWaitTime: 0,
                providePercent: 1,
                wallet: shopWallets[3],
            },
            {
                shopId: "F000500",
                name: "Shop5",
                provideWaitTime: 0,
                providePercent: 1,
                wallet: shopWallets[4],
            },
            {
                shopId: "F000600",
                name: "Shop6",
                provideWaitTime: 0,
                providePercent: 1,
                wallet: shopWallets[5],
            },
        ];

        before("Set Shop ID", async () => {
            for (const elem of shopData) {
                elem.shopId = ContractUtils.getShopId(elem.wallet.address);
            }
        });

        before("Deploy", async () => {
            await deployAllContract(shopData);
        });

        before("Create Config", async () => {
            config = new Config();
            config.readFromFile(path.resolve(process.cwd(), "config", "config_test.yaml"));
            config.contracts.tokenAddress = tokenContract.address;
            config.contracts.phoneLinkerAddress = linkCollectionContract.address;
            config.contracts.ledgerAddress = ledgerContract.address;
            config.contracts.shopAddress = shopCollection.address;

            config.relay.managerKeys = [relay.privateKey];
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
            await storage.dropTestDB();
        });

        context("Save Purchase Data", () => {
            it("Save Purchase Data", async () => {
                for (const purchase of purchaseData) {
                    const phoneHash = ContractUtils.getPhoneHash(userData[purchase.userIndex].phone);
                    const purchaseAmount = Amount.make(purchase.amount, 18).value;
                    const shop = shopData[purchase.shopIndex];
                    const amt = purchaseAmount.mul(shop.providePercent).div(100);
                    const userAccount =
                        userData[purchase.userIndex].address.trim() !== ""
                            ? userData[purchase.userIndex].address.trim()
                            : AddressZero;
                    await expect(
                        ledgerContract.connect(validatorWallets[0]).savePurchase({
                            purchaseId: purchase.purchaseId,
                            timestamp: purchase.timestamp,
                            amount: purchaseAmount,
                            currency: purchase.currency.toLowerCase(),
                            shopId: shopData[purchase.shopIndex].shopId,
                            method: purchase.method,
                            account: userAccount,
                            phone: phoneHash,
                        })
                    )
                        .to.emit(ledgerContract, "SavedPurchase")
                        .withArgs(
                            purchase.purchaseId,
                            purchase.timestamp,
                            purchaseAmount,
                            purchase.currency.toLowerCase(),
                            shopData[purchase.shopIndex].shopId,
                            purchase.method,
                            userAccount,
                            phoneHash
                        )
                        .emit(ledgerContract, "ProvidedPoint")
                        .withNamedArgs({
                            account: userAccount,
                            providedPoint: amt,
                            providedValue: amt,
                            purchaseId: purchase.purchaseId,
                        });
                }
            });
        });

        context("Pay point", () => {
            it("Pay point - Success", async () => {
                const purchase = {
                    purchaseId: "P000100",
                    timestamp: 1672849000,
                    amount: 300,
                    method: 0,
                    currency: "krw",
                    shopIndex: 1,
                    userIndex: 0,
                };

                const nonce = await ledgerContract.nonceOf(userWallets[purchase.userIndex].address);
                const paymentId = ContractUtils.getPaymentId(userWallets[purchase.userIndex].address, nonce);
                const purchaseAmount = Amount.make(purchase.amount, 18).value;
                const shop = shopData[purchase.shopIndex];
                const signature = await ContractUtils.signLoyaltyNewPayment(
                    userWallets[purchase.userIndex],
                    paymentId,
                    purchase.purchaseId,
                    purchaseAmount,
                    purchase.currency,
                    shop.shopId,
                    nonce
                );

                const amt = purchaseAmount.mul(shop.providePercent).div(100);
                await expect(
                    ledgerContract.connect(relay).openNewLoyaltyPayment({
                        paymentId,
                        purchaseId: purchase.purchaseId,
                        amount: purchaseAmount,
                        currency: purchase.currency.toLowerCase(),
                        shopId: shop.shopId,
                        account: userWallets[purchase.userIndex].address,
                        signature,
                    })
                ).to.emit(ledgerContract, "LoyaltyPaymentEvent");

                const paymentData = await ledgerContract.loyaltyPaymentOf(paymentId);
                expect(paymentData.paymentId).to.deep.equal(paymentId);
                expect(paymentData.purchaseId).to.deep.equal(purchase.purchaseId);
                expect(paymentData.currency).to.deep.equal(purchase.currency);
                expect(paymentData.shopId).to.deep.equal(shop.shopId);
                expect(paymentData.account).to.deep.equal(userWallets[purchase.userIndex].address);
                expect(paymentData.loyaltyType).to.deep.equal(0);
                expect(paymentData.paidPoint).to.deep.equal(purchaseAmount);
                expect(paymentData.paidValue).to.deep.equal(purchaseAmount);

                await expect(ledgerContract.connect(relay).closeNewLoyaltyPayment(paymentId, true))
                    .to.emit(ledgerContract, "ProvidedTokenForSettlement")
                    .withNamedArgs({
                        account: settlements.address,
                        shopId: shop.shopId,
                        providedPoint: Amount.make(200, 18).value,
                    })
                    .to.emit(ledgerContract, "LoyaltyPaymentEvent");

                const shopInfo = await shopCollection.shopOf(shop.shopId);
                expect(shopInfo.providedPoint).to.equal(Amount.make(100, 18).value);
                expect(shopInfo.usedPoint).to.equal(Amount.make(300, 18).value);
                expect(shopInfo.settledPoint).to.equal(Amount.make(200, 18).value);
            });
        });

        context("Change loyalty type", () => {
            it("Check loyalty type - before", async () => {
                const userIndex = 0;
                const loyaltyType = await ledgerContract.loyaltyTypeOf(userWallets[userIndex].address);
                expect(loyaltyType).to.equal(0);
            });

            it("Send loyalty type", async () => {
                const userIndex = 0;
                const nonce = await ledgerContract.nonceOf(userWallets[userIndex].address);
                const signature = await ContractUtils.signLoyaltyType(userWallets[userIndex], nonce);
                const uri = URI(serverURL).directory("/v1/ledger/changeToLoyaltyToken");
                const url = uri.toString();
                const response = await client.post(url, {
                    account: userWallets[userIndex].address,
                    signature,
                });

                expect(response.data.code).to.equal(0);
                expect(response.data.data).to.not.equal(undefined);
                expect(response.data.data.txHash).to.match(/^0x[A-Fa-f0-9]{64}$/i);
            });

            it("Check point type - after", async () => {
                const userIndex = 0;
                const loyaltyType = await ledgerContract.loyaltyTypeOf(userWallets[userIndex].address);
                expect(loyaltyType).to.equal(1);
            });
        });

        context("Deposit token", () => {
            it("Deposit token - Success", async () => {
                const oldTokenBalance = await ledgerContract.tokenBalanceOf(userWallets[0].address);
                await tokenContract.connect(userWallets[0]).approve(ledgerContract.address, amount.value);
                await expect(ledgerContract.connect(userWallets[0]).deposit(amount.value))
                    .to.emit(ledgerContract, "Deposited")
                    .withNamedArgs({
                        account: userWallets[0].address,
                        depositedToken: amount.value,
                        balanceToken: oldTokenBalance.add(amount.value),
                    });
                expect(await ledgerContract.tokenBalanceOf(userWallets[0].address)).to.deep.equal(
                    oldTokenBalance.add(amount.value)
                );
            });
        });

        context("Pay token", () => {
            it("Pay token - Success", async () => {
                const purchase: IPurchaseData = {
                    purchaseId: "P000200",
                    timestamp: 1672849000,
                    amount: 500,
                    method: 0,
                    currency: "krw",
                    shopIndex: 2,
                    userIndex: 0,
                };

                const nonce = await ledgerContract.nonceOf(userWallets[purchase.userIndex].address);
                const paymentId = ContractUtils.getPaymentId(userWallets[purchase.userIndex].address, nonce);
                const purchaseAmount = Amount.make(purchase.amount, 18).value;
                const tokenAmount = purchaseAmount.mul(multiple).div(price);
                const oldFoundationTokenBalance = await ledgerContract.tokenBalanceOf(foundation.address);
                const shop = shopData[purchase.shopIndex];
                const signature = await ContractUtils.signLoyaltyNewPayment(
                    userWallets[purchase.userIndex],
                    paymentId,
                    purchase.purchaseId,
                    purchaseAmount,
                    purchase.currency,
                    shop.shopId,
                    nonce
                );

                await expect(
                    ledgerContract.connect(relay).openNewLoyaltyPayment({
                        purchaseId: purchase.purchaseId,
                        paymentId,
                        amount: purchaseAmount,
                        currency: purchase.currency.toLowerCase(),
                        shopId: shop.shopId,
                        account: userWallets[purchase.userIndex].address,
                        signature,
                    })
                ).to.emit(ledgerContract, "LoyaltyPaymentEvent");

                const paymentData = await ledgerContract.loyaltyPaymentOf(paymentId);
                expect(paymentData.paymentId).to.deep.equal(paymentId);
                expect(paymentData.purchaseId).to.deep.equal(purchase.purchaseId);
                expect(paymentData.currency).to.deep.equal(purchase.currency);
                expect(paymentData.shopId).to.deep.equal(shop.shopId);
                expect(paymentData.account).to.deep.equal(userWallets[purchase.userIndex].address);
                expect(paymentData.loyaltyType).to.deep.equal(1);
                expect(paymentData.paidToken).to.deep.equal(tokenAmount);
                expect(paymentData.paidValue).to.deep.equal(purchaseAmount);

                await expect(ledgerContract.connect(relay).closeNewLoyaltyPayment(paymentId, true)).to.emit(
                    ledgerContract,
                    "LoyaltyPaymentEvent"
                );

                const shopInfo2 = await shopCollection.shopOf(shop.shopId);
                expect(shopInfo2.providedPoint).to.equal(Amount.make(100, 18).value);
                expect(shopInfo2.usedPoint).to.equal(Amount.make(500, 18).value);
                expect(shopInfo2.settledPoint).to.equal(Amount.make(400, 18).value);

                const settledToken = shopInfo2.settledPoint.mul(multiple).div(price);
                expect((await ledgerContract.tokenBalanceOf(foundation.address)).toString()).to.deep.equal(
                    oldFoundationTokenBalance.add(tokenAmount).sub(settledToken).toString()
                );
            });
        });

        context("Withdrawal of settlement", () => {
            const shopIndex = 2;
            const shop = shopData[shopIndex];
            const amount2 = Amount.make(400, 18).value;

            it("Check Settlement", async () => {
                const withdrawalAmount = await shopCollection.withdrawableOf(shop.shopId);
                expect(withdrawalAmount).to.equal(amount2);
            });

            it("Get info of shop", async () => {
                const url = URI(serverURL)
                    .directory("/v1/payment/shop")
                    .filename("info")
                    .addQuery("shopId", shopData[shopIndex].shopId)
                    .toString();
                const response = await client.get(url);
                expect(response.data.code).to.equal(0);
                assert.deepStrictEqual(response.data.data, {
                    shopId: shopData[shopIndex].shopId,
                    name: "Shop3",
                    provideWaitTime: 0,
                    providePercent: 0,
                    status: 1,
                    account: shopData[shopIndex].wallet.address,
                    providedPoint: "100000000000000000000",
                    usedPoint: "500000000000000000000",
                    settledPoint: "400000000000000000000",
                    withdrawnPoint: "0",
                });
            });

            it("Open Withdrawal", async () => {
                const nonce = await shopCollection.nonceOf(shopData[shopIndex].wallet.address);
                const signature = await ContractUtils.signShop(
                    shopData[shopIndex].wallet,
                    shopData[shopIndex].shopId,
                    nonce
                );

                const uri = URI(serverURL).directory("/v1/shop/withdrawal").filename("open");
                const url = uri.toString();
                const response = await client.post(url, {
                    shopId: shopData[shopIndex].shopId,
                    amount: amount2.toString(),
                    account: shopData[shopIndex].wallet.address,
                    signature,
                });

                expect(response.data.code).to.equal(0);
                expect(response.data.data).to.not.equal(undefined);
                expect(response.data.data.txHash).to.match(/^0x[A-Fa-f0-9]{64}$/i);

                const withdrawalAmount = await shopCollection.withdrawableOf(shop.shopId);
                expect(withdrawalAmount).to.equal(amount2);
            });

            it("Get withdrawal of shop", async () => {
                const url = URI(serverURL)
                    .directory("/v1/payment/shop")
                    .filename("withdrawal")
                    .addQuery("shopId", shopData[shopIndex].shopId)
                    .toString();
                const response = await client.get(url);
                expect(response.data.code).to.equal(0);
                assert.deepStrictEqual(response.data.data, {
                    shopId: shopData[shopIndex].shopId,
                    withdrawAmount: "400000000000000000000",
                    withdrawStatus: "Opened",
                });
            });

            it("Close Withdrawal", async () => {
                const nonce = await shopCollection.nonceOf(shopData[shopIndex].wallet.address);
                const signature = await ContractUtils.signShop(
                    shopData[shopIndex].wallet,
                    shopData[shopIndex].shopId,
                    nonce
                );

                const uri = URI(serverURL).directory("/v1/shop/withdrawal").filename("close");
                const url = uri.toString();
                const response = await client.post(url, {
                    shopId: shopData[shopIndex].shopId,
                    account: shopData[shopIndex].wallet.address,
                    signature,
                });

                expect(response.data.code).to.equal(0);
                expect(response.data.data).to.not.equal(undefined);
                expect(response.data.data.txHash).to.match(/^0x[A-Fa-f0-9]{64}$/i);

                const withdrawalAmount = await shopCollection.withdrawableOf(shop.shopId);
                expect(withdrawalAmount).to.equal(0);
            });

            it("Get info of shop", async () => {
                const url = URI(serverURL)
                    .directory("/v1/payment/shop")
                    .filename("info")
                    .addQuery("shopId", shopData[shopIndex].shopId)
                    .toString();
                const response = await client.get(url);
                expect(response.data.code).to.equal(0);
                assert.deepStrictEqual(response.data.data, {
                    shopId: shopData[shopIndex].shopId,
                    name: "Shop3",
                    provideWaitTime: 0,
                    providePercent: 0,
                    status: 1,
                    account: shopData[shopIndex].wallet.address,
                    providedPoint: "100000000000000000000",
                    usedPoint: "500000000000000000000",
                    settledPoint: "400000000000000000000",
                    withdrawnPoint: "400000000000000000000",
                });
            });

            it("Get withdrawal of shop", async () => {
                const url = URI(serverURL)
                    .directory("/v1/payment/shop")
                    .filename("withdrawal")
                    .addQuery("shopId", shopData[shopIndex].shopId)
                    .toString();
                const response = await client.get(url);
                expect(response.data.code).to.equal(0);
                assert.deepStrictEqual(response.data.data, {
                    shopId: shopData[shopIndex].shopId,
                    withdrawAmount: "400000000000000000000",
                    withdrawStatus: "Closed",
                });
            });
        });
    });
});
