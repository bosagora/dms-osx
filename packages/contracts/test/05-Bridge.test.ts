import "@nomiclabs/hardhat-ethers";
import "@nomiclabs/hardhat-waffle";
import "@openzeppelin/hardhat-upgrades";

import { Amount } from "../src/utils/Amount";
import { ContractUtils } from "../src/utils/ContractUtils";
import {
    BIP20DelegatedTransfer,
    Bridge,
    CurrencyRate,
    IBIP20DelegatedTransfer,
    Ledger,
    LoyaltyBridge,
    LoyaltyBurner,
    LoyaltyConsumer,
    LoyaltyExchanger,
    LoyaltyProvider,
    LoyaltyTransfer,
    PhoneLinkCollection,
    Shop,
    TestKIOS,
    Validator,
} from "../typechain-types";

import chai, { expect } from "chai";
import { solidity } from "ethereum-waffle";

import { Wallet } from "ethers";

import { Deployments } from "./helper/Deployments";
import { string } from "hardhat/internal/core/params/argumentTypes";

chai.use(solidity);

interface IShopData {
    shopId: string;
    name: string;
    currency: string;
    wallet: Wallet;
}

describe("Test for Ledger", () => {
    const deployments = new Deployments();
    let validatorContract: Validator;
    let tokenContract: BIP20DelegatedTransfer;
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

    let tokenId: string;
    let amount = Amount.make(100_000, 18).value;
    const fee = Amount.make(5, 18).value;

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

        tokenContract = deployments.getContract("TestKIOS") as BIP20DelegatedTransfer;
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
        tokenId = ContractUtils.getTokenId(await tokenContract.name(), await tokenContract.symbol());
        await addShopData(shopData);
    };

    let depositId: string;
    it("Deploy", async () => {
        await deployAllContract([]);
    });

    it("Change Loyalty type of user", async () => {
        const nonce = await ledgerContract.nonceOf(deployments.accounts.users[0].address);
        const signature = await ContractUtils.signLoyaltyType(deployments.accounts.users[0], nonce);

        await exchangerContract
            .connect(deployments.accounts.certifiers[0])
            .changeToLoyaltyToken(deployments.accounts.users[0].address, signature);
    });

    it("Deposit to Main Bridge", async () => {
        const oldLiquidity = await tokenContract.balanceOf(bridgeContract.address);
        const oldTokenBalance = await tokenContract.balanceOf(deployments.accounts.users[0].address);
        const nonce = await tokenContract.nonceOf(deployments.accounts.users[0].address);
        const message = ContractUtils.getTransferMessage(
            deployments.accounts.users[0].address,
            bridgeContract.address,
            amount,
            nonce
        );
        depositId = ContractUtils.getRandomId(deployments.accounts.users[0].address);
        const signature = await ContractUtils.signMessage(deployments.accounts.users[0], message);
        await expect(
            bridgeContract
                .connect(deployments.accounts.certifiers[0])
                .depositToBridge(tokenId, depositId, deployments.accounts.users[0].address, amount, signature)
        )
            .to.emit(bridgeContract, "BridgeDeposited")
            .withNamedArgs({
                depositId,
                account: deployments.accounts.users[0].address,
                amount,
            });
        expect(await tokenContract.balanceOf(deployments.accounts.users[0].address)).to.deep.equal(
            oldTokenBalance.sub(amount)
        );
        expect(await tokenContract.balanceOf(bridgeContract.address)).to.deep.equal(oldLiquidity.add(amount));
    });

    it("Withdraw from LoyaltyBridge", async () => {
        const oldLiquidity = await ledgerContract.tokenBalanceOf(loyaltyBridgeContract.address);
        const oldTokenBalance = await ledgerContract.tokenBalanceOf(deployments.accounts.users[0].address);
        const oldFeeBalance = await ledgerContract.tokenBalanceOf(deployments.accounts.txFee.address);

        await loyaltyBridgeContract
            .connect(deployments.accounts.bridgeValidators[0])
            .withdrawFromBridge(tokenId, depositId, deployments.accounts.users[0].address, amount);
        await expect(
            loyaltyBridgeContract
                .connect(deployments.accounts.bridgeValidators[1])
                .withdrawFromBridge(tokenId, depositId, deployments.accounts.users[0].address, amount)
        )
            .to.emit(loyaltyBridgeContract, "BridgeWithdrawn")
            .withNamedArgs({
                withdrawId: depositId,
                account: deployments.accounts.users[0].address,
                amount: amount.sub(fee),
            });

        expect(await ledgerContract.tokenBalanceOf(loyaltyBridgeContract.address)).to.deep.equal(
            oldLiquidity.sub(amount)
        );
        expect(await ledgerContract.tokenBalanceOf(deployments.accounts.users[0].address)).to.deep.equal(
            oldTokenBalance.add(amount.sub(fee))
        );
        expect(await ledgerContract.tokenBalanceOf(deployments.accounts.txFee.address)).to.deep.equal(
            oldFeeBalance.add(fee)
        );
    });

    it("Deposit to Loyalty Bridge", async () => {
        amount = Amount.make(50_000, 18).value;
        const oldLiquidity = await ledgerContract.tokenBalanceOf(loyaltyBridgeContract.address);
        const oldTokenBalance = await ledgerContract.tokenBalanceOf(deployments.accounts.users[0].address);

        const nonce = await ledgerContract.nonceOf(deployments.accounts.users[0].address);
        const message = ContractUtils.getTransferMessage(
            deployments.accounts.users[0].address,
            loyaltyBridgeContract.address,
            amount,
            nonce
        );
        depositId = ContractUtils.getRandomId(deployments.accounts.users[0].address);
        const signature = await ContractUtils.signMessage(deployments.accounts.users[0], message);
        await expect(
            loyaltyBridgeContract
                .connect(deployments.accounts.certifiers[0])
                .depositToBridge(tokenId, depositId, deployments.accounts.users[0].address, amount, signature)
        )
            .to.emit(loyaltyBridgeContract, "BridgeDeposited")
            .withNamedArgs({
                depositId,
                account: deployments.accounts.users[0].address,
                amount,
            });
        expect(await ledgerContract.tokenBalanceOf(deployments.accounts.users[0].address)).to.deep.equal(
            oldTokenBalance.sub(amount)
        );
        expect(await ledgerContract.tokenBalanceOf(loyaltyBridgeContract.address)).to.deep.equal(
            oldLiquidity.add(amount)
        );
    });

    it("Withdraw from Main Bridge", async () => {
        const oldLiquidity = await tokenContract.balanceOf(bridgeContract.address);
        const oldTokenBalance = await tokenContract.balanceOf(deployments.accounts.users[0].address);
        const oldFeeBalance = await tokenContract.balanceOf(deployments.accounts.txFee.address);

        await bridgeContract
            .connect(deployments.accounts.bridgeValidators[0])
            .withdrawFromBridge(tokenId, depositId, deployments.accounts.users[0].address, amount);
        await expect(
            bridgeContract
                .connect(deployments.accounts.bridgeValidators[1])
                .withdrawFromBridge(tokenId, depositId, deployments.accounts.users[0].address, amount)
        )
            .to.emit(bridgeContract, "BridgeWithdrawn")
            .withNamedArgs({
                withdrawId: depositId,
                account: deployments.accounts.users[0].address,
                amount: amount.sub(fee),
            });

        expect(await tokenContract.balanceOf(bridgeContract.address)).to.deep.equal(oldLiquidity.sub(amount));
        expect(await tokenContract.balanceOf(deployments.accounts.users[0].address)).to.deep.equal(
            oldTokenBalance.add(amount.sub(fee))
        );
        expect(await tokenContract.balanceOf(deployments.accounts.txFee.address)).to.deep.equal(oldFeeBalance.add(fee));
    });
});
