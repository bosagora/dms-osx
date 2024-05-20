import "@nomiclabs/hardhat-ethers";
import "@nomiclabs/hardhat-waffle";
import "@openzeppelin/hardhat-upgrades";
import { waffle } from "hardhat";

import { Amount } from "../src/utils/Amount";
import { ContractUtils, LoyaltyNetworkID } from "../src/utils/ContractUtils";
import {
    CurrencyRate,
    ERC20,
    Ledger,
    LoyaltyBurner,
    LoyaltyConsumer,
    LoyaltyExchanger,
    LoyaltyProvider,
    LoyaltyTransfer,
    PhoneLinkCollection,
    Shop,
    Validator,
} from "../typechain-types";

import chai, { expect } from "chai";
import { solidity } from "ethereum-waffle";

import { BigNumber, Wallet } from "ethers";

import { AddressZero } from "@ethersproject/constants";
import { Deployments } from "./helper/Deployments";

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
    const deployments = new Deployments();
    const phoneHashes: string[] = [
        ContractUtils.getPhoneHash("08201012341001"),
        ContractUtils.getPhoneHash("08201012341002"),
        ContractUtils.getPhoneHash("08201012341003"),
        ContractUtils.getPhoneHash("08201012341004"),
        ContractUtils.getPhoneHash("08201012341005"),
        ContractUtils.getPhoneHash("08201012341006"),
    ];
    let validatorContract: Validator;
    let tokenContract: ERC20;
    let ledgerContract: Ledger;
    let linkContract: PhoneLinkCollection;
    let currencyContract: CurrencyRate;
    let shopContract: Shop;
    let providerContract: LoyaltyProvider;
    let consumerContract: LoyaltyConsumer;
    let exchangerContract: LoyaltyExchanger;
    let burnerContract: LoyaltyBurner;
    let transferContract: LoyaltyTransfer;

    const multiple = BigNumber.from(1000000000);
    const price = BigNumber.from(150).mul(multiple);

    const amount = Amount.make(100_000, 18);
    const assetAmount = Amount.make(10_000_000, 18);

    const addShopData = async (shopData: IShopData[]) => {
        for (const elem of shopData) {
            const nonce = await shopContract.nonceOf(elem.wallet.address);
            const message = ContractUtils.getShopAccountMessage(elem.shopId, elem.wallet.address, nonce);
            const signature = await ContractUtils.signMessage(elem.wallet, message);
            await shopContract
                .connect(deployments.accounts.certifiers[0])
                .add(elem.shopId, elem.name, elem.currency, elem.wallet.address, signature);
        }
    };

    const deployAllContract = async (shopData: IShopData[]) => {
        await deployments.doDeployAll();

        tokenContract = deployments.getContract("TestLYT") as ERC20;
        validatorContract = deployments.getContract("Validator") as Validator;
        currencyContract = deployments.getContract("CurrencyRate") as CurrencyRate;

        ledgerContract = deployments.getContract("Ledger") as Ledger;
        linkContract = deployments.getContract("PhoneLinkCollection") as PhoneLinkCollection;
        shopContract = deployments.getContract("Shop") as Shop;
        providerContract = deployments.getContract("LoyaltyProvider") as LoyaltyProvider;
        consumerContract = deployments.getContract("LoyaltyConsumer") as LoyaltyConsumer;
        exchangerContract = deployments.getContract("LoyaltyExchanger") as LoyaltyExchanger;
        burnerContract = deployments.getContract("LoyaltyBurner") as LoyaltyBurner;
        transferContract = deployments.getContract("LoyaltyTransfer") as LoyaltyTransfer;
        await addShopData(shopData);
    };

    let purchaseId = 0;
    const getPurchaseId = (): string => {
        const res = "P" + purchaseId.toString().padStart(10, "0");
        purchaseId++;
        return res;
    };

    let requestId: string;
    let secret: string;
    let secretLock: string;

    context("Save Purchase Data & Pay", () => {
        const userData: IUserData[] = [
            {
                phone: "08201012341001",
                address: deployments.accounts.users[0].address,
                privateKey: deployments.accounts.users[0].privateKey,
            },
            {
                phone: "08201012341002",
                address: deployments.accounts.users[1].address,
                privateKey: deployments.accounts.users[1].privateKey,
            },
            {
                phone: "08201012341003",
                address: deployments.accounts.users[2].address,
                privateKey: deployments.accounts.users[2].privateKey,
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
                wallet: deployments.accounts.shops[0],
            },
            {
                shopId: "",
                name: "Shop2",
                currency: "krw",
                wallet: deployments.accounts.shops[1],
            },
            {
                shopId: "",
                name: "Shop3",
                currency: "krw",
                wallet: deployments.accounts.shops[2],
            },
            {
                shopId: "",
                name: "Shop4",
                currency: "krw",
                wallet: deployments.accounts.shops[3],
            },
            {
                shopId: "",
                name: "Shop5",
                currency: "krw",
                wallet: deployments.accounts.shops[4],
            },
            {
                shopId: "",
                name: "Shop6",
                currency: "krw",
                wallet: deployments.accounts.shops[5],
            },
        ];

        before("Set Shop ID", async () => {
            for (const elem of shopData) {
                elem.shopId = ContractUtils.getShopId(elem.wallet.address, LoyaltyNetworkID.LYT);
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
                        sender: deployments.accounts.foundation.address,
                    };
                    const purchaseMessage = ContractUtils.getPurchasesMessage(0, [purchaseParam]);
                    const signatures = deployments.accounts.validators.map((m) =>
                        ContractUtils.signMessage(m, purchaseMessage)
                    );
                    await expect(
                        providerContract
                            .connect(deployments.accounts.deployer)
                            .savePurchase(0, [purchaseParam], signatures)
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
                            sender: deployments.accounts.foundation.address,
                        };
                        const purchaseMessage = ContractUtils.getPurchasesMessage(0, [purchaseParam]);
                        const signatures = deployments.accounts.validators.map((m) =>
                            ContractUtils.signMessage(m, purchaseMessage)
                        );
                        await expect(
                            providerContract
                                .connect(deployments.accounts.validators[0])
                                .savePurchase(0, [purchaseParam], signatures)
                        )
                            .to.emit(providerContract, "SavedPurchase")
                            .withArgs(
                                purchaseParam.purchaseId,
                                purchaseParam.amount,
                                purchaseParam.loyalty,
                                purchaseParam.currency,
                                purchaseParam.shopId,
                                purchaseParam.account,
                                purchaseParam.phone,
                                purchaseParam.sender
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
                            sender: deployments.accounts.foundation.address,
                        };
                        const purchaseMessage = ContractUtils.getPurchasesMessage(0, [purchaseParam]);
                        const signatures = deployments.accounts.validators.map((m) =>
                            ContractUtils.signMessage(m, purchaseMessage)
                        );
                        await expect(
                            providerContract
                                .connect(deployments.accounts.validators[0])
                                .savePurchase(0, [purchaseParam], signatures)
                        )
                            .to.emit(providerContract, "SavedPurchase")
                            .withArgs(
                                purchaseParam.purchaseId,
                                purchaseParam.amount,
                                purchaseParam.loyalty,
                                purchaseParam.currency,
                                purchaseParam.shopId,
                                purchaseParam.account,
                                purchaseParam.phone,
                                purchaseParam.sender
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
                    sender: deployments.accounts.foundation.address,
                };
                const purchaseMessage = ContractUtils.getPurchasesMessage(0, [purchaseParam]);
                const signatures = deployments.accounts.validators.map((m) =>
                    ContractUtils.signMessage(m, purchaseMessage)
                );
                await expect(
                    providerContract
                        .connect(deployments.accounts.validators[0])
                        .savePurchase(0, [purchaseParam], signatures)
                )
                    .to.emit(providerContract, "SavedPurchase")
                    .withArgs(
                        purchaseParam.purchaseId,
                        purchaseParam.amount,
                        purchaseParam.loyalty,
                        purchaseParam.currency,
                        purchaseParam.shopId,
                        purchaseParam.account,
                        purchaseParam.phone,
                        purchaseParam.sender
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
                const nonce = await linkContract.nonceOf(deployments.accounts.users[3].address);
                const hash = phoneHashes[3];
                const msg = ContractUtils.getRequestMessage(hash, deployments.accounts.users[3].address, nonce);
                const signature = await ContractUtils.signMessage(deployments.accounts.users[3], msg);
                requestId = ContractUtils.getRequestId(hash, deployments.accounts.users[3].address, nonce);
                await expect(
                    linkContract
                        .connect(deployments.accounts.certifiers[0])
                        .addRequest(requestId, hash, deployments.accounts.users[3].address, signature)
                )
                    .to.emit(linkContract, "AddedRequestItem")
                    .withArgs(requestId, hash, deployments.accounts.users[3].address);
                await linkContract.connect(deployments.accounts.linkValidators[0]).voteRequest(requestId);
                await linkContract.connect(deployments.accounts.linkValidators[0]).countVote(requestId);
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
                const oldPointBalance = await ledgerContract.pointBalanceOf(
                    deployments.accounts.users[purchase.userIndex].address
                );
                const oldTokenBalance = await ledgerContract.tokenBalanceOf(
                    deployments.accounts.users[purchase.userIndex].address
                );
                const oldFoundationTokenBalance = await ledgerContract.tokenBalanceOf(
                    deployments.accounts.foundation.address
                );

                const purchaseParam = {
                    purchaseId: getPurchaseId(),
                    amount: purchaseAmount,
                    loyalty: loyaltyAmount,
                    currency: purchase.currency.toLowerCase(),
                    shopId: shopData[purchase.shopIndex].shopId,
                    account: userAccount,
                    phone: phoneHash,
                    sender: deployments.accounts.foundation.address,
                };
                const purchaseMessage = ContractUtils.getPurchasesMessage(0, [purchaseParam]);
                const signatures = deployments.accounts.validators.map((m) =>
                    ContractUtils.signMessage(m, purchaseMessage)
                );

                await expect(
                    providerContract
                        .connect(deployments.accounts.validators[0])
                        .savePurchase(0, [purchaseParam], signatures)
                )
                    .to.emit(providerContract, "SavedPurchase")
                    .withArgs(
                        purchaseParam.purchaseId,
                        purchaseParam.amount,
                        purchaseParam.loyalty,
                        purchaseParam.currency,
                        purchaseParam.shopId,
                        purchaseParam.account,
                        purchaseParam.phone,
                        purchaseParam.sender
                    )
                    .emit(ledgerContract, "ProvidedPoint")
                    .withNamedArgs({
                        account: deployments.accounts.users[3].address,
                        providedPoint: pointAmount,
                        providedValue: pointAmount,
                        purchaseId: purchaseParam.purchaseId,
                    });
                expect(await ledgerContract.unPayablePointBalanceOf(phoneHash)).to.deep.equal(oldUnPayablePointBalance);
                expect(
                    await ledgerContract.pointBalanceOf(deployments.accounts.users[purchase.userIndex].address)
                ).to.deep.equal(oldPointBalance.add(pointAmount));
                expect(
                    await ledgerContract.tokenBalanceOf(deployments.accounts.users[purchase.userIndex].address)
                ).to.deep.equal(oldTokenBalance);
                expect(await ledgerContract.tokenBalanceOf(deployments.accounts.foundation.address)).to.deep.equal(
                    oldFoundationTokenBalance
                );
            });

            it("Change to payable point (user: 3, point type : 0)", async () => {
                const userIndex = 3;
                const oldBalance = await ledgerContract.pointBalanceOf(deployments.accounts.users[userIndex].address);
                const phoneHash = ContractUtils.getPhoneHash(userData[userIndex].phone);
                const nonce = await ledgerContract.nonceOf(deployments.accounts.users[userIndex].address);
                const signature = await ContractUtils.signChangePayablePoint(
                    deployments.accounts.users[userIndex],
                    phoneHash,
                    nonce
                );
                const unPayableAmount = await ledgerContract.unPayablePointBalanceOf(phoneHash);
                await expect(
                    exchangerContract
                        .connect(deployments.accounts.certifiers[0])
                        .changeToPayablePoint(phoneHash, deployments.accounts.users[userIndex].address, signature)
                )
                    .to.emit(exchangerContract, "ChangedToPayablePoint")
                    .withNamedArgs({
                        phone: phoneHash,
                        account: deployments.accounts.users[userIndex].address,
                        changedPoint: unPayableAmount,
                    });
                expect(await ledgerContract.pointBalanceOf(deployments.accounts.users[userIndex].address)).to.equal(
                    oldBalance.add(unPayableAmount)
                );
                expect(await ledgerContract.unPayablePointBalanceOf(phoneHash)).to.equal(0);
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
                const oldPointBalance = await ledgerContract.pointBalanceOf(
                    deployments.accounts.users[purchase.userIndex].address
                );
                const oldTokenBalance = await ledgerContract.tokenBalanceOf(
                    deployments.accounts.users[purchase.userIndex].address
                );
                const oldFoundationTokenBalance = await ledgerContract.tokenBalanceOf(
                    deployments.accounts.foundation.address
                );

                const purchaseParam = {
                    purchaseId: getPurchaseId(),
                    amount: purchaseAmount,
                    loyalty: loyaltyAmount,
                    currency: purchase.currency.toLowerCase(),
                    shopId: shopData[purchase.shopIndex].shopId,
                    account: userAccount,
                    phone: phoneHash,
                    sender: deployments.accounts.foundation.address,
                };
                const purchaseMessage = ContractUtils.getPurchasesMessage(0, [purchaseParam]);
                const signatures = deployments.accounts.validators.map((m) =>
                    ContractUtils.signMessage(m, purchaseMessage)
                );

                await expect(
                    providerContract
                        .connect(deployments.accounts.validators[0])
                        .savePurchase(0, [purchaseParam], signatures)
                )
                    .to.emit(providerContract, "SavedPurchase")
                    .withArgs(
                        purchaseParam.purchaseId,
                        purchaseParam.amount,
                        purchaseParam.loyalty,
                        purchaseParam.currency,
                        purchaseParam.shopId,
                        purchaseParam.account,
                        purchaseParam.phone,
                        purchaseParam.sender
                    )
                    .emit(ledgerContract, "ProvidedPoint")
                    .withNamedArgs({
                        account: userAccount,
                        providedPoint: pointAmount,
                        providedValue: pointAmount,
                        purchaseId: purchaseParam.purchaseId,
                    });
                expect(await ledgerContract.unPayablePointBalanceOf(phoneHash)).to.deep.equal(oldUnPayablePointBalance);
                expect(
                    await ledgerContract.pointBalanceOf(deployments.accounts.users[purchase.userIndex].address)
                ).to.deep.equal(oldPointBalance.add(pointAmount));
                expect(
                    await ledgerContract.tokenBalanceOf(deployments.accounts.users[purchase.userIndex].address)
                ).to.deep.equal(oldTokenBalance);
                expect(await ledgerContract.tokenBalanceOf(deployments.accounts.foundation.address)).to.deep.equal(
                    oldFoundationTokenBalance
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
                    sender: deployments.accounts.foundation.address,
                };
                const purchaseMessage = ContractUtils.getPurchasesMessage(0, [purchaseParam]);
                const signatures = deployments.accounts.validators.map((m) =>
                    ContractUtils.signMessage(m, purchaseMessage)
                );

                await expect(
                    providerContract
                        .connect(deployments.accounts.validators[0])
                        .savePurchase(0, [purchaseParam], signatures)
                )
                    .to.emit(providerContract, "SavedPurchase")
                    .withArgs(
                        purchaseParam.purchaseId,
                        purchaseParam.amount,
                        purchaseParam.loyalty,
                        purchaseParam.currency,
                        purchaseParam.shopId,
                        purchaseParam.account,
                        purchaseParam.phone,
                        purchaseParam.sender
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
                const nonce = await linkContract.nonceOf(deployments.accounts.users[4].address);
                const hash = phoneHashes[4];
                const msg = ContractUtils.getRequestMessage(hash, deployments.accounts.users[4].address, nonce);
                const signature = await ContractUtils.signMessage(deployments.accounts.users[4], msg);
                requestId = ContractUtils.getRequestId(hash, deployments.accounts.users[4].address, nonce);
                await expect(
                    linkContract
                        .connect(deployments.accounts.certifiers[0])
                        .addRequest(requestId, hash, deployments.accounts.users[4].address, signature)
                )
                    .to.emit(linkContract, "AddedRequestItem")
                    .withArgs(requestId, hash, deployments.accounts.users[4].address);
                await linkContract.connect(deployments.accounts.linkValidators[0]).voteRequest(requestId);
                await linkContract.connect(deployments.accounts.linkValidators[0]).countVote(requestId);
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
                const oldPointBalance = await ledgerContract.pointBalanceOf(
                    deployments.accounts.users[purchase.userIndex].address
                );
                const oldTokenBalance = await ledgerContract.tokenBalanceOf(
                    deployments.accounts.users[purchase.userIndex].address
                );
                const oldFoundationTokenBalance = await ledgerContract.tokenBalanceOf(
                    deployments.accounts.foundation.address
                );

                const purchaseParam = {
                    purchaseId: getPurchaseId(),
                    amount: purchaseAmount,
                    loyalty: loyaltyAmount,
                    currency: purchase.currency.toLowerCase(),
                    shopId: shopData[purchase.shopIndex].shopId,
                    account: userAccount,
                    phone: phoneHash,
                    sender: deployments.accounts.foundation.address,
                };
                const purchaseMessage = ContractUtils.getPurchasesMessage(0, [purchaseParam]);
                const signatures = deployments.accounts.validators.map((m) =>
                    ContractUtils.signMessage(m, purchaseMessage)
                );

                await expect(
                    providerContract
                        .connect(deployments.accounts.validators[0])
                        .savePurchase(0, [purchaseParam], signatures)
                )
                    .to.emit(providerContract, "SavedPurchase")
                    .withArgs(
                        purchaseParam.purchaseId,
                        purchaseParam.amount,
                        purchaseParam.loyalty,
                        purchaseParam.currency,
                        purchaseParam.shopId,
                        purchaseParam.account,
                        purchaseParam.phone,
                        purchaseParam.sender
                    )
                    .emit(ledgerContract, "ProvidedPoint")
                    .withNamedArgs({
                        account: deployments.accounts.users[4].address,
                        providedPoint: pointAmount,
                        providedValue: pointAmount,
                        purchaseId: purchaseParam.purchaseId,
                    });
                expect(await ledgerContract.unPayablePointBalanceOf(phoneHash)).to.deep.equal(oldUnPayablePointBalance);
                expect(
                    await ledgerContract.pointBalanceOf(deployments.accounts.users[purchase.userIndex].address)
                ).to.deep.equal(oldPointBalance.add(pointAmount));
                expect(
                    await ledgerContract.tokenBalanceOf(deployments.accounts.users[purchase.userIndex].address)
                ).to.deep.equal(oldTokenBalance);
                expect(await ledgerContract.tokenBalanceOf(deployments.accounts.foundation.address)).to.deep.equal(
                    oldFoundationTokenBalance
                );
            });

            it("Change to payable point (user: 4, point type : 0)", async () => {
                const userIndex = 4;
                const oldBalance = await ledgerContract.pointBalanceOf(deployments.accounts.users[userIndex].address);
                const phoneHash = ContractUtils.getPhoneHash(userData[userIndex].phone);
                const nonce = await ledgerContract.nonceOf(deployments.accounts.users[userIndex].address);
                const signature = await ContractUtils.signChangePayablePoint(
                    deployments.accounts.users[userIndex],
                    phoneHash,
                    nonce
                );
                const unPayableAmount = await ledgerContract.unPayablePointBalanceOf(phoneHash);
                await expect(
                    exchangerContract
                        .connect(deployments.accounts.users[userIndex].connect(waffle.provider))
                        .changeToPayablePoint(phoneHash, deployments.accounts.users[userIndex].address, signature)
                )
                    .to.emit(exchangerContract, "ChangedToPayablePoint")
                    .withNamedArgs({
                        phone: phoneHash,
                        account: deployments.accounts.users[userIndex].address,
                        changedPoint: unPayableAmount,
                    });
                expect(await ledgerContract.pointBalanceOf(deployments.accounts.users[userIndex].address)).to.equal(
                    oldBalance.add(unPayableAmount)
                );
                expect(await ledgerContract.unPayablePointBalanceOf(phoneHash)).to.equal(0);
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
                    sender: deployments.accounts.foundation.address,
                };
                const purchaseMessage = ContractUtils.getPurchasesMessage(0, [purchaseParam]);
                const signatures = deployments.accounts.validators.map((m) =>
                    ContractUtils.signMessage(m, purchaseMessage)
                );

                await expect(
                    providerContract
                        .connect(deployments.accounts.validators[0])
                        .savePurchase(0, [purchaseParam], signatures)
                )
                    .to.emit(providerContract, "SavedPurchase")
                    .withArgs(
                        purchaseParam.purchaseId,
                        purchaseParam.amount,
                        purchaseParam.loyalty,
                        purchaseParam.currency,
                        purchaseParam.shopId,
                        purchaseParam.account,
                        purchaseParam.phone,
                        purchaseParam.sender
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

            it("Link phone-address (user: 5, point type : 0)", async () => {
                const userIndex = 5;
                const nonce = await linkContract.nonceOf(deployments.accounts.users[userIndex].address);
                const hash = phoneHashes[userIndex];
                const msg = ContractUtils.getRequestMessage(hash, deployments.accounts.users[userIndex].address, nonce);
                const signature = await ContractUtils.signMessage(deployments.accounts.users[userIndex], msg);
                requestId = ContractUtils.getRequestId(hash, deployments.accounts.users[userIndex].address, nonce);
                await expect(
                    linkContract
                        .connect(deployments.accounts.certifiers[0])
                        .addRequest(requestId, hash, deployments.accounts.users[userIndex].address, signature)
                )
                    .to.emit(linkContract, "AddedRequestItem")
                    .withArgs(requestId, hash, deployments.accounts.users[userIndex].address);
                await linkContract.connect(deployments.accounts.linkValidators[0]).voteRequest(requestId);
                await linkContract.connect(deployments.accounts.linkValidators[0]).countVote(requestId);
            });

            it("Change to payable point (user: 5, point type : 0)", async () => {
                const userIndex = 5;
                const oldBalance = await ledgerContract.tokenBalanceOf(deployments.accounts.users[userIndex].address);
                const phoneHash = ContractUtils.getPhoneHash(userData[userIndex].phone);
                const nonce = await ledgerContract.nonceOf(deployments.accounts.users[userIndex].address);
                const msg = ContractUtils.getRequestMessage(
                    phoneHash,
                    deployments.accounts.users[userIndex].address,
                    nonce
                );
                const signature = await ContractUtils.signMessage(deployments.accounts.users[userIndex], msg);
                const unPayableAmount = await ledgerContract.unPayablePointBalanceOf(phoneHash);
                await expect(
                    exchangerContract
                        .connect(deployments.accounts.certifiers[0])
                        .changeToPayablePoint(phoneHash, deployments.accounts.users[userIndex].address, signature)
                )
                    .to.emit(exchangerContract, "ChangedToPayablePoint")
                    .withNamedArgs({
                        phone: phoneHash,
                        account: deployments.accounts.users[userIndex].address,
                        changedPoint: unPayableAmount,
                    });

                expect(await ledgerContract.pointBalanceOf(deployments.accounts.users[userIndex].address)).to.equal(
                    oldBalance.add(unPayableAmount)
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

                const paymentId = ContractUtils.getPaymentId(deployments.accounts.users[purchase.userIndex].address, 0);
                const purchaseAmount = Amount.make(purchase.amount, 18).value;
                const shop = shopData[purchase.shopIndex];
                const nonce = await ledgerContract.nonceOf(deployments.accounts.users[purchase.userIndex].address);
                const signature = await ContractUtils.signLoyaltyNewPayment(
                    deployments.accounts.users[purchase.userIndex],
                    paymentId,
                    purchase.purchaseId,
                    purchaseAmount,
                    purchase.currency,
                    shop.shopId,
                    nonce
                );

                [secret, secretLock] = ContractUtils.getSecret();

                await expect(
                    consumerContract.connect(deployments.accounts.certifiers[0]).openNewLoyaltyPayment({
                        paymentId,
                        purchaseId: purchase.purchaseId,
                        amount: purchaseAmount,
                        currency: purchase.currency.toLowerCase(),
                        shopId: shop.shopId,
                        account: deployments.accounts.users[purchase.userIndex + 1].address,
                        signature,
                        secretLock,
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

                const nonce = await ledgerContract.nonceOf(deployments.accounts.users[purchase.userIndex].address);
                const paymentId = ContractUtils.getPaymentId(
                    deployments.accounts.users[purchase.userIndex].address,
                    nonce
                );
                const purchaseAmount = Amount.make(purchase.amount, 18).value;
                const shop = shopData[purchase.shopIndex];
                const signature = await ContractUtils.signLoyaltyNewPayment(
                    deployments.accounts.users[purchase.userIndex],
                    paymentId,
                    purchase.purchaseId,
                    purchaseAmount,
                    purchase.currency,
                    shop.shopId,
                    nonce
                );

                [secret, secretLock] = ContractUtils.getSecret();
                await expect(
                    consumerContract.connect(deployments.accounts.certifiers[0]).openNewLoyaltyPayment({
                        paymentId,
                        purchaseId: purchase.purchaseId,
                        amount: purchaseAmount,
                        currency: purchase.currency.toLowerCase(),
                        shopId: shop.shopId,
                        account: deployments.accounts.users[purchase.userIndex].address,
                        signature,
                        secretLock,
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

                const paymentId = ContractUtils.getPaymentId(deployments.accounts.users[purchase.userIndex].address, 0);
                const purchaseAmount = Amount.make(purchase.amount, 18).value;
                const shop = shopData[purchase.shopIndex];
                const nonce = await ledgerContract.nonceOf(deployments.accounts.users[purchase.userIndex].address);
                const signature = await ContractUtils.signLoyaltyNewPayment(
                    deployments.accounts.users[purchase.userIndex],
                    paymentId,
                    purchase.purchaseId,
                    purchaseAmount,
                    purchase.currency,
                    shop.shopId,
                    nonce
                );
                const feeAmount = ContractUtils.zeroGWEI(purchaseAmount.mul(await ledgerContract.getFee()).div(10000));
                const feeToken = ContractUtils.zeroGWEI(feeAmount.mul(multiple).div(price));
                const oldFeeBalance = await ledgerContract.tokenBalanceOf(deployments.accounts.fee.address);

                [secret, secretLock] = ContractUtils.getSecret();
                await expect(
                    consumerContract.connect(deployments.accounts.certifiers[0]).openNewLoyaltyPayment({
                        paymentId,
                        purchaseId: purchase.purchaseId,
                        amount: purchaseAmount,
                        currency: purchase.currency.toLowerCase(),
                        shopId: shop.shopId,
                        account: deployments.accounts.users[purchase.userIndex].address,
                        signature,
                        secretLock,
                    })
                ).to.emit(consumerContract, "LoyaltyPaymentEvent");

                const paymentData = await consumerContract.loyaltyPaymentOf(paymentId);
                expect(paymentData.paymentId).to.deep.equal(paymentId);
                expect(paymentData.purchaseId).to.deep.equal(purchase.purchaseId);
                expect(paymentData.currency).to.deep.equal(purchase.currency);
                expect(paymentData.shopId).to.deep.equal(shop.shopId);
                expect(paymentData.account).to.deep.equal(deployments.accounts.users[purchase.userIndex].address);
                expect(paymentData.paidPoint).to.deep.equal(purchaseAmount);
                expect(paymentData.paidValue).to.deep.equal(purchaseAmount);
                expect(paymentData.feePoint).to.deep.equal(feeAmount);
                expect(paymentData.feeValue).to.deep.equal(feeAmount);

                await expect(
                    consumerContract
                        .connect(deployments.accounts.certifiers[0])
                        .closeNewLoyaltyPayment(paymentId, secret, true)
                ).to.emit(consumerContract, "LoyaltyPaymentEvent");

                const newFeeBalance = await ledgerContract.tokenBalanceOf(deployments.accounts.fee.address);
                expect(newFeeBalance).to.deep.equal(oldFeeBalance.add(feeToken));
            });
        });

        context("Change to LoyaltyToken", () => {
            it("Check Balance", async () => {
                expect(await ledgerContract.pointBalanceOf(userData[1].address)).to.deep.equal(
                    Amount.make(1100, 18).value
                );
            });

            it("Change to LoyaltyToken", async () => {
                const oldBalance = await ledgerContract.pointBalanceOf(deployments.accounts.users[1].address);
                const pointAmount = Amount.make(500, 18).value;
                const tokenAmount = ContractUtils.zeroGWEI(pointAmount.mul(multiple).div(price));

                const nonce = await ledgerContract.nonceOf(deployments.accounts.users[1].address);
                const message = await ContractUtils.getChangePointToTokenMessage(
                    deployments.accounts.users[1].address,
                    pointAmount,
                    nonce
                );
                const signature = await ContractUtils.signMessage(deployments.accounts.users[1], message);
                await expect(
                    exchangerContract
                        .connect(deployments.accounts.certifiers[0])
                        .exchangePointToToken(deployments.accounts.users[1].address, pointAmount, signature)
                )
                    .to.emit(exchangerContract, "ChangedPointToToken")
                    .withNamedArgs({
                        account: deployments.accounts.users[1].address,
                        amountPoint: pointAmount,
                        amountToken: tokenAmount,
                    });

                const newBalance = await ledgerContract.pointBalanceOf(deployments.accounts.users[1].address);
                expect(newBalance).to.deep.equal(oldBalance.sub(pointAmount));
            });
        });
    });

    context("Many Save Purchase Data", () => {
        const userData: IUserData[] = [
            {
                phone: "08201012341001",
                address: deployments.accounts.users[0].address,
                privateKey: deployments.accounts.users[0].privateKey,
            },
        ];
        const shopData: IShopData[] = [
            {
                shopId: "",
                name: "Shop1",
                currency: "krw",
                wallet: deployments.accounts.shops[0],
            },
        ];

        const numPurchases = 64;

        before("Set Shop ID", async () => {
            for (const elem of shopData) {
                elem.shopId = ContractUtils.getShopId(elem.wallet.address, LoyaltyNetworkID.LYT);
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
                    sender: deployments.accounts.foundation.address,
                });
            }

            const purchaseMessage = ContractUtils.getPurchasesMessage(0, purchases);
            const signatures = deployments.accounts.validators.map((m) =>
                ContractUtils.signMessage(m, purchaseMessage)
            );
            const tx = await providerContract
                .connect(deployments.accounts.validators[0])
                .savePurchase(0, purchases, signatures);
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
                address: deployments.accounts.users[0].address,
                privateKey: deployments.accounts.users[0].privateKey,
            },
            {
                phone: "08201012341002",
                address: deployments.accounts.users[1].address,
                privateKey: deployments.accounts.users[1].privateKey,
            },
            {
                phone: "08201012341003",
                address: deployments.accounts.users[2].address,
                privateKey: deployments.accounts.users[2].privateKey,
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
                wallet: deployments.accounts.shops[0],
            },
            {
                shopId: "",
                name: "Shop2",
                currency: "krw",
                wallet: deployments.accounts.shops[1],
            },
            {
                shopId: "",
                name: "Shop3",
                currency: "krw",
                wallet: deployments.accounts.shops[2],
            },
            {
                shopId: "",
                name: "Shop4",
                currency: "krw",
                wallet: deployments.accounts.shops[3],
            },
            {
                shopId: "",
                name: "Shop5",
                currency: "krw",
                wallet: deployments.accounts.shops[4],
            },
            {
                shopId: "",
                name: "Shop6",
                currency: "krw",
                wallet: deployments.accounts.shops[5],
            },
        ];

        before("Set Shop ID", async () => {
            for (const elem of shopData) {
                elem.shopId = ContractUtils.getShopId(elem.wallet.address, LoyaltyNetworkID.LYT);
            }
        });

        before("Deploy", async () => {
            await deployAllContract(shopData);
        });

        context("Deposit token", () => {
            it("Deposit token - Success", async () => {
                const oldTokenBalance = await ledgerContract.tokenBalanceOf(deployments.accounts.users[0].address);
                await tokenContract
                    .connect(deployments.accounts.users[0])
                    .approve(ledgerContract.address, amount.value);
                await expect(ledgerContract.connect(deployments.accounts.users[0]).deposit(amount.value))
                    .to.emit(ledgerContract, "Deposited")
                    .withNamedArgs({
                        account: deployments.accounts.users[0].address,
                        depositedToken: amount.value,
                        balanceToken: oldTokenBalance.add(amount.value),
                    });
                expect(await ledgerContract.tokenBalanceOf(deployments.accounts.users[0].address)).to.deep.equal(
                    oldTokenBalance.add(amount.value)
                );
            });
        });

        context("Withdraw token", () => {
            it("Withdraw token - foundation account", async () => {
                await expect(
                    ledgerContract.connect(deployments.accounts.foundation).withdraw(BigNumber.from(100))
                ).to.revertedWith("1053");
            });

            it("Withdraw token - Insufficient balance", async () => {
                const oldTokenBalance = await ledgerContract.tokenBalanceOf(deployments.accounts.users[0].address);
                await expect(
                    ledgerContract.connect(deployments.accounts.users[0]).withdraw(oldTokenBalance.add(1000000000))
                ).to.revertedWith("1511");
            });

            it("Withdraw token - Success", async () => {
                const oldTokenBalance = await ledgerContract.tokenBalanceOf(deployments.accounts.users[0].address);
                await expect(ledgerContract.connect(deployments.accounts.users[0]).withdraw(amount.value))
                    .to.emit(ledgerContract, "Withdrawn")
                    .withNamedArgs({
                        account: deployments.accounts.users[0].address,
                        withdrawnToken: amount.value,
                        balanceToken: oldTokenBalance.sub(amount.value),
                    });
                expect(await ledgerContract.tokenBalanceOf(deployments.accounts.users[0].address)).to.deep.equal(
                    oldTokenBalance.sub(amount.value)
                );
            });
        });
    });

    context("Clearing for shops", () => {
        const userData: IUserData[] = [
            {
                phone: "08201012341001",
                address: deployments.accounts.users[0].address,
                privateKey: deployments.accounts.users[0].privateKey,
            },
            {
                phone: "08201012341002",
                address: deployments.accounts.users[1].address,
                privateKey: deployments.accounts.users[1].privateKey,
            },
            {
                phone: "08201012341003",
                address: deployments.accounts.users[2].address,
                privateKey: deployments.accounts.users[2].privateKey,
            },
            {
                phone: "08201012341004",
                address: deployments.accounts.users[3].address,
                privateKey: deployments.accounts.users[3].privateKey,
            },
            {
                phone: "08201012341005",
                address: deployments.accounts.users[4].address,
                privateKey: deployments.accounts.users[4].privateKey,
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
                wallet: deployments.accounts.shops[0],
            },
            {
                shopId: "F000200",
                name: "Shop2",
                currency: "krw",
                wallet: deployments.accounts.shops[1],
            },
            {
                shopId: "F000300",
                name: "Shop3",
                currency: "krw",
                wallet: deployments.accounts.shops[2],
            },
            {
                shopId: "F000400",
                name: "Shop4",
                currency: "krw",
                wallet: deployments.accounts.shops[3],
            },
            {
                shopId: "F000500",
                name: "Shop5",
                currency: "krw",
                wallet: deployments.accounts.shops[4],
            },
            {
                shopId: "F000600",
                name: "Shop6",
                currency: "krw",
                wallet: deployments.accounts.shops[5],
            },
        ];

        before("Set Shop ID", async () => {
            for (const elem of shopData) {
                elem.shopId = ContractUtils.getShopId(elem.wallet.address, LoyaltyNetworkID.LYT);
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
                        sender: deployments.accounts.foundation.address,
                    };
                    const purchaseMessage = ContractUtils.getPurchasesMessage(0, [purchaseParam]);
                    const signatures = deployments.accounts.validators.map((m) =>
                        ContractUtils.signMessage(m, purchaseMessage)
                    );

                    await expect(
                        providerContract
                            .connect(deployments.accounts.validators[0])
                            .savePurchase(0, [purchaseParam], signatures)
                    )
                        .to.emit(providerContract, "SavedPurchase")
                        .withArgs(
                            purchaseParam.purchaseId,
                            purchaseParam.amount,
                            purchaseParam.loyalty,
                            purchaseParam.currency,
                            purchaseParam.shopId,
                            purchaseParam.account,
                            purchaseParam.phone,
                            purchaseParam.sender
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

                const paymentId = ContractUtils.getPaymentId(deployments.accounts.users[purchase.userIndex].address, 0);
                const purchaseAmount = Amount.make(purchase.amount, 18).value;
                const shop = shopData[purchase.shopIndex];
                const nonce = await ledgerContract.nonceOf(deployments.accounts.users[purchase.userIndex].address);
                const signature = await ContractUtils.signLoyaltyNewPayment(
                    deployments.accounts.users[purchase.userIndex],
                    paymentId,
                    purchase.purchaseId,
                    purchaseAmount,
                    purchase.currency,
                    shop.shopId,
                    nonce
                );

                [secret, secretLock] = ContractUtils.getSecret();
                await expect(
                    consumerContract.connect(deployments.accounts.certifiers[0]).openNewLoyaltyPayment({
                        paymentId,
                        purchaseId: purchase.purchaseId,
                        amount: purchaseAmount,
                        currency: purchase.currency.toLowerCase(),
                        shopId: shop.shopId,
                        account: deployments.accounts.users[purchase.userIndex].address,
                        signature,
                        secretLock,
                    })
                ).to.emit(consumerContract, "LoyaltyPaymentEvent");

                await expect(
                    consumerContract
                        .connect(deployments.accounts.certifiers[0])
                        .closeNewLoyaltyPayment(paymentId, secret, true)
                )
                    .to.emit(consumerContract, "LoyaltyPaymentEvent")
                    .to.emit(consumerContract, "ProvidedTokenForSettlement")
                    .withNamedArgs({
                        account: deployments.accounts.settlement.address,
                        shopId: shop.shopId,
                        providedPoint: Amount.make(200, 18).value,
                    });

                const shopInfo = await shopContract.shopOf(shop.shopId);
                expect(shopInfo.providedAmount).to.equal(Amount.make(100, 18).value);
                expect(shopInfo.usedAmount).to.equal(Amount.make(300, 18).value);
                expect(shopInfo.settledAmount).to.equal(Amount.make(200, 18).value);
            });
        });

        context("Withdrawal of settlement", () => {
            const shopIndex = 1;
            const shop = shopData[shopIndex];
            const amount2 = Amount.make(200, 18).value;
            it("Check Settlement", async () => {
                const withdrawalAmount = await shopContract.withdrawableOf(shop.shopId);
                expect(withdrawalAmount).to.equal(amount2);
            });

            it("Open Withdrawal", async () => {
                const nonce = await shopContract.nonceOf(shopData[shopIndex].wallet.address);
                const message = ContractUtils.getShopAccountMessage(
                    shopData[shopIndex].shopId,
                    shopData[shopIndex].wallet.address,
                    nonce
                );
                const signature = await ContractUtils.signMessage(shopData[shopIndex].wallet, message);
                await expect(
                    shopContract
                        .connect(shopData[shopIndex].wallet.connect(waffle.provider))
                        .openWithdrawal(shop.shopId, amount2, shopData[shopIndex].wallet.address, signature)
                )
                    .to.emit(shopContract, "OpenedWithdrawal")
                    .withNamedArgs({
                        shopId: shop.shopId,
                        amount: amount2,
                        account: deployments.accounts.shops[shopIndex].address,
                    });
                const withdrawalAmount = await shopContract.withdrawableOf(shop.shopId);
                expect(withdrawalAmount).to.equal(amount2);
            });

            it("Close Withdrawal", async () => {
                const nonce = await shopContract.nonceOf(shopData[shopIndex].wallet.address);
                const message = ContractUtils.getShopAccountMessage(
                    shopData[shopIndex].shopId,
                    shopData[shopIndex].wallet.address,
                    nonce
                );
                const signature = await ContractUtils.signMessage(shopData[shopIndex].wallet, message);
                await expect(
                    shopContract
                        .connect(shopData[shopIndex].wallet.connect(waffle.provider))
                        .closeWithdrawal(shop.shopId, shopData[shopIndex].wallet.address, signature)
                )
                    .to.emit(shopContract, "ClosedWithdrawal")
                    .withNamedArgs({
                        shopId: shop.shopId,
                        amount: amount2,
                        account: deployments.accounts.shops[shopIndex].address,
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
                address: deployments.accounts.users[0].address,
                privateKey: deployments.accounts.users[0].privateKey,
            },
            {
                phone: "08201012341002",
                address: deployments.accounts.users[1].address,
                privateKey: deployments.accounts.users[1].privateKey,
            },
            {
                phone: "08201012341003",
                address: deployments.accounts.users[2].address,
                privateKey: deployments.accounts.users[2].privateKey,
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
                wallet: deployments.accounts.shops[0],
            },
            {
                shopId: "F000200",
                name: "Shop2",
                currency: "krw",
                wallet: deployments.accounts.shops[1],
            },
            {
                shopId: "F000300",
                name: "Shop3",
                currency: "krw",
                wallet: deployments.accounts.shops[2],
            },
            {
                shopId: "F000400",
                name: "Shop4",
                currency: "krw",
                wallet: deployments.accounts.shops[3],
            },
            {
                shopId: "F000500",
                name: "Shop5",
                currency: "krw",
                wallet: deployments.accounts.shops[4],
            },
            {
                shopId: "F000600",
                name: "Shop6",
                currency: "krw",
                wallet: deployments.accounts.shops[5],
            },
        ];

        before("Set Shop ID", async () => {
            for (const elem of shopData) {
                elem.shopId = ContractUtils.getShopId(elem.wallet.address, LoyaltyNetworkID.LYT);
            }
        });

        before("Deploy", async () => {
            await deployAllContract(shopData);
        });

        before("Set Other Currency", async () => {
            const height = 0;
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
            const signatures = deployments.accounts.validators.map((m) => ContractUtils.signMessage(m, message));
            await currencyContract.connect(deployments.accounts.validators[0]).set(height, rates, signatures);
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
                        sender: deployments.accounts.foundation.address,
                    };
                    const purchaseMessage = ContractUtils.getPurchasesMessage(0, [purchaseParam]);
                    const signatures = deployments.accounts.validators.map((m) =>
                        ContractUtils.signMessage(m, purchaseMessage)
                    );

                    await expect(
                        providerContract
                            .connect(deployments.accounts.validators[0])
                            .savePurchase(0, [purchaseParam], signatures)
                    )
                        .to.emit(providerContract, "SavedPurchase")
                        .withArgs(
                            purchaseParam.purchaseId,
                            purchaseParam.amount,
                            purchaseParam.loyalty,
                            purchaseParam.currency,
                            purchaseParam.shopId,
                            purchaseParam.account,
                            purchaseParam.phone,
                            purchaseParam.sender
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
                address: deployments.accounts.users[0].address,
                privateKey: deployments.accounts.users[0].privateKey,
            },
            {
                phone: "08201012341002",
                address: deployments.accounts.users[1].address,
                privateKey: deployments.accounts.users[1].privateKey,
            },
            {
                phone: "08201012341003",
                address: deployments.accounts.users[2].address,
                privateKey: deployments.accounts.users[2].privateKey,
            },
            {
                phone: "08201012341004",
                address: deployments.accounts.users[3].address,
                privateKey: deployments.accounts.users[3].privateKey,
            },
            {
                phone: "08201012341005",
                address: deployments.accounts.users[4].address,
                privateKey: deployments.accounts.users[4].privateKey,
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
                wallet: deployments.accounts.shops[0],
            },
            {
                shopId: "F000200",
                name: "Shop2",
                currency: "usd",
                wallet: deployments.accounts.shops[1],
            },
            {
                shopId: "F000300",
                name: "Shop3",
                currency: "jpy",
                wallet: deployments.accounts.shops[2],
            },
            {
                shopId: "F000400",
                name: "Shop4",
                currency: "usd",
                wallet: deployments.accounts.shops[3],
            },
        ];

        before("Set Shop ID", async () => {
            for (const elem of shopData) {
                elem.shopId = ContractUtils.getShopId(elem.wallet.address, LoyaltyNetworkID.LYT);
            }
        });

        before("Deploy", async () => {
            await deployAllContract(shopData);

            const height = 0;

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
            const signatures = deployments.accounts.validators.map((m) => ContractUtils.signMessage(m, message));
            await currencyContract.connect(deployments.accounts.validators[0]).set(height, rates, signatures);
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
                        sender: deployments.accounts.foundation.address,
                    };
                    const purchaseMessage = ContractUtils.getPurchasesMessage(0, [purchaseParam]);
                    const signatures = deployments.accounts.validators.map((m) =>
                        ContractUtils.signMessage(m, purchaseMessage)
                    );

                    await expect(
                        providerContract
                            .connect(deployments.accounts.validators[0])
                            .savePurchase(0, [purchaseParam], signatures)
                    )
                        .to.emit(providerContract, "SavedPurchase")
                        .withArgs(
                            purchaseParam.purchaseId,
                            purchaseParam.amount,
                            purchaseParam.loyalty,
                            purchaseParam.currency,
                            purchaseParam.shopId,
                            purchaseParam.account,
                            purchaseParam.phone,
                            purchaseParam.sender
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

                const paymentId = ContractUtils.getPaymentId(deployments.accounts.users[purchase.userIndex].address, 0);
                const purchaseAmount = Amount.make(purchase.amount, 18).value;
                const shop = shopData[purchase.shopIndex];
                const nonce = await ledgerContract.nonceOf(deployments.accounts.users[purchase.userIndex].address);
                const signature = await ContractUtils.signLoyaltyNewPayment(
                    deployments.accounts.users[purchase.userIndex],
                    paymentId,
                    purchase.purchaseId,
                    purchaseAmount,
                    purchase.currency,
                    shop.shopId,
                    nonce
                );

                [secret, secretLock] = ContractUtils.getSecret();
                await expect(
                    consumerContract.connect(deployments.accounts.certifiers[0]).openNewLoyaltyPayment({
                        paymentId,
                        purchaseId: purchase.purchaseId,
                        amount: purchaseAmount,
                        currency: purchase.currency.toLowerCase(),
                        shopId: shop.shopId,
                        account: deployments.accounts.users[purchase.userIndex].address,
                        signature,
                        secretLock,
                    })
                ).to.emit(consumerContract, "LoyaltyPaymentEvent");

                await expect(
                    consumerContract
                        .connect(deployments.accounts.certifiers[0])
                        .closeNewLoyaltyPayment(paymentId, secret, true)
                )
                    .to.emit(consumerContract, "LoyaltyPaymentEvent")
                    .to.emit(consumerContract, "ProvidedTokenForSettlement")
                    .withNamedArgs({
                        account: deployments.accounts.settlement.address,
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

        context("Withdrawal of settlement", () => {
            const shopIndex = 3;
            const shop = shopData[shopIndex];
            let rate: BigNumber;
            let amount2: BigNumber;
            it("Check Settlement", async () => {
                rate = await currencyContract.get(shop.currency);
                amount2 = ContractUtils.zeroGWEI(Amount.make(100, 18).value.mul(multiple).div(rate));
                const withdrawalAmount = await shopContract.withdrawableOf(shop.shopId);
                expect(withdrawalAmount).to.equal(amount2);
            });

            it("Open Withdrawal", async () => {
                const nonce = await shopContract.nonceOf(shopData[shopIndex].wallet.address);
                const message = ContractUtils.getShopAccountMessage(
                    shopData[shopIndex].shopId,
                    shopData[shopIndex].wallet.address,
                    nonce
                );
                const signature = await ContractUtils.signMessage(shopData[shopIndex].wallet, message);
                await expect(
                    shopContract
                        .connect(shopData[shopIndex].wallet.connect(waffle.provider))
                        .openWithdrawal(shop.shopId, amount2, shopData[shopIndex].wallet.address, signature)
                )
                    .to.emit(shopContract, "OpenedWithdrawal")
                    .withNamedArgs({
                        shopId: shop.shopId,
                        amount: amount2,
                        account: deployments.accounts.shops[shopIndex].address,
                        withdrawId: 1,
                    });
                const withdrawalAmount = await shopContract.withdrawableOf(shop.shopId);
                expect(withdrawalAmount).to.equal(amount2);
            });

            it("Close Withdrawal", async () => {
                const nonce = await shopContract.nonceOf(shopData[shopIndex].wallet.address);
                const message = ContractUtils.getShopAccountMessage(
                    shopData[shopIndex].shopId,
                    shopData[shopIndex].wallet.address,
                    nonce
                );
                const signature = await ContractUtils.signMessage(shopData[shopIndex].wallet, message);
                await expect(
                    shopContract
                        .connect(shopData[shopIndex].wallet.connect(waffle.provider))
                        .closeWithdrawal(shop.shopId, shopData[shopIndex].wallet.address, signature)
                )
                    .to.emit(shopContract, "ClosedWithdrawal")
                    .withNamedArgs({
                        shopId: shop.shopId,
                        amount: amount2,
                        account: deployments.accounts.shops[shopIndex].address,
                        withdrawId: 1,
                    });
                const withdrawalAmount = await shopContract.withdrawableOf(shop.shopId);
                expect(withdrawalAmount).to.equal(0);
            });
        });
    });

    context("Transfer", () => {
        const shopData: IShopData[] = [
            {
                shopId: "",
                name: "Shop1",
                currency: "krw",
                wallet: deployments.accounts.shops[0],
            },
            {
                shopId: "",
                name: "Shop2",
                currency: "krw",
                wallet: deployments.accounts.shops[1],
            },
            {
                shopId: "",
                name: "Shop3",
                currency: "krw",
                wallet: deployments.accounts.shops[2],
            },
            {
                shopId: "",
                name: "Shop4",
                currency: "krw",
                wallet: deployments.accounts.shops[3],
            },
            {
                shopId: "",
                name: "Shop5",
                currency: "krw",
                wallet: deployments.accounts.shops[4],
            },
            {
                shopId: "",
                name: "Shop6",
                currency: "krw",
                wallet: deployments.accounts.shops[5],
            },
        ];

        before("Set Shop ID", async () => {
            for (const elem of shopData) {
                elem.shopId = ContractUtils.getShopId(elem.wallet.address, LoyaltyNetworkID.LYT);
            }
        });

        before("Deploy", async () => {
            await deployAllContract(shopData);
        });

        it("Deposit token - Success", async () => {
            const oldTokenBalance = await ledgerContract.tokenBalanceOf(deployments.accounts.users[0].address);
            await tokenContract.connect(deployments.accounts.users[0]).approve(ledgerContract.address, amount.value);
            await expect(ledgerContract.connect(deployments.accounts.users[0]).deposit(amount.value))
                .to.emit(ledgerContract, "Deposited")
                .withNamedArgs({
                    account: deployments.accounts.users[0].address,
                    depositedToken: amount.value,
                    balanceToken: oldTokenBalance.add(amount.value),
                });
            expect(await ledgerContract.tokenBalanceOf(deployments.accounts.users[0].address)).to.deep.equal(
                oldTokenBalance.add(amount.value)
            );
        });

        it("Transfer token - foundation account ", async () => {
            const transferAmount = amount.value;
            const nonce = await ledgerContract.nonceOf(deployments.accounts.foundation.address);
            const message = await ContractUtils.getTransferMessage(
                deployments.accounts.foundation.address,
                deployments.accounts.users[1].address,
                transferAmount,
                nonce
            );
            const signature = ContractUtils.signMessage(deployments.accounts.foundation, message);
            await expect(
                transferContract.transferToken(
                    deployments.accounts.foundation.address,
                    deployments.accounts.users[1].address,
                    transferAmount,
                    signature
                )
            ).to.revertedWith("1051");
        });

        it("Transfer token - foundation account ", async () => {
            const transferAmount = amount.value;
            const nonce = await ledgerContract.nonceOf(deployments.accounts.users[0].address);
            const message = await ContractUtils.getTransferMessage(
                deployments.accounts.users[0].address,
                deployments.accounts.foundation.address,
                transferAmount,
                nonce
            );
            const signature = ContractUtils.signMessage(deployments.accounts.users[0], message);
            await expect(
                transferContract.transferToken(
                    deployments.accounts.users[0].address,
                    deployments.accounts.foundation.address,
                    transferAmount,
                    signature
                )
            ).to.revertedWith("1052");
        });

        it("Transfer token - Insufficient balance", async () => {
            const transferAmount = amount.value.mul(2);
            const nonce = await ledgerContract.nonceOf(deployments.accounts.users[0].address);
            const message = await ContractUtils.getTransferMessage(
                deployments.accounts.users[0].address,
                deployments.accounts.users[1].address,
                transferAmount,
                nonce
            );
            const signature = ContractUtils.signMessage(deployments.accounts.users[0], message);
            await expect(
                transferContract.transferToken(
                    deployments.accounts.users[0].address,
                    deployments.accounts.users[1].address,
                    transferAmount,
                    signature
                )
            ).to.revertedWith("1511");
        });

        it("Transfer token", async () => {
            const fee = await transferContract.getFee();
            const oldTokenBalance0 = await ledgerContract.tokenBalanceOf(deployments.accounts.users[0].address);
            const oldTokenBalance1 = await ledgerContract.tokenBalanceOf(deployments.accounts.users[1].address);
            const transferAmount = oldTokenBalance0.sub(fee);
            const nonce = await ledgerContract.nonceOf(deployments.accounts.users[0].address);
            const message = await ContractUtils.getTransferMessage(
                deployments.accounts.users[0].address,
                deployments.accounts.users[1].address,
                transferAmount,
                nonce
            );
            const signature = ContractUtils.signMessage(deployments.accounts.users[0], message);
            await expect(
                transferContract.transferToken(
                    deployments.accounts.users[0].address,
                    deployments.accounts.users[1].address,
                    transferAmount,
                    signature
                )
            )
                .emit(transferContract, "TransferredLoyaltyToken")
                .withNamedArgs({
                    from: deployments.accounts.users[0].address,
                    to: deployments.accounts.users[1].address,
                    amount: transferAmount,
                    fee,
                });
            const newTokenBalance0 = await ledgerContract.tokenBalanceOf(deployments.accounts.users[0].address);
            const newTokenBalance1 = await ledgerContract.tokenBalanceOf(deployments.accounts.users[1].address);
            expect(newTokenBalance0).to.deep.equal(oldTokenBalance0.sub(transferAmount.add(fee)));
            expect(newTokenBalance1).to.deep.equal(oldTokenBalance1.add(transferAmount));
        });
    });

    context("Remove Phone Info", () => {
        const userData: IUserData[] = [
            {
                phone: "08201012341001",
                address: deployments.accounts.users[0].address,
                privateKey: deployments.accounts.users[0].privateKey,
            },
            {
                phone: "08201012341002",
                address: deployments.accounts.users[1].address,
                privateKey: deployments.accounts.users[1].privateKey,
            },
            {
                phone: "08201012341003",
                address: deployments.accounts.users[2].address,
                privateKey: deployments.accounts.users[2].privateKey,
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

        const shopData: IShopData[] = [
            {
                shopId: "",
                name: "Shop1",
                currency: "krw",
                wallet: deployments.accounts.shops[0],
            },
            {
                shopId: "",
                name: "Shop2",
                currency: "krw",
                wallet: deployments.accounts.shops[1],
            },
            {
                shopId: "",
                name: "Shop3",
                currency: "krw",
                wallet: deployments.accounts.shops[2],
            },
            {
                shopId: "",
                name: "Shop4",
                currency: "krw",
                wallet: deployments.accounts.shops[3],
            },
            {
                shopId: "",
                name: "Shop5",
                currency: "krw",
                wallet: deployments.accounts.shops[4],
            },
            {
                shopId: "",
                name: "Shop6",
                currency: "krw",
                wallet: deployments.accounts.shops[5],
            },
        ];

        before("Set Shop ID", async () => {
            for (const elem of shopData) {
                elem.shopId = ContractUtils.getShopId(elem.wallet.address, LoyaltyNetworkID.LYT);
            }
        });

        before("Deploy", async () => {
            await deployAllContract(shopData);
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
                sender: deployments.accounts.foundation.address,
            };
            const purchaseMessage = ContractUtils.getPurchasesMessage(0, [purchaseParam]);
            const signatures = deployments.accounts.validators.map((m) =>
                ContractUtils.signMessage(m, purchaseMessage)
            );
            await expect(
                providerContract
                    .connect(deployments.accounts.validators[0])
                    .savePurchase(0, [purchaseParam], signatures)
            )
                .to.emit(providerContract, "SavedPurchase")
                .withArgs(
                    purchaseParam.purchaseId,
                    purchaseParam.amount,
                    purchaseParam.loyalty,
                    purchaseParam.currency,
                    purchaseParam.shopId,
                    purchaseParam.account,
                    purchaseParam.phone,
                    purchaseParam.sender
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
            const userIndex = 3;
            const nonce = await linkContract.nonceOf(deployments.accounts.users[userIndex].address);
            const hash = phoneHashes[3];
            const msg = ContractUtils.getRequestMessage(hash, deployments.accounts.users[userIndex].address, nonce);
            const signature = await ContractUtils.signMessage(deployments.accounts.users[userIndex], msg);
            requestId = ContractUtils.getRequestId(hash, deployments.accounts.users[userIndex].address, nonce);
            await expect(
                linkContract
                    .connect(deployments.accounts.certifiers[0])
                    .addRequest(requestId, hash, deployments.accounts.users[userIndex].address, signature)
            )
                .to.emit(linkContract, "AddedRequestItem")
                .withArgs(requestId, hash, deployments.accounts.users[userIndex].address);
            await linkContract.connect(deployments.accounts.linkValidators[0]).voteRequest(requestId);
            await linkContract.connect(deployments.accounts.linkValidators[0]).countVote(requestId);
        });

        it("Remove", async () => {
            const userIndex = 3;
            const nonce = await ledgerContract.nonceOf(deployments.accounts.users[userIndex].address);
            const hash = phoneHashes[3];
            const message = ContractUtils.getRemoveMessage(deployments.accounts.users[userIndex].address, nonce);
            const signature = await ContractUtils.signMessage(deployments.accounts.users[userIndex], message);

            await expect(ledgerContract.removePhoneInfo(deployments.accounts.users[userIndex].address, signature))
                .to.emit(ledgerContract, "RemovedPhoneInfo")
                .withArgs(hash, deployments.accounts.users[userIndex].address);
        });
    });
});
