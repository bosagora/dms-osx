import { Amount } from "../src/common/Amount";
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

import chai, { expect } from "chai";
import { solidity } from "ethereum-waffle";

import { BigNumber, Wallet } from "ethers";

import assert from "assert";
import path from "path";
import URI from "urijs";
import { URL } from "url";

// tslint:disable-next-line:no-implicit-dependencies
import { AddressZero } from "@ethersproject/constants";

import { Deployments } from "./helper/Deployments";
import { getPurchaseId, TestClient, TestServer } from "./helper/Utility";

chai.use(solidity);

interface IPurchaseData {
    purchaseId: string;
    amount: number;
    providePercent: number;
    currency: string;
    userIndex: number;
    shopIndex: number;
}

interface IShopData {
    shopId: string;
    name: string;
    currency: string;
    wallet: Wallet;
}

interface IUserData {
    phone: string;
    address: string;
    privateKey: string;
}

describe("Test for Shop", () => {
    const deployments = new Deployments();

    const userWallets = deployments.accounts.users;
    const shopWallets = deployments.accounts.shops;

    let validatorContract: Validator;
    let tokenContract: ERC20DelegatedTransfer;
    let linkContract: PhoneLinkCollection;
    let currencyRateContract: CurrencyRate;
    let shopContract: Shop;
    let consumerContract: LoyaltyConsumer;
    let providerContract: LoyaltyProvider;
    let exchangerContract: LoyaltyExchanger;
    let ledgerContract: Ledger;

    const multiple = BigNumber.from(1000000000);
    const price = BigNumber.from(150).mul(multiple);

    const amount = Amount.make(20_000, 18);

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
                purchaseId: getPurchaseId(),
                amount: 10000,
                providePercent: 1,
                currency: "krw",
                shopIndex: 0,
                userIndex: 0,
            },
            {
                purchaseId: getPurchaseId(),
                amount: 10000,
                providePercent: 1,
                currency: "krw",
                shopIndex: 0,
                userIndex: 0,
            },
            {
                purchaseId: getPurchaseId(),
                amount: 10000,
                providePercent: 1,
                currency: "krw",
                shopIndex: 0,
                userIndex: 0,
            },
            {
                purchaseId: getPurchaseId(),
                amount: 10000,
                providePercent: 1,
                currency: "krw",
                shopIndex: 1,
                userIndex: 0,
            },
            {
                purchaseId: getPurchaseId(),
                amount: 10000,
                providePercent: 1,
                currency: "krw",
                shopIndex: 2,
                userIndex: 0,
            },
            {
                purchaseId: getPurchaseId(),
                amount: 10000,
                providePercent: 1,
                currency: "krw",
                shopIndex: 3,
                userIndex: 0,
            },
        ];

        const shopData: IShopData[] = [
            {
                shopId: "F000100",
                name: "Shop1",
                currency: "krw",
                wallet: shopWallets[0],
            },
            {
                shopId: "F000200",
                name: "Shop2",
                currency: "krw",
                wallet: shopWallets[1],
            },
            {
                shopId: "F000300",
                name: "Shop3",
                currency: "krw",
                wallet: shopWallets[2],
            },
            {
                shopId: "F000400",
                name: "Shop4",
                currency: "krw",
                wallet: shopWallets[3],
            },
            {
                shopId: "F000500",
                name: "Shop5",
                currency: "krw",
                wallet: shopWallets[4],
            },
            {
                shopId: "F000600",
                name: "Shop6",
                currency: "krw",
                wallet: shopWallets[5],
            },
        ];

        before("Set Shop ID", async () => {
            for (const elem of shopData) {
                elem.shopId = ContractUtils.getShopId(elem.wallet.address);
            }
        });

        before("Deploy", async () => {
            deployments.setShopData(shopData);
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
            config.relay.callbackEndpoint = `http://127.0.0.1:${config.server.port}/callback`;
        });

        before("Create TestServer", async () => {
            serverURL = new URL(`http://127.0.0.1:${config.server.port}`);
            storage = await RelayStorage.make(config.database);
            const graph = await GraphStorage.make(config.graph);
            server = new TestServer(config, storage, graph);
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
                    const loyaltyAmount = ContractUtils.zeroGWEI(purchaseAmount.mul(purchase.providePercent).div(100));
                    const amt = ContractUtils.zeroGWEI(purchaseAmount.mul(purchase.providePercent).div(100));
                    const userAccount =
                        userData[purchase.userIndex].address.trim() !== ""
                            ? userData[purchase.userIndex].address.trim()
                            : AddressZero;
                    const purchaseParam = {
                        purchaseId: purchase.purchaseId,
                        amount: purchaseAmount,
                        loyalty: loyaltyAmount,
                        currency: purchase.currency.toLowerCase(),
                        shopId: shopData[purchase.shopIndex].shopId,
                        account: userAccount,
                        phone: phoneHash,
                        sender: deployments.accounts.foundation.address,
                    };
                    const purchaseMessage = ContractUtils.getPurchasesMessage(0, [purchaseParam]);
                    const signatures = deployments.accounts.validators.map((m) =>
                        ContractUtils.signMessage(m, purchaseMessage)
                    );
                    await expect(
                        providerContract
                            .connect(deployments.accounts.validators[0])
                            .savePurchase(0, [purchaseParam], signatures)
                    )
                        .to.emit(providerContract, "SavedPurchase")
                        .withArgs(
                            purchase.purchaseId,
                            purchaseAmount,
                            loyaltyAmount,
                            purchase.currency.toLowerCase(),
                            shopData[purchase.shopIndex].shopId,
                            userAccount,
                            phoneHash,
                            deployments.accounts.foundation.address
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
                    purchaseId: getPurchaseId(),
                    amount: 300,
                    providePercent: 10,
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

                const [secret, secretLock] = ContractUtils.getSecret();
                await expect(
                    consumerContract.connect(deployments.accounts.certifier).openNewLoyaltyPayment({
                        paymentId,
                        purchaseId: purchase.purchaseId,
                        amount: purchaseAmount,
                        currency: purchase.currency.toLowerCase(),
                        shopId: shop.shopId,
                        account: userWallets[purchase.userIndex].address,
                        signature,
                        secretLock,
                    })
                ).to.emit(consumerContract, "LoyaltyPaymentEvent");

                const paymentData = await consumerContract.loyaltyPaymentOf(paymentId);
                expect(paymentData.paymentId).to.deep.equal(paymentId);
                expect(paymentData.purchaseId).to.deep.equal(purchase.purchaseId);
                expect(paymentData.currency).to.deep.equal(purchase.currency);
                expect(paymentData.shopId).to.deep.equal(shop.shopId);
                expect(paymentData.account).to.deep.equal(userWallets[purchase.userIndex].address);
                expect(paymentData.loyaltyType).to.deep.equal(0);
                expect(paymentData.paidPoint).to.deep.equal(purchaseAmount);
                expect(paymentData.paidValue).to.deep.equal(purchaseAmount);

                await expect(
                    consumerContract
                        .connect(deployments.accounts.certifier)
                        .closeNewLoyaltyPayment(paymentId, secret, true)
                )
                    .to.emit(consumerContract, "ProvidedTokenForSettlement")
                    .withNamedArgs({
                        account: deployments.accounts.settlements.address,
                        shopId: shop.shopId,
                        providedPoint: Amount.make(200, 18).value,
                    })
                    .to.emit(consumerContract, "LoyaltyPaymentEvent");

                const shopInfo = await shopContract.shopOf(shop.shopId);
                expect(shopInfo.providedAmount).to.equal(Amount.make(100, 18).value);
                expect(shopInfo.usedAmount).to.equal(Amount.make(300, 18).value);
                expect(shopInfo.settledAmount).to.equal(Amount.make(200, 18).value);
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
                    purchaseId: getPurchaseId(),
                    amount: 500,
                    providePercent: 10,
                    currency: "krw",
                    shopIndex: 2,
                    userIndex: 0,
                };

                const nonce = await ledgerContract.nonceOf(userWallets[purchase.userIndex].address);
                const paymentId = ContractUtils.getPaymentId(userWallets[purchase.userIndex].address, nonce);
                const purchaseAmount = Amount.make(purchase.amount, 18).value;
                const tokenAmount = ContractUtils.zeroGWEI(purchaseAmount.mul(multiple).div(price));
                const oldFoundationTokenBalance = await ledgerContract.tokenBalanceOf(
                    deployments.accounts.foundation.address
                );
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

                const [secret, secretLock] = ContractUtils.getSecret();
                await expect(
                    consumerContract.connect(deployments.accounts.certifier).openNewLoyaltyPayment({
                        purchaseId: purchase.purchaseId,
                        paymentId,
                        amount: purchaseAmount,
                        currency: purchase.currency.toLowerCase(),
                        shopId: shop.shopId,
                        account: userWallets[purchase.userIndex].address,
                        signature,
                        secretLock,
                    })
                ).to.emit(consumerContract, "LoyaltyPaymentEvent");

                const paymentData = await consumerContract.loyaltyPaymentOf(paymentId);
                expect(paymentData.paymentId).to.deep.equal(paymentId);
                expect(paymentData.purchaseId).to.deep.equal(purchase.purchaseId);
                expect(paymentData.currency).to.deep.equal(purchase.currency);
                expect(paymentData.shopId).to.deep.equal(shop.shopId);
                expect(paymentData.account).to.deep.equal(userWallets[purchase.userIndex].address);
                expect(paymentData.loyaltyType).to.deep.equal(1);
                expect(paymentData.paidToken).to.deep.equal(tokenAmount);
                expect(paymentData.paidValue).to.deep.equal(purchaseAmount);

                await expect(
                    consumerContract
                        .connect(deployments.accounts.certifier)
                        .closeNewLoyaltyPayment(paymentId, secret, true)
                ).to.emit(consumerContract, "LoyaltyPaymentEvent");

                const shopInfo2 = await shopContract.shopOf(shop.shopId);
                expect(shopInfo2.providedAmount).to.equal(Amount.make(100, 18).value);
                expect(shopInfo2.usedAmount).to.equal(Amount.make(500, 18).value);
                expect(shopInfo2.settledAmount).to.equal(Amount.make(400, 18).value);

                const settledToken = ContractUtils.zeroGWEI(shopInfo2.settledAmount.mul(multiple).div(price));
                expect(
                    (await ledgerContract.tokenBalanceOf(deployments.accounts.foundation.address)).toString()
                ).to.deep.equal(oldFoundationTokenBalance.add(tokenAmount).sub(settledToken).toString());
            });
        });

        context("Withdrawal of settlement", () => {
            const shopIndex = 2;
            const shop = shopData[shopIndex];
            const amount2 = Amount.make(400, 18).value;

            it("Check Settlement", async () => {
                const withdrawalAmount = await shopContract.withdrawableOf(shop.shopId);
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
                    currency: "krw",
                    status: 1,
                    account: shopData[shopIndex].wallet.address,
                    providedAmount: "100000000000000000000",
                    usedAmount: "500000000000000000000",
                    settledAmount: "400000000000000000000",
                    withdrawnAmount: "0",
                });
            });

            it("Open Withdrawal", async () => {
                const nonce = await shopContract.nonceOf(shopData[shopIndex].wallet.address);
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

                const withdrawalAmount = await shopContract.withdrawableOf(shop.shopId);
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
                const nonce = await shopContract.nonceOf(shopData[shopIndex].wallet.address);
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

                const withdrawalAmount = await shopContract.withdrawableOf(shop.shopId);
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
                    currency: "krw",
                    status: 1,
                    account: shopData[shopIndex].wallet.address,
                    providedAmount: "100000000000000000000",
                    usedAmount: "500000000000000000000",
                    settledAmount: "400000000000000000000",
                    withdrawnAmount: "400000000000000000000",
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
