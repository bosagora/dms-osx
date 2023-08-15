import { Amount } from "../src/common/Amount";
import { Config } from "../src/common/Config";
import {
    FranchiseeCollection,
    Ledger,
    LinkCollection,
    Token,
    TokenPrice,
    ValidatorCollection,
} from "../typechain-types";
import { ContractUtils } from "./helper/ContractUtils";
import { TestClient, TestServer } from "./helper/Utility";

import chai, { expect } from "chai";
import { solidity } from "ethereum-waffle";
import * as hre from "hardhat";

import * as path from "path";
import { URL } from "url";

import * as assert from "assert";
import { BigNumber, Wallet } from "ethers";

// tslint:disable-next-line:no-var-requires
const URI = require("urijs");

chai.use(solidity);

describe("Test of Server", function () {
    this.timeout(1000 * 60 * 5);
    const provider = hre.waffle.provider;
    const [deployer, foundation, validator1, validator2, validator3, relay, user1, user2, user3] =
        provider.getWallets();

    const validators = [validator1, validator2, validator3];
    const users = [user1, user2, user3];
    const emailHashes: string[] = [
        ContractUtils.sha256String("a@example.com"),
        ContractUtils.sha256String("b@example.com"),
        ContractUtils.sha256String("c@example.com"),
    ];
    let validatorContract: ValidatorCollection;
    let tokenContract: Token;
    let ledgerContract: Ledger;
    let linkCollectionContract: LinkCollection;
    let tokenPriceContract: TokenPrice;
    let franchiseeCollection: FranchiseeCollection;

    const multiple = BigNumber.from(1000000000);
    const price = BigNumber.from(150).mul(multiple);

    const amount = Amount.make(50_000, 18);
    const assetAmount = Amount.make(10_000_000, 18);
    const foundationEmail = "foundation@example.com";
    const foundationAccount = ContractUtils.sha256String(foundationEmail);

    const deployToken = async () => {
        const tokenFactory = await hre.ethers.getContractFactory("Token");
        tokenContract = (await tokenFactory.connect(deployer).deploy("Sample", "SAM")) as Token;
        await tokenContract.deployed();
        await tokenContract.deployTransaction.wait();
        for (const elem of validators) {
            await tokenContract.connect(deployer).transfer(elem.address, amount.value);
        }
    };

    const deployValidatorCollection = async () => {
        const validatorFactory = await hre.ethers.getContractFactory("ValidatorCollection");
        validatorContract = (await validatorFactory.connect(deployer).deploy(
            tokenContract.address,
            validators.map((m) => m.address)
        )) as ValidatorCollection;
        await validatorContract.deployed();
        await validatorContract.deployTransaction.wait();
    };

    const depositValidators = async () => {
        for (const elem of validators) {
            await tokenContract.connect(elem).approve(validatorContract.address, amount.value);
            await expect(validatorContract.connect(elem).deposit(amount.value))
                .to.emit(validatorContract, "DepositedForValidator")
                .withArgs(elem.address, amount.value, amount.value);
            const item = await validatorContract.validatorOf(elem.address);
            assert.deepStrictEqual(item.validator, elem.address);
            assert.deepStrictEqual(item.status, 1);
            assert.deepStrictEqual(item.balance, amount.value);
        }
        await validatorContract.connect(validators[0]).makeActiveItems();
    };

    const deployLinkCollection = async () => {
        const linkCollectionFactory = await hre.ethers.getContractFactory("LinkCollection");
        linkCollectionContract = (await linkCollectionFactory
            .connect(deployer)
            .deploy(validators.map((m) => m.address))) as LinkCollection;
        await linkCollectionContract.deployed();
        await linkCollectionContract.deployTransaction.wait();
    };

    const deployTokenPrice = async () => {
        const tokenPriceFactory = await hre.ethers.getContractFactory("TokenPrice");
        tokenPriceContract = (await tokenPriceFactory
            .connect(deployer)
            .deploy(validatorContract.address)) as TokenPrice;
        await tokenPriceContract.deployed();
        await tokenPriceContract.deployTransaction.wait();
        await tokenPriceContract.connect(validators[0]).set("KRW", price);
    };

    const deployFranchiseeCollection = async () => {
        const franchiseeCollectionFactory = await hre.ethers.getContractFactory("FranchiseeCollection");
        franchiseeCollection = (await franchiseeCollectionFactory
            .connect(deployer)
            .deploy(validatorContract.address)) as FranchiseeCollection;
        await franchiseeCollection.deployed();
        await franchiseeCollection.deployTransaction.wait();
    };

    const deployLedger = async () => {
        const ledgerFactory = await hre.ethers.getContractFactory("Ledger");
        ledgerContract = (await ledgerFactory
            .connect(deployer)
            .deploy(
                foundationAccount,
                tokenContract.address,
                validatorContract.address,
                linkCollectionContract.address,
                tokenPriceContract.address,
                franchiseeCollection.address
            )) as Ledger;
        await ledgerContract.deployed();
        await ledgerContract.deployTransaction.wait();

        await franchiseeCollection.connect(deployer).setLedgerAddress(ledgerContract.address);
    };

    const deployAllContract = async () => {
        await deployToken();
        await deployValidatorCollection();
        await depositValidators();
        await deployLinkCollection();
        await deployTokenPrice();
        await deployFranchiseeCollection();
        await deployLedger();
    };

    const client = new TestClient();
    let server: TestServer;
    let serverURL: URL;
    let config: Config;

    interface IFranchiseeData {
        franchiseeId: string;
        timestamp: number;
        email: string;
    }
    const franchiseeData: IFranchiseeData[] = [
        {
            franchiseeId: "F000100",
            timestamp: 0,
            email: "f1@example.com",
        },
        {
            franchiseeId: "F000200",
            timestamp: 0,
            email: "f2@example.com",
        },
        {
            franchiseeId: "F000300",
            timestamp: 0,
            email: "f3@example.com",
        },
        {
            franchiseeId: "F000400",
            timestamp: 0,
            email: "f4@example.com",
        },
        {
            franchiseeId: "F000500",
            timestamp: 0,
            email: "f5@example.com",
        },
    ];

    context("Exchange token & mileage", () => {
        before("Deploy", async () => {
            await deployAllContract();
        });

        before("Prepare Token", async () => {
            for (const elem of users) {
                await tokenContract.connect(deployer).transfer(elem.address, amount.value.mul(10));
            }
        });

        before("Create Config", async () => {
            config = new Config();
            config.readFromFile(path.resolve(process.cwd(), "config", "config_test.yaml"));
            config.contracts.tokenAddress = tokenContract.address;
            config.contracts.emailLinkerAddress = linkCollectionContract.address;
            config.contracts.ledgerAddress = ledgerContract.address;
        });

        before("Create TestServer", async () => {
            serverURL = new URL(`http://127.0.0.1:${config.server.port}`);
            server = new TestServer(config);
        });

        before("Start TestServer", async () => {
            await server.start();
        });

        after("Stop TestServer", async () => {
            await server.stop();
        });

        context("Prepare franchisee data", () => {
            it("Add Franchisee Data", async () => {
                for (const elem of franchiseeData) {
                    const email = ContractUtils.sha256String(elem.email);
                    await expect(franchiseeCollection.connect(validator1).add(elem.franchiseeId, elem.timestamp, email))
                        .to.emit(franchiseeCollection, "AddedFranchisee")
                        .withArgs(elem.franchiseeId, elem.timestamp, email);
                }
                expect(await franchiseeCollection.franchiseesLength()).to.equal(franchiseeData.length);
            });
        });

        context("Prepare email-address", () => {
            it("Link email-address", async () => {
                const nonce = await linkCollectionContract.nonce(users[0].address);
                const hash = emailHashes[0];
                const signature = await ContractUtils.sign(users[0], hash, nonce);
                await expect(linkCollectionContract.connect(validators[0]).add(hash, users[0].address, signature))
                    .to.emit(linkCollectionContract, "AddedLinkItem")
                    .withArgs(hash, users[0].address);
            });
        });

        context("Exchange token to mileage", () => {
            const amountDepositToken = BigNumber.from(amount.value.mul(2));
            const amountToken = BigNumber.from(amount.value);
            const amountMileage = amountToken.mul(price).div(multiple);

            before("Deposit token", async () => {
                await tokenContract.connect(users[0]).approve(ledgerContract.address, amountDepositToken);
                await expect(ledgerContract.connect(users[0]).deposit(amountDepositToken)).to.emit(
                    ledgerContract,
                    "Deposited"
                );
            });

            it("Success", async () => {
                const nonce = await ledgerContract.nonceOf(users[0].address);
                const signature = await ContractUtils.signExchange(users[0], emailHashes[0], amountToken, nonce);
                await expect(
                    ledgerContract
                        .connect(relay)
                        .exchangeTokenToMileage(emailHashes[0], amountToken, users[0].address, signature)
                )
                    .to.emit(ledgerContract, "ExchangedTokenToMileage")
                    .withNamedArgs({
                        email: emailHashes[0],
                        amountToken,
                        amountMileage,
                    });
            });
        });
    });
});
