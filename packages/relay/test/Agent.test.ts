import "@nomiclabs/hardhat-ethers";
import "@nomiclabs/hardhat-waffle";

import { Config } from "../src/common/Config";
import { ContractManager } from "../src/contract/ContractManager";
import { GraphStorage } from "../src/storage/GraphStorage";
import { RelayStorage } from "../src/storage/RelayStorage";
import { ContractUtils } from "../src/utils/ContractUtils";
import { Deployments } from "./helper/Deployments";
import { TestClient, TestServer } from "./helper/Utility";

import chai, { expect } from "chai";
import { solidity } from "ethereum-waffle";

import * as path from "path";
import URI from "urijs";
import { URL } from "url";

import { AddressZero } from "@ethersproject/constants";

chai.use(solidity);

describe("Test of Register Agent", function () {
    this.timeout(1000 * 60 * 5);

    const config = new Config();
    config.readFromFile(path.resolve(process.cwd(), "config", "config_test.yaml"));
    const contractManager = new ContractManager(config);
    const deployments = new Deployments(config);

    let client: TestClient;
    let server: TestServer;
    let storage: RelayStorage;
    let serverURL: URL;

    before("Deploy", async () => {
        deployments.setShopData([]);
        await deployments.doDeploy();
    });

    before("Create Config", async () => {
        config.contracts.sideChain.tokenAddress = deployments.getContractAddress("SideChainKIOS") || "";
        config.contracts.sideChain.currencyRateAddress = deployments.getContractAddress("CurrencyRate") || "";
        config.contracts.sideChain.phoneLinkerAddress = deployments.getContractAddress("PhoneLinkCollection") || "";
        config.contracts.sideChain.ledgerAddress = deployments.getContractAddress("Ledger") || "";
        config.contracts.sideChain.shopAddress = deployments.getContractAddress("Shop") || "";
        config.contracts.sideChain.loyaltyProviderAddress = deployments.getContractAddress("LoyaltyProvider") || "";
        config.contracts.sideChain.loyaltyConsumerAddress = deployments.getContractAddress("LoyaltyConsumer") || "";
        config.contracts.sideChain.loyaltyExchangerAddress = deployments.getContractAddress("LoyaltyExchanger") || "";
        config.contracts.sideChain.loyaltyTransferAddress = deployments.getContractAddress("LoyaltyTransfer") || "";
        config.contracts.sideChain.loyaltyBridgeAddress = deployments.getContractAddress("LoyaltyBridge") || "";
        config.contracts.sideChain.innerBridgeContract = deployments.getContractAddress("SideChainInnerBridge") || "";

        config.contracts.mainChain.tokenAddress = deployments.getContractAddress("MainChainKIOS") || "";
        config.contracts.mainChain.token2Address = deployments.getContractAddress("MainChainKIOS2") || "";
        config.contracts.mainChain.loyaltyBridgeAddress =
            deployments.getContractAddress("MainChainLoyaltyBridge") || "";
        config.contracts.mainChain.innerBridgeContract = deployments.getContractAddress("MainChainInnerBridge") || "";
        config.contracts.mainChain.outerBridgeContract = deployments.getContractAddress("MainChainOuterBridge") || "";

        config.contracts.outerChain.tokenAddress = deployments.getContractAddress("OuterChainKIOS") || "";
        config.contracts.outerChain.outerBridgeContract = deployments.getContractAddress("OuterChainOuterBridge") || "";

        config.relay.certifiers = deployments.accounts.certifiers.map((m) => m.privateKey);
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

    it("Register agent provision", async () => {
        const user = deployments.accounts.users[0];
        const response1 = await client.get(URI(serverURL).directory(`/v1/agent/provision/${user.address}`).toString());
        expect(response1.data.data.account).to.deep.equal(user.address);
        expect(response1.data.data.agent).to.deep.equal(AddressZero);

        const agent = deployments.accounts.users[1];
        const nonce = await contractManager.sideLedgerContract.nonceOf(user.address);
        const message = ContractUtils.getRegisterAgentMessage(
            user.address,
            agent.address,
            nonce,
            contractManager.sideChainId
        );
        const signature = await ContractUtils.signMessage(user, message);
        const response2 = await client.post(URI(serverURL).directory(`/v1/agent/provision`).toString(), {
            account: user.address,
            agent: agent.address,
            signature,
        });
        expect(response2.data.code).to.equal(0);
        expect(response2.data.data).to.not.equal(undefined);
        expect(response2.data.data.txHash).to.match(/^0x[A-Fa-f0-9]{64}$/i);

        const response3 = await client.get(URI(serverURL).directory(`/v1/agent/provision/${user.address}`).toString());
        expect(response3.data.data.account).to.deep.equal(user.address);
        expect(response3.data.data.agent).to.deep.equal(agent.address);
    });

    it("Register agent refund", async () => {
        const user = deployments.accounts.users[0];
        const response1 = await client.get(URI(serverURL).directory(`/v1/agent/refund/${user.address}`).toString());
        expect(response1.data.data.account).to.deep.equal(user.address);
        expect(response1.data.data.agent).to.deep.equal(AddressZero);

        const agent = deployments.accounts.users[2];
        const nonce = await contractManager.sideLedgerContract.nonceOf(user.address);
        const message = ContractUtils.getRegisterAgentMessage(
            user.address,
            agent.address,
            nonce,
            contractManager.sideChainId
        );
        const signature = await ContractUtils.signMessage(user, message);
        const response2 = await client.post(URI(serverURL).directory(`/v1/agent/refund`).toString(), {
            account: user.address,
            agent: agent.address,
            signature,
        });
        expect(response2.data.code).to.equal(0);
        expect(response2.data.data).to.not.equal(undefined);
        expect(response2.data.data.txHash).to.match(/^0x[A-Fa-f0-9]{64}$/i);

        const response3 = await client.get(URI(serverURL).directory(`/v1/agent/refund/${user.address}`).toString());
        expect(response3.data.data.account).to.deep.equal(user.address);
        expect(response3.data.data.agent).to.deep.equal(agent.address);
    });

    it("Register agent withdrawal", async () => {
        const user = deployments.accounts.users[0];
        const response1 = await client.get(URI(serverURL).directory(`/v1/agent/withdrawal/${user.address}`).toString());
        expect(response1.data.data.account).to.deep.equal(user.address);
        expect(response1.data.data.agent).to.deep.equal(AddressZero);

        const agent = deployments.accounts.users[3];
        const nonce = await contractManager.sideLedgerContract.nonceOf(user.address);
        const message = ContractUtils.getRegisterAgentMessage(
            user.address,
            agent.address,
            nonce,
            contractManager.sideChainId
        );
        const signature = await ContractUtils.signMessage(user, message);
        const response2 = await client.post(URI(serverURL).directory(`/v1/agent/withdrawal`).toString(), {
            account: user.address,
            agent: agent.address,
            signature,
        });
        expect(response2.data.code).to.equal(0);
        expect(response2.data.data).to.not.equal(undefined);
        expect(response2.data.data.txHash).to.match(/^0x[A-Fa-f0-9]{64}$/i);

        const response3 = await client.get(URI(serverURL).directory(`/v1/agent/withdrawal/${user.address}`).toString());
        expect(response3.data.data.account).to.deep.equal(user.address);
        expect(response3.data.data.agent).to.deep.equal(agent.address);
    });
});
