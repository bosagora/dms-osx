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
import { ContractUtils } from "../src/utils/ContractUtils";
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
    const linkValidators = [validator1];
    const users = [user1, user2, user3];
    const emailHashes: string[] = [
        ContractUtils.sha256String("a@example.com"),
        ContractUtils.sha256String("b@example.com"),
        ContractUtils.sha256String("c@example.com"),
        ContractUtils.sha256String("d@example.com"),
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
            .deploy(linkValidators.map((m) => m.address))) as LinkCollection;
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

    const purchaseData = {
        purchaseId: "P000001",
        timestamp: 1672844400,
        amount: 100,
        userEmail: "a@example.com",
        franchiseeId: "F000100",
        method: 0,
    };

    let reqId: string;
    context("Test token & mileage relay endpoints", () => {
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
                const nonce = await linkCollectionContract.nonceOf(users[0].address);
                const hash = emailHashes[0];
                const signature = await ContractUtils.sign(users[0], hash, nonce);
                reqId = ContractUtils.getRequestId(hash, users[0].address, nonce);
                await expect(linkCollectionContract.connect(relay).addRequest(reqId, hash, users[0].address, signature))
                    .to.emit(linkCollectionContract, "AddedRequestItem")
                    .withArgs(reqId, hash, users[0].address);
                await linkCollectionContract.connect(validator1).voteRequest(reqId, 1);
            });
        });

        context("Exchange token & mileage", () => {
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

            it("Failure Exchange token to mileage", async () => {
                const over_purchaseAmount = Amount.make(90_000_000, 18).value;
                const nonce = await ledgerContract.nonceOf(users[0].address);
                const signature = await ContractUtils.signExchange(
                    users[0],
                    emailHashes[0],
                    over_purchaseAmount,
                    nonce
                );

                const uri = URI(serverURL).directory("exchangeTokenToMileage");
                const url = uri.toString();

                const response = await client.post(url, {
                    email: emailHashes[0],
                    amountToken: over_purchaseAmount.toString(),
                    signer: users[0].address,
                    signature,
                });
                assert.deepStrictEqual(response.data.code, 500);
                assert.ok(
                    response.data.error.message ===
                        "VM Exception while processing transaction: reverted with reason string 'Insufficient balance'"
                );
            });

            it("Failure Exchange token to mileage", async () => {
                const nonce = await ledgerContract.nonceOf(users[0].address);
                const signature = await ContractUtils.signExchange(users[1], emailHashes[0], amountToken, nonce);

                const uri = URI(serverURL).directory("exchangeTokenToMileage");
                const url = uri.toString();

                const response = await client.post(url, {
                    email: emailHashes[0],
                    amountToken: amountToken.toString(),
                    signer: users[0].address,
                    signature,
                });
                assert.deepStrictEqual(response.data.code, 500);
                assert.ok(response.data.error.message === "Signature is not valid.");
            });

            it("Success Exchange token to mileage", async () => {
                const nonce = await ledgerContract.nonceOf(users[0].address);
                const signature = await ContractUtils.signExchange(users[0], emailHashes[0], amountToken, nonce);

                const uri = URI(serverURL).directory("exchangeTokenToMileage");
                const url = uri.toString();

                const response = await client.post(url, {
                    email: emailHashes[0],
                    amountToken: amountToken.toString(),
                    signer: users[0].address,
                    signature,
                });
                assert.deepStrictEqual(response.data.code, 200);
                assert.ok(response.data.data !== undefined);
                assert.ok(response.data.data.txHash !== undefined);
            });

            it("Failure Exchange mileage to token", async () => {
                const over_amount = Amount.make(90_000_000, 18).value;
                const nonce = await ledgerContract.nonceOf(users[0].address);
                const signature = await ContractUtils.signExchange(users[0], emailHashes[0], over_amount, nonce);

                const uri = URI(serverURL).directory("exchangeMileageToToken");
                const url = uri.toString();

                const response = await client.post(url, {
                    email: emailHashes[0],
                    amountMileage: over_amount.toString(),
                    signer: users[0].address,
                    signature,
                });
                assert.deepStrictEqual(response.data.code, 500);
                assert.ok(
                    response.data.error.message ===
                        "VM Exception while processing transaction: reverted with reason string 'Insufficient balance'"
                );
            });

            it("Failure Exchange mileage to token", async () => {
                const nonce = await ledgerContract.nonceOf(users[0].address);
                const signature = await ContractUtils.signExchange(
                    users[1],
                    emailHashes[0],
                    purchaseData.amount,
                    nonce
                );

                const uri = URI(serverURL).directory("exchangeMileageToToken");
                const url = uri.toString();

                const response = await client.post(url, {
                    email: emailHashes[0],
                    amountMileage: purchaseData.amount.toString(),
                    signer: users[0].address,
                    signature,
                });
                assert.deepStrictEqual(response.data.code, 500);
                assert.ok(response.data.error.message === "Signature is not valid.");
            });

            it("Success Exchange mileage to token", async () => {
                const nonce = await ledgerContract.nonceOf(users[0].address);
                const signature = await ContractUtils.signExchange(
                    users[0],
                    emailHashes[0],
                    purchaseData.amount,
                    nonce
                );

                const uri = URI(serverURL).directory("exchangeMileageToToken");
                const url = uri.toString();

                const response = await client.post(url, {
                    email: emailHashes[0],
                    amountMileage: purchaseData.amount.toString(),
                    signer: users[0].address,
                    signature,
                });
                assert.deepStrictEqual(response.data.code, 200);
                assert.ok(response.data.data !== undefined);
                assert.ok(response.data.data.txHash !== undefined);
            });

            it("Failure test of the path /payMileage 'Insufficient balance'", async () => {
                const over_purchaseAmount = Amount.make(90_000_000, 18).value;
                const nonce = await ledgerContract.nonceOf(users[0].address);
                const signature = await ContractUtils.signPayment(
                    users[0],
                    purchaseData.purchaseId,
                    over_purchaseAmount,
                    emailHashes[0],
                    franchiseeData[0].franchiseeId,
                    nonce
                );
                const uri = URI(serverURL).directory("payMileage");
                const url = uri.toString();
                const response = await client.post(url, {
                    purchaseId: purchaseData.purchaseId,
                    amount: over_purchaseAmount.toString(),
                    email: emailHashes[0],
                    franchiseeId: purchaseData.franchiseeId,
                    signer: users[0].address,
                    signature,
                });

                assert.deepStrictEqual(response.data.code, 500);
                assert.ok(
                    response.data.error.message ===
                        "VM Exception while processing transaction: reverted with reason string 'Insufficient balance'"
                );
            });

            it("Failure test of the path /payMileage 'Email is not valid.'", async () => {
                const purchaseAmount = Amount.make(purchaseData.amount, 18).value;
                const nonce = await ledgerContract.nonceOf(users[0].address);
                const signature = await ContractUtils.signPayment(
                    users[0],
                    purchaseData.purchaseId,
                    purchaseAmount,
                    emailHashes[0],
                    franchiseeData[0].franchiseeId,
                    nonce
                );
                const uri = URI(serverURL).directory("payMileage");
                const url = uri.toString();
                const response = await client.post(url, {
                    purchaseId: purchaseData.purchaseId,
                    amount: purchaseAmount.toString(),
                    email: emailHashes[0],
                    franchiseeId: purchaseData.franchiseeId,
                    signer: "",
                    signature,
                });

                assert.deepStrictEqual(response.data.code, 501);
                assert.ok(response.data.error.message === "Failed to check the validity of parameters.");
            });

            it("Failure test of the path /payMileage 'Invalid signature'", async () => {
                const purchaseAmount = Amount.make(purchaseData.amount, 18).value;
                const nonce = await ledgerContract.nonceOf(users[0].address);
                const signature = await ContractUtils.signPayment(
                    users[1],
                    purchaseData.purchaseId,
                    purchaseAmount,
                    emailHashes[0],
                    franchiseeData[0].franchiseeId,
                    nonce
                );
                const uri = URI(serverURL).directory("payMileage");
                const url = uri.toString();
                const response = await client.post(url, {
                    purchaseId: purchaseData.purchaseId,
                    amount: purchaseAmount.toString(),
                    email: emailHashes[0],
                    franchiseeId: purchaseData.franchiseeId,
                    signer: users[0].address,
                    signature,
                });

                assert.deepStrictEqual(response.data.code, 500);
                assert.ok(response.data.error.message === "Signature is not valid.");
            });

            it("Failure test of the path /payMileage 'Email is not valid.'", async () => {
                const purchaseAmount = Amount.make(purchaseData.amount, 18).value;
                const nonce = await ledgerContract.nonceOf(users[0].address);
                const signature = await ContractUtils.signPayment(
                    users[0],
                    purchaseData.purchaseId,
                    purchaseAmount,
                    emailHashes[1],
                    franchiseeData[0].franchiseeId,
                    nonce
                );
                const uri = URI(serverURL).directory("payMileage");
                const url = uri.toString();
                const response = await client.post(url, {
                    purchaseId: purchaseData.purchaseId,
                    amount: purchaseAmount.toString(),
                    email: emailHashes[1],
                    franchiseeId: purchaseData.franchiseeId,
                    signer: users[0].address,
                    signature,
                });

                assert.deepStrictEqual(response.data.code, 502);
                assert.ok(response.data.error.message === "Email is not valid.");
            });

            it("Success Test of the path /payMileage", async () => {
                const purchaseAmount = Amount.make(purchaseData.amount, 18).value;
                const nonce = await ledgerContract.nonceOf(users[0].address);
                const signature = await ContractUtils.signPayment(
                    users[0],
                    purchaseData.purchaseId,
                    purchaseAmount,
                    emailHashes[0],
                    franchiseeData[0].franchiseeId,
                    nonce
                );
                const uri = URI(serverURL).directory("payMileage");
                const url = uri.toString();
                const response = await client.post(url, {
                    purchaseId: purchaseData.purchaseId,
                    amount: purchaseAmount.toString(),
                    email: emailHashes[0],
                    franchiseeId: purchaseData.franchiseeId,
                    signer: users[0].address,
                    signature,
                });

                assert.deepStrictEqual(response.data.code, 200);
                assert.ok(response.data.data !== undefined);
                assert.ok(response.data.data.txHash !== undefined);
            });

            it("Failure test of the path /payToken 'Insufficient balance'", async () => {
                const over_purchaseAmount = Amount.make(90_000_000, 18).value;
                const nonce = await ledgerContract.nonceOf(users[0].address);
                const signature = await ContractUtils.signPayment(
                    users[0],
                    purchaseData.purchaseId,
                    over_purchaseAmount,
                    emailHashes[0],
                    franchiseeData[0].franchiseeId,
                    nonce
                );
                const uri = URI(serverURL).directory("payToken");
                const url = uri.toString();
                const response = await client.post(url, {
                    purchaseId: purchaseData.purchaseId,
                    amount: over_purchaseAmount.toString(),
                    email: emailHashes[0],
                    franchiseeId: purchaseData.franchiseeId,
                    signer: users[0].address,
                    signature,
                });

                assert.deepStrictEqual(response.data.code, 500);
                assert.ok(
                    response.data.error.message ===
                        "VM Exception while processing transaction: reverted with reason string 'Insufficient balance'"
                );
            });

            it("Failure test of the path /payToken 'Email is not valid.'", async () => {
                const purchaseAmount = Amount.make(purchaseData.amount, 18).value;
                const nonce = await ledgerContract.nonceOf(users[0].address);
                const signature = await ContractUtils.signPayment(
                    users[0],
                    purchaseData.purchaseId,
                    purchaseAmount,
                    emailHashes[0],
                    franchiseeData[0].franchiseeId,
                    nonce
                );
                const uri = URI(serverURL).directory("payToken");
                const url = uri.toString();
                const response = await client.post(url, {
                    purchaseId: purchaseData.purchaseId,
                    amount: purchaseAmount.toString(),
                    email: emailHashes[0],
                    franchiseeId: purchaseData.franchiseeId,
                    signer: "",
                    signature,
                });

                assert.deepStrictEqual(response.data.code, 501);
                assert.ok(response.data.error.message === "Failed to check the validity of parameters.");
            });

            it("Failure test of the path /payToken 'Invalid signature'", async () => {
                const purchaseAmount = Amount.make(purchaseData.amount, 18).value;
                const nonce = await ledgerContract.nonceOf(users[0].address);
                const signature = await ContractUtils.signPayment(
                    users[1],
                    purchaseData.purchaseId,
                    purchaseAmount,
                    emailHashes[0],
                    franchiseeData[0].franchiseeId,
                    nonce
                );
                const uri = URI(serverURL).directory("payToken");
                const url = uri.toString();
                const response = await client.post(url, {
                    purchaseId: purchaseData.purchaseId,
                    amount: purchaseAmount.toString(),
                    email: emailHashes[0],
                    franchiseeId: purchaseData.franchiseeId,
                    signer: users[0].address,
                    signature,
                });

                assert.deepStrictEqual(response.data.code, 500);
                assert.ok(response.data.error.message === "Signature is not valid.");
            });

            it("Failure test of the path /payToken 'Email is not valid.'", async () => {
                const purchaseAmount = Amount.make(purchaseData.amount, 18).value;
                const nonce = await ledgerContract.nonceOf(users[0].address);
                const signature = await ContractUtils.signPayment(
                    users[0],
                    purchaseData.purchaseId,
                    purchaseAmount,
                    emailHashes[1],
                    franchiseeData[0].franchiseeId,
                    nonce
                );
                const uri = URI(serverURL).directory("payToken");
                const url = uri.toString();
                const response = await client.post(url, {
                    purchaseId: purchaseData.purchaseId,
                    amount: purchaseAmount.toString(),
                    email: emailHashes[1],
                    franchiseeId: purchaseData.franchiseeId,
                    signer: users[0].address,
                    signature,
                });

                assert.deepStrictEqual(response.data.code, 502);
                assert.ok(response.data.error.message === "Email is not valid.");
            });

            it("Success Test of the path /payToken", async () => {
                const purchaseAmount = Amount.make(purchaseData.amount, 18).value;
                const nonce = await ledgerContract.nonceOf(users[0].address);
                const signature = await ContractUtils.signPayment(
                    users[0],
                    purchaseData.purchaseId,
                    purchaseAmount,
                    emailHashes[0],
                    franchiseeData[0].franchiseeId,
                    nonce
                );
                const uri = URI(serverURL).directory("payToken");
                const url = uri.toString();
                const response = await client.post(url, {
                    purchaseId: purchaseData.purchaseId,
                    amount: purchaseAmount.toString(),
                    email: emailHashes[0],
                    franchiseeId: purchaseData.franchiseeId,
                    signer: users[0].address,
                    signature,
                });

                assert.deepStrictEqual(response.data.code, 200);
                assert.ok(response.data.data !== undefined);
                assert.ok(response.data.data.txHash !== undefined);
            });
        });
    });
});
