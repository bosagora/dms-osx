import "@nomiclabs/hardhat-ethers";
import "@nomiclabs/hardhat-waffle";
import "@openzeppelin/hardhat-upgrades";
import { ethers, upgrades, waffle } from "hardhat";

import { Amount } from "../src/utils/Amount";
import { ContractUtils } from "../src/utils/ContractUtils";
import {
    Certifier,
    CurrencyRate,
    Ledger,
    LoyaltyBurner,
    LoyaltyConsumer,
    LoyaltyExchanger,
    LoyaltyProvider,
    PhoneLinkCollection,
    Shop,
    Token,
    Validator,
} from "../typechain-types";

import assert from "assert";
import chai, { expect } from "chai";
import { solidity } from "ethereum-waffle";

import { BigNumber, Wallet } from "ethers";

import { AddressZero } from "@ethersproject/constants";

chai.use(solidity);

interface IPurchaseData {
    purchaseId: string;
    amount: number;
    providePercent: number;
    currency: string;
    userIndex: number;
    shopIndex: number;
}

interface IShopData {
    shopId: string;
    name: string;
    currency: string;
    wallet: Wallet;
}

interface IUserData {
    phone: string;
    address: string;
    privateKey: string;
}

describe("Test for Ledger", () => {
    const provider = waffle.provider;
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
    ] = provider.getWallets();

    const validatorWallets = [validator1, validator2, validator3];
    const validatorWallets2 = [validator1, validator3];
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
    let burnerContract: LoyaltyBurner;

    const multiple = BigNumber.from(1000000000);
    const price = BigNumber.from(150).mul(multiple);

    const amount = Amount.make(100_000, 18);
    const assetAmount = Amount.make(10_000_000, 18);

    const deployToken = async () => {
        const factory = await ethers.getContractFactory("Token");
        tokenContract = (await factory.connect(deployer).deploy(deployer.address, "Sample", "SAM")) as Token;
        await tokenContract.deployed();
        await tokenContract.deployTransaction.wait();
        for (const elem of validatorWallets) {
            await tokenContract.connect(deployer).transfer(elem.address, amount.value);
        }
    };

    const deployValidator = async () => {
        const factory = await ethers.getContractFactory("Validator");
        validatorContract = (await upgrades.deployProxy(
            factory.connect(deployer),
            [tokenContract.address, validatorWallets.map((m) => m.address)],
            {
                initializer: "initialize",
                kind: "uups",
            }
        )) as Validator;
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
        const factory = await ethers.getContractFactory("PhoneLinkCollection");
        linkContract = (await upgrades.deployProxy(factory.connect(deployer), [linkValidators.map((m) => m.address)], {
            initializer: "initialize",
            kind: "uups",
        })) as PhoneLinkCollection;
        await linkContract.deployed();
        await linkContract.deployTransaction.wait();
    };

    const deployCurrencyRate = async () => {
        const factory = await ethers.getContractFactory("CurrencyRate");
        currencyContract = (await upgrades.deployProxy(
            factory.connect(deployer),
            [validatorContract.address, await tokenContract.symbol()],
            {
                initializer: "initialize",
                kind: "uups",
            }
        )) as unknown as CurrencyRate;
        await currencyContract.deployed();
        await currencyContract.deployTransaction.wait();

        const height = ContractUtils.getTimeStamp();
        const rates = [
            {
                symbol: await tokenContract.symbol(),
                rate: price,
            },
        ];
        const message = ContractUtils.getCurrencyMessage(height, rates);
        const signatures = validatorWallets.map((m) => ContractUtils.signMessage(m, message));
        await currencyContract.connect(validatorWallets[0]).set(height, rates, signatures);
    };

    const deployCertifier = async () => {
        const factory = await ethers.getContractFactory("Certifier");
        certifierContract = (await upgrades.deployProxy(factory.connect(deployer), [certifier.address], {
            initializer: "initialize",
            kind: "uups",
        })) as unknown as Certifier;
        await certifierContract.deployed();
        await certifierContract.deployTransaction.wait();

        await certifierContract.connect(certifier).grantCertifier(relay.address);
    };

    const deployProvider = async () => {
        const factory = await ethers.getContractFactory("LoyaltyProvider");
        providerContract = (await upgrades.deployProxy(
            factory.connect(deployer),
            [validatorContract.address, linkContract.address, currencyContract.address],
            {
                initializer: "initialize",
                kind: "uups",
            }
        )) as unknown as LoyaltyProvider;
        await providerContract.deployed();
        await providerContract.deployTransaction.wait();
    };

    const deployConsumer = async () => {
        const factory = await ethers.getContractFactory("LoyaltyConsumer");
        consumerContract = (await upgrades.deployProxy(
            factory.connect(deployer),
            [certifierContract.address, currencyContract.address],
            {
                initializer: "initialize",
                kind: "uups",
            }
        )) as unknown as LoyaltyConsumer;
        await consumerContract.deployed();
        await consumerContract.deployTransaction.wait();
    };

    const deployExchanger = async () => {
        const factory = await ethers.getContractFactory("LoyaltyExchanger");
        exchangerContract = (await upgrades.deployProxy(
            factory.connect(deployer),
            [linkContract.address, currencyContract.address],
            {
                initializer: "initialize",
                kind: "uups",
            }
        )) as unknown as LoyaltyExchanger;
        await exchangerContract.deployed();
        await exchangerContract.deployTransaction.wait();
    };

    const deployBurner = async () => {
        const factory = await ethers.getContractFactory("LoyaltyBurner");
        burnerContract = (await upgrades.deployProxy(
            factory.connect(deployer),
            [validatorContract.address, linkContract.address],
            {
                initializer: "initialize",
                kind: "uups",
            }
        )) as unknown as LoyaltyBurner;
        await burnerContract.deployed();
        await burnerContract.deployTransaction.wait();
    };

    const deployShop = async () => {
        const factory = await ethers.getContractFactory("Shop");
        shopContract = (await upgrades.deployProxy(
            factory.connect(deployer),
            [certifierContract.address, currencyContract.address, providerContract.address, consumerContract.address],
            {
                initializer: "initialize",
                kind: "uups",
            }
        )) as unknown as Shop;
        await shopContract.deployed();
        await shopContract.deployTransaction.wait();
        await providerContract.connect(deployer).setShop(shopContract.address);
        await consumerContract.connect(deployer).setShop(shopContract.address);
    };

    const deployLedger = async () => {
        const factory = await ethers.getContractFactory("Ledger");
        ledgerContract = (await upgrades.deployProxy(
            factory.connect(deployer),
            [
                foundation.address,
                settlements.address,
                fee.address,
                tokenContract.address,
                linkContract.address,
                currencyContract.address,
                providerContract.address,
                consumerContract.address,
                exchangerContract.address,
                burnerContract.address,
            ],
            {
                initializer: "initialize",
                kind: "uups",
            }
        )) as unknown as Ledger;
        await shopContract.deployed();
        await shopContract.deployTransaction.wait();
        await providerContract.connect(deployer).setLedger(ledgerContract.address);
        await consumerContract.connect(deployer).setLedger(ledgerContract.address);
        await exchangerContract.connect(deployer).setLedger(ledgerContract.address);
    };

    const addShopData = async (shopData: IShopData[]) => {
        for (const elem of shopData) {
            const nonce = await shopContract.nonceOf(elem.wallet.address);
            const signature = await ContractUtils.signShop(elem.wallet, elem.shopId, nonce);
            await shopContract
                .connect(relay)
                .add(elem.shopId, elem.name, elem.currency, elem.wallet.address, signature);
        }
    };

    const prepareToken = async () => {
        for (const elem of userWallets) {
            await tokenContract.connect(deployer).transfer(elem.address, amount.value);
        }
        await tokenContract.connect(deployer).transfer(foundation.address, assetAmount.value);
        await tokenContract.connect(foundation).approve(ledgerContract.address, assetAmount.value);
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
        await deployBurner();
        await deployShop();
        await deployLedger();
        await addShopData(shopData);
        await prepareToken();
    };

    let purchaseId = 0;
    const getPurchaseId = (): string => {
        const res = "P" + purchaseId.toString().padStart(10, "0");
        purchaseId++;
        return res;
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
                purchaseId: getPurchaseId(),
                amount: 10000,
                providePercent: 5,
                currency: "krw",
                shopIndex: 0,
                userIndex: 0,
            },
            {
                purchaseId: getPurchaseId(),
                amount: 10000,
                providePercent: 5,
                currency: "krw",
                shopIndex: 0,
                userIndex: 1,
            },
            {
                purchaseId: getPurchaseId(),
                amount: 10000,
                providePercent: 6,
                currency: "krw",
                shopIndex: 1,
                userIndex: 2,
            },
            {
                purchaseId: getPurchaseId(),
                amount: 10000,
                providePercent: 7,
                currency: "krw",
                shopIndex: 2,
                userIndex: 3,
            },
            {
                purchaseId: getPurchaseId(),
                amount: 10000,
                providePercent: 6,
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
                wallet: shopWallets[0],
            },
            {
                shopId: "",
                name: "Shop2",
                currency: "krw",
                wallet: shopWallets[1],
            },
            {
                shopId: "",
                name: "Shop3",
                currency: "krw",
                wallet: shopWallets[2],
            },
            {
                shopId: "",
                name: "Shop4",
                currency: "krw",
                wallet: shopWallets[3],
            },
            {
                shopId: "",
                name: "Shop5",
                currency: "krw",
                wallet: shopWallets[4],
            },
            {
                shopId: "",
                name: "Shop6",
                currency: "krw",
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
                    const loyaltyAmount = purchaseAmount.mul(purchase.providePercent).div(100);
                    const userAccount =
                        userData[purchase.userIndex].address.trim() !== ""
                            ? userData[purchase.userIndex].address.trim()
                            : AddressZero;
                    const purchaseParam = {
                        purchaseId: getPurchaseId(),
                        amount: purchaseAmount,
                        loyalty: loyaltyAmount,
                        currency: purchase.currency.toLowerCase(),
                        shopId: shopData[purchase.shopIndex].shopId,
                        account: userAccount,
                        phone: phoneHash,
                    };
                    const purchaseMessage = ContractUtils.getPurchasesMessage(0, [purchaseParam]);
                    const signatures = validatorWallets2.map((m) => ContractUtils.signMessage(m, purchaseMessage));
                    await expect(
                        providerContract.connect(deployer).savePurchase(0, [purchaseParam], signatures)
                    ).to.be.revertedWith("1000");
                }
            });

            it("Save Purchase Data", async () => {
                for (const purchase of purchaseData) {
                    const phoneHash = ContractUtils.getPhoneHash(userData[purchase.userIndex].phone);
                    const purchaseAmount = Amount.make(purchase.amount, 18).value;
                    const loyaltyAmount = purchaseAmount.mul(purchase.providePercent).div(100);
                    const shop = shopData[purchase.shopIndex];
                    const amt = purchaseAmount.mul(purchase.providePercent).div(100);
                    const userAccount =
                        userData[purchase.userIndex].address.trim() !== ""
                            ? userData[purchase.userIndex].address.trim()
                            : AddressZero;
                    if (userAccount !== AddressZero) {
                        const purchaseParam = {
                            purchaseId: getPurchaseId(),
                            amount: purchaseAmount,
                            loyalty: loyaltyAmount,
                            currency: purchase.currency.toLowerCase(),
                            shopId: shopData[purchase.shopIndex].shopId,
                            account: userAccount,
                            phone: phoneHash,
                        };
                        const purchaseMessage = ContractUtils.getPurchasesMessage(0, [purchaseParam]);
                        const signatures = validatorWallets2.map((m) => ContractUtils.signMessage(m, purchaseMessage));
                        await expect(
                            providerContract.connect(validatorWallets[0]).savePurchase(0, [purchaseParam], signatures)
                        )
                            .to.emit(providerContract, "SavedPurchase")
                            .withArgs(
                                purchaseParam.purchaseId,
                                purchaseParam.amount,
                                purchaseParam.loyalty,
                                purchaseParam.currency,
                                purchaseParam.shopId,
                                purchaseParam.account,
                                purchaseParam.phone
                            )
                            .emit(ledgerContract, "ProvidedPoint")
                            .withNamedArgs({
                                account: userAccount,
                                providedPoint: amt,
                                providedValue: amt,
                                purchaseId: purchaseParam.purchaseId,
                            });
                    } else {
                        const purchaseParam = {
                            purchaseId: getPurchaseId(),
                            amount: purchaseAmount,
                            loyalty: loyaltyAmount,
                            currency: purchase.currency.toLowerCase(),
                            shopId: shopData[purchase.shopIndex].shopId,
                            account: userAccount,
                            phone: phoneHash,
                        };
                        const purchaseMessage = ContractUtils.getPurchasesMessage(0, [purchaseParam]);
                        const signatures = validatorWallets2.map((m) => ContractUtils.signMessage(m, purchaseMessage));
                        await expect(
                            providerContract.connect(validatorWallets[0]).savePurchase(0, [purchaseParam], signatures)
                        )
                            .to.emit(providerContract, "SavedPurchase")
                            .withArgs(
                                purchaseParam.purchaseId,
                                purchaseParam.amount,
                                purchaseParam.loyalty,
                                purchaseParam.currency,
                                purchaseParam.shopId,
                                purchaseParam.account,
                                purchaseParam.phone
                            )
                            .emit(ledgerContract, "ProvidedUnPayablePoint")
                            .withNamedArgs({
                                phone: phoneHash,
                                providedPoint: amt,
                                providedValue: amt,
                                purchaseId: purchaseParam.purchaseId,
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

                    const point = purchaseAmount.mul(purchase.providePercent).div(100);

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

            it("Save Purchase Data (user: 3, point type : 0) - phone and address are not registered", async () => {
                const purchase: IPurchaseData = {
                    purchaseId: getPurchaseId(),
                    amount: 10000,
                    providePercent: 6,
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
                const loyaltyAmount = purchaseAmount.mul(purchase.providePercent).div(100);
                const shop = shopData[purchase.shopIndex];
                const pointAmount = purchaseAmount.mul(purchase.providePercent).div(100);

                const oldUnPayablePointBalance = await ledgerContract.unPayablePointBalanceOf(phoneHash);

                const purchaseParam = {
                    purchaseId: getPurchaseId(),
                    amount: purchaseAmount,
                    loyalty: loyaltyAmount,
                    currency: purchase.currency.toLowerCase(),
                    shopId: shopData[purchase.shopIndex].shopId,
                    account: userAccount,
                    phone: phoneHash,
                };
                const purchaseMessage = ContractUtils.getPurchasesMessage(0, [purchaseParam]);
                const signatures = validatorWallets2.map((m) => ContractUtils.signMessage(m, purchaseMessage));
                await expect(providerContract.connect(validatorWallets[0]).savePurchase(0, [purchaseParam], signatures))
                    .to.emit(providerContract, "SavedPurchase")
                    .withArgs(
                        purchaseParam.purchaseId,
                        purchaseParam.amount,
                        purchaseParam.loyalty,
                        purchaseParam.currency,
                        purchaseParam.shopId,
                        purchaseParam.account,
                        purchaseParam.phone
                    )
                    .emit(ledgerContract, "ProvidedUnPayablePoint")
                    .withNamedArgs({
                        phone: phoneHash,
                        providedPoint: pointAmount,
                        providedValue: pointAmount,
                        purchaseId: purchaseParam.purchaseId,
                    });
                expect(await ledgerContract.unPayablePointBalanceOf(phoneHash)).to.deep.equal(
                    oldUnPayablePointBalance.add(pointAmount)
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
                    purchaseId: getPurchaseId(),
                    amount: 10000,
                    providePercent: 6,
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
                const loyaltyAmount = purchaseAmount.mul(purchase.providePercent).div(100);
                const shop = shopData[purchase.shopIndex];
                const pointAmount = purchaseAmount.mul(purchase.providePercent).div(100);
                const tokenAmount = pointAmount.mul(multiple).div(price);

                const oldUnPayablePointBalance = await ledgerContract.unPayablePointBalanceOf(phoneHash);
                const oldPointBalance = await ledgerContract.pointBalanceOf(userWallets[purchase.userIndex].address);
                const oldTokenBalance = await ledgerContract.tokenBalanceOf(userWallets[purchase.userIndex].address);
                const oldFoundationTokenBalance = await ledgerContract.tokenBalanceOf(foundation.address);

                const purchaseParam = {
                    purchaseId: getPurchaseId(),
                    amount: purchaseAmount,
                    loyalty: loyaltyAmount,
                    currency: purchase.currency.toLowerCase(),
                    shopId: shopData[purchase.shopIndex].shopId,
                    account: userAccount,
                    phone: phoneHash,
                };
                const purchaseMessage = ContractUtils.getPurchasesMessage(0, [purchaseParam]);
                const signatures = validatorWallets2.map((m) => ContractUtils.signMessage(m, purchaseMessage));

                await expect(providerContract.connect(validatorWallets[0]).savePurchase(0, [purchaseParam], signatures))
                    .to.emit(providerContract, "SavedPurchase")
                    .withArgs(
                        purchaseParam.purchaseId,
                        purchaseParam.amount,
                        purchaseParam.loyalty,
                        purchaseParam.currency,
                        purchaseParam.shopId,
                        purchaseParam.account,
                        purchaseParam.phone
                    )
                    .emit(ledgerContract, "ProvidedPoint")
                    .withNamedArgs({
                        account: userWallets[3].address,
                        providedPoint: pointAmount,
                        providedValue: pointAmount,
                        purchaseId: purchaseParam.purchaseId,
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
                )
                    .to.emit(exchangerContract, "ChangedToPayablePoint")
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

            it("Change Loyalty Type (user: 3, point type : 0)", async () => {
                const userIndex = 3;

                const nonce = await ledgerContract.nonceOf(userWallets[userIndex].address);
                const signature = await ContractUtils.signLoyaltyType(userWallets[userIndex], nonce);
                await expect(
                    exchangerContract.connect(relay).changeToLoyaltyToken(userWallets[userIndex].address, signature)
                )
                    .to.emit(exchangerContract, "ChangedToLoyaltyToken")
                    .withNamedArgs({ account: userWallets[userIndex].address });
            });

            it("Save Purchase Data - phone and address are registered (user: 3, point type : 1)", async () => {
                const purchase: IPurchaseData = {
                    purchaseId: getPurchaseId(),
                    amount: 10000,
                    providePercent: 6,
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
                const loyaltyAmount = purchaseAmount.mul(purchase.providePercent).div(100);
                const shop = shopData[purchase.shopIndex];
                const pointAmount = purchaseAmount.mul(purchase.providePercent).div(100);
                const tokenAmount = pointAmount.mul(multiple).div(price);

                const oldUnPayablePointBalance = await ledgerContract.unPayablePointBalanceOf(phoneHash);
                const oldPointBalance = await ledgerContract.pointBalanceOf(userWallets[purchase.userIndex].address);
                const oldTokenBalance = await ledgerContract.tokenBalanceOf(userWallets[purchase.userIndex].address);
                const oldFoundationTokenBalance = await ledgerContract.tokenBalanceOf(foundation.address);

                const purchaseParam = {
                    purchaseId: getPurchaseId(),
                    amount: purchaseAmount,
                    loyalty: loyaltyAmount,
                    currency: purchase.currency.toLowerCase(),
                    shopId: shopData[purchase.shopIndex].shopId,
                    account: userAccount,
                    phone: phoneHash,
                };
                const purchaseMessage = ContractUtils.getPurchasesMessage(0, [purchaseParam]);
                const signatures = validatorWallets2.map((m) => ContractUtils.signMessage(m, purchaseMessage));

                await expect(providerContract.connect(validatorWallets[0]).savePurchase(0, [purchaseParam], signatures))
                    .to.emit(providerContract, "SavedPurchase")
                    .withArgs(
                        purchaseParam.purchaseId,
                        purchaseParam.amount,
                        purchaseParam.loyalty,
                        purchaseParam.currency,
                        purchaseParam.shopId,
                        purchaseParam.account,
                        purchaseParam.phone
                    )
                    .emit(ledgerContract, "ProvidedToken")
                    .withNamedArgs({
                        account: userWallets[3].address,
                        providedToken: tokenAmount,
                        providedValue: pointAmount,
                        purchaseId: purchaseParam.purchaseId,
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
                    purchaseId: getPurchaseId(),
                    amount: 10000,
                    providePercent: 6,
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
                const loyaltyAmount = purchaseAmount.mul(purchase.providePercent).div(100);
                const shop = shopData[purchase.shopIndex];
                const pointAmount = purchaseAmount.mul(purchase.providePercent).div(100);
                const tokenAmount = pointAmount.mul(multiple).div(price);

                const oldUnPayablePointBalance = await ledgerContract.unPayablePointBalanceOf(phoneHash);
                const oldPointBalance = await ledgerContract.pointBalanceOf(userWallets[purchase.userIndex].address);
                const oldTokenBalance = await ledgerContract.tokenBalanceOf(userWallets[purchase.userIndex].address);
                const oldFoundationTokenBalance = await ledgerContract.tokenBalanceOf(foundation.address);

                const purchaseParam = {
                    purchaseId: getPurchaseId(),
                    amount: purchaseAmount,
                    loyalty: loyaltyAmount,
                    currency: purchase.currency.toLowerCase(),
                    shopId: shopData[purchase.shopIndex].shopId,
                    account: userAccount,
                    phone: phoneHash,
                };
                const purchaseMessage = ContractUtils.getPurchasesMessage(0, [purchaseParam]);
                const signatures = validatorWallets2.map((m) => ContractUtils.signMessage(m, purchaseMessage));

                await expect(providerContract.connect(validatorWallets[0]).savePurchase(0, [purchaseParam], signatures))
                    .to.emit(providerContract, "SavedPurchase")
                    .withArgs(
                        purchaseParam.purchaseId,
                        purchaseParam.amount,
                        purchaseParam.loyalty,
                        purchaseParam.currency,
                        purchaseParam.shopId,
                        purchaseParam.account,
                        purchaseParam.phone
                    )
                    .emit(ledgerContract, "ProvidedPoint")
                    .withNamedArgs({
                        account: userAccount,
                        providedPoint: pointAmount,
                        providedValue: pointAmount,
                        purchaseId: purchaseParam.purchaseId,
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

            it("Change Loyalty Type (user: 1)", async () => {
                const userIndex = 1;
                const nonce = await ledgerContract.nonceOf(userWallets[userIndex].address);
                const signature = await ContractUtils.signLoyaltyType(userWallets[userIndex], nonce);
                await expect(
                    exchangerContract.connect(relay).changeToLoyaltyToken(userWallets[userIndex].address, signature)
                )
                    .to.emit(exchangerContract, "ChangedToLoyaltyToken")
                    .withNamedArgs({ account: userWallets[userIndex].address });
            });

            it("Save Purchase Data - (user: 1, point type : 1)", async () => {
                const purchase: IPurchaseData = {
                    purchaseId: getPurchaseId(),
                    providePercent: 6,
                    amount: 100000,
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
                const loyaltyAmount = purchaseAmount.mul(purchase.providePercent).div(100);
                const shop = shopData[purchase.shopIndex];
                const pointAmount = purchaseAmount.mul(purchase.providePercent).div(100);
                const tokenAmount = pointAmount.mul(multiple).div(price);

                const oldUnPayablePointBalance = await ledgerContract.unPayablePointBalanceOf(phoneHash);
                const oldPointBalance = await ledgerContract.pointBalanceOf(userWallets[purchase.userIndex].address);
                const oldTokenBalance = await ledgerContract.tokenBalanceOf(userWallets[purchase.userIndex].address);
                const oldFoundationTokenBalance = await ledgerContract.tokenBalanceOf(foundation.address);

                const purchaseParam = {
                    purchaseId: getPurchaseId(),
                    amount: purchaseAmount,
                    loyalty: loyaltyAmount,
                    currency: purchase.currency.toLowerCase(),
                    shopId: shopData[purchase.shopIndex].shopId,
                    account: userAccount,
                    phone: phoneHash,
                };
                const purchaseMessage = ContractUtils.getPurchasesMessage(0, [purchaseParam]);
                const signatures = validatorWallets2.map((m) => ContractUtils.signMessage(m, purchaseMessage));

                await expect(providerContract.connect(validatorWallets[0]).savePurchase(0, [purchaseParam], signatures))
                    .to.emit(providerContract, "SavedPurchase")
                    .withArgs(
                        purchaseParam.purchaseId,
                        purchaseParam.amount,
                        purchaseParam.loyalty,
                        purchaseParam.currency,
                        purchaseParam.shopId,
                        purchaseParam.account,
                        purchaseParam.phone
                    )
                    .emit(ledgerContract, "ProvidedToken")
                    .withNamedArgs({
                        account: userAccount,
                        providedToken: tokenAmount,
                        providedValue: pointAmount,
                        purchaseId: purchaseParam.purchaseId,
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

            it("Save Purchase Data (user: 4, point type : 0) - phone and address are not registered", async () => {
                const purchase: IPurchaseData = {
                    purchaseId: getPurchaseId(),
                    amount: 10000,
                    providePercent: 6,
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
                const loyaltyAmount = purchaseAmount.mul(purchase.providePercent).div(100);
                const shop = shopData[purchase.shopIndex];
                const pointAmount = purchaseAmount.mul(purchase.providePercent).div(100);

                const oldUnPayablePointBalance = await ledgerContract.unPayablePointBalanceOf(phoneHash);

                const purchaseParam = {
                    purchaseId: getPurchaseId(),
                    amount: purchaseAmount,
                    loyalty: loyaltyAmount,
                    currency: purchase.currency.toLowerCase(),
                    shopId: shopData[purchase.shopIndex].shopId,
                    account: userAccount,
                    phone: phoneHash,
                };
                const purchaseMessage = ContractUtils.getPurchasesMessage(0, [purchaseParam]);
                const signatures = validatorWallets2.map((m) => ContractUtils.signMessage(m, purchaseMessage));

                await expect(providerContract.connect(validatorWallets[0]).savePurchase(0, [purchaseParam], signatures))
                    .to.emit(providerContract, "SavedPurchase")
                    .withArgs(
                        purchaseParam.purchaseId,
                        purchaseParam.amount,
                        purchaseParam.loyalty,
                        purchaseParam.currency,
                        purchaseParam.shopId,
                        purchaseParam.account,
                        purchaseParam.phone
                    )
                    .emit(ledgerContract, "ProvidedUnPayablePoint")
                    .withNamedArgs({
                        phone: phoneHash,
                        providedPoint: pointAmount,
                        providedValue: pointAmount,
                        purchaseId: purchaseParam.purchaseId,
                    });
                expect(await ledgerContract.unPayablePointBalanceOf(phoneHash)).to.deep.equal(
                    oldUnPayablePointBalance.add(pointAmount)
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
                    purchaseId: getPurchaseId(),
                    amount: 10000,
                    providePercent: 6,
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
                const loyaltyAmount = purchaseAmount.mul(purchase.providePercent).div(100);
                const shop = shopData[purchase.shopIndex];
                const pointAmount = purchaseAmount.mul(purchase.providePercent).div(100);
                const tokenAmount = pointAmount.mul(multiple).div(price);

                const oldUnPayablePointBalance = await ledgerContract.unPayablePointBalanceOf(phoneHash);
                const oldPointBalance = await ledgerContract.pointBalanceOf(userWallets[purchase.userIndex].address);
                const oldTokenBalance = await ledgerContract.tokenBalanceOf(userWallets[purchase.userIndex].address);
                const oldFoundationTokenBalance = await ledgerContract.tokenBalanceOf(foundation.address);

                const purchaseParam = {
                    purchaseId: getPurchaseId(),
                    amount: purchaseAmount,
                    loyalty: loyaltyAmount,
                    currency: purchase.currency.toLowerCase(),
                    shopId: shopData[purchase.shopIndex].shopId,
                    account: userAccount,
                    phone: phoneHash,
                };
                const purchaseMessage = ContractUtils.getPurchasesMessage(0, [purchaseParam]);
                const signatures = validatorWallets2.map((m) => ContractUtils.signMessage(m, purchaseMessage));

                await expect(providerContract.connect(validatorWallets[0]).savePurchase(0, [purchaseParam], signatures))
                    .to.emit(providerContract, "SavedPurchase")
                    .withArgs(
                        purchaseParam.purchaseId,
                        purchaseParam.amount,
                        purchaseParam.loyalty,
                        purchaseParam.currency,
                        purchaseParam.shopId,
                        purchaseParam.account,
                        purchaseParam.phone
                    )
                    .emit(ledgerContract, "ProvidedPoint")
                    .withNamedArgs({
                        account: userWallets[4].address,
                        providedPoint: pointAmount,
                        providedValue: pointAmount,
                        purchaseId: purchaseParam.purchaseId,
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

            it("Change to payable point (user: 4, point type : 0)", async () => {
                const userIndex = 4;
                const oldBalance = await ledgerContract.pointBalanceOf(userWallets[userIndex].address);
                const phoneHash = ContractUtils.getPhoneHash(userData[userIndex].phone);
                const nonce = await ledgerContract.nonceOf(userWallets[userIndex].address);
                const signature = await ContractUtils.signChangePayablePoint(userWallets[userIndex], phoneHash, nonce);
                const unPayableAmount = await ledgerContract.unPayablePointBalanceOf(phoneHash);
                await expect(
                    exchangerContract
                        .connect(userWallets[userIndex].connect(waffle.provider))
                        .changeToPayablePoint(phoneHash, userWallets[userIndex].address, signature)
                )
                    .to.emit(exchangerContract, "ChangedToPayablePoint")
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

            it("Change Loyalty Type (user: 4, point type : 0)", async () => {
                const userIndex = 4;

                const nonce = await ledgerContract.nonceOf(userWallets[userIndex].address);
                const signature = await ContractUtils.signLoyaltyType(userWallets[userIndex], nonce);
                await expect(
                    exchangerContract.connect(relay).changeToLoyaltyToken(userWallets[userIndex].address, signature)
                )
                    .to.emit(exchangerContract, "ChangedToLoyaltyToken")
                    .withNamedArgs({ account: userWallets[userIndex].address });
            });

            it("Save Purchase Data - phone and address are registered (user: 4, point type : 1)", async () => {
                const purchase: IPurchaseData = {
                    purchaseId: getPurchaseId(),
                    amount: 10000,
                    providePercent: 6,
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
                const loyaltyAmount = purchaseAmount.mul(purchase.providePercent).div(100);
                const shop = shopData[purchase.shopIndex];
                const pointAmount = purchaseAmount.mul(purchase.providePercent).div(100);
                const tokenAmount = pointAmount.mul(multiple).div(price);

                const oldUnPayablePointBalance = await ledgerContract.unPayablePointBalanceOf(phoneHash);
                const oldPointBalance = await ledgerContract.pointBalanceOf(userWallets[purchase.userIndex].address);
                const oldTokenBalance = await ledgerContract.tokenBalanceOf(userWallets[purchase.userIndex].address);
                const oldFoundationTokenBalance = await ledgerContract.tokenBalanceOf(foundation.address);

                const purchaseParam = {
                    purchaseId: getPurchaseId(),
                    amount: purchaseAmount,
                    loyalty: loyaltyAmount,
                    currency: purchase.currency.toLowerCase(),
                    shopId: shopData[purchase.shopIndex].shopId,
                    account: userAccount,
                    phone: phoneHash,
                };
                const purchaseMessage = ContractUtils.getPurchasesMessage(0, [purchaseParam]);
                const signatures = validatorWallets2.map((m) => ContractUtils.signMessage(m, purchaseMessage));

                await expect(providerContract.connect(validatorWallets[0]).savePurchase(0, [purchaseParam], signatures))
                    .to.emit(providerContract, "SavedPurchase")
                    .withArgs(
                        purchaseParam.purchaseId,
                        purchaseParam.amount,
                        purchaseParam.loyalty,
                        purchaseParam.currency,
                        purchaseParam.shopId,
                        purchaseParam.account,
                        purchaseParam.phone
                    )
                    .emit(ledgerContract, "ProvidedToken")
                    .withNamedArgs({
                        account: userWallets[4].address,
                        providedToken: tokenAmount,
                        providedValue: pointAmount,
                        purchaseId: purchaseParam.purchaseId,
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

            it("Save Purchase Data (user: 5, point type : 0) - phone and address are not registered", async () => {
                const purchase: IPurchaseData = {
                    purchaseId: getPurchaseId(),
                    amount: 10000,
                    providePercent: 6,
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
                const loyaltyAmount = purchaseAmount.mul(purchase.providePercent).div(100);
                const shop = shopData[purchase.shopIndex];
                const pointAmount = purchaseAmount.mul(purchase.providePercent).div(100);

                const oldUnPayablePointBalance = await ledgerContract.unPayablePointBalanceOf(phoneHash);

                const purchaseParam = {
                    purchaseId: getPurchaseId(),
                    amount: purchaseAmount,
                    loyalty: loyaltyAmount,
                    currency: purchase.currency.toLowerCase(),
                    shopId: shopData[purchase.shopIndex].shopId,
                    account: userAccount,
                    phone: phoneHash,
                };
                const purchaseMessage = ContractUtils.getPurchasesMessage(0, [purchaseParam]);
                const signatures = validatorWallets2.map((m) => ContractUtils.signMessage(m, purchaseMessage));

                await expect(providerContract.connect(validatorWallets[0]).savePurchase(0, [purchaseParam], signatures))
                    .to.emit(providerContract, "SavedPurchase")
                    .withArgs(
                        purchaseParam.purchaseId,
                        purchaseParam.amount,
                        purchaseParam.loyalty,
                        purchaseParam.currency,
                        purchaseParam.shopId,
                        purchaseParam.account,
                        purchaseParam.phone
                    )
                    .emit(ledgerContract, "ProvidedUnPayablePoint")
                    .withNamedArgs({
                        phone: phoneHash,
                        providedPoint: pointAmount,
                        providedValue: pointAmount,
                        purchaseId: purchaseParam.purchaseId,
                    });
                expect(await ledgerContract.unPayablePointBalanceOf(phoneHash)).to.deep.equal(
                    oldUnPayablePointBalance.add(pointAmount)
                );
            });

            it("Change Loyalty Type (user: 5, point type : 0)", async () => {
                const userIndex = 5;

                const nonce = await ledgerContract.nonceOf(userWallets[userIndex].address);
                const signature = await ContractUtils.signLoyaltyType(userWallets[userIndex], nonce);
                await expect(
                    exchangerContract.connect(relay).changeToLoyaltyToken(userWallets[userIndex].address, signature)
                )
                    .to.emit(exchangerContract, "ChangedToLoyaltyToken")
                    .withNamedArgs({ account: userWallets[userIndex].address });
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
                const tokenAmount = unPayableAmount.mul(multiple).div(price);
                await expect(
                    exchangerContract
                        .connect(relay)
                        .changeToPayablePoint(phoneHash, userWallets[userIndex].address, signature)
                )
                    .to.emit(exchangerContract, "ChangedToPayablePoint")
                    .withNamedArgs({
                        phone: phoneHash,
                        account: userWallets[userIndex].address,
                        changedPoint: unPayableAmount,
                    })
                    .to.emit(exchangerContract, "ChangedToLoyaltyToken")
                    .withNamedArgs({
                        account: userWallets[userIndex].address,
                        amountToken: tokenAmount,
                        amountPoint: unPayableAmount,
                    });

                expect(await ledgerContract.tokenBalanceOf(userWallets[userIndex].address)).to.equal(
                    oldBalance.add(tokenAmount)
                );
                expect(await ledgerContract.unPayablePointBalanceOf(phoneHash)).to.equal(0);
            });
        });

        context("Pay point", () => {
            it("Pay point - Invalid signature", async () => {
                const purchase: IPurchaseData = {
                    purchaseId: getPurchaseId(),
                    amount: 100,
                    providePercent: 5,
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
                    purchaseId: getPurchaseId(),
                    amount: 100000,
                    providePercent: 5,
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
                    purchaseId: getPurchaseId(),
                    amount: 100,
                    providePercent: 5,
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
                const feeAmount = ContractUtils.zeroGWEI(purchaseAmount.mul(await ledgerContract.getFee()).div(10000));
                const feeToken = ContractUtils.zeroGWEI(feeAmount.mul(multiple).div(price));
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
                expect(newFeeBalance).to.deep.equal(oldFeeBalance.add(feeToken));
            });
        });

        context("Pay Loyalty Point", async () => {
            const purchase: IPurchaseData = {
                purchaseId: getPurchaseId(),
                amount: 100,
                providePercent: 5,
                currency: "krw",
                shopIndex: 0,
                userIndex: 0,
            };

            const paymentId = ContractUtils.getPaymentId(userWallets[purchase.userIndex].address);
            const purchaseAmount = Amount.make(purchase.amount, 18).value;
            const shop = shopData[purchase.shopIndex];

            let feeAmount: BigNumber;
            let feeToken: BigNumber;

            it("Pay", async () => {
                feeAmount = ContractUtils.zeroGWEI(purchaseAmount.mul(await ledgerContract.getFee()).div(10000));
                feeToken = ContractUtils.zeroGWEI(feeAmount.mul(multiple).div(price));

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
                expect(newBalance1.toString()).to.deep.equal(oldBalance.sub(purchaseAmount.add(feeAmount)).toString());

                await expect(consumerContract.connect(relay).closeNewLoyaltyPayment(paymentId, true)).to.emit(
                    consumerContract,
                    "LoyaltyPaymentEvent"
                );

                const newFeeBalance2 = await ledgerContract.tokenBalanceOf(fee.address);
                expect(newFeeBalance2.toString()).to.deep.equal(oldFeeBalance.add(feeToken).toString());

                const newBalance2 = await ledgerContract.pointBalanceOf(userWallets[purchase.userIndex].address);
                expect(newBalance2.toString()).to.deep.equal(oldBalance.sub(purchaseAmount.add(feeAmount)).toString());
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
                expect(newBalance2.toString()).to.deep.equal(oldBalance.add(purchaseAmount.add(feeAmount)).toString());
            });
        });

        context("Pay token", () => {
            it("Pay token - Invalid signature", async () => {
                const purchase: IPurchaseData = {
                    purchaseId: getPurchaseId(),
                    amount: 100,
                    providePercent: 5,
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
                    purchaseId: getPurchaseId(),
                    amount: 100000,
                    providePercent: 5,
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
                    purchaseId: getPurchaseId(),
                    amount: 100,
                    providePercent: 5,
                    currency: "krw",
                    shopIndex: 0,
                    userIndex: 1,
                };

                const paymentId = ContractUtils.getPaymentId(userWallets[purchase.userIndex].address);
                const purchaseAmount = Amount.make(purchase.amount, 18).value;
                const tokenAmount = ContractUtils.zeroGWEI(purchaseAmount.mul(multiple).div(price));
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
                const feeAmount = ContractUtils.zeroGWEI(purchaseAmount.mul(await ledgerContract.getFee()).div(10000));
                const feeToken = ContractUtils.zeroGWEI(feeAmount.mul(multiple).div(price));
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
                    oldFoundationTokenBalance.add(tokenAmount)
                );
                const newFeeBalance = await ledgerContract.tokenBalanceOf(fee.address);
                expect(newFeeBalance).to.deep.equal(oldFeeBalance.add(feeToken));
            });
        });

        context("Pay Loyalty Token", async () => {
            const purchase: IPurchaseData = {
                purchaseId: getPurchaseId(),
                amount: 100,
                providePercent: 5,
                currency: "krw",
                shopIndex: 0,
                userIndex: 1,
            };

            const paymentId = ContractUtils.getPaymentId(userWallets[purchase.userIndex].address);
            const purchaseAmount = Amount.make(purchase.amount, 18).value;
            const tokenAmount = ContractUtils.zeroGWEI(purchaseAmount.mul(multiple).div(price));
            const shop = shopData[purchase.shopIndex];
            let oldFoundationTokenBalance: BigNumber;
            let feeAmount: BigNumber;
            let feeToken: BigNumber;

            it("Pay", async () => {
                oldFoundationTokenBalance = await ledgerContract.tokenBalanceOf(foundation.address);
                feeAmount = ContractUtils.zeroGWEI(purchaseAmount.mul(await ledgerContract.getFee()).div(10000));
                feeToken = ContractUtils.zeroGWEI(feeAmount.mul(multiple).div(price));

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
                expect(newBalance1.toString()).to.deep.equal(oldBalance.sub(tokenAmount.add(feeToken)).toString());

                await expect(consumerContract.connect(relay).closeNewLoyaltyPayment(paymentId, true)).to.emit(
                    consumerContract,
                    "LoyaltyPaymentEvent"
                );

                expect(await ledgerContract.tokenBalanceOf(foundation.address)).to.deep.equal(
                    oldFoundationTokenBalance.add(tokenAmount)
                );
                expect(await ledgerContract.tokenBalanceOf(fee.address)).to.deep.equal(oldFeeBalance.add(feeToken));
                const newBalance2 = await ledgerContract.tokenBalanceOf(userWallets[purchase.userIndex].address);
                expect(newBalance2.toString()).to.deep.equal(oldBalance.sub(tokenAmount.add(feeToken)).toString());
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
                    oldFoundationTokenBalance.sub(tokenAmount)
                );
                expect(await ledgerContract.tokenBalanceOf(fee.address)).to.deep.equal(oldFeeBalance.sub(feeToken));
                const newBalance2 = await ledgerContract.tokenBalanceOf(userWallets[purchase.userIndex].address);
                expect(newBalance2.toString()).to.deep.equal(oldBalance.add(tokenAmount.add(feeToken)).toString());
            });
        });
    });

    context("Many Save Purchase Data ", () => {
        const userData: IUserData[] = [
            {
                phone: "08201012341001",
                address: userWallets[0].address,
                privateKey: userWallets[0].privateKey,
            },
        ];
        const shopData: IShopData[] = [
            {
                shopId: "",
                name: "Shop1",
                currency: "krw",
                wallet: shopWallets[0],
            },
        ];

        const numPurchases = 96;

        before("Set Shop ID", async () => {
            for (const elem of shopData) {
                elem.shopId = ContractUtils.getShopId(elem.wallet.address);
            }
        });

        before("Deploy", async () => {
            await deployAllContract(shopData);
        });

        it("Save Purchase Data", async () => {
            const purchases = [];
            for (let idx = 0; idx < numPurchases; idx++) {
                const phoneHash = ContractUtils.getPhoneHash("");
                const purchaseAmount = Amount.make(10000, 18).value;
                const loyaltyAmount = purchaseAmount.mul(1).div(100);
                const userAccount = userData[0].address.trim();
                purchases.push({
                    purchaseId: getPurchaseId(),
                    amount: purchaseAmount,
                    loyalty: loyaltyAmount,
                    currency: "krw",
                    shopId: shopData[0].shopId,
                    account: userAccount,
                    phone: phoneHash,
                });
            }

            const purchaseMessage = ContractUtils.getPurchasesMessage(0, purchases);
            const signatures = validatorWallets2.map((m) => ContractUtils.signMessage(m, purchaseMessage));
            const tx = await providerContract.connect(validatorWallets[0]).savePurchase(0, purchases, signatures);
            await tx.wait();
        });

        it("Check balances", async () => {
            const purchaseAmount = Amount.make(10000, 18).value;
            const loyaltyAmount = purchaseAmount.mul(1).div(100);
            expect(await ledgerContract.pointBalanceOf(userData[0].address)).to.deep.equal(
                loyaltyAmount.mul(numPurchases)
            );
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
                purchaseId: getPurchaseId(),
                amount: 10000,
                providePercent: 5,
                currency: "krw",
                shopIndex: 0,
                userIndex: 0,
            },
            {
                purchaseId: getPurchaseId(),
                amount: 10000,
                providePercent: 5,
                currency: "krw",
                shopIndex: 0,
                userIndex: 1,
            },
            {
                purchaseId: getPurchaseId(),
                amount: 10000,
                providePercent: 6,
                currency: "krw",
                shopIndex: 1,
                userIndex: 2,
            },
            {
                purchaseId: getPurchaseId(),
                amount: 10000,
                providePercent: 7,
                currency: "krw",
                shopIndex: 2,
                userIndex: 3,
            },
            {
                purchaseId: getPurchaseId(),
                amount: 10000,
                providePercent: 6,
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
                wallet: shopWallets[0],
            },
            {
                shopId: "",
                name: "Shop2",
                currency: "krw",
                wallet: shopWallets[1],
            },
            {
                shopId: "",
                name: "Shop3",
                currency: "krw",
                wallet: shopWallets[2],
            },
            {
                shopId: "",
                name: "Shop4",
                currency: "krw",
                wallet: shopWallets[3],
            },
            {
                shopId: "",
                name: "Shop5",
                currency: "krw",
                wallet: shopWallets[4],
            },
            {
                shopId: "",
                name: "Shop6",
                currency: "krw",
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
                await expect(
                    ledgerContract.connect(userWallets[0]).withdraw(oldTokenBalance.add(1000000000))
                ).to.revertedWith("1511");
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
                purchaseId: getPurchaseId(),
                amount: 10000,
                providePercent: 1,
                currency: "krw",
                shopIndex: 0,
                userIndex: 0,
            },
            {
                purchaseId: getPurchaseId(),
                amount: 10000,
                providePercent: 1,
                currency: "krw",
                shopIndex: 0,
                userIndex: 0,
            },
            {
                purchaseId: getPurchaseId(),
                amount: 10000,
                providePercent: 1,
                currency: "krw",
                shopIndex: 0,
                userIndex: 0,
            },
            {
                purchaseId: getPurchaseId(),
                amount: 10000,
                providePercent: 1,
                currency: "krw",
                shopIndex: 1,
                userIndex: 0,
            },
            {
                purchaseId: getPurchaseId(),
                amount: 10000,
                providePercent: 1,
                currency: "krw",
                shopIndex: 2,
                userIndex: 0,
            },
            {
                purchaseId: getPurchaseId(),
                amount: 10000,
                providePercent: 1,
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
                wallet: shopWallets[0],
            },
            {
                shopId: "F000200",
                name: "Shop2",
                currency: "krw",
                wallet: shopWallets[1],
            },
            {
                shopId: "F000300",
                name: "Shop3",
                currency: "krw",
                wallet: shopWallets[2],
            },
            {
                shopId: "F000400",
                name: "Shop4",
                currency: "krw",
                wallet: shopWallets[3],
            },
            {
                shopId: "F000500",
                name: "Shop5",
                currency: "krw",
                wallet: shopWallets[4],
            },
            {
                shopId: "F000600",
                name: "Shop6",
                currency: "krw",
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
                    const loyaltyAmount = purchaseAmount.mul(purchase.providePercent).div(100);
                    const shop = shopData[purchase.shopIndex];
                    const amt = purchaseAmount.mul(purchase.providePercent).div(100);
                    const userAccount =
                        userData[purchase.userIndex].address.trim() !== ""
                            ? userData[purchase.userIndex].address.trim()
                            : AddressZero;
                    const purchaseParam = {
                        purchaseId: getPurchaseId(),
                        amount: purchaseAmount,
                        loyalty: loyaltyAmount,
                        currency: purchase.currency.toLowerCase(),
                        shopId: shopData[purchase.shopIndex].shopId,
                        account: userAccount,
                        phone: phoneHash,
                    };
                    const purchaseMessage = ContractUtils.getPurchasesMessage(0, [purchaseParam]);
                    const signatures = validatorWallets2.map((m) => ContractUtils.signMessage(m, purchaseMessage));

                    await expect(
                        providerContract.connect(validatorWallets[0]).savePurchase(0, [purchaseParam], signatures)
                    )
                        .to.emit(providerContract, "SavedPurchase")
                        .withArgs(
                            purchaseParam.purchaseId,
                            purchaseParam.amount,
                            purchaseParam.loyalty,
                            purchaseParam.currency,
                            purchaseParam.shopId,
                            purchaseParam.account,
                            purchaseParam.phone
                        )
                        .emit(ledgerContract, "ProvidedPoint")
                        .withNamedArgs({
                            account: userAccount,
                            providedPoint: amt,
                            providedValue: amt,
                            purchaseId: purchaseParam.purchaseId,
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
                    const point = purchaseAmount.mul(purchase.providePercent).div(100);

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
                const shopInfo1 = await shopContract.shopOf(shopData[0].shopId);
                expect(shopInfo1.providedAmount).to.equal(
                    Amount.make(10000 * 3, 18)
                        .value.mul(1)
                        .div(100)
                );

                const shopInfo2 = await shopContract.shopOf(shopData[1].shopId);
                expect(shopInfo2.providedAmount).to.equal(
                    Amount.make(10000 * 1, 18)
                        .value.mul(1)
                        .div(100)
                );
                const shopInfo3 = await shopContract.shopOf(shopData[2].shopId);
                expect(shopInfo3.providedAmount).to.equal(
                    Amount.make(10000 * 1, 18)
                        .value.mul(1)
                        .div(100)
                );
                const shopInfo4 = await shopContract.shopOf(shopData[3].shopId);
                expect(shopInfo4.providedAmount).to.equal(
                    Amount.make(10000 * 1, 18)
                        .value.mul(1)
                        .div(100)
                );
            });
        });

        context("Pay point", () => {
            it("Pay point - Success", async () => {
                const purchase = {
                    purchaseId: getPurchaseId(),
                    amount: 300,
                    providePercent: 1,
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
                    .to.emit(consumerContract, "ProvidedTokenForSettlement")
                    .withNamedArgs({
                        account: settlements.address,
                        shopId: shop.shopId,
                        providedPoint: Amount.make(200, 18).value,
                    });

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
                    exchangerContract
                        .connect(userWallets[userIndex].connect(waffle.provider))
                        .changeToLoyaltyToken(userWallets[userIndex].address, signature)
                )
                    .to.emit(exchangerContract, "ChangedToLoyaltyToken")
                    .withNamedArgs({ account: userWallets[userIndex].address });
            });
        });

        context("Deposit token", () => {
            it("Deposit token - Success", async () => {
                const userIndex = 0;
                const oldTokenBalance = await ledgerContract.tokenBalanceOf(userWallets[userIndex].address);
                await tokenContract.connect(userWallets[userIndex]).approve(ledgerContract.address, amount.value);
                await expect(ledgerContract.connect(userWallets[userIndex]).deposit(amount.value))
                    .to.emit(ledgerContract, "Deposited")
                    .withNamedArgs({
                        account: userWallets[userIndex].address,
                        depositedToken: amount.value,
                        balanceToken: oldTokenBalance.add(amount.value),
                    });
                expect(await ledgerContract.tokenBalanceOf(userWallets[userIndex].address)).to.deep.equal(
                    oldTokenBalance.add(amount.value)
                );
            });
        });

        context("Pay token", () => {
            it("Pay token - Success", async () => {
                const purchase: IPurchaseData = {
                    purchaseId: getPurchaseId(),
                    amount: 500,
                    providePercent: 1,
                    currency: "krw",
                    shopIndex: 2,
                    userIndex: 0,
                };

                const paymentId = ContractUtils.getPaymentId(userWallets[purchase.userIndex].address);
                const purchaseAmount = ContractUtils.zeroGWEI(Amount.make(purchase.amount, 18).value);
                const tokenAmount = ContractUtils.zeroGWEI(purchaseAmount.mul(multiple).div(price));
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

                const settledToken = ContractUtils.zeroGWEI(shopInfo2.settledAmount.mul(multiple).div(price));
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
                        .connect(shopData[shopIndex].wallet.connect(waffle.provider))
                        .openWithdrawal(shop.shopId, amount2, shopData[shopIndex].wallet.address, signature)
                )
                    .to.emit(shopContract, "OpenedWithdrawal")
                    .withNamedArgs({
                        shopId: shop.shopId,
                        amount: amount2,
                        account: shopWallets[shopIndex].address,
                    });
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
                        .connect(shopData[shopIndex].wallet.connect(waffle.provider))
                        .closeWithdrawal(shop.shopId, shopData[shopIndex].wallet.address, signature)
                )
                    .to.emit(shopContract, "ClosedWithdrawal")
                    .withNamedArgs({
                        shopId: shop.shopId,
                        amount: amount2,
                        account: shopWallets[shopIndex].address,
                    });
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
                purchaseId: getPurchaseId(),
                amount: 10000,
                providePercent: 1,
                currency: "KRW",
                shopIndex: 0,
                userIndex: 0,
            },
            {
                purchaseId: getPurchaseId(),
                amount: 10000,
                providePercent: 1,
                currency: "USD",
                shopIndex: 0,
                userIndex: 0,
            },
            {
                purchaseId: getPurchaseId(),
                amount: 10000,
                providePercent: 1,
                currency: "JPY",
                shopIndex: 0,
                userIndex: 0,
            },
            {
                purchaseId: getPurchaseId(),
                amount: 10000,
                providePercent: 1,
                currency: "CNY",
                shopIndex: 1,
                userIndex: 1,
            },
            {
                purchaseId: getPurchaseId(),
                amount: 10000,
                providePercent: 1,
                currency: "KRW",
                shopIndex: 2,
                userIndex: 1,
            },
            {
                purchaseId: getPurchaseId(),
                amount: 10000,
                providePercent: 1,
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
                wallet: shopWallets[0],
            },
            {
                shopId: "F000200",
                name: "Shop2",
                currency: "krw",
                wallet: shopWallets[1],
            },
            {
                shopId: "F000300",
                name: "Shop3",
                currency: "krw",
                wallet: shopWallets[2],
            },
            {
                shopId: "F000400",
                name: "Shop4",
                currency: "krw",
                wallet: shopWallets[3],
            },
            {
                shopId: "F000500",
                name: "Shop5",
                currency: "krw",
                wallet: shopWallets[4],
            },
            {
                shopId: "F000600",
                name: "Shop6",
                currency: "krw",
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
            const height = ContractUtils.getTimeStamp();
            const rates = [
                {
                    symbol: "usd",
                    rate: multiple.mul(3),
                },
                {
                    symbol: "jpy",
                    rate: multiple.mul(2),
                },
                {
                    symbol: "cny",
                    rate: multiple.mul(1),
                },
                {
                    symbol: "krw",
                    rate: multiple.mul(1),
                },
            ];
            const message = ContractUtils.getCurrencyMessage(height, rates);
            const signatures = validatorWallets.map((m) => ContractUtils.signMessage(m, message));
            await currencyContract.connect(validatorWallets[0]).set(height, rates, signatures);
        });

        context("Save Purchase Data", () => {
            it("Save Purchase Data", async () => {
                for (const purchase of purchaseData) {
                    const phoneHash = ContractUtils.getPhoneHash(userData[purchase.userIndex].phone);
                    const purchaseAmount = Amount.make(purchase.amount, 18).value;
                    const loyaltyAmount = ContractUtils.zeroGWEI(purchaseAmount.mul(purchase.providePercent).div(100));
                    const userAccount =
                        userData[purchase.userIndex].address.trim() !== ""
                            ? userData[purchase.userIndex].address.trim()
                            : AddressZero;
                    const currency = purchase.currency.toLowerCase();
                    const rate = await currencyContract.get(currency);
                    const loyaltyPoint = ContractUtils.zeroGWEI(
                        purchaseAmount.mul(rate).div(multiple).mul(purchase.providePercent).div(100)
                    );
                    const loyaltyValue = ContractUtils.zeroGWEI(purchaseAmount.mul(purchase.providePercent).div(100));
                    const purchaseParam = {
                        purchaseId: purchase.purchaseId,
                        amount: purchaseAmount,
                        loyalty: loyaltyAmount,
                        currency: purchase.currency.toLowerCase(),
                        shopId: shopData[purchase.shopIndex].shopId,
                        account: userAccount,
                        phone: phoneHash,
                    };
                    const purchaseMessage = ContractUtils.getPurchasesMessage(0, [purchaseParam]);
                    const signatures = validatorWallets2.map((m) => ContractUtils.signMessage(m, purchaseMessage));

                    await expect(
                        providerContract.connect(validatorWallets[0]).savePurchase(0, [purchaseParam], signatures)
                    )
                        .to.emit(providerContract, "SavedPurchase")
                        .withArgs(
                            purchaseParam.purchaseId,
                            purchaseParam.amount,
                            purchaseParam.loyalty,
                            purchaseParam.currency,
                            purchaseParam.shopId,
                            purchaseParam.account,
                            purchaseParam.phone
                        )
                        .emit(ledgerContract, "ProvidedPoint")
                        .withNamedArgs({
                            account: userAccount,
                            providedPoint: loyaltyPoint,
                            providedValue: loyaltyValue,
                            purchaseId: purchaseParam.purchaseId,
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

                    const rate = await currencyContract.get(purchase.currency.toLowerCase());
                    const shop = shopData[purchase.shopIndex];
                    const point = ContractUtils.zeroGWEI(
                        purchaseAmount.mul(rate).div(multiple).mul(purchase.providePercent).div(100)
                    );

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
                const shopInfo1 = await shopContract.shopOf(shopData[0].shopId);
                expect(shopInfo1.providedAmount).to.equal(
                    Amount.make(10000 * 6, 18)
                        .value.mul(1)
                        .div(100)
                );

                const shopInfo2 = await shopContract.shopOf(shopData[1].shopId);
                expect(shopInfo2.providedAmount).to.equal(
                    Amount.make(10000 * 1, 18)
                        .value.mul(1)
                        .div(100)
                );
                const shopInfo3 = await shopContract.shopOf(shopData[2].shopId);
                expect(shopInfo3.providedAmount).to.equal(
                    Amount.make(10000 * 1, 18)
                        .value.mul(1)
                        .div(100)
                );
                const shopInfo4 = await shopContract.shopOf(shopData[3].shopId);
                expect(shopInfo4.providedAmount).to.equal(
                    Amount.make(10000 * 1, 18)
                        .value.mul(1)
                        .div(100)
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
                purchaseId: getPurchaseId(),
                amount: 10000,
                providePercent: 1,
                currency: "krw",
                shopIndex: 0,
                userIndex: 0,
            },
            {
                purchaseId: getPurchaseId(),
                amount: 10000,
                providePercent: 1,
                currency: "krw",
                shopIndex: 1,
                userIndex: 0,
            },
            {
                purchaseId: getPurchaseId(),
                amount: 10000,
                providePercent: 1,
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
                wallet: shopWallets[0],
            },
            {
                shopId: "F000200",
                name: "Shop2",
                currency: "usd",
                wallet: shopWallets[1],
            },
            {
                shopId: "F000300",
                name: "Shop3",
                currency: "jpy",
                wallet: shopWallets[2],
            },
            {
                shopId: "F000400",
                name: "Shop4",
                currency: "usd",
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

            const height = ContractUtils.getTimeStamp() + 1;

            const rates = [
                {
                    symbol: await tokenContract.symbol(),
                    rate: multiple.mul(100),
                },
                {
                    symbol: "usd",
                    rate: multiple.mul(1000),
                },
                {
                    symbol: "jpy",
                    rate: multiple.mul(10),
                },
            ];
            const message = ContractUtils.getCurrencyMessage(height, rates);
            const signatures = validatorWallets.map((m) => ContractUtils.signMessage(m, message));
            await currencyContract.connect(validatorWallets[0]).set(height, rates, signatures);

            await deployCertifier();
            await deployProvider();
            await deployConsumer();
            await deployExchanger();
            await deployBurner();
            await deployShop();
            await deployLedger();
            await addShopData(shopData);
            await prepareToken();
        });

        context("Save Purchase Data", () => {
            it("Save Purchase Data", async () => {
                for (const purchase of purchaseData) {
                    const phoneHash = ContractUtils.getPhoneHash(userData[purchase.userIndex].phone);
                    const purchaseAmount = Amount.make(purchase.amount, 18).value;
                    const loyaltyAmount = purchaseAmount.mul(purchase.providePercent).div(100);
                    const amt = purchaseAmount.mul(purchase.providePercent).div(100);
                    const userAccount = userData[purchase.userIndex].address.trim();
                    const purchaseParam = {
                        purchaseId: getPurchaseId(),
                        amount: purchaseAmount,
                        loyalty: loyaltyAmount,
                        currency: purchase.currency.toLowerCase(),
                        shopId: shopData[purchase.shopIndex].shopId,
                        account: userAccount,
                        phone: phoneHash,
                    };
                    const purchaseMessage = ContractUtils.getPurchasesMessage(0, [purchaseParam]);
                    const signatures = validatorWallets2.map((m) => ContractUtils.signMessage(m, purchaseMessage));

                    await expect(
                        providerContract.connect(validatorWallets[0]).savePurchase(0, [purchaseParam], signatures)
                    )
                        .to.emit(providerContract, "SavedPurchase")
                        .withArgs(
                            purchaseParam.purchaseId,
                            purchaseParam.amount,
                            purchaseParam.loyalty,
                            purchaseParam.currency,
                            purchaseParam.shopId,
                            purchaseParam.account,
                            purchaseParam.phone
                        )
                        .emit(ledgerContract, "ProvidedPoint")
                        .withNamedArgs({
                            account: userAccount,
                            providedPoint: amt,
                            providedValue: amt,
                            purchaseId: purchaseParam.purchaseId,
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

                    const point = ContractUtils.zeroGWEI(purchaseAmount.mul(purchase.providePercent).div(100));

                    if (oldValue !== undefined) expected.set(key, oldValue.add(point));
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
                    const providedAmount = ContractUtils.zeroGWEI(Amount.make(10000, 18).value.mul(1).div(100));
                    const exchangedAmount = ContractUtils.zeroGWEI(providedAmount.mul(multiple).div(rate));
                    expect(shopInfo1.providedAmount).to.equal(exchangedAmount);
                }
            });
        });

        context("Pay point", () => {
            it("Pay point - Success", async () => {
                const purchase = {
                    purchaseId: getPurchaseId(),
                    amount: 100,
                    providePercent: 1,
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
                    .to.emit(consumerContract, "ProvidedTokenForSettlement")
                    .withNamedArgs({
                        account: settlements.address,
                        shopId: shop.shopId,
                        providedPoint: Amount.make(100, 18).value,
                    });

                const rate = await currencyContract.get(shop.currency);
                const shopInfo = await shopContract.shopOf(shop.shopId);
                expect(shopInfo.providedAmount).to.equal(Amount.make(0, 18).value);
                expect(shopInfo.usedAmount).to.equal(
                    ContractUtils.zeroGWEI(Amount.make(100, 18).value.mul(multiple).div(rate))
                );
                expect(shopInfo.settledAmount).to.equal(
                    ContractUtils.zeroGWEI(Amount.make(100, 18).value.mul(multiple).div(rate))
                );
            });
        });

        context("Change Loyalty Type", () => {
            it("Change Loyalty Type (user: 0)", async () => {
                const userIndex = 0;

                const nonce = await ledgerContract.nonceOf(userWallets[userIndex].address);
                const signature = await ContractUtils.signLoyaltyType(userWallets[userIndex], nonce);
                await expect(
                    exchangerContract.connect(relay).changeToLoyaltyToken(userWallets[userIndex].address, signature)
                )
                    .to.emit(exchangerContract, "ChangedToLoyaltyToken")
                    .withNamedArgs({ account: userWallets[userIndex].address });
            });
        });

        context("Deposit token", () => {
            it("Deposit token - Success", async () => {
                const userIndex = 0;
                const oldTokenBalance = await ledgerContract.tokenBalanceOf(userWallets[userIndex].address);
                await tokenContract.connect(userWallets[userIndex]).approve(ledgerContract.address, amount.value);
                await expect(ledgerContract.connect(userWallets[userIndex]).deposit(amount.value))
                    .to.emit(ledgerContract, "Deposited")
                    .withNamedArgs({
                        account: userWallets[userIndex].address,
                        depositedToken: amount.value,
                        balanceToken: oldTokenBalance.add(amount.value),
                    });
                expect(await ledgerContract.tokenBalanceOf(userWallets[userIndex].address)).to.deep.equal(
                    oldTokenBalance.add(amount.value)
                );
            });
        });

        context("Pay token", () => {
            it("Pay token - Success", async () => {
                const purchase: IPurchaseData = {
                    purchaseId: getPurchaseId(),
                    amount: 500,
                    providePercent: 1,
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
                expect(shopInfo2.providedAmount).to.equal(
                    ContractUtils.zeroGWEI(Amount.make(100, 18).value.mul(multiple).div(rate))
                );
                expect(shopInfo2.usedAmount).to.equal(
                    ContractUtils.zeroGWEI(Amount.make(500, 18).value.mul(multiple).div(rate))
                );
                expect(shopInfo2.settledAmount).to.equal(
                    ContractUtils.zeroGWEI(Amount.make(400, 18).value.mul(multiple).div(rate))
                );
            });
        });

        context("Withdrawal of settlement", () => {
            const shopIndex = 2;
            const shop = shopData[shopIndex];
            let rate: BigNumber;
            let amount2: BigNumber;
            it("Check Settlement", async () => {
                rate = await currencyContract.get(shop.currency);
                amount2 = ContractUtils.zeroGWEI(Amount.make(400, 18).value.mul(multiple).div(rate));
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
                        .connect(shopData[shopIndex].wallet.connect(waffle.provider))
                        .openWithdrawal(shop.shopId, amount2, shopData[shopIndex].wallet.address, signature)
                )
                    .to.emit(shopContract, "OpenedWithdrawal")
                    .withNamedArgs({
                        shopId: shop.shopId,
                        amount: amount2,
                        account: shopWallets[shopIndex].address,
                        withdrawId: 1,
                    });
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
                        .connect(shopData[shopIndex].wallet.connect(waffle.provider))
                        .closeWithdrawal(shop.shopId, shopData[shopIndex].wallet.address, signature)
                )
                    .to.emit(shopContract, "ClosedWithdrawal")
                    .withNamedArgs({
                        shopId: shop.shopId,
                        amount: amount2,
                        account: shopWallets[shopIndex].address,
                        withdrawId: 1,
                    });
                const withdrawalAmount = await shopContract.withdrawableOf(shop.shopId);
                expect(withdrawalAmount).to.equal(0);
            });
        });
    });
});
