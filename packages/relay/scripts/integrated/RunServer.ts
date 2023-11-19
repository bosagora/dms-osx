import { Amount } from "../../src/common/Amount";
import { Config } from "../../src/common/Config";
import { ApprovalScheduler } from "../../src/scheduler/ApprovalScheduler";
import { Scheduler } from "../../src/scheduler/Scheduler";
import { RelayStorage } from "../../src/storage/RelayStorage";
import { LoyaltyPaymentTaskStatus, LoyaltyType } from "../../src/types";
import { ContractUtils } from "../../src/utils/ContractUtils";
import { TestClient, TestServer } from "../../test/helper/Utility";
import { ContractDeployer, Deployment, depositAmount, shopData, userData } from "./helper/ContractDeployer";

import * as hre from "hardhat";

import * as path from "path";
import { URL } from "url";

import * as assert from "assert";

// tslint:disable-next-line:no-var-requires
const URI = require("urijs");

async function main() {
    const provider = hre.waffle.provider;
    const accounts = ContractDeployer.getWallets();
    const [
        deployer,
        owner,
        validator1,
        validator2,
        validator3,
        validator4,
        validator5,
        foundation,
        settlements,
        fee,
        certifier,
        certifier01,
        certifier02,
        certifier03,
        certifier04,
        certifier05,
        certifier06,
        certifier07,
        certifier08,
        certifier09,
        certifier10,
        link_validator1,
        link_validator2,
        link_validator3,
    ] = accounts;

    const client = new TestClient();
    let storage: RelayStorage;
    let server: TestServer;
    let serverURL: URL;
    let config: Config;
    let deploymentData: Deployment;

    console.log("Test auto approval");
    {
        console.log("Deploy");
        {
            deploymentData = await ContractDeployer.deploy();
        }

        console.log("Create Config");
        {
            config = new Config();
            config.readFromFile(path.resolve(process.cwd(), "config", "config_test.yaml"));
            config.contracts.tokenAddress = deploymentData.token.address;
            config.contracts.phoneLinkerAddress = deploymentData.phoneLinkCollection.address;
            config.contracts.ledgerAddress = deploymentData.ledger.address;
            config.contracts.shopAddress = deploymentData.shopCollection.address;
            config.contracts.currencyRateAddress = deploymentData.currencyRate.address;

            config.relay.managerKeys = [
                certifier01.privateKey,
                certifier02.privateKey,
                certifier03.privateKey,
                certifier04.privateKey,
                certifier05.privateKey,
                certifier06.privateKey,
                certifier07.privateKey,
                certifier08.privateKey,
                certifier09.privateKey,
                certifier10.privateKey,
            ];
            config.relay.certifierKey = certifier.privateKey;
            config.relay.approvalSecond = 2;
            config.relay.callbackEndpoint = `http://127.0.0.1:${config.server.port}/callback`;
        }

        console.log("Create TestServer");
        {
            serverURL = new URL(`http://127.0.0.1:${config.server.port}`);
            storage = await RelayStorage.make(config.database);

            const schedulers: Scheduler[] = [];
            schedulers.push(new ApprovalScheduler("*/1 * * * * *"));
            server = new TestServer(config, storage, schedulers);
        }

        console.log("Start TestServer");
        {
            await server.start();
        }

        while (true) {
            await ContractUtils.delay(1000);
        }

        console.log("Stop TestServer");
        {
            await server.stop();
            await storage.dropTestDB();
        }
    }
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
