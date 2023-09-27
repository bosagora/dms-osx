import { Amount } from "../src/common/Amount";
import { Config } from "../src/common/Config";
import { ContractUtils } from "../src/utils/ContractUtils";
import { CurrencyRate, Ledger, LinkCollection, ShopCollection, Token, ValidatorCollection } from "../typechain-types";
import { TestClient, TestServer } from "./helper/Utility";

import chai, { expect } from "chai";
import { solidity } from "ethereum-waffle";
import * as hre from "hardhat";

import * as path from "path";
import { URL } from "url";

import * as assert from "assert";
import { BigNumber } from "ethers";

// tslint:disable-next-line:no-var-requires
const URI = require("urijs");

chai.use(solidity);

describe("Test of Server", function () {
    this.timeout(1000 * 60 * 5);
    const provider = hre.waffle.provider;
    const [
        deployer,
        foundation,
        validator1,
        validator2,
        validator3,
        user1,
        user2,
        user3,
        relay1,
        relay2,
        relay3,
        relay4,
        relay5,
    ] = provider.getWallets();

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
    let currencyRateContract: CurrencyRate;
    let shopCollection: ShopCollection;

    const multiple = BigNumber.from(1000000000);
    const price = BigNumber.from(150).mul(multiple);

    const amount = Amount.make(50_000, 18);
    const assetAmount = Amount.make(10_000_000, 18);
    const foundationEmail = "foundation@example.com";
    const foundationAccount = ContractUtils.sha256String(foundationEmail);

    const deployToken = async () => {
        const tokenFactory = await hre.ethers.getContractFactory("Token");
        tokenContract = (await tokenFactory.connect(deployer).deploy(deployer.address, "Sample", "SAM")) as Token;
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
    };

    const deployLinkCollection = async () => {
        const linkCollectionFactory = await hre.ethers.getContractFactory("LinkCollection");
        linkCollectionContract = (await linkCollectionFactory
            .connect(deployer)
            .deploy(linkValidators.map((m) => m.address))) as LinkCollection;
        await linkCollectionContract.deployed();
        await linkCollectionContract.deployTransaction.wait();
    };

    const deployCurrencyRate = async () => {
        const currencyRateFactory = await hre.ethers.getContractFactory("CurrencyRate");
        currencyRateContract = (await currencyRateFactory
            .connect(deployer)
            .deploy(validatorContract.address)) as CurrencyRate;
        await currencyRateContract.deployed();
        await currencyRateContract.deployTransaction.wait();
        await currencyRateContract.connect(validators[0]).set(await tokenContract.symbol(), price);
    };

    const deployShopCollection = async () => {
        const shopCollectionFactory = await hre.ethers.getContractFactory("ShopCollection");
        shopCollection = (await shopCollectionFactory
            .connect(deployer)
            .deploy(validatorContract.address)) as ShopCollection;
        await shopCollection.deployed();
        await shopCollection.deployTransaction.wait();
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
                currencyRateContract.address,
                shopCollection.address
            )) as Ledger;
        await ledgerContract.deployed();
        await ledgerContract.deployTransaction.wait();

        await shopCollection.connect(deployer).setLedgerAddress(ledgerContract.address);
    };

    const deployAllContract = async () => {
        await deployToken();
        await deployValidatorCollection();
        await depositValidators();
        await deployLinkCollection();
        await deployCurrencyRate();
        await deployShopCollection();
        await deployLedger();
    };

    const client = new TestClient();
    let server: TestServer;
    let serverURL: URL;
    let config: Config;

    interface IShopData {
        shopId: string;
        timestamp: number;
        email: string;
    }
    const shopData: IShopData[] = [
        {
            shopId: "F000100",
            timestamp: 0,
            email: "f1@example.com",
        },
        {
            shopId: "F000200",
            timestamp: 0,
            email: "f2@example.com",
        },
        {
            shopId: "F000300",
            timestamp: 0,
            email: "f3@example.com",
        },
        {
            shopId: "F000400",
            timestamp: 0,
            email: "f4@example.com",
        },
        {
            shopId: "F000500",
            timestamp: 0,
            email: "f5@example.com",
        },
    ];

    let reqId: string;
    context("Test token & point relay endpoints", () => {
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

            config.relay.managerKeys = [
                relay1.privateKey,
                relay2.privateKey,
                relay3.privateKey,
                relay4.privateKey,
                relay5.privateKey,
            ];
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

        context("Prepare shop data", () => {
            it("Add Shop Data", async () => {
                for (const elem of shopData) {
                    const email = ContractUtils.sha256String(elem.email);
                    await expect(shopCollection.connect(validator1).add(elem.shopId, elem.timestamp, email))
                        .to.emit(shopCollection, "AddedShop")
                        .withArgs(elem.shopId, elem.timestamp, email);
                }
                expect(await shopCollection.shopsLength()).to.equal(shopData.length);
            });
        });

        context("Save Purchase Data", () => {
            const purchaseData1 = {
                purchaseId: "P000001",
                timestamp: 1672844400,
                amount: 10000,
                userEmail: "a@example.com",
                shopId: "F000100",
                method: 0,
            };

            it("Save Purchase Data", async () => {
                const hash = emailHashes[0];
                const purchaseAmount = Amount.make(purchaseData1.amount, 18).value;
                const amt = purchaseAmount.div(100);
                await expect(
                    ledgerContract
                        .connect(validators[0])
                        .savePurchase(
                            purchaseData1.purchaseId,
                            purchaseData1.timestamp,
                            purchaseAmount,
                            hash,
                            purchaseData1.shopId,
                            purchaseData1.method
                        )
                )
                    .to.emit(ledgerContract, "SavedPurchase")
                    .withArgs(
                        purchaseData1.purchaseId,
                        purchaseData1.timestamp,
                        purchaseAmount,
                        hash,
                        purchaseData1.shopId,
                        purchaseData1.method
                    )
                    .emit(ledgerContract, "ProvidedPoint")
                    .withNamedArgs({
                        email: hash,
                        providedAmountPoint: amt,
                        value: amt,
                        purchaseId: purchaseData1.purchaseId,
                    });
            });
        });

        context("Prepare email-address", () => {
            it("Link email-address", async () => {
                const nonce = await linkCollectionContract.nonceOf(users[0].address);
                const hash = emailHashes[0];
                const signature = await ContractUtils.sign(users[0], hash, nonce);
                reqId = ContractUtils.getRequestId(hash, users[0].address, nonce);
                await expect(
                    linkCollectionContract.connect(relay1).addRequest(reqId, hash, users[0].address, signature)
                )
                    .to.emit(linkCollectionContract, "AddedRequestItem")
                    .withArgs(reqId, hash, users[0].address);
                await linkCollectionContract.connect(validator1).voteRequest(reqId);
                await linkCollectionContract.connect(validator1).countVote(reqId);
            });
        });

        context("payPoint & payToken", () => {
            const purchaseData = {
                purchaseId: "P000001",
                timestamp: 1672844400,
                amount: 100,
                userEmail: "a@example.com",
                shopId: "F000100",
                method: 0,
            };

            const amountDepositToken = BigNumber.from(amount.value.mul(2));
            const amountToken = BigNumber.from(amount.value);
            const amountPoint = amountToken.mul(price).div(multiple);

            before("Deposit token", async () => {
                await tokenContract.connect(users[0]).approve(ledgerContract.address, amountDepositToken);
                await expect(ledgerContract.connect(users[0]).deposit(amountDepositToken)).to.emit(
                    ledgerContract,
                    "Deposited"
                );
            });

            it("Failure test of the path /payPoint 'Insufficient balance'", async () => {
                const over_purchaseAmount = Amount.make(90_000_000, 18).value;
                const nonce = await ledgerContract.nonceOf(users[0].address);
                const signature = await ContractUtils.signPayment(
                    users[0],
                    purchaseData.purchaseId,
                    over_purchaseAmount,
                    emailHashes[0],
                    shopData[0].shopId,
                    nonce
                );
                const uri = URI(serverURL).directory("payPoint");
                const url = uri.toString();
                const response = await client.post(url, {
                    purchaseId: purchaseData.purchaseId,
                    amount: over_purchaseAmount.toString(),
                    email: emailHashes[0],
                    shopId: purchaseData.shopId,
                    signer: users[0].address,
                    signature,
                });

                assert.deepStrictEqual(response.data.code, 500);
                assert.ok(response.data.error.message === "Insufficient balance");
            });

            it("Failure test of the path /payPoint 'Email is not valid.'", async () => {
                const purchaseAmount = Amount.make(purchaseData.amount, 18).value;
                const nonce = await ledgerContract.nonceOf(users[0].address);
                const signature = await ContractUtils.signPayment(
                    users[0],
                    purchaseData.purchaseId,
                    purchaseAmount,
                    emailHashes[0],
                    shopData[0].shopId,
                    nonce
                );
                const uri = URI(serverURL).directory("payPoint");
                const url = uri.toString();
                const response = await client.post(url, {
                    purchaseId: purchaseData.purchaseId,
                    amount: purchaseAmount.toString(),
                    email: emailHashes[0],
                    shopId: purchaseData.shopId,
                    signer: "",
                    signature,
                });

                assert.deepStrictEqual(response.data.code, 501);
                assert.ok(response.data.error.message === "Failed to check the validity of parameters.");
            });

            it("Failure test of the path /payPoint 'Invalid signature'", async () => {
                const purchaseAmount = Amount.make(purchaseData.amount, 18).value;
                const nonce = await ledgerContract.nonceOf(users[0].address);
                const signature = await ContractUtils.signPayment(
                    users[1],
                    purchaseData.purchaseId,
                    purchaseAmount,
                    emailHashes[0],
                    shopData[0].shopId,
                    nonce
                );
                const uri = URI(serverURL).directory("payPoint");
                const url = uri.toString();
                const response = await client.post(url, {
                    purchaseId: purchaseData.purchaseId,
                    amount: purchaseAmount.toString(),
                    email: emailHashes[0],
                    shopId: purchaseData.shopId,
                    signer: users[0].address,
                    signature,
                });

                assert.deepStrictEqual(response.data.code, 500);
                assert.ok(response.data.error.message === "Signature is not valid.");
            });

            it("Failure test of the path /payPoint 'Email is not valid.'", async () => {
                const purchaseAmount = Amount.make(purchaseData.amount, 18).value;
                const nonce = await ledgerContract.nonceOf(users[0].address);
                const signature = await ContractUtils.signPayment(
                    users[0],
                    purchaseData.purchaseId,
                    purchaseAmount,
                    emailHashes[1],
                    shopData[0].shopId,
                    nonce
                );
                const uri = URI(serverURL).directory("payPoint");
                const url = uri.toString();
                const response = await client.post(url, {
                    purchaseId: purchaseData.purchaseId,
                    amount: purchaseAmount.toString(),
                    email: emailHashes[1],
                    shopId: purchaseData.shopId,
                    signer: users[0].address,
                    signature,
                });

                assert.deepStrictEqual(response.data.code, 502);
                assert.ok(response.data.error.message === "Email is not valid.");
            });

            it("Success Test of the path /payPoint", async () => {
                const purchaseAmount = Amount.make(purchaseData.amount, 18).value;
                const nonce = await ledgerContract.nonceOf(users[0].address);
                const signature = await ContractUtils.signPayment(
                    users[0],
                    purchaseData.purchaseId,
                    purchaseAmount,
                    emailHashes[0],
                    shopData[0].shopId,
                    nonce
                );
                const uri = URI(serverURL).directory("payPoint");
                const url = uri.toString();
                const response = await client.post(url, {
                    purchaseId: purchaseData.purchaseId,
                    amount: purchaseAmount.toString(),
                    email: emailHashes[0],
                    shopId: purchaseData.shopId,
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
                    shopData[0].shopId,
                    nonce
                );
                const uri = URI(serverURL).directory("payToken");
                const url = uri.toString();
                const response = await client.post(url, {
                    purchaseId: purchaseData.purchaseId,
                    amount: over_purchaseAmount.toString(),
                    email: emailHashes[0],
                    shopId: purchaseData.shopId,
                    signer: users[0].address,
                    signature,
                });

                assert.deepStrictEqual(response.data.code, 500);
                assert.ok(response.data.error.message === "Insufficient balance");
            });

            it("Failure test of the path /payToken 'Email is not valid.'", async () => {
                const purchaseAmount = Amount.make(purchaseData.amount, 18).value;
                const nonce = await ledgerContract.nonceOf(users[0].address);
                const signature = await ContractUtils.signPayment(
                    users[0],
                    purchaseData.purchaseId,
                    purchaseAmount,
                    emailHashes[0],
                    shopData[0].shopId,
                    nonce
                );
                const uri = URI(serverURL).directory("payToken");
                const url = uri.toString();
                const response = await client.post(url, {
                    purchaseId: purchaseData.purchaseId,
                    amount: purchaseAmount.toString(),
                    email: emailHashes[0],
                    shopId: purchaseData.shopId,
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
                    shopData[0].shopId,
                    nonce
                );
                const uri = URI(serverURL).directory("payToken");
                const url = uri.toString();
                const response = await client.post(url, {
                    purchaseId: purchaseData.purchaseId,
                    amount: purchaseAmount.toString(),
                    email: emailHashes[0],
                    shopId: purchaseData.shopId,
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
                    shopData[0].shopId,
                    nonce
                );
                const uri = URI(serverURL).directory("payToken");
                const url = uri.toString();
                const response = await client.post(url, {
                    purchaseId: purchaseData.purchaseId,
                    amount: purchaseAmount.toString(),
                    email: emailHashes[1],
                    shopId: purchaseData.shopId,
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
                    shopData[0].shopId,
                    nonce
                );
                const uri = URI(serverURL).directory("payToken");
                const url = uri.toString();
                const response = await client.post(url, {
                    purchaseId: purchaseData.purchaseId,
                    amount: purchaseAmount.toString(),
                    email: emailHashes[0],
                    shopId: purchaseData.shopId,
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
