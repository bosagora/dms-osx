import {
    FranchiseeCollection,
    Ledger,
    LinkCollection,
    Token,
    TokenPrice,
    ValidatorCollection,
} from "../typechain-types";
import { Amount } from "../src/utils/Amount";
import { ContractUtils } from "../src/utils/ContractUtils";

import "@nomiclabs/hardhat-ethers";
import "@nomiclabs/hardhat-waffle";

import assert from "assert";
import chai, { expect } from "chai";
import { solidity } from "ethereum-waffle";

import { BigNumber } from "ethers";
import * as hre from "hardhat";

chai.use(solidity);

interface PurchaseData {
    purchaseId: string;
    timestamp: number;
    amount: number;
    userEmail: string;
    franchiseeId: string;
    method: number;
}

describe("Test for Ledger", () => {
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

    let requestId: string;
    context("Save Purchase Data & Pay (mileage, token)", () => {
        const purchaseData: PurchaseData[] = [
            {
                purchaseId: "P000001",
                timestamp: 1672844400,
                amount: 10000,
                userEmail: "a@example.com",
                franchiseeId: "F000100",
                method: 0,
            },
            {
                purchaseId: "P000002",
                timestamp: 1675522800,
                amount: 10000,
                userEmail: "b@example.com",
                franchiseeId: "F000100",
                method: 0,
            },
            {
                purchaseId: "P000003",
                timestamp: 1677942000,
                amount: 10000,
                userEmail: "c@example.com",
                franchiseeId: "F000200",
                method: 0,
            },
            {
                purchaseId: "P000004",
                timestamp: 1680620400,
                amount: 10000,
                userEmail: "d@example.com",
                franchiseeId: "F000300",
                method: 0,
            },
            {
                purchaseId: "P000005",
                timestamp: 1683212400,
                amount: 10000,
                userEmail: "a@example.com",
                franchiseeId: "F000200",
                method: 0,
            },
        ];

        before("Deploy", async () => {
            await deployAllContract();
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

        context("Prepare foundation's asset", () => {
            it("Register foundation's account", async () => {
                const nonce = await linkCollectionContract.nonceOf(foundation.address);
                const signature = await ContractUtils.sign(foundation, foundationAccount, nonce);
                requestId = ContractUtils.getRequestId(foundationAccount, foundation.address, nonce);
                await expect(
                    linkCollectionContract
                        .connect(relay)
                        .addRequest(requestId, foundationAccount, foundation.address, signature)
                )
                    .to.emit(linkCollectionContract, "AddedRequestItem")
                    .withArgs(requestId, foundationAccount, foundation.address);
                await linkCollectionContract.connect(validator1).voteRequest(requestId, 1);
                await linkCollectionContract.connect(validator1).countVote(requestId);
            });

            it("Deposit foundation's token", async () => {
                await tokenContract.connect(deployer).transfer(foundation.address, assetAmount.value);
                await tokenContract.connect(foundation).approve(ledgerContract.address, assetAmount.value);
                await expect(ledgerContract.connect(foundation).deposit(assetAmount.value))
                    .to.emit(ledgerContract, "Deposited")
                    .withNamedArgs({
                        email: foundationAccount,
                        depositAmount: assetAmount.value,
                        balanceToken: assetAmount.value,
                        account: foundation.address,
                    });
            });
        });

        context("Save Purchase Data", () => {
            it("Save Purchase Data - Not validator", async () => {
                for (const purchase of purchaseData) {
                    const hash = ContractUtils.sha256String(purchase.userEmail);
                    const purchaseAmount = Amount.make(purchase.amount, 18).value;
                    await expect(
                        ledgerContract
                            .connect(deployer)
                            .savePurchase(
                                purchase.purchaseId,
                                purchase.timestamp,
                                purchaseAmount,
                                hash,
                                purchase.franchiseeId,
                                purchase.method
                            )
                    ).to.be.revertedWith("Not validator");
                }
            });

            it("Save Purchase Data", async () => {
                for (const purchase of purchaseData) {
                    const emailHash = ContractUtils.sha256String(purchase.userEmail);
                    const purchaseAmount = Amount.make(purchase.amount, 18).value;
                    const amt = purchaseAmount.div(100);
                    await expect(
                        ledgerContract
                            .connect(validators[0])
                            .savePurchase(
                                purchase.purchaseId,
                                purchase.timestamp,
                                purchaseAmount,
                                emailHash,
                                purchase.franchiseeId,
                                purchase.method
                            )
                    )
                        .to.emit(ledgerContract, "SavedPurchase")
                        .withArgs(
                            purchase.purchaseId,
                            purchase.timestamp,
                            purchaseAmount,
                            emailHash,
                            purchase.franchiseeId,
                            purchase.method
                        )
                        .emit(ledgerContract, "ProvidedMileage")
                        .withNamedArgs({
                            email: emailHash,
                            providedAmountMileage: amt,
                            value: amt,
                            purchaseId: purchase.purchaseId,
                        });
                }
            });

            it("Check balances", async () => {
                const expected: Map<string, BigNumber> = new Map<string, BigNumber>();
                for (const purchase of purchaseData) {
                    const purchaseAmount = Amount.make(purchase.amount, 18).value;
                    const key = ContractUtils.sha256String(purchase.userEmail);
                    const oldValue = expected.get(key);
                    const mileage = purchaseAmount.div(100);
                    if (oldValue !== undefined) expected.set(key, oldValue.add(mileage));
                    else expected.set(key, mileage);
                }
                for (const key of expected.keys())
                    expect(await ledgerContract.mileageBalanceOf(key)).to.deep.equal(expected.get(key));
            });

            it("Link email-address", async () => {
                const nonce = await linkCollectionContract.nonceOf(users[0].address);
                const hash = emailHashes[0];
                const signature = await ContractUtils.sign(users[0], hash, nonce);
                requestId = ContractUtils.getRequestId(hash, users[0].address, nonce);
                await expect(
                    linkCollectionContract.connect(relay).addRequest(requestId, hash, users[0].address, signature)
                )
                    .to.emit(linkCollectionContract, "AddedRequestItem")
                    .withArgs(requestId, hash, users[0].address);
                await linkCollectionContract.connect(validator1).voteRequest(requestId, 1);
                await linkCollectionContract.connect(validator1).countVote(requestId);
            });

            it("Save Purchase Data - email and address are registered", async () => {
                const purchase = {
                    purchaseId: "P000006",
                    timestamp: 1672844400,
                    amount: 10000,
                    userEmail: "a@example.com",
                    franchiseeId: "F000600",
                    method: 0,
                };
                const purchaseAmount = Amount.make(purchase.amount, 18).value;
                const mileageAmount = purchaseAmount.div(100);
                const tokenAmount = mileageAmount.mul(multiple).div(price);
                const emailHash = ContractUtils.sha256String(purchase.userEmail);
                const oldMileageBalance = await ledgerContract.mileageBalanceOf(emailHash);
                const oldTokenBalance = await ledgerContract.tokenBalanceOf(emailHash);
                const oldFoundationTokenBalance = await ledgerContract.tokenBalanceOf(foundationAccount);
                await expect(
                    ledgerContract
                        .connect(validators[0])
                        .savePurchase(
                            purchase.purchaseId,
                            purchase.timestamp,
                            purchaseAmount,
                            emailHash,
                            purchase.franchiseeId,
                            purchase.method
                        )
                )
                    .to.emit(ledgerContract, "SavedPurchase")
                    .withArgs(
                        purchase.purchaseId,
                        purchase.timestamp,
                        purchaseAmount,
                        emailHash,
                        purchase.franchiseeId,
                        purchase.method
                    )
                    .emit(ledgerContract, "ProvidedToken")
                    .withNamedArgs({
                        email: emailHash,
                        providedAmountToken: tokenAmount,
                        value: mileageAmount,
                        purchaseId: purchase.purchaseId,
                    });
                expect(await ledgerContract.mileageBalanceOf(emailHash)).to.deep.equal(oldMileageBalance);
                expect(await ledgerContract.tokenBalanceOf(emailHash)).to.deep.equal(oldTokenBalance.add(tokenAmount));
                expect(await ledgerContract.tokenBalanceOf(foundationAccount)).to.deep.equal(
                    oldFoundationTokenBalance.sub(tokenAmount)
                );
            });

            it("Save Purchase Data - email and address are not registered", async () => {
                const purchase = {
                    purchaseId: "P000007",
                    timestamp: 1672844400,
                    amount: 10000,
                    userEmail: "b@example.com",
                    franchiseeId: "F000600",
                    method: 0,
                };

                const purchaseAmount = Amount.make(purchase.amount, 18).value;
                const amt = purchaseAmount.div(100);
                const emailHash = ContractUtils.sha256String(purchase.userEmail);
                const oldMileageBalance = await ledgerContract.mileageBalanceOf(emailHash);
                const oldTokenBalance = await ledgerContract.tokenBalanceOf(emailHash);
                await expect(
                    ledgerContract
                        .connect(validators[0])
                        .savePurchase(
                            purchase.purchaseId,
                            purchase.timestamp,
                            purchaseAmount,
                            emailHash,
                            purchase.franchiseeId,
                            purchase.method
                        )
                )
                    .to.emit(ledgerContract, "SavedPurchase")
                    .withArgs(
                        purchase.purchaseId,
                        purchase.timestamp,
                        purchaseAmount,
                        emailHash,
                        purchase.franchiseeId,
                        purchase.method
                    )
                    .emit(ledgerContract, "ProvidedMileage")
                    .withNamedArgs({
                        email: emailHash,
                        providedAmountMileage: amt,
                        value: amt,
                        purchaseId: purchase.purchaseId,
                    });
                expect(await ledgerContract.mileageBalanceOf(emailHash)).to.deep.equal(oldMileageBalance.add(amt));
                expect(await ledgerContract.tokenBalanceOf(emailHash)).to.deep.equal(oldTokenBalance);
            });
        });

        context("Pay mileage", () => {
            it("Pay mileage - Invalid signature", async () => {
                const purchase = {
                    purchaseId: "P000008",
                    amount: 100,
                    userEmail: "a@example.com",
                    franchiseeId: "F000600",
                };

                const purchaseAmount = Amount.make(purchase.amount, 18).value;
                const emailHash = ContractUtils.sha256String(purchase.userEmail);
                const nonce = await ledgerContract.nonceOf(users[0].address);
                const signature = await ContractUtils.signPayment(
                    users[0],
                    purchase.purchaseId,
                    purchaseAmount,
                    emailHash,
                    purchase.franchiseeId,
                    nonce
                );
                await expect(
                    ledgerContract
                        .connect(relay)
                        .payMileage(
                            purchase.purchaseId,
                            purchaseAmount,
                            emailHash,
                            purchase.franchiseeId,
                            users[1].address,
                            signature
                        )
                ).to.be.revertedWith("Invalid signature");
            });

            it("Pay mileage - Unregistered email-address", async () => {
                const purchase = {
                    purchaseId: "P000008",
                    amount: 100,
                    userEmail: "b@example.com",
                    franchiseeId: "F000600",
                };

                const purchaseAmount = Amount.make(purchase.amount, 18).value;
                const emailHash = ContractUtils.sha256String(purchase.userEmail);
                const nonce = await ledgerContract.nonceOf(users[0].address);
                const signature = await ContractUtils.signPayment(
                    users[0],
                    purchase.purchaseId,
                    purchaseAmount,
                    emailHash,
                    purchase.franchiseeId,
                    nonce
                );
                await expect(
                    ledgerContract
                        .connect(relay)
                        .payMileage(
                            purchase.purchaseId,
                            purchaseAmount,
                            emailHash,
                            purchase.franchiseeId,
                            users[0].address,
                            signature
                        )
                ).to.be.revertedWith("Unregistered email-address");
            });

            it("Pay mileage - Invalid address", async () => {
                const purchase = {
                    purchaseId: "P000008",
                    amount: 100,
                    userEmail: "a@example.com",
                    franchiseeId: "F000600",
                };

                const purchaseAmount = Amount.make(purchase.amount, 18).value;
                const emailHash = ContractUtils.sha256String(purchase.userEmail);
                const nonce = await ledgerContract.nonceOf(users[1].address);
                const signature = await ContractUtils.signPayment(
                    users[1],
                    purchase.purchaseId,
                    purchaseAmount,
                    emailHash,
                    purchase.franchiseeId,
                    nonce
                );
                await expect(
                    ledgerContract
                        .connect(relay)
                        .payMileage(
                            purchase.purchaseId,
                            purchaseAmount,
                            emailHash,
                            purchase.franchiseeId,
                            users[1].address,
                            signature
                        )
                ).to.be.revertedWith("Invalid address");
            });

            it("Pay mileage - Insufficient balance", async () => {
                const purchase = {
                    purchaseId: "P000008",
                    amount: 10000,
                    userEmail: "a@example.com",
                    franchiseeId: "F000600",
                };

                const purchaseAmount = Amount.make(purchase.amount, 18).value;
                const emailHash = ContractUtils.sha256String(purchase.userEmail);
                const nonce = await ledgerContract.nonceOf(users[0].address);
                const signature = await ContractUtils.signPayment(
                    users[0],
                    purchase.purchaseId,
                    purchaseAmount,
                    emailHash,
                    purchase.franchiseeId,
                    nonce
                );
                await expect(
                    ledgerContract
                        .connect(relay)
                        .payMileage(
                            purchase.purchaseId,
                            purchaseAmount,
                            emailHash,
                            purchase.franchiseeId,
                            users[0].address,
                            signature
                        )
                ).to.be.revertedWith("Insufficient balance");
            });

            it("Pay mileage - Success", async () => {
                const purchase = {
                    purchaseId: "P000008",
                    amount: 100,
                    userEmail: "a@example.com",
                    franchiseeId: "F000600",
                };

                const purchaseAmount = Amount.make(purchase.amount, 18).value;
                const emailHash = ContractUtils.sha256String(purchase.userEmail);
                const nonce = await ledgerContract.nonceOf(users[0].address);
                const signature = await ContractUtils.signPayment(
                    users[0],
                    purchase.purchaseId,
                    purchaseAmount,
                    emailHash,
                    purchase.franchiseeId,
                    nonce
                );
                await expect(
                    ledgerContract
                        .connect(relay)
                        .payMileage(
                            purchase.purchaseId,
                            purchaseAmount,
                            emailHash,
                            purchase.franchiseeId,
                            users[0].address,
                            signature
                        )
                )
                    .to.emit(ledgerContract, "PaidMileage")
                    .withNamedArgs({
                        email: emailHash,
                        paidAmountMileage: purchaseAmount,
                        value: purchaseAmount,
                        purchaseId: purchase.purchaseId,
                    });
            });
        });

        context("Pay token", () => {
            it("Pay token - Invalid signature", async () => {
                const purchase = {
                    purchaseId: "P000008",
                    amount: 100,
                    userEmail: "a@example.com",
                    franchiseeId: "F000600",
                };

                const purchaseAmount = Amount.make(purchase.amount, 18).value;
                const emailHash = ContractUtils.sha256String(purchase.userEmail);
                const nonce = await ledgerContract.nonceOf(users[0].address);
                const signature = await ContractUtils.signPayment(
                    users[0],
                    purchase.purchaseId,
                    purchaseAmount,
                    emailHash,
                    purchase.franchiseeId,
                    nonce
                );
                await expect(
                    ledgerContract
                        .connect(relay)
                        .payToken(
                            purchase.purchaseId,
                            purchaseAmount,
                            emailHash,
                            purchase.franchiseeId,
                            users[1].address,
                            signature
                        )
                ).to.be.revertedWith("Invalid signature");
            });

            it("Pay token - Unregistered email-address", async () => {
                const purchase = {
                    purchaseId: "P000008",
                    amount: 100,
                    userEmail: "b@example.com",
                    franchiseeId: "F000600",
                };

                const purchaseAmount = Amount.make(purchase.amount, 18).value;
                const emailHash = ContractUtils.sha256String(purchase.userEmail);
                const nonce = await ledgerContract.nonceOf(users[0].address);
                const signature = await ContractUtils.signPayment(
                    users[0],
                    purchase.purchaseId,
                    purchaseAmount,
                    emailHash,
                    purchase.franchiseeId,
                    nonce
                );
                await expect(
                    ledgerContract
                        .connect(relay)
                        .payToken(
                            purchase.purchaseId,
                            purchaseAmount,
                            emailHash,
                            purchase.franchiseeId,
                            users[0].address,
                            signature
                        )
                ).to.be.revertedWith("Unregistered email-address");
            });

            it("Pay token - Invalid address", async () => {
                const purchase = {
                    purchaseId: "P000008",
                    amount: 100,
                    userEmail: "a@example.com",
                    franchiseeId: "F000600",
                };

                const purchaseAmount = Amount.make(purchase.amount, 18).value;
                const emailHash = ContractUtils.sha256String(purchase.userEmail);
                const nonce = await ledgerContract.nonceOf(users[1].address);
                const signature = await ContractUtils.signPayment(
                    users[1],
                    purchase.purchaseId,
                    purchaseAmount,
                    emailHash,
                    purchase.franchiseeId,
                    nonce
                );
                await expect(
                    ledgerContract
                        .connect(relay)
                        .payToken(
                            purchase.purchaseId,
                            purchaseAmount,
                            emailHash,
                            purchase.franchiseeId,
                            users[1].address,
                            signature
                        )
                ).to.be.revertedWith("Invalid address");
            });

            it("Pay token - Insufficient balance", async () => {
                const purchase = {
                    purchaseId: "P000008",
                    amount: 10000,
                    userEmail: "a@example.com",
                    franchiseeId: "F000600",
                };

                const purchaseAmount = Amount.make(purchase.amount, 18).value;
                const emailHash = ContractUtils.sha256String(purchase.userEmail);
                const nonce = await ledgerContract.nonceOf(users[0].address);
                const signature = await ContractUtils.signPayment(
                    users[0],
                    purchase.purchaseId,
                    purchaseAmount,
                    emailHash,
                    purchase.franchiseeId,
                    nonce
                );
                await expect(
                    ledgerContract
                        .connect(relay)
                        .payToken(
                            purchase.purchaseId,
                            purchaseAmount,
                            emailHash,
                            purchase.franchiseeId,
                            users[0].address,
                            signature
                        )
                ).to.be.revertedWith("Insufficient balance");
            });

            it("Pay token - Success", async () => {
                const purchase = {
                    purchaseId: "P000008",
                    amount: 1,
                    userEmail: "a@example.com",
                    franchiseeId: "F000600",
                };

                const purchaseAmount = Amount.make(purchase.amount, 18).value;
                const tokenAmount = purchaseAmount.mul(multiple).div(price);
                const oldFoundationTokenBalance = await ledgerContract.tokenBalanceOf(foundationAccount);
                const emailHash = ContractUtils.sha256String(purchase.userEmail);
                const nonce = await ledgerContract.nonceOf(users[0].address);
                const signature = await ContractUtils.signPayment(
                    users[0],
                    purchase.purchaseId,
                    purchaseAmount,
                    emailHash,
                    purchase.franchiseeId,
                    nonce
                );
                await expect(
                    ledgerContract
                        .connect(relay)
                        .payToken(
                            purchase.purchaseId,
                            purchaseAmount,
                            emailHash,
                            purchase.franchiseeId,
                            users[0].address,
                            signature
                        )
                )
                    .to.emit(ledgerContract, "PaidToken")
                    .withNamedArgs({
                        email: emailHash,
                        paidAmountToken: tokenAmount,
                        value: purchaseAmount,
                        purchaseId: purchase.purchaseId,
                    });
                expect(await ledgerContract.tokenBalanceOf(foundationAccount)).to.deep.equal(
                    oldFoundationTokenBalance.add(tokenAmount)
                );
            });
        });
    });

    context("Deposit & Withdraw", () => {
        before("Deploy", async () => {
            await deployAllContract();
        });

        before("Prepare Token", async () => {
            for (const elem of users) {
                await tokenContract.connect(deployer).transfer(elem.address, amount.value);
            }
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
                requestId = ContractUtils.getRequestId(hash, users[0].address, nonce);
                await expect(
                    linkCollectionContract.connect(relay).addRequest(requestId, hash, users[0].address, signature)
                )
                    .to.emit(linkCollectionContract, "AddedRequestItem")
                    .withArgs(requestId, hash, users[0].address);
                await linkCollectionContract.connect(validator1).voteRequest(requestId, 1);
                await linkCollectionContract.connect(validator1).countVote(requestId);
            });
        });

        context("Prepare foundation's asset", () => {
            it("Register foundation's account", async () => {
                const nonce = await linkCollectionContract.nonceOf(foundation.address);
                const signature = await ContractUtils.sign(foundation, foundationAccount, nonce);
                requestId = ContractUtils.getRequestId(foundationAccount, foundation.address, nonce);
                await expect(
                    linkCollectionContract
                        .connect(relay)
                        .addRequest(requestId, foundationAccount, foundation.address, signature)
                )
                    .to.emit(linkCollectionContract, "AddedRequestItem")
                    .withArgs(requestId, foundationAccount, foundation.address);
                await linkCollectionContract.connect(validator1).voteRequest(requestId, 1);
                await linkCollectionContract.connect(validator1).countVote(requestId);
            });

            it("Deposit foundation's token", async () => {
                await tokenContract.connect(deployer).transfer(foundation.address, assetAmount.value);
                await tokenContract.connect(foundation).approve(ledgerContract.address, assetAmount.value);
                await expect(ledgerContract.connect(foundation).deposit(assetAmount.value))
                    .to.emit(ledgerContract, "Deposited")
                    .withNamedArgs({
                        email: foundationAccount,
                        depositAmount: assetAmount.value,
                        balanceToken: assetAmount.value,
                        account: foundation.address,
                    });
            });
        });

        context("Deposit token", () => {
            it("Deposit token - Unregistered email-address", async () => {
                await tokenContract.connect(users[1]).approve(ledgerContract.address, amount.value);
                await expect(ledgerContract.connect(users[1]).deposit(amount.value)).to.revertedWith(
                    "Unregistered email-address"
                );
            });

            it("Deposit token - Success", async () => {
                const oldTokenBalance = await ledgerContract.tokenBalanceOf(emailHashes[0]);
                await tokenContract.connect(users[0]).approve(ledgerContract.address, amount.value);
                await expect(ledgerContract.connect(users[0]).deposit(amount.value))
                    .to.emit(ledgerContract, "Deposited")
                    .withNamedArgs({
                        email: emailHashes[0],
                        depositAmount: amount.value,
                        balanceToken: oldTokenBalance.add(amount.value),
                        account: users[0].address,
                    });
                expect(await ledgerContract.tokenBalanceOf(emailHashes[0])).to.deep.equal(
                    oldTokenBalance.add(amount.value)
                );
            });
        });

        context("Withdraw token", () => {
            it("Withdraw token - Unregistered email-address", async () => {
                await expect(ledgerContract.connect(users[1]).withdraw(amount.value)).to.revertedWith(
                    "Unregistered email-address"
                );
            });

            it("Withdraw token - Insufficient balance", async () => {
                const oldTokenBalance = await ledgerContract.tokenBalanceOf(emailHashes[0]);
                await expect(ledgerContract.connect(users[0]).withdraw(oldTokenBalance.add(1))).to.revertedWith(
                    "Insufficient balance"
                );
            });

            it("Withdraw token - Success", async () => {
                const oldTokenBalance = await ledgerContract.tokenBalanceOf(emailHashes[0]);
                await expect(ledgerContract.connect(users[0]).withdraw(amount.value))
                    .to.emit(ledgerContract, "Withdrawn")
                    .withNamedArgs({
                        email: emailHashes[0],
                        withdrawAmount: amount.value,
                        balanceToken: oldTokenBalance.sub(amount.value),
                        account: users[0].address,
                    });
                expect(await ledgerContract.tokenBalanceOf(emailHashes[0])).to.deep.equal(
                    oldTokenBalance.sub(amount.value)
                );
            });
        });
    });

    context("Exchange token & mileage", () => {
        before("Deploy", async () => {
            await deployAllContract();
        });

        before("Prepare Token", async () => {
            for (const elem of users) {
                await tokenContract.connect(deployer).transfer(elem.address, amount.value);
            }
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
                requestId = ContractUtils.getRequestId(hash, users[0].address, nonce);
                await expect(
                    linkCollectionContract.connect(relay).addRequest(requestId, hash, users[0].address, signature)
                )
                    .to.emit(linkCollectionContract, "AddedRequestItem")
                    .withArgs(requestId, hash, users[0].address);
                await linkCollectionContract.connect(validator1).voteRequest(requestId, 1);
                await linkCollectionContract.connect(validator1).countVote(requestId);
            });
        });

        context("Exchange token to mileage", () => {
            const amountToken = BigNumber.from(amount.value);
            const amountMileage = amountToken.mul(price).div(multiple);

            before("Deposit token", async () => {
                await tokenContract.connect(users[0]).approve(ledgerContract.address, amountToken);
                await expect(ledgerContract.connect(users[0]).deposit(amountToken)).to.emit(
                    ledgerContract,
                    "Deposited"
                );
            });

            it("Invalid signature", async () => {
                const nonce = await ledgerContract.nonceOf(users[0].address);
                const signature = await ContractUtils.signExchange(users[0], emailHashes[0], amountToken, nonce);
                await expect(
                    ledgerContract
                        .connect(relay)
                        .exchangeTokenToMileage(emailHashes[0], amountToken, users[1].address, signature)
                ).to.revertedWith("Invalid signature");
            });

            it("Unregistered email-address", async () => {
                const nonce = await ledgerContract.nonceOf(users[1].address);
                const signature = await ContractUtils.signExchange(users[1], emailHashes[1], amountToken, nonce);
                await expect(
                    ledgerContract
                        .connect(relay)
                        .exchangeTokenToMileage(emailHashes[1], amountToken, users[1].address, signature)
                ).to.revertedWith("Unregistered email-address");
            });

            it("Invalid address", async () => {
                const nonce = await ledgerContract.nonceOf(users[1].address);
                const signature = await ContractUtils.signExchange(users[1], emailHashes[0], amountToken, nonce);
                await expect(
                    ledgerContract
                        .connect(relay)
                        .exchangeTokenToMileage(emailHashes[0], amountToken, users[1].address, signature)
                ).to.revertedWith("Invalid address");
            });

            it("Insufficient balance", async () => {
                const nonce = await ledgerContract.nonceOf(users[0].address);
                const signature = await ContractUtils.signExchange(
                    users[0],
                    emailHashes[0],
                    amountToken.mul(100),
                    nonce
                );
                await expect(
                    ledgerContract
                        .connect(relay)
                        .exchangeTokenToMileage(emailHashes[0], amountToken.mul(100), users[0].address, signature)
                ).to.revertedWith("Insufficient balance");
            });

            it("Success", async () => {
                const oldFoundationTokenBalance = await ledgerContract.tokenBalanceOf(foundationAccount);
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
                expect(await ledgerContract.tokenBalanceOf(foundationAccount)).to.deep.equal(
                    oldFoundationTokenBalance.add(amountToken)
                );
            });
        });

        context("Exchange mileage to token", () => {
            const amountToken = BigNumber.from(amount.value);
            const amountMileage = amountToken.mul(price).div(multiple);
            it("Invalid signature", async () => {
                const nonce = await ledgerContract.nonceOf(users[0].address);
                const signature = await ContractUtils.signExchange(users[0], emailHashes[0], amountMileage, nonce);
                await expect(
                    ledgerContract
                        .connect(relay)
                        .exchangeMileageToToken(emailHashes[0], amountMileage, users[1].address, signature)
                ).to.revertedWith("Invalid signature");
            });

            it("Unregistered email-address", async () => {
                const nonce = await ledgerContract.nonceOf(users[1].address);
                const signature = await ContractUtils.signExchange(users[1], emailHashes[1], amountMileage, nonce);
                await expect(
                    ledgerContract
                        .connect(relay)
                        .exchangeMileageToToken(emailHashes[1], amountMileage, users[1].address, signature)
                ).to.revertedWith("Unregistered email-address");
            });

            it("Invalid address", async () => {
                const nonce = await ledgerContract.nonceOf(users[1].address);
                const signature = await ContractUtils.signExchange(users[1], emailHashes[0], amountMileage, nonce);
                await expect(
                    ledgerContract
                        .connect(relay)
                        .exchangeMileageToToken(emailHashes[0], amountMileage, users[1].address, signature)
                ).to.revertedWith("Invalid address");
            });

            it("Insufficient balance", async () => {
                const nonce = await ledgerContract.nonceOf(users[0].address);
                const signature = await ContractUtils.signExchange(
                    users[0],
                    emailHashes[0],
                    amountMileage.mul(100),
                    nonce
                );
                await expect(
                    ledgerContract
                        .connect(relay)
                        .exchangeMileageToToken(emailHashes[0], amountMileage.mul(100), users[0].address, signature)
                ).to.revertedWith("Insufficient balance");
            });

            it("Success", async () => {
                const oldFoundationTokenBalance = await ledgerContract.tokenBalanceOf(foundationAccount);
                const nonce = await ledgerContract.nonceOf(users[0].address);
                const signature = await ContractUtils.signExchange(users[0], emailHashes[0], amountMileage, nonce);
                await expect(
                    ledgerContract
                        .connect(relay)
                        .exchangeMileageToToken(emailHashes[0], amountMileage, users[0].address, signature)
                )
                    .to.emit(ledgerContract, "ExchangedMileageToToken")
                    .withNamedArgs({
                        email: emailHashes[0],
                        amountMileage,
                        amountToken,
                    });
                expect(await ledgerContract.tokenBalanceOf(foundationAccount)).to.deep.equal(
                    oldFoundationTokenBalance.sub(amountToken)
                );
            });
        });
    });

    context("Clearing for franchisees", () => {
        const purchaseData: PurchaseData[] = [
            {
                purchaseId: "P000001",
                timestamp: 1672844400,
                amount: 10000,
                userEmail: "a@example.com",
                franchiseeId: "F000100",
                method: 0,
            },
            {
                purchaseId: "P000002",
                timestamp: 1675522800,
                amount: 10000,
                userEmail: "a@example.com",
                franchiseeId: "F000100",
                method: 0,
            },
            {
                purchaseId: "P000003",
                timestamp: 1677942000,
                amount: 10000,
                userEmail: "a@example.com",
                franchiseeId: "F000100",
                method: 0,
            },
            {
                purchaseId: "P000004",
                timestamp: 1680620400,
                amount: 10000,
                userEmail: "b@example.com",
                franchiseeId: "F000200",
                method: 0,
            },
            {
                purchaseId: "P000005",
                timestamp: 1683212400,
                amount: 10000,
                userEmail: "b@example.com",
                franchiseeId: "F000300",
                method: 0,
            },
            {
                purchaseId: "P000005",
                timestamp: 1683212400,
                amount: 10000,
                userEmail: "b@example.com",
                franchiseeId: "F000400",
                method: 0,
            },
        ];

        before("Deploy", async () => {
            await deployAllContract();
        });

        before("Prepare Token", async () => {
            for (const elem of users) {
                await tokenContract.connect(deployer).transfer(elem.address, amount.value);
            }
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

        context("Prepare foundation's asset", () => {
            it("Register foundation's account", async () => {
                const nonce = await linkCollectionContract.nonceOf(foundation.address);
                const signature = await ContractUtils.sign(foundation, foundationAccount, nonce);
                requestId = ContractUtils.getRequestId(foundationAccount, foundation.address, nonce);
                await expect(
                    linkCollectionContract
                        .connect(relay)
                        .addRequest(requestId, foundationAccount, foundation.address, signature)
                )
                    .to.emit(linkCollectionContract, "AddedRequestItem")
                    .withArgs(requestId, foundationAccount, foundation.address);
                await linkCollectionContract.connect(validator1).voteRequest(requestId, 1);
                await linkCollectionContract.connect(validator1).countVote(requestId);
            });

            it("Deposit foundation's token", async () => {
                await tokenContract.connect(deployer).transfer(foundation.address, assetAmount.value);
                await tokenContract.connect(foundation).approve(ledgerContract.address, assetAmount.value);
                await expect(ledgerContract.connect(foundation).deposit(assetAmount.value))
                    .to.emit(ledgerContract, "Deposited")
                    .withNamedArgs({
                        email: foundationAccount,
                        depositAmount: assetAmount.value,
                        balanceToken: assetAmount.value,
                        account: foundation.address,
                    });
            });
        });

        context("Save Purchase Data", () => {
            it("Save Purchase Data", async () => {
                for (const purchase of purchaseData) {
                    const emailHash = ContractUtils.sha256String(purchase.userEmail);
                    const purchaseAmount = Amount.make(purchase.amount, 18).value;
                    const amt = purchaseAmount.div(100);
                    await expect(
                        ledgerContract
                            .connect(validators[0])
                            .savePurchase(
                                purchase.purchaseId,
                                purchase.timestamp,
                                purchaseAmount,
                                emailHash,
                                purchase.franchiseeId,
                                purchase.method
                            )
                    )
                        .to.emit(ledgerContract, "SavedPurchase")
                        .withArgs(
                            purchase.purchaseId,
                            purchase.timestamp,
                            purchaseAmount,
                            emailHash,
                            purchase.franchiseeId,
                            purchase.method
                        )
                        .emit(ledgerContract, "ProvidedMileage")
                        .withNamedArgs({
                            email: emailHash,
                            providedAmountMileage: amt,
                            value: amt,
                            purchaseId: purchase.purchaseId,
                        });
                }
            });

            it("Check balances", async () => {
                const expected: Map<string, BigNumber> = new Map<string, BigNumber>();
                for (const purchase of purchaseData) {
                    const purchaseAmount = Amount.make(purchase.amount, 18).value;
                    const key = ContractUtils.sha256String(purchase.userEmail);
                    const oldValue = expected.get(key);
                    const mileage = purchaseAmount.div(100);
                    if (oldValue !== undefined) expected.set(key, oldValue.add(mileage));
                    else expected.set(key, mileage);
                }
                for (const key of expected.keys())
                    expect(await ledgerContract.mileageBalanceOf(key)).to.deep.equal(expected.get(key));
            });

            it("Check franchisee data", async () => {
                const franchisee1 = await franchiseeCollection.franchiseeOf("F000100");
                expect(franchisee1.providedMileage).to.equal(Amount.make(10000 * 3, 18).value.div(100));
                const franchisee2 = await franchiseeCollection.franchiseeOf("F000200");
                expect(franchisee2.providedMileage).to.equal(Amount.make(10000 * 1, 18).value.div(100));
                const franchisee3 = await franchiseeCollection.franchiseeOf("F000300");
                expect(franchisee3.providedMileage).to.equal(Amount.make(10000 * 1, 18).value.div(100));
                const franchisee4 = await franchiseeCollection.franchiseeOf("F000400");
                expect(franchisee4.providedMileage).to.equal(Amount.make(10000 * 1, 18).value.div(100));
            });
        });

        context("Prepare email-address", () => {
            it("Link email-address", async () => {
                const nonce = await linkCollectionContract.nonceOf(users[0].address);
                const hash = emailHashes[0];
                const signature = await ContractUtils.sign(users[0], hash, nonce);
                requestId = ContractUtils.getRequestId(hash, users[0].address, nonce);
                await expect(
                    linkCollectionContract.connect(relay).addRequest(requestId, hash, users[0].address, signature)
                )
                    .to.emit(linkCollectionContract, "AddedRequestItem")
                    .withArgs(requestId, hash, users[0].address);
                await linkCollectionContract.connect(validator1).voteRequest(requestId, 1);
                await linkCollectionContract.connect(validator1).countVote(requestId);
            });
        });

        context("Pay mileage", () => {
            it("Pay mileage - Success", async () => {
                const purchase = {
                    purchaseId: "P000008",
                    amount: 300,
                    userEmail: "a@example.com",
                    franchiseeId: "F000200",
                };

                const purchaseAmount = Amount.make(purchase.amount, 18).value;
                const emailHash = ContractUtils.sha256String(purchase.userEmail);
                const nonce = await ledgerContract.nonceOf(users[0].address);
                const signature = await ContractUtils.signPayment(
                    users[0],
                    purchase.purchaseId,
                    purchaseAmount,
                    emailHash,
                    purchase.franchiseeId,
                    nonce
                );
                await expect(
                    ledgerContract
                        .connect(relay)
                        .payMileage(
                            purchase.purchaseId,
                            purchaseAmount,
                            emailHash,
                            purchase.franchiseeId,
                            users[0].address,
                            signature
                        )
                )
                    .to.emit(ledgerContract, "ProvidedMileageToFranchisee")
                    .to.emit(ledgerContract, "PaidMileage")
                    .withNamedArgs({
                        email: emailHash,
                        paidAmountMileage: purchaseAmount,
                        value: purchaseAmount,
                        purchaseId: purchase.purchaseId,
                    });
                const franchisee2 = await franchiseeCollection.franchiseeOf("F000200");
                expect(franchisee2.providedMileage).to.equal(Amount.make(100, 18).value);
                expect(franchisee2.usedMileage).to.equal(Amount.make(300, 18).value);
                expect(franchisee2.clearedMileage).to.equal(Amount.make(200, 18).value);
            });
        });

        context("Deposit token", () => {
            it("Deposit token - Success", async () => {
                const oldTokenBalance = await ledgerContract.tokenBalanceOf(emailHashes[0]);
                await tokenContract.connect(users[0]).approve(ledgerContract.address, amount.value);
                await expect(ledgerContract.connect(users[0]).deposit(amount.value))
                    .to.emit(ledgerContract, "Deposited")
                    .withNamedArgs({
                        email: emailHashes[0],
                        depositAmount: amount.value,
                        balanceToken: oldTokenBalance.add(amount.value),
                        account: users[0].address,
                    });
                expect(await ledgerContract.tokenBalanceOf(emailHashes[0])).to.deep.equal(
                    oldTokenBalance.add(amount.value)
                );
            });
        });

        context("Pay token", () => {
            it("Pay token - Success", async () => {
                const purchase = {
                    purchaseId: "P000008",
                    amount: 500,
                    userEmail: "a@example.com",
                    franchiseeId: "F000300",
                };

                const purchaseAmount = Amount.make(purchase.amount, 18).value;
                const tokenAmount = purchaseAmount.mul(multiple).div(price);
                const oldFoundationTokenBalance = await ledgerContract.tokenBalanceOf(foundationAccount);
                const emailHash = ContractUtils.sha256String(purchase.userEmail);
                const nonce = await ledgerContract.nonceOf(users[0].address);
                const signature = await ContractUtils.signPayment(
                    users[0],
                    purchase.purchaseId,
                    purchaseAmount,
                    emailHash,
                    purchase.franchiseeId,
                    nonce
                );
                await expect(
                    ledgerContract
                        .connect(relay)
                        .payToken(
                            purchase.purchaseId,
                            purchaseAmount,
                            emailHash,
                            purchase.franchiseeId,
                            users[0].address,
                            signature
                        )
                )
                    .to.emit(ledgerContract, "ProvidedMileageToFranchisee")
                    .to.emit(ledgerContract, "PaidToken")
                    .withNamedArgs({
                        email: emailHash,
                        paidAmountToken: tokenAmount,
                        value: purchaseAmount,
                        purchaseId: purchase.purchaseId,
                    });
                expect(await ledgerContract.tokenBalanceOf(foundationAccount)).to.deep.equal(
                    oldFoundationTokenBalance.add(tokenAmount)
                );
                const franchisee3 = await franchiseeCollection.franchiseeOf("F000300");
                expect(franchisee3.providedMileage).to.equal(Amount.make(100, 18).value);
                expect(franchisee3.usedMileage).to.equal(Amount.make(500, 18).value);
                expect(franchisee3.clearedMileage).to.equal(Amount.make(400, 18).value);
            });
        });
    });
});
