import { Amount } from "../src/common/Amount";
import { Config } from "../src/common/Config";
import { CollectExchangeRateScheduler } from "../src/scheduler/CollectExchangeRateScheduler";
import { CollectPurchaseScheduler } from "../src/scheduler/CollectPurchaseScheduler";
import { Scheduler } from "../src/scheduler/Scheduler";
import { NodeStorage } from "../src/storage/NodeStorage";
import { ContractUtils } from "../src/utils/ContractUtils";
import {
    Certifier,
    CurrencyRate,
    Ledger,
    LoyaltyConsumer,
    LoyaltyExchanger,
    LoyaltyProvider,
    PhoneLinkCollection,
    Shop,
    StorePurchase,
    Token,
    Validator,
} from "../typechain-types";

import chai, { expect } from "chai";
import { solidity } from "ethereum-waffle";

import { Wallet } from "ethers";
import { ethers } from "hardhat";

import { Deployments } from "./helper/Deployments";
import { FakerStoreServer } from "./helper/FakerStoreServer";
import { IShopData, IUserData, TestClient, TestServer } from "./helper/Utility";

import * as assert from "assert";
import * as fs from "fs";
import * as path from "path";
import { URL } from "url";
import { BlockElementType } from "../src/blockchain/node/tasks";
import { BranchStatus } from "../src/blockchain/storage/BranchStatusStorage";

// tslint:disable-next-line:no-var-requires
const URI = require("urijs");

chai.use(solidity);

describe("Test of Server", function () {
    this.timeout(1000 * 60 * 5);
    const deployments = new Deployments();

    let validatorContract: Validator;
    let tokenContract: Token;
    let linkContract: PhoneLinkCollection;
    let currencyRateContract: CurrencyRate;
    let shopContract: Shop;
    let certifierContract: Certifier;
    let consumerContract: LoyaltyConsumer;
    let providerContract: LoyaltyProvider;
    let exchangerContract: LoyaltyExchanger;
    let storePurchaseContract: StorePurchase;
    let ledgerContract: Ledger;

    let fakerStoreServer: FakerStoreServer;

    let storage: NodeStorage;
    let server: TestServer;
    let serverURL: URL;
    let config: Config;

    const userData: IUserData[] = [];
    const shopData: IShopData[] = [];

    before("Load User & Shop", async () => {
        const users = JSON.parse(fs.readFileSync("./test/helper/data/users.json", "utf8")) as IUserData[];
        const userIdx = Math.floor(Math.random() * users.length);
        userData.push(users[userIdx]);

        const shops = JSON.parse(fs.readFileSync("./test/helper/data/shops.json", "utf8")) as IShopData[];
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
        tokenContract = deployments.getContract("Token") as Token;
        ledgerContract = deployments.getContract("Ledger") as Ledger;
        linkContract = deployments.getContract("PhoneLinkCollection") as PhoneLinkCollection;
        consumerContract = deployments.getContract("LoyaltyConsumer") as LoyaltyConsumer;
        providerContract = deployments.getContract("LoyaltyProvider") as LoyaltyProvider;
        exchangerContract = deployments.getContract("LoyaltyExchanger") as LoyaltyExchanger;
        currencyRateContract = deployments.getContract("CurrencyRate") as CurrencyRate;
        shopContract = deployments.getContract("Shop") as Shop;
        certifierContract = deployments.getContract("Certifier") as Certifier;
        storePurchaseContract = deployments.getContract("StorePurchase") as StorePurchase;
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
        config.contracts.purchaseAddress = storePurchaseContract.address;

        config.validator.keys = deployments.accounts.validators.map((m) => m.privateKey);
        config.setting.waitedProvide = 0;
        config.setting.ipfs_gateway_url = "http://127.0.0.1:8081";
    });

    before("Create TestServer", async () => {
        serverURL = new URL(`http://127.0.0.1:${config.server.port}`);
        console.log(`serverURL: ${serverURL}`);
        storage = await NodeStorage.make(config.database);

        const schedulers: Scheduler[] = [];
        schedulers.push(new CollectPurchaseScheduler("*/1 * * * * *"));
        schedulers.push(new CollectExchangeRateScheduler("*/1 * * * * *"));
        server = new TestServer(config, storage, schedulers);
    });

    before("Start TestServer", async () => {
        await server.start();
    });

    after("Stop TestServer", async () => {
        await server.stop();
        await storage.dropTestDB();
    });

    before("Start FakerStoreServer", async () => {
        fakerStoreServer = new FakerStoreServer(8081, deployments);
        await fakerStoreServer.start();
    });

    after("Stop FakerStoreServer", async () => {
        await fakerStoreServer.stop();
    });

    it("Create purchase block", async () => {
        await fakerStoreServer.storePurchaseBlock(256);
    });

    it("Waiting...", async () => {
        const t1 = ContractUtils.getTimeStamp();
        while (true) {
            const latestHeight = server.node.blockStorage.getLatestBlockHeight();
            if (latestHeight === 1n) break;
            else if (ContractUtils.getTimeStamp() - t1 > 60) break;
            await ContractUtils.delay(1000);
        }
    });

    it("Check Block", async () => {
        const block = server.node.blockStorage.getLatestBlock();
        assert.ok(block !== undefined);
        assert.deepStrictEqual(block.header.height, 1n);
    });

    it("Waiting...", async () => {
        const t1 = ContractUtils.getTimeStamp();
        while (true) {
            const latestHeight = server.node.blockStorage.getLatestBlockHeight();
            if (latestHeight === 3n) break;
            else if (ContractUtils.getTimeStamp() - t1 > 60) break;
            await ContractUtils.delay(1000);
        }
    });

    it("Check Block", async () => {
        const block = server.node.blockStorage.getLatestBlock();
        assert.ok(block !== undefined);
        assert.deepStrictEqual(block.header.height, 3n);
    });

    it("Check Status", async () => {
        const status = server.node.branchStatusStorage.get({ height: 1n, type: BlockElementType.PURCHASE, branch: 0 });
        assert.deepStrictEqual(status, BranchStatus.EXECUTED);
    });

    it("Waiting...", async () => {
        const t1 = ContractUtils.getTimeStamp();
        while (true) {
            const latestHeight = server.node.blockStorage.getLatestBlockHeight();
            if (latestHeight === 7n) break;
            else if (ContractUtils.getTimeStamp() - t1 > 240) break;
            await ContractUtils.delay(1000);
        }
    });

    it("Check Status", async () => {
        const status = server.node.branchStatusStorage.get({ height: 1n, type: BlockElementType.PURCHASE, branch: 0 });
        assert.deepStrictEqual(status, BranchStatus.FINALIZED);
    });
});
