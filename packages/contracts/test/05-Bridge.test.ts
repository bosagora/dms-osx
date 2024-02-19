import "@nomiclabs/hardhat-ethers";
import "@nomiclabs/hardhat-waffle";
import "@openzeppelin/hardhat-upgrades";

import { Amount } from "../src/utils/Amount";
import { ContractUtils } from "../src/utils/ContractUtils";
import {
    CurrencyRate,
    IBIP20DelegatedTransfer,
    Bridge,
    LoyaltyBridge,
    Ledger,
    LoyaltyBurner,
    LoyaltyConsumer,
    LoyaltyExchanger,
    LoyaltyProvider,
    LoyaltyTransfer,
    PhoneLinkCollection,
    Shop,
    Validator,
    TestKIOS,
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
    let tokenContract: IBIP20DelegatedTransfer;
    let ledgerContract: Ledger;
    let linkContract: PhoneLinkCollection;
    let currencyContract: CurrencyRate;
    let shopContract: Shop;
    let providerContract: LoyaltyProvider;
    let consumerContract: LoyaltyConsumer;
    let exchangerContract: LoyaltyExchanger;
    let burnerContract: LoyaltyBurner;
    let transferContract: LoyaltyTransfer;
    let bridgeContract: Bridge;
    let loyaltyBridgeContract: LoyaltyBridge;

    const multiple = BigNumber.from(1000000000);
    const price = BigNumber.from(150).mul(multiple);

    const amount = Amount.make(100_000, 18);
    const assetAmount = Amount.make(10_000_000, 18);

    const addShopData = async (shopData: IShopData[]) => {
        for (const elem of shopData) {
            const nonce = await shopContract.nonceOf(elem.wallet.address);
            const signature = await ContractUtils.signShop(elem.wallet, elem.shopId, nonce);
            await shopContract
                .connect(deployments.accounts.certifier)
                .add(elem.shopId, elem.name, elem.currency, elem.wallet.address, signature);
        }
    };

    const deployAllContract = async (shopData: IShopData[]) => {
        await deployments.doDeployAll();

        tokenContract = deployments.getContract("TestKIOS") as IBIP20DelegatedTransfer;
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
        bridgeContract = deployments.getContract("Bridge") as Bridge;
        loyaltyBridgeContract = deployments.getContract("LoyaltyBridge") as LoyaltyBridge;
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
    let depositId: string;
    context("Bridge", () => {
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
                elem.shopId = ContractUtils.getShopId(elem.wallet.address);
            }
        });

        it("Deploy", async () => {
            await deployAllContract(shopData);
        });

        it("Change Loyalty type of user", async () => {
            const nonce = await ledgerContract.nonceOf(deployments.accounts.users[0].address);
            const signature = await ContractUtils.signLoyaltyType(deployments.accounts.users[0], nonce);

            await exchangerContract
                .connect(deployments.accounts.certifier)
                .changeToLoyaltyToken(deployments.accounts.users[0].address, signature);
        });

        it("Deposit to Main Bridge", async () => {
            const oldLiguidity = await tokenContract.balanceOf(bridgeContract.address);
            const oldTokenBalance = await tokenContract.balanceOf(deployments.accounts.users[0].address);
            const nonce = await tokenContract.nonceOf(deployments.accounts.users[0].address);
            const message = ContractUtils.getTransferMessage(
                deployments.accounts.users[0].address,
                bridgeContract.address,
                amount.value,
                nonce
            );
            depositId = ContractUtils.getRandomId(deployments.accounts.users[0].address);
            const signature = await ContractUtils.signMessage(deployments.accounts.users[0], message);
            await expect(
                bridgeContract
                    .connect(deployments.accounts.certifiers[0])
                    .depositToBridge(depositId, deployments.accounts.users[0].address, amount.value, signature)
            )
                .to.emit(bridgeContract, "BridgeDeposited")
                .withNamedArgs({
                    depositId: depositId,
                    account: deployments.accounts.users[0].address,
                    amount: amount.value,
                });
            expect(await tokenContract.balanceOf(deployments.accounts.users[0].address)).to.deep.equal(
                oldTokenBalance.sub(amount.value)
            );
            expect(await tokenContract.balanceOf(bridgeContract.address)).to.deep.equal(oldLiguidity.add(amount.value));
        });

        it("Withdraw from LoyaltyBridge", async () => {
            const oldLiguidity = await ledgerContract.tokenBalanceOf(loyaltyBridgeContract.address);
            const oldTokenBalance = await ledgerContract.tokenBalanceOf(deployments.accounts.users[0].address);

            await loyaltyBridgeContract
                .connect(deployments.accounts.bridgeValidators[0])
                .withdrawFromBridge(depositId, deployments.accounts.users[0].address, amount.value);
            await expect(
                loyaltyBridgeContract
                    .connect(deployments.accounts.bridgeValidators[1])
                    .withdrawFromBridge(depositId, deployments.accounts.users[0].address, amount.value)
            )
                .to.emit(loyaltyBridgeContract, "BridgeWithdrawn")
                .withNamedArgs({
                    withdrawId: depositId,
                    account: deployments.accounts.users[0].address,
                    amount: amount.value,
                });

            expect(await ledgerContract.tokenBalanceOf(deployments.accounts.users[0].address)).to.deep.equal(
                oldTokenBalance.add(amount.value)
            );
            expect(await ledgerContract.tokenBalanceOf(loyaltyBridgeContract.address)).to.deep.equal(
                oldLiguidity.sub(amount.value)
            );
        });

        it("Deposit to Loyalty Bridge", async () => {
            const oldLiguidity = await ledgerContract.tokenBalanceOf(loyaltyBridgeContract.address);
            const oldTokenBalance = await ledgerContract.tokenBalanceOf(deployments.accounts.users[0].address);

            const nonce = await ledgerContract.nonceOf(deployments.accounts.users[0].address);
            const message = ContractUtils.getTransferMessage(
                deployments.accounts.users[0].address,
                loyaltyBridgeContract.address,
                amount.value,
                nonce
            );
            depositId = ContractUtils.getRandomId(deployments.accounts.users[0].address);
            const signature = await ContractUtils.signMessage(deployments.accounts.users[0], message);
            await expect(
                loyaltyBridgeContract
                    .connect(deployments.accounts.certifiers[0])
                    .depositToBridge(depositId, deployments.accounts.users[0].address, amount.value, signature)
            )
                .to.emit(loyaltyBridgeContract, "BridgeDeposited")
                .withNamedArgs({
                    depositId: depositId,
                    account: deployments.accounts.users[0].address,
                    amount: amount.value,
                });
            expect(await ledgerContract.tokenBalanceOf(deployments.accounts.users[0].address)).to.deep.equal(
                oldTokenBalance.sub(amount.value)
            );
            expect(await ledgerContract.tokenBalanceOf(loyaltyBridgeContract.address)).to.deep.equal(
                oldLiguidity.add(amount.value)
            );
        });

        it("Withdraw from Main Bridge", async () => {
            const oldLiguidity = await tokenContract.balanceOf(bridgeContract.address);
            const oldTokenBalance = await tokenContract.balanceOf(deployments.accounts.users[0].address);

            await bridgeContract
                .connect(deployments.accounts.bridgeValidators[0])
                .withdrawFromBridge(depositId, deployments.accounts.users[0].address, amount.value);
            await expect(
                bridgeContract
                    .connect(deployments.accounts.bridgeValidators[1])
                    .withdrawFromBridge(depositId, deployments.accounts.users[0].address, amount.value)
            )
                .to.emit(bridgeContract, "BridgeWithdrawn")
                .withNamedArgs({
                    withdrawId: depositId,
                    account: deployments.accounts.users[0].address,
                    amount: amount.value,
                });

            expect(await tokenContract.balanceOf(deployments.accounts.users[0].address)).to.deep.equal(
                oldTokenBalance.add(amount.value)
            );
            expect(await tokenContract.balanceOf(bridgeContract.address)).to.deep.equal(oldLiguidity.sub(amount.value));
        });
    });
});
