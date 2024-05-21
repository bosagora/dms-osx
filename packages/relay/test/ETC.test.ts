import "@nomiclabs/hardhat-ethers";
import "@nomiclabs/hardhat-waffle";

import { Config } from "../src/common/Config";
import { ContractManager } from "../src/contract/ContractManager";
import { GraphStorage } from "../src/storage/GraphStorage";
import { RelayStorage } from "../src/storage/RelayStorage";
import { ContractUtils } from "../src/utils/ContractUtils";
import { TestClient, TestServer } from "./helper/Utility";

import assert from "assert";
import * as hre from "hardhat";
import path from "path";
import URI from "urijs";
import { URL } from "url";
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

describe("Test for ETC", function () {
    this.timeout(1000 * 60 * 5);
    const config = new Config();
    config.readFromFile(path.resolve(process.cwd(), "config", "config_test.yaml"));
    const contractManager = new ContractManager(config);
    const deployments = new Deployments(config);

    const provider = hre.waffle.provider;
    const [userWallet] = provider.getWallets();

    let client: TestClient;
    let server: TestServer;
    let storage: RelayStorage;
    let serverURL: URL;

    context("Register Mobile", () => {
        before("Deploy", async () => {
            deployments.setShopData([]);
            await deployments.doDeploy();
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
            const graph_sidechain = await GraphStorage.make(config.graph_sidechain);
            const graph_mainchain = await GraphStorage.make(config.graph_mainchain);
            const contractManager2 = new ContractManager(config);
            await contractManager2.attach();
            server = new TestServer(config, contractManager2, storage, graph_sidechain, graph_mainchain);
        });

        before("Start TestServer", async () => {
            await server.start();
        });

        after("Stop TestServer", async () => {
            await server.stop();
            await storage.dropTestDB();
        });

        it("Register", async () => {
            const param = {
                account: userWallet.address,
                token: "12345678901234567890123456789012345678901234567890",
                language: "kr",
                os: "iOS",
                signature: "",
            };

            param.signature = await ContractUtils.signMobileToken(userWallet, param.token);

            const response = await client.post(
                URI(serverURL).directory("/v1/mobile").filename("register").toString(),
                param
            );
            assert.deepStrictEqual(response.data.data.account, userWallet.address);
            assert.deepStrictEqual(response.data.data.token, param.token);
            assert.deepStrictEqual(response.data.data.language, param.language);
            assert.deepStrictEqual(response.data.data.os, param.os);
        });
    });
});
