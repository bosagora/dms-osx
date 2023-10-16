import { Amount } from "../src/utils/Amount";
import { ContractUtils } from "../src/utils/ContractUtils";
import {
    CurrencyRate,
    Ledger,
    PhoneLinkCollection,
    ShopCollection,
    Token,
    ValidatorCollection,
} from "../typechain-types";

import "@nomiclabs/hardhat-ethers";
import "@nomiclabs/hardhat-waffle";

import assert from "assert";
import chai, { expect } from "chai";
import { solidity } from "ethereum-waffle";

import { BigNumber, Wallet } from "ethers";
import * as hre from "hardhat";

import { AddressZero } from "@ethersproject/constants";

chai.use(solidity);

interface IPurchaseData {
    purchaseId: string;
    timestamp: number;
    amount: number;
    method: number;
    currency: string;
    userIndex: number;
    shopIndex: number;
}

interface IShopData {
    shopId: string;
    name: string;
    provideWaitTime: number;
    providePercent: number;
    wallet: Wallet;
}

interface IUserData {
    phone: string;
    address: string;
    privateKey: string;
}

describe("Test for Ledger", () => {
    const provider = hre.waffle.provider;
    const [
        deployer,
        foundation,
        settlements,
        fee,
        validator1,
        validator2,
        validator3,
        relay,
        user1,
        user2,
        user3,
        user4,
        user5,
        shop1,
        shop2,
        shop3,
        shop4,
        shop5,
        shop6,
    ] = provider.getWallets();

    const validatorWallets = [validator1, validator2, validator3];
    const linkValidators = [validator1];
    const userWallets = [user1, user2, user3, user4, user5];
    const shopWallets = [shop1, shop2, shop3, shop4, shop5, shop6];
    const phoneHashes: string[] = [
        ContractUtils.getPhoneHash("08201012341001"),
        ContractUtils.getPhoneHash("08201012341002"),
        ContractUtils.getPhoneHash("08201012341003"),
        ContractUtils.getPhoneHash("08201012341004"),
        ContractUtils.getPhoneHash("08201012341005"),
    ];
    let validatorContract: ValidatorCollection;
    let tokenContract: Token;
    let ledgerContract: Ledger;
    let linkCollectionContract: PhoneLinkCollection;
    let currencyRateContract: CurrencyRate;
    let shopCollection: ShopCollection;

    const multiple = BigNumber.from(1000000000);
    const price = BigNumber.from(150).mul(multiple);

    const amount = Amount.make(20_000, 18);
    const assetAmount = Amount.make(10_000_000, 18);

    const deployToken = async () => {
        const tokenFactory = await hre.ethers.getContractFactory("Token");
        tokenContract = (await tokenFactory.connect(deployer).deploy(deployer.address, "Sample", "SAM")) as Token;
        await tokenContract.deployed();
        await tokenContract.deployTransaction.wait();
        for (const elem of validatorWallets) {
            await tokenContract.connect(deployer).transfer(elem.address, amount.value);
        }
    };

    const deployValidatorCollection = async () => {
        const validatorFactory = await hre.ethers.getContractFactory("ValidatorCollection");
        validatorContract = (await validatorFactory.connect(deployer).deploy(
            tokenContract.address,
            validatorWallets.map((m) => m.address)
        )) as ValidatorCollection;
        await validatorContract.deployed();
        await validatorContract.deployTransaction.wait();
    };

    const depositValidators = async () => {
        for (const elem of validatorWallets) {
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
        const linkCollectionFactory = await hre.ethers.getContractFactory("PhoneLinkCollection");
        linkCollectionContract = (await linkCollectionFactory
            .connect(deployer)
            .deploy(linkValidators.map((m) => m.address))) as PhoneLinkCollection;
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
        await currencyRateContract.connect(validatorWallets[0]).set(await tokenContract.symbol(), price);
    };

    const deployShopCollection = async () => {
        const shopCollectionFactory = await hre.ethers.getContractFactory("ShopCollection");
        shopCollection = (await shopCollectionFactory.connect(deployer).deploy()) as ShopCollection;
        await shopCollection.deployed();
        await shopCollection.deployTransaction.wait();
    };

    const deployLedger = async () => {
        const ledgerFactory = await hre.ethers.getContractFactory("Ledger");
        ledgerContract = (await ledgerFactory
            .connect(deployer)
            .deploy(
                foundation.address,
                settlements.address,
                fee.address,
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

    let requestId: string;
    context("Save Purchase Data & Pay (point, token)", () => {
        const userData: IUserData[] = [
            {
                phone: "08201012341001",
                address: userWallets[0].address,
                privateKey: userWallets[0].privateKey,
            },
            {
                phone: "08201012341002",
                address: userWallets[1].address,
                privateKey: userWallets[1].privateKey,
            },
            {
                phone: "08201012341003",
                address: userWallets[2].address,
                privateKey: userWallets[2].privateKey,
            },
            {
                phone: "08201012341004",
                address: "",
                privateKey: "",
            },
            {
                phone: "08201012341005",
                address: "",
                privateKey: "",
            },
        ];

        const purchaseData: IPurchaseData[] = [
            {
                purchaseId: "P000001",
                timestamp: 1672844400,
                amount: 10000,
                method: 0,
                currency: "krw",
                shopIndex: 0,
                userIndex: 0,
            },
            {
                purchaseId: "P000002",
                timestamp: 1675522800,
                amount: 10000,
                method: 0,
                currency: "krw",
                shopIndex: 0,
                userIndex: 1,
            },
            {
                purchaseId: "P000003",
                timestamp: 1677942000,
                amount: 10000,
                method: 0,
                currency: "krw",
                shopIndex: 1,
                userIndex: 2,
            },
            {
                purchaseId: "P000004",
                timestamp: 1680620400,
                amount: 10000,
                method: 0,
                currency: "krw",
                shopIndex: 2,
                userIndex: 3,
            },
            {
                purchaseId: "P000005",
                timestamp: 1683212400,
                amount: 10000,
                method: 0,
                currency: "krw",
                shopIndex: 1,
                userIndex: 4,
            },
        ];

        const shopData: IShopData[] = [
            {
                shopId: "",
                name: "Shop1",
                provideWaitTime: 0,
                providePercent: 5,
                wallet: shopWallets[0],
            },
            {
                shopId: "",
                name: "Shop2",
                provideWaitTime: 0,
                providePercent: 6,
                wallet: shopWallets[1],
            },
            {
                shopId: "",
                name: "Shop3",
                provideWaitTime: 0,
                providePercent: 7,
                wallet: shopWallets[2],
            },
            {
                shopId: "",
                name: "Shop4",
                provideWaitTime: 0,
                providePercent: 8,
                wallet: shopWallets[3],
            },
            {
                shopId: "",
                name: "Shop5",
                provideWaitTime: 0,
                providePercent: 9,
                wallet: shopWallets[4],
            },
            {
                shopId: "",
                name: "Shop6",
                provideWaitTime: 0,
                providePercent: 10,
                wallet: shopWallets[5],
            },
        ];

        before("Set Shop ID", async () => {
            for (const elem of shopData) {
                elem.shopId = ContractUtils.getShopId(elem.name, elem.wallet.address);
            }
        });

        before("Deploy", async () => {
            await deployAllContract();
        });

        context("Prepare shop data", () => {
            it("Add Shop Data", async () => {
                for (const elem of shopData) {
                    await expect(
                        shopCollection
                            .connect(elem.wallet)
                            .add(elem.shopId, elem.name, elem.provideWaitTime, elem.providePercent)
                    )
                        .to.emit(shopCollection, "AddedShop")
                        .withNamedArgs({
                            shopId: elem.shopId,
                            name: elem.name,
                            provideWaitTime: elem.provideWaitTime,
                            providePercent: elem.providePercent,
                            account: elem.wallet.address,
                        });
                }
                expect(await shopCollection.shopsLength()).to.equal(shopData.length);
            });
        });

        context("Prepare foundation's asset", () => {
            it("Deposit foundation's token", async () => {
                await tokenContract.connect(deployer).transfer(foundation.address, assetAmount.value);
                await tokenContract.connect(foundation).approve(ledgerContract.address, assetAmount.value);
                await expect(ledgerContract.connect(foundation).deposit(assetAmount.value))
                    .to.emit(ledgerContract, "Deposited")
                    .withNamedArgs({
                        account: foundation.address,
                        depositedToken: assetAmount.value,
                        balanceToken: assetAmount.value,
                    });
            });
        });

        context("Save Purchase Data", () => {
            it("Save Purchase Data - Not validator", async () => {
                for (const purchase of purchaseData) {
                    const phoneHash = ContractUtils.getPhoneHash(userData[purchase.userIndex].phone);
                    const purchaseAmount = Amount.make(purchase.amount, 18).value;
                    const userAccount =
                        userData[purchase.userIndex].address.trim() !== ""
                            ? userData[purchase.userIndex].address.trim()
                            : AddressZero;
                    await expect(
                        ledgerContract.connect(deployer).savePurchase({
                            purchaseId: purchase.purchaseId,
                            timestamp: purchase.timestamp,
                            amount: purchaseAmount,
                            currency: purchase.currency.toLowerCase(),
                            shopId: shopData[purchase.shopIndex].shopId,
                            method: purchase.method,
                            account: userAccount,
                            phone: phoneHash,
                        })
                    ).to.be.revertedWith("Not validator");
                }
            });

            it("Save Purchase Data", async () => {
                for (const purchase of purchaseData) {
                    const phoneHash = ContractUtils.getPhoneHash(userData[purchase.userIndex].phone);
                    const purchaseAmount = Amount.make(purchase.amount, 18).value;
                    const shop = shopData[purchase.shopIndex];
                    const amt = purchaseAmount.mul(shop.providePercent).div(100);
                    const userAccount =
                        userData[purchase.userIndex].address.trim() !== ""
                            ? userData[purchase.userIndex].address.trim()
                            : AddressZero;
                    if (userAccount !== AddressZero) {
                        await expect(
                            ledgerContract.connect(validatorWallets[0]).savePurchase({
                                purchaseId: purchase.purchaseId,
                                timestamp: purchase.timestamp,
                                amount: purchaseAmount,
                                currency: purchase.currency.toLowerCase(),
                                shopId: shopData[purchase.shopIndex].shopId,
                                method: purchase.method,
                                account: userAccount,
                                phone: phoneHash,
                            })
                        )
                            .to.emit(ledgerContract, "SavedPurchase")
                            .withArgs(
                                purchase.purchaseId,
                                purchase.timestamp,
                                purchaseAmount,
                                purchase.currency.toLowerCase(),
                                shopData[purchase.shopIndex].shopId,
                                purchase.method,
                                userAccount,
                                phoneHash
                            )
                            .emit(ledgerContract, "ProvidedPoint")
                            .withNamedArgs({
                                account: userAccount,
                                providedPoint: amt,
                                providedValue: amt,
                                purchaseId: purchase.purchaseId,
                            });
                    } else {
                        await expect(
                            ledgerContract.connect(validatorWallets[0]).savePurchase({
                                purchaseId: purchase.purchaseId,
                                timestamp: purchase.timestamp,
                                amount: purchaseAmount,
                                currency: purchase.currency.toLowerCase(),
                                shopId: shopData[purchase.shopIndex].shopId,
                                method: purchase.method,
                                account: userAccount,
                                phone: phoneHash,
                            })
                        )
                            .to.emit(ledgerContract, "SavedPurchase")
                            .withArgs(
                                purchase.purchaseId,
                                purchase.timestamp,
                                purchaseAmount,
                                purchase.currency.toLowerCase(),
                                shopData[purchase.shopIndex].shopId,
                                purchase.method,
                                userAccount,
                                phoneHash
                            )
                            .emit(ledgerContract, "ProvidedUnPayablePoint")
                            .withNamedArgs({
                                phone: phoneHash,
                                providedPoint: amt,
                                providedValue: amt,
                                purchaseId: purchase.purchaseId,
                            });
                    }
                }
            });

            it("Check balances", async () => {
                const expected: Map<string, BigNumber> = new Map<string, BigNumber>();
                for (const purchase of purchaseData) {
                    const purchaseAmount = Amount.make(purchase.amount, 18).value;
                    const key =
                        userData[purchase.userIndex].address.trim() !== ""
                            ? userData[purchase.userIndex].address.trim()
                            : ContractUtils.getPhoneHash(userData[purchase.userIndex].phone.trim());
                    const oldValue = expected.get(key);

                    const shop = shopData[purchase.shopIndex];
                    const point = purchaseAmount.mul(shop.providePercent).div(100);

                    if (oldValue !== undefined) expected.set(key, oldValue.add(point));
                    else expected.set(key, point);
                }
                for (const key of expected.keys()) {
                    if (key.match(/^0x[A-Fa-f0-9]{64}$/i)) {
                        expect(await ledgerContract.unPayablePointBalanceOf(key)).to.deep.equal(expected.get(key));
                    } else {
                        expect(await ledgerContract.pointBalanceOf(key)).to.deep.equal(expected.get(key));
                    }
                }
            });

            it("Save Purchase Data - phone and address are not registered", async () => {
                const purchase: IPurchaseData = {
                    purchaseId: "P000005",
                    timestamp: 1683212400,
                    amount: 10000,
                    method: 0,
                    currency: "krw",
                    shopIndex: 1,
                    userIndex: 3,
                };
                const phoneHash = ContractUtils.getPhoneHash(userData[purchase.userIndex].phone);
                const userAccount =
                    userData[purchase.userIndex].address.trim() !== ""
                        ? userData[purchase.userIndex].address.trim()
                        : AddressZero;
                const purchaseAmount = Amount.make(purchase.amount, 18).value;
                const shop = shopData[purchase.shopIndex];
                const pointAmount = purchaseAmount.mul(shop.providePercent).div(100);

                const oldUnPayablePointBalance = await ledgerContract.unPayablePointBalanceOf(phoneHash);
                await expect(
                    ledgerContract.connect(validatorWallets[0]).savePurchase({
                        purchaseId: purchase.purchaseId,
                        timestamp: purchase.timestamp,
                        amount: purchaseAmount,
                        currency: purchase.currency.toLowerCase(),
                        shopId: shop.shopId,
                        method: purchase.method,
                        account: userAccount,
                        phone: phoneHash,
                    })
                )
                    .to.emit(ledgerContract, "SavedPurchase")
                    .withArgs(
                        purchase.purchaseId,
                        purchase.timestamp,
                        purchaseAmount,
                        purchase.currency.toLowerCase(),
                        shopData[purchase.shopIndex].shopId,
                        purchase.method,
                        userAccount,
                        phoneHash
                    )
                    .emit(ledgerContract, "ProvidedUnPayablePoint")
                    .withNamedArgs({
                        phone: phoneHash,
                        providedPoint: pointAmount,
                        providedValue: pointAmount,
                        purchaseId: purchase.purchaseId,
                    });
                expect(await ledgerContract.unPayablePointBalanceOf(phoneHash)).to.deep.equal(
                    oldUnPayablePointBalance.add(pointAmount)
                );
            });

            it("Link phone-address", async () => {
                const nonce = await linkCollectionContract.nonceOf(userWallets[3].address);
                const hash = phoneHashes[3];
                const signature = await ContractUtils.signRequestHash(userWallets[3], hash, nonce);
                requestId = ContractUtils.getRequestId(hash, userWallets[3].address, nonce);
                await expect(
                    linkCollectionContract.connect(relay).addRequest(requestId, hash, userWallets[3].address, signature)
                )
                    .to.emit(linkCollectionContract, "AddedRequestItem")
                    .withArgs(requestId, hash, userWallets[3].address);
                await linkCollectionContract.connect(validator1).voteRequest(requestId);
                await linkCollectionContract.connect(validator1).countVote(requestId);
            });

            it("Save Purchase Data - phone and address are registered (user: 3, point type : 0)", async () => {
                const purchase: IPurchaseData = {
                    purchaseId: "P000005",
                    timestamp: 1683212400,
                    amount: 10000,
                    method: 0,
                    currency: "krw",
                    shopIndex: 1,
                    userIndex: 3,
                };
                const phoneHash = ContractUtils.getPhoneHash(userData[purchase.userIndex].phone);
                const userAccount =
                    userData[purchase.userIndex].address.trim() !== ""
                        ? userData[purchase.userIndex].address.trim()
                        : AddressZero;
                const purchaseAmount = Amount.make(purchase.amount, 18).value;
                const shop = shopData[purchase.shopIndex];
                const pointAmount = purchaseAmount.mul(shop.providePercent).div(100);
                const tokenAmount = pointAmount.mul(multiple).div(price);

                const oldUnPayablePointBalance = await ledgerContract.unPayablePointBalanceOf(phoneHash);
                const oldPointBalance = await ledgerContract.pointBalanceOf(userWallets[purchase.userIndex].address);
                const oldTokenBalance = await ledgerContract.tokenBalanceOf(userWallets[purchase.userIndex].address);
                const oldFoundationTokenBalance = await ledgerContract.tokenBalanceOf(foundation.address);
                await expect(
                    ledgerContract.connect(validatorWallets[0]).savePurchase({
                        purchaseId: purchase.purchaseId,
                        timestamp: purchase.timestamp,
                        amount: purchaseAmount,
                        currency: purchase.currency.toLowerCase(),
                        shopId: shop.shopId,
                        method: purchase.method,
                        account: userAccount,
                        phone: phoneHash,
                    })
                )
                    .to.emit(ledgerContract, "SavedPurchase")
                    .withArgs(
                        purchase.purchaseId,
                        purchase.timestamp,
                        purchaseAmount,
                        purchase.currency.toLowerCase(),
                        shopData[purchase.shopIndex].shopId,
                        purchase.method,
                        userAccount,
                        phoneHash
                    )
                    .emit(ledgerContract, "ProvidedPoint")
                    .withNamedArgs({
                        account: userWallets[3].address,
                        providedPoint: pointAmount,
                        providedValue: pointAmount,
                        purchaseId: purchase.purchaseId,
                    });
                expect(await ledgerContract.unPayablePointBalanceOf(phoneHash)).to.deep.equal(oldUnPayablePointBalance);
                expect(await ledgerContract.pointBalanceOf(userWallets[purchase.userIndex].address)).to.deep.equal(
                    oldPointBalance.add(pointAmount)
                );
                expect(await ledgerContract.tokenBalanceOf(userWallets[purchase.userIndex].address)).to.deep.equal(
                    oldTokenBalance
                );
                expect(await ledgerContract.tokenBalanceOf(foundation.address)).to.deep.equal(
                    oldFoundationTokenBalance
                );
            });

            it("Change to payable point", async () => {
                const userIndex = 3;
                const oldBalance = await ledgerContract.pointBalanceOf(userWallets[userIndex].address);
                const phoneHash = ContractUtils.getPhoneHash(userData[userIndex].phone);
                const nonce = await ledgerContract.nonceOf(userWallets[userIndex].address);
                const signature = ContractUtils.signChangePayablePoint(userWallets[userIndex], phoneHash, nonce);
                const unPayableAmount = await ledgerContract.unPayablePointBalanceOf(phoneHash);
                await expect(
                    ledgerContract
                        .connect(relay)
                        .changeToPayablePoint(phoneHash, userWallets[userIndex].address, signature)
                )
                    .to.emit(ledgerContract, "ChangedToPayablePoint")
                    .withNamedArgs({
                        phone: phoneHash,
                        account: userWallets[userIndex].address,
                        changedPoint: unPayableAmount,
                    });
                expect(await ledgerContract.pointBalanceOf(userWallets[userIndex].address)).to.equal(
                    oldBalance.add(unPayableAmount)
                );
                expect(await ledgerContract.unPayablePointBalanceOf(phoneHash)).to.equal(0);
            });

            it("Change point type (user: 3)", async () => {
                const userIndex = 3;
                const royaltyType = 1;
                const nonce = await ledgerContract.nonceOf(userWallets[userIndex].address);
                const signature = ContractUtils.signRoyaltyType(userWallets[userIndex], royaltyType, nonce);
                await expect(
                    ledgerContract.connect(relay).setRoyaltyType(royaltyType, userWallets[userIndex].address, signature)
                )
                    .to.emit(ledgerContract, "ChangedRoyaltyType")
                    .withNamedArgs({ account: userWallets[userIndex].address, royaltyType });
            });

            it("Save Purchase Data - phone and address are registered (user: 3, point type : 1)", async () => {
                const purchase: IPurchaseData = {
                    purchaseId: "P000005",
                    timestamp: 1683212400,
                    amount: 10000,
                    method: 0,
                    currency: "krw",
                    shopIndex: 1,
                    userIndex: 3,
                };
                const phoneHash = ContractUtils.getPhoneHash(userData[purchase.userIndex].phone);
                const userAccount =
                    userData[purchase.userIndex].address.trim() !== ""
                        ? userData[purchase.userIndex].address.trim()
                        : AddressZero;
                const purchaseAmount = Amount.make(purchase.amount, 18).value;
                const shop = shopData[purchase.shopIndex];
                const pointAmount = purchaseAmount.mul(shop.providePercent).div(100);
                const tokenAmount = pointAmount.mul(multiple).div(price);

                const oldUnPayablePointBalance = await ledgerContract.unPayablePointBalanceOf(phoneHash);
                const oldPointBalance = await ledgerContract.pointBalanceOf(userWallets[purchase.userIndex].address);
                const oldTokenBalance = await ledgerContract.tokenBalanceOf(userWallets[purchase.userIndex].address);
                const oldFoundationTokenBalance = await ledgerContract.tokenBalanceOf(foundation.address);
                await expect(
                    ledgerContract.connect(validatorWallets[0]).savePurchase({
                        purchaseId: purchase.purchaseId,
                        timestamp: purchase.timestamp,
                        amount: purchaseAmount,
                        currency: purchase.currency.toLowerCase(),
                        shopId: shop.shopId,
                        method: purchase.method,
                        account: userAccount,
                        phone: phoneHash,
                    })
                )
                    .to.emit(ledgerContract, "SavedPurchase")
                    .withArgs(
                        purchase.purchaseId,
                        purchase.timestamp,
                        purchaseAmount,
                        purchase.currency.toLowerCase(),
                        shopData[purchase.shopIndex].shopId,
                        purchase.method,
                        userAccount,
                        phoneHash
                    )
                    .emit(ledgerContract, "ProvidedToken")
                    .withNamedArgs({
                        account: userWallets[3].address,
                        providedToken: tokenAmount,
                        providedValue: pointAmount,
                        purchaseId: purchase.purchaseId,
                    });
                expect(await ledgerContract.unPayablePointBalanceOf(phoneHash)).to.deep.equal(oldUnPayablePointBalance);
                expect(await ledgerContract.pointBalanceOf(userWallets[purchase.userIndex].address)).to.deep.equal(
                    oldPointBalance
                );
                expect(await ledgerContract.tokenBalanceOf(userWallets[purchase.userIndex].address)).to.deep.equal(
                    oldTokenBalance.add(tokenAmount)
                );
                expect(await ledgerContract.tokenBalanceOf(foundation.address)).to.deep.equal(
                    oldFoundationTokenBalance.sub(tokenAmount)
                );
            });

            it("Save Purchase Data -(user: 1, point type : 0)", async () => {
                const purchase: IPurchaseData = {
                    purchaseId: "P000005",
                    timestamp: 1683212400,
                    amount: 10000,
                    method: 0,
                    currency: "krw",
                    shopIndex: 1,
                    userIndex: 1,
                };
                const phoneHash = ContractUtils.getPhoneHash(userData[purchase.userIndex].phone);
                const userAccount =
                    userData[purchase.userIndex].address.trim() !== ""
                        ? userData[purchase.userIndex].address.trim()
                        : AddressZero;
                const purchaseAmount = Amount.make(purchase.amount, 18).value;
                const shop = shopData[purchase.shopIndex];
                const pointAmount = purchaseAmount.mul(shop.providePercent).div(100);
                const tokenAmount = pointAmount.mul(multiple).div(price);

                const oldUnPayablePointBalance = await ledgerContract.unPayablePointBalanceOf(phoneHash);
                const oldPointBalance = await ledgerContract.pointBalanceOf(userWallets[purchase.userIndex].address);
                const oldTokenBalance = await ledgerContract.tokenBalanceOf(userWallets[purchase.userIndex].address);
                const oldFoundationTokenBalance = await ledgerContract.tokenBalanceOf(foundation.address);
                await expect(
                    ledgerContract.connect(validatorWallets[0]).savePurchase({
                        purchaseId: purchase.purchaseId,
                        timestamp: purchase.timestamp,
                        amount: purchaseAmount,
                        currency: purchase.currency.toLowerCase(),
                        shopId: shop.shopId,
                        method: purchase.method,
                        account: userAccount,
                        phone: phoneHash,
                    })
                )
                    .to.emit(ledgerContract, "SavedPurchase")
                    .withArgs(
                        purchase.purchaseId,
                        purchase.timestamp,
                        purchaseAmount,
                        purchase.currency.toLowerCase(),
                        shopData[purchase.shopIndex].shopId,
                        purchase.method,
                        userAccount,
                        phoneHash
                    )
                    .emit(ledgerContract, "ProvidedPoint")
                    .withNamedArgs({
                        account: userAccount,
                        providedPoint: pointAmount,
                        providedValue: pointAmount,
                        purchaseId: purchase.purchaseId,
                    });
                expect(await ledgerContract.unPayablePointBalanceOf(phoneHash)).to.deep.equal(oldUnPayablePointBalance);
                expect(await ledgerContract.pointBalanceOf(userWallets[purchase.userIndex].address)).to.deep.equal(
                    oldPointBalance.add(pointAmount)
                );
                expect(await ledgerContract.tokenBalanceOf(userWallets[purchase.userIndex].address)).to.deep.equal(
                    oldTokenBalance
                );
                expect(await ledgerContract.tokenBalanceOf(foundation.address)).to.deep.equal(
                    oldFoundationTokenBalance
                );
            });

            it("Change point type (user: 1)", async () => {
                const userIndex = 1;
                const royaltyType = 1;
                const nonce = await ledgerContract.nonceOf(userWallets[userIndex].address);
                const signature = ContractUtils.signRoyaltyType(userWallets[userIndex], royaltyType, nonce);
                await expect(
                    ledgerContract.connect(relay).setRoyaltyType(royaltyType, userWallets[userIndex].address, signature)
                )
                    .to.emit(ledgerContract, "ChangedRoyaltyType")
                    .withNamedArgs({ account: userWallets[userIndex].address, royaltyType });
            });

            it("Save Purchase Data - (user: 1, point type : 1)", async () => {
                const purchase: IPurchaseData = {
                    purchaseId: "P000005",
                    timestamp: 1683212400,
                    amount: 100000,
                    method: 0,
                    currency: "krw",
                    shopIndex: 1,
                    userIndex: 1,
                };
                const phoneHash = ContractUtils.getPhoneHash(userData[purchase.userIndex].phone);
                const userAccount =
                    userData[purchase.userIndex].address.trim() !== ""
                        ? userData[purchase.userIndex].address.trim()
                        : AddressZero;
                const purchaseAmount = Amount.make(purchase.amount, 18).value;
                const shop = shopData[purchase.shopIndex];
                const pointAmount = purchaseAmount.mul(shop.providePercent).div(100);
                const tokenAmount = pointAmount.mul(multiple).div(price);

                const oldUnPayablePointBalance = await ledgerContract.unPayablePointBalanceOf(phoneHash);
                const oldPointBalance = await ledgerContract.pointBalanceOf(userWallets[purchase.userIndex].address);
                const oldTokenBalance = await ledgerContract.tokenBalanceOf(userWallets[purchase.userIndex].address);
                const oldFoundationTokenBalance = await ledgerContract.tokenBalanceOf(foundation.address);
                await expect(
                    ledgerContract.connect(validatorWallets[0]).savePurchase({
                        purchaseId: purchase.purchaseId,
                        timestamp: purchase.timestamp,
                        amount: purchaseAmount,
                        currency: purchase.currency.toLowerCase(),
                        shopId: shop.shopId,
                        method: purchase.method,
                        account: userAccount,
                        phone: phoneHash,
                    })
                )
                    .to.emit(ledgerContract, "SavedPurchase")
                    .withArgs(
                        purchase.purchaseId,
                        purchase.timestamp,
                        purchaseAmount,
                        purchase.currency.toLowerCase(),
                        shopData[purchase.shopIndex].shopId,
                        purchase.method,
                        userAccount,
                        phoneHash
                    )
                    .emit(ledgerContract, "ProvidedToken")
                    .withNamedArgs({
                        account: userAccount,
                        providedToken: tokenAmount,
                        providedValue: pointAmount,
                        purchaseId: purchase.purchaseId,
                    });
                expect(await ledgerContract.unPayablePointBalanceOf(phoneHash)).to.deep.equal(oldUnPayablePointBalance);
                expect(await ledgerContract.pointBalanceOf(userWallets[purchase.userIndex].address)).to.deep.equal(
                    oldPointBalance
                );
                expect(await ledgerContract.tokenBalanceOf(userWallets[purchase.userIndex].address)).to.deep.equal(
                    oldTokenBalance.add(tokenAmount)
                );
                expect(await ledgerContract.tokenBalanceOf(foundation.address)).to.deep.equal(
                    oldFoundationTokenBalance.sub(tokenAmount)
                );
            });
        });

        context("Pay point", () => {
            it("Pay point - Invalid signature", async () => {
                const purchase: IPurchaseData = {
                    purchaseId: "P000100",
                    timestamp: 1672849000,
                    amount: 100,
                    method: 0,
                    currency: "krw",
                    shopIndex: 0,
                    userIndex: 0,
                };

                const purchaseAmount = Amount.make(purchase.amount, 18).value;
                const shop = shopData[purchase.shopIndex];
                const nonce = await ledgerContract.nonceOf(userWallets[purchase.userIndex].address);
                const signature = await ContractUtils.signPayment(
                    userWallets[purchase.userIndex],
                    purchase.purchaseId,
                    purchaseAmount,
                    purchase.currency,
                    shop.shopId,
                    nonce
                );
                await expect(
                    ledgerContract.connect(relay).payPoint({
                        purchaseId: purchase.purchaseId,
                        amount: purchaseAmount,
                        currency: purchase.currency.toLowerCase(),
                        shopId: shop.shopId,
                        account: userWallets[purchase.userIndex + 1].address,
                        signature,
                    })
                ).to.be.revertedWith("Invalid signature");
            });

            it("Pay point - Insufficient balance", async () => {
                const purchase: IPurchaseData = {
                    purchaseId: "P000100",
                    timestamp: 1672849000,
                    amount: 100000,
                    method: 0,
                    currency: "krw",
                    shopIndex: 0,
                    userIndex: 0,
                };

                const purchaseAmount = Amount.make(purchase.amount, 18).value;
                const shop = shopData[purchase.shopIndex];
                const nonce = await ledgerContract.nonceOf(userWallets[purchase.userIndex].address);
                const signature = await ContractUtils.signPayment(
                    userWallets[purchase.userIndex],
                    purchase.purchaseId,
                    purchaseAmount,
                    purchase.currency,
                    shop.shopId,
                    nonce
                );
                await expect(
                    ledgerContract.connect(relay).payPoint({
                        purchaseId: purchase.purchaseId,
                        amount: purchaseAmount,
                        currency: purchase.currency.toLowerCase(),
                        shopId: shop.shopId,
                        account: userWallets[purchase.userIndex].address,
                        signature,
                    })
                ).to.be.revertedWith("Insufficient balance");
            });

            it("Pay point - Success", async () => {
                const purchase: IPurchaseData = {
                    purchaseId: "P000100",
                    timestamp: 1672849000,
                    amount: 100,
                    method: 0,
                    currency: "krw",
                    shopIndex: 0,
                    userIndex: 0,
                };

                const purchaseAmount = Amount.make(purchase.amount, 18).value;
                const shop = shopData[purchase.shopIndex];
                const nonce = await ledgerContract.nonceOf(userWallets[purchase.userIndex].address);
                const signature = await ContractUtils.signPayment(
                    userWallets[purchase.userIndex],
                    purchase.purchaseId,
                    purchaseAmount,
                    purchase.currency,
                    shop.shopId,
                    nonce
                );
                const feeAmount = purchaseAmount.mul(await ledgerContract.fee()).div(100);
                const feeToken = feeAmount.mul(multiple).div(price);
                const oldFeeBalance = await ledgerContract.tokenBalanceOf(fee.address);
                await expect(
                    ledgerContract.connect(relay).payPoint({
                        purchaseId: purchase.purchaseId,
                        amount: purchaseAmount,
                        currency: purchase.currency.toLowerCase(),
                        shopId: shop.shopId,
                        account: userWallets[purchase.userIndex].address,
                        signature,
                    })
                )
                    .to.emit(ledgerContract, "PaidPoint")
                    .withNamedArgs({
                        account: userWallets[purchase.userIndex].address,
                        paidPoint: purchaseAmount,
                        paidValue: purchaseAmount,
                        feePoint: feeAmount,
                        feeValue: feeAmount,
                        purchaseId: purchase.purchaseId,
                        shopId: shop.shopId,
                    });
                const newFeeBalance = await ledgerContract.tokenBalanceOf(fee.address);
                expect(newFeeBalance).to.deep.equal(oldFeeBalance.add(feeToken));
            });
        });

        context("Pay token", () => {
            it("Pay token - Invalid signature", async () => {
                const purchase: IPurchaseData = {
                    purchaseId: "P000000",
                    timestamp: 1672849000,
                    amount: 100,
                    method: 0,
                    currency: "krw",
                    shopIndex: 0,
                    userIndex: 1,
                };

                const purchaseAmount = Amount.make(purchase.amount, 18).value;
                const shop = shopData[purchase.shopIndex];
                const nonce = await ledgerContract.nonceOf(userWallets[purchase.userIndex].address);
                const signature = await ContractUtils.signPayment(
                    userWallets[purchase.userIndex],
                    purchase.purchaseId,
                    purchaseAmount,
                    purchase.currency,
                    shop.shopId,
                    nonce
                );
                await expect(
                    ledgerContract.connect(relay).payToken({
                        purchaseId: purchase.purchaseId,
                        amount: purchaseAmount,
                        currency: purchase.currency.toLowerCase(),
                        shopId: shop.shopId,
                        account: userWallets[purchase.userIndex + 1].address,
                        signature,
                    })
                ).to.be.revertedWith("Invalid signature");
            });

            it("Pay token - Insufficient balance", async () => {
                const purchase: IPurchaseData = {
                    purchaseId: "P000000",
                    timestamp: 1672849000,
                    amount: 100000,
                    method: 0,
                    currency: "krw",
                    shopIndex: 0,
                    userIndex: 1,
                };

                const purchaseAmount = Amount.make(purchase.amount, 18).value;
                const shop = shopData[purchase.shopIndex];
                const nonce = await ledgerContract.nonceOf(userWallets[purchase.userIndex].address);
                const signature = await ContractUtils.signPayment(
                    userWallets[purchase.userIndex],
                    purchase.purchaseId,
                    purchaseAmount,
                    purchase.currency,
                    shop.shopId,
                    nonce
                );
                await expect(
                    ledgerContract.connect(relay).payToken({
                        purchaseId: purchase.purchaseId,
                        amount: purchaseAmount,
                        currency: purchase.currency.toLowerCase(),
                        shopId: shop.shopId,
                        account: userWallets[purchase.userIndex].address,
                        signature,
                    })
                ).to.be.revertedWith("Insufficient balance");
            });

            it("Pay token - Success", async () => {
                const purchase: IPurchaseData = {
                    purchaseId: "P000000",
                    timestamp: 1672849000,
                    amount: 100,
                    method: 0,
                    currency: "krw",
                    shopIndex: 0,
                    userIndex: 1,
                };

                const purchaseAmount = Amount.make(purchase.amount, 18).value;
                const tokenAmount = purchaseAmount.mul(multiple).div(price);
                const oldFoundationTokenBalance = await ledgerContract.tokenBalanceOf(foundation.address);
                const shop = shopData[purchase.shopIndex];
                const nonce = await ledgerContract.nonceOf(userWallets[purchase.userIndex].address);
                const signature = await ContractUtils.signPayment(
                    userWallets[purchase.userIndex],
                    purchase.purchaseId,
                    purchaseAmount,
                    purchase.currency,
                    shop.shopId,
                    nonce
                );
                const feeAmount = purchaseAmount.mul(await ledgerContract.fee()).div(100);
                const feeToken = feeAmount.mul(multiple).div(price);
                const oldFeeBalance = await ledgerContract.tokenBalanceOf(fee.address);
                await expect(
                    ledgerContract.connect(relay).payToken({
                        purchaseId: purchase.purchaseId,
                        amount: purchaseAmount,
                        currency: purchase.currency.toLowerCase(),
                        shopId: shop.shopId,
                        account: userWallets[purchase.userIndex].address,
                        signature,
                    })
                )
                    .to.emit(ledgerContract, "PaidToken")
                    .withNamedArgs({
                        account: userWallets[purchase.userIndex].address,
                        paidToken: tokenAmount,
                        paidValue: purchaseAmount,
                        feeToken: feeToken,
                        feeValue: feeAmount,
                        purchaseId: purchase.purchaseId,
                        shopId: shop.shopId,
                    });
                expect(await ledgerContract.tokenBalanceOf(foundation.address)).to.deep.equal(
                    oldFoundationTokenBalance.add(tokenAmount)
                );
                const newFeeBalance = await ledgerContract.tokenBalanceOf(fee.address);
                expect(newFeeBalance).to.deep.equal(oldFeeBalance.add(feeToken));
            });
        });
    });

    context("Deposit & Withdraw", () => {
        const userData: IUserData[] = [
            {
                phone: "08201012341001",
                address: userWallets[0].address,
                privateKey: userWallets[0].privateKey,
            },
            {
                phone: "08201012341002",
                address: userWallets[1].address,
                privateKey: userWallets[1].privateKey,
            },
            {
                phone: "08201012341003",
                address: userWallets[2].address,
                privateKey: userWallets[2].privateKey,
            },
            {
                phone: "08201012341004",
                address: "",
                privateKey: "",
            },
            {
                phone: "08201012341005",
                address: "",
                privateKey: "",
            },
        ];

        const purchaseData: IPurchaseData[] = [
            {
                purchaseId: "P000001",
                timestamp: 1672844400,
                amount: 10000,
                method: 0,
                currency: "krw",
                shopIndex: 0,
                userIndex: 0,
            },
            {
                purchaseId: "P000002",
                timestamp: 1675522800,
                amount: 10000,
                method: 0,
                currency: "krw",
                shopIndex: 0,
                userIndex: 1,
            },
            {
                purchaseId: "P000003",
                timestamp: 1677942000,
                amount: 10000,
                method: 0,
                currency: "krw",
                shopIndex: 1,
                userIndex: 2,
            },
            {
                purchaseId: "P000004",
                timestamp: 1680620400,
                amount: 10000,
                method: 0,
                currency: "krw",
                shopIndex: 2,
                userIndex: 3,
            },
            {
                purchaseId: "P000005",
                timestamp: 1683212400,
                amount: 10000,
                method: 0,
                currency: "krw",
                shopIndex: 1,
                userIndex: 4,
            },
        ];

        const shopData: IShopData[] = [
            {
                shopId: "",
                name: "Shop1",
                provideWaitTime: 0,
                providePercent: 5,
                wallet: shopWallets[0],
            },
            {
                shopId: "",
                name: "Shop2",
                provideWaitTime: 0,
                providePercent: 6,
                wallet: shopWallets[1],
            },
            {
                shopId: "",
                name: "Shop3",
                provideWaitTime: 0,
                providePercent: 7,
                wallet: shopWallets[2],
            },
            {
                shopId: "",
                name: "Shop4",
                provideWaitTime: 0,
                providePercent: 8,
                wallet: shopWallets[3],
            },
            {
                shopId: "",
                name: "Shop5",
                provideWaitTime: 0,
                providePercent: 9,
                wallet: shopWallets[4],
            },
            {
                shopId: "",
                name: "Shop6",
                provideWaitTime: 0,
                providePercent: 10,
                wallet: shopWallets[5],
            },
        ];

        before("Set Shop ID", async () => {
            for (const elem of shopData) {
                elem.shopId = ContractUtils.getShopId(elem.name, elem.wallet.address);
            }
        });

        before("Deploy", async () => {
            await deployAllContract();
        });

        before("Prepare Token", async () => {
            for (const elem of userWallets) {
                await tokenContract.connect(deployer).transfer(elem.address, amount.value);
            }
        });

        context("Prepare shop data", () => {
            it("Add Shop Data", async () => {
                for (const elem of shopData) {
                    await expect(
                        shopCollection
                            .connect(elem.wallet)
                            .add(elem.shopId, elem.name, elem.provideWaitTime, elem.providePercent)
                    )
                        .to.emit(shopCollection, "AddedShop")
                        .withNamedArgs({
                            shopId: elem.shopId,
                            name: elem.name,
                            provideWaitTime: elem.provideWaitTime,
                            providePercent: elem.providePercent,
                            account: elem.wallet.address,
                        });
                }
                expect(await shopCollection.shopsLength()).to.equal(shopData.length);
            });
        });

        context("Prepare foundation's asset", () => {
            it("Deposit foundation's token", async () => {
                await tokenContract.connect(deployer).transfer(foundation.address, assetAmount.value);
                await tokenContract.connect(foundation).approve(ledgerContract.address, assetAmount.value);
                await expect(ledgerContract.connect(foundation).deposit(assetAmount.value))
                    .to.emit(ledgerContract, "Deposited")
                    .withNamedArgs({
                        account: foundation.address,
                        depositedToken: assetAmount.value,
                        balanceToken: assetAmount.value,
                    });
            });
        });

        context("Deposit token", () => {
            it("Deposit token - Success", async () => {
                const oldTokenBalance = await ledgerContract.tokenBalanceOf(userWallets[0].address);
                await tokenContract.connect(userWallets[0]).approve(ledgerContract.address, amount.value);
                await expect(ledgerContract.connect(userWallets[0]).deposit(amount.value))
                    .to.emit(ledgerContract, "Deposited")
                    .withNamedArgs({
                        account: userWallets[0].address,
                        depositedToken: amount.value,
                        balanceToken: oldTokenBalance.add(amount.value),
                    });
                expect(await ledgerContract.tokenBalanceOf(userWallets[0].address)).to.deep.equal(
                    oldTokenBalance.add(amount.value)
                );
            });
        });

        context("Withdraw token", () => {
            it("Withdraw token - Insufficient balance", async () => {
                const oldTokenBalance = await ledgerContract.tokenBalanceOf(userWallets[0].address);
                await expect(ledgerContract.connect(userWallets[0]).withdraw(oldTokenBalance.add(1))).to.revertedWith(
                    "Insufficient balance"
                );
            });

            it("Withdraw token - Success", async () => {
                const oldTokenBalance = await ledgerContract.tokenBalanceOf(userWallets[0].address);
                await expect(ledgerContract.connect(userWallets[0]).withdraw(amount.value))
                    .to.emit(ledgerContract, "Withdrawn")
                    .withNamedArgs({
                        account: userWallets[0].address,
                        withdrawnToken: amount.value,
                        balanceToken: oldTokenBalance.sub(amount.value),
                    });
                expect(await ledgerContract.tokenBalanceOf(userWallets[0].address)).to.deep.equal(
                    oldTokenBalance.sub(amount.value)
                );
            });
        });
    });

    context("Clearing for shops", () => {
        const userData: IUserData[] = [
            {
                phone: "08201012341001",
                address: userWallets[0].address,
                privateKey: userWallets[0].privateKey,
            },
            {
                phone: "08201012341002",
                address: userWallets[1].address,
                privateKey: userWallets[1].privateKey,
            },
            {
                phone: "08201012341003",
                address: userWallets[2].address,
                privateKey: userWallets[2].privateKey,
            },
            {
                phone: "08201012341004",
                address: userWallets[3].address,
                privateKey: userWallets[3].privateKey,
            },
            {
                phone: "08201012341005",
                address: userWallets[4].address,
                privateKey: userWallets[4].privateKey,
            },
        ];

        const purchaseData: IPurchaseData[] = [
            {
                purchaseId: "P000001",
                timestamp: 1672844400,
                amount: 10000,
                method: 0,
                currency: "krw",
                shopIndex: 0,
                userIndex: 0,
            },
            {
                purchaseId: "P000002",
                timestamp: 1675522800,
                amount: 10000,
                method: 0,
                currency: "krw",
                shopIndex: 0,
                userIndex: 0,
            },
            {
                purchaseId: "P000003",
                timestamp: 1677942000,
                amount: 10000,
                method: 0,
                currency: "krw",
                shopIndex: 0,
                userIndex: 0,
            },
            {
                purchaseId: "P000004",
                timestamp: 1680620400,
                amount: 10000,
                method: 0,
                currency: "krw",
                shopIndex: 1,
                userIndex: 0,
            },
            {
                purchaseId: "P000005",
                timestamp: 1683212400,
                amount: 10000,
                method: 0,
                currency: "krw",
                shopIndex: 2,
                userIndex: 0,
            },
            {
                purchaseId: "P000005",
                timestamp: 1683212400,
                amount: 10000,
                method: 0,
                currency: "krw",
                shopIndex: 3,
                userIndex: 0,
            },
        ];

        const shopData: IShopData[] = [
            {
                shopId: "F000100",
                name: "Shop1",
                provideWaitTime: 0,
                providePercent: 1,
                wallet: shopWallets[0],
            },
            {
                shopId: "F000200",
                name: "Shop2",
                provideWaitTime: 0,
                providePercent: 1,
                wallet: shopWallets[1],
            },
            {
                shopId: "F000300",
                name: "Shop3",
                provideWaitTime: 0,
                providePercent: 1,
                wallet: shopWallets[2],
            },
            {
                shopId: "F000400",
                name: "Shop4",
                provideWaitTime: 0,
                providePercent: 1,
                wallet: shopWallets[3],
            },
            {
                shopId: "F000500",
                name: "Shop5",
                provideWaitTime: 0,
                providePercent: 1,
                wallet: shopWallets[4],
            },
            {
                shopId: "F000600",
                name: "Shop6",
                provideWaitTime: 0,
                providePercent: 1,
                wallet: shopWallets[5],
            },
        ];

        before("Set Shop ID", async () => {
            for (const elem of shopData) {
                elem.shopId = ContractUtils.getShopId(elem.name, elem.wallet.address);
            }
        });

        before("Deploy", async () => {
            await deployAllContract();
        });

        before("Prepare Token", async () => {
            for (const elem of userWallets) {
                await tokenContract.connect(deployer).transfer(elem.address, amount.value);
            }
        });

        context("Prepare shop data", () => {
            it("Add Shop Data", async () => {
                for (const elem of shopData) {
                    await expect(
                        shopCollection
                            .connect(elem.wallet)
                            .add(elem.shopId, elem.name, elem.provideWaitTime, elem.providePercent)
                    )
                        .to.emit(shopCollection, "AddedShop")
                        .withNamedArgs({
                            shopId: elem.shopId,
                            name: elem.name,
                            provideWaitTime: elem.provideWaitTime,
                            providePercent: elem.providePercent,
                            account: elem.wallet.address,
                        });
                }
                expect(await shopCollection.shopsLength()).to.equal(shopData.length);
            });
        });

        context("Prepare foundation's asset", () => {
            it("Deposit foundation's token", async () => {
                await tokenContract.connect(deployer).transfer(foundation.address, assetAmount.value);
                await tokenContract.connect(foundation).approve(ledgerContract.address, assetAmount.value);
                await expect(ledgerContract.connect(foundation).deposit(assetAmount.value))
                    .to.emit(ledgerContract, "Deposited")
                    .withNamedArgs({
                        account: foundation.address,
                        depositedToken: assetAmount.value,
                        balanceToken: assetAmount.value,
                    });
            });
        });

        context("Save Purchase Data", () => {
            it("Save Purchase Data", async () => {
                for (const purchase of purchaseData) {
                    const phoneHash = ContractUtils.getPhoneHash(userData[purchase.userIndex].phone);
                    const purchaseAmount = Amount.make(purchase.amount, 18).value;
                    const shop = shopData[purchase.shopIndex];
                    const amt = purchaseAmount.mul(shop.providePercent).div(100);
                    const userAccount =
                        userData[purchase.userIndex].address.trim() !== ""
                            ? userData[purchase.userIndex].address.trim()
                            : AddressZero;
                    await expect(
                        ledgerContract.connect(validatorWallets[0]).savePurchase({
                            purchaseId: purchase.purchaseId,
                            timestamp: purchase.timestamp,
                            amount: purchaseAmount,
                            currency: purchase.currency.toLowerCase(),
                            shopId: shopData[purchase.shopIndex].shopId,
                            method: purchase.method,
                            account: userAccount,
                            phone: phoneHash,
                        })
                    )
                        .to.emit(ledgerContract, "SavedPurchase")
                        .withArgs(
                            purchase.purchaseId,
                            purchase.timestamp,
                            purchaseAmount,
                            purchase.currency.toLowerCase(),
                            shopData[purchase.shopIndex].shopId,
                            purchase.method,
                            userAccount,
                            phoneHash
                        )
                        .emit(ledgerContract, "ProvidedPoint")
                        .withNamedArgs({
                            account: userAccount,
                            providedPoint: amt,
                            providedValue: amt,
                            purchaseId: purchase.purchaseId,
                        });
                }
            });

            it("Check balances", async () => {
                const expected: Map<string, BigNumber> = new Map<string, BigNumber>();
                for (const purchase of purchaseData) {
                    const purchaseAmount = Amount.make(purchase.amount, 18).value;
                    const key =
                        userData[purchase.userIndex].address.trim() !== ""
                            ? userData[purchase.userIndex].address.trim()
                            : ContractUtils.getPhoneHash(userData[purchase.userIndex].phone.trim());
                    const oldValue = expected.get(key);

                    const shop = shopData[purchase.shopIndex];
                    const point = purchaseAmount.mul(shop.providePercent).div(100);

                    if (oldValue !== undefined) expected.set(key, oldValue.add(point));
                    else expected.set(key, point);
                }
                for (const key of expected.keys()) {
                    if (key.match(/^0x[A-Fa-f0-9]{64}$/i)) {
                        expect(await ledgerContract.unPayablePointBalanceOf(key)).to.deep.equal(expected.get(key));
                    } else {
                        expect(await ledgerContract.pointBalanceOf(key)).to.deep.equal(expected.get(key));
                    }
                }
            });

            it("Check shop data", async () => {
                const shopInfo1 = await shopCollection.shopOf(shopData[0].shopId);
                expect(shopInfo1.providedPoint).to.equal(
                    Amount.make(10000 * 3, 18)
                        .value.mul(shopData[0].providePercent)
                        .div(100)
                );

                const shopInfo2 = await shopCollection.shopOf(shopData[1].shopId);
                expect(shopInfo2.providedPoint).to.equal(
                    Amount.make(10000 * 1, 18)
                        .value.mul(shopData[1].providePercent)
                        .div(100)
                );
                const shopInfo3 = await shopCollection.shopOf(shopData[2].shopId);
                expect(shopInfo3.providedPoint).to.equal(
                    Amount.make(10000 * 1, 18)
                        .value.mul(shopData[2].providePercent)
                        .div(100)
                );
                const shopInfo4 = await shopCollection.shopOf(shopData[3].shopId);
                expect(shopInfo4.providedPoint).to.equal(
                    Amount.make(10000 * 1, 18)
                        .value.mul(shopData[3].providePercent)
                        .div(100)
                );
            });
        });

        context("Pay point", () => {
            it("Pay point - Success", async () => {
                const purchase = {
                    purchaseId: "P000100",
                    timestamp: 1672849000,
                    amount: 300,
                    method: 0,
                    currency: "krw",
                    shopIndex: 1,
                    userIndex: 0,
                };

                const purchaseAmount = Amount.make(purchase.amount, 18).value;
                const shop = shopData[purchase.shopIndex];
                const nonce = await ledgerContract.nonceOf(userWallets[purchase.userIndex].address);
                const signature = await ContractUtils.signPayment(
                    userWallets[purchase.userIndex],
                    purchase.purchaseId,
                    purchaseAmount,
                    purchase.currency,
                    shop.shopId,
                    nonce
                );

                const amt = purchaseAmount.mul(shop.providePercent).div(100);
                await expect(
                    ledgerContract.connect(relay).payPoint({
                        purchaseId: purchase.purchaseId,
                        amount: purchaseAmount,
                        currency: purchase.currency.toLowerCase(),
                        shopId: shop.shopId,
                        account: userWallets[purchase.userIndex].address,
                        signature,
                    })
                )
                    .to.emit(ledgerContract, "ProvidedTokenForSettlement")
                    .withNamedArgs({
                        account: settlements.address,
                        shopId: shop.shopId,
                        providedPoint: Amount.make(200, 18).value,
                    })
                    .to.emit(ledgerContract, "PaidPoint")
                    .withNamedArgs({
                        account: userWallets[purchase.userIndex].address,
                        paidPoint: purchaseAmount,
                        paidValue: purchaseAmount,
                        purchaseId: purchase.purchaseId,
                        shopId: shop.shopId,
                    });
                const shopInfo = await shopCollection.shopOf(shop.shopId);
                expect(shopInfo.providedPoint).to.equal(Amount.make(100, 18).value);
                expect(shopInfo.usedPoint).to.equal(Amount.make(300, 18).value);
                expect(shopInfo.settledPoint).to.equal(Amount.make(200, 18).value);
            });
        });

        context("Deposit token", () => {
            it("Deposit token - Success", async () => {
                const oldTokenBalance = await ledgerContract.tokenBalanceOf(userWallets[0].address);
                await tokenContract.connect(userWallets[0]).approve(ledgerContract.address, amount.value);
                await expect(ledgerContract.connect(userWallets[0]).deposit(amount.value))
                    .to.emit(ledgerContract, "Deposited")
                    .withNamedArgs({
                        account: userWallets[0].address,
                        depositedToken: amount.value,
                        balanceToken: oldTokenBalance.add(amount.value),
                    });
                expect(await ledgerContract.tokenBalanceOf(userWallets[0].address)).to.deep.equal(
                    oldTokenBalance.add(amount.value)
                );
            });
        });

        context("Pay token", () => {
            it("Pay token - Success", async () => {
                const purchase: IPurchaseData = {
                    purchaseId: "P000200",
                    timestamp: 1672849000,
                    amount: 500,
                    method: 0,
                    currency: "krw",
                    shopIndex: 2,
                    userIndex: 0,
                };

                const purchaseAmount = Amount.make(purchase.amount, 18).value;
                const tokenAmount = purchaseAmount.mul(multiple).div(price);
                const oldFoundationTokenBalance = await ledgerContract.tokenBalanceOf(foundation.address);
                const shop = shopData[purchase.shopIndex];
                const nonce = await ledgerContract.nonceOf(userWallets[purchase.userIndex].address);
                const signature = await ContractUtils.signPayment(
                    userWallets[purchase.userIndex],
                    purchase.purchaseId,
                    purchaseAmount,
                    purchase.currency,
                    shop.shopId,
                    nonce
                );

                await expect(
                    ledgerContract.connect(relay).payToken({
                        purchaseId: purchase.purchaseId,
                        amount: purchaseAmount,
                        currency: purchase.currency.toLowerCase(),
                        shopId: shop.shopId,
                        account: userWallets[purchase.userIndex].address,
                        signature,
                    })
                )
                    .to.emit(ledgerContract, "PaidToken")
                    .withNamedArgs({
                        account: userWallets[purchase.userIndex].address,
                        paidToken: tokenAmount,
                        paidValue: purchaseAmount,
                        purchaseId: purchase.purchaseId,
                        shopId: shop.shopId,
                    });
                const shopInfo2 = await shopCollection.shopOf(shop.shopId);
                expect(shopInfo2.providedPoint).to.equal(Amount.make(100, 18).value);
                expect(shopInfo2.usedPoint).to.equal(Amount.make(500, 18).value);
                expect(shopInfo2.settledPoint).to.equal(Amount.make(400, 18).value);

                const settledToken = shopInfo2.settledPoint.mul(multiple).div(price);
                expect((await ledgerContract.tokenBalanceOf(foundation.address)).toString()).to.deep.equal(
                    oldFoundationTokenBalance.add(tokenAmount).sub(settledToken).toString()
                );
            });
        });

        context("Withdrawal of settlement", () => {
            const shopIndex = 2;
            const shop = shopData[shopIndex];
            const amount2 = Amount.make(400, 18).value;
            it("Check Settlement", async () => {
                const withdrawalAmount = await shopCollection.withdrawableOf(shop.shopId);
                expect(withdrawalAmount).to.equal(amount2);
            });

            it("Open Withdrawal", async () => {
                await expect(
                    shopCollection
                        .connect(shopData[shopIndex].wallet.connect(hre.waffle.provider))
                        .openWithdrawal(shop.shopId, amount2)
                )
                    .to.emit(shopCollection, "OpenedWithdrawal")
                    .withNamedArgs({
                        shopId: shop.shopId,
                        amount: amount2,
                        account: shopWallets[shopIndex].address,
                    });
                const withdrawalAmount = await shopCollection.withdrawableOf(shop.shopId);
                expect(withdrawalAmount).to.equal(amount2);
            });

            it("Close Withdrawal", async () => {
                await expect(
                    shopCollection
                        .connect(shopData[shopIndex].wallet.connect(hre.waffle.provider))
                        .closeWithdrawal(shop.shopId)
                )
                    .to.emit(shopCollection, "ClosedWithdrawal")
                    .withNamedArgs({
                        shopId: shop.shopId,
                        amount: amount2,
                        account: shopWallets[shopIndex].address,
                    });
                const withdrawalAmount = await shopCollection.withdrawableOf(shop.shopId);
                expect(withdrawalAmount).to.equal(0);
            });
        });
    });

    context("Multi Currency", () => {
        const userData: IUserData[] = [
            {
                phone: "08201012341001",
                address: userWallets[0].address,
                privateKey: userWallets[0].privateKey,
            },
            {
                phone: "08201012341002",
                address: userWallets[1].address,
                privateKey: userWallets[1].privateKey,
            },
            {
                phone: "08201012341003",
                address: userWallets[2].address,
                privateKey: userWallets[2].privateKey,
            },
            {
                phone: "08201012341004",
                address: "",
                privateKey: "",
            },
            {
                phone: "08201012341005",
                address: "",
                privateKey: "",
            },
        ];

        const purchaseData: IPurchaseData[] = [
            {
                purchaseId: "P000001",
                timestamp: 1672844400,
                amount: 10000,
                method: 0,
                currency: "KRW",
                shopIndex: 0,
                userIndex: 0,
            },
            {
                purchaseId: "P000002",
                timestamp: 1675522800,
                amount: 10000,
                method: 0,
                currency: "USD",
                shopIndex: 0,
                userIndex: 0,
            },
            {
                purchaseId: "P000003",
                timestamp: 1677942000,
                amount: 10000,
                method: 0,
                currency: "JPY",
                shopIndex: 0,
                userIndex: 0,
            },
            {
                purchaseId: "P000004",
                timestamp: 1680620400,
                amount: 10000,
                method: 0,
                currency: "CNY",
                shopIndex: 1,
                userIndex: 1,
            },
            {
                purchaseId: "P000005",
                timestamp: 1683212400,
                amount: 10000,
                method: 0,
                currency: "KRW",
                shopIndex: 2,
                userIndex: 1,
            },
            {
                purchaseId: "P000005",
                timestamp: 1683212400,
                amount: 10000,
                method: 0,
                currency: "KRW",
                shopIndex: 3,
                userIndex: 2,
            },
        ];

        const shopData: IShopData[] = [
            {
                shopId: "F000100",
                name: "Shop1",
                provideWaitTime: 0,
                providePercent: 1,
                wallet: shopWallets[0],
            },
            {
                shopId: "F000200",
                name: "Shop2",
                provideWaitTime: 0,
                providePercent: 1,
                wallet: shopWallets[1],
            },
            {
                shopId: "F000300",
                name: "Shop3",
                provideWaitTime: 0,
                providePercent: 1,
                wallet: shopWallets[2],
            },
            {
                shopId: "F000400",
                name: "Shop4",
                provideWaitTime: 0,
                providePercent: 1,
                wallet: shopWallets[3],
            },
            {
                shopId: "F000500",
                name: "Shop5",
                provideWaitTime: 0,
                providePercent: 1,
                wallet: shopWallets[4],
            },
            {
                shopId: "F000600",
                name: "Shop6",
                provideWaitTime: 0,
                providePercent: 1,
                wallet: shopWallets[5],
            },
        ];

        before("Set Shop ID", async () => {
            for (const elem of shopData) {
                elem.shopId = ContractUtils.getShopId(elem.name, elem.wallet.address);
            }
        });

        before("Deploy", async () => {
            await deployAllContract();
        });

        before("Prepare Token", async () => {
            for (const elem of userWallets) {
                await tokenContract.connect(deployer).transfer(elem.address, amount.value);
            }
        });

        before("Set Other Currency", async () => {
            await currencyRateContract.connect(validatorWallets[0]).set("usd", BigNumber.from(3).mul(multiple));
            await currencyRateContract.connect(validatorWallets[0]).set("jpy", BigNumber.from(2).mul(multiple));
            await currencyRateContract.connect(validatorWallets[0]).set("cny", BigNumber.from(1).mul(multiple));
            await currencyRateContract.connect(validatorWallets[0]).set("krw", BigNumber.from(1).mul(multiple));
        });

        context("Prepare shop data", () => {
            it("Add Shop Data", async () => {
                for (const elem of shopData) {
                    await expect(
                        shopCollection
                            .connect(elem.wallet)
                            .add(elem.shopId, elem.name, elem.provideWaitTime, elem.providePercent)
                    )
                        .to.emit(shopCollection, "AddedShop")
                        .withNamedArgs({
                            shopId: elem.shopId,
                            name: elem.name,
                            provideWaitTime: elem.provideWaitTime,
                            providePercent: elem.providePercent,
                            account: elem.wallet.address,
                        });
                }
                expect(await shopCollection.shopsLength()).to.equal(shopData.length);
            });
        });

        context("Prepare foundation's asset", () => {
            it("Deposit foundation's token", async () => {
                await tokenContract.connect(deployer).transfer(foundation.address, assetAmount.value);
                await tokenContract.connect(foundation).approve(ledgerContract.address, assetAmount.value);
                await expect(ledgerContract.connect(foundation).deposit(assetAmount.value))
                    .to.emit(ledgerContract, "Deposited")
                    .withNamedArgs({
                        account: foundation.address,
                        depositedToken: assetAmount.value,
                        balanceToken: assetAmount.value,
                    });
            });
        });

        context("Save Purchase Data", () => {
            it("Save Purchase Data", async () => {
                for (const purchase of purchaseData) {
                    const phoneHash = ContractUtils.getPhoneHash(userData[purchase.userIndex].phone);
                    const purchaseAmount = Amount.make(purchase.amount, 18).value;
                    const shop = shopData[purchase.shopIndex];
                    const userAccount =
                        userData[purchase.userIndex].address.trim() !== ""
                            ? userData[purchase.userIndex].address.trim()
                            : AddressZero;
                    const currency = purchase.currency.toLowerCase();
                    const rate = await currencyRateContract.get(currency);
                    const royaltyPoint = purchaseAmount.mul(rate).div(multiple).mul(shop.providePercent).div(100);
                    const royaltyValue = purchaseAmount.mul(shop.providePercent).div(100);
                    await expect(
                        ledgerContract.connect(validatorWallets[0]).savePurchase({
                            purchaseId: purchase.purchaseId,
                            timestamp: purchase.timestamp,
                            amount: purchaseAmount,
                            currency,
                            shopId: shopData[purchase.shopIndex].shopId,
                            method: purchase.method,
                            account: userAccount,
                            phone: phoneHash,
                        })
                    )
                        .to.emit(ledgerContract, "SavedPurchase")
                        .withArgs(
                            purchase.purchaseId,
                            purchase.timestamp,
                            purchaseAmount,
                            purchase.currency.toLowerCase(),
                            shopData[purchase.shopIndex].shopId,
                            purchase.method,
                            userAccount,
                            phoneHash
                        )
                        .emit(ledgerContract, "ProvidedPoint")
                        .withNamedArgs({
                            account: userAccount,
                            providedPoint: royaltyPoint,
                            providedValue: royaltyValue,
                            purchaseId: purchase.purchaseId,
                        });
                }
            });

            it("Check balances", async () => {
                const expected: Map<string, BigNumber> = new Map<string, BigNumber>();
                for (const purchase of purchaseData) {
                    const purchaseAmount = Amount.make(purchase.amount, 18).value;
                    const key =
                        userData[purchase.userIndex].address.trim() !== ""
                            ? userData[purchase.userIndex].address.trim()
                            : ContractUtils.getPhoneHash(userData[purchase.userIndex].phone.trim());
                    const oldValue = expected.get(key);

                    const rate = await currencyRateContract.get(purchase.currency.toLowerCase());
                    const shop = shopData[purchase.shopIndex];
                    const point = purchaseAmount.mul(rate).div(multiple).mul(shop.providePercent).div(100);

                    if (oldValue !== undefined) expected.set(key, oldValue.add(point));
                    else expected.set(key, point);
                }
                for (const key of expected.keys()) {
                    if (key.match(/^0x[A-Fa-f0-9]{64}$/i)) {
                        expect(await ledgerContract.unPayablePointBalanceOf(key)).to.deep.equal(expected.get(key));
                    } else {
                        expect(await ledgerContract.pointBalanceOf(key)).to.deep.equal(expected.get(key));
                    }
                }
            });

            it("Check shop data", async () => {
                const shopInfo1 = await shopCollection.shopOf(shopData[0].shopId);
                expect(shopInfo1.providedPoint).to.equal(
                    Amount.make(10000 * 6, 18)
                        .value.mul(shopData[0].providePercent)
                        .div(100)
                );

                const shopInfo2 = await shopCollection.shopOf(shopData[1].shopId);
                expect(shopInfo2.providedPoint).to.equal(
                    Amount.make(10000 * 1, 18)
                        .value.mul(shopData[1].providePercent)
                        .div(100)
                );
                const shopInfo3 = await shopCollection.shopOf(shopData[2].shopId);
                expect(shopInfo3.providedPoint).to.equal(
                    Amount.make(10000 * 1, 18)
                        .value.mul(shopData[2].providePercent)
                        .div(100)
                );
                const shopInfo4 = await shopCollection.shopOf(shopData[3].shopId);
                expect(shopInfo4.providedPoint).to.equal(
                    Amount.make(10000 * 1, 18)
                        .value.mul(shopData[3].providePercent)
                        .div(100)
                );
            });
        });
    });
});
