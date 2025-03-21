import "@nomiclabs/hardhat-ethers";
import "@openzeppelin/hardhat-upgrades";

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

import { BytesLike } from "@ethersproject/bytes";
import { AddressZero, HashZero } from "@ethersproject/constants";
import { Deployments } from "./helper/Deployments";

import * as hre from "hardhat";

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

        tokenContract = deployments.getContract("TestKIOS") as ERC20;
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
                elem.shopId = ContractUtils.getShopId(elem.wallet.address, LoyaltyNetworkID.ACC_TESTNET);
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
                        sender: deployments.accounts.system.address,
                        signature: "",
                    };
                    purchaseParam.signature = await ContractUtils.getPurchaseSignature(
                        deployments.accounts.system,
                        purchaseParam
                    );
                    const purchaseMessage = ContractUtils.getPurchasesMessage(0, [purchaseParam]);
                    const signatures = await Promise.all(
                        deployments.accounts.validators.map((m) => ContractUtils.signMessage(m, purchaseMessage))
                    );
                    const proposeMessage = ContractUtils.getPurchasesProposeMessage(0, [purchaseParam], signatures);
                    const proposerSignature = await ContractUtils.signMessage(
                        deployments.accounts.deployer,
                        proposeMessage
                    );
                    await expect(
                        providerContract
                            .connect(deployments.accounts.certifiers[0])
                            .savePurchase(0, [purchaseParam], signatures, proposerSignature)
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
                            sender: deployments.accounts.system.address,
                            signature: "",
                        };
                        purchaseParam.signature = await ContractUtils.getPurchaseSignature(
                            deployments.accounts.system,
                            purchaseParam
                        );
                        const purchaseMessage = ContractUtils.getPurchasesMessage(0, [purchaseParam]);
                        const signatures = await Promise.all(
                            deployments.accounts.validators.map((m) => ContractUtils.signMessage(m, purchaseMessage))
                        );
                        const proposeMessage = ContractUtils.getPurchasesProposeMessage(0, [purchaseParam], signatures);
                        const proposerSignature = await ContractUtils.signMessage(
                            deployments.accounts.validators[0],
                            proposeMessage
                        );
                        await expect(
                            providerContract
                                .connect(deployments.accounts.certifiers[0])
                                .savePurchase(0, [purchaseParam], signatures, proposerSignature)
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
                            sender: deployments.accounts.system.address,
                            signature: "",
                        };
                        purchaseParam.signature = await ContractUtils.getPurchaseSignature(
                            deployments.accounts.system,
                            purchaseParam
                        );
                        const purchaseMessage = ContractUtils.getPurchasesMessage(0, [purchaseParam]);
                        const signatures = await Promise.all(
                            deployments.accounts.validators.map((m) => ContractUtils.signMessage(m, purchaseMessage))
                        );
                        const proposeMessage = ContractUtils.getPurchasesProposeMessage(0, [purchaseParam], signatures);
                        const proposerSignature = await ContractUtils.signMessage(
                            deployments.accounts.validators[0],
                            proposeMessage
                        );
                        await expect(
                            providerContract
                                .connect(deployments.accounts.certifiers[0])
                                .savePurchase(0, [purchaseParam], signatures, proposerSignature)
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
                    sender: deployments.accounts.system.address,
                    signature: "",
                };
                purchaseParam.signature = await ContractUtils.getPurchaseSignature(
                    deployments.accounts.system,
                    purchaseParam
                );
                const purchaseMessage = ContractUtils.getPurchasesMessage(0, [purchaseParam]);
                const signatures = await Promise.all(
                    deployments.accounts.validators.map((m) => ContractUtils.signMessage(m, purchaseMessage))
                );
                const proposeMessage = ContractUtils.getPurchasesProposeMessage(0, [purchaseParam], signatures);
                const proposerSignature = await ContractUtils.signMessage(
                    deployments.accounts.validators[0],
                    proposeMessage
                );
                await expect(
                    providerContract
                        .connect(deployments.accounts.certifiers[0])
                        .savePurchase(0, [purchaseParam], signatures, proposerSignature)
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
                await linkContract.connect(deployments.accounts.linkValidators[1]).voteRequest(requestId);
                await linkContract.connect(deployments.accounts.linkValidators[0]).countVote(requestId);
                expect(await linkContract.toAddress(hash)).to.be.equal(deployments.accounts.users[3].address);
                expect(await linkContract.toPhone(deployments.accounts.users[3].address)).to.be.equal(hash);
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
                const oldSystemTokenBalance = await ledgerContract.tokenBalanceOf(deployments.accounts.system.address);

                const purchaseParam = {
                    purchaseId: getPurchaseId(),
                    amount: purchaseAmount,
                    loyalty: loyaltyAmount,
                    currency: purchase.currency.toLowerCase(),
                    shopId: shopData[purchase.shopIndex].shopId,
                    account: userAccount,
                    phone: phoneHash,
                    sender: deployments.accounts.system.address,
                    signature: "",
                };
                purchaseParam.signature = await ContractUtils.getPurchaseSignature(
                    deployments.accounts.system,
                    purchaseParam
                );
                const purchaseMessage = ContractUtils.getPurchasesMessage(0, [purchaseParam]);
                const signatures = await Promise.all(
                    deployments.accounts.validators.map((m) => ContractUtils.signMessage(m, purchaseMessage))
                );
                const proposeMessage = ContractUtils.getPurchasesProposeMessage(0, [purchaseParam], signatures);
                const proposerSignature = await ContractUtils.signMessage(
                    deployments.accounts.validators[0],
                    proposeMessage
                );
                await expect(
                    providerContract
                        .connect(deployments.accounts.certifiers[0])
                        .savePurchase(0, [purchaseParam], signatures, proposerSignature)
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
                expect(await ledgerContract.tokenBalanceOf(deployments.accounts.system.address)).to.deep.equal(
                    oldSystemTokenBalance
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
                const oldSystemTokenBalance = await ledgerContract.tokenBalanceOf(deployments.accounts.system.address);

                const purchaseParam = {
                    purchaseId: getPurchaseId(),
                    amount: purchaseAmount,
                    loyalty: loyaltyAmount,
                    currency: purchase.currency.toLowerCase(),
                    shopId: shopData[purchase.shopIndex].shopId,
                    account: userAccount,
                    phone: phoneHash,
                    sender: deployments.accounts.system.address,
                    signature: "",
                };
                purchaseParam.signature = await ContractUtils.getPurchaseSignature(
                    deployments.accounts.system,
                    purchaseParam
                );
                const purchaseMessage = ContractUtils.getPurchasesMessage(0, [purchaseParam]);
                const signatures = await Promise.all(
                    deployments.accounts.validators.map((m) => ContractUtils.signMessage(m, purchaseMessage))
                );
                const proposeMessage = ContractUtils.getPurchasesProposeMessage(0, [purchaseParam], signatures);
                const proposerSignature = await ContractUtils.signMessage(
                    deployments.accounts.validators[0],
                    proposeMessage
                );
                await expect(
                    providerContract
                        .connect(deployments.accounts.certifiers[0])
                        .savePurchase(0, [purchaseParam], signatures, proposerSignature)
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
                expect(await ledgerContract.tokenBalanceOf(deployments.accounts.system.address)).to.deep.equal(
                    oldSystemTokenBalance
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
                    sender: deployments.accounts.system.address,
                    signature: "",
                };
                purchaseParam.signature = await ContractUtils.getPurchaseSignature(
                    deployments.accounts.system,
                    purchaseParam
                );
                const purchaseMessage = ContractUtils.getPurchasesMessage(0, [purchaseParam]);
                const signatures = await Promise.all(
                    deployments.accounts.validators.map((m) => ContractUtils.signMessage(m, purchaseMessage))
                );
                const proposeMessage = ContractUtils.getPurchasesProposeMessage(0, [purchaseParam], signatures);
                const proposerSignature = await ContractUtils.signMessage(
                    deployments.accounts.validators[0],
                    proposeMessage
                );
                await expect(
                    providerContract
                        .connect(deployments.accounts.certifiers[0])
                        .savePurchase(0, [purchaseParam], signatures, proposerSignature)
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
                await linkContract.connect(deployments.accounts.linkValidators[1]).voteRequest(requestId);
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
                const oldSystemTokenBalance = await ledgerContract.tokenBalanceOf(deployments.accounts.system.address);

                const purchaseParam = {
                    purchaseId: getPurchaseId(),
                    amount: purchaseAmount,
                    loyalty: loyaltyAmount,
                    currency: purchase.currency.toLowerCase(),
                    shopId: shopData[purchase.shopIndex].shopId,
                    account: userAccount,
                    phone: phoneHash,
                    sender: deployments.accounts.system.address,
                    signature: "",
                };
                purchaseParam.signature = await ContractUtils.getPurchaseSignature(
                    deployments.accounts.system,
                    purchaseParam
                );
                const purchaseMessage = ContractUtils.getPurchasesMessage(0, [purchaseParam]);
                const signatures = await Promise.all(
                    deployments.accounts.validators.map((m) => ContractUtils.signMessage(m, purchaseMessage))
                );
                const proposeMessage = ContractUtils.getPurchasesProposeMessage(0, [purchaseParam], signatures);
                const proposerSignature = await ContractUtils.signMessage(
                    deployments.accounts.validators[0],
                    proposeMessage
                );
                await expect(
                    providerContract
                        .connect(deployments.accounts.certifiers[0])
                        .savePurchase(0, [purchaseParam], signatures, proposerSignature)
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
                expect(await ledgerContract.tokenBalanceOf(deployments.accounts.system.address)).to.deep.equal(
                    oldSystemTokenBalance
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
                        .connect(deployments.accounts.users[userIndex].connect(hre.ethers.provider))
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
                    sender: deployments.accounts.system.address,
                    signature: "",
                };
                purchaseParam.signature = await ContractUtils.getPurchaseSignature(
                    deployments.accounts.system,
                    purchaseParam
                );
                const purchaseMessage = ContractUtils.getPurchasesMessage(0, [purchaseParam]);
                const signatures = await Promise.all(
                    deployments.accounts.validators.map((m) => ContractUtils.signMessage(m, purchaseMessage))
                );
                const proposeMessage = ContractUtils.getPurchasesProposeMessage(0, [purchaseParam], signatures);
                const proposerSignature = await ContractUtils.signMessage(
                    deployments.accounts.validators[0],
                    proposeMessage
                );
                await expect(
                    providerContract
                        .connect(deployments.accounts.certifiers[0])
                        .savePurchase(0, [purchaseParam], signatures, proposerSignature)
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
                await linkContract.connect(deployments.accounts.linkValidators[1]).voteRequest(requestId);
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
                const feeAmount = ContractUtils.zeroGWEI(
                    purchaseAmount.mul(await ledgerContract.getPaymentFee()).div(10000)
                );
                const feeToken = ContractUtils.zeroGWEI(feeAmount.mul(multiple).div(price));
                const oldFeeBalance = await ledgerContract.tokenBalanceOf(deployments.accounts.paymentFee.address);

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

                const newFeeBalance = await ledgerContract.tokenBalanceOf(deployments.accounts.paymentFee.address);
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
                const message = ContractUtils.getChangePointToTokenMessage(
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

        const numPurchases = 48;

        before("Set Shop ID", async () => {
            for (const elem of shopData) {
                elem.shopId = ContractUtils.getShopId(elem.wallet.address, LoyaltyNetworkID.ACC_TESTNET);
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
                const purchaseItem = {
                    purchaseId: getPurchaseId(),
                    amount: purchaseAmount,
                    loyalty: loyaltyAmount,
                    currency: "krw",
                    shopId: shopData[0].shopId,
                    account: userAccount,
                    phone: phoneHash,
                    sender: deployments.accounts.system.address,
                    signature: "",
                };
                purchaseItem.signature = await ContractUtils.getPurchaseSignature(
                    deployments.accounts.system,
                    purchaseItem
                );
                purchases.push(purchaseItem);
            }

            const purchaseMessage = ContractUtils.getPurchasesMessage(0, purchases);
            const signatures = await Promise.all(
                deployments.accounts.validators.map((m) => ContractUtils.signMessage(m, purchaseMessage))
            );
            const proposeMessage = ContractUtils.getPurchasesProposeMessage(0, purchases, signatures);
            const proposerSignature = await ContractUtils.signMessage(
                deployments.accounts.validators[0],
                proposeMessage
            );
            const tx = await providerContract
                .connect(deployments.accounts.certifiers[0])
                .savePurchase(0, purchases, signatures, proposerSignature);
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
                elem.shopId = ContractUtils.getShopId(elem.wallet.address, LoyaltyNetworkID.ACC_TESTNET);
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
            it("Withdraw token - system account", async () => {
                await expect(
                    ledgerContract.connect(deployments.accounts.system).withdraw(BigNumber.from(100))
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
                elem.shopId = ContractUtils.getShopId(elem.wallet.address, LoyaltyNetworkID.ACC_TESTNET);
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
            const signatures = await Promise.all(
                deployments.accounts.validators.map((m) => ContractUtils.signMessage(m, message))
            );
            const proposeMessage = ContractUtils.getCurrencyProposeMessage(height, rates, signatures);
            const proposerSignature = await ContractUtils.signMessage(
                deployments.accounts.validators[0],
                proposeMessage
            );
            await currencyContract
                .connect(deployments.accounts.certifiers[0])
                .set(height, rates, signatures, proposerSignature);
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
                        sender: deployments.accounts.system.address,
                        signature: "",
                    };
                    purchaseParam.signature = await ContractUtils.getPurchaseSignature(
                        deployments.accounts.system,
                        purchaseParam
                    );
                    const purchaseMessage = ContractUtils.getPurchasesMessage(0, [purchaseParam]);
                    const signatures = await Promise.all(
                        deployments.accounts.validators.map((m) => ContractUtils.signMessage(m, purchaseMessage))
                    );
                    const proposeMessage = ContractUtils.getPurchasesProposeMessage(0, [purchaseParam], signatures);
                    const proposerSignature = await ContractUtils.signMessage(
                        deployments.accounts.validators[0],
                        proposeMessage
                    );
                    await expect(
                        providerContract
                            .connect(deployments.accounts.certifiers[0])
                            .savePurchase(0, [purchaseParam], signatures, proposerSignature)
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
                elem.shopId = ContractUtils.getShopId(elem.wallet.address, LoyaltyNetworkID.ACC_TESTNET);
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
                        sender: deployments.accounts.system.address,
                        signature: "",
                    };
                    purchaseParam.signature = await ContractUtils.getPurchaseSignature(
                        deployments.accounts.system,
                        purchaseParam
                    );
                    const purchaseMessage = ContractUtils.getPurchasesMessage(0, [purchaseParam]);
                    const signatures = await Promise.all(
                        deployments.accounts.validators.map((m) => ContractUtils.signMessage(m, purchaseMessage))
                    );
                    const proposeMessage = ContractUtils.getPurchasesProposeMessage(0, [purchaseParam], signatures);
                    const proposerSignature = await ContractUtils.signMessage(
                        deployments.accounts.validators[0],
                        proposeMessage
                    );
                    await expect(
                        providerContract
                            .connect(deployments.accounts.certifiers[0])
                            .savePurchase(0, [purchaseParam], signatures, proposerSignature)
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
                ).to.emit(consumerContract, "LoyaltyPaymentEvent");

                const shopInfo = await shopContract.shopOf(shop.shopId);
                expect(shopInfo.providedAmount).to.equal(Amount.make(100, 18).value);
                expect(shopInfo.usedAmount).to.equal(Amount.make(300, 18).value);
            });
        });

        context("refund", () => {
            const shopIndex = 1;
            const shop = shopData[shopIndex];
            const amount2 = Amount.make(200, 18).value;
            let amountToken: BigNumber;

            it("Check refundable amount", async () => {
                const { refundableAmount, refundableToken } = await shopContract.refundableOf(shop.shopId);
                expect(refundableAmount).to.equal(amount2);
                amountToken = refundableToken;
            });

            it("refund", async () => {
                const nonce = await shopContract.nonceOf(shopData[shopIndex].wallet.address);
                const message = ContractUtils.getShopRefundMessage(shopData[shopIndex].shopId, amount2, nonce);
                const signature = await ContractUtils.signMessage(shopData[shopIndex].wallet, message);
                await expect(
                    shopContract
                        .connect(shopData[shopIndex].wallet.connect(hre.ethers.provider))
                        .refund(shop.shopId, amount2, signature)
                )
                    .to.emit(shopContract, "Refunded")
                    .withNamedArgs({
                        shopId: shop.shopId,
                        account: deployments.accounts.shops[shopIndex].address,
                        refundAmount: amount2,
                        amountToken,
                    });
            });

            it("Check refundable amount", async () => {
                const { refundableAmount } = await shopContract.refundableOf(shop.shopId);
                expect(refundableAmount).to.equal(0);
            });

            it("Check balance of ledger", async () => {
                const balance = await ledgerContract.tokenBalanceOf(shopData[shopIndex].wallet.address);
                expect(balance).to.equal(amountToken);
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
                elem.shopId = ContractUtils.getShopId(elem.wallet.address, LoyaltyNetworkID.ACC_TESTNET);
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
            const signatures = await Promise.all(
                deployments.accounts.validators.map((m) => ContractUtils.signMessage(m, message))
            );
            const proposeMessage = ContractUtils.getCurrencyProposeMessage(height, rates, signatures);
            const proposerSignature = await ContractUtils.signMessage(
                deployments.accounts.validators[0],
                proposeMessage
            );
            await currencyContract
                .connect(deployments.accounts.certifiers[0])
                .set(height, rates, signatures, proposerSignature);
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
                        sender: deployments.accounts.system.address,
                        signature: "",
                    };
                    purchaseParam.signature = await ContractUtils.getPurchaseSignature(
                        deployments.accounts.system,
                        purchaseParam
                    );
                    const purchaseMessage = ContractUtils.getPurchasesMessage(0, [purchaseParam]);
                    const signatures = await Promise.all(
                        deployments.accounts.validators.map((m) => ContractUtils.signMessage(m, purchaseMessage))
                    );
                    const proposeMessage = ContractUtils.getPurchasesProposeMessage(0, [purchaseParam], signatures);
                    const proposerSignature = await ContractUtils.signMessage(
                        deployments.accounts.validators[0],
                        proposeMessage
                    );
                    await expect(
                        providerContract
                            .connect(deployments.accounts.certifiers[0])
                            .savePurchase(0, [purchaseParam], signatures, proposerSignature)
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
                ).to.emit(consumerContract, "LoyaltyPaymentEvent");

                const rate = await currencyContract.get(shop.currency);
                const shopInfo = await shopContract.shopOf(shop.shopId);
                expect(shopInfo.providedAmount).to.equal(Amount.make(0, 18).value);
                expect(shopInfo.usedAmount).to.equal(
                    ContractUtils.zeroGWEI(Amount.make(100, 18).value.mul(multiple).div(rate))
                );
            });
        });

        context("refund", () => {
            const shopIndex = 3;
            const shop = shopData[shopIndex];
            let rate: BigNumber;
            let amount2: BigNumber;
            let amountToken: BigNumber;
            it("Check", async () => {
                rate = await currencyContract.get(shop.currency);
                amount2 = ContractUtils.zeroGWEI(Amount.make(100, 18).value.mul(multiple).div(rate));
                const { refundableAmount, refundableToken } = await shopContract.refundableOf(shop.shopId);
                expect(refundableAmount).to.equal(amount2);
                amountToken = refundableToken;
            });

            it("Open Withdrawal", async () => {
                const nonce = await shopContract.nonceOf(shopData[shopIndex].wallet.address);
                const message = ContractUtils.getShopRefundMessage(shopData[shopIndex].shopId, amount2, nonce);
                const signature = await ContractUtils.signMessage(shopData[shopIndex].wallet, message);
                await expect(
                    shopContract
                        .connect(shopData[shopIndex].wallet.connect(hre.ethers.provider))
                        .refund(shop.shopId, amount2, signature)
                )
                    .to.emit(shopContract, "Refunded")
                    .withNamedArgs({
                        shopId: shop.shopId,
                        account: deployments.accounts.shops[shopIndex].address,
                        refundAmount: amount2,
                        amountToken,
                    });
            });

            it("Check refundable amount", async () => {
                const { refundableAmount } = await shopContract.refundableOf(shop.shopId);
                expect(refundableAmount).to.equal(0);
            });

            it("Check balance of ledger", async () => {
                const balance = await ledgerContract.tokenBalanceOf(shopData[shopIndex].wallet.address);
                expect(balance).to.equal(amountToken);
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
                elem.shopId = ContractUtils.getShopId(elem.wallet.address, LoyaltyNetworkID.ACC_TESTNET);
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

        it("Transfer token - system account ", async () => {
            const transferAmount = amount.value;
            const nonce = await ledgerContract.nonceOf(deployments.accounts.system.address);
            const expiry = ContractUtils.getTimeStamp() + 3600;
            const message = ContractUtils.getTransferMessage(
                hre.ethers.provider.network.chainId,
                transferContract.address,
                deployments.accounts.system.address,
                deployments.accounts.users[1].address,
                transferAmount,
                nonce,
                expiry
            );
            const signature = await ContractUtils.signMessage(deployments.accounts.system, message);
            await expect(
                transferContract.transferToken(
                    deployments.accounts.system.address,
                    deployments.accounts.users[1].address,
                    transferAmount,
                    expiry,
                    signature
                )
            ).to.revertedWith("1051");
        });

        it("Transfer token - system account ", async () => {
            const transferAmount = amount.value;
            const nonce = await ledgerContract.nonceOf(deployments.accounts.users[0].address);
            const expiry = ContractUtils.getTimeStamp() + 3600;
            const message = ContractUtils.getTransferMessage(
                hre.ethers.provider.network.chainId,
                transferContract.address,
                deployments.accounts.users[0].address,
                deployments.accounts.system.address,
                transferAmount,
                nonce,
                expiry
            );
            const signature = await ContractUtils.signMessage(deployments.accounts.users[0], message);
            await expect(
                transferContract.transferToken(
                    deployments.accounts.users[0].address,
                    deployments.accounts.system.address,
                    transferAmount,
                    expiry,
                    signature
                )
            ).to.revertedWith("1052");
        });

        it("Transfer token - Insufficient balance", async () => {
            const fromBalance = await ledgerContract.tokenBalanceOf(deployments.accounts.users[0].address);
            const transferAmount = fromBalance.mul(2);
            const nonce = await ledgerContract.nonceOf(deployments.accounts.users[0].address);
            const expiry = ContractUtils.getTimeStamp() + 3600;
            const message = ContractUtils.getTransferMessage(
                hre.ethers.provider.network.chainId,
                transferContract.address,
                deployments.accounts.users[0].address,
                deployments.accounts.users[1].address,
                transferAmount,
                nonce,
                expiry
            );
            const signature = await ContractUtils.signMessage(deployments.accounts.users[0], message);
            await expect(
                transferContract.transferToken(
                    deployments.accounts.users[0].address,
                    deployments.accounts.users[1].address,
                    transferAmount,
                    expiry,
                    signature
                )
            ).to.revertedWith("1511");
        });

        it("Transfer token", async () => {
            const fee = await transferContract.getProtocolFee();
            const oldTokenBalance0 = await ledgerContract.tokenBalanceOf(deployments.accounts.users[0].address);
            const oldTokenBalance1 = await ledgerContract.tokenBalanceOf(deployments.accounts.users[1].address);
            const transferAmount = oldTokenBalance0.sub(fee);
            const nonce = await ledgerContract.nonceOf(deployments.accounts.users[0].address);
            const expiry = ContractUtils.getTimeStamp() + 3600;
            const message = ContractUtils.getTransferMessage(
                hre.ethers.provider.network.chainId,
                transferContract.address,
                deployments.accounts.users[0].address,
                deployments.accounts.users[1].address,
                transferAmount,
                nonce,
                expiry
            );
            const signature = await ContractUtils.signMessage(deployments.accounts.users[0], message);
            await expect(
                transferContract.transferToken(
                    deployments.accounts.users[0].address,
                    deployments.accounts.users[1].address,
                    transferAmount,
                    expiry,
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
            expect(newTokenBalance0).to.deep.equal(oldTokenBalance0.sub(transferAmount));
            expect(newTokenBalance1).to.deep.equal(oldTokenBalance1.add(transferAmount.sub(fee)));
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
                elem.shopId = ContractUtils.getShopId(elem.wallet.address, LoyaltyNetworkID.ACC_TESTNET);
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
                sender: deployments.accounts.system.address,
                signature: "",
            };
            purchaseParam.signature = await ContractUtils.getPurchaseSignature(
                deployments.accounts.system,
                purchaseParam
            );
            const purchaseMessage = ContractUtils.getPurchasesMessage(0, [purchaseParam]);
            const signatures = await Promise.all(
                deployments.accounts.validators.map((m) => ContractUtils.signMessage(m, purchaseMessage))
            );
            const proposeMessage = ContractUtils.getPurchasesProposeMessage(0, [purchaseParam], signatures);
            const proposerSignature = await ContractUtils.signMessage(
                deployments.accounts.validators[0],
                proposeMessage
            );
            await expect(
                providerContract
                    .connect(deployments.accounts.certifiers[0])
                    .savePurchase(0, [purchaseParam], signatures, proposerSignature)
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
            await linkContract.connect(deployments.accounts.linkValidators[1]).voteRequest(requestId);
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

    context("Clearing for shops - Not use settlement manager", () => {
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
                shopIndex: 2,
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
                amount: 10000000,
                providePercent: 1,
                currency: "krw",
                shopIndex: 4,
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
        ];

        before("Set Shop ID", async () => {
            for (const elem of shopData) {
                elem.shopId = ContractUtils.getShopId(elem.wallet.address, LoyaltyNetworkID.ACC_TESTNET);
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
                        sender: deployments.accounts.system.address,
                        signature: "",
                    };
                    purchaseParam.signature = await ContractUtils.getPurchaseSignature(
                        deployments.accounts.system,
                        purchaseParam
                    );
                    const purchaseMessage = ContractUtils.getPurchasesMessage(0, [purchaseParam]);
                    const signatures = await Promise.all(
                        deployments.accounts.validators.map((m) => ContractUtils.signMessage(m, purchaseMessage))
                    );
                    const proposeMessage = ContractUtils.getPurchasesProposeMessage(0, [purchaseParam], signatures);
                    const proposerSignature = await ContractUtils.signMessage(
                        deployments.accounts.validators[0],
                        proposeMessage
                    );
                    await expect(
                        providerContract
                            .connect(deployments.accounts.certifiers[0])
                            .savePurchase(0, [purchaseParam], signatures, proposerSignature)
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
                    Amount.make(10000 * 1, 18)
                        .value.mul(1)
                        .div(100)
                );

                const shopInfo2 = await shopContract.shopOf(shopData[1].shopId);
                expect(shopInfo2.providedAmount).to.equal(
                    Amount.make(10000 * 2, 18)
                        .value.mul(1)
                        .div(100)
                );
                const shopInfo3 = await shopContract.shopOf(shopData[2].shopId);
                expect(shopInfo3.providedAmount).to.equal(
                    Amount.make(10000 * 3, 18)
                        .value.mul(1)
                        .div(100)
                );
                const shopInfo4 = await shopContract.shopOf(shopData[3].shopId);
                expect(shopInfo4.providedAmount).to.equal(Amount.make(0, 18).value);
            });
        });

        context("Pay point", () => {
            it("Pay point - Success", async () => {
                const providedAmount = [100, 200, 300, 0].map((m) => Amount.make(m, 18).value);
                const usedAmount = [500, 500, 500, 500].map((m) => Amount.make(m, 18).value);
                for (let shopIndex = 0; shopIndex < 4; shopIndex++) {
                    const purchase = {
                        purchaseId: getPurchaseId(),
                        amount: 500,
                        providePercent: 1,
                        currency: "krw",
                        shopIndex,
                        userIndex: 0,
                    };

                    const paymentId = ContractUtils.getPaymentId(
                        deployments.accounts.users[purchase.userIndex].address,
                        0
                    );
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
                    ).to.emit(consumerContract, "LoyaltyPaymentEvent");

                    const shopInfo = await shopContract.shopOf(shop.shopId);
                    expect(shopInfo.providedAmount).to.equal(providedAmount[shopIndex]);
                    expect(shopInfo.usedAmount).to.equal(usedAmount[shopIndex]);
                }
            });
        });

        context("refund", () => {
            const expected = [400, 300, 200, 500].map((m) => Amount.make(m, 18).value);
            const amountToken: BigNumber[] = [];

            it("Check refundable amount", async () => {
                for (let shopIndex = 0; shopIndex < 4; shopIndex++) {
                    const shop = shopData[shopIndex];
                    const { refundableAmount, refundableToken } = await shopContract.refundableOf(shop.shopId);
                    expect(refundableAmount).to.equal(expected[shopIndex]);
                    amountToken.push(refundableToken);
                }
            });

            it("refund", async () => {
                for (let shopIndex = 0; shopIndex < 4; shopIndex++) {
                    const shop = shopData[shopIndex];
                    const nonce = await shopContract.nonceOf(shopData[shopIndex].wallet.address);
                    const message = ContractUtils.getShopRefundMessage(
                        shopData[shopIndex].shopId,
                        expected[shopIndex],
                        nonce
                    );
                    const signature = await ContractUtils.signMessage(shopData[shopIndex].wallet, message);
                    await expect(
                        shopContract
                            .connect(deployments.accounts.certifiers[0])
                            .refund(shop.shopId, expected[shopIndex], signature)
                    )
                        .to.emit(shopContract, "Refunded")
                        .withNamedArgs({
                            shopId: shop.shopId,
                            account: deployments.accounts.shops[shopIndex].address,
                            refundAmount: expected[shopIndex],
                            amountToken: amountToken[shopIndex],
                        });
                }
            });

            it("Check refundable amount", async () => {
                for (let shopIndex = 0; shopIndex < 4; shopIndex++) {
                    const shop = shopData[shopIndex];
                    const { refundableAmount } = await shopContract.refundableOf(shop.shopId);
                    expect(refundableAmount).to.equal(0);
                }
            });

            it("Check balance of ledger", async () => {
                for (let shopIndex = 0; shopIndex < 4; shopIndex++) {
                    const shop = shopData[shopIndex];
                    const balance = await ledgerContract.tokenBalanceOf(shop.wallet.address);
                    expect(balance).to.equal(amountToken[shopIndex++]);
                }
            });
        });
    });

    context("Clearing for shops - Use settlement manager", () => {
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
                shopIndex: 2,
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
                amount: 10000000,
                providePercent: 1,
                currency: "krw",
                shopIndex: 5,
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
                shopId: "F000500",
                name: "Shop6",
                currency: "krw",
                wallet: deployments.accounts.shops[5],
            },
        ];

        before("Set Shop ID", async () => {
            for (const elem of shopData) {
                elem.shopId = ContractUtils.getShopId(elem.wallet.address, LoyaltyNetworkID.ACC_TESTNET);
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
                        sender: deployments.accounts.system.address,
                        signature: "",
                    };
                    purchaseParam.signature = await ContractUtils.getPurchaseSignature(
                        deployments.accounts.system,
                        purchaseParam
                    );
                    const purchaseMessage = ContractUtils.getPurchasesMessage(0, [purchaseParam]);
                    const signatures = await Promise.all(
                        deployments.accounts.validators.map((m) => ContractUtils.signMessage(m, purchaseMessage))
                    );
                    const proposeMessage = ContractUtils.getPurchasesProposeMessage(0, [purchaseParam], signatures);
                    const proposerSignature = await ContractUtils.signMessage(
                        deployments.accounts.validators[0],
                        proposeMessage
                    );
                    await expect(
                        providerContract
                            .connect(deployments.accounts.certifiers[0])
                            .savePurchase(0, [purchaseParam], signatures, proposerSignature)
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
                    Amount.make(10000 * 1, 18)
                        .value.mul(1)
                        .div(100)
                );

                const shopInfo2 = await shopContract.shopOf(shopData[1].shopId);
                expect(shopInfo2.providedAmount).to.equal(
                    Amount.make(10000 * 2, 18)
                        .value.mul(1)
                        .div(100)
                );
                const shopInfo3 = await shopContract.shopOf(shopData[2].shopId);
                expect(shopInfo3.providedAmount).to.equal(
                    Amount.make(10000 * 3, 18)
                        .value.mul(1)
                        .div(100)
                );
                const shopInfo4 = await shopContract.shopOf(shopData[3].shopId);
                expect(shopInfo4.providedAmount).to.equal(Amount.make(0, 18).value);
            });
        });

        context("Pay point", () => {
            it("Pay point - Success", async () => {
                const providedAmount = [100, 200, 300, 0].map((m) => Amount.make(m, 18).value);
                const usedAmount = [500, 500, 500, 500].map((m) => Amount.make(m, 18).value);
                for (let shopIndex = 0; shopIndex < 4; shopIndex++) {
                    const purchase = {
                        purchaseId: getPurchaseId(),
                        amount: 500,
                        providePercent: 1,
                        currency: "krw",
                        shopIndex,
                        userIndex: 0,
                    };

                    const paymentId = ContractUtils.getPaymentId(
                        deployments.accounts.users[purchase.userIndex].address,
                        0
                    );
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
                    ).to.emit(consumerContract, "LoyaltyPaymentEvent");

                    const shopInfo = await shopContract.shopOf(shop.shopId);
                    expect(shopInfo.providedAmount).to.equal(providedAmount[shopIndex]);
                    expect(shopInfo.usedAmount).to.equal(usedAmount[shopIndex]);
                }
            });
        });

        context("setSettlementManager/removeSettlementManager", () => {
            const managerShop = shopData[4];
            const clients: BytesLike[] = [];

            it("prepare", async () => {
                for (let shopIndex = 0; shopIndex < 4; shopIndex++) {
                    clients.push(shopData[shopIndex].shopId);
                }
            });

            it("setSettlementManager", async () => {
                for (let shopIndex = 0; shopIndex < 4; shopIndex++) {
                    const shop = shopData[shopIndex];
                    const nonce = await shopContract.nonceOf(shop.wallet.address);
                    const message = ContractUtils.getSetSettlementManagerMessage(
                        shop.shopId,
                        managerShop.shopId,
                        nonce
                    );
                    const signature = ContractUtils.signMessage(shop.wallet, message);
                    await expect(
                        shopContract
                            .connect(deployments.accounts.certifiers[0])
                            .setSettlementManager(shop.shopId, managerShop.shopId, signature)
                    )
                        .to.emit(shopContract, "SetSettlementManager")
                        .withNamedArgs({
                            shopId: shop.shopId,
                            managerShopId: managerShop.shopId,
                        });
                }
            });

            it("check manager", async () => {
                for (let shopIndex = 0; shopIndex < 4; shopIndex++) {
                    const shop = shopData[shopIndex];
                    expect(await shopContract.settlementManagerOf(shop.shopId)).to.be.equal(managerShop.shopId);
                }
            });

            it("check client", async () => {
                expect(await shopContract.getSettlementClientLength(managerShop.shopId)).to.be.equal(clients.length);
                expect(await shopContract.getSettlementClientList(managerShop.shopId, 0, 2)).to.deep.equal(
                    clients.slice(0, 2)
                );
                expect(await shopContract.getSettlementClientList(managerShop.shopId, 1, 3)).to.deep.equal(
                    clients.slice(1, 3)
                );
                expect(await shopContract.getSettlementClientList(managerShop.shopId, 0, 4)).to.deep.equal(
                    clients.slice(0, 4)
                );
            });

            it("removeSettlementManager", async () => {
                for (let shopIndex = 0; shopIndex < 4; shopIndex++) {
                    const shop = shopData[shopIndex];
                    const nonce = await shopContract.nonceOf(shop.wallet.address);
                    const message = ContractUtils.getRemoveSettlementManagerMessage(shop.shopId, nonce);
                    const signature = ContractUtils.signMessage(shop.wallet, message);
                    await expect(
                        shopContract
                            .connect(deployments.accounts.certifiers[0])
                            .removeSettlementManager(shop.shopId, signature)
                    )
                        .to.emit(shopContract, "RemovedSettlementManager")
                        .withNamedArgs({
                            shopId: shop.shopId,
                            managerShopId: managerShop.shopId,
                        });
                }
            });

            it("check manager", async () => {
                for (let shopIndex = 0; shopIndex < 4; shopIndex++) {
                    const shop = shopData[shopIndex];
                    expect(await shopContract.settlementManagerOf(shop.shopId)).to.be.equal(HashZero);
                }
            });

            it("check client", async () => {
                expect(await shopContract.getSettlementClientLength(managerShop.shopId)).to.be.equal(0);
            });

            it("setSettlementManager again", async () => {
                for (let shopIndex = 0; shopIndex < 4; shopIndex++) {
                    const shop = shopData[shopIndex];
                    const nonce = await shopContract.nonceOf(shop.wallet.address);
                    const message = ContractUtils.getSetSettlementManagerMessage(
                        shop.shopId,
                        managerShop.shopId,
                        nonce
                    );
                    const signature = ContractUtils.signMessage(shop.wallet, message);
                    await expect(
                        shopContract
                            .connect(deployments.accounts.certifiers[0])
                            .setSettlementManager(shop.shopId, managerShop.shopId, signature)
                    )
                        .to.emit(shopContract, "SetSettlementManager")
                        .withNamedArgs({
                            shopId: shop.shopId,
                            managerShopId: managerShop.shopId,
                        });
                }
            });

            it("check manager", async () => {
                for (let shopIndex = 0; shopIndex < 4; shopIndex++) {
                    const shop = shopData[shopIndex];
                    expect(await shopContract.settlementManagerOf(shop.shopId)).to.be.equal(managerShop.shopId);
                }
            });

            it("check client", async () => {
                expect(await shopContract.getSettlementClientLength(managerShop.shopId)).to.be.equal(clients.length);
                expect(await shopContract.getSettlementClientList(managerShop.shopId, 0, 2)).to.deep.equal(
                    clients.slice(0, 2)
                );
                expect(await shopContract.getSettlementClientList(managerShop.shopId, 1, 3)).to.deep.equal(
                    clients.slice(1, 3)
                );
                expect(await shopContract.getSettlementClientList(managerShop.shopId, 0, 4)).to.deep.equal(
                    clients.slice(0, 4)
                );
            });
        });

        context("refund", () => {
            const managerShop = shopData[4];
            const expected = [400, 300, 200, 500].map((m) => Amount.make(m, 18).value);
            const sumExpected = Amount.make(1400, 18).value;
            let amountToken: BigNumber;

            it("Check refundable amount", async () => {
                for (let shopIndex = 0; shopIndex < 4; shopIndex++) {
                    const shop = shopData[shopIndex];
                    const { refundableAmount, refundableToken } = await shopContract.refundableOf(shop.shopId);
                    expect(refundableAmount).to.equal(expected[shopIndex]);
                }
            });

            it("collectSettlementAmount", async () => {
                const clientLength = await shopContract.getSettlementClientLength(managerShop.shopId);
                const clients = await shopContract.getSettlementClientList(managerShop.shopId, 0, clientLength);
                for (const client of clients) {
                    const shopIndex = shopData.findIndex((m) => m.shopId === client);
                    expect(shopIndex).to.gte(0);
                    const shop = shopData[shopIndex];
                    const nonce = await shopContract.nonceOf(managerShop.wallet.address);
                    const message = ContractUtils.getCollectSettlementAmountMessage(
                        managerShop.shopId,
                        shop.shopId,
                        nonce
                    );
                    const signature = await ContractUtils.signMessage(managerShop.wallet, message);
                    await expect(
                        shopContract
                            .connect(deployments.accounts.certifiers[0])
                            .collectSettlementAmount(managerShop.shopId, shop.shopId, signature)
                    )
                        .to.emit(shopContract, "CollectedSettlementAmount")
                        .withNamedArgs({
                            clientId: shop.shopId,
                            clientAccount: shop.wallet.address,
                            clientCurrency: shop.currency,
                            clientAmount: expected[shopIndex],
                            managerId: managerShop.shopId,
                            managerAccount: managerShop.wallet.address,
                            managerCurrency: managerShop.currency,
                            managerAmount: expected[shopIndex],
                        });
                }
            });

            it("Check refundable amount", async () => {
                for (let shopIndex = 0; shopIndex < 4; shopIndex++) {
                    const shop = shopData[shopIndex];
                    const { refundableAmount } = await shopContract.refundableOf(shop.shopId);
                    expect(refundableAmount).to.equal(0);
                }
            });

            it("Check refundable amount of settlement manager", async () => {
                const { refundableAmount, refundableToken } = await shopContract.refundableOf(managerShop.shopId);
                expect(refundableAmount).to.equal(sumExpected);
                amountToken = BigNumber.from(refundableToken);
            });

            it("refund", async () => {
                const nonce = await shopContract.nonceOf(managerShop.wallet.address);
                const message = ContractUtils.getShopRefundMessage(managerShop.shopId, sumExpected, nonce);
                const signature = await ContractUtils.signMessage(managerShop.wallet, message);
                await expect(
                    shopContract
                        .connect(deployments.accounts.certifiers[0])
                        .refund(managerShop.shopId, sumExpected, signature)
                )
                    .to.emit(shopContract, "Refunded")
                    .withNamedArgs({
                        shopId: managerShop.shopId,
                        account: managerShop.wallet.address,
                        refundAmount: sumExpected,
                        amountToken,
                    });
            });

            it("Check balance of ledger", async () => {
                const balance = await ledgerContract.tokenBalanceOf(managerShop.wallet.address);
                expect(balance).to.equal(amountToken);
            });
        });
    });

    context("Clearing for shops - Use settlement manager", () => {
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
                shopIndex: 2,
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
                amount: 10000000,
                providePercent: 1,
                currency: "krw",
                shopIndex: 5,
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
                shopId: "F000500",
                name: "Shop6",
                currency: "krw",
                wallet: deployments.accounts.shops[5],
            },
        ];

        before("Set Shop ID", async () => {
            for (const elem of shopData) {
                elem.shopId = ContractUtils.getShopId(elem.wallet.address, LoyaltyNetworkID.ACC_TESTNET);
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
                        sender: deployments.accounts.system.address,
                        signature: "",
                    };
                    purchaseParam.signature = await ContractUtils.getPurchaseSignature(
                        deployments.accounts.system,
                        purchaseParam
                    );
                    const purchaseMessage = ContractUtils.getPurchasesMessage(0, [purchaseParam]);
                    const signatures = await Promise.all(
                        deployments.accounts.validators.map((m) => ContractUtils.signMessage(m, purchaseMessage))
                    );
                    const proposeMessage = ContractUtils.getPurchasesProposeMessage(0, [purchaseParam], signatures);
                    const proposerSignature = await ContractUtils.signMessage(
                        deployments.accounts.validators[0],
                        proposeMessage
                    );
                    await expect(
                        providerContract
                            .connect(deployments.accounts.certifiers[0])
                            .savePurchase(0, [purchaseParam], signatures, proposerSignature)
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
                    Amount.make(10000 * 1, 18)
                        .value.mul(1)
                        .div(100)
                );

                const shopInfo2 = await shopContract.shopOf(shopData[1].shopId);
                expect(shopInfo2.providedAmount).to.equal(
                    Amount.make(10000 * 2, 18)
                        .value.mul(1)
                        .div(100)
                );
                const shopInfo3 = await shopContract.shopOf(shopData[2].shopId);
                expect(shopInfo3.providedAmount).to.equal(
                    Amount.make(10000 * 3, 18)
                        .value.mul(1)
                        .div(100)
                );
                const shopInfo4 = await shopContract.shopOf(shopData[3].shopId);
                expect(shopInfo4.providedAmount).to.equal(Amount.make(0, 18).value);
            });
        });

        context("Pay point", () => {
            it("Pay point - Success", async () => {
                const providedAmount = [100, 200, 300, 0].map((m) => Amount.make(m, 18).value);
                const usedAmount = [500, 500, 500, 500].map((m) => Amount.make(m, 18).value);
                for (let shopIndex = 0; shopIndex < 4; shopIndex++) {
                    const purchase = {
                        purchaseId: getPurchaseId(),
                        amount: 500,
                        providePercent: 1,
                        currency: "krw",
                        shopIndex,
                        userIndex: 0,
                    };

                    const paymentId = ContractUtils.getPaymentId(
                        deployments.accounts.users[purchase.userIndex].address,
                        0
                    );
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
                    ).to.emit(consumerContract, "LoyaltyPaymentEvent");

                    const shopInfo = await shopContract.shopOf(shop.shopId);
                    expect(shopInfo.providedAmount).to.equal(providedAmount[shopIndex]);
                    expect(shopInfo.usedAmount).to.equal(usedAmount[shopIndex]);
                }
            });
        });

        context("setSettlementManager/removeSettlementManager", () => {
            const managerShop = shopData[4];
            const clients: BytesLike[] = [];

            it("prepare", async () => {
                for (let shopIndex = 0; shopIndex < 4; shopIndex++) {
                    clients.push(shopData[shopIndex].shopId);
                }
            });

            it("setSettlementManager", async () => {
                for (let shopIndex = 0; shopIndex < 4; shopIndex++) {
                    const shop = shopData[shopIndex];
                    const nonce = await shopContract.nonceOf(shop.wallet.address);
                    const message = ContractUtils.getSetSettlementManagerMessage(
                        shop.shopId,
                        managerShop.shopId,
                        nonce
                    );
                    const signature = ContractUtils.signMessage(shop.wallet, message);
                    await expect(
                        shopContract
                            .connect(deployments.accounts.certifiers[0])
                            .setSettlementManager(shop.shopId, managerShop.shopId, signature)
                    )
                        .to.emit(shopContract, "SetSettlementManager")
                        .withNamedArgs({
                            shopId: shop.shopId,
                            managerShopId: managerShop.shopId,
                        });
                }
            });

            it("check manager", async () => {
                for (let shopIndex = 0; shopIndex < 4; shopIndex++) {
                    const shop = shopData[shopIndex];
                    expect(await shopContract.settlementManagerOf(shop.shopId)).to.be.equal(managerShop.shopId);
                }
            });

            it("check client", async () => {
                expect(await shopContract.getSettlementClientLength(managerShop.shopId)).to.be.equal(clients.length);
                expect(await shopContract.getSettlementClientList(managerShop.shopId, 0, 2)).to.deep.equal(
                    clients.slice(0, 2)
                );
                expect(await shopContract.getSettlementClientList(managerShop.shopId, 1, 3)).to.deep.equal(
                    clients.slice(1, 3)
                );
                expect(await shopContract.getSettlementClientList(managerShop.shopId, 0, 4)).to.deep.equal(
                    clients.slice(0, 4)
                );
            });

            it("removeSettlementManager", async () => {
                for (let shopIndex = 0; shopIndex < 4; shopIndex++) {
                    const shop = shopData[shopIndex];
                    const nonce = await shopContract.nonceOf(shop.wallet.address);
                    const message = ContractUtils.getRemoveSettlementManagerMessage(shop.shopId, nonce);
                    const signature = ContractUtils.signMessage(shop.wallet, message);
                    await expect(
                        shopContract
                            .connect(deployments.accounts.certifiers[0])
                            .removeSettlementManager(shop.shopId, signature)
                    )
                        .to.emit(shopContract, "RemovedSettlementManager")
                        .withNamedArgs({
                            shopId: shop.shopId,
                            managerShopId: managerShop.shopId,
                        });
                }
            });

            it("check manager", async () => {
                for (let shopIndex = 0; shopIndex < 4; shopIndex++) {
                    const shop = shopData[shopIndex];
                    expect(await shopContract.settlementManagerOf(shop.shopId)).to.be.equal(HashZero);
                }
            });

            it("check client", async () => {
                expect(await shopContract.getSettlementClientLength(managerShop.shopId)).to.be.equal(0);
            });

            it("setSettlementManager again", async () => {
                for (let shopIndex = 0; shopIndex < 4; shopIndex++) {
                    const shop = shopData[shopIndex];
                    const nonce = await shopContract.nonceOf(shop.wallet.address);
                    const message = ContractUtils.getSetSettlementManagerMessage(
                        shop.shopId,
                        managerShop.shopId,
                        nonce
                    );
                    const signature = ContractUtils.signMessage(shop.wallet, message);
                    await expect(
                        shopContract
                            .connect(deployments.accounts.certifiers[0])
                            .setSettlementManager(shop.shopId, managerShop.shopId, signature)
                    )
                        .to.emit(shopContract, "SetSettlementManager")
                        .withNamedArgs({
                            shopId: shop.shopId,
                            managerShopId: managerShop.shopId,
                        });
                }
            });

            it("check manager", async () => {
                for (let shopIndex = 0; shopIndex < 4; shopIndex++) {
                    const shop = shopData[shopIndex];
                    expect(await shopContract.settlementManagerOf(shop.shopId)).to.be.equal(managerShop.shopId);
                }
            });

            it("check client", async () => {
                expect(await shopContract.getSettlementClientLength(managerShop.shopId)).to.be.equal(clients.length);
                expect(await shopContract.getSettlementClientList(managerShop.shopId, 0, 2)).to.deep.equal(
                    clients.slice(0, 2)
                );
                expect(await shopContract.getSettlementClientList(managerShop.shopId, 1, 3)).to.deep.equal(
                    clients.slice(1, 3)
                );
                expect(await shopContract.getSettlementClientList(managerShop.shopId, 0, 4)).to.deep.equal(
                    clients.slice(0, 4)
                );
            });
        });

        context("refund", () => {
            const managerShop = shopData[4];
            const expected = [400, 300, 200, 500].map((m) => Amount.make(m, 18).value);
            const sumExpected = Amount.make(1400, 18).value;
            let amountToken: BigNumber;

            it("Check refundable amount", async () => {
                for (let shopIndex = 0; shopIndex < 4; shopIndex++) {
                    const shop = shopData[shopIndex];
                    const { refundableAmount, refundableToken } = await shopContract.refundableOf(shop.shopId);
                    expect(refundableAmount).to.equal(expected[shopIndex]);
                }
            });

            it("getCollectSettlementAmountMultiClientMessage", async () => {
                const clientLength = await shopContract.getSettlementClientLength(managerShop.shopId);
                const clients = await shopContract.getSettlementClientList(managerShop.shopId, 0, clientLength);
                const nonce = await shopContract.nonceOf(managerShop.wallet.address);
                const message = ContractUtils.getCollectSettlementAmountMultiClientMessage(
                    managerShop.shopId,
                    clients,
                    nonce
                );
                const signature = await ContractUtils.signMessage(managerShop.wallet, message);
                await expect(
                    shopContract
                        .connect(deployments.accounts.certifiers[0])
                        .collectSettlementAmountMultiClient(managerShop.shopId, clients, signature)
                )
                    .to.emit(shopContract, "CollectedSettlementAmount")
                    .withNamedArgs({
                        managerId: managerShop.shopId,
                        managerAccount: managerShop.wallet.address,
                        managerCurrency: managerShop.currency,
                    });
            });

            it("Check refundable amount", async () => {
                for (let shopIndex = 0; shopIndex < 4; shopIndex++) {
                    const shop = shopData[shopIndex];
                    const { refundableAmount } = await shopContract.refundableOf(shop.shopId);
                    expect(refundableAmount).to.equal(0);
                }
            });

            it("Check refundable amount of settlement manager", async () => {
                const { refundableAmount, refundableToken } = await shopContract.refundableOf(managerShop.shopId);
                expect(refundableAmount).to.equal(sumExpected);
                amountToken = BigNumber.from(refundableToken);
            });

            it("refund", async () => {
                const nonce = await shopContract.nonceOf(managerShop.wallet.address);
                const message = ContractUtils.getShopRefundMessage(managerShop.shopId, sumExpected, nonce);
                const signature = await ContractUtils.signMessage(managerShop.wallet, message);
                await expect(
                    shopContract
                        .connect(deployments.accounts.certifiers[0])
                        .refund(managerShop.shopId, sumExpected, signature)
                )
                    .to.emit(shopContract, "Refunded")
                    .withNamedArgs({
                        shopId: managerShop.shopId,
                        account: managerShop.wallet.address,
                        refundAmount: sumExpected,
                        amountToken,
                    });
            });

            it("Check balance of ledger", async () => {
                const balance = await ledgerContract.tokenBalanceOf(managerShop.wallet.address);
                expect(balance).to.equal(amountToken);
            });
        });
    });

    context("Clearing for shops - Use settlement manager -- settlement agent", () => {
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
                shopIndex: 2,
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
                amount: 10000000,
                providePercent: 1,
                currency: "krw",
                shopIndex: 5,
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
                shopId: "F000500",
                name: "Shop6",
                currency: "krw",
                wallet: deployments.accounts.shops[5],
            },
        ];

        before("Set Shop ID", async () => {
            for (const elem of shopData) {
                elem.shopId = ContractUtils.getShopId(elem.wallet.address, LoyaltyNetworkID.ACC_TESTNET);
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
                        sender: deployments.accounts.system.address,
                        signature: "",
                    };
                    purchaseParam.signature = await ContractUtils.getPurchaseSignature(
                        deployments.accounts.system,
                        purchaseParam
                    );
                    const purchaseMessage = ContractUtils.getPurchasesMessage(0, [purchaseParam]);
                    const signatures = await Promise.all(
                        deployments.accounts.validators.map((m) => ContractUtils.signMessage(m, purchaseMessage))
                    );
                    const proposeMessage = ContractUtils.getPurchasesProposeMessage(0, [purchaseParam], signatures);
                    const proposerSignature = await ContractUtils.signMessage(
                        deployments.accounts.validators[0],
                        proposeMessage
                    );
                    await expect(
                        providerContract
                            .connect(deployments.accounts.certifiers[0])
                            .savePurchase(0, [purchaseParam], signatures, proposerSignature)
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
                    Amount.make(10000 * 1, 18)
                        .value.mul(1)
                        .div(100)
                );

                const shopInfo2 = await shopContract.shopOf(shopData[1].shopId);
                expect(shopInfo2.providedAmount).to.equal(
                    Amount.make(10000 * 2, 18)
                        .value.mul(1)
                        .div(100)
                );
                const shopInfo3 = await shopContract.shopOf(shopData[2].shopId);
                expect(shopInfo3.providedAmount).to.equal(
                    Amount.make(10000 * 3, 18)
                        .value.mul(1)
                        .div(100)
                );
                const shopInfo4 = await shopContract.shopOf(shopData[3].shopId);
                expect(shopInfo4.providedAmount).to.equal(Amount.make(0, 18).value);
            });
        });

        context("Pay point", () => {
            it("Pay point - Success", async () => {
                const providedAmount = [100, 200, 300, 0].map((m) => Amount.make(m, 18).value);
                const usedAmount = [500, 500, 500, 500].map((m) => Amount.make(m, 18).value);
                for (let shopIndex = 0; shopIndex < 4; shopIndex++) {
                    const purchase = {
                        purchaseId: getPurchaseId(),
                        amount: 500,
                        providePercent: 1,
                        currency: "krw",
                        shopIndex,
                        userIndex: 0,
                    };

                    const paymentId = ContractUtils.getPaymentId(
                        deployments.accounts.users[purchase.userIndex].address,
                        0
                    );
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
                    ).to.emit(consumerContract, "LoyaltyPaymentEvent");

                    const shopInfo = await shopContract.shopOf(shop.shopId);
                    expect(shopInfo.providedAmount).to.equal(providedAmount[shopIndex]);
                    expect(shopInfo.usedAmount).to.equal(usedAmount[shopIndex]);
                }
            });
        });

        context("setSettlementManager/removeSettlementManager", () => {
            const managerShop = shopData[4];
            const clients: BytesLike[] = [];

            it("prepare", async () => {
                for (let shopIndex = 0; shopIndex < 4; shopIndex++) {
                    clients.push(shopData[shopIndex].shopId);
                }
            });

            it("setSettlementManager", async () => {
                for (let shopIndex = 0; shopIndex < 4; shopIndex++) {
                    const shop = shopData[shopIndex];
                    const nonce = await shopContract.nonceOf(shop.wallet.address);
                    const message = ContractUtils.getSetSettlementManagerMessage(
                        shop.shopId,
                        managerShop.shopId,
                        nonce
                    );
                    const signature = ContractUtils.signMessage(shop.wallet, message);
                    await expect(
                        shopContract
                            .connect(deployments.accounts.certifiers[0])
                            .setSettlementManager(shop.shopId, managerShop.shopId, signature)
                    )
                        .to.emit(shopContract, "SetSettlementManager")
                        .withNamedArgs({
                            shopId: shop.shopId,
                            managerShopId: managerShop.shopId,
                        });
                }
            });

            it("check manager", async () => {
                for (let shopIndex = 0; shopIndex < 4; shopIndex++) {
                    const shop = shopData[shopIndex];
                    expect(await shopContract.settlementManagerOf(shop.shopId)).to.be.equal(managerShop.shopId);
                }
            });

            it("check client", async () => {
                expect(await shopContract.getSettlementClientLength(managerShop.shopId)).to.be.equal(clients.length);
                expect(await shopContract.getSettlementClientList(managerShop.shopId, 0, 2)).to.deep.equal(
                    clients.slice(0, 2)
                );
                expect(await shopContract.getSettlementClientList(managerShop.shopId, 1, 3)).to.deep.equal(
                    clients.slice(1, 3)
                );
                expect(await shopContract.getSettlementClientList(managerShop.shopId, 0, 4)).to.deep.equal(
                    clients.slice(0, 4)
                );
            });

            it("removeSettlementManager", async () => {
                for (let shopIndex = 0; shopIndex < 4; shopIndex++) {
                    const shop = shopData[shopIndex];
                    const nonce = await shopContract.nonceOf(shop.wallet.address);
                    const message = ContractUtils.getRemoveSettlementManagerMessage(shop.shopId, nonce);
                    const signature = ContractUtils.signMessage(shop.wallet, message);
                    await expect(
                        shopContract
                            .connect(deployments.accounts.certifiers[0])
                            .removeSettlementManager(shop.shopId, signature)
                    )
                        .to.emit(shopContract, "RemovedSettlementManager")
                        .withNamedArgs({
                            shopId: shop.shopId,
                            managerShopId: managerShop.shopId,
                        });
                }
            });

            it("check manager", async () => {
                for (let shopIndex = 0; shopIndex < 4; shopIndex++) {
                    const shop = shopData[shopIndex];
                    expect(await shopContract.settlementManagerOf(shop.shopId)).to.be.equal(HashZero);
                }
            });

            it("check client", async () => {
                expect(await shopContract.getSettlementClientLength(managerShop.shopId)).to.be.equal(0);
            });

            it("setSettlementManager again", async () => {
                for (let shopIndex = 0; shopIndex < 4; shopIndex++) {
                    const shop = shopData[shopIndex];
                    const nonce = await shopContract.nonceOf(shop.wallet.address);
                    const message = ContractUtils.getSetSettlementManagerMessage(
                        shop.shopId,
                        managerShop.shopId,
                        nonce
                    );
                    const signature = ContractUtils.signMessage(shop.wallet, message);
                    await expect(
                        shopContract
                            .connect(deployments.accounts.certifiers[0])
                            .setSettlementManager(shop.shopId, managerShop.shopId, signature)
                    )
                        .to.emit(shopContract, "SetSettlementManager")
                        .withNamedArgs({
                            shopId: shop.shopId,
                            managerShopId: managerShop.shopId,
                        });
                }
            });

            it("check manager", async () => {
                for (let shopIndex = 0; shopIndex < 4; shopIndex++) {
                    const shop = shopData[shopIndex];
                    expect(await shopContract.settlementManagerOf(shop.shopId)).to.be.equal(managerShop.shopId);
                }
            });

            it("check client", async () => {
                expect(await shopContract.getSettlementClientLength(managerShop.shopId)).to.be.equal(clients.length);
                expect(await shopContract.getSettlementClientList(managerShop.shopId, 0, 2)).to.deep.equal(
                    clients.slice(0, 2)
                );
                expect(await shopContract.getSettlementClientList(managerShop.shopId, 1, 3)).to.deep.equal(
                    clients.slice(1, 3)
                );
                expect(await shopContract.getSettlementClientList(managerShop.shopId, 0, 4)).to.deep.equal(
                    clients.slice(0, 4)
                );
            });
        });

        context("refund", () => {
            const managerShop = shopData[4];
            const expected = [400, 300, 200, 500].map((m) => Amount.make(m, 18).value);
            const sumExpected = Amount.make(1400, 18).value;
            let amountToken: BigNumber;

            it("register refund agent", async () => {
                const refundAgent = deployments.accounts.users[0];
                const nonce = await ledgerContract.nonceOf(managerShop.wallet.address);
                const message = ContractUtils.getRegisterAgentMessage(
                    managerShop.wallet.address,
                    refundAgent.address,
                    nonce,
                    hre.ethers.provider.network.chainId
                );
                const signature = await ContractUtils.signMessage(managerShop.wallet, message);
                await expect(
                    ledgerContract
                        .connect(deployments.accounts.certifiers[0])
                        .registerRefundAgent(managerShop.wallet.address, refundAgent.address, signature)
                )
                    .to.emit(ledgerContract, "RegisteredRefundAgent")
                    .withNamedArgs({
                        account: managerShop.wallet.address,
                        agent: refundAgent.address,
                    });
            });

            it("Check refund agent", async () => {
                const refundAgent = deployments.accounts.users[0];
                const refundAgentAddress = await ledgerContract.refundAgentOf(managerShop.wallet.address);
                expect(refundAgentAddress).to.be.equal(refundAgent.address);
            });

            it("Check refundable amount", async () => {
                for (let shopIndex = 0; shopIndex < 4; shopIndex++) {
                    const shop = shopData[shopIndex];
                    const { refundableAmount, refundableToken } = await shopContract.refundableOf(shop.shopId);
                    expect(refundableAmount).to.equal(expected[shopIndex]);
                }
            });

            it("collectSettlementAmountMultiClient by agent", async () => {
                const refundAgent = deployments.accounts.users[0];
                const clientLength = await shopContract.getSettlementClientLength(managerShop.shopId);
                const clients = await shopContract.getSettlementClientList(managerShop.shopId, 0, clientLength);
                const nonce = await shopContract.nonceOf(refundAgent.address);
                const message = ContractUtils.getCollectSettlementAmountMultiClientMessage(
                    managerShop.shopId,
                    clients,
                    nonce
                );
                const signature = await ContractUtils.signMessage(refundAgent, message);
                await expect(
                    shopContract
                        .connect(deployments.accounts.certifiers[0])
                        .collectSettlementAmountMultiClient(managerShop.shopId, clients, signature)
                )
                    .to.emit(shopContract, "CollectedSettlementAmount")
                    .withNamedArgs({
                        managerId: managerShop.shopId,
                        managerAccount: managerShop.wallet.address,
                        managerCurrency: managerShop.currency,
                    });
            });

            it("Check refundable amount", async () => {
                for (let shopIndex = 0; shopIndex < 4; shopIndex++) {
                    const shop = shopData[shopIndex];
                    const { refundableAmount } = await shopContract.refundableOf(shop.shopId);
                    expect(refundableAmount).to.equal(0);
                }
            });

            it("Check refundable amount of settlement manager", async () => {
                const { refundableAmount, refundableToken } = await shopContract.refundableOf(managerShop.shopId);
                expect(refundableAmount).to.equal(sumExpected);
                amountToken = BigNumber.from(refundableToken);
            });

            it("refund by agent", async () => {
                const refundAgent = deployments.accounts.users[0];
                const nonce = await shopContract.nonceOf(refundAgent.address);
                const message = ContractUtils.getShopRefundMessage(managerShop.shopId, sumExpected, nonce);
                const signature = await ContractUtils.signMessage(refundAgent, message);
                await expect(
                    shopContract
                        .connect(deployments.accounts.certifiers[0])
                        .refund(managerShop.shopId, sumExpected, signature)
                )
                    .to.emit(shopContract, "Refunded")
                    .withNamedArgs({
                        shopId: managerShop.shopId,
                        account: managerShop.wallet.address,
                        refundAmount: sumExpected,
                        amountToken,
                    });
            });

            it("Check balance of ledger", async () => {
                const balance = await ledgerContract.tokenBalanceOf(managerShop.wallet.address);
                expect(balance).to.equal(amountToken);
            });
        });
    });
});
