import { Token, ValidatorCollection } from "../typechain-types";
import { Amount } from "../src/utils/Amount";

import "@nomiclabs/hardhat-ethers";
import "@nomiclabs/hardhat-waffle";

import assert from "assert";
import chai, { expect } from "chai";
import { solidity } from "ethereum-waffle";

import * as hre from "hardhat";

chai.use(solidity);

describe("Test for ValidatorCollection", () => {
    const provider = hre.waffle.provider;
    const [deployer, validator1, validator2, validator3, user1] = provider.getWallets();

    const validators = [validator1, validator2, validator3];
    let contract: ValidatorCollection;
    let tokenContract: Token;

    const amount = Amount.make(50000, 18);
    const halfAmount = Amount.make(25000, 18);

    before(async () => {
        const tokenFactory = await hre.ethers.getContractFactory("Token");
        tokenContract = (await tokenFactory.connect(deployer).deploy(deployer.address, "Sample", "SAM")) as Token;
        await tokenContract.deployed();
        await tokenContract.deployTransaction.wait();
        for (const elem of validators) {
            await tokenContract.connect(deployer).transfer(elem.address, amount.value);
        }

        const factory = await hre.ethers.getContractFactory("ValidatorCollection");
        contract = (await factory.connect(deployer).deploy(
            tokenContract.address,
            validators.map((m) => m.address)
        )) as ValidatorCollection;
        await contract.deployed();
        await contract.deployTransaction.wait();
    });

    it("Check validator", async () => {
        let item = await contract.validatorOf(validator1.address);
        assert.deepStrictEqual(item.validator, validator1.address);
        assert.deepStrictEqual(item.status, 2);

        item = await contract.validatorOf(validator2.address);
        assert.deepStrictEqual(item.validator, validator2.address);
        assert.deepStrictEqual(item.status, 2);

        item = await contract.validatorOf(validator3.address);
        assert.deepStrictEqual(item.validator, validator3.address);
        assert.deepStrictEqual(item.status, 2);
    });

    it("Deposit not validator", async () => {
        await tokenContract.connect(deployer).approve(contract.address, amount.value);
        await expect(contract.connect(deployer).deposit(amount.value)).to.be.revertedWith("Not validator");
    });

    it("Deposit not allowed", async () => {
        await expect(contract.connect(validators[0]).deposit(amount.value)).to.be.revertedWith("Not allowed deposit");
    });

    it("Deposit 25,000", async () => {
        for (const elem of validators) {
            await tokenContract.connect(elem).approve(contract.address, halfAmount.value);
            await expect(contract.connect(elem).deposit(halfAmount.value))
                .to.emit(contract, "DepositedForValidator")
                .withArgs(elem.address, halfAmount.value, halfAmount.value);
            const item = await contract.validatorOf(elem.address);
            assert.deepStrictEqual(item.validator, elem.address);
            assert.deepStrictEqual(item.status, 2);
            assert.deepStrictEqual(item.balance, halfAmount.value);
        }
    });

    it("Deposit 50,000", async () => {
        for (const elem of validators) {
            await tokenContract.connect(elem).approve(contract.address, halfAmount.value);
            await expect(contract.connect(elem).deposit(halfAmount.value))
                .to.emit(contract, "DepositedForValidator")
                .withArgs(elem.address, halfAmount.value, amount.value);
            const item = await contract.validatorOf(elem.address);
            assert.deepStrictEqual(item.validator, elem.address);
            assert.deepStrictEqual(item.status, 1);
            assert.deepStrictEqual(item.balance, amount.value);
        }

        await contract.connect(validator1).makeActiveItems();
        assert.deepStrictEqual((await contract.activeItemsLength()).toString(), "3");
    });

    it("Request participation - already validator", async () => {
        await tokenContract.connect(deployer).transfer(validator1.address, amount.value);
        await tokenContract.connect(validator1).approve(contract.address, amount.value);
        await expect(contract.connect(validator1).requestRegistration()).to.be.revertedWith("Already validator");
    });

    it("Request participation - not allowed deposit", async () => {
        await tokenContract.connect(user1).approve(contract.address, amount.value);
        await expect(contract.connect(user1).requestRegistration()).to.be.revertedWith(
            "ERC20: transfer amount exceeds balance"
        );
    });

    it("Request registration", async () => {
        await tokenContract.connect(deployer).transfer(user1.address, amount.value);
        await tokenContract.connect(user1).approve(contract.address, amount.value);
        await expect(contract.connect(user1).requestRegistration())
            .to.emit(contract, "RequestedToJoinValidator")
            .withArgs(user1.address);
        const item = await contract.validatorOf(user1.address);
        assert.deepStrictEqual(item.validator, user1.address);
        assert.deepStrictEqual(item.status, 1);
        assert.deepStrictEqual(item.balance, amount.value);

        await contract.connect(validator1).makeActiveItems();
        assert.deepStrictEqual((await contract.activeItemsLength()).toString(), "3");
    });

    it("Request exit", async () => {
        const balanceBefore = await tokenContract.balanceOf(contract.address);
        await expect(contract.connect(validator1).requestExit(validator3.address))
            .to.emit(contract, "RequestedToExitValidator")
            .withArgs(validator1.address, validator3.address);
        const item = await contract.validatorOf(validator3.address);
        assert.deepStrictEqual(item.validator, validator3.address);
        assert.deepStrictEqual(item.status, 3);
        assert.deepStrictEqual(item.balance.toString(), "0");
        const balanceAfter = await tokenContract.balanceOf(contract.address);
        assert.deepStrictEqual(balanceBefore.sub(balanceAfter).toString(), amount.toString());

        await contract.connect(validator1).makeActiveItems();
        assert.deepStrictEqual((await contract.activeItemsLength()).toString(), "2");
    });

    it("Voluntary Exit 1", async () => {
        const balanceBefore = await tokenContract.balanceOf(contract.address);
        await expect(contract.connect(validator1).exit())
            .to.emit(contract, "ExitedFromValidator")
            .withArgs(validator1.address);
        const item = await contract.validatorOf(validator1.address);
        assert.deepStrictEqual(item.validator, validator1.address);
        assert.deepStrictEqual(item.status, 3);
        assert.deepStrictEqual(item.balance.toString(), "0");
        const balanceAfter = await tokenContract.balanceOf(contract.address);
        assert.deepStrictEqual(balanceBefore.sub(balanceAfter).toString(), amount.toString());

        await contract.connect(validator2).makeActiveItems();
        assert.deepStrictEqual((await contract.activeItemsLength()).toString(), "1");
    });

    it("Voluntary Exit 2", async () => {
        await expect(contract.connect(validator2).exit()).to.revertedWith("Last validator");
    });
});
