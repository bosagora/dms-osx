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

import { AddressZero } from "@ethersproject/constants";
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

        it("Provide point - system account ", async () => {
            const transferAmount = Amount.make(100, 18).value;
            const nonce = await ledgerContract.nonceOf(deployments.accounts.system.address);
            const message = ContractUtils.getProvidePointToAddressMessage(
                deployments.accounts.system.address,
                deployments.accounts.users[1].address,
                transferAmount,
                nonce,
                hre.ethers.provider.network.chainId
            );
            const signature = await ContractUtils.signMessage(deployments.accounts.system, message);
            await expect(
                providerContract
                    .connect(deployments.accounts.certifiers[0])
                    .provideToAddress(
                        deployments.accounts.system.address,
                        deployments.accounts.users[1].address,
                        transferAmount,
                        signature
                    )
            ).to.revertedWith("1051");
        });

        it("Provide point - system account ", async () => {
            const transferAmount = Amount.make(100, 18).value;
            const nonce = await ledgerContract.nonceOf(deployments.accounts.users[0].address);
            const message = ContractUtils.getProvidePointToAddressMessage(
                deployments.accounts.users[0].address,
                deployments.accounts.system.address,
                transferAmount,
                nonce,
                hre.ethers.provider.network.chainId
            );
            const signature = await ContractUtils.signMessage(deployments.accounts.users[0], message);
            await expect(
                providerContract
                    .connect(deployments.accounts.certifiers[0])
                    .provideToAddress(
                        deployments.accounts.users[0].address,
                        deployments.accounts.system.address,
                        transferAmount,
                        signature
                    )
            ).to.revertedWith("1052");
        });

        it("Provide point - Not Provider", async () => {
            const providePoint = Amount.make(100, 18).value;
            const nonce = await ledgerContract.nonceOf(deployments.accounts.users[0].address);
            const message = ContractUtils.getProvidePointToAddressMessage(
                deployments.accounts.users[0].address,
                deployments.accounts.users[1].address,
                providePoint,
                nonce,
                hre.ethers.provider.network.chainId
            );
            const signature = await ContractUtils.signMessage(deployments.accounts.users[0], message);
            await expect(
                providerContract
                    .connect(deployments.accounts.certifiers[0])
                    .provideToAddress(
                        deployments.accounts.users[0].address,
                        deployments.accounts.users[1].address,
                        providePoint,
                        signature
                    )
            ).to.revertedWith("1054");
        });

        it("Register Provide", async () => {
            expect(await ledgerContract.isProvider(deployments.accounts.users[0].address)).equal(false);

            await expect(
                ledgerContract
                    .connect(deployments.accounts.deployer)
                    .registerProvider(deployments.accounts.users[0].address)
            ).emit(ledgerContract, "RegisteredProvider");

            expect(await ledgerContract.isProvider(deployments.accounts.users[0].address)).equal(true);

            await expect(
                ledgerContract
                    .connect(deployments.accounts.deployer)
                    .unregisterProvider(deployments.accounts.users[0].address)
            ).emit(ledgerContract, "UnregisteredProvider");

            expect(await ledgerContract.isProvider(deployments.accounts.users[0].address)).equal(false);

            await expect(
                ledgerContract
                    .connect(deployments.accounts.deployer)
                    .registerProvider(deployments.accounts.users[0].address)
            ).emit(ledgerContract, "RegisteredProvider");

            expect(await ledgerContract.isProvider(deployments.accounts.users[0].address)).equal(true);
        });

        it("Provide point - Insufficient balance", async () => {
            const tokenBalance = await ledgerContract.tokenBalanceOf(deployments.accounts.users[0].address);
            const pointBalance = await currencyContract.convertTokenToPoint(tokenBalance);
            const providePoint = pointBalance.mul(2);
            const nonce = await ledgerContract.nonceOf(deployments.accounts.users[0].address);
            const message = ContractUtils.getProvidePointToAddressMessage(
                deployments.accounts.users[0].address,
                deployments.accounts.users[1].address,
                providePoint,
                nonce,
                hre.ethers.provider.network.chainId
            );
            const signature = await ContractUtils.signMessage(deployments.accounts.users[0], message);
            await expect(
                providerContract
                    .connect(deployments.accounts.certifiers[0])
                    .provideToAddress(
                        deployments.accounts.users[0].address,
                        deployments.accounts.users[1].address,
                        providePoint,
                        signature
                    )
            ).to.revertedWith("1511");
        });

        it("Provide point - Invalid signature", async () => {
            const providePoint = Amount.make(100, 18).value;
            const nonce = await ledgerContract.nonceOf(deployments.accounts.users[0].address);
            const message = ContractUtils.getProvidePointToAddressMessage(
                deployments.accounts.users[0].address,
                deployments.accounts.users[1].address,
                providePoint,
                nonce,
                hre.ethers.provider.network.chainId
            );
            const signature = await ContractUtils.signMessage(deployments.accounts.users[2], message);
            await expect(
                providerContract
                    .connect(deployments.accounts.certifiers[0])
                    .provideToAddress(
                        deployments.accounts.users[0].address,
                        deployments.accounts.users[1].address,
                        providePoint,
                        signature
                    )
            ).to.revertedWith("1501");
        });

        it("Provide point", async () => {
            const providePoint = Amount.make(100, 18).value;
            const nonce = await ledgerContract.nonceOf(deployments.accounts.users[0].address);
            const message = ContractUtils.getProvidePointToAddressMessage(
                deployments.accounts.users[0].address,
                deployments.accounts.users[1].address,
                providePoint,
                nonce,
                hre.ethers.provider.network.chainId
            );
            const signature = await ContractUtils.signMessage(deployments.accounts.users[0], message);
            await expect(
                providerContract
                    .connect(deployments.accounts.certifiers[0])
                    .provideToAddress(
                        deployments.accounts.users[0].address,
                        deployments.accounts.users[1].address,
                        providePoint,
                        signature
                    )
            )
                .emit(providerContract, "ProvidedLoyaltyPointToAddress")
                .withNamedArgs({
                    provider: deployments.accounts.users[0].address,
                    receiver: deployments.accounts.users[1].address,
                    amountPoint: providePoint,
                });
            const balance = await ledgerContract.pointBalanceOf(deployments.accounts.users[1].address);
            expect(balance).equal(providePoint);
        });

        it("Register Assistance", async () => {
            expect(await ledgerContract.provisionAgentOf(deployments.accounts.users[0].address)).equal(AddressZero);
            const nonce = await ledgerContract.nonceOf(deployments.accounts.users[0].address);
            const message = ContractUtils.getRegisterAgentMessage(
                deployments.accounts.users[0].address,
                deployments.accounts.users[2].address,
                nonce,
                hre.ethers.provider.network.chainId
            );
            const signature = await ContractUtils.signMessage(deployments.accounts.users[0], message);
            await expect(
                ledgerContract
                    .connect(deployments.accounts.deployer)
                    .registerProvisionAgent(
                        deployments.accounts.users[0].address,
                        deployments.accounts.users[2].address,
                        signature
                    )
            )
                .emit(ledgerContract, "RegisteredProvisionAgent")
                .withNamedArgs({
                    account: deployments.accounts.users[0].address,
                    agent: deployments.accounts.users[2].address,
                });

            expect(await ledgerContract.provisionAgentOf(deployments.accounts.users[0].address)).equal(
                deployments.accounts.users[2].address
            );
        });

        it("Provide point - agent", async () => {
            const providePoint = Amount.make(100, 18).value;
            const agent = deployments.accounts.users[2];
            const provider = deployments.accounts.users[0];
            const receiver = deployments.accounts.users[3];
            const nonce = await ledgerContract.nonceOf(agent.address);
            const message = ContractUtils.getProvidePointToAddressMessage(
                provider.address,
                receiver.address,
                providePoint,
                nonce,
                hre.ethers.provider.network.chainId
            );
            const signature = await ContractUtils.signMessage(agent, message);
            await expect(
                providerContract
                    .connect(deployments.accounts.certifiers[0])
                    .provideToAddress(provider.address, receiver.address, providePoint, signature)
            )
                .emit(providerContract, "ProvidedLoyaltyPointToAddress")
                .withNamedArgs({
                    provider: provider.address,
                    receiver: receiver.address,
                    amountPoint: providePoint,
                });
            const balance = await ledgerContract.pointBalanceOf(receiver.address);
            expect(balance).equal(providePoint);
        });

        it("Provide point - phone", async () => {
            const providePoint = Amount.make(100, 18).value;
            const nonce = await ledgerContract.nonceOf(deployments.accounts.users[0].address);
            const message = ContractUtils.getProvidePointToPhoneMessage(
                deployments.accounts.users[0].address,
                phoneHashes[0],
                providePoint,
                nonce,
                hre.ethers.provider.network.chainId
            );
            const signature = await ContractUtils.signMessage(deployments.accounts.users[0], message);
            await expect(
                providerContract
                    .connect(deployments.accounts.certifiers[0])
                    .provideToPhone(deployments.accounts.users[0].address, phoneHashes[0], providePoint, signature)
            )
                .emit(providerContract, "ProvidedLoyaltyPointToPhone")
                .withNamedArgs({
                    provider: deployments.accounts.users[0].address,
                    receiver: phoneHashes[0],
                    amountPoint: providePoint,
                });

            const balance = await ledgerContract.unPayablePointBalanceOf(phoneHashes[0]);
            expect(balance).equal(providePoint);
        });
    });
});
