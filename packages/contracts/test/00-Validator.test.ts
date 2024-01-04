import "@nomiclabs/hardhat-ethers";
import "@nomiclabs/hardhat-waffle";
import "@openzeppelin/hardhat-upgrades";
import { ethers, upgrades, waffle } from "hardhat";

import { Amount } from "../src/utils/Amount";
import { Token, Validator } from "../typechain-types";

import assert from "assert";
import chai, { expect } from "chai";
import { solidity } from "ethereum-waffle";

chai.use(solidity);

describe("Test for Validator", () => {
    const provider = waffle.provider;
    const [deployer, validator1, validator2, validator3, user1] = provider.getWallets();

    const validators = [validator1, validator2, validator3];
    let contract: Validator;
    let tokenContract: Token;

    const amount = Amount.make(100_000, 18);
    const halfAmount = Amount.make(50_000, 18);

    before(async () => {
        const tokenFactory = await ethers.getContractFactory("Token");
        tokenContract = (await tokenFactory.connect(deployer).deploy(deployer.address, "Sample", "SAM")) as Token;
        await tokenContract.deployed();
        await tokenContract.deployTransaction.wait();
        for (const elem of validators) {
            await tokenContract.connect(deployer).transfer(elem.address, amount.value);
        }

        const factory = await ethers.getContractFactory("Validator");
        contract = (await upgrades.deployProxy(
            factory.connect(deployer),
            [tokenContract.address, validators.map((m) => m.address)],
            {
                initializer: "initialize",
                kind: "uups",
            }
        )) as Validator;
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
        await expect(contract.connect(deployer).deposit(amount.value)).to.be.revertedWith("1000");
    });

    it("Deposit not allowed", async () => {
        await expect(contract.connect(validators[0]).deposit(amount.value)).to.be.revertedWith("1020");
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

        assert.deepStrictEqual((await contract.lengthOfActiveValidator()).toString(), "3");
    });

    it("Request participation - already validator", async () => {
        await tokenContract.connect(deployer).transfer(validator1.address, amount.value);
        await tokenContract.connect(validator1).approve(contract.address, amount.value);
        await expect(contract.connect(validator1).requestRegistration()).to.be.revertedWith("1003");
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

        assert.deepStrictEqual((await contract.lengthOfActiveValidator()).toString(), "3");
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

        assert.deepStrictEqual((await contract.lengthOfActiveValidator()).toString(), "2");
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

        assert.deepStrictEqual((await contract.lengthOfActiveValidator()).toString(), "1");
    });

    it("Voluntary Exit 2", async () => {
        await expect(contract.connect(validator2).exit()).to.revertedWith("1010");
    });
});
