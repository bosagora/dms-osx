import { Ledger, LinkCollection, Token, ValidatorCollection } from "../typechain-types";
import { Amount } from "./helper/Amount";
import { ContractUtils } from "./helper/ContractUtils";

import "@nomiclabs/hardhat-ethers";
import "@nomiclabs/hardhat-waffle";

import assert from "assert";
import chai, { expect } from "chai";
import { solidity } from "ethereum-waffle";

import * as hre from "hardhat";

chai.use(solidity);

interface PurchaseData {
    purchaseId: string;
    timestamp: number;
    amount: number;
    userEmail: string;
    franchiseeId: string;
}

const purchaseData: PurchaseData[] = [
    {
        purchaseId: "P000001",
        timestamp: 1672844400,
        amount: 10000,
        userEmail: "a@example.com",
        franchiseeId: "F000100",
    },
    {
        purchaseId: "P000002",
        timestamp: 1675522800,
        amount: 10000,
        userEmail: "b@example.com",
        franchiseeId: "F000100",
    },
    {
        purchaseId: "P000003",
        timestamp: 1677942000,
        amount: 10000,
        userEmail: "c@example.com",
        franchiseeId: "F000200",
    },
    {
        purchaseId: "P000004",
        timestamp: 1680620400,
        amount: 10000,
        userEmail: "d@example.com",
        franchiseeId: "F000300",
    },
    {
        purchaseId: "P000005",
        timestamp: 1683212400,
        amount: 10000,
        userEmail: "a@example.com",
        franchiseeId: "F000200",
    },
];

