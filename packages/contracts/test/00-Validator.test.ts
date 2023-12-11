import { Amount } from "../src/utils/Amount";
import { Token, Validator } from "../typechain-types";
import "@nomicfoundation/hardhat-ethers";
import "@openzeppelin/hardhat-upgrades";
import { ethers, upgrades } from "hardhat";

import assert from "assert";
import { expect } from "chai";

import { HardhatAccount } from "../src/HardhatAccount";

describe("Test for Validator", () => {
    const accounts = HardhatAccount.keys.map((m) => new ethers.Wallet(m, ethers.provider));
    const [deployer, validator1, validator2, validator3, user1] = accounts;

    const validators = [validator1, validator2, validator3];
    let contract: Validator;
    let tokenContract: Token;

    const amount = Amount.make(20000, 18);
    const halfAmount = Amount.make(10000, 18);

    before(async () => {
        const tokenFactory = await ethers.getContractFactory("Token");
        tokenContract = (await tokenFactory
            .connect(deployer)
            .deploy(deployer.address, "Sample", "SAM")) as unknown as Token;
        await tokenContract.waitForDeployment();
        for (const elem of validators) {
            await tokenContract.connect(deployer).transfer(elem.address, amount.value);
        }

        const factory = await ethers.getContractFactory("Validator");
        contract = (await upgrades.deployProxy(
            factory.connect(deployer),
            [await tokenContract.getAddress(), validators.map((m) => m.address)],
            {
                initializer: "initialize",
                kind: "uups",
            }
        )) as unknown as Validator;
        await contract.waitForDeployment();
    });

    it("Check validator", async () => {
        let item = await contract.validatorOf(validator1.address);
        assert.deepStrictEqual(item.validator, validator1.address);
        assert.deepStrictEqual(item.status, 2n);

        item = await contract.validatorOf(validator2.address);
        assert.deepStrictEqual(item.validator, validator2.address);
        assert.deepStrictEqual(item.status, 2n);

        item = await contract.validatorOf(validator3.address);
        assert.deepStrictEqual(item.validator, validator3.address);
        assert.deepStrictEqual(item.status, 2n);
    });

    it("Deposit not validator", async () => {
        await tokenContract.connect(deployer).approve(await contract.getAddress(), amount.value);
        await expect(contract.connect(deployer).deposit(amount.value)).to.be.revertedWith("1000");
    });

    it("Deposit not allowed", async () => {
        await expect(contract.connect(validators[0]).deposit(amount.value)).to.be.revertedWith("1020");
    });

    it("Deposit 25,000", async () => {
        for (const elem of validators) {
            await tokenContract.connect(elem).approve(await contract.getAddress(), halfAmount.value);
            await expect(contract.connect(elem).deposit(halfAmount.value))
                .to.emit(contract, "DepositedForValidator")
                .withArgs(elem.address, halfAmount.value, halfAmount.value);
            const item = await contract.validatorOf(elem.address);
            assert.deepStrictEqual(item.validator, elem.address);
            assert.deepStrictEqual(item.status, 2n);
            assert.deepStrictEqual(item.balance, halfAmount.value);
        }
    });

    it("Deposit 50,000", async () => {
        for (const elem of validators) {
            await tokenContract.connect(elem).approve(await contract.getAddress(), halfAmount.value);
            await expect(contract.connect(elem).deposit(halfAmount.value))
                .to.emit(contract, "DepositedForValidator")
                .withArgs(elem.address, halfAmount.value, amount.value);
            const item = await contract.validatorOf(elem.address);
            assert.deepStrictEqual(item.validator, elem.address);
            assert.deepStrictEqual(item.status, 1n);
            assert.deepStrictEqual(item.balance, amount.value);
        }

        assert.deepStrictEqual((await contract.activeItemsLength()).toString(), "3");
    });

    it("Request participation - already validator", async () => {
        await tokenContract.connect(deployer).transfer(validator1.address, amount.value);
        await tokenContract.connect(validator1).approve(await contract.getAddress(), amount.value);
        await expect(contract.connect(validator1).requestRegistration()).to.be.revertedWith("1003");
    });

    it("Request participation - not allowed deposit", async () => {
        await tokenContract.connect(user1).approve(await contract.getAddress(), amount.value);
        await expect(contract.connect(user1).requestRegistration()).to.be.reverted;
    });

    it("Request registration", async () => {
        await tokenContract.connect(deployer).transfer(user1.address, amount.value);
        await tokenContract.connect(user1).approve(await contract.getAddress(), amount.value);
        await expect(contract.connect(user1).requestRegistration())
            .to.emit(contract, "RequestedToJoinValidator")
            .withArgs(user1.address);
        const item = await contract.validatorOf(user1.address);
        assert.deepStrictEqual(item.validator, user1.address);
        assert.deepStrictEqual(item.status, 1n);
        assert.deepStrictEqual(item.balance, amount.value);

        assert.deepStrictEqual((await contract.activeItemsLength()).toString(), "3");
    });

    it("Request exit", async () => {
        const balanceBefore = await tokenContract.balanceOf(await contract.getAddress());
        await expect(contract.connect(validator1).requestExit(validator3.address))
            .to.emit(contract, "RequestedToExitValidator")
            .withArgs(validator1.address, validator3.address);
        const item = await contract.validatorOf(validator3.address);
        assert.deepStrictEqual(item.validator, validator3.address);
        assert.deepStrictEqual(item.status, 3n);
        assert.deepStrictEqual(item.balance, 0n);
        const balanceAfter = await tokenContract.balanceOf(await contract.getAddress());
        assert.deepStrictEqual(balanceBefore - balanceAfter, amount.value);

        assert.deepStrictEqual((await contract.activeItemsLength()).toString(), "2");
    });

    it("Voluntary Exit 1", async () => {
        const balanceBefore = await tokenContract.balanceOf(await contract.getAddress());
        await expect(contract.connect(validator1).exit())
            .to.emit(contract, "ExitedFromValidator")
            .withArgs(validator1.address);
        const item = await contract.validatorOf(validator1.address);
        assert.deepStrictEqual(item.validator, validator1.address);
        assert.deepStrictEqual(item.status, 3n);
        assert.deepStrictEqual(item.balance, 0n);
        const balanceAfter = await tokenContract.balanceOf(await contract.getAddress());
        assert.deepStrictEqual(balanceBefore - balanceAfter, amount.value);

        assert.deepStrictEqual((await contract.activeItemsLength()).toString(), "1");
    });

    it("Voluntary Exit 2", async () => {
        await expect(contract.connect(validator2).exit()).to.revertedWith("1010");
    });
});
