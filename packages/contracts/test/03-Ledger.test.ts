import { Amount } from "../src/utils/Amount";
import { ContractUtils } from "../src/utils/ContractUtils";
import { CurrencyRate, Ledger, LinkCollection, ShopCollection, Token, ValidatorCollection } from "../typechain-types";

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
    shopId: string;
    method: number;
    currency: string;
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
    let currencyRateContract: CurrencyRate;
    let shopCollection: ShopCollection;

    const multiple = BigNumber.from(1000000000);
    const price = BigNumber.from(150).mul(multiple);

    const amount = Amount.make(20_000, 18);
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

    interface IShopData {
        shopId: string;
        provideWaitTime: number;
        providePercent: number;
        email: string;
    }

    let requestId: string;
    context("Save Purchase Data & Pay (point, token)", () => {
        const purchaseData: PurchaseData[] = [
            {
                purchaseId: "P000001",
                timestamp: 1672844400,
                amount: 10000,
                userEmail: "a@example.com",
                shopId: "F000100",
                method: 0,
                currency: "krw",
            },
            {
                purchaseId: "P000002",
                timestamp: 1675522800,
                amount: 10000,
                userEmail: "b@example.com",
                shopId: "F000100",
                method: 0,
                currency: "krw",
            },
            {
                purchaseId: "P000003",
                timestamp: 1677942000,
                amount: 10000,
                userEmail: "c@example.com",
                shopId: "F000200",
                method: 0,
                currency: "krw",
            },
            {
                purchaseId: "P000004",
                timestamp: 1680620400,
                amount: 10000,
                userEmail: "d@example.com",
                shopId: "F000300",
                method: 0,
                currency: "krw",
            },
            {
                purchaseId: "P000005",
                timestamp: 1683212400,
                amount: 10000,
                userEmail: "a@example.com",
                shopId: "F000200",
                method: 0,
                currency: "krw",
            },
        ];

        const shopData: IShopData[] = [
            {
                shopId: "F000100",
                provideWaitTime: 0,
                providePercent: 5,
                email: "f1@example.com",
            },
            {
                shopId: "F000200",
                provideWaitTime: 0,
                providePercent: 6,
                email: "f2@example.com",
            },
            {
                shopId: "F000300",
                provideWaitTime: 0,
                providePercent: 7,
                email: "f3@example.com",
            },
            {
                shopId: "F000400",
                provideWaitTime: 0,
                providePercent: 8,
                email: "f4@example.com",
            },
            {
                shopId: "F000500",
                provideWaitTime: 0,
                providePercent: 9,
                email: "f5@example.com",
            },
            {
                shopId: "F000600",
                provideWaitTime: 0,
                providePercent: 10,
                email: "f6@example.com",
            },
        ];

        before("Deploy", async () => {
            await deployAllContract();
        });

        context("Prepare shop data", () => {
            it("Add Shop Data", async () => {
                for (const elem of shopData) {
                    const email = ContractUtils.sha256String(elem.email);
                    await expect(
                        shopCollection
                            .connect(validator1)
                            .add(elem.shopId, elem.provideWaitTime, elem.providePercent, email)
                    )
                        .to.emit(shopCollection, "AddedShop")
                        .withArgs(elem.shopId, elem.provideWaitTime, elem.providePercent, email);
                }
                expect(await shopCollection.shopsLength()).to.equal(shopData.length);
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
                await linkCollectionContract.connect(validator1).voteRequest(requestId);
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
                                purchase.shopId,
                                purchase.method,
                                purchase.currency.toLowerCase()
                            )
                    ).to.be.revertedWith("Not validator");
                }
            });

            it("Save Purchase Data", async () => {
                for (const purchase of purchaseData) {
                    const emailHash = ContractUtils.sha256String(purchase.userEmail);
                    const purchaseAmount = Amount.make(purchase.amount, 18).value;
                    const shop = shopData.find((m) => m.shopId === purchase.shopId);
                    const amt =
                        shop !== undefined ? purchaseAmount.mul(shop.providePercent).div(100) : BigNumber.from(0);
                    await expect(
                        ledgerContract
                            .connect(validators[0])
                            .savePurchase(
                                purchase.purchaseId,
                                purchase.timestamp,
                                purchaseAmount,
                                emailHash,
                                purchase.shopId,
                                purchase.method,
                                purchase.currency.toLowerCase()
                            )
                    )
                        .to.emit(ledgerContract, "SavedPurchase")
                        .withArgs(
                            purchase.purchaseId,
                            purchase.timestamp,
                            purchaseAmount,
                            emailHash,
                            purchase.shopId,
                            purchase.method,
                            purchase.currency.toLowerCase()
                        )
                        .emit(ledgerContract, "ProvidedPoint")
                        .withNamedArgs({
                            email: emailHash,
                            providedAmountPoint: amt,
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

                    const shop = shopData.find((m) => m.shopId === purchase.shopId);
                    const point =
                        shop !== undefined ? purchaseAmount.mul(shop.providePercent).div(100) : BigNumber.from(0);

                    if (oldValue !== undefined) expected.set(key, oldValue.add(point));
                    else expected.set(key, point);
                }
                for (const key of expected.keys())
                    expect(await ledgerContract.pointBalanceOf(key)).to.deep.equal(expected.get(key));
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
                await linkCollectionContract.connect(validator1).voteRequest(requestId);
                await linkCollectionContract.connect(validator1).countVote(requestId);
            });

            it("Save Purchase Data - email and address are registered", async () => {
                const purchase = {
                    purchaseId: "P000006",
                    timestamp: 1672844400,
                    amount: 10000,
                    userEmail: "a@example.com",
                    shopId: "F000600",
                    method: 0,
                    currency: "krw",
                };
                const purchaseAmount = Amount.make(purchase.amount, 18).value;
                const shop = shopData.find((m) => m.shopId === purchase.shopId);
                const pointAmount =
                    shop !== undefined ? purchaseAmount.mul(shop.providePercent).div(100) : BigNumber.from(0);

                const tokenAmount = pointAmount.mul(multiple).div(price);
                const emailHash = ContractUtils.sha256String(purchase.userEmail);
                const oldPointBalance = await ledgerContract.pointBalanceOf(emailHash);
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
                            purchase.shopId,
                            purchase.method,
                            purchase.currency.toLowerCase()
                        )
                )
                    .to.emit(ledgerContract, "SavedPurchase")
                    .withArgs(
                        purchase.purchaseId,
                        purchase.timestamp,
                        purchaseAmount,
                        emailHash,
                        purchase.shopId,
                        purchase.method,
                        purchase.currency.toLowerCase()
                    )
                    .emit(ledgerContract, "ProvidedToken")
                    .withNamedArgs({
                        email: emailHash,
                        providedAmountToken: tokenAmount,
                        value: pointAmount,
                        purchaseId: purchase.purchaseId,
                    });
                expect(await ledgerContract.pointBalanceOf(emailHash)).to.deep.equal(oldPointBalance);
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
                    shopId: "F000600",
                    method: 0,
                    currency: "krw",
                };

                const purchaseAmount = Amount.make(purchase.amount, 18).value;
                const shop = shopData.find((m) => m.shopId === purchase.shopId);
                const pointAmount =
                    shop !== undefined ? purchaseAmount.mul(shop.providePercent).div(100) : BigNumber.from(0);
                const emailHash = ContractUtils.sha256String(purchase.userEmail);
                const oldPointBalance = await ledgerContract.pointBalanceOf(emailHash);
                const oldTokenBalance = await ledgerContract.tokenBalanceOf(emailHash);
                await expect(
                    ledgerContract
                        .connect(validators[0])
                        .savePurchase(
                            purchase.purchaseId,
                            purchase.timestamp,
                            purchaseAmount,
                            emailHash,
                            purchase.shopId,
                            purchase.method,
                            purchase.currency.toLowerCase()
                        )
                )
                    .to.emit(ledgerContract, "SavedPurchase")
                    .withArgs(
                        purchase.purchaseId,
                        purchase.timestamp,
                        purchaseAmount,
                        emailHash,
                        purchase.shopId,
                        purchase.method,
                        purchase.currency.toLowerCase()
                    )
                    .emit(ledgerContract, "ProvidedPoint")
                    .withNamedArgs({
                        email: emailHash,
                        providedAmountPoint: pointAmount,
                        value: pointAmount,
                        purchaseId: purchase.purchaseId,
                    });
                expect(await ledgerContract.pointBalanceOf(emailHash)).to.deep.equal(oldPointBalance.add(pointAmount));
                expect(await ledgerContract.tokenBalanceOf(emailHash)).to.deep.equal(oldTokenBalance);
            });
        });

        context("Pay point", () => {
            it("Pay point - Invalid signature", async () => {
                const purchase = {
                    purchaseId: "P000008",
                    amount: 100,
                    userEmail: "a@example.com",
                    shopId: "F000600",
                };

                const purchaseAmount = Amount.make(purchase.amount, 18).value;
                const emailHash = ContractUtils.sha256String(purchase.userEmail);
                const nonce = await ledgerContract.nonceOf(users[0].address);
                const signature = await ContractUtils.signPayment(
                    users[0],
                    purchase.purchaseId,
                    purchaseAmount,
                    emailHash,
                    purchase.shopId,
                    nonce
                );
                await expect(
                    ledgerContract
                        .connect(relay)
                        .payPoint(
                            purchase.purchaseId,
                            purchaseAmount,
                            emailHash,
                            purchase.shopId,
                            users[1].address,
                            signature
                        )
                ).to.be.revertedWith("Invalid signature");
            });

            it("Pay point - Unregistered email-address", async () => {
                const purchase = {
                    purchaseId: "P000008",
                    amount: 100,
                    userEmail: "b@example.com",
                    shopId: "F000600",
                };

                const purchaseAmount = Amount.make(purchase.amount, 18).value;
                const emailHash = ContractUtils.sha256String(purchase.userEmail);
                const nonce = await ledgerContract.nonceOf(users[0].address);
                const signature = await ContractUtils.signPayment(
                    users[0],
                    purchase.purchaseId,
                    purchaseAmount,
                    emailHash,
                    purchase.shopId,
                    nonce
                );
                await expect(
                    ledgerContract
                        .connect(relay)
                        .payPoint(
                            purchase.purchaseId,
                            purchaseAmount,
                            emailHash,
                            purchase.shopId,
                            users[0].address,
                            signature
                        )
                ).to.be.revertedWith("Unregistered email-address");
            });

            it("Pay point - Invalid address", async () => {
                const purchase = {
                    purchaseId: "P000008",
                    amount: 100,
                    userEmail: "a@example.com",
                    shopId: "F000600",
                };

                const purchaseAmount = Amount.make(purchase.amount, 18).value;
                const emailHash = ContractUtils.sha256String(purchase.userEmail);
                const nonce = await ledgerContract.nonceOf(users[1].address);
                const signature = await ContractUtils.signPayment(
                    users[1],
                    purchase.purchaseId,
                    purchaseAmount,
                    emailHash,
                    purchase.shopId,
                    nonce
                );
                await expect(
                    ledgerContract
                        .connect(relay)
                        .payPoint(
                            purchase.purchaseId,
                            purchaseAmount,
                            emailHash,
                            purchase.shopId,
                            users[1].address,
                            signature
                        )
                ).to.be.revertedWith("Invalid address");
            });

            it("Pay point - Insufficient balance", async () => {
                const purchase = {
                    purchaseId: "P000008",
                    amount: 10000,
                    userEmail: "a@example.com",
                    shopId: "F000600",
                };

                const purchaseAmount = Amount.make(purchase.amount, 18).value;
                const emailHash = ContractUtils.sha256String(purchase.userEmail);
                const nonce = await ledgerContract.nonceOf(users[0].address);
                const signature = await ContractUtils.signPayment(
                    users[0],
                    purchase.purchaseId,
                    purchaseAmount,
                    emailHash,
                    purchase.shopId,
                    nonce
                );
                await expect(
                    ledgerContract
                        .connect(relay)
                        .payPoint(
                            purchase.purchaseId,
                            purchaseAmount,
                            emailHash,
                            purchase.shopId,
                            users[0].address,
                            signature
                        )
                ).to.be.revertedWith("Insufficient balance");
            });

            it("Pay point - Success", async () => {
                const purchase = {
                    purchaseId: "P000008",
                    amount: 100,
                    userEmail: "a@example.com",
                    shopId: "F000600",
                };

                const purchaseAmount = Amount.make(purchase.amount, 18).value;
                const emailHash = ContractUtils.sha256String(purchase.userEmail);
                const nonce = await ledgerContract.nonceOf(users[0].address);
                const signature = await ContractUtils.signPayment(
                    users[0],
                    purchase.purchaseId,
                    purchaseAmount,
                    emailHash,
                    purchase.shopId,
                    nonce
                );
                await expect(
                    ledgerContract
                        .connect(relay)
                        .payPoint(
                            purchase.purchaseId,
                            purchaseAmount,
                            emailHash,
                            purchase.shopId,
                            users[0].address,
                            signature
                        )
                )
                    .to.emit(ledgerContract, "PaidPoint")
                    .withNamedArgs({
                        email: emailHash,
                        paidAmountPoint: purchaseAmount,
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
                    shopId: "F000600",
                };

                const purchaseAmount = Amount.make(purchase.amount, 18).value;
                const emailHash = ContractUtils.sha256String(purchase.userEmail);
                const nonce = await ledgerContract.nonceOf(users[0].address);
                const signature = await ContractUtils.signPayment(
                    users[0],
                    purchase.purchaseId,
                    purchaseAmount,
                    emailHash,
                    purchase.shopId,
                    nonce
                );
                await expect(
                    ledgerContract
                        .connect(relay)
                        .payToken(
                            purchase.purchaseId,
                            purchaseAmount,
                            emailHash,
                            purchase.shopId,
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
                    shopId: "F000600",
                };

                const purchaseAmount = Amount.make(purchase.amount, 18).value;
                const emailHash = ContractUtils.sha256String(purchase.userEmail);
                const nonce = await ledgerContract.nonceOf(users[0].address);
                const signature = await ContractUtils.signPayment(
                    users[0],
                    purchase.purchaseId,
                    purchaseAmount,
                    emailHash,
                    purchase.shopId,
                    nonce
                );
                await expect(
                    ledgerContract
                        .connect(relay)
                        .payToken(
                            purchase.purchaseId,
                            purchaseAmount,
                            emailHash,
                            purchase.shopId,
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
                    shopId: "F000600",
                };

                const purchaseAmount = Amount.make(purchase.amount, 18).value;
                const emailHash = ContractUtils.sha256String(purchase.userEmail);
                const nonce = await ledgerContract.nonceOf(users[1].address);
                const signature = await ContractUtils.signPayment(
                    users[1],
                    purchase.purchaseId,
                    purchaseAmount,
                    emailHash,
                    purchase.shopId,
                    nonce
                );
                await expect(
                    ledgerContract
                        .connect(relay)
                        .payToken(
                            purchase.purchaseId,
                            purchaseAmount,
                            emailHash,
                            purchase.shopId,
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
                    shopId: "F000600",
                };

                const purchaseAmount = Amount.make(purchase.amount, 18).value;
                const emailHash = ContractUtils.sha256String(purchase.userEmail);
                const nonce = await ledgerContract.nonceOf(users[0].address);
                const signature = await ContractUtils.signPayment(
                    users[0],
                    purchase.purchaseId,
                    purchaseAmount,
                    emailHash,
                    purchase.shopId,
                    nonce
                );
                await expect(
                    ledgerContract
                        .connect(relay)
                        .payToken(
                            purchase.purchaseId,
                            purchaseAmount,
                            emailHash,
                            purchase.shopId,
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
                    shopId: "F000600",
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
                    purchase.shopId,
                    nonce
                );
                await expect(
                    ledgerContract
                        .connect(relay)
                        .payToken(
                            purchase.purchaseId,
                            purchaseAmount,
                            emailHash,
                            purchase.shopId,
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
        const shopData: IShopData[] = [
            {
                shopId: "F000100",
                provideWaitTime: 0,
                providePercent: 5,
                email: "f1@example.com",
            },
            {
                shopId: "F000200",
                provideWaitTime: 0,
                providePercent: 6,
                email: "f2@example.com",
            },
            {
                shopId: "F000300",
                provideWaitTime: 0,
                providePercent: 7,
                email: "f3@example.com",
            },
            {
                shopId: "F000400",
                provideWaitTime: 0,
                providePercent: 8,
                email: "f4@example.com",
            },
            {
                shopId: "F000500",
                provideWaitTime: 0,
                providePercent: 9,
                email: "f5@example.com",
            },
            {
                shopId: "F000600",
                provideWaitTime: 0,
                providePercent: 10,
                email: "f6@example.com",
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

        context("Prepare shop data", () => {
            it("Add Shop Data", async () => {
                for (const elem of shopData) {
                    const email = ContractUtils.sha256String(elem.email);
                    await expect(
                        shopCollection
                            .connect(validator1)
                            .add(elem.shopId, elem.provideWaitTime, elem.providePercent, email)
                    )
                        .to.emit(shopCollection, "AddedShop")
                        .withArgs(elem.shopId, elem.provideWaitTime, elem.providePercent, email);
                }
                expect(await shopCollection.shopsLength()).to.equal(shopData.length);
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
                await linkCollectionContract.connect(validator1).voteRequest(requestId);
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
                await linkCollectionContract.connect(validator1).voteRequest(requestId);
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

    context("Clearing for shops", () => {
        const purchaseData: PurchaseData[] = [
            {
                purchaseId: "P000001",
                timestamp: 1672844400,
                amount: 10000,
                userEmail: "a@example.com",
                shopId: "F000100",
                method: 0,
                currency: "krw",
            },
            {
                purchaseId: "P000002",
                timestamp: 1675522800,
                amount: 10000,
                userEmail: "a@example.com",
                shopId: "F000100",
                method: 0,
                currency: "krw",
            },
            {
                purchaseId: "P000003",
                timestamp: 1677942000,
                amount: 10000,
                userEmail: "a@example.com",
                shopId: "F000100",
                method: 0,
                currency: "krw",
            },
            {
                purchaseId: "P000004",
                timestamp: 1680620400,
                amount: 10000,
                userEmail: "b@example.com",
                shopId: "F000200",
                method: 0,
                currency: "krw",
            },
            {
                purchaseId: "P000005",
                timestamp: 1683212400,
                amount: 10000,
                userEmail: "b@example.com",
                shopId: "F000300",
                method: 0,
                currency: "krw",
            },
            {
                purchaseId: "P000005",
                timestamp: 1683212400,
                amount: 10000,
                userEmail: "b@example.com",
                shopId: "F000400",
                method: 0,
                currency: "krw",
            },
        ];

        const shopData: IShopData[] = [
            {
                shopId: "F000100",
                provideWaitTime: 0,
                providePercent: 1,
                email: "f1@example.com",
            },
            {
                shopId: "F000200",
                provideWaitTime: 0,
                providePercent: 1,
                email: "f2@example.com",
            },
            {
                shopId: "F000300",
                provideWaitTime: 0,
                providePercent: 1,
                email: "f3@example.com",
            },
            {
                shopId: "F000400",
                provideWaitTime: 0,
                providePercent: 1,
                email: "f4@example.com",
            },
            {
                shopId: "F000500",
                provideWaitTime: 0,
                providePercent: 1,
                email: "f5@example.com",
            },
            {
                shopId: "F000600",
                provideWaitTime: 0,
                providePercent: 1,
                email: "f6@example.com",
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

        context("Prepare shop data", () => {
            it("Add Shop Data", async () => {
                for (const elem of shopData) {
                    const email = ContractUtils.sha256String(elem.email);
                    await expect(
                        shopCollection
                            .connect(validator1)
                            .add(elem.shopId, elem.provideWaitTime, elem.providePercent, email)
                    )
                        .to.emit(shopCollection, "AddedShop")
                        .withArgs(elem.shopId, elem.provideWaitTime, elem.providePercent, email);
                }
                expect(await shopCollection.shopsLength()).to.equal(shopData.length);
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
                await linkCollectionContract.connect(validator1).voteRequest(requestId);
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
                    const shop = shopData.find((m) => m.shopId === purchase.shopId);
                    const amt =
                        shop !== undefined ? purchaseAmount.mul(shop.providePercent).div(100) : BigNumber.from(0);
                    await expect(
                        ledgerContract
                            .connect(validators[0])
                            .savePurchase(
                                purchase.purchaseId,
                                purchase.timestamp,
                                purchaseAmount,
                                emailHash,
                                purchase.shopId,
                                purchase.method,
                                purchase.currency.toLowerCase()
                            )
                    )
                        .to.emit(ledgerContract, "SavedPurchase")
                        .withArgs(
                            purchase.purchaseId,
                            purchase.timestamp,
                            purchaseAmount,
                            emailHash,
                            purchase.shopId,
                            purchase.method,
                            purchase.currency.toLowerCase()
                        )
                        .emit(ledgerContract, "ProvidedPoint")
                        .withNamedArgs({
                            email: emailHash,
                            providedAmountPoint: amt,
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

                    const shop = shopData.find((m) => m.shopId === purchase.shopId);
                    const point =
                        shop !== undefined ? purchaseAmount.mul(shop.providePercent).div(100) : BigNumber.from(0);

                    if (oldValue !== undefined) expected.set(key, oldValue.add(point));
                    else expected.set(key, point);
                }
                for (const key of expected.keys())
                    expect(await ledgerContract.pointBalanceOf(key)).to.deep.equal(expected.get(key));
            });

            it("Check shop data", async () => {
                const shop1 = await shopCollection.shopOf(shopData[0].shopId);
                expect(shop1.providedPoint).to.equal(
                    Amount.make(10000 * 3, 18)
                        .value.mul(shopData[0].providePercent)
                        .div(100)
                );

                const shop2 = await shopCollection.shopOf(shopData[1].shopId);
                expect(shop2.providedPoint).to.equal(
                    Amount.make(10000 * 1, 18)
                        .value.mul(shopData[1].providePercent)
                        .div(100)
                );
                const shop3 = await shopCollection.shopOf(shopData[2].shopId);
                expect(shop3.providedPoint).to.equal(
                    Amount.make(10000 * 1, 18)
                        .value.mul(shopData[2].providePercent)
                        .div(100)
                );
                const shop4 = await shopCollection.shopOf(shopData[3].shopId);
                expect(shop4.providedPoint).to.equal(
                    Amount.make(10000 * 1, 18)
                        .value.mul(shopData[3].providePercent)
                        .div(100)
                );
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
                await linkCollectionContract.connect(validator1).voteRequest(requestId);
                await linkCollectionContract.connect(validator1).countVote(requestId);
            });
        });

        context("Pay point", () => {
            it("Pay point - Success", async () => {
                const purchase = {
                    purchaseId: "P000008",
                    amount: 300,
                    userEmail: "a@example.com",
                    shopId: "F000200",
                };

                const purchaseAmount = Amount.make(purchase.amount, 18).value;
                const emailHash = ContractUtils.sha256String(purchase.userEmail);
                const nonce = await ledgerContract.nonceOf(users[0].address);
                const signature = await ContractUtils.signPayment(
                    users[0],
                    purchase.purchaseId,
                    purchaseAmount,
                    emailHash,
                    purchase.shopId,
                    nonce
                );
                const shop = shopData.find((m) => m.shopId === purchase.shopId);
                const amt = shop !== undefined ? purchaseAmount.mul(shop.providePercent).div(100) : BigNumber.from(0);
                await expect(
                    ledgerContract
                        .connect(relay)
                        .payPoint(
                            purchase.purchaseId,
                            purchaseAmount,
                            emailHash,
                            purchase.shopId,
                            users[0].address,
                            signature
                        )
                )
                    .to.emit(ledgerContract, "ProvidedPointToShop")
                    .to.emit(ledgerContract, "PaidPoint")
                    .withNamedArgs({
                        email: emailHash,
                        paidAmountPoint: purchaseAmount,
                        value: purchaseAmount,
                        purchaseId: purchase.purchaseId,
                    });
                const shop2 = await shopCollection.shopOf("F000200");
                expect(shop2.providedPoint).to.equal(Amount.make(100, 18).value);
                expect(shop2.usedPoint).to.equal(Amount.make(300, 18).value);
                expect(shop2.clearedPoint).to.equal(Amount.make(200, 18).value);
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
                    shopId: "F000300",
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
                    purchase.shopId,
                    nonce
                );
                await expect(
                    ledgerContract
                        .connect(relay)
                        .payToken(
                            purchase.purchaseId,
                            purchaseAmount,
                            emailHash,
                            purchase.shopId,
                            users[0].address,
                            signature
                        )
                )
                    .to.emit(ledgerContract, "ProvidedPointToShop")
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
                const shop3 = await shopCollection.shopOf("F000300");
                expect(shop3.providedPoint).to.equal(Amount.make(100, 18).value);
                expect(shop3.usedPoint).to.equal(Amount.make(500, 18).value);
                expect(shop3.clearedPoint).to.equal(Amount.make(400, 18).value);
            });
        });
    });

    context("Multi Currency", () => {
        const purchaseData: PurchaseData[] = [
            {
                purchaseId: "P000001",
                timestamp: 1672844400,
                amount: 10000,
                userEmail: "a@example.com",
                shopId: "F000100",
                method: 0,
                currency: "KRW",
            },
            {
                purchaseId: "P000002",
                timestamp: 1675522800,
                amount: 10000,
                userEmail: "a@example.com",
                shopId: "F000100",
                method: 0,
                currency: "USD",
            },
            {
                purchaseId: "P000003",
                timestamp: 1677942000,
                amount: 10000,
                userEmail: "a@example.com",
                shopId: "F000100",
                method: 0,
                currency: "JPY",
            },
            {
                purchaseId: "P000004",
                timestamp: 1680620400,
                amount: 10000,
                userEmail: "b@example.com",
                shopId: "F000200",
                method: 0,
                currency: "CNY",
            },
            {
                purchaseId: "P000005",
                timestamp: 1683212400,
                amount: 10000,
                userEmail: "b@example.com",
                shopId: "F000300",
                method: 0,
                currency: "KRW",
            },
            {
                purchaseId: "P000005",
                timestamp: 1683212400,
                amount: 10000,
                userEmail: "b@example.com",
                shopId: "F000400",
                method: 0,
                currency: "KRW",
            },
        ];

        const shopData: IShopData[] = [
            {
                shopId: "F000100",
                provideWaitTime: 0,
                providePercent: 1,
                email: "f1@example.com",
            },
            {
                shopId: "F000200",
                provideWaitTime: 0,
                providePercent: 1,
                email: "f2@example.com",
            },
            {
                shopId: "F000300",
                provideWaitTime: 0,
                providePercent: 1,
                email: "f3@example.com",
            },
            {
                shopId: "F000400",
                provideWaitTime: 0,
                providePercent: 1,
                email: "f4@example.com",
            },
            {
                shopId: "F000500",
                provideWaitTime: 0,
                providePercent: 1,
                email: "f5@example.com",
            },
            {
                shopId: "F000600",
                provideWaitTime: 0,
                providePercent: 1,
                email: "f6@example.com",
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

        before("Set Other Currency", async () => {
            await currencyRateContract.connect(validators[0]).set("usd", BigNumber.from(3).mul(multiple));
            await currencyRateContract.connect(validators[0]).set("jpy", BigNumber.from(2).mul(multiple));
            await currencyRateContract.connect(validators[0]).set("cny", BigNumber.from(1).mul(multiple));
            await currencyRateContract.connect(validators[0]).set("krw", BigNumber.from(1).mul(multiple));
        });

        context("Prepare shop data", () => {
            it("Add Shop Data", async () => {
                for (const elem of shopData) {
                    const email = ContractUtils.sha256String(elem.email);
                    await expect(
                        shopCollection
                            .connect(validator1)
                            .add(elem.shopId, elem.provideWaitTime, elem.providePercent, email)
                    )
                        .to.emit(shopCollection, "AddedShop")
                        .withArgs(elem.shopId, elem.provideWaitTime, elem.providePercent, email);
                }
                expect(await shopCollection.shopsLength()).to.equal(shopData.length);
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
                await linkCollectionContract.connect(validator1).voteRequest(requestId);
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
                    const currency = purchase.currency.toLowerCase();
                    const rate = await currencyRateContract.get(currency);
                    const shop = shopData.find((m) => m.shopId === purchase.shopId);
                    const amt =
                        shop !== undefined
                            ? purchaseAmount.mul(rate).div(multiple).mul(shop.providePercent).div(100)
                            : BigNumber.from(0);
                    await expect(
                        ledgerContract
                            .connect(validators[0])
                            .savePurchase(
                                purchase.purchaseId,
                                purchase.timestamp,
                                purchaseAmount,
                                emailHash,
                                purchase.shopId,
                                purchase.method,
                                currency
                            )
                    )
                        .to.emit(ledgerContract, "SavedPurchase")
                        .withArgs(
                            purchase.purchaseId,
                            purchase.timestamp,
                            purchaseAmount,
                            emailHash,
                            purchase.shopId,
                            purchase.method,
                            currency
                        )
                        .emit(ledgerContract, "ProvidedPoint")
                        .withNamedArgs({
                            email: emailHash,
                            providedAmountPoint: amt,
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

                    const rate = await currencyRateContract.get(purchase.currency.toLowerCase());
                    const shop = shopData.find((m) => m.shopId === purchase.shopId);
                    const point =
                        shop !== undefined
                            ? purchaseAmount.mul(rate).div(multiple).mul(shop.providePercent).div(100)
                            : BigNumber.from(0);

                    if (oldValue !== undefined) expected.set(key, oldValue.add(point));
                    else expected.set(key, point);
                }
                for (const key of expected.keys())
                    expect(await ledgerContract.pointBalanceOf(key)).to.deep.equal(expected.get(key));
            });

            it("Check shop data", async () => {
                const shop1 = await shopCollection.shopOf(shopData[0].shopId);
                expect(shop1.providedPoint).to.equal(
                    Amount.make(10000 * 6, 18)
                        .value.mul(shopData[0].providePercent)
                        .div(100)
                );

                const shop2 = await shopCollection.shopOf(shopData[1].shopId);
                expect(shop2.providedPoint).to.equal(
                    Amount.make(10000 * 1, 18)
                        .value.mul(shopData[1].providePercent)
                        .div(100)
                );
                const shop3 = await shopCollection.shopOf(shopData[2].shopId);
                expect(shop3.providedPoint).to.equal(
                    Amount.make(10000 * 1, 18)
                        .value.mul(shopData[2].providePercent)
                        .div(100)
                );
                const shop4 = await shopCollection.shopOf(shopData[3].shopId);
                expect(shop4.providedPoint).to.equal(
                    Amount.make(10000 * 1, 18)
                        .value.mul(shopData[3].providePercent)
                        .div(100)
                );
            });
        });
    });
});
