import "@nomiclabs/hardhat-ethers";
import "@nomiclabs/hardhat-waffle";

import { Amount } from "../src/common/Amount";
import { Config } from "../src/common/Config";
import { GraphStorage } from "../src/storage/GraphStorage";
import { RelayStorage } from "../src/storage/RelayStorage";
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
import { getPurchaseId, TestClient, TestServer } from "./helper/Utility";

import chai, { expect } from "chai";
import { solidity } from "ethereum-waffle";

import * as path from "path";
import { URL } from "url";

import { Wallet } from "ethers";

// tslint:disable-next-line:no-implicit-dependencies
import { AddressZero } from "@ethersproject/constants";
import { ContractManager } from "../src/contract/ContractManager";

// tslint:disable-next-line:no-var-requires
const URI = require("urijs");

chai.use(solidity);

describe("Test of Server", function () {
    this.timeout(1000 * 60 * 5);

    const config = new Config();
    config.readFromFile(path.resolve(process.cwd(), "config", "config_test.yaml"));
    const contractManager = new ContractManager(config);
    const deployments = new Deployments(config);

    let validatorContract: Validator;
    let tokenContract: BIP20DelegatedTransfer;
    let linkContract: PhoneLinkCollection;
    let currencyRateContract: CurrencyRate;
    let shopContract: Shop;
    let consumerContract: LoyaltyConsumer;
    let providerContract: LoyaltyProvider;
    let exchangerContract: LoyaltyExchanger;
    let ledgerContract: Ledger;

    let client: TestClient;
    let server: TestServer;
    let storage: RelayStorage;
    let serverURL: URL;

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
            wallet: deployments.accounts.shops[0],
        },
        {
            shopId: "F000200",
            name: "Shop2",
            currency: "krw",
            wallet: deployments.accounts.shops[1],
        },
        {
            shopId: "F000300",
            name: "Shop3",
            currency: "krw",
            wallet: deployments.accounts.shops[2],
        },
        {
            shopId: "F000400",
            name: "Shop4",
            currency: "krw",
            wallet: deployments.accounts.shops[3],
        },
        {
            shopId: "F000500",
            name: "Shop5",
            currency: "krw",
            wallet: deployments.accounts.shops[4],
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
            wallet: deployments.accounts.users[0],
            address: deployments.accounts.users[0].address,
            privateKey: deployments.accounts.users[0].privateKey,
        },
        {
            phone: "08201012341002",
            wallet: deployments.accounts.users[1],
            address: deployments.accounts.users[1].address,
            privateKey: deployments.accounts.users[1].privateKey,
        },
        {
            phone: "08201012341003",
            wallet: deployments.accounts.users[2],
            address: deployments.accounts.users[2].address,
            privateKey: deployments.accounts.users[2].privateKey,
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

    context("Test token & point relay endpoints", () => {
        before("Set Shop ID", async () => {
            for (const elem of shopData) {
                elem.shopId = ContractUtils.getShopId(elem.wallet.address, LoyaltyNetworkID.KIOS);
            }
        });

        before("Deploy", async () => {
            deployments.setShopData(shopData);
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
            config.contracts.sideChain.tokenAddress = deployments.getContractAddress("TestKIOS") || "";
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
            const graph = await GraphStorage.make(config.graph);
            await contractManager.attach();
            server = new TestServer(config, contractManager, storage, graph);
        });

        before("Start TestServer", async () => {
            await server.start();
        });

        after("Stop TestServer", async () => {
            await server.stop();
            await storage.dropTestDB();
        });

        context("Change loyalty type", () => {
            it("Check loyalty type - before", async () => {
                const userIndex = 0;
                const loyaltyType = await ledgerContract.loyaltyTypeOf(deployments.accounts.users[userIndex].address);
                expect(loyaltyType).to.equal(0);
            });

            it("Send loyalty type", async () => {
                const userIndex = 0;
                const nonce = await ledgerContract.nonceOf(deployments.accounts.users[userIndex].address);
                const signature = await ContractUtils.signLoyaltyType(
                    deployments.accounts.users[userIndex],
                    nonce,
                    contractManager.sideChainId
                );
                const uri = URI(serverURL).directory("/v1/ledger/changeToLoyaltyToken");
                const url = uri.toString();
                const response = await client.post(url, {
                    account: deployments.accounts.users[userIndex].address,
                    signature,
                });

                expect(response.data.code).to.equal(0);
                expect(response.data.data).to.not.equal(undefined);
                expect(response.data.data.txHash).to.match(/^0x[A-Fa-f0-9]{64}$/i);
            });

            it("Check point type - after", async () => {
                const userIndex = 0;
                const loyaltyType = await ledgerContract.loyaltyTypeOf(deployments.accounts.users[userIndex].address);
                expect(loyaltyType).to.equal(1);
            });
        });

        context("Nonce", () => {
            it("Get Nonce of Ledger", async () => {
                const userIndex = 0;
                const account = deployments.accounts.users[userIndex].address;
                const url = URI(serverURL).directory(`/v1/ledger/nonce/${account}`).toString();
                const response = await client.get(url);

                expect(response.data.code).to.equal(0);
                expect(response.data.data).to.not.equal(undefined);
            });

            it("Get Nonce of Shop", async () => {
                const userIndex = 0;
                const account = deployments.accounts.users[userIndex].address;
                const url = URI(serverURL).directory(`/v1/shop/nonce/${account}`).toString();
                const response = await client.get(url);

                expect(response.data.code).to.equal(0);
                expect(response.data.data).to.not.equal(undefined);
            });

            it("Get Nonce of token in side chain", async () => {
                const userIndex = 0;
                const account = deployments.accounts.users[userIndex].address;
                const url = URI(serverURL).directory(`/v1/token/side/nonce/${account}`).toString();
                const response = await client.get(url);

                expect(response.data.code).to.equal(0);
                expect(response.data.data).to.not.equal(undefined);
            });

            it("Get Nonce of phone link", async () => {
                const userIndex = 0;
                const account = deployments.accounts.users[userIndex].address;
                const url = URI(serverURL).directory(`/v1/link/nonce/${account}`).toString();
                const response = await client.get(url);

                expect(response.data.code).to.equal(0);
                expect(response.data.data).to.not.equal(undefined);
            });
        });
    });

    context("Test token & point relay endpoints - using phone", () => {
        before("Deploy", async () => {
            deployments.setShopData(shopData);
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
            config.contracts.sideChain.tokenAddress = tokenContract.address;
            config.contracts.sideChain.phoneLinkerAddress = linkContract.address;
            config.contracts.sideChain.shopAddress = shopContract.address;
            config.contracts.sideChain.ledgerAddress = ledgerContract.address;
            config.contracts.sideChain.loyaltyConsumerAddress = consumerContract.address;
            config.contracts.sideChain.loyaltyProviderAddress = providerContract.address;
            config.contracts.sideChain.loyaltyExchangerAddress = exchangerContract.address;
            config.contracts.sideChain.currencyRateAddress = currencyRateContract.address;

            config.relay.managerKeys = deployments.accounts.certifiers.map((m) => m.privateKey);
            config.relay.relayEndpoint = `http://127.0.0.1:${config.server.port}`;
        });

        before("Create TestServer", async () => {
            serverURL = new URL(`http://127.0.0.1:${config.server.port}`);
            storage = await RelayStorage.make(config.database);
            const graph = await GraphStorage.make(config.graph);
            await contractManager.attach();
            server = new TestServer(config, contractManager, storage, graph);
        });

        before("Start TestServer", async () => {
            await server.start();
        });

        after("Stop TestServer", async () => {
            await server.stop();
            await storage.dropTestDB();
        });

        context("Save Purchase Data", () => {
            const userIndex = 0;
            const purchase: IPurchaseData = {
                purchaseId: getPurchaseId(),
                amount: 10000,
                providePercent: 10,
                currency: "krw",
                shopIndex: 1,
                userIndex,
            };

            it("Save Purchase Data", async () => {
                const phoneHash = ContractUtils.getPhoneHash(userData[userIndex].phone);
                const userAccount = AddressZero;
                const purchaseAmount = Amount.make(purchase.amount, 18).value;
                const loyaltyAmount = ContractUtils.zeroGWEI(purchaseAmount.mul(purchase.providePercent).div(100));
                const shop = shopData[purchase.shopIndex];
                const pointAmount = ContractUtils.zeroGWEI(purchaseAmount.mul(purchase.providePercent).div(100));
                const purchaseParam = {
                    purchaseId: purchase.purchaseId,
                    amount: purchaseAmount,
                    loyalty: loyaltyAmount,
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
                const signatures = deployments.accounts.validators.map((m) =>
                    ContractUtils.signMessage(m, purchaseMessage)
                );

                await expect(
                    providerContract
                        .connect(deployments.accounts.validators[0])
                        .savePurchase(0, [purchaseParam], signatures)
                )
                    .to.emit(providerContract, "SavedPurchase")
                    .withNamedArgs({
                        purchaseId: purchase.purchaseId,
                        amount: purchaseAmount,
                        loyalty: loyaltyAmount,
                        currency: purchase.currency.toLowerCase(),
                        shopId: shop.shopId,
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
                const nonce = await linkContract.nonceOf(userData[userIndex].address);
                const msg = ContractUtils.getRequestMessage(
                    phoneHash,
                    userData[userIndex].wallet.address,
                    nonce,
                    contractManager.sideChainId
                );
                const signature = await ContractUtils.signMessage(userData[userIndex].wallet, msg);
                const requestId = ContractUtils.getRequestId(phoneHash, userData[userIndex].address, nonce);
                await expect(
                    linkContract
                        .connect(deployments.accounts.certifiers[0])
                        .addRequest(requestId, phoneHash, userData[userIndex].address, signature)
                )
                    .to.emit(linkContract, "AddedRequestItem")
                    .withArgs(requestId, phoneHash, userData[userIndex].address);
                await linkContract.connect(deployments.accounts.linkValidators[0]).voteRequest(requestId);
                await linkContract.connect(deployments.accounts.linkValidators[1]).voteRequest(requestId);
                await linkContract.connect(deployments.accounts.linkValidators[2]).voteRequest(requestId);
                await linkContract.connect(deployments.accounts.linkValidators[0]).countVote(requestId);
            });

            it("Change to payable point", async () => {
                const phoneHash = ContractUtils.getPhoneHash(userData[userIndex].phone);
                const payableBalance = await ledgerContract.pointBalanceOf(userData[userIndex].address);
                const unPayableBalance = await ledgerContract.unPayablePointBalanceOf(phoneHash);

                const nonce = await ledgerContract.nonceOf(userData[userIndex].address);
                const signature = await ContractUtils.signChangePayablePoint(
                    userData[userIndex].wallet,
                    phoneHash,
                    nonce,
                    contractManager.sideChainId
                );

                const uri = URI(serverURL).directory("/v1/ledger/changeToPayablePoint");
                const url = uri.toString();
                const response = await client.post(url, {
                    phone: phoneHash,
                    account: deployments.accounts.users[userIndex].address,
                    signature,
                });

                expect(response.data.code).to.equal(0, response.data.error?.message);
                expect(response.data.data).to.not.equal(undefined);
                expect(response.data.data.txHash).to.match(/^0x[A-Fa-f0-9]{64}$/i);

                expect(await ledgerContract.pointBalanceOf(userData[userIndex].address)).to.equal(
                    payableBalance.add(unPayableBalance)
                );
                expect(await ledgerContract.unPayablePointBalanceOf(phoneHash)).to.equal(0);
            });
        });
    });

    context("Remove Phone Info", () => {
        before("Deploy", async () => {
            deployments.setShopData(shopData);
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
            config.contracts.sideChain.tokenAddress = deployments.getContractAddress("TestKIOS") || "";
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
            config.relay.relayEndpoint = `http://127.0.0.1:${config.server.port}`;
        });

        before("Create TestServer", async () => {
            serverURL = new URL(`http://127.0.0.1:${config.server.port}`);
            storage = await RelayStorage.make(config.database);
            const graph = await GraphStorage.make(config.graph);
            await contractManager.attach();
            server = new TestServer(config, contractManager, storage, graph);
        });

        before("Start TestServer", async () => {
            await server.start();
        });

        after("Stop TestServer", async () => {
            await server.stop();
            await storage.dropTestDB();
        });

        context("Save Purchase Data", () => {
            const userIndex = 0;
            const purchase: IPurchaseData = {
                purchaseId: getPurchaseId(),
                amount: 10000,
                providePercent: 10,
                currency: "krw",
                shopIndex: 1,
                userIndex,
            };

            it("Save Purchase Data", async () => {
                const phoneHash = ContractUtils.getPhoneHash(userData[userIndex].phone);
                const userAccount = AddressZero;
                const purchaseAmount = Amount.make(purchase.amount, 18).value;
                const loyaltyAmount = ContractUtils.zeroGWEI(purchaseAmount.mul(purchase.providePercent).div(100));
                const shop = shopData[purchase.shopIndex];
                const pointAmount = ContractUtils.zeroGWEI(purchaseAmount.mul(purchase.providePercent).div(100));
                const purchaseParam = {
                    purchaseId: purchase.purchaseId,
                    amount: purchaseAmount,
                    loyalty: loyaltyAmount,
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
                const signatures = deployments.accounts.validators.map((m) =>
                    ContractUtils.signMessage(m, purchaseMessage)
                );

                await expect(
                    providerContract
                        .connect(deployments.accounts.validators[0])
                        .savePurchase(0, [purchaseParam], signatures)
                )
                    .to.emit(providerContract, "SavedPurchase")
                    .withNamedArgs({
                        purchaseId: purchase.purchaseId,
                        amount: purchaseAmount,
                        loyalty: loyaltyAmount,
                        currency: purchase.currency.toLowerCase(),
                        shopId: shop.shopId,
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
                const nonce = await linkContract.nonceOf(userData[userIndex].address);
                const msg = ContractUtils.getRequestMessage(
                    phoneHash,
                    userData[userIndex].wallet.address,
                    nonce,
                    contractManager.sideChainId
                );
                const signature = await ContractUtils.signMessage(userData[userIndex].wallet, msg);
                const requestId = ContractUtils.getRequestId(phoneHash, userData[userIndex].address, nonce);
                await expect(
                    linkContract
                        .connect(deployments.accounts.certifiers[0])
                        .addRequest(requestId, phoneHash, userData[userIndex].address, signature)
                )
                    .to.emit(linkContract, "AddedRequestItem")
                    .withArgs(requestId, phoneHash, userData[userIndex].address);
                await linkContract.connect(deployments.accounts.linkValidators[0]).voteRequest(requestId);
                await linkContract.connect(deployments.accounts.linkValidators[1]).voteRequest(requestId);
                await linkContract.connect(deployments.accounts.linkValidators[2]).voteRequest(requestId);
                await linkContract.connect(deployments.accounts.linkValidators[0]).countVote(requestId);
            });

            it("Remove phone info of ledger", async () => {
                const phoneHash = ContractUtils.getPhoneHash(userData[userIndex].phone);
                const nonce = await ledgerContract.nonceOf(userData[userIndex].address);
                const message = ContractUtils.getRemoveMessage(
                    userData[userIndex].address,
                    nonce,
                    contractManager.sideChainId
                );
                const signature = await ContractUtils.signMessage(userData[userIndex].wallet, message);

                const uri = URI(serverURL).directory("/v1/ledger/removePhoneInfo");
                const url = uri.toString();
                const response = await client.post(url, {
                    account: userData[userIndex].address,
                    signature,
                });

                expect(response.data.code).to.equal(0, response.data.error?.message);
                expect(response.data.data).to.not.equal(undefined);
                expect(response.data.data.txHash).to.match(/^0x[A-Fa-f0-9]{64}$/i);

                expect(await ledgerContract.unPayablePointBalanceOf(phoneHash)).to.equal(0);
            });

            it("Remove phone info of linker", async () => {
                const phoneHash = ContractUtils.getPhoneHash(userData[userIndex].phone);
                const nonce = await linkContract.nonceOf(userData[userIndex].address);
                const message = ContractUtils.getRemoveMessage(
                    userData[userIndex].address,
                    nonce,
                    contractManager.sideChainId
                );
                const signature = await ContractUtils.signMessage(userData[userIndex].wallet, message);

                const uri = URI(serverURL).directory("/v1/link/removePhoneInfo");
                const url = uri.toString();
                const response = await client.post(url, {
                    account: userData[userIndex].address,
                    signature,
                });

                expect(response.data.code).to.equal(0, response.data.error?.message);
                expect(response.data.data).to.not.equal(undefined);
                expect(response.data.data.txHash).to.match(/^0x[A-Fa-f0-9]{64}$/i);

                expect(await linkContract.toAddress(phoneHash)).to.equal(AddressZero);
            });
        });
    });
});
