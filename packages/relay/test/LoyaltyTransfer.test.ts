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

describe("Test of LoyaltyTransfer", function () {
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
        config.contracts.sideChain.tokenAddress = deployments.getContractAddress("TestLYT") || "";
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

    it("Deposit token", async () => {
        for (const userIndex of [0, 1]) {
            const amount = Amount.make(1000, 18).value;
            const oldTokenBalance = await contractManager.sideLedgerContract.tokenBalanceOf(
                deployments.accounts.users[userIndex].address
            );
            await contractManager.sideTokenContract
                .connect(deployments.accounts.users[userIndex])
                .approve(contractManager.sideLedgerContract.address, amount);
            await expect(
                contractManager.sideLedgerContract.connect(deployments.accounts.users[userIndex]).deposit(amount)
            )
                .to.emit(contractManager.sideLedgerContract, "Deposited")
                .withNamedArgs({
                    account: deployments.accounts.users[userIndex].address,
                    depositedToken: amount,
                    balanceToken: oldTokenBalance.add(amount),
                });
            expect(
                await contractManager.sideLedgerContract.tokenBalanceOf(deployments.accounts.users[userIndex].address)
            ).to.deep.equal(oldTokenBalance.add(amount));
        }
    });

    it("Transfer token", async () => {
        const source = deployments.accounts.users[0];
        const target = deployments.accounts.users[1];
        const balance0 = await contractManager.sideLedgerContract.tokenBalanceOf(source.address);
        const balance1 = await contractManager.sideLedgerContract.tokenBalanceOf(target.address);
        const fee = await contractManager.sideLoyaltyTransferContract.getFee();
        const amount = Amount.make(500, 18).value;
        const nonce = await contractManager.sideLedgerContract.nonceOf(source.address);
        const expiry = ContractUtils.getTimeStamp() * 600;
        const message = await ContractUtils.getTransferMessage(
            contractManager.sideChainId,
            contractManager.sideLoyaltyTransferContract.address,
            source.address,
            target.address,
            amount,
            nonce,
            expiry
        );
        const signature = await ContractUtils.signMessage(source, message);
        const response = await client.post(URI(serverURL).directory("/v1/ledger/transfer").toString(), {
            from: source.address,
            to: target.address,
            amount: amount.toString(),
            expiry,
            signature,
        });

        expect(response.data.code).to.equal(0);
        expect(response.data.data).to.not.equal(undefined);
        expect(response.data.data.txHash).to.match(/^0x[A-Fa-f0-9]{64}$/i);

        expect(await contractManager.sideLedgerContract.tokenBalanceOf(source.address)).to.deep.equal(
            balance0.sub(amount).sub(fee)
        );
        expect(await contractManager.sideLedgerContract.tokenBalanceOf(target.address)).to.deep.equal(
            balance1.add(amount)
        );
    });
});
