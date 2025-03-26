import "@nomiclabs/hardhat-ethers";
import "@nomiclabs/hardhat-waffle";

import { Amount } from "../src/common/Amount";
import { Config } from "../src/common/Config";
import { ContractManager } from "../src/contract/ContractManager";
import { GraphStorage } from "../src/storage/GraphStorage";
import { RelayStorage } from "../src/storage/RelayStorage";
import { ContractUtils, LoyaltyNetworkID } from "../src/utils/ContractUtils";
import { Ledger, LoyaltyConsumer, LoyaltyProvider, Shop } from "../typechain-types";
import { Deployments } from "./helper/Deployments";
import { getPurchaseId, TestClient, TestServer } from "./helper/Utility";

import chai, { expect } from "chai";
import { solidity } from "ethereum-waffle";

import { Wallet } from "ethers";

import path from "path";
import URI from "urijs";
import { URL } from "url";

import { BigNumber } from "@ethersproject/bignumber";
import { BytesLike } from "@ethersproject/bytes";
import { AddressZero, HashZero } from "@ethersproject/constants";

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
    const config = new Config();
    config.readFromFile(path.resolve(process.cwd(), "config", "config_test.yaml"));
    const contractManager = new ContractManager(config);
    const deployments = new Deployments(config);

    const userWallets = deployments.accounts.users;
    const shopWallets = deployments.accounts.shops;

    let shopContract: Shop;
    let consumerContract: LoyaltyConsumer;
    let providerContract: LoyaltyProvider;
    let ledgerContract: Ledger;

    let client: TestClient;
    let server: TestServer;
    let storage: RelayStorage;
    let serverURL: URL;

    context("Refunds of shops", () => {
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
                elem.shopId = ContractUtils.getShopId(elem.wallet.address, LoyaltyNetworkID.KIOS_TESTNET);
            }
        });

        before("Deploy", async () => {
            deployments.setShopData(shopData);
            await deployments.doDeploy();

            ledgerContract = deployments.getContract("Ledger") as Ledger;
            consumerContract = deployments.getContract("LoyaltyConsumer") as LoyaltyConsumer;
            providerContract = deployments.getContract("LoyaltyProvider") as LoyaltyProvider;
            shopContract = deployments.getContract("Shop") as Shop;
        });

        before("Create Config", async () => {
            config.contracts.sideChain.tokenAddress = deployments.getContractAddress("SideChainKIOS") || "";
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
            config.contracts.sideChain.innerBridgeContract =
                deployments.getContractAddress("SideChainInnerBridge") || "";

            config.contracts.mainChain.tokenAddress = deployments.getContractAddress("MainChainKIOS") || "";
            config.contracts.mainChain.loyaltyBridgeAddress =
                deployments.getContractAddress("MainChainLoyaltyBridge") || "";
            config.contracts.mainChain.innerBridgeContract =
                deployments.getContractAddress("MainChainInnerBridge") || "";
            config.contracts.mainChain.outerBridgeContract =
                deployments.getContractAddress("MainChainOuterBridge") || "";

            config.contracts.outerChain.tokenAddress = deployments.getContractAddress("OuterChainKIOS") || "";
            config.contracts.outerChain.outerBridgeContract =
                deployments.getContractAddress("OuterChainOuterBridge") || "";

            config.relay.certifiers = deployments.accounts.certifiers.map((m) => m.privateKey);
            config.relay.callbackEndpoint = `http://127.0.0.1:${config.server.port}/callback`;
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
            const graph_sidechain = await GraphStorage.make(config.graph_sidechain);
            const graph_mainchain = await GraphStorage.make(config.graph_mainchain);
            await contractManager.attach();
            server = new TestServer(config, contractManager, storage, graph_sidechain, graph_mainchain);
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
                        sender: deployments.accounts.system.address,
                        signature: "",
                    };
                    purchaseParam.signature = await ContractUtils.getPurchaseSignature(
                        deployments.accounts.system,
                        purchaseParam,
                        contractManager.sideChainId
                    );
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
                        .withArgs(
                            purchase.purchaseId,
                            purchaseAmount,
                            loyaltyAmount,
                            purchase.currency.toLowerCase(),
                            shopData[purchase.shopIndex].shopId,
                            userAccount,
                            phoneHash,
                            deployments.accounts.system.address
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
                    nonce,
                    contractManager.sideChainId
                );

                const [secret, secretLock] = ContractUtils.getSecret();
                await expect(
                    consumerContract.connect(deployments.accounts.certifiers[0]).openNewLoyaltyPayment({
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
                expect(paymentData.paidPoint).to.deep.equal(purchaseAmount);
                expect(paymentData.paidValue).to.deep.equal(purchaseAmount);

                await expect(
                    consumerContract
                        .connect(deployments.accounts.certifiers[0])
                        .closeNewLoyaltyPayment(paymentId, secret, true)
                ).to.emit(consumerContract, "LoyaltyPaymentEvent");

                const shopInfo = await shopContract.shopOf(shop.shopId);
                expect(shopInfo.providedAmount).to.equal(Amount.make(100, 18).value);
                expect(shopInfo.usedAmount).to.equal(Amount.make(300, 18).value);
            });
        });

        it("Provide Loyalty Point - Save Purchase Data", async () => {
            const phoneHash = ContractUtils.getPhoneHash("");
            const purchaseAmount = Amount.make(100_000_000, 18).value;
            const loyaltyAmount = purchaseAmount.mul(10).div(100);
            const purchaseParam = await Promise.all(
                userData.map(async (m) => {
                    const purchaseItem = {
                        purchaseId: getPurchaseId(),
                        amount: purchaseAmount,
                        loyalty: loyaltyAmount,
                        currency: "krw",
                        shopId: shopData[0].shopId,
                        account: m.address,
                        phone: phoneHash,
                        sender: deployments.accounts.system.address,
                        signature: "",
                    };
                    purchaseItem.signature = await ContractUtils.getPurchaseSignature(
                        deployments.accounts.system,
                        purchaseItem,
                        contractManager.sideChainId
                    );
                    return purchaseItem;
                })
            );
            const purchaseMessage = ContractUtils.getPurchasesMessage(0, purchaseParam, contractManager.sideChainId);
            const signatures = await Promise.all(
                deployments.accounts.validators.map((m) => ContractUtils.signMessage(m, purchaseMessage))
            );
            const proposeMessage = ContractUtils.getPurchasesProposeMessage(
                0,
                purchaseParam,
                signatures,
                contractManager.sideChainId
            );
            const proposerSignature = await ContractUtils.signMessage(
                deployments.accounts.validators[0],
                proposeMessage
            );
            await providerContract
                .connect(deployments.accounts.certifiers[0])
                .savePurchase(0, purchaseParam, signatures, proposerSignature);

            for (const user of userData) {
                expect(await ledgerContract.pointBalanceOf(user.address)).to.equal(loyaltyAmount);
            }
        });

        context("Pay", () => {
            it("Pay - Success", async () => {
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
                const shop = shopData[purchase.shopIndex];
                const signature = await ContractUtils.signLoyaltyNewPayment(
                    userWallets[purchase.userIndex],
                    paymentId,
                    purchase.purchaseId,
                    purchaseAmount,
                    purchase.currency,
                    shop.shopId,
                    nonce,
                    contractManager.sideChainId
                );

                const [secret, secretLock] = ContractUtils.getSecret();
                await expect(
                    consumerContract.connect(deployments.accounts.certifiers[0]).openNewLoyaltyPayment({
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
                expect(paymentData.paidPoint).to.deep.equal(purchaseAmount);
                expect(paymentData.paidValue).to.deep.equal(purchaseAmount);

                await expect(
                    consumerContract
                        .connect(deployments.accounts.certifiers[0])
                        .closeNewLoyaltyPayment(paymentId, secret, true)
                ).to.emit(consumerContract, "LoyaltyPaymentEvent");

                const shopInfo2 = await shopContract.shopOf(shop.shopId);
                expect(shopInfo2.providedAmount).to.equal(Amount.make(100, 18).value);
                expect(shopInfo2.usedAmount).to.equal(Amount.make(500, 18).value);
            });
        });

        context("refund", () => {
            const shopIndex = 2;
            const shop = shopData[shopIndex];
            const amount2 = Amount.make(400, 18).value;
            let amountToken: BigNumber;

            it("Check refundable amount", async () => {
                const url = URI(serverURL).directory("/v1/shop/refundable/").filename(shop.shopId).toString();
                const response = await client.get(url);
                const refundableAmount = BigNumber.from(response.data.data.refundableAmount);
                expect(refundableAmount).to.equal(amount2);
                amountToken = BigNumber.from(response.data.data.refundableToken);
            });

            it("Get info of shop", async () => {
                const url = URI(serverURL).directory("/v1/shop/info").filename(shop.shopId).toString();
                const response = await client.get(url);
                expect(response.data.code).to.equal(0);
                expect(response.data.data).to.deep.equal({
                    shopId: shop.shopId,
                    name: "Shop3",
                    currency: "krw",
                    status: 1,
                    delegator: "0x0000000000000000000000000000000000000000",
                    account: shop.wallet.address,
                    providedAmount: "100000000000000000000",
                    usedAmount: "500000000000000000000",
                    collectedAmount: "0",
                    refundedAmount: "0",
                });
            });

            it("refund", async () => {
                const nonce = await shopContract.nonceOf(shop.wallet.address);
                const message = ContractUtils.getShopRefundMessage(
                    shop.shopId,
                    amount2,
                    nonce,
                    contractManager.sideChainId
                );
                const signature = await ContractUtils.signMessage(shop.wallet, message);

                const uri = URI(serverURL).directory("/v1/shop").filename("refund");
                const url = uri.toString();
                const response = await client.post(url, {
                    shopId: shop.shopId,
                    amount: amount2.toString(),
                    account: shop.wallet.address,
                    signature,
                });

                expect(response.data.code).to.equal(0);
                expect(response.data.data).to.not.equal(undefined);
                expect(response.data.data.txHash).to.match(/^0x[A-Fa-f0-9]{64}$/i);
            });

            it("Check refundable amount", async () => {
                const url = URI(serverURL).directory("/v1/shop/refundable/").filename(shop.shopId).toString();
                const response = await client.get(url);
                const refundableAmount = BigNumber.from(response.data.data.refundableAmount);
                expect(refundableAmount).to.equal(0);
            });

            it("Check balance of ledger", async () => {
                const url = URI(serverURL)
                    .directory("/v1/ledger/balance/account/")
                    .filename(shop.wallet.address)
                    .toString();
                const response = await client.get(url);
                const balance = BigNumber.from(response.data.data.token.balance);
                expect(balance).to.equal(amountToken);
            });

            it("Get info of shop", async () => {
                const url = URI(serverURL).directory("/v1/shop/info").filename(shop.shopId).toString();
                const response = await client.get(url);
                expect(response.data.code).to.equal(0);
                expect(response.data.data).to.deep.equal({
                    shopId: shop.shopId,
                    name: "Shop3",
                    currency: "krw",
                    status: 1,
                    account: shop.wallet.address,
                    delegator: "0x0000000000000000000000000000000000000000",
                    providedAmount: "100000000000000000000",
                    usedAmount: "500000000000000000000",
                    collectedAmount: "0",
                    refundedAmount: "400000000000000000000",
                });
            });
        });
    });

    context("Refunds of shops 2", () => {
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
                shopIndex: 1,
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
                shopIndex: 2,
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
                amount: 10000000,
                providePercent: 1,
                currency: "krw",
                shopIndex: 5,
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
                elem.shopId = ContractUtils.getShopId(elem.wallet.address, LoyaltyNetworkID.KIOS_TESTNET);
            }
        });

        before("Deploy", async () => {
            deployments.setShopData(shopData);
            await deployments.doDeploy();

            ledgerContract = deployments.getContract("Ledger") as Ledger;
            consumerContract = deployments.getContract("LoyaltyConsumer") as LoyaltyConsumer;
            providerContract = deployments.getContract("LoyaltyProvider") as LoyaltyProvider;
            shopContract = deployments.getContract("Shop") as Shop;
        });

        before("Create Config", async () => {
            config.contracts.sideChain.tokenAddress = deployments.getContractAddress("SideChainKIOS") || "";
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
            config.contracts.sideChain.innerBridgeContract =
                deployments.getContractAddress("SideChainInnerBridge") || "";

            config.contracts.mainChain.tokenAddress = deployments.getContractAddress("MainChainKIOS") || "";
            config.contracts.mainChain.loyaltyBridgeAddress =
                deployments.getContractAddress("MainChainLoyaltyBridge") || "";
            config.contracts.mainChain.innerBridgeContract =
                deployments.getContractAddress("MainChainInnerBridge") || "";
            config.contracts.mainChain.outerBridgeContract =
                deployments.getContractAddress("MainChainOuterBridge") || "";

            config.contracts.outerChain.tokenAddress = deployments.getContractAddress("OuterChainKIOS") || "";
            config.contracts.outerChain.outerBridgeContract =
                deployments.getContractAddress("OuterChainOuterBridge") || "";

            config.relay.certifiers = deployments.accounts.certifiers.map((m) => m.privateKey);
            config.relay.callbackEndpoint = `http://127.0.0.1:${config.server.port}/callback`;
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
            const graph_sidechain = await GraphStorage.make(config.graph_sidechain);
            const graph_mainchain = await GraphStorage.make(config.graph_mainchain);
            await contractManager.attach();
            server = new TestServer(config, contractManager, storage, graph_sidechain, graph_mainchain);
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
                        sender: deployments.accounts.system.address,
                        signature: "",
                    };
                    purchaseParam.signature = await ContractUtils.getPurchaseSignature(
                        deployments.accounts.system,
                        purchaseParam,
                        contractManager.sideChainId
                    );
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
                        .withArgs(
                            purchase.purchaseId,
                            purchaseAmount,
                            loyaltyAmount,
                            purchase.currency.toLowerCase(),
                            shopData[purchase.shopIndex].shopId,
                            userAccount,
                            phoneHash,
                            deployments.accounts.system.address
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
                const providedAmount = [100, 200, 300, 0].map((m) => Amount.make(m, 18).value);
                const usedAmount = [500, 500, 500, 500].map((m) => Amount.make(m, 18).value);
                for (let shopIndex = 0; shopIndex < 4; shopIndex++) {
                    const purchase = {
                        purchaseId: getPurchaseId(),
                        amount: 500,
                        providePercent: 1,
                        currency: "krw",
                        shopIndex,
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
                        nonce,
                        contractManager.sideChainId
                    );

                    const [secret, secretLock] = ContractUtils.getSecret();
                    await expect(
                        consumerContract.connect(deployments.accounts.certifiers[0]).openNewLoyaltyPayment({
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
                    expect(paymentData.paidPoint).to.deep.equal(purchaseAmount);
                    expect(paymentData.paidValue).to.deep.equal(purchaseAmount);

                    await expect(
                        consumerContract
                            .connect(deployments.accounts.certifiers[0])
                            .closeNewLoyaltyPayment(paymentId, secret, true)
                    ).to.emit(consumerContract, "LoyaltyPaymentEvent");

                    const shopInfo = await shopContract.shopOf(shop.shopId);
                    expect(shopInfo.providedAmount).to.equal(providedAmount[shopIndex]);
                    expect(shopInfo.usedAmount).to.equal(usedAmount[shopIndex]);
                }
            });
        });

        context("setSettlementManager/removeSettlementManager", () => {
            const managerShop = shopData[4];
            const clients: BytesLike[] = [];

            it("prepare", async () => {
                for (let shopIndex = 0; shopIndex < 4; shopIndex++) {
                    clients.push(shopData[shopIndex].shopId);
                }
            });

            it("setSettlementManager", async () => {
                for (let shopIndex = 0; shopIndex < 4; shopIndex++) {
                    const shop = shopData[shopIndex];
                    const nonce = await shopContract.nonceOf(shop.wallet.address);
                    const message = ContractUtils.getSetSettlementManagerMessage(
                        shop.shopId,
                        managerShop.shopId,
                        nonce,
                        contractManager.sideChainId
                    );
                    const signature = await ContractUtils.signMessage(shop.wallet, message);

                    const uri = URI(serverURL).directory("/v1/shop/settlement/manager").filename("set");
                    const url = uri.toString();
                    const response = await client.post(url, {
                        shopId: shop.shopId,
                        account: shop.wallet.address,
                        managerId: managerShop.shopId,
                        signature,
                    });

                    expect(response.data.code).to.equal(0);
                    expect(response.data.data).to.not.equal(undefined);
                    expect(response.data.data.txHash).to.match(/^0x[A-Fa-f0-9]{64}$/i);
                }
            });

            it("check manager", async () => {
                for (let shopIndex = 0; shopIndex < 4; shopIndex++) {
                    const shop = shopData[shopIndex];
                    const uri = URI(serverURL).directory("/v1/shop/settlement/manager/get").filename(shop.shopId);
                    const url = uri.toString();
                    const response = await client.get(url);
                    expect(response.data.code).to.equal(0);
                    expect(response.data.data).to.not.equal(undefined);
                    expect(response.data.data.managerId).to.be.equal(managerShop.shopId);
                }
            });

            it("check client", async () => {
                const uri = URI(serverURL)
                    .directory("/v1/shop/settlement/client/length")
                    .filename(managerShop.shopId)
                    .toString();
                const response = await client.get(uri);
                expect(response.data.data.length).to.be.equal(clients.length);

                const response2 = await client.get(
                    URI(serverURL)
                        .directory("/v1/shop/settlement/client/list")
                        .filename(managerShop.shopId)
                        .addQuery("startIndex", 0)
                        .addQuery("endIndex", 2)
                        .toString()
                );
                expect(response2.data.data.clients).to.deep.equal(clients.slice(0, 2));
            });

            it("removeSettlementManager", async () => {
                for (let shopIndex = 0; shopIndex < 4; shopIndex++) {
                    const shop = shopData[shopIndex];
                    const nonce = await shopContract.nonceOf(shop.wallet.address);
                    const message = ContractUtils.getRemoveSettlementManagerMessage(
                        shop.shopId,
                        nonce,
                        contractManager.sideChainId
                    );
                    const signature = await ContractUtils.signMessage(shop.wallet, message);

                    const uri = URI(serverURL).directory("/v1/shop/settlement/manager").filename("remove");
                    const url = uri.toString();
                    const response = await client.post(url, {
                        shopId: shop.shopId,
                        account: shop.wallet.address,
                        signature,
                    });

                    expect(response.data.code).to.equal(0);
                    expect(response.data.data).to.not.equal(undefined);
                    expect(response.data.data.txHash).to.match(/^0x[A-Fa-f0-9]{64}$/i);
                }
            });

            it("check manager", async () => {
                for (let shopIndex = 0; shopIndex < 4; shopIndex++) {
                    const shop = shopData[shopIndex];
                    const uri = URI(serverURL).directory("/v1/shop/settlement/manager/get").filename(shop.shopId);
                    const url = uri.toString();
                    const response = await client.get(url);
                    expect(response.data.code).to.equal(0);
                    expect(response.data.data).to.not.equal(undefined);
                    expect(response.data.data.managerId).to.be.equal(HashZero);
                }
            });

            it("check client", async () => {
                const uri = URI(serverURL)
                    .directory("/v1/shop/settlement/client/length")
                    .filename(managerShop.shopId)
                    .toString();
                const response = await client.get(uri);
                expect(response.data.data.length).to.be.equal(0);
            });

            it("setSettlementManager again", async () => {
                for (let shopIndex = 0; shopIndex < 4; shopIndex++) {
                    const shop = shopData[shopIndex];
                    const nonce = await shopContract.nonceOf(shop.wallet.address);
                    const message = ContractUtils.getSetSettlementManagerMessage(
                        shop.shopId,
                        managerShop.shopId,
                        nonce,
                        contractManager.sideChainId
                    );
                    const signature = await ContractUtils.signMessage(shop.wallet, message);

                    const uri = URI(serverURL).directory("/v1/shop/settlement/manager").filename("set");
                    const url = uri.toString();
                    const response = await client.post(url, {
                        shopId: shop.shopId,
                        account: shop.wallet.address,
                        managerId: managerShop.shopId,
                        signature,
                    });

                    expect(response.data.code).to.equal(0);
                    expect(response.data.data).to.not.equal(undefined);
                    expect(response.data.data.txHash).to.match(/^0x[A-Fa-f0-9]{64}$/i);
                }
            });

            it("check manager", async () => {
                for (let shopIndex = 0; shopIndex < 4; shopIndex++) {
                    const shop = shopData[shopIndex];
                    const uri = URI(serverURL).directory("/v1/shop/settlement/manager/get").filename(shop.shopId);
                    const url = uri.toString();
                    const response = await client.get(url);
                    expect(response.data.code).to.equal(0);
                    expect(response.data.data).to.not.equal(undefined);
                    expect(response.data.data.managerId).to.be.equal(managerShop.shopId);
                }
            });

            it("check client", async () => {
                const uri = URI(serverURL)
                    .directory("/v1/shop/settlement/client/length")
                    .filename(managerShop.shopId)
                    .toString();
                const response = await client.get(uri);
                expect(response.data.data.length).to.be.equal(clients.length);

                const response2 = await client.get(
                    URI(serverURL)
                        .directory("/v1/shop/settlement/client/list")
                        .filename(managerShop.shopId)
                        .addQuery("startIndex", 0)
                        .addQuery("endIndex", 2)
                        .toString()
                );
                expect(response2.data.data.clients).to.deep.equal(clients.slice(0, 2));
            });
        });

        context("refund", () => {
            const managerShop = shopData[4];
            const expected = [400, 300, 200, 500].map((m) => Amount.make(m, 18).value);
            const sumExpected = Amount.make(1400, 18).value;
            let amountToken: BigNumber;

            it("Check refundable amount", async () => {
                for (let shopIndex = 0; shopIndex < 4; shopIndex++) {
                    const shop = shopData[shopIndex];
                    const url = URI(serverURL).directory("/v1/shop/refundable/").filename(shop.shopId).toString();
                    const response = await client.get(url);
                    const refundableAmount = BigNumber.from(response.data.data.refundableAmount);
                    expect(refundableAmount).to.equal(expected[shopIndex]);
                }
            });

            it("getCollectSettlementAmountMultiClientMessage", async () => {
                const clientLength = await shopContract.getSettlementClientLength(managerShop.shopId);
                const clients = await shopContract.getSettlementClientList(managerShop.shopId, 0, clientLength);
                const nonce = await shopContract.nonceOf(managerShop.wallet.address);
                const message = ContractUtils.getCollectSettlementAmountMultiClientMessage(
                    managerShop.shopId,
                    clients,
                    nonce,
                    contractManager.sideChainId
                );
                const signature = await ContractUtils.signMessage(managerShop.wallet, message);

                const uri = URI(serverURL).directory("/v1/shop/settlement/collect");
                const url = uri.toString();
                const response = await client.post(url, {
                    shopId: managerShop.shopId,
                    account: managerShop.wallet.address,
                    clients: clients.join(","),
                    signature,
                });

                expect(response.data.code).to.equal(0);
                expect(response.data.data).to.not.equal(undefined);
                expect(response.data.data.txHash).to.match(/^0x[A-Fa-f0-9]{64}$/i);
            });

            it("Check refundable amount", async () => {
                for (let shopIndex = 0; shopIndex < 4; shopIndex++) {
                    const shop = shopData[shopIndex];
                    const url = URI(serverURL).directory("/v1/shop/refundable/").filename(shop.shopId).toString();
                    const response = await client.get(url);
                    const refundableAmount = BigNumber.from(response.data.data.refundableAmount);
                    expect(refundableAmount).to.equal(0);
                }
            });

            it("Check refundable amount of settlement manager", async () => {
                const url = URI(serverURL).directory("/v1/shop/refundable/").filename(managerShop.shopId).toString();
                const response = await client.get(url);
                const refundableAmount = BigNumber.from(response.data.data.refundableAmount);
                expect(refundableAmount).to.equal(sumExpected);
                amountToken = BigNumber.from(response.data.data.refundableToken);
            });

            it("refund", async () => {
                const nonce = await shopContract.nonceOf(managerShop.wallet.address);
                const message = ContractUtils.getShopRefundMessage(
                    managerShop.shopId,
                    sumExpected,
                    nonce,
                    contractManager.sideChainId
                );
                const signature = await ContractUtils.signMessage(managerShop.wallet, message);

                const uri = URI(serverURL).directory("/v1/shop").filename("refund");
                const url = uri.toString();
                const response = await client.post(url, {
                    shopId: managerShop.shopId,
                    amount: sumExpected.toString(),
                    account: managerShop.wallet.address,
                    signature,
                });

                expect(response.data.code).to.equal(0);
                expect(response.data.data).to.not.equal(undefined);
                expect(response.data.data.txHash).to.match(/^0x[A-Fa-f0-9]{64}$/i);
            });

            it("Check refundable amount", async () => {
                const url = URI(serverURL).directory("/v1/shop/refundable/").filename(managerShop.shopId).toString();
                const response = await client.get(url);
                const refundableAmount = BigNumber.from(response.data.data.refundableAmount);
                expect(refundableAmount).to.equal(0);
            });

            it("Check balance of ledger", async () => {
                const url = URI(serverURL)
                    .directory("/v1/ledger/balance/account/")
                    .filename(managerShop.wallet.address)
                    .toString();
                const response = await client.get(url);
                const balance = BigNumber.from(response.data.data.token.balance);
                expect(balance).to.equal(amountToken);
            });

            it("withdrawal", async () => {
                const account = managerShop.wallet.address;
                const adjustedAmount = ContractUtils.zeroGWEI(amountToken);

                const nonce = await contractManager.sideLedgerContract.nonceOf(managerShop.wallet.address);
                const expiry = ContractUtils.getTimeStamp() + 3600;

                const message = ContractUtils.getTransferMessage(
                    contractManager.sideChainId,
                    contractManager.sideTokenContract.address,
                    account,
                    contractManager.sideLoyaltyBridgeContract.address,
                    adjustedAmount,
                    nonce,
                    expiry
                );
                const signature = await ContractUtils.signMessage(managerShop.wallet, message);

                const param = {
                    account,
                    amount: adjustedAmount.toString(),
                    expiry,
                    signature,
                };
                const response = await client.post(
                    URI(serverURL).directory("/v1/ledger/withdraw_via_bridge").toString(),
                    param
                );

                expect(response.data.code).to.equal(0);
                expect(response.data.data).to.not.equal(undefined);
                expect(response.data.data.txHash).to.match(/^0x[A-Fa-f0-9]{64}$/i);
            });
        });
    });

    context("Refunds of shops 3", () => {
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
                shopIndex: 1,
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
                shopIndex: 2,
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
                amount: 10000000,
                providePercent: 1,
                currency: "krw",
                shopIndex: 5,
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
                elem.shopId = ContractUtils.getShopId(elem.wallet.address, LoyaltyNetworkID.KIOS_TESTNET);
            }
        });

        before("Deploy", async () => {
            deployments.setShopData(shopData);
            await deployments.doDeploy();

            ledgerContract = deployments.getContract("Ledger") as Ledger;
            consumerContract = deployments.getContract("LoyaltyConsumer") as LoyaltyConsumer;
            providerContract = deployments.getContract("LoyaltyProvider") as LoyaltyProvider;
            shopContract = deployments.getContract("Shop") as Shop;
        });

        before("Create Config", async () => {
            config.contracts.sideChain.tokenAddress = deployments.getContractAddress("SideChainKIOS") || "";
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
            config.contracts.sideChain.innerBridgeContract =
                deployments.getContractAddress("SideChainInnerBridge") || "";

            config.contracts.mainChain.tokenAddress = deployments.getContractAddress("MainChainKIOS") || "";
            config.contracts.mainChain.loyaltyBridgeAddress =
                deployments.getContractAddress("MainChainLoyaltyBridge") || "";
            config.contracts.mainChain.innerBridgeContract =
                deployments.getContractAddress("MainChainInnerBridge") || "";

            config.relay.certifiers = deployments.accounts.certifiers.map((m) => m.privateKey);
            config.relay.callbackEndpoint = `http://127.0.0.1:${config.server.port}/callback`;
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
            const graph_sidechain = await GraphStorage.make(config.graph_sidechain);
            const graph_mainchain = await GraphStorage.make(config.graph_mainchain);
            await contractManager.attach();
            server = new TestServer(config, contractManager, storage, graph_sidechain, graph_mainchain);
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
                        sender: deployments.accounts.system.address,
                        signature: "",
                    };
                    purchaseParam.signature = await ContractUtils.getPurchaseSignature(
                        deployments.accounts.system,
                        purchaseParam,
                        contractManager.sideChainId
                    );
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
                        .withArgs(
                            purchase.purchaseId,
                            purchaseAmount,
                            loyaltyAmount,
                            purchase.currency.toLowerCase(),
                            shopData[purchase.shopIndex].shopId,
                            userAccount,
                            phoneHash,
                            deployments.accounts.system.address
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
                const providedAmount = [100, 200, 300, 0].map((m) => Amount.make(m, 18).value);
                const usedAmount = [500, 500, 500, 500].map((m) => Amount.make(m, 18).value);
                for (let shopIndex = 0; shopIndex < 4; shopIndex++) {
                    const purchase = {
                        purchaseId: getPurchaseId(),
                        amount: 500,
                        providePercent: 1,
                        currency: "krw",
                        shopIndex,
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
                        nonce,
                        contractManager.sideChainId
                    );

                    const [secret, secretLock] = ContractUtils.getSecret();
                    await expect(
                        consumerContract.connect(deployments.accounts.certifiers[0]).openNewLoyaltyPayment({
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
                    expect(paymentData.paidPoint).to.deep.equal(purchaseAmount);
                    expect(paymentData.paidValue).to.deep.equal(purchaseAmount);

                    await expect(
                        consumerContract
                            .connect(deployments.accounts.certifiers[0])
                            .closeNewLoyaltyPayment(paymentId, secret, true)
                    ).to.emit(consumerContract, "LoyaltyPaymentEvent");

                    const shopInfo = await shopContract.shopOf(shop.shopId);
                    expect(shopInfo.providedAmount).to.equal(providedAmount[shopIndex]);
                    expect(shopInfo.usedAmount).to.equal(usedAmount[shopIndex]);
                }
            });
        });

        context("setSettlementManager/removeSettlementManager", () => {
            const managerShop = shopData[4];
            const clients: BytesLike[] = [];

            it("prepare", async () => {
                for (let shopIndex = 0; shopIndex < 4; shopIndex++) {
                    clients.push(shopData[shopIndex].shopId);
                }
            });

            it("setSettlementManager", async () => {
                for (let shopIndex = 0; shopIndex < 4; shopIndex++) {
                    const shop = shopData[shopIndex];
                    const nonce = await shopContract.nonceOf(shop.wallet.address);
                    const message = ContractUtils.getSetSettlementManagerMessage(
                        shop.shopId,
                        managerShop.shopId,
                        nonce,
                        contractManager.sideChainId
                    );
                    const signature = await ContractUtils.signMessage(shop.wallet, message);

                    const uri = URI(serverURL).directory("/v1/shop/settlement/manager").filename("set");
                    const url = uri.toString();
                    const response = await client.post(url, {
                        shopId: shop.shopId,
                        account: shop.wallet.address,
                        managerId: managerShop.shopId,
                        signature,
                    });

                    expect(response.data.code).to.equal(0);
                    expect(response.data.data).to.not.equal(undefined);
                    expect(response.data.data.txHash).to.match(/^0x[A-Fa-f0-9]{64}$/i);
                }
            });

            it("check manager", async () => {
                for (let shopIndex = 0; shopIndex < 4; shopIndex++) {
                    const shop = shopData[shopIndex];
                    const uri = URI(serverURL).directory("/v1/shop/settlement/manager/get").filename(shop.shopId);
                    const url = uri.toString();
                    const response = await client.get(url);
                    expect(response.data.code).to.equal(0);
                    expect(response.data.data).to.not.equal(undefined);
                    expect(response.data.data.managerId).to.be.equal(managerShop.shopId);
                }
            });

            it("check client", async () => {
                const uri = URI(serverURL)
                    .directory("/v1/shop/settlement/client/length")
                    .filename(managerShop.shopId)
                    .toString();
                const response = await client.get(uri);
                expect(response.data.data.length).to.be.equal(clients.length);

                const response2 = await client.get(
                    URI(serverURL)
                        .directory("/v1/shop/settlement/client/list")
                        .filename(managerShop.shopId)
                        .addQuery("startIndex", 0)
                        .addQuery("endIndex", 2)
                        .toString()
                );
                expect(response2.data.data.clients).to.deep.equal(clients.slice(0, 2));
            });

            it("removeSettlementManager", async () => {
                for (let shopIndex = 0; shopIndex < 4; shopIndex++) {
                    const shop = shopData[shopIndex];
                    const nonce = await shopContract.nonceOf(shop.wallet.address);
                    const message = ContractUtils.getRemoveSettlementManagerMessage(
                        shop.shopId,
                        nonce,
                        contractManager.sideChainId
                    );
                    const signature = await ContractUtils.signMessage(shop.wallet, message);

                    const uri = URI(serverURL).directory("/v1/shop/settlement/manager").filename("remove");
                    const url = uri.toString();
                    const response = await client.post(url, {
                        shopId: shop.shopId,
                        account: shop.wallet.address,
                        signature,
                    });

                    expect(response.data.code).to.equal(0);
                    expect(response.data.data).to.not.equal(undefined);
                    expect(response.data.data.txHash).to.match(/^0x[A-Fa-f0-9]{64}$/i);
                }
            });

            it("check manager", async () => {
                for (let shopIndex = 0; shopIndex < 4; shopIndex++) {
                    const shop = shopData[shopIndex];
                    const uri = URI(serverURL).directory("/v1/shop/settlement/manager/get").filename(shop.shopId);
                    const url = uri.toString();
                    const response = await client.get(url);
                    expect(response.data.code).to.equal(0);
                    expect(response.data.data).to.not.equal(undefined);
                    expect(response.data.data.managerId).to.be.equal(HashZero);
                }
            });

            it("check client", async () => {
                const uri = URI(serverURL)
                    .directory("/v1/shop/settlement/client/length")
                    .filename(managerShop.shopId)
                    .toString();
                const response = await client.get(uri);
                expect(response.data.data.length).to.be.equal(0);
            });

            it("setSettlementManager again", async () => {
                for (let shopIndex = 0; shopIndex < 4; shopIndex++) {
                    const shop = shopData[shopIndex];
                    const nonce = await shopContract.nonceOf(shop.wallet.address);
                    const message = ContractUtils.getSetSettlementManagerMessage(
                        shop.shopId,
                        managerShop.shopId,
                        nonce,
                        contractManager.sideChainId
                    );
                    const signature = await ContractUtils.signMessage(shop.wallet, message);

                    const uri = URI(serverURL).directory("/v1/shop/settlement/manager").filename("set");
                    const url = uri.toString();
                    const response = await client.post(url, {
                        shopId: shop.shopId,
                        account: shop.wallet.address,
                        managerId: managerShop.shopId,
                        signature,
                    });

                    expect(response.data.code).to.equal(0);
                    expect(response.data.data).to.not.equal(undefined);
                    expect(response.data.data.txHash).to.match(/^0x[A-Fa-f0-9]{64}$/i);
                }
            });

            it("check manager", async () => {
                for (let shopIndex = 0; shopIndex < 4; shopIndex++) {
                    const shop = shopData[shopIndex];
                    const uri = URI(serverURL).directory("/v1/shop/settlement/manager/get").filename(shop.shopId);
                    const url = uri.toString();
                    const response = await client.get(url);
                    expect(response.data.code).to.equal(0);
                    expect(response.data.data).to.not.equal(undefined);
                    expect(response.data.data.managerId).to.be.equal(managerShop.shopId);
                }
            });

            it("check client", async () => {
                const uri = URI(serverURL)
                    .directory("/v1/shop/settlement/client/length")
                    .filename(managerShop.shopId)
                    .toString();
                const response = await client.get(uri);
                expect(response.data.data.length).to.be.equal(clients.length);

                const response2 = await client.get(
                    URI(serverURL)
                        .directory("/v1/shop/settlement/client/list")
                        .filename(managerShop.shopId)
                        .addQuery("startIndex", 0)
                        .addQuery("endIndex", 2)
                        .toString()
                );
                expect(response2.data.data.clients).to.deep.equal(clients.slice(0, 2));
            });

            it("set agent of refund", async () => {
                const response1 = await client.get(
                    URI(serverURL).directory(`/v1/agent/refund/${managerShop.wallet.address}`).toString()
                );
                expect(response1.data.data.account).to.deep.equal(managerShop.wallet.address);
                expect(response1.data.data.agent).to.deep.equal(AddressZero);

                const agent = deployments.accounts.users[2];
                const nonce = await contractManager.sideLedgerContract.nonceOf(managerShop.wallet.address);
                const message = ContractUtils.getRegisterAgentMessage(
                    managerShop.wallet.address,
                    agent.address,
                    nonce,
                    contractManager.sideChainId
                );
                const signature = await ContractUtils.signMessage(managerShop.wallet, message);
                const response2 = await client.post(URI(serverURL).directory(`/v1/agent/refund`).toString(), {
                    account: managerShop.wallet.address,
                    agent: agent.address,
                    signature,
                });
                expect(response2.data.code).to.equal(0);
                expect(response2.data.data).to.not.equal(undefined);
                expect(response2.data.data.txHash).to.match(/^0x[A-Fa-f0-9]{64}$/i);
            });

            it("set agent of withdrawal", async () => {
                const response1 = await client.get(
                    URI(serverURL).directory(`/v1/agent/withdrawal/${managerShop.wallet.address}`).toString()
                );
                expect(response1.data.data.account).to.deep.equal(managerShop.wallet.address);
                expect(response1.data.data.agent).to.deep.equal(AddressZero);

                const agent = deployments.accounts.users[2];
                const nonce = await contractManager.sideLedgerContract.nonceOf(managerShop.wallet.address);
                const message = ContractUtils.getRegisterAgentMessage(
                    managerShop.wallet.address,
                    agent.address,
                    nonce,
                    contractManager.sideChainId
                );
                const signature = await ContractUtils.signMessage(managerShop.wallet, message);
                const response2 = await client.post(URI(serverURL).directory(`/v1/agent/withdrawal`).toString(), {
                    account: managerShop.wallet.address,
                    agent: agent.address,
                    signature,
                });
                expect(response2.data.code).to.equal(0);
                expect(response2.data.data).to.not.equal(undefined);
                expect(response2.data.data.txHash).to.match(/^0x[A-Fa-f0-9]{64}$/i);
            });
        });

        context("refund", () => {
            const managerShop = shopData[4];
            const agent = deployments.accounts.users[2];
            const expected = [400, 300, 200, 500].map((m) => Amount.make(m, 18).value);
            const sumExpected = Amount.make(1400, 18).value;
            let amountToken: BigNumber;

            it("Check refundable amount", async () => {
                for (let shopIndex = 0; shopIndex < 4; shopIndex++) {
                    const shop = shopData[shopIndex];
                    const url = URI(serverURL).directory("/v1/shop/refundable/").filename(shop.shopId).toString();
                    const response = await client.get(url);
                    const refundableAmount = BigNumber.from(response.data.data.refundableAmount);
                    expect(refundableAmount).to.equal(expected[shopIndex]);
                }
            });

            it("getCollectSettlementAmountMultiClientMessage", async () => {
                const clientLength = await shopContract.getSettlementClientLength(managerShop.shopId);
                const clients = await shopContract.getSettlementClientList(managerShop.shopId, 0, clientLength);
                const nonce = await shopContract.nonceOf(agent.address);
                const message = ContractUtils.getCollectSettlementAmountMultiClientMessage(
                    managerShop.shopId,
                    clients,
                    nonce,
                    contractManager.sideChainId
                );
                const signature = await ContractUtils.signMessage(agent, message);

                const uri = URI(serverURL).directory("/v1/shop/settlement/collect");
                const url = uri.toString();
                const response = await client.post(url, {
                    shopId: managerShop.shopId,
                    account: agent.address,
                    clients: clients.join(","),
                    signature,
                });

                expect(response.data.code).to.equal(0);
                expect(response.data.data).to.not.equal(undefined);
                expect(response.data.data.txHash).to.match(/^0x[A-Fa-f0-9]{64}$/i);
            });

            it("Check refundable amount", async () => {
                for (let shopIndex = 0; shopIndex < 4; shopIndex++) {
                    const shop = shopData[shopIndex];
                    const url = URI(serverURL).directory("/v1/shop/refundable/").filename(shop.shopId).toString();
                    const response = await client.get(url);
                    const refundableAmount = BigNumber.from(response.data.data.refundableAmount);
                    expect(refundableAmount).to.equal(0);
                }
            });

            it("Check refundable amount of settlement manager", async () => {
                const url = URI(serverURL).directory("/v1/shop/refundable/").filename(managerShop.shopId).toString();
                const response = await client.get(url);
                const refundableAmount = BigNumber.from(response.data.data.refundableAmount);
                expect(refundableAmount).to.equal(sumExpected);
                amountToken = BigNumber.from(response.data.data.refundableToken);
            });

            it("refund", async () => {
                const nonce = await shopContract.nonceOf(agent.address);
                const message = ContractUtils.getShopRefundMessage(
                    managerShop.shopId,
                    sumExpected,
                    nonce,
                    contractManager.sideChainId
                );
                const signature = await ContractUtils.signMessage(agent, message);

                const uri = URI(serverURL).directory("/v1/shop").filename("refund");
                const url = uri.toString();
                const response = await client.post(url, {
                    shopId: managerShop.shopId,
                    amount: sumExpected.toString(),
                    account: agent.address,
                    signature,
                });

                expect(response.data.code).to.equal(0);
                expect(response.data.data).to.not.equal(undefined);
                expect(response.data.data.txHash).to.match(/^0x[A-Fa-f0-9]{64}$/i);
            });

            it("Check refundable amount", async () => {
                const url = URI(serverURL).directory("/v1/shop/refundable/").filename(managerShop.shopId).toString();
                const response = await client.get(url);
                const refundableAmount = BigNumber.from(response.data.data.refundableAmount);
                expect(refundableAmount).to.equal(0);
            });

            it("Check balance of ledger", async () => {
                const url = URI(serverURL)
                    .directory("/v1/ledger/balance/account/")
                    .filename(managerShop.wallet.address)
                    .toString();
                const response = await client.get(url);
                const balance = BigNumber.from(response.data.data.token.balance);
                expect(balance).to.equal(amountToken);
            });

            it("withdrawal", async () => {
                const account = managerShop.wallet.address;
                const adjustedAmount = ContractUtils.zeroGWEI(amountToken);

                const nonce = await contractManager.sideLedgerContract.nonceOf(agent.address);
                const expiry = ContractUtils.getTimeStamp() + 3600;

                const message = ContractUtils.getTransferMessage(
                    contractManager.sideChainId,
                    contractManager.sideTokenContract.address,
                    account,
                    contractManager.sideLoyaltyBridgeContract.address,
                    adjustedAmount,
                    nonce,
                    expiry
                );
                const signature = await ContractUtils.signMessage(agent, message);

                const param = {
                    account,
                    amount: adjustedAmount.toString(),
                    expiry,
                    signature,
                };
                const response = await client.post(
                    URI(serverURL).directory("/v1/ledger/withdraw_via_bridge").toString(),
                    param
                );

                expect(response.data.code).to.equal(0);
                expect(response.data.data).to.not.equal(undefined);
                expect(response.data.data.txHash).to.match(/^0x[A-Fa-f0-9]{64}$/i);
            });
        });
    });
});
