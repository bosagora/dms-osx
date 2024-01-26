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
});
