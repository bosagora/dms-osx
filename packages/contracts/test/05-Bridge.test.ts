import "@nomiclabs/hardhat-ethers";
import "@nomiclabs/hardhat-waffle";
import "@openzeppelin/hardhat-upgrades";

import { Amount } from "../src/utils/Amount";
import { ContractUtils } from "../src/utils/ContractUtils";
import {
    BIP20DelegatedTransfer,
    Bridge,
    CurrencyRate,
    Ledger,
    LoyaltyBridge,
    LoyaltyBurner,
    LoyaltyConsumer,
    LoyaltyExchanger,
    LoyaltyProvider,
    LoyaltyTransfer,
    PhoneLinkCollection,
    Shop,
    Validator,
} from "../typechain-types";
import { Deployments } from "./helper/Deployments";

import chai, { expect } from "chai";
import { solidity } from "ethereum-waffle";

import { Wallet } from "ethers";

import * as hre from "hardhat";

chai.use(solidity);

interface IShopData {
    shopId: string;
    name: string;
    currency: string;
    wallet: Wallet;
}

describe("Test for LoyaltyBridge", () => {
    const deployments = new Deployments();
    let tokenContract: BIP20DelegatedTransfer;
    let ledgerContract: Ledger;
    let shopContract: Shop;
    let bridgeContract: Bridge;
    let loyaltyBridgeContract: LoyaltyBridge;

    let tokenId: string;
    let amount = Amount.make(100_000, 18).value;
    const fee = Amount.make(0.1, 18).value;

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
        ledgerContract = deployments.getContract("Ledger") as Ledger;
        shopContract = deployments.getContract("Shop") as Shop;
        bridgeContract = deployments.getContract("Bridge") as Bridge;
        loyaltyBridgeContract = deployments.getContract("LoyaltyBridge") as LoyaltyBridge;
        tokenId = ContractUtils.getTokenId(await tokenContract.name(), await tokenContract.symbol());
        await addShopData(shopData);
    };

    let depositId: string;
    it("Deploy", async () => {
        await deployAllContract([]);
    });

    it("Deposit to Main Bridge", async () => {
        const oldLiquidity = await tokenContract.balanceOf(bridgeContract.address);
        const oldTokenBalance = await tokenContract.balanceOf(deployments.accounts.users[0].address);
        const nonce = await tokenContract.nonceOf(deployments.accounts.users[0].address);
        const expiry = ContractUtils.getTimeStamp() + 3600;
        const message = ContractUtils.getTransferMessage(
            hre.ethers.provider.network.chainId,
            tokenContract.address,
            deployments.accounts.users[0].address,
            bridgeContract.address,
            amount,
            nonce,
            expiry
        );
        depositId = ContractUtils.getRandomId(deployments.accounts.users[0].address);
        const signature = await ContractUtils.signMessage(deployments.accounts.users[0], message);
        await expect(
            bridgeContract
                .connect(deployments.accounts.certifiers[0])
                .depositToBridge(tokenId, depositId, deployments.accounts.users[0].address, amount, expiry, signature)
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
        const oldFeeBalance = await ledgerContract.tokenBalanceOf(deployments.accounts.protocolFee.address);

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
        expect(await ledgerContract.tokenBalanceOf(deployments.accounts.protocolFee.address)).to.deep.equal(
            oldFeeBalance.add(fee)
        );
    });

    it("Deposit to Loyalty Bridge", async () => {
        amount = Amount.make(50_000, 18).value;
        const oldLiquidity = await ledgerContract.tokenBalanceOf(loyaltyBridgeContract.address);
        const oldTokenBalance = await ledgerContract.tokenBalanceOf(deployments.accounts.users[0].address);

        const nonce = await ledgerContract.nonceOf(deployments.accounts.users[0].address);
        const expiry = ContractUtils.getTimeStamp() + 3600;
        const message = ContractUtils.getTransferMessage(
            hre.ethers.provider.network.chainId,
            tokenContract.address,
            deployments.accounts.users[0].address,
            loyaltyBridgeContract.address,
            amount,
            nonce,
            expiry
        );
        depositId = ContractUtils.getRandomId(deployments.accounts.users[0].address);
        const signature = await ContractUtils.signMessage(deployments.accounts.users[0], message);
        await expect(
            loyaltyBridgeContract
                .connect(deployments.accounts.certifiers[0])
                .depositToBridge(tokenId, depositId, deployments.accounts.users[0].address, amount, expiry, signature)
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
        const oldFeeBalance = await tokenContract.balanceOf(deployments.accounts.protocolFee.address);

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
        expect(await tokenContract.balanceOf(deployments.accounts.protocolFee.address)).to.deep.equal(
            oldFeeBalance.add(fee)
        );
    });
});

describe("Test for LoyaltyBridge - withdrawal agent", () => {
    const deployments = new Deployments();
    let tokenContract: BIP20DelegatedTransfer;
    let ledgerContract: Ledger;
    let shopContract: Shop;
    let bridgeContract: Bridge;
    let loyaltyBridgeContract: LoyaltyBridge;

    let tokenId: string;
    let amount = Amount.make(100_000, 18).value;
    const fee = Amount.make(0.1, 18).value;

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
        ledgerContract = deployments.getContract("Ledger") as Ledger;
        shopContract = deployments.getContract("Shop") as Shop;
        bridgeContract = deployments.getContract("Bridge") as Bridge;
        loyaltyBridgeContract = deployments.getContract("LoyaltyBridge") as LoyaltyBridge;
        tokenId = ContractUtils.getTokenId(await tokenContract.name(), await tokenContract.symbol());
        await addShopData(shopData);
    };

    let depositId: string;
    it("Deploy", async () => {
        await deployAllContract([]);
    });

    it("Register withdrawal agent", async () => {
        const user = deployments.accounts.users[0];
        const agent = deployments.accounts.users[1];
        const nonce = await ledgerContract.nonceOf(user.address);
        const message = ContractUtils.getRegisterAgentMessage(
            user.address,
            agent.address,
            nonce,
            hre.ethers.provider.network.chainId
        );
        const signature = await ContractUtils.signMessage(user, message);
        await expect(
            ledgerContract
                .connect(deployments.accounts.certifiers[0])
                .registerWithdrawalAgent(user.address, agent.address, signature)
        )
            .to.emit(ledgerContract, "RegisteredWithdrawalAgent")
            .withNamedArgs({
                account: user.address,
                agent: agent.address,
            });
    });

    it("Check withdrawal agent", async () => {
        const user = deployments.accounts.users[0];
        const agent = deployments.accounts.users[1];
        const withdrawalAgentAddress = await ledgerContract.withdrawalAgentOf(user.address);
        expect(withdrawalAgentAddress).to.be.equal(agent.address);
    });

    it("Deposit to Main Bridge", async () => {
        const user = deployments.accounts.users[0];
        const agent = deployments.accounts.users[1];
        const oldLiquidity = await tokenContract.balanceOf(bridgeContract.address);
        const oldTokenBalance = await tokenContract.balanceOf(user.address);
        const nonce = await tokenContract.nonceOf(user.address);
        const expiry = ContractUtils.getTimeStamp() + 3600;
        const message = ContractUtils.getTransferMessage(
            hre.ethers.provider.network.chainId,
            tokenContract.address,
            user.address,
            bridgeContract.address,
            amount,
            nonce,
            expiry
        );
        depositId = ContractUtils.getRandomId(user.address);
        const signature = await ContractUtils.signMessage(user, message);
        await expect(
            bridgeContract
                .connect(deployments.accounts.certifiers[0])
                .depositToBridge(tokenId, depositId, user.address, amount, expiry, signature)
        )
            .to.emit(bridgeContract, "BridgeDeposited")
            .withNamedArgs({
                depositId,
                account: user.address,
                amount,
            });
        expect(await tokenContract.balanceOf(user.address)).to.deep.equal(oldTokenBalance.sub(amount));
        expect(await tokenContract.balanceOf(bridgeContract.address)).to.deep.equal(oldLiquidity.add(amount));
    });

    it("Withdraw from LoyaltyBridge", async () => {
        const user = deployments.accounts.users[0];
        const agent = deployments.accounts.users[1];
        const oldLiquidity = await ledgerContract.tokenBalanceOf(loyaltyBridgeContract.address);
        const oldTokenBalance = await ledgerContract.tokenBalanceOf(user.address);
        const oldFeeBalance = await ledgerContract.tokenBalanceOf(deployments.accounts.protocolFee.address);

        await loyaltyBridgeContract
            .connect(deployments.accounts.bridgeValidators[0])
            .withdrawFromBridge(tokenId, depositId, user.address, amount);
        await expect(
            loyaltyBridgeContract
                .connect(deployments.accounts.bridgeValidators[1])
                .withdrawFromBridge(tokenId, depositId, user.address, amount)
        )
            .to.emit(loyaltyBridgeContract, "BridgeWithdrawn")
            .withNamedArgs({
                withdrawId: depositId,
                account: user.address,
                amount: amount.sub(fee),
            });

        expect(await ledgerContract.tokenBalanceOf(loyaltyBridgeContract.address)).to.deep.equal(
            oldLiquidity.sub(amount)
        );
        expect(await ledgerContract.tokenBalanceOf(user.address)).to.deep.equal(oldTokenBalance.add(amount.sub(fee)));
        expect(await ledgerContract.tokenBalanceOf(deployments.accounts.protocolFee.address)).to.deep.equal(
            oldFeeBalance.add(fee)
        );
    });

    it("Deposit to Loyalty Bridge", async () => {
        const user = deployments.accounts.users[0];
        const agent = deployments.accounts.users[1];
        amount = Amount.make(50_000, 18).value;
        const oldLiquidity = await ledgerContract.tokenBalanceOf(loyaltyBridgeContract.address);
        const oldTokenBalance = await ledgerContract.tokenBalanceOf(user.address);

        const nonce = await ledgerContract.nonceOf(agent.address);
        const expiry = ContractUtils.getTimeStamp() + 3600;
        const message = ContractUtils.getTransferMessage(
            hre.ethers.provider.network.chainId,
            tokenContract.address,
            user.address,
            loyaltyBridgeContract.address,
            amount,
            nonce,
            expiry
        );
        depositId = ContractUtils.getRandomId(user.address);
        const signature = await ContractUtils.signMessage(agent, message);
        await expect(
            loyaltyBridgeContract
                .connect(deployments.accounts.certifiers[0])
                .depositToBridge(tokenId, depositId, user.address, amount, expiry, signature)
        )
            .to.emit(loyaltyBridgeContract, "BridgeDeposited")
            .withNamedArgs({
                depositId,
                account: user.address,
                amount,
            });
        expect(await ledgerContract.tokenBalanceOf(user.address)).to.deep.equal(oldTokenBalance.sub(amount));
        expect(await ledgerContract.tokenBalanceOf(loyaltyBridgeContract.address)).to.deep.equal(
            oldLiquidity.add(amount)
        );
    });

    it("Withdraw from Main Bridge", async () => {
        const user = deployments.accounts.users[0];
        const agent = deployments.accounts.users[1];
        const oldLiquidity = await tokenContract.balanceOf(bridgeContract.address);
        const oldTokenBalance = await tokenContract.balanceOf(user.address);
        const oldFeeBalance = await tokenContract.balanceOf(deployments.accounts.protocolFee.address);

        await bridgeContract
            .connect(deployments.accounts.bridgeValidators[0])
            .withdrawFromBridge(tokenId, depositId, user.address, amount);
        await expect(
            bridgeContract
                .connect(deployments.accounts.bridgeValidators[1])
                .withdrawFromBridge(tokenId, depositId, user.address, amount)
        )
            .to.emit(bridgeContract, "BridgeWithdrawn")
            .withNamedArgs({
                withdrawId: depositId,
                account: user.address,
                amount: amount.sub(fee),
            });

        expect(await tokenContract.balanceOf(bridgeContract.address)).to.deep.equal(oldLiquidity.sub(amount));
        expect(await tokenContract.balanceOf(user.address)).to.deep.equal(oldTokenBalance.add(amount.sub(fee)));
        expect(await tokenContract.balanceOf(deployments.accounts.protocolFee.address)).to.deep.equal(
            oldFeeBalance.add(fee)
        );
    });
});
