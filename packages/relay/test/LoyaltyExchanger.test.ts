import "@nomiclabs/hardhat-ethers";
import "@nomiclabs/hardhat-waffle";

import { Amount } from "../src/common/Amount";
import { Config } from "../src/common/Config";
import { ContractManager } from "../src/contract/ContractManager";
import { GraphStorage } from "../src/storage/GraphStorage";
import { RelayStorage } from "../src/storage/RelayStorage";
import { IShopData, IUserData } from "../src/types";
import { ContractUtils } from "../src/utils/ContractUtils";
import {
    BIP20DelegatedTransfer,
    CurrencyRate,
    Ledger,
    LoyaltyConsumer,
    LoyaltyExchanger,
    LoyaltyProvider,
    LoyaltyTransfer,
    PhoneLinkCollection,
    Shop,
    Validator,
} from "../typechain-types";
import { Deployments } from "./helper/Deployments";
import { FakerCallbackServer } from "./helper/FakerCallbackServer";
import { getPurchaseId, TestClient, TestServer } from "./helper/Utility";

import chai, { expect } from "chai";
import { solidity } from "ethereum-waffle";

import fs from "fs";
import * as path from "path";
import { URL } from "url";

import { Wallet } from "ethers";
import { ethers } from "hardhat";

// tslint:disable-next-line:no-var-requires
const URI = require("urijs");

chai.use(solidity);

describe("Test of LoyaltyExchanger", function () {
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
    let storage: RelayStorage;
    let server: TestServer;
    let serverURL: URL;

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

    context("Test auto approval", () => {
        before("Load User & Shop", async () => {
            const users = JSON.parse(fs.readFileSync("./src/data/users.json", "utf8")) as IUserData[];
            const userIdx = Math.floor(Math.random() * users.length);
            userData.push(users[userIdx]);

            const shops = JSON.parse(fs.readFileSync("./src/data/shops.json", "utf8")) as IShopData[];
            const shopIdx = Math.floor(Math.random() * shops.length);
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

        before("Start CallbackServer", async () => {
            fakerCallbackServer = new FakerCallbackServer(3400);
            await fakerCallbackServer.start();
        });

        after("Stop CallbackServer", async () => {
            await fakerCallbackServer.stop();
        });

        it("Provide Loyalty Point - Save Purchase Data", async () => {
            const phoneHash = ContractUtils.getPhoneHash("");
            const purchaseAmount = Amount.make(100_000_000, 18).value;
            const loyaltyAmount = purchaseAmount.mul(10).div(100);
            const purchaseParam = userData.map((m) => {
                return {
                    purchaseId: getPurchaseId(),
                    amount: purchaseAmount,
                    loyalty: loyaltyAmount,
                    currency: "krw",
                    shopId: shopData[0].shopId,
                    account: m.address,
                    phone: phoneHash,
                    sender: deployments.accounts.foundation.address,
                };
            });
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

        it("Exchange point to token", async () => {
            const purchaseAmount = Amount.make(100_000_000, 18).value;
            const loyaltyAmount = purchaseAmount.div(100);
            for (const user of userData) {
                const nonce = await contractManager.sideLedgerContract.nonceOf(user.address);
                const message = ContractUtils.getChangePointToTokenMessage(
                    user.address,
                    loyaltyAmount,
                    nonce,
                    contractManager.sideChainId
                );
                const signature = await ContractUtils.signMessage(new Wallet(user.privateKey), message);
                const response = await client.post(
                    URI(serverURL).directory("/v1/ledger/exchangePointToToken").toString(),
                    {
                        account: user.address,
                        amount: loyaltyAmount.toString(),
                        signature,
                    }
                );

                expect(response.data.code).to.equal(0);
                expect(response.data.data).to.not.equal(undefined);
                expect(response.data.data.txHash).to.match(/^0x[A-Fa-f0-9]{64}$/i);
            }
        });
    });
});
