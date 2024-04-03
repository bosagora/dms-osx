import "@nomiclabs/hardhat-ethers";
import "@nomiclabs/hardhat-waffle";

import { Amount } from "../src/common/Amount";
import { Config } from "../src/common/Config";
import { ContractManager } from "../src/contract/ContractManager";
import { GraphStorage } from "../src/storage/GraphStorage";
import { RelayStorage } from "../src/storage/RelayStorage";
import { ContractUtils } from "../src/utils/ContractUtils";
import {
    CurrencyRate,
    Ledger,
    LoyaltyConsumer,
    LoyaltyExchanger,
    LoyaltyProvider,
    LoyaltyTransfer,
    PhoneLinkCollection,
    Shop,
} from "../typechain-types";
import { Deployments } from "./helper/Deployments";
import { TestClient, TestServer } from "./helper/Utility";

import chai, { expect } from "chai";
import { solidity } from "ethereum-waffle";

import * as path from "path";
import { URL } from "url";

// tslint:disable-next-line:no-var-requires
const URI = require("urijs");

chai.use(solidity);

describe("Test of Bridge", function () {
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
        config.contracts.sideChain.tokenAddress = deployments.getContractAddress("TestKIOS") || "";
        config.contracts.sideChain.currencyRateAddress = deployments.getContractAddress("CurrencyRate") || "";
        config.contracts.sideChain.phoneLinkerAddress = deployments.getContractAddress("PhoneLinkCollection") || "";
        config.contracts.sideChain.ledgerAddress = deployments.getContractAddress("Ledger") || "";
        config.contracts.sideChain.shopAddress = deployments.getContractAddress("Shop") || "";
        config.contracts.sideChain.loyaltyProviderAddress = deployments.getContractAddress("LoyaltyProvider") || "";
        config.contracts.sideChain.loyaltyConsumerAddress = deployments.getContractAddress("LoyaltyConsumer") || "";
        config.contracts.sideChain.loyaltyExchangerAddress = deployments.getContractAddress("LoyaltyExchanger") || "";
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

    // 메인체인에서 사이드체인으로 입금
    it("Deposit token by Bridge", async () => {
        const tokenId = ContractUtils.getTokenId(
            await contractManager.mainTokenContract.name(),
            await contractManager.mainTokenContract.symbol()
        );
        const account = deployments.accounts.owner;
        const amount = Amount.make(500, 18).value;

        const balance0 = await contractManager.mainTokenContract.balanceOf(account.address);
        const balance1 = await contractManager.mainTokenContract.balanceOf(
            contractManager.mainChainBridgeContract.address
        );
        const balance2 = await contractManager.sideTokenContract.balanceOf(account.address);

        const nonce = await contractManager.mainTokenContract.nonceOf(account.address);
        const message = await ContractUtils.getTransferMessage(
            account.address,
            contractManager.mainChainBridgeContract.address,
            amount,
            nonce,
            contractManager.mainChainId
        );
        const signature = await ContractUtils.signMessage(account, message);
        const response = await client.post(URI(serverURL).directory("/v1/bridge/deposit").toString(), {
            account: account.address,
            amount: amount.toString(),
            signature,
        });

        expect(response.data.code).to.equal(0, response.data.error?.message);
        expect(response.data.data).to.not.equal(undefined);
        expect(response.data.data.tokenId).to.match(/^0x[A-Fa-f0-9]{64}$/i);
        expect(response.data.data.depositId).to.match(/^0x[A-Fa-f0-9]{64}$/i);
        expect(response.data.data.txHash).to.match(/^0x[A-Fa-f0-9]{64}$/i);

        /// Approve of Validators
        await contractManager.sideChainBridgeContract
            .connect(deployments.accounts.bridgeValidators[0])
            .withdrawFromBridge(response.data.data.tokenId, response.data.data.depositId, account.address, amount);

        await contractManager.sideChainBridgeContract
            .connect(deployments.accounts.bridgeValidators[1])
            .withdrawFromBridge(response.data.data.tokenId, response.data.data.depositId, account.address, amount);

        await contractManager.sideChainBridgeContract
            .connect(deployments.accounts.bridgeValidators[2])
            .withdrawFromBridge(response.data.data.tokenId, response.data.data.depositId, account.address, amount);
        ///

        expect(await contractManager.mainTokenContract.balanceOf(account.address)).to.deep.equal(balance0.sub(amount));
        expect(
            await contractManager.mainTokenContract.balanceOf(contractManager.mainChainBridgeContract.address)
        ).to.deep.equal(balance1.add(amount));

        const fee = await contractManager.sideChainBridgeContract.getFee(tokenId);
        expect(await contractManager.sideTokenContract.balanceOf(account.address)).to.deep.equal(
            balance2.add(amount).sub(fee)
        );
    });

    // 사이드체인에서 메인체인으로 출금
    it("Withdrawal token by Bridge", async () => {
        const tokenId = ContractUtils.getTokenId(
            await contractManager.mainTokenContract.name(),
            await contractManager.mainTokenContract.symbol()
        );
        const account = deployments.accounts.owner;
        const amount = Amount.make(200, 18).value;

        const balance0 = await contractManager.mainTokenContract.balanceOf(account.address);
        const balance1 = await contractManager.mainTokenContract.balanceOf(
            contractManager.mainChainBridgeContract.address
        );
        const balance2 = await contractManager.sideTokenContract.balanceOf(account.address);

        const nonce = await contractManager.sideTokenContract.nonceOf(account.address);
        const message = await ContractUtils.getTransferMessage(
            account.address,
            contractManager.sideChainBridgeContract.address,
            amount,
            nonce,
            contractManager.sideChainId
        );
        const signature = await ContractUtils.signMessage(account, message);
        const response = await client.post(URI(serverURL).directory("/v1/bridge/withdraw").toString(), {
            account: account.address,
            amount: amount.toString(),
            signature,
        });

        expect(response.data.code).to.equal(0, response.data.error?.message);
        expect(response.data.data).to.not.equal(undefined);
        expect(response.data.data.tokenId).to.match(/^0x[A-Fa-f0-9]{64}$/i);
        expect(response.data.data.depositId).to.match(/^0x[A-Fa-f0-9]{64}$/i);
        expect(response.data.data.txHash).to.match(/^0x[A-Fa-f0-9]{64}$/i);

        /// Approve of Validators
        await contractManager.mainChainBridgeContract
            .connect(deployments.accounts.bridgeValidators[0])
            .withdrawFromBridge(response.data.data.tokenId, response.data.data.depositId, account.address, amount);

        await contractManager.mainChainBridgeContract
            .connect(deployments.accounts.bridgeValidators[1])
            .withdrawFromBridge(response.data.data.tokenId, response.data.data.depositId, account.address, amount);

        await contractManager.mainChainBridgeContract
            .connect(deployments.accounts.bridgeValidators[2])
            .withdrawFromBridge(response.data.data.tokenId, response.data.data.depositId, account.address, amount);
        ///

        const fee = await contractManager.mainChainBridgeContract.getFee(tokenId);
        expect(await contractManager.mainTokenContract.balanceOf(account.address)).to.deep.equal(
            balance0.add(amount).sub(fee)
        );
        expect(
            await contractManager.mainTokenContract.balanceOf(contractManager.mainChainBridgeContract.address)
        ).to.deep.equal(balance1.sub(amount));
        //
        expect(await contractManager.sideTokenContract.balanceOf(account.address)).to.deep.equal(balance2.sub(amount));
    });
});
