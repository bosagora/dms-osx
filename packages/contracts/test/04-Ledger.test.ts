import { ContractShopStatus } from "../src/types";
import { Amount } from "../src/utils/Amount";
import { ContractUtils } from "../src/utils/ContractUtils";
import {
    Certifier,
    CurrencyRate,
    Ledger,
    LoyaltyProvider,
    PhoneLinkCollection,
    Shop,
    Token,
    Validator,
    LoyaltyConsumer,
    LoyaltyExchanger,
} from "../typechain-types";

import "@nomicfoundation/hardhat-ethers";
import "@openzeppelin/hardhat-upgrades";
import { ethers, upgrades } from "hardhat";

import assert from "assert";
import { expect } from "chai";

import { HardhatAccount } from "../src/HardhatAccount";
import { AddressZero } from "@ethersproject/constants";

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
    currency: string;
    provideWaitTime: bigint;
    providePercent: bigint;
    // @ts-ignore
    wallet: ethers.Wallet;
}

interface IUserData {
    phone: string;
    address: string;
    privateKey: string;
}

describe("Test for Ledger", () => {
    const accounts = HardhatAccount.keys.map((m) => new ethers.Wallet(m, ethers.provider));
    const [
        deployer,
        foundation,
        settlements,
        fee,
        certifier,
        validator1,
        validator2,
        validator3,
        relay,
        user1,
        user2,
        user3,
        user4,
        user5,
        user6,
        shop1,
        shop2,
        shop3,
        shop4,
        shop5,
        shop6,
    ] = accounts;

    const validatorWallets = [validator1, validator2, validator3];
    const linkValidators = [validator1];
    const userWallets = [user1, user2, user3, user4, user5, user6];
    const shopWallets = [shop1, shop2, shop3, shop4, shop5, shop6];
    const phoneHashes: string[] = [
        ContractUtils.getPhoneHash("08201012341001"),
        ContractUtils.getPhoneHash("08201012341002"),
        ContractUtils.getPhoneHash("08201012341003"),
        ContractUtils.getPhoneHash("08201012341004"),
        ContractUtils.getPhoneHash("08201012341005"),
        ContractUtils.getPhoneHash("08201012341006"),
    ];
    let certifierContract: Certifier;
    let validatorContract: Validator;
    let tokenContract: Token;
    let ledgerContract: Ledger;
    let linkContract: PhoneLinkCollection;
    let currencyContract: CurrencyRate;
    let shopContract: Shop;
    let providerContract: LoyaltyProvider;
    let consumerContract: LoyaltyConsumer;
    let exchangerContract: LoyaltyExchanger;

    const multiple = 1000000000n;
    const price = 150n * multiple;

    const amount = Amount.make(20_000, 18);
    const assetAmount = Amount.make(10_000_000, 18);

    const deployToken = async () => {
        const factory = await ethers.getContractFactory("Token");
        tokenContract = (await factory.connect(deployer).deploy(deployer.address, "Sample", "SAM")) as unknown as Token;
        await tokenContract.waitForDeployment();
        for (const elem of validatorWallets) {
            await tokenContract.connect(deployer).transfer(elem.address, amount.value);
        }
    };

    const deployValidator = async () => {
        const factory = await ethers.getContractFactory("Validator");
        validatorContract = (await upgrades.deployProxy(
            factory.connect(deployer),
            [await tokenContract.getAddress(), validatorWallets.map((m) => m.address)],
            {
                initializer: "initialize",
                kind: "uups",
            }
        )) as unknown as Validator;
        await validatorContract.waitForDeployment();
    };

    const depositValidators = async () => {
        for (const elem of validatorWallets) {
            await tokenContract.connect(elem).approve(await validatorContract.getAddress(), amount.value);
            await expect(validatorContract.connect(elem).deposit(amount.value))
                .to.emit(validatorContract, "DepositedForValidator")
                .withArgs(elem.address, amount.value, amount.value);
            const item = await validatorContract.validatorOf(elem.address);
            assert.deepStrictEqual(item.validator, elem.address);
            assert.deepStrictEqual(item.status, 1n);
            assert.deepStrictEqual(item.balance, amount.value);
        }
    };

    const deployLinkCollection = async () => {
        const factory = await ethers.getContractFactory("PhoneLinkCollection");
        linkContract = (await upgrades.deployProxy(factory.connect(deployer), [linkValidators.map((m) => m.address)], {
            initializer: "initialize",
            kind: "uups",
        })) as unknown as PhoneLinkCollection;
        await linkContract.waitForDeployment();
    };

    const deployCurrencyRate = async () => {
        const factory = await ethers.getContractFactory("CurrencyRate");
        currencyContract = (await upgrades.deployProxy(
            factory.connect(deployer),
            [await validatorContract.getAddress(), await tokenContract.symbol()],
            {
                initializer: "initialize",
                kind: "uups",
            }
        )) as unknown as CurrencyRate;
        await currencyContract.waitForDeployment();
        await currencyContract.connect(validatorWallets[0]).set(await tokenContract.symbol(), price);
    };

    const deployCertifier = async () => {
        const factory = await ethers.getContractFactory("Certifier");
        certifierContract = (await upgrades.deployProxy(factory.connect(deployer), [certifier.address], {
            initializer: "initialize",
            kind: "uups",
        })) as unknown as Certifier;
        await certifierContract.waitForDeployment();

        await certifierContract.connect(certifier).grantCertifier(relay.address);
    };

    const deployProvider = async () => {
        const factory = await ethers.getContractFactory("LoyaltyProvider");
        providerContract = (await upgrades.deployProxy(
            factory.connect(deployer),
            [
                await validatorContract.getAddress(),
                await linkContract.getAddress(),
                await currencyContract.getAddress(),
            ],
            {
                initializer: "initialize",
                kind: "uups",
            }
        )) as unknown as LoyaltyProvider;
        await providerContract.waitForDeployment();
    };

    const deployConsumer = async () => {
        const factory = await ethers.getContractFactory("LoyaltyConsumer");
        consumerContract = (await upgrades.deployProxy(
            factory.connect(deployer),
            [await certifierContract.getAddress(), await currencyContract.getAddress()],
            {
                initializer: "initialize",
                kind: "uups",
            }
        )) as unknown as LoyaltyConsumer;
        await consumerContract.waitForDeployment();
    };

    const deployExchanger = async () => {
        const factory = await ethers.getContractFactory("LoyaltyExchanger");
        exchangerContract = (await upgrades.deployProxy(
            factory.connect(deployer),
            [await linkContract.getAddress(), await currencyContract.getAddress()],
            {
                initializer: "initialize",
                kind: "uups",
            }
        )) as unknown as LoyaltyExchanger;
        await exchangerContract.waitForDeployment();
    };

    const deployShopCollection = async () => {
        const factory = await ethers.getContractFactory("Shop");
        shopContract = (await upgrades.deployProxy(
            factory.connect(deployer),
            [
                await certifierContract.getAddress(),
                await currencyContract.getAddress(),
                await providerContract.getAddress(),
                await consumerContract.getAddress(),
            ],
            {
                initializer: "initialize",
                kind: "uups",
            }
        )) as unknown as Shop;
        await shopContract.waitForDeployment();
        await providerContract.connect(deployer).setShop(await shopContract.getAddress());
        await consumerContract.connect(deployer).setShop(await shopContract.getAddress());
    };

    const deployLedger = async () => {
        const factory = await ethers.getContractFactory("Ledger");
        ledgerContract = (await upgrades.deployProxy(
            factory.connect(deployer),
            [
                foundation.address,
                settlements.address,
                fee.address,
                await tokenContract.getAddress(),
                await linkContract.getAddress(),
                await currencyContract.getAddress(),
                await providerContract.getAddress(),
                await consumerContract.getAddress(),
                await exchangerContract.getAddress(),
            ],
            {
                initializer: "initialize",
                kind: "uups",
            }
        )) as unknown as Ledger;
        await ledgerContract.waitForDeployment();
        await providerContract.connect(deployer).setLedger(await ledgerContract.getAddress());
        await consumerContract.connect(deployer).setLedger(await ledgerContract.getAddress());
        await exchangerContract.connect(deployer).setLedger(await ledgerContract.getAddress());
    };

    const addShopData = async (shopData: IShopData[]) => {
        for (const elem of shopData) {
            const nonce = await shopContract.nonceOf(elem.wallet.address);
            const signature = await ContractUtils.signShop(elem.wallet, elem.shopId, nonce);
            await shopContract
                .connect(relay)
                .add(elem.shopId, elem.name, elem.currency, elem.wallet.address, signature);
        }

        for (const elem of shopData) {
            const signature1 = await ContractUtils.signShop(
                elem.wallet,
                elem.shopId,
                await shopContract.nonceOf(elem.wallet.address)
            );
            await shopContract
                .connect(certifier)
                .update(
                    elem.shopId,
                    elem.name,
                    elem.currency,
                    elem.provideWaitTime,
                    elem.providePercent,
                    elem.wallet.address,
                    signature1
                );
        }

        for (const elem of shopData) {
            const signature1 = await ContractUtils.signShop(
                elem.wallet,
                elem.shopId,
                await shopContract.nonceOf(elem.wallet.address)
            );
            await shopContract
                .connect(certifier)
                .changeStatus(elem.shopId, ContractShopStatus.ACTIVE, elem.wallet.address, signature1);
        }
    };

    const prepareToken = async () => {
        for (const elem of userWallets) {
            await tokenContract.connect(deployer).transfer(elem.address, amount.value);
        }
        await tokenContract.connect(deployer).transfer(foundation.address, assetAmount.value);
        await tokenContract.connect(foundation).approve(await ledgerContract.getAddress(), assetAmount.value);
        await ledgerContract.connect(foundation).deposit(assetAmount.value);
    };

    const deployAllContract = async (shopData: IShopData[]) => {
        await deployToken();
        await deployValidator();
        await depositValidators();
        await deployLinkCollection();
        await deployCurrencyRate();
        await deployCertifier();
        await deployProvider();
        await deployConsumer();
        await deployExchanger();
        await deployShopCollection();
        await deployLedger();
        await addShopData(shopData);
        await prepareToken();
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
            {
                phone: "08201012341006",
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
                currency: "krw",
                provideWaitTime: 0n,
                providePercent: 5n,
                wallet: shopWallets[0],
            },
            {
                shopId: "",
                name: "Shop2",
                currency: "krw",
                provideWaitTime: 0n,
                providePercent: 6n,
                wallet: shopWallets[1],
            },
            {
                shopId: "",
                name: "Shop3",
                currency: "krw",
                provideWaitTime: 0n,
                providePercent: 7n,
                wallet: shopWallets[2],
            },
            {
                shopId: "",
                name: "Shop4",
                currency: "krw",
                provideWaitTime: 0n,
                providePercent: 8n,
                wallet: shopWallets[3],
            },
            {
                shopId: "",
                name: "Shop5",
                currency: "krw",
                provideWaitTime: 0n,
                providePercent: 9n,
                wallet: shopWallets[4],
            },
            {
                shopId: "",
                name: "Shop6",
                currency: "krw",
                provideWaitTime: 0n,
                providePercent: 10n,
                wallet: shopWallets[5],
            },
        ];

        before("Set Shop ID", async () => {
            for (const elem of shopData) {
                elem.shopId = ContractUtils.getShopId(elem.wallet.address);
            }
        });

        before("Deploy", async () => {
            await deployAllContract(shopData);
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
                        providerContract.connect(deployer).savePurchase({
                            purchaseId: purchase.purchaseId,
                            timestamp: purchase.timestamp,
                            amount: purchaseAmount,
                            currency: purchase.currency.toLowerCase(),
                            shopId: shopData[purchase.shopIndex].shopId,
                            method: purchase.method,
                            account: userAccount,
                            phone: phoneHash,
                        })
                    ).to.be.revertedWith("1000");
                }
            });

            it("Save Purchase Data", async () => {
                for (const purchase of purchaseData) {
                    const phoneHash = ContractUtils.getPhoneHash(userData[purchase.userIndex].phone);
                    const purchaseAmount = Amount.make(purchase.amount, 18).value;
                    const shop = shopData[purchase.shopIndex];
                    const amt = (purchaseAmount * shop.providePercent) / 100n;
                    const userAccount =
                        userData[purchase.userIndex].address.trim() !== ""
                            ? userData[purchase.userIndex].address.trim()
                            : AddressZero;
                    if (userAccount !== AddressZero) {
                        await expect(
                            providerContract.connect(validatorWallets[0]).savePurchase({
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
                            .to.emit(providerContract, "SavedPurchase")
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
                            .emit(ledgerContract, "ProvidedPoint");
                    } else {
                        await expect(
                            providerContract.connect(validatorWallets[0]).savePurchase({
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
                            .to.emit(providerContract, "SavedPurchase")
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
                            .emit(ledgerContract, "ProvidedUnPayablePoint");
                    }
                }
            });

            it("Check balances", async () => {
                const expected: Map<string, bigint> = new Map<string, bigint>();
                for (const purchase of purchaseData) {
                    const purchaseAmount = Amount.make(purchase.amount, 18).value;
                    const key =
                        userData[purchase.userIndex].address.trim() !== ""
                            ? userData[purchase.userIndex].address.trim()
                            : ContractUtils.getPhoneHash(userData[purchase.userIndex].phone.trim());
                    const oldValue = expected.get(key);

                    const shop = shopData[purchase.shopIndex];
                    const point = (purchaseAmount * shop.providePercent) / 100n;

                    if (oldValue !== undefined) expected.set(key, oldValue + point);
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

            it("Save Purchase Data (user: 3, point type : 0) - phone and address are not registered", async () => {
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
                const pointAmount = (purchaseAmount * shop.providePercent) / 100n;

                const oldUnPayablePointBalance = await ledgerContract.unPayablePointBalanceOf(phoneHash);
                await expect(
                    providerContract.connect(validatorWallets[0]).savePurchase({
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
                    .to.emit(providerContract, "SavedPurchase")
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
                    .emit(ledgerContract, "ProvidedUnPayablePoint");
                expect(await ledgerContract.unPayablePointBalanceOf(phoneHash)).to.deep.equal(
                    oldUnPayablePointBalance + pointAmount
                );
            });

            it("Link phone-address (user: 3, point type : 0)", async () => {
                const nonce = await linkContract.nonceOf(userWallets[3].address);
                const hash = phoneHashes[3];
                const signature = await ContractUtils.signRequestHash(userWallets[3], hash, nonce);
                requestId = ContractUtils.getRequestId(hash, userWallets[3].address, nonce);
                await expect(linkContract.connect(relay).addRequest(requestId, hash, userWallets[3].address, signature))
                    .to.emit(linkContract, "AddedRequestItem")
                    .withArgs(requestId, hash, userWallets[3].address);
                await linkContract.connect(validator1).voteRequest(requestId);
                await linkContract.connect(validator1).countVote(requestId);
            });

            it("Save Purchase Data (user: 3, point type : 0) - phone and address are registered (user: 3, point type : 0)", async () => {
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
                const pointAmount = (purchaseAmount * shop.providePercent) / 100n;
                const tokenAmount = (pointAmount * multiple) / price;

                const oldUnPayablePointBalance = await ledgerContract.unPayablePointBalanceOf(phoneHash);
                const oldPointBalance = await ledgerContract.pointBalanceOf(userWallets[purchase.userIndex].address);
                const oldTokenBalance = await ledgerContract.tokenBalanceOf(userWallets[purchase.userIndex].address);
                const oldFoundationTokenBalance = await ledgerContract.tokenBalanceOf(foundation.address);
                await expect(
                    providerContract.connect(validatorWallets[0]).savePurchase({
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
                    .to.emit(providerContract, "SavedPurchase")
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
                    .emit(ledgerContract, "ProvidedPoint");
                expect(await ledgerContract.unPayablePointBalanceOf(phoneHash)).to.deep.equal(oldUnPayablePointBalance);
                expect(await ledgerContract.pointBalanceOf(userWallets[purchase.userIndex].address)).to.deep.equal(
                    oldPointBalance + pointAmount
                );
                expect(await ledgerContract.tokenBalanceOf(userWallets[purchase.userIndex].address)).to.deep.equal(
                    oldTokenBalance
                );
                expect(await ledgerContract.tokenBalanceOf(foundation.address)).to.deep.equal(
                    oldFoundationTokenBalance
                );
            });

            it("Change to payable point (user: 3, point type : 0)", async () => {
                const userIndex = 3;
                const oldBalance = await ledgerContract.pointBalanceOf(userWallets[userIndex].address);
                const phoneHash = ContractUtils.getPhoneHash(userData[userIndex].phone);
                const nonce = await ledgerContract.nonceOf(userWallets[userIndex].address);
                const signature = await ContractUtils.signChangePayablePoint(userWallets[userIndex], phoneHash, nonce);
                const unPayableAmount = await ledgerContract.unPayablePointBalanceOf(phoneHash);
                await expect(
                    exchangerContract
                        .connect(relay)
                        .changeToPayablePoint(phoneHash, userWallets[userIndex].address, signature)
                ).to.emit(exchangerContract, "ChangedToPayablePoint");
                expect(await ledgerContract.pointBalanceOf(userWallets[userIndex].address)).to.equal(
                    oldBalance + unPayableAmount
                );
                expect(await ledgerContract.unPayablePointBalanceOf(phoneHash)).to.equal(0);
            });

            it("Change Loyalty Type (user: 3, point type : 0)", async () => {
                const userIndex = 3;

                const nonce = await ledgerContract.nonceOf(userWallets[userIndex].address);
                const signature = await ContractUtils.signLoyaltyType(userWallets[userIndex], nonce);
                await expect(
                    exchangerContract.connect(relay).changeToLoyaltyToken(userWallets[userIndex].address, signature)
                ).to.emit(exchangerContract, "ChangedToLoyaltyToken");
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
                const pointAmount = (purchaseAmount * shop.providePercent) / 100n;
                const tokenAmount = (pointAmount * multiple) / price;

                const oldUnPayablePointBalance = await ledgerContract.unPayablePointBalanceOf(phoneHash);
                const oldPointBalance = await ledgerContract.pointBalanceOf(userWallets[purchase.userIndex].address);
                const oldTokenBalance = await ledgerContract.tokenBalanceOf(userWallets[purchase.userIndex].address);
                const oldFoundationTokenBalance = await ledgerContract.tokenBalanceOf(foundation.address);
                await expect(
                    providerContract.connect(validatorWallets[0]).savePurchase({
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
                    .to.emit(providerContract, "SavedPurchase")
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
                    .emit(ledgerContract, "ProvidedToken");
                expect(await ledgerContract.unPayablePointBalanceOf(phoneHash)).to.deep.equal(oldUnPayablePointBalance);
                expect(await ledgerContract.pointBalanceOf(userWallets[purchase.userIndex].address)).to.deep.equal(
                    oldPointBalance
                );
                expect(await ledgerContract.tokenBalanceOf(userWallets[purchase.userIndex].address)).to.deep.equal(
                    oldTokenBalance + tokenAmount
                );
                expect(await ledgerContract.tokenBalanceOf(foundation.address)).to.deep.equal(
                    oldFoundationTokenBalance - tokenAmount
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
                const pointAmount = (purchaseAmount * shop.providePercent) / 100n;
                const tokenAmount = (pointAmount * multiple) / price;

                const oldUnPayablePointBalance = await ledgerContract.unPayablePointBalanceOf(phoneHash);
                const oldPointBalance = await ledgerContract.pointBalanceOf(userWallets[purchase.userIndex].address);
                const oldTokenBalance = await ledgerContract.tokenBalanceOf(userWallets[purchase.userIndex].address);
                const oldFoundationTokenBalance = await ledgerContract.tokenBalanceOf(foundation.address);
                await expect(
                    providerContract.connect(validatorWallets[0]).savePurchase({
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
                    .to.emit(providerContract, "SavedPurchase")
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
                    .emit(ledgerContract, "ProvidedPoint");
                expect(await ledgerContract.unPayablePointBalanceOf(phoneHash)).to.deep.equal(oldUnPayablePointBalance);
                expect(await ledgerContract.pointBalanceOf(userWallets[purchase.userIndex].address)).to.deep.equal(
                    oldPointBalance + pointAmount
                );
                expect(await ledgerContract.tokenBalanceOf(userWallets[purchase.userIndex].address)).to.deep.equal(
                    oldTokenBalance
                );
                expect(await ledgerContract.tokenBalanceOf(foundation.address)).to.deep.equal(
                    oldFoundationTokenBalance
                );
            });

            it("Change Loyalty Type (user: 1)", async () => {
                const userIndex = 1;
                const nonce = await ledgerContract.nonceOf(userWallets[userIndex].address);
                const signature = await ContractUtils.signLoyaltyType(userWallets[userIndex], nonce);
                await expect(
                    exchangerContract.connect(relay).changeToLoyaltyToken(userWallets[userIndex].address, signature)
                ).to.emit(exchangerContract, "ChangedToLoyaltyToken");
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
                const pointAmount = (purchaseAmount * shop.providePercent) / 100n;
                const tokenAmount = (pointAmount * multiple) / price;

                const oldUnPayablePointBalance = await ledgerContract.unPayablePointBalanceOf(phoneHash);
                const oldPointBalance = await ledgerContract.pointBalanceOf(userWallets[purchase.userIndex].address);
                const oldTokenBalance = await ledgerContract.tokenBalanceOf(userWallets[purchase.userIndex].address);
                const oldFoundationTokenBalance = await ledgerContract.tokenBalanceOf(foundation.address);
                await expect(
                    providerContract.connect(validatorWallets[0]).savePurchase({
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
                    .to.emit(providerContract, "SavedPurchase")
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
                    .emit(ledgerContract, "ProvidedToken");
                expect(await ledgerContract.unPayablePointBalanceOf(phoneHash)).to.deep.equal(oldUnPayablePointBalance);
                expect(await ledgerContract.pointBalanceOf(userWallets[purchase.userIndex].address)).to.deep.equal(
                    oldPointBalance
                );
                expect(await ledgerContract.tokenBalanceOf(userWallets[purchase.userIndex].address)).to.deep.equal(
                    oldTokenBalance + tokenAmount
                );
                expect(await ledgerContract.tokenBalanceOf(foundation.address)).to.deep.equal(
                    oldFoundationTokenBalance - tokenAmount
                );
            });

            it("Save Purchase Data (user: 4, point type : 0) - phone and address are not registered", async () => {
                const purchase: IPurchaseData = {
                    purchaseId: "P000005",
                    timestamp: 1683212400,
                    amount: 10000,
                    method: 0,
                    currency: "krw",
                    shopIndex: 1,
                    userIndex: 4,
                };
                const phoneHash = ContractUtils.getPhoneHash(userData[purchase.userIndex].phone);
                const userAccount =
                    userData[purchase.userIndex].address.trim() !== ""
                        ? userData[purchase.userIndex].address.trim()
                        : AddressZero;
                const purchaseAmount = Amount.make(purchase.amount, 18).value;
                const shop = shopData[purchase.shopIndex];
                const pointAmount = (purchaseAmount * shop.providePercent) / 100n;

                const oldUnPayablePointBalance = await ledgerContract.unPayablePointBalanceOf(phoneHash);
                await expect(
                    providerContract.connect(validatorWallets[0]).savePurchase({
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
                    .to.emit(providerContract, "SavedPurchase")
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
                    .emit(ledgerContract, "ProvidedUnPayablePoint");
                expect(await ledgerContract.unPayablePointBalanceOf(phoneHash)).to.deep.equal(
                    oldUnPayablePointBalance + pointAmount
                );
            });

            it("Link phone-address (user: 4, point type : 0)", async () => {
                const nonce = await linkContract.nonceOf(userWallets[4].address);
                const hash = phoneHashes[4];
                const signature = await ContractUtils.signRequestHash(userWallets[4], hash, nonce);
                requestId = ContractUtils.getRequestId(hash, userWallets[3].address, nonce);
                await expect(linkContract.connect(relay).addRequest(requestId, hash, userWallets[4].address, signature))
                    .to.emit(linkContract, "AddedRequestItem")
                    .withArgs(requestId, hash, userWallets[4].address);
                await linkContract.connect(validator1).voteRequest(requestId);
                await linkContract.connect(validator1).countVote(requestId);
            });

            it("Save Purchase Data (user: 4, point type : 0) - phone and address are registered (user: 4, point type : 0)", async () => {
                const purchase: IPurchaseData = {
                    purchaseId: "P000005",
                    timestamp: 1683212400,
                    amount: 10000,
                    method: 0,
                    currency: "krw",
                    shopIndex: 1,
                    userIndex: 4,
                };
                const phoneHash = ContractUtils.getPhoneHash(userData[purchase.userIndex].phone);
                const userAccount =
                    userData[purchase.userIndex].address.trim() !== ""
                        ? userData[purchase.userIndex].address.trim()
                        : AddressZero;
                const purchaseAmount = Amount.make(purchase.amount, 18).value;
                const shop = shopData[purchase.shopIndex];
                const pointAmount = (purchaseAmount * shop.providePercent) / 100n;
                const tokenAmount = (pointAmount * multiple) / price;

                const oldUnPayablePointBalance = await ledgerContract.unPayablePointBalanceOf(phoneHash);
                const oldPointBalance = await ledgerContract.pointBalanceOf(userWallets[purchase.userIndex].address);
                const oldTokenBalance = await ledgerContract.tokenBalanceOf(userWallets[purchase.userIndex].address);
                const oldFoundationTokenBalance = await ledgerContract.tokenBalanceOf(foundation.address);
                await expect(
                    providerContract.connect(validatorWallets[0]).savePurchase({
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
                    .to.emit(providerContract, "SavedPurchase")
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
                    .emit(ledgerContract, "ProvidedPoint");
                expect(await ledgerContract.unPayablePointBalanceOf(phoneHash)).to.deep.equal(oldUnPayablePointBalance);
                expect(await ledgerContract.pointBalanceOf(userWallets[purchase.userIndex].address)).to.deep.equal(
                    oldPointBalance + pointAmount
                );
                expect(await ledgerContract.tokenBalanceOf(userWallets[purchase.userIndex].address)).to.deep.equal(
                    oldTokenBalance
                );
                expect(await ledgerContract.tokenBalanceOf(foundation.address)).to.deep.equal(
                    oldFoundationTokenBalance
                );
            });

            it("Change to payable point (user: 4, point type : 0)", async () => {
                const userIndex = 4;
                const oldBalance = await ledgerContract.pointBalanceOf(userWallets[userIndex].address);
                const phoneHash = ContractUtils.getPhoneHash(userData[userIndex].phone);
                const nonce = await ledgerContract.nonceOf(userWallets[userIndex].address);
                const signature = await ContractUtils.signChangePayablePoint(userWallets[userIndex], phoneHash, nonce);
                const unPayableAmount = await ledgerContract.unPayablePointBalanceOf(phoneHash);
                await expect(
                    exchangerContract
                        .connect(relay)
                        .changeToPayablePoint(phoneHash, userWallets[userIndex].address, signature)
                ).to.emit(exchangerContract, "ChangedToPayablePoint");

                expect(await ledgerContract.pointBalanceOf(userWallets[userIndex].address)).to.equal(
                    oldBalance + unPayableAmount
                );
                expect(await ledgerContract.unPayablePointBalanceOf(phoneHash)).to.equal(0);
            });

            it("Change Loyalty Type (user: 4, point type : 0)", async () => {
                const userIndex = 4;

                const nonce = await ledgerContract.nonceOf(userWallets[userIndex].address);
                const signature = await ContractUtils.signLoyaltyType(userWallets[userIndex], nonce);
                await expect(
                    exchangerContract.connect(relay).changeToLoyaltyToken(userWallets[userIndex].address, signature)
                ).to.emit(exchangerContract, "ChangedToLoyaltyToken");
            });

            it("Save Purchase Data - phone and address are registered (user: 4, point type : 1)", async () => {
                const purchase: IPurchaseData = {
                    purchaseId: "P000005",
                    timestamp: 1683212400,
                    amount: 10000,
                    method: 0,
                    currency: "krw",
                    shopIndex: 1,
                    userIndex: 4,
                };
                const phoneHash = ContractUtils.getPhoneHash(userData[purchase.userIndex].phone);
                const userAccount =
                    userData[purchase.userIndex].address.trim() !== ""
                        ? userData[purchase.userIndex].address.trim()
                        : AddressZero;
                const purchaseAmount = Amount.make(purchase.amount, 18).value;
                const shop = shopData[purchase.shopIndex];
                const pointAmount = (purchaseAmount * shop.providePercent) / 100n;
                const tokenAmount = (pointAmount * multiple) / price;

                const oldUnPayablePointBalance = await ledgerContract.unPayablePointBalanceOf(phoneHash);
                const oldPointBalance = await ledgerContract.pointBalanceOf(userWallets[purchase.userIndex].address);
                const oldTokenBalance = await ledgerContract.tokenBalanceOf(userWallets[purchase.userIndex].address);
                const oldFoundationTokenBalance = await ledgerContract.tokenBalanceOf(foundation.address);
                await expect(
                    providerContract.connect(validatorWallets[0]).savePurchase({
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
                    .to.emit(providerContract, "SavedPurchase")
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
                    .emit(ledgerContract, "ProvidedToken");
                expect(await ledgerContract.unPayablePointBalanceOf(phoneHash)).to.deep.equal(oldUnPayablePointBalance);
                expect(await ledgerContract.pointBalanceOf(userWallets[purchase.userIndex].address)).to.deep.equal(
                    oldPointBalance
                );
                expect(await ledgerContract.tokenBalanceOf(userWallets[purchase.userIndex].address)).to.deep.equal(
                    oldTokenBalance + tokenAmount
                );
                expect(await ledgerContract.tokenBalanceOf(foundation.address)).to.deep.equal(
                    oldFoundationTokenBalance - tokenAmount
                );
            });

            it("Save Purchase Data (user: 5, point type : 0) - phone and address are not registered", async () => {
                const purchase: IPurchaseData = {
                    purchaseId: "P000005",
                    timestamp: 1683212400,
                    amount: 10000,
                    method: 0,
                    currency: "krw",
                    shopIndex: 1,
                    userIndex: 5,
                };
                const phoneHash = ContractUtils.getPhoneHash(userData[purchase.userIndex].phone);
                const userAccount =
                    userData[purchase.userIndex].address.trim() !== ""
                        ? userData[purchase.userIndex].address.trim()
                        : AddressZero;
                const purchaseAmount = Amount.make(purchase.amount, 18).value;
                const shop = shopData[purchase.shopIndex];
                const pointAmount = (purchaseAmount * shop.providePercent) / 100n;

                const oldUnPayablePointBalance = await ledgerContract.unPayablePointBalanceOf(phoneHash);
                await expect(
                    providerContract.connect(validatorWallets[0]).savePurchase({
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
                    .to.emit(providerContract, "SavedPurchase")
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
                    .emit(ledgerContract, "ProvidedUnPayablePoint");
                expect(await ledgerContract.unPayablePointBalanceOf(phoneHash)).to.deep.equal(
                    oldUnPayablePointBalance + pointAmount
                );
            });

            it("Change Loyalty Type (user: 5, point type : 0)", async () => {
                const userIndex = 5;

                const nonce = await ledgerContract.nonceOf(userWallets[userIndex].address);
                const signature = await ContractUtils.signLoyaltyType(userWallets[userIndex], nonce);
                await expect(
                    exchangerContract.connect(relay).changeToLoyaltyToken(userWallets[userIndex].address, signature)
                ).to.emit(exchangerContract, "ChangedToLoyaltyToken");
            });

            it("Link phone-address (user: 5, point type : 0)", async () => {
                const userIndex = 5;
                const nonce = await linkContract.nonceOf(userWallets[userIndex].address);
                const hash = phoneHashes[userIndex];
                const signature = await ContractUtils.signRequestHash(userWallets[userIndex], hash, nonce);
                requestId = ContractUtils.getRequestId(hash, userWallets[userIndex].address, nonce);
                await expect(
                    linkContract.connect(relay).addRequest(requestId, hash, userWallets[userIndex].address, signature)
                )
                    .to.emit(linkContract, "AddedRequestItem")
                    .withArgs(requestId, hash, userWallets[userIndex].address);
                await linkContract.connect(validator1).voteRequest(requestId);
                await linkContract.connect(validator1).countVote(requestId);
            });

            it("Change to payable point (user: 5, point type : 0)", async () => {
                const userIndex = 5;
                const oldBalance = await ledgerContract.tokenBalanceOf(userWallets[userIndex].address);
                const phoneHash = ContractUtils.getPhoneHash(userData[userIndex].phone);
                const nonce = await ledgerContract.nonceOf(userWallets[userIndex].address);
                const signature = await ContractUtils.signChangePayablePoint(userWallets[userIndex], phoneHash, nonce);
                const unPayableAmount = await ledgerContract.unPayablePointBalanceOf(phoneHash);
                const tokenAmount = (unPayableAmount * multiple) / price;
                await expect(
                    exchangerContract
                        .connect(relay)
                        .changeToPayablePoint(phoneHash, userWallets[userIndex].address, signature)
                )
                    .to.emit(exchangerContract, "ChangedToPayablePoint")
                    .to.emit(exchangerContract, "ChangedToLoyaltyToken");

                expect(await ledgerContract.tokenBalanceOf(userWallets[userIndex].address)).to.equal(
                    oldBalance + tokenAmount
                );
                expect(await ledgerContract.unPayablePointBalanceOf(phoneHash)).to.equal(0);
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

                const paymentId = ContractUtils.getPaymentId(userWallets[purchase.userIndex].address);
                const purchaseAmount = Amount.make(purchase.amount, 18).value;
                const shop = shopData[purchase.shopIndex];
                const nonce = await ledgerContract.nonceOf(userWallets[purchase.userIndex].address);
                const signature = await ContractUtils.signLoyaltyNewPayment(
                    userWallets[purchase.userIndex],
                    paymentId,
                    purchase.purchaseId,
                    purchaseAmount,
                    purchase.currency,
                    shop.shopId,
                    nonce
                );
                await expect(
                    consumerContract.connect(relay).openNewLoyaltyPayment({
                        paymentId,
                        purchaseId: purchase.purchaseId,
                        amount: purchaseAmount,
                        currency: purchase.currency.toLowerCase(),
                        shopId: shop.shopId,
                        account: userWallets[purchase.userIndex + 1].address,
                        signature,
                    })
                ).to.be.revertedWith("1501");
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

                const paymentId = ContractUtils.getPaymentId(userWallets[purchase.userIndex].address);
                const purchaseAmount = Amount.make(purchase.amount, 18).value;
                const shop = shopData[purchase.shopIndex];
                const nonce = await ledgerContract.nonceOf(userWallets[purchase.userIndex].address);
                const signature = await ContractUtils.signLoyaltyNewPayment(
                    userWallets[purchase.userIndex],
                    paymentId,
                    purchase.purchaseId,
                    purchaseAmount,
                    purchase.currency,
                    shop.shopId,
                    nonce
                );
                await expect(
                    consumerContract.connect(relay).openNewLoyaltyPayment({
                        paymentId,
                        purchaseId: purchase.purchaseId,
                        amount: purchaseAmount,
                        currency: purchase.currency.toLowerCase(),
                        shopId: shop.shopId,
                        account: userWallets[purchase.userIndex].address,
                        signature,
                    })
                ).to.be.revertedWith("1511");
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

                const paymentId = ContractUtils.getPaymentId(userWallets[purchase.userIndex].address);
                const purchaseAmount = Amount.make(purchase.amount, 18).value;
                const shop = shopData[purchase.shopIndex];
                const nonce = await ledgerContract.nonceOf(userWallets[purchase.userIndex].address);
                const signature = await ContractUtils.signLoyaltyNewPayment(
                    userWallets[purchase.userIndex],
                    paymentId,
                    purchase.purchaseId,
                    purchaseAmount,
                    purchase.currency,
                    shop.shopId,
                    nonce
                );
                const feeRate = await ledgerContract.getFee();
                const feeAmount = (purchaseAmount * feeRate) / 100n;
                const feeToken = (feeAmount * multiple) / price;
                const oldFeeBalance = await ledgerContract.tokenBalanceOf(fee.address);
                await expect(
                    consumerContract.connect(relay).openNewLoyaltyPayment({
                        paymentId,
                        purchaseId: purchase.purchaseId,
                        amount: purchaseAmount,
                        currency: purchase.currency.toLowerCase(),
                        shopId: shop.shopId,
                        account: userWallets[purchase.userIndex].address,
                        signature,
                    })
                ).to.emit(consumerContract, "LoyaltyPaymentEvent");

                const paymentData = await consumerContract.loyaltyPaymentOf(paymentId);
                expect(paymentData.paymentId).to.deep.equal(paymentId);
                expect(paymentData.purchaseId).to.deep.equal(purchase.purchaseId);
                expect(paymentData.currency).to.deep.equal(purchase.currency);
                expect(paymentData.shopId).to.deep.equal(shop.shopId);
                expect(paymentData.account).to.deep.equal(userWallets[purchase.userIndex].address);
                expect(paymentData.loyaltyType).to.deep.equal(0);
                expect(paymentData.paidPoint).to.deep.equal(purchaseAmount);
                expect(paymentData.paidValue).to.deep.equal(purchaseAmount);
                expect(paymentData.feePoint).to.deep.equal(feeAmount);
                expect(paymentData.feeValue).to.deep.equal(feeAmount);

                await expect(consumerContract.connect(relay).closeNewLoyaltyPayment(paymentId, true)).to.emit(
                    consumerContract,
                    "LoyaltyPaymentEvent"
                );

                const newFeeBalance = await ledgerContract.tokenBalanceOf(fee.address);
                expect(newFeeBalance).to.deep.equal(oldFeeBalance + feeToken);
            });
        });

        context("Pay Loyalty Point", async () => {
            const purchase: IPurchaseData = {
                purchaseId: "P000100",
                timestamp: 1672849000,
                amount: 100,
                method: 0,
                currency: "krw",
                shopIndex: 0,
                userIndex: 0,
            };

            const paymentId = ContractUtils.getPaymentId(userWallets[purchase.userIndex].address);
            const purchaseAmount = Amount.make(purchase.amount, 18).value;
            const shop = shopData[purchase.shopIndex];

            let feeAmount: bigint;
            let feeToken: bigint;
            let feeRate: bigint;

            it("Pay", async () => {
                feeRate = await ledgerContract.getFee();
                feeAmount = (purchaseAmount * feeRate) / 100n;
                feeToken = (feeAmount * multiple) / price;

                const nonce = await ledgerContract.nonceOf(userWallets[purchase.userIndex].address);
                const signature = await ContractUtils.signLoyaltyNewPayment(
                    userWallets[purchase.userIndex],
                    paymentId,
                    purchase.purchaseId,
                    purchaseAmount,
                    purchase.currency,
                    shop.shopId,
                    nonce
                );
                const oldBalance = await ledgerContract.pointBalanceOf(userWallets[purchase.userIndex].address);
                const oldFeeBalance = await ledgerContract.tokenBalanceOf(fee.address);
                await expect(
                    consumerContract.connect(relay).openNewLoyaltyPayment({
                        paymentId,
                        purchaseId: purchase.purchaseId,
                        amount: purchaseAmount,
                        currency: purchase.currency.toLowerCase(),
                        shopId: shop.shopId,
                        account: userWallets[purchase.userIndex].address,
                        signature,
                    })
                ).to.emit(consumerContract, "LoyaltyPaymentEvent");

                const paymentData = await consumerContract.loyaltyPaymentOf(paymentId);
                expect(paymentData.paymentId).to.deep.equal(paymentId);
                expect(paymentData.purchaseId).to.deep.equal(purchase.purchaseId);
                expect(paymentData.currency).to.deep.equal(purchase.currency);
                expect(paymentData.shopId).to.deep.equal(shop.shopId);
                expect(paymentData.account).to.deep.equal(userWallets[purchase.userIndex].address);
                expect(paymentData.loyaltyType).to.deep.equal(0);
                expect(paymentData.paidPoint).to.deep.equal(purchaseAmount);
                expect(paymentData.paidValue).to.deep.equal(purchaseAmount);
                expect(paymentData.feePoint).to.deep.equal(feeAmount);
                expect(paymentData.feeValue).to.deep.equal(feeAmount);

                const newFeeBalance1 = await ledgerContract.tokenBalanceOf(fee.address);
                expect(newFeeBalance1.toString()).to.deep.equal(oldFeeBalance.toString());

                const newBalance1 = await ledgerContract.pointBalanceOf(userWallets[purchase.userIndex].address);
                expect(newBalance1.toString()).to.deep.equal((oldBalance - purchaseAmount - feeAmount).toString());

                await expect(consumerContract.connect(relay).closeNewLoyaltyPayment(paymentId, true)).to.emit(
                    consumerContract,
                    "LoyaltyPaymentEvent"
                );

                const newFeeBalance2 = await ledgerContract.tokenBalanceOf(fee.address);
                expect(newFeeBalance2.toString()).to.deep.equal((oldFeeBalance + feeToken).toString());

                const newBalance2 = await ledgerContract.pointBalanceOf(userWallets[purchase.userIndex].address);
                expect(newBalance2.toString()).to.deep.equal((oldBalance - purchaseAmount - feeAmount).toString());
            });

            it("Cancel", async () => {
                const oldBalance = await ledgerContract.pointBalanceOf(userWallets[purchase.userIndex].address);
                const nonce = await ledgerContract.nonceOf(shopWallets[purchase.shopIndex].address);
                const signature = await ContractUtils.signLoyaltyCancelPayment(
                    shopWallets[purchase.shopIndex],
                    paymentId,
                    purchase.purchaseId,
                    nonce
                );
                await expect(consumerContract.connect(relay).openCancelLoyaltyPayment(paymentId, signature)).to.emit(
                    consumerContract,
                    "LoyaltyPaymentEvent"
                );

                const newBalance1 = await ledgerContract.pointBalanceOf(userWallets[purchase.userIndex].address);
                expect(newBalance1.toString()).to.deep.equal(oldBalance.toString());

                await expect(consumerContract.connect(relay).closeCancelLoyaltyPayment(paymentId, true)).to.emit(
                    consumerContract,
                    "LoyaltyPaymentEvent"
                );

                const newBalance2 = await ledgerContract.pointBalanceOf(userWallets[purchase.userIndex].address);
                expect(newBalance2.toString()).to.deep.equal((oldBalance + purchaseAmount + feeAmount).toString());
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

                const paymentId = ContractUtils.getPaymentId(userWallets[purchase.userIndex].address);
                const purchaseAmount = Amount.make(purchase.amount, 18).value;
                const shop = shopData[purchase.shopIndex];
                const nonce = await ledgerContract.nonceOf(userWallets[purchase.userIndex].address);
                const signature = await ContractUtils.signLoyaltyNewPayment(
                    userWallets[purchase.userIndex],
                    paymentId,
                    purchase.purchaseId,
                    purchaseAmount,
                    purchase.currency,
                    shop.shopId,
                    nonce
                );
                await expect(
                    consumerContract.connect(relay).openNewLoyaltyPayment({
                        paymentId,
                        purchaseId: purchase.purchaseId,
                        amount: purchaseAmount,
                        currency: purchase.currency.toLowerCase(),
                        shopId: shop.shopId,
                        account: userWallets[purchase.userIndex + 1].address,
                        signature,
                    })
                ).to.be.revertedWith("1501");
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

                const paymentId = ContractUtils.getPaymentId(userWallets[purchase.userIndex].address);
                const purchaseAmount = Amount.make(purchase.amount, 18).value;
                const shop = shopData[purchase.shopIndex];
                const nonce = await ledgerContract.nonceOf(userWallets[purchase.userIndex].address);
                const signature = await ContractUtils.signLoyaltyNewPayment(
                    userWallets[purchase.userIndex],
                    paymentId,
                    purchase.purchaseId,
                    purchaseAmount,
                    purchase.currency,
                    shop.shopId,
                    nonce
                );
                await expect(
                    consumerContract.connect(relay).openNewLoyaltyPayment({
                        paymentId,
                        purchaseId: purchase.purchaseId,
                        amount: purchaseAmount,
                        currency: purchase.currency.toLowerCase(),
                        shopId: shop.shopId,
                        account: userWallets[purchase.userIndex].address,
                        signature,
                    })
                ).to.be.revertedWith("1511");
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

                const paymentId = ContractUtils.getPaymentId(userWallets[purchase.userIndex].address);
                const purchaseAmount = Amount.make(purchase.amount, 18).value;
                const tokenAmount = (purchaseAmount * multiple) / price;
                const oldFoundationTokenBalance = await ledgerContract.tokenBalanceOf(foundation.address);
                const shop = shopData[purchase.shopIndex];
                const nonce = await ledgerContract.nonceOf(userWallets[purchase.userIndex].address);
                const signature = await ContractUtils.signLoyaltyNewPayment(
                    userWallets[purchase.userIndex],
                    paymentId,
                    purchase.purchaseId,
                    purchaseAmount,
                    purchase.currency,
                    shop.shopId,
                    nonce
                );
                const feeRate = await ledgerContract.getFee();
                const feeAmount = (purchaseAmount * feeRate) / 100n;
                const feeToken = (feeAmount * multiple) / price;
                const oldFeeBalance = await ledgerContract.tokenBalanceOf(fee.address);
                await expect(
                    consumerContract.connect(relay).openNewLoyaltyPayment({
                        paymentId,
                        purchaseId: purchase.purchaseId,
                        amount: purchaseAmount,
                        currency: purchase.currency.toLowerCase(),
                        shopId: shop.shopId,
                        account: userWallets[purchase.userIndex].address,
                        signature,
                    })
                ).to.emit(consumerContract, "LoyaltyPaymentEvent");
                expect(await ledgerContract.tokenBalanceOf(foundation.address)).to.deep.equal(
                    oldFoundationTokenBalance
                );

                const paymentData = await consumerContract.loyaltyPaymentOf(paymentId);
                expect(paymentData.paymentId).to.deep.equal(paymentId);
                expect(paymentData.purchaseId).to.deep.equal(purchase.purchaseId);
                expect(paymentData.currency).to.deep.equal(purchase.currency);
                expect(paymentData.shopId).to.deep.equal(shop.shopId);
                expect(paymentData.account).to.deep.equal(userWallets[purchase.userIndex].address);
                expect(paymentData.loyaltyType).to.deep.equal(1);
                expect(paymentData.paidToken).to.deep.equal(tokenAmount);
                expect(paymentData.paidValue).to.deep.equal(purchaseAmount);
                expect(paymentData.feeToken).to.deep.equal(feeToken);
                expect(paymentData.feeValue).to.deep.equal(feeAmount);

                await expect(consumerContract.connect(relay).closeNewLoyaltyPayment(paymentId, true)).to.emit(
                    consumerContract,
                    "LoyaltyPaymentEvent"
                );

                expect(await ledgerContract.tokenBalanceOf(foundation.address)).to.deep.equal(
                    oldFoundationTokenBalance + tokenAmount
                );
                const newFeeBalance = await ledgerContract.tokenBalanceOf(fee.address);
                expect(newFeeBalance).to.deep.equal(oldFeeBalance + feeToken);
            });
        });

        context("Pay Loyalty Token", async () => {
            const purchase: IPurchaseData = {
                purchaseId: "P000000",
                timestamp: 1672849000,
                amount: 100,
                method: 0,
                currency: "krw",
                shopIndex: 0,
                userIndex: 1,
            };

            const paymentId = ContractUtils.getPaymentId(userWallets[purchase.userIndex].address);
            const purchaseAmount = Amount.make(purchase.amount, 18).value;
            const tokenAmount = (purchaseAmount * multiple) / price;
            const shop = shopData[purchase.shopIndex];
            let oldFoundationTokenBalance: bigint = 0n;
            let feeAmount: bigint = 0n;
            let feeToken: bigint = 0n;

            it("Pay", async () => {
                oldFoundationTokenBalance = await ledgerContract.tokenBalanceOf(foundation.address);
                feeAmount = (purchaseAmount * (await ledgerContract.getFee())) / 100n;
                feeToken = (feeAmount * multiple) / price;

                const nonce = await ledgerContract.nonceOf(userWallets[purchase.userIndex].address);
                const signature = await ContractUtils.signLoyaltyNewPayment(
                    userWallets[purchase.userIndex],
                    paymentId,
                    purchase.purchaseId,
                    purchaseAmount,
                    purchase.currency,
                    shop.shopId,
                    nonce
                );
                const oldBalance = await ledgerContract.tokenBalanceOf(userWallets[purchase.userIndex].address);
                const oldFeeBalance = await ledgerContract.tokenBalanceOf(fee.address);
                await expect(
                    consumerContract.connect(relay).openNewLoyaltyPayment({
                        paymentId,
                        purchaseId: purchase.purchaseId,
                        amount: purchaseAmount,
                        currency: purchase.currency.toLowerCase(),
                        shopId: shop.shopId,
                        account: userWallets[purchase.userIndex].address,
                        signature,
                    })
                ).to.emit(consumerContract, "LoyaltyPaymentEvent");
                expect(await ledgerContract.tokenBalanceOf(foundation.address)).to.deep.equal(
                    oldFoundationTokenBalance
                );
                const newFeeBalance = await ledgerContract.tokenBalanceOf(fee.address);
                expect(newFeeBalance).to.deep.equal(oldFeeBalance);

                const paymentData = await consumerContract.loyaltyPaymentOf(paymentId);
                expect(paymentData.paymentId).to.deep.equal(paymentId);
                expect(paymentData.purchaseId).to.deep.equal(purchase.purchaseId);
                expect(paymentData.currency).to.deep.equal(purchase.currency);
                expect(paymentData.shopId).to.deep.equal(shop.shopId);
                expect(paymentData.account).to.deep.equal(userWallets[purchase.userIndex].address);
                expect(paymentData.loyaltyType).to.deep.equal(1);
                expect(paymentData.paidToken).to.deep.equal(tokenAmount);
                expect(paymentData.paidValue).to.deep.equal(purchaseAmount);
                expect(paymentData.feeToken).to.deep.equal(feeToken);
                expect(paymentData.feeValue).to.deep.equal(feeAmount);

                const newFeeBalance1 = await ledgerContract.tokenBalanceOf(fee.address);
                expect(newFeeBalance1.toString()).to.deep.equal(oldFeeBalance.toString());

                const newBalance1 = await ledgerContract.tokenBalanceOf(userWallets[purchase.userIndex].address);
                expect(newBalance1.toString()).to.deep.equal((oldBalance - tokenAmount - feeToken).toString());

                await expect(consumerContract.connect(relay).closeNewLoyaltyPayment(paymentId, true)).to.emit(
                    consumerContract,
                    "LoyaltyPaymentEvent"
                );

                expect(await ledgerContract.tokenBalanceOf(foundation.address)).to.deep.equal(
                    oldFoundationTokenBalance + tokenAmount
                );

                expect(await ledgerContract.tokenBalanceOf(fee.address)).to.deep.equal(oldFeeBalance + feeToken);
                const newBalance2 = await ledgerContract.tokenBalanceOf(userWallets[purchase.userIndex].address);
                expect(newBalance2).to.deep.equal(oldBalance - tokenAmount - feeToken);
            });

            it("Cancel", async () => {
                oldFoundationTokenBalance = await ledgerContract.tokenBalanceOf(foundation.address);
                const oldFeeBalance = await ledgerContract.tokenBalanceOf(fee.address);

                const oldBalance = await ledgerContract.tokenBalanceOf(userWallets[purchase.userIndex].address);
                const nonce = await ledgerContract.nonceOf(shopWallets[purchase.shopIndex].address);
                const signature = await ContractUtils.signLoyaltyCancelPayment(
                    shopWallets[purchase.shopIndex],
                    paymentId,
                    purchase.purchaseId,
                    nonce
                );

                await expect(consumerContract.connect(relay).openCancelLoyaltyPayment(paymentId, signature)).to.emit(
                    consumerContract,
                    "LoyaltyPaymentEvent"
                );

                const newBalance1 = await ledgerContract.tokenBalanceOf(userWallets[purchase.userIndex].address);
                expect(newBalance1.toString()).to.deep.equal(oldBalance.toString());

                await expect(consumerContract.connect(relay).closeCancelLoyaltyPayment(paymentId, true)).to.emit(
                    consumerContract,
                    "LoyaltyPaymentEvent"
                );

                expect(await ledgerContract.tokenBalanceOf(foundation.address)).to.deep.equal(
                    oldFoundationTokenBalance - tokenAmount
                );
                expect(await ledgerContract.tokenBalanceOf(fee.address)).to.deep.equal(oldFeeBalance - feeToken);
                const newBalance2 = await ledgerContract.tokenBalanceOf(userWallets[purchase.userIndex].address);
                expect(newBalance2).to.deep.equal(oldBalance + tokenAmount + feeToken);
            });
        });
    });
    /*
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
                currency: "krw",
                provideWaitTime: 0n,
                providePercent: 5n,
                wallet: shopWallets[0],
            },
            {
                shopId: "",
                name: "Shop2",
                currency: "krw",
                provideWaitTime: 0n,
                providePercent: 6n,
                wallet: shopWallets[1],
            },
            {
                shopId: "",
                name: "Shop3",
                currency: "krw",
                provideWaitTime: 0n,
                providePercent: 7n,
                wallet: shopWallets[2],
            },
            {
                shopId: "",
                name: "Shop4",
                currency: "krw",
                provideWaitTime: 0n,
                providePercent: 8n,
                wallet: shopWallets[3],
            },
            {
                shopId: "",
                name: "Shop5",
                currency: "krw",
                provideWaitTime: 0n,
                providePercent: 9n,
                wallet: shopWallets[4],
            },
            {
                shopId: "",
                name: "Shop6",
                currency: "krw",
                provideWaitTime: 0n,
                providePercent: 10n,
                wallet: shopWallets[5],
            },
        ];

        before("Set Shop ID", async () => {
            for (const elem of shopData) {
                elem.shopId = ContractUtils.getShopId(elem.wallet.address);
            }
        });

        before("Deploy", async () => {
            await deployAllContract(shopData);
        });

        context("Deposit token", () => {
            it("Change Loyalty type of user", async () => {
                const nonce = await ledgerContract.nonceOf(userWallets[0].address);
                const signature = await ContractUtils.signLoyaltyType(userWallets[0], nonce);

                await exchangerContract.connect(relay).changeToLoyaltyToken(userWallets[0].address, signature);
            });

            it("Deposit token - Success", async () => {
                const oldTokenBalance = await ledgerContract.tokenBalanceOf(userWallets[0].address);
                await tokenContract.connect(userWallets[0]).approve(await ledgerContract.getAddress(), amount.value);
                await expect(ledgerContract.connect(userWallets[0]).deposit(amount.value)).to.emit(
                    ledgerContract,
                    "Deposited"
                );
                expect(await ledgerContract.tokenBalanceOf(userWallets[0].address)).to.deep.equal(
                    oldTokenBalance + amount.value
                );
            });
        });

        context("Withdraw token", () => {
            it("Withdraw token - Insufficient balance", async () => {
                const oldTokenBalance = await ledgerContract.tokenBalanceOf(userWallets[0].address);
                await expect(ledgerContract.connect(userWallets[0]).withdraw(oldTokenBalance + 1n)).to.revertedWith(
                    "1511"
                );
            });

            it("Withdraw token - Success", async () => {
                const oldTokenBalance = await ledgerContract.tokenBalanceOf(userWallets[0].address);
                await expect(ledgerContract.connect(userWallets[0]).withdraw(amount.value)).to.emit(
                    ledgerContract,
                    "Withdrawn"
                );
                expect(await ledgerContract.tokenBalanceOf(userWallets[0].address)).to.deep.equal(
                    oldTokenBalance - amount.value
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
                currency: "krw",
                provideWaitTime: 0n,
                providePercent: 1n,
                wallet: shopWallets[0],
            },
            {
                shopId: "F000200",
                name: "Shop2",
                currency: "krw",
                provideWaitTime: 0n,
                providePercent: 1n,
                wallet: shopWallets[1],
            },
            {
                shopId: "F000300",
                name: "Shop3",
                currency: "krw",
                provideWaitTime: 0n,
                providePercent: 1n,
                wallet: shopWallets[2],
            },
            {
                shopId: "F000400",
                name: "Shop4",
                currency: "krw",
                provideWaitTime: 0n,
                providePercent: 1n,
                wallet: shopWallets[3],
            },
            {
                shopId: "F000500",
                name: "Shop5",
                currency: "krw",
                provideWaitTime: 0n,
                providePercent: 1n,
                wallet: shopWallets[4],
            },
            {
                shopId: "F000600",
                name: "Shop6",
                currency: "krw",
                provideWaitTime: 0n,
                providePercent: 1n,
                wallet: shopWallets[5],
            },
        ];

        before("Set Shop ID", async () => {
            for (const elem of shopData) {
                elem.shopId = ContractUtils.getShopId(elem.wallet.address);
            }
        });

        before("Deploy", async () => {
            await deployAllContract(shopData);
        });

        context("Save Purchase Data", () => {
            it("Save Purchase Data", async () => {
                for (const purchase of purchaseData) {
                    const phoneHash = ContractUtils.getPhoneHash(userData[purchase.userIndex].phone);
                    const purchaseAmount = Amount.make(purchase.amount, 18).value;
                    const shop = shopData[purchase.shopIndex];
                    const amt = (purchaseAmount * shop.providePercent) / 100n;
                    const userAccount =
                        userData[purchase.userIndex].address.trim() !== ""
                            ? userData[purchase.userIndex].address.trim()
                            : AddressZero;
                    await expect(
                        providerContract.connect(validatorWallets[0]).savePurchase({
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
                        .to.emit(providerContract, "SavedPurchase")
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
                        .emit(ledgerContract, "ProvidedPoint");
                }
            });

            it("Check balances", async () => {
                const expected: Map<string, bigint> = new Map<string, bigint>();
                for (const purchase of purchaseData) {
                    const purchaseAmount = Amount.make(purchase.amount, 18).value;
                    const key =
                        userData[purchase.userIndex].address.trim() !== ""
                            ? userData[purchase.userIndex].address.trim()
                            : ContractUtils.getPhoneHash(userData[purchase.userIndex].phone.trim());
                    const oldValue = expected.get(key);

                    const shop = shopData[purchase.shopIndex];
                    const point = (purchaseAmount * shop.providePercent) / 100n;

                    if (oldValue !== undefined) expected.set(key, oldValue + point);
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
                const shopInfo1 = await shopContract.shopOf(shopData[0].shopId);
                expect(shopInfo1.providedAmount).to.equal(
                    (Amount.make(10000 * 3, 18).value * shopData[0].providePercent) / 100n
                );

                const shopInfo2 = await shopContract.shopOf(shopData[1].shopId);
                expect(shopInfo2.providedAmount).to.equal(
                    (Amount.make(10000 * 1, 18).value * shopData[1].providePercent) / 100n
                );
                const shopInfo3 = await shopContract.shopOf(shopData[2].shopId);
                expect(shopInfo3.providedAmount).to.equal(
                    (Amount.make(10000 * 1, 18).value * shopData[2].providePercent) / 100n
                );
                const shopInfo4 = await shopContract.shopOf(shopData[3].shopId);
                expect(shopInfo4.providedAmount).to.equal(
                    (Amount.make(10000 * 1, 18).value * shopData[3].providePercent) / 100n
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

                const paymentId = ContractUtils.getPaymentId(userWallets[purchase.userIndex].address);
                const purchaseAmount = Amount.make(purchase.amount, 18).value;
                const shop = shopData[purchase.shopIndex];
                const nonce = await ledgerContract.nonceOf(userWallets[purchase.userIndex].address);
                const signature = await ContractUtils.signLoyaltyNewPayment(
                    userWallets[purchase.userIndex],
                    paymentId,
                    purchase.purchaseId,
                    purchaseAmount,
                    purchase.currency,
                    shop.shopId,
                    nonce
                );

                const amt = (purchaseAmount * shop.providePercent) / 100n;
                await expect(
                    consumerContract.connect(relay).openNewLoyaltyPayment({
                        paymentId,
                        purchaseId: purchase.purchaseId,
                        amount: purchaseAmount,
                        currency: purchase.currency.toLowerCase(),
                        shopId: shop.shopId,
                        account: userWallets[purchase.userIndex].address,
                        signature,
                    })
                ).to.emit(consumerContract, "LoyaltyPaymentEvent");

                await expect(consumerContract.connect(relay).closeNewLoyaltyPayment(paymentId, true))
                    .to.emit(consumerContract, "LoyaltyPaymentEvent")
                    .to.emit(ledgerContract, "ProvidedTokenForSettlement");

                const shopInfo = await shopContract.shopOf(shop.shopId);
                expect(shopInfo.providedAmount).to.equal(Amount.make(100, 18).value);
                expect(shopInfo.usedAmount).to.equal(Amount.make(300, 18).value);
                expect(shopInfo.settledAmount).to.equal(Amount.make(200, 18).value);
            });
        });

        context("Change Loyalty Type", () => {
            it("Change Loyalty Type (user: 0)", async () => {
                const userIndex = 0;

                const nonce = await ledgerContract.nonceOf(userWallets[userIndex].address);
                const signature = await ContractUtils.signLoyaltyType(userWallets[userIndex], nonce);
                await expect(
                    exchangerContract.connect(relay).changeToLoyaltyToken(userWallets[userIndex].address, signature)
                ).to.emit(ledgerContract, "ChangedToLoyaltyToken");
            });
        });

        context("Deposit token", () => {
            it("Deposit token - Success", async () => {
                const userIndex = 0;
                const oldTokenBalance = await ledgerContract.tokenBalanceOf(userWallets[userIndex].address);
                await tokenContract
                    .connect(userWallets[userIndex])
                    .approve(await ledgerContract.getAddress(), amount.value);
                await expect(ledgerContract.connect(userWallets[userIndex]).deposit(amount.value)).to.emit(
                    ledgerContract,
                    "Deposited"
                );
                expect(await ledgerContract.tokenBalanceOf(userWallets[userIndex].address)).to.deep.equal(
                    oldTokenBalance + amount.value
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

                const paymentId = ContractUtils.getPaymentId(userWallets[purchase.userIndex].address);
                const purchaseAmount = Amount.make(purchase.amount, 18).value;
                const tokenAmount = (purchaseAmount * multiple) / price;
                const oldFoundationTokenBalance = await ledgerContract.tokenBalanceOf(foundation.address);
                const shop = shopData[purchase.shopIndex];
                const nonce = await ledgerContract.nonceOf(userWallets[purchase.userIndex].address);
                const signature = await ContractUtils.signLoyaltyNewPayment(
                    userWallets[purchase.userIndex],
                    paymentId,
                    purchase.purchaseId,
                    purchaseAmount,
                    purchase.currency,
                    shop.shopId,
                    nonce
                );

                await expect(
                    consumerContract.connect(relay).openNewLoyaltyPayment({
                        paymentId,
                        purchaseId: purchase.purchaseId,
                        amount: purchaseAmount,
                        currency: purchase.currency.toLowerCase(),
                        shopId: shop.shopId,
                        account: userWallets[purchase.userIndex].address,
                        signature,
                    })
                ).to.emit(consumerContract, "LoyaltyPaymentEvent");

                await expect(consumerContract.connect(relay).closeNewLoyaltyPayment(paymentId, true)).to.emit(
                    consumerContract,
                    "LoyaltyPaymentEvent"
                );

                const shopInfo2 = await shopContract.shopOf(shop.shopId);
                expect(shopInfo2.providedAmount).to.equal(Amount.make(100, 18).value);
                expect(shopInfo2.usedAmount).to.equal(Amount.make(500, 18).value);
                expect(shopInfo2.settledAmount).to.equal(Amount.make(400, 18).value);

                const settledToken = (shopInfo2.settledAmount * multiple) / price;
                expect(await ledgerContract.tokenBalanceOf(foundation.address)).to.deep.equal(
                    oldFoundationTokenBalance + tokenAmount - settledToken
                );
            });
        });

        context("Withdrawal of settlement", () => {
            const shopIndex = 2;
            const shop = shopData[shopIndex];
            const amount2 = Amount.make(400, 18).value;
            it("Check Settlement", async () => {
                const withdrawalAmount = await shopContract.withdrawableOf(shop.shopId);
                expect(withdrawalAmount).to.equal(amount2);
            });

            it("Open Withdrawal", async () => {
                const nonce = await shopContract.nonceOf(shopData[shopIndex].wallet.address);
                const signature = await ContractUtils.signShop(
                    shopData[shopIndex].wallet,
                    shopData[shopIndex].shopId,
                    nonce
                );
                await expect(
                    shopContract
                        .connect(shopData[shopIndex].wallet)
                        .openWithdrawal(shop.shopId, amount2, shopData[shopIndex].wallet.address, signature)
                ).to.emit(shopContract, "OpenedWithdrawal");
                const withdrawalAmount = await shopContract.withdrawableOf(shop.shopId);
                expect(withdrawalAmount).to.equal(amount2);
            });

            it("Close Withdrawal", async () => {
                const nonce = await shopContract.nonceOf(shopData[shopIndex].wallet.address);
                const signature = await ContractUtils.signShop(
                    shopData[shopIndex].wallet,
                    shopData[shopIndex].shopId,
                    nonce
                );
                await expect(
                    shopContract
                        .connect(shopData[shopIndex].wallet)
                        .closeWithdrawal(shop.shopId, shopData[shopIndex].wallet.address, signature)
                ).to.emit(shopContract, "ClosedWithdrawal");
                const withdrawalAmount = await shopContract.withdrawableOf(shop.shopId);
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
                currency: "krw",
                provideWaitTime: 0n,
                providePercent: 1n,
                wallet: shopWallets[0],
            },
            {
                shopId: "F000200",
                name: "Shop2",
                currency: "krw",
                provideWaitTime: 0n,
                providePercent: 1n,
                wallet: shopWallets[1],
            },
            {
                shopId: "F000300",
                name: "Shop3",
                currency: "krw",
                provideWaitTime: 0n,
                providePercent: 1n,
                wallet: shopWallets[2],
            },
            {
                shopId: "F000400",
                name: "Shop4",
                currency: "krw",
                provideWaitTime: 0n,
                providePercent: 1n,
                wallet: shopWallets[3],
            },
            {
                shopId: "F000500",
                name: "Shop5",
                currency: "krw",
                provideWaitTime: 0n,
                providePercent: 1n,
                wallet: shopWallets[4],
            },
            {
                shopId: "F000600",
                name: "Shop6",
                currency: "krw",
                provideWaitTime: 0n,
                providePercent: 1n,
                wallet: shopWallets[5],
            },
        ];

        before("Set Shop ID", async () => {
            for (const elem of shopData) {
                elem.shopId = ContractUtils.getShopId(elem.wallet.address);
            }
        });

        before("Deploy", async () => {
            await deployAllContract(shopData);
        });

        before("Set Other Currency", async () => {
            await currencyContract.connect(validatorWallets[0]).set("usd", 3n * multiple);
            await currencyContract.connect(validatorWallets[0]).set("jpy", 2n * multiple);
            await currencyContract.connect(validatorWallets[0]).set("cny", 1n * multiple);
            await currencyContract.connect(validatorWallets[0]).set("krw", 1n * multiple);
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
                    const rate = await currencyContract.get(currency);
                    const loyaltyPoint = (((purchaseAmount * rate) / multiple) * shop.providePercent) / 100n;
                    const loyaltyValue = (purchaseAmount * shop.providePercent) / 100n;
                    await expect(
                        providerContract.connect(validatorWallets[0]).savePurchase({
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
                        .to.emit(providerContract, "SavedPurchase")
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
                        .emit(ledgerContract, "ProvidedPoint");
                }
            });

            it("Check balances", async () => {
                const expected: Map<string, bigint> = new Map<string, bigint>();
                for (const purchase of purchaseData) {
                    const purchaseAmount = Amount.make(purchase.amount, 18).value;
                    const key =
                        userData[purchase.userIndex].address.trim() !== ""
                            ? userData[purchase.userIndex].address.trim()
                            : ContractUtils.getPhoneHash(userData[purchase.userIndex].phone.trim());
                    const oldValue = expected.get(key);

                    const rate = await currencyContract.get(purchase.currency.toLowerCase());
                    const shop = shopData[purchase.shopIndex];
                    const point = (((purchaseAmount * rate) / multiple) * shop.providePercent) / 100n;

                    if (oldValue !== undefined) expected.set(key, oldValue + point);
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
                const shopInfo1 = await shopContract.shopOf(shopData[0].shopId);
                expect(shopInfo1.providedAmount).to.equal(
                    (Amount.make(10000 * 6, 18).value * shopData[0].providePercent) / 100n
                );

                const shopInfo2 = await shopContract.shopOf(shopData[1].shopId);
                expect(shopInfo2.providedAmount).to.equal(
                    (Amount.make(10000 * 1, 18).value * shopData[1].providePercent) / 100n
                );
                const shopInfo3 = await shopContract.shopOf(shopData[2].shopId);
                expect(shopInfo3.providedAmount).to.equal(
                    (Amount.make(10000 * 1, 18).value * shopData[2].providePercent) / 100n
                );
                const shopInfo4 = await shopContract.shopOf(shopData[3].shopId);
                expect(shopInfo4.providedAmount).to.equal(
                    (Amount.make(10000 * 1, 18).value * shopData[3].providePercent) / 100n
                );
            });
        });
    });

    context("Clearing for shops - Multi Currency", () => {
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
                shopIndex: 1,
                userIndex: 0,
            },
            {
                purchaseId: "P000003",
                timestamp: 1677942000,
                amount: 10000,
                method: 0,
                currency: "krw",
                shopIndex: 2,
                userIndex: 0,
            },
        ];

        const shopData: IShopData[] = [
            {
                shopId: "F000100",
                name: "Shop1",
                currency: "krw",
                provideWaitTime: 0n,
                providePercent: 1n,
                wallet: shopWallets[0],
            },
            {
                shopId: "F000200",
                name: "Shop2",
                currency: "usd",
                provideWaitTime: 0n,
                providePercent: 1n,
                wallet: shopWallets[1],
            },
            {
                shopId: "F000300",
                name: "Shop3",
                currency: "jpy",
                provideWaitTime: 0n,
                providePercent: 1n,
                wallet: shopWallets[2],
            },
            {
                shopId: "F000400",
                name: "Shop4",
                currency: "usd",
                provideWaitTime: 0n,
                providePercent: 1n,
                wallet: shopWallets[3],
            },
        ];

        before("Set Shop ID", async () => {
            for (const elem of shopData) {
                elem.shopId = ContractUtils.getShopId(elem.wallet.address);
            }
        });

        before("Deploy", async () => {
            await deployToken();
            await deployValidator();
            await depositValidators();
            await deployLinkCollection();
            await deployCurrencyRate();
            const symbol = await tokenContract.symbol();
            let rate = 100n * multiple;
            await expect(currencyContract.connect(validatorWallets[0]).set(symbol, rate)).to.emit(
                currencyContract,
                "SetRate"
            );
            rate = 1000n * multiple;
            await expect(currencyContract.connect(validatorWallets[0]).set("usd", rate)).to.emit(
                currencyContract,
                "SetRate"
            );

            rate = 10n * multiple;
            await expect(currencyContract.connect(validatorWallets[0]).set("jpy", rate)).to.emit(
                currencyContract,
                "SetRate"
            );
            await deployCertifier();
            await deployProvider();
            await deployConsumer();
            await deployExchanger();
            await deployShopCollection();
            await deployLedger();
            await addShopData(shopData);
            await prepareToken();
        });

        context("Save Purchase Data", () => {
            it("Save Purchase Data", async () => {
                for (const purchase of purchaseData) {
                    const phoneHash = ContractUtils.getPhoneHash(userData[purchase.userIndex].phone);
                    const purchaseAmount = Amount.make(purchase.amount, 18).value;
                    const shop = shopData[purchase.shopIndex];
                    const amt = (purchaseAmount * shop.providePercent) / 100n;
                    const userAccount = userData[purchase.userIndex].address.trim();
                    await expect(
                        providerContract.connect(validatorWallets[0]).savePurchase({
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
                        .to.emit(providerContract, "SavedPurchase")
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
                        .emit(ledgerContract, "ProvidedPoint");
                }
            });

            it("Check balances", async () => {
                const expected: Map<string, bigint> = new Map<string, bigint>();
                for (const purchase of purchaseData) {
                    const purchaseAmount = Amount.make(purchase.amount, 18).value;
                    const key =
                        userData[purchase.userIndex].address.trim() !== ""
                            ? userData[purchase.userIndex].address.trim()
                            : ContractUtils.getPhoneHash(userData[purchase.userIndex].phone.trim());
                    const oldValue = expected.get(key);

                    const shop = shopData[purchase.shopIndex];
                    const point = (purchaseAmount * shop.providePercent) / 100n;

                    if (oldValue !== undefined) expected.set(key, oldValue + point);
                    else expected.set(key, point);
                }
                for (const key of expected.keys()) {
                    expect(await ledgerContract.pointBalanceOf(key)).to.deep.equal(expected.get(key));
                }
            });

            it("Check shop data", async () => {
                for (let idx = 0; idx < 3; idx++) {
                    const shop = shopData[idx];
                    const shopInfo1 = await shopContract.shopOf(shop.shopId);
                    const rate = await currencyContract.get(shop.currency);
                    const providedAmount = (Amount.make(10000, 18).value * shopData[0].providePercent) / 100n;
                    const exchangedAmount = (providedAmount * multiple) / rate;
                    expect(shopInfo1.providedAmount).to.equal(exchangedAmount);
                }
            });
        });

        context("Pay point", () => {
            it("Pay point - Success", async () => {
                const purchase = {
                    purchaseId: "P000100",
                    timestamp: 1672849000,
                    amount: 100,
                    method: 0,
                    currency: "krw",
                    shopIndex: 3,
                    userIndex: 0,
                };

                const paymentId = ContractUtils.getPaymentId(userWallets[purchase.userIndex].address);
                const purchaseAmount = Amount.make(purchase.amount, 18).value;
                const shop = shopData[purchase.shopIndex];
                const nonce = await ledgerContract.nonceOf(userWallets[purchase.userIndex].address);
                const signature = await ContractUtils.signLoyaltyNewPayment(
                    userWallets[purchase.userIndex],
                    paymentId,
                    purchase.purchaseId,
                    purchaseAmount,
                    purchase.currency,
                    shop.shopId,
                    nonce
                );

                await expect(
                    consumerContract.connect(relay).openNewLoyaltyPayment({
                        paymentId,
                        purchaseId: purchase.purchaseId,
                        amount: purchaseAmount,
                        currency: purchase.currency.toLowerCase(),
                        shopId: shop.shopId,
                        account: userWallets[purchase.userIndex].address,
                        signature,
                    })
                ).to.emit(consumerContract, "LoyaltyPaymentEvent");

                await expect(consumerContract.connect(relay).closeNewLoyaltyPayment(paymentId, true))
                    .to.emit(consumerContract, "LoyaltyPaymentEvent")
                    .to.emit(ledgerContract, "ProvidedTokenForSettlement");

                const rate = await currencyContract.get(shop.currency);
                const shopInfo = await shopContract.shopOf(shop.shopId);
                expect(shopInfo.providedAmount).to.equal(Amount.make(0, 18).value);
                expect(shopInfo.usedAmount).to.equal((Amount.make(100, 18).value * multiple) / rate);
                expect(shopInfo.settledAmount).to.equal((Amount.make(100, 18).value * multiple) / rate);
            });
        });

        context("Change Loyalty Type", () => {
            it("Change Loyalty Type (user: 0)", async () => {
                const userIndex = 0;

                const nonce = await ledgerContract.nonceOf(userWallets[userIndex].address);
                const signature = await ContractUtils.signLoyaltyType(userWallets[userIndex], nonce);
                await expect(
                    exchangerContract.connect(relay).changeToLoyaltyToken(userWallets[userIndex].address, signature)
                ).to.emit(exchangerContract, "ChangedToLoyaltyToken");
            });
        });

        context("Deposit token", () => {
            it("Deposit token - Success", async () => {
                const userIndex = 0;
                const oldTokenBalance = await ledgerContract.tokenBalanceOf(userWallets[userIndex].address);
                await tokenContract
                    .connect(userWallets[userIndex])
                    .approve(await ledgerContract.getAddress(), amount.value);
                await expect(ledgerContract.connect(userWallets[userIndex]).deposit(amount.value)).to.emit(
                    ledgerContract,
                    "Deposited"
                );
                expect(await ledgerContract.tokenBalanceOf(userWallets[userIndex].address)).to.deep.equal(
                    oldTokenBalance + amount.value
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

                const paymentId = ContractUtils.getPaymentId(userWallets[purchase.userIndex].address);
                const purchaseAmount = Amount.make(purchase.amount, 18).value;
                const shop = shopData[purchase.shopIndex];
                const nonce = await ledgerContract.nonceOf(userWallets[purchase.userIndex].address);
                const signature = await ContractUtils.signLoyaltyNewPayment(
                    userWallets[purchase.userIndex],
                    paymentId,
                    purchase.purchaseId,
                    purchaseAmount,
                    purchase.currency,
                    shop.shopId,
                    nonce
                );

                await expect(
                    consumerContract.connect(relay).openNewLoyaltyPayment({
                        paymentId,
                        purchaseId: purchase.purchaseId,
                        amount: purchaseAmount,
                        currency: purchase.currency.toLowerCase(),
                        shopId: shop.shopId,
                        account: userWallets[purchase.userIndex].address,
                        signature,
                    })
                ).to.emit(consumerContract, "LoyaltyPaymentEvent");

                await expect(consumerContract.connect(relay).closeNewLoyaltyPayment(paymentId, true)).to.emit(
                    consumerContract,
                    "LoyaltyPaymentEvent"
                );

                const rate = await currencyContract.get(shop.currency);
                const shopInfo2 = await shopContract.shopOf(shop.shopId);
                expect(shopInfo2.providedAmount).to.equal((Amount.make(100, 18).value * multiple) / rate);
                expect(shopInfo2.usedAmount).to.equal((Amount.make(500, 18).value * multiple) / rate);
                expect(shopInfo2.settledAmount).to.equal((Amount.make(400, 18).value * multiple) / rate);
            });
        });

        context("Withdrawal of settlement", () => {
            const shopIndex = 2;
            const shop = shopData[shopIndex];
            let rate: bigint;
            let amount2: bigint;
            it("Check Settlement", async () => {
                rate = await currencyContract.get(shop.currency);
                amount2 = (Amount.make(400, 18).value * multiple) / rate;
                const withdrawalAmount = await shopContract.withdrawableOf(shop.shopId);
                expect(withdrawalAmount).to.equal(amount2);
            });

            it("Open Withdrawal", async () => {
                const nonce = await shopContract.nonceOf(shopData[shopIndex].wallet.address);
                const signature = await ContractUtils.signShop(
                    shopData[shopIndex].wallet,
                    shopData[shopIndex].shopId,
                    nonce
                );
                await expect(
                    shopContract
                        .connect(shopData[shopIndex].wallet)
                        .openWithdrawal(shop.shopId, amount2, shopData[shopIndex].wallet.address, signature)
                ).to.emit(shopContract, "OpenedWithdrawal");
                const withdrawalAmount = await shopContract.withdrawableOf(shop.shopId);
                expect(withdrawalAmount).to.equal(amount2);
            });

            it("Close Withdrawal", async () => {
                const nonce = await shopContract.nonceOf(shopData[shopIndex].wallet.address);
                const signature = await ContractUtils.signShop(
                    shopData[shopIndex].wallet,
                    shopData[shopIndex].shopId,
                    nonce
                );
                await expect(
                    shopContract
                        .connect(shopData[shopIndex].wallet)
                        .closeWithdrawal(shop.shopId, shopData[shopIndex].wallet.address, signature)
                ).to.emit(shopContract, "ClosedWithdrawal");
                const withdrawalAmount = await shopContract.withdrawableOf(shop.shopId);
                expect(withdrawalAmount).to.equal(0);
            });
        });
    });
 */
});