describe("Test for Ledger", () => {
    const provider = hre.waffle.provider;
    const [deployer, validator1, validator2, validator3, relay, user1, user2, user3] = provider.getWallets();

    const validators = [validator1, validator2, validator3];
    const users = [user1, user2, user3];
    const emails = ["a@example.com", "b@example.com", "c@example.com"];
    const emailHashes: string[] = [];
    let validatorContract: ValidatorCollection;
    let tokenContract: Token;
    let ledgerContract: Ledger;
    let linkCollectionContract: LinkCollection;

    const amount = Amount.make(50000, 18);

    before(async () => {
        const tokenFactory = await hre.ethers.getContractFactory("Token");
        tokenContract = (await tokenFactory.connect(deployer).deploy("Sample", "SAM")) as Token;
        await tokenContract.deployed();
        await tokenContract.deployTransaction.wait();
        for (const elem of validators) {
            await tokenContract.connect(deployer).transfer(elem.address, amount.value);
        }

        const validatorFactory = await hre.ethers.getContractFactory("ValidatorCollection");
        validatorContract = (await validatorFactory.connect(deployer).deploy(
            tokenContract.address,
            validators.map((m) => m.address)
        )) as ValidatorCollection;
        await validatorContract.deployed();
        await validatorContract.deployTransaction.wait();

        for (const elem of validators) {
            await tokenContract.connect(elem).approve(validatorContract.address, amount.value);
            await expect(validatorContract.connect(elem).deposit(amount.value))
                .to.emit(validatorContract, "Deposited")
                .withArgs(elem.address, amount.value, amount.value);
            let item = await validatorContract.validators(elem.address);
            assert.deepStrictEqual(item.validator, elem.address);
            assert.deepStrictEqual(item.status, 1);
            assert.deepStrictEqual(item.balance, amount.value);
        }
        await validatorContract.connect(validators[0]).makeActiveItems();

        const linkCollectionFactory = await hre.ethers.getContractFactory("LinkCollection");
        linkCollectionContract = (await linkCollectionFactory
            .connect(deployer)
            .deploy(validators.map((m) => m.address))) as LinkCollection;
        await linkCollectionContract.deployed();
        await linkCollectionContract.deployTransaction.wait();

        const ledgerFactory = await hre.ethers.getContractFactory("Ledger");
        ledgerContract = (await ledgerFactory
            .connect(deployer)
            .deploy(tokenContract.address, validatorContract.address, linkCollectionContract.address)) as Ledger;
        await ledgerContract.deployed();
        await ledgerContract.deployTransaction.wait();
    });

    before(async () => {
        for (const elem of users) {
            await tokenContract.connect(deployer).transfer(elem.address, amount.value);
        }
        for (const elem of emails) {
            emailHashes.push(ContractUtils.sha256String(elem));
        }
    });

    context("Save Purchase Data", () => {
        it("Save Purchase Data - Not validator", async () => {
            for (const purchase of purchaseData) {
                const hash = ContractUtils.sha256String(purchase.userEmail);
                await expect(
                    ledgerContract
                        .connect(deployer)
                        .savePurchase(
                            purchase.purchaseId,
                            purchase.timestamp,
                            purchase.amount,
                            hash,
                            purchase.franchiseeId
                        )
                ).to.be.revertedWith("Not validator");
            }
        });

        it("Save Purchase Data", async () => {
            for (const purchase of purchaseData) {
                const emailHash = ContractUtils.sha256String(purchase.userEmail);
                await expect(
                    ledgerContract
                        .connect(validators[0])
                        .savePurchase(
                            purchase.purchaseId,
                            purchase.timestamp,
                            purchase.amount,
                            emailHash,
                            purchase.franchiseeId
                        )
                )
                    .to.emit(ledgerContract, "SavedPurchase")
                    .withArgs(
                        purchase.purchaseId,
                        purchase.timestamp,
                        purchase.amount,
                        emailHash,
                        purchase.franchiseeId
                    )
                    .emit(ledgerContract, "ProvidedMileage")
                    .withArgs(emailHash, Math.floor(purchase.amount / 100));
            }
        });

        it("Check balances", async () => {
            const expected: Map<string, number> = new Map<string, number>();
            for (const purchase of purchaseData) {
                const key = ContractUtils.sha256String(purchase.userEmail);
                const oldValue = expected.get(key);
                const mileage = Math.floor(purchase.amount / 100);
                if (oldValue !== undefined) expected.set(key, oldValue + mileage);
                else expected.set(key, mileage);
            }
            for (let key of expected.keys())
                expect(await ledgerContract.mileageLedger(key)).to.deep.equal(expected.get(key));
        });

        it("Link email-address", async () => {
            const nonce = await linkCollectionContract.nonce(users[0].address);
            const hash = ContractUtils.sha256String(emails[0]);
            const signature = await ContractUtils.sign(users[0], hash, nonce);
            await expect(linkCollectionContract.connect(validators[0]).add(hash, users[0].address, signature))
                .to.emit(linkCollectionContract, "Added")
                .withArgs(hash, users[0].address);
        });

        it("Save Purchase Data - email and address are registered", async () => {
            const purchase = {
                purchaseId: "P000006",
                timestamp: 1672844400,
                amount: 10000,
                userEmail: "a@example.com",
                franchiseeId: "F000600",
            };
            const amt = Math.floor(purchase.amount / 100);
            const emailHash = ContractUtils.sha256String(purchase.userEmail);
            const oldMileageBalance = await ledgerContract.mileageLedger(emailHash);
            const oldTokenBalance = await ledgerContract.tokenLedger(emailHash);
            await expect(
                ledgerContract
                    .connect(validators[0])
                    .savePurchase(
                        purchase.purchaseId,
                        purchase.timestamp,
                        purchase.amount,
                        emailHash,
                        purchase.franchiseeId
                    )
            )
                .to.emit(ledgerContract, "SavedPurchase")
                .withArgs(purchase.purchaseId, purchase.timestamp, purchase.amount, emailHash, purchase.franchiseeId)
                .emit(ledgerContract, "ProvidedToken")
                .withNamedArgs({
                    email: emailHash,
                    amount: amt,
                });
            expect(await ledgerContract.mileageLedger(emailHash)).to.deep.equal(oldMileageBalance);
            expect(await ledgerContract.tokenLedger(emailHash)).to.deep.equal(oldTokenBalance.add(amt));
        });

        it("Save Purchase Data - email and address are not registered", async () => {
            const purchase = {
                purchaseId: "P000007",
                timestamp: 1672844400,
                amount: 10000,
                userEmail: "b@example.com",
                franchiseeId: "F000600",
            };

            const amt = Math.floor(purchase.amount / 100);
            const emailHash = ContractUtils.sha256String(purchase.userEmail);
            const oldMileageBalance = await ledgerContract.mileageLedger(emailHash);
            const oldTokenBalance = await ledgerContract.tokenLedger(emailHash);
            await expect(
                ledgerContract
                    .connect(validators[0])
                    .savePurchase(
                        purchase.purchaseId,
                        purchase.timestamp,
                        purchase.amount,
                        emailHash,
                        purchase.franchiseeId
                    )
            )
                .to.emit(ledgerContract, "SavedPurchase")
                .withArgs(purchase.purchaseId, purchase.timestamp, purchase.amount, emailHash, purchase.franchiseeId)
                .emit(ledgerContract, "ProvidedMileage")
                .withArgs(emailHash, amt);
            expect(await ledgerContract.mileageLedger(emailHash)).to.deep.equal(oldMileageBalance.add(amt));
            expect(await ledgerContract.tokenLedger(emailHash)).to.deep.equal(oldTokenBalance);
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

            const emailHash = ContractUtils.sha256String(purchase.userEmail);
            const nonce = await ledgerContract.nonce(users[0].address);
            const signature = await ContractUtils.signPayment(
                users[0],
                purchase.purchaseId,
                purchase.amount,
                emailHash,
                purchase.franchiseeId,
                nonce
            );
            await expect(
                ledgerContract
                    .connect(relay)
                    .payMileage(
                        purchase.purchaseId,
                        purchase.amount,
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

            const emailHash = ContractUtils.sha256String(purchase.userEmail);
            const nonce = await ledgerContract.nonce(users[0].address);
            const signature = await ContractUtils.signPayment(
                users[0],
                purchase.purchaseId,
                purchase.amount,
                emailHash,
                purchase.franchiseeId,
                nonce
            );
            await expect(
                ledgerContract
                    .connect(relay)
                    .payMileage(
                        purchase.purchaseId,
                        purchase.amount,
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

            const emailHash = ContractUtils.sha256String(purchase.userEmail);
            const nonce = await ledgerContract.nonce(users[1].address);
            const signature = await ContractUtils.signPayment(
                users[1],
                purchase.purchaseId,
                purchase.amount,
                emailHash,
                purchase.franchiseeId,
                nonce
            );
            await expect(
                ledgerContract
                    .connect(relay)
                    .payMileage(
                        purchase.purchaseId,
                        purchase.amount,
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

            const emailHash = ContractUtils.sha256String(purchase.userEmail);
            const nonce = await ledgerContract.nonce(users[0].address);
            const signature = await ContractUtils.signPayment(
                users[0],
                purchase.purchaseId,
                purchase.amount,
                emailHash,
                purchase.franchiseeId,
                nonce
            );
            await expect(
                ledgerContract
                    .connect(relay)
                    .payMileage(
                        purchase.purchaseId,
                        purchase.amount,
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

            const emailHash = ContractUtils.sha256String(purchase.userEmail);
            const nonce = await ledgerContract.nonce(users[0].address);
            const signature = await ContractUtils.signPayment(
                users[0],
                purchase.purchaseId,
                purchase.amount,
                emailHash,
                purchase.franchiseeId,
                nonce
            );
            await expect(
                ledgerContract
                    .connect(relay)
                    .payMileage(
                        purchase.purchaseId,
                        purchase.amount,
                        emailHash,
                        purchase.franchiseeId,
                        users[0].address,
                        signature
                    )
            )
                .to.emit(ledgerContract, "PaidMileage")
                .withNamedArgs({
                    purchaseId: purchase.purchaseId,
                    amount: purchase.amount,
                    userEmail: emailHash,
                    franchiseeId: purchase.franchiseeId,
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

            const emailHash = ContractUtils.sha256String(purchase.userEmail);
            const nonce = await ledgerContract.nonce(users[0].address);
            const signature = await ContractUtils.signPayment(
                users[0],
                purchase.purchaseId,
                purchase.amount,
                emailHash,
                purchase.franchiseeId,
                nonce
            );
            await expect(
                ledgerContract
                    .connect(relay)
                    .payToken(
                        purchase.purchaseId,
                        purchase.amount,
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

            const emailHash = ContractUtils.sha256String(purchase.userEmail);
            const nonce = await ledgerContract.nonce(users[0].address);
            const signature = await ContractUtils.signPayment(
                users[0],
                purchase.purchaseId,
                purchase.amount,
                emailHash,
                purchase.franchiseeId,
                nonce
            );
            await expect(
                ledgerContract
                    .connect(relay)
                    .payToken(
                        purchase.purchaseId,
                        purchase.amount,
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

            const emailHash = ContractUtils.sha256String(purchase.userEmail);
            const nonce = await ledgerContract.nonce(users[1].address);
            const signature = await ContractUtils.signPayment(
                users[1],
                purchase.purchaseId,
                purchase.amount,
                emailHash,
                purchase.franchiseeId,
                nonce
            );
            await expect(
                ledgerContract
                    .connect(relay)
                    .payToken(
                        purchase.purchaseId,
                        purchase.amount,
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

            const emailHash = ContractUtils.sha256String(purchase.userEmail);
            const nonce = await ledgerContract.nonce(users[0].address);
            const signature = await ContractUtils.signPayment(
                users[0],
                purchase.purchaseId,
                purchase.amount,
                emailHash,
                purchase.franchiseeId,
                nonce
            );
            await expect(
                ledgerContract
                    .connect(relay)
                    .payToken(
                        purchase.purchaseId,
                        purchase.amount,
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

            const emailHash = ContractUtils.sha256String(purchase.userEmail);
            const nonce = await ledgerContract.nonce(users[0].address);
            const signature = await ContractUtils.signPayment(
                users[0],
                purchase.purchaseId,
                purchase.amount,
                emailHash,
                purchase.franchiseeId,
                nonce
            );
            await expect(
                ledgerContract
                    .connect(relay)
                    .payToken(
                        purchase.purchaseId,
                        purchase.amount,
                        emailHash,
                        purchase.franchiseeId,
                        users[0].address,
                        signature
                    )
            )
                .to.emit(ledgerContract, "PaidToken")
                .withNamedArgs({
                    purchaseId: purchase.purchaseId,
                    amount: purchase.amount,
                    userEmail: emailHash,
                    franchiseeId: purchase.franchiseeId,
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
            const oldTokenBalance = await ledgerContract.tokenLedger(emailHashes[0]);
            await tokenContract.connect(users[0]).approve(ledgerContract.address, amount.value);
            await expect(ledgerContract.connect(users[0]).deposit(amount.value))
                .to.emit(ledgerContract, "Deposited")
                .withNamedArgs({
                    depositor: users[0].address,
                    amount: amount.value,
                    balance: oldTokenBalance.add(amount.value),
                });
            expect(await ledgerContract.tokenLedger(emailHashes[0])).to.deep.equal(oldTokenBalance.add(amount.value));
        });
    });

    context("Withdraw token", () => {
        it("Withdraw token - Unregistered email-address", async () => {
            await expect(ledgerContract.connect(users[1]).withdraw(amount.value)).to.revertedWith(
                "Unregistered email-address"
            );
        });

        it("Withdraw token - Insufficient balance", async () => {
            const oldTokenBalance = await ledgerContract.tokenLedger(emailHashes[0]);
            await expect(ledgerContract.connect(users[0]).withdraw(oldTokenBalance.add(1))).to.revertedWith(
                "Insufficient balance"
            );
        });

        it("Withdraw token - Success", async () => {
            const oldTokenBalance = await ledgerContract.tokenLedger(emailHashes[0]);
            await expect(ledgerContract.connect(users[0]).withdraw(amount.value))
                .to.emit(ledgerContract, "Withdrawn")
                .withNamedArgs({
                    withdrawer: users[0].address,
                    amount: amount.value,
                    balance: oldTokenBalance.sub(amount.value),
                });
            expect(await ledgerContract.tokenLedger(emailHashes[0])).to.deep.equal(oldTokenBalance.sub(amount.value));
        });
    });

    context("Exchange token to mileage", () => {
        before("Deposit token", async () => {
            await tokenContract.connect(users[0]).approve(ledgerContract.address, amount.value);
            await expect(ledgerContract.connect(users[0]).deposit(amount.value)).to.emit(ledgerContract, "Deposited");
        });

        it("Invalid signature", async () => {
            const nonce = await ledgerContract.nonce(users[0].address);
            const signature = await ContractUtils.signExchange(users[0], emailHashes[0], amount.value, nonce);
            await expect(
                ledgerContract
                    .connect(relay)
                    .exchangeTokenToMileage(emailHashes[0], amount.value, users[1].address, signature)
            ).to.revertedWith("Invalid signature");
        });

        it("Unregistered email-address", async () => {
            const nonce = await ledgerContract.nonce(users[1].address);
            const signature = await ContractUtils.signExchange(users[1], emailHashes[1], amount.value, nonce);
            await expect(
                ledgerContract
                    .connect(relay)
                    .exchangeTokenToMileage(emailHashes[1], amount.value, users[1].address, signature)
            ).to.revertedWith("Unregistered email-address");
        });

        it("Invalid address", async () => {
            const nonce = await ledgerContract.nonce(users[1].address);
            const signature = await ContractUtils.signExchange(users[1], emailHashes[0], amount.value, nonce);
            await expect(
                ledgerContract
                    .connect(relay)
                    .exchangeTokenToMileage(emailHashes[0], amount.value, users[1].address, signature)
            ).to.revertedWith("Invalid address");
        });

        it("Insufficient balance", async () => {
            const nonce = await ledgerContract.nonce(users[0].address);
            const signature = await ContractUtils.signExchange(users[0], emailHashes[0], amount.value.mul(100), nonce);
            await expect(
                ledgerContract
                    .connect(relay)
                    .exchangeTokenToMileage(emailHashes[0], amount.value.mul(100), users[0].address, signature)
            ).to.revertedWith("Insufficient balance");
        });

        it("Success", async () => {
            const nonce = await ledgerContract.nonce(users[0].address);
            const signature = await ContractUtils.signExchange(users[0], emailHashes[0], amount.value, nonce);
            await expect(
                ledgerContract
                    .connect(relay)
                    .exchangeTokenToMileage(emailHashes[0], amount.value, users[0].address, signature)
            )
                .to.emit(ledgerContract, "ExchangedTokenToMileage")
                .withNamedArgs({
                    email: emailHashes[0],
                    amountToken: amount.value,
                    amountMileage: amount.value,
                });
        });
    });

    context("Exchange mileage to token", () => {
        it("Invalid signature", async () => {
            const nonce = await ledgerContract.nonce(users[0].address);
            const signature = await ContractUtils.signExchange(users[0], emailHashes[0], amount.value, nonce);
            await expect(
                ledgerContract
                    .connect(relay)
                    .exchangeMileageToToken(emailHashes[0], amount.value, users[1].address, signature)
            ).to.revertedWith("Invalid signature");
        });

        it("Unregistered email-address", async () => {
            const nonce = await ledgerContract.nonce(users[1].address);
            const signature = await ContractUtils.signExchange(users[1], emailHashes[1], amount.value, nonce);
            await expect(
                ledgerContract
                    .connect(relay)
                    .exchangeMileageToToken(emailHashes[1], amount.value, users[1].address, signature)
            ).to.revertedWith("Unregistered email-address");
        });

        it("Invalid address", async () => {
            const nonce = await ledgerContract.nonce(users[1].address);
            const signature = await ContractUtils.signExchange(users[1], emailHashes[0], amount.value, nonce);
            await expect(
                ledgerContract
                    .connect(relay)
                    .exchangeMileageToToken(emailHashes[0], amount.value, users[1].address, signature)
            ).to.revertedWith("Invalid address");
        });

        it("Insufficient balance", async () => {
            const nonce = await ledgerContract.nonce(users[0].address);
            const signature = await ContractUtils.signExchange(users[0], emailHashes[0], amount.value.mul(100), nonce);
            await expect(
                ledgerContract
                    .connect(relay)
                    .exchangeMileageToToken(emailHashes[0], amount.value.mul(100), users[0].address, signature)
            ).to.revertedWith("Insufficient balance");
        });

        it("Success", async () => {
            const nonce = await ledgerContract.nonce(users[0].address);
            const signature = await ContractUtils.signExchange(users[0], emailHashes[0], amount.value, nonce);
            await expect(
                ledgerContract
                    .connect(relay)
                    .exchangeMileageToToken(emailHashes[0], amount.value, users[0].address, signature)
            )
                .to.emit(ledgerContract, "ExchangedMileageToToken")
                .withNamedArgs({
                    email: emailHashes[0],
                    amountMileage: amount.value,
                    amountToken: amount.value,
                });
        });
    });
});
