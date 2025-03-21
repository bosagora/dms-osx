import "@nomiclabs/hardhat-ethers";
import "@nomiclabs/hardhat-waffle";
import "@openzeppelin/hardhat-upgrades";
import { ethers, upgrades } from "hardhat";

import { Amount } from "../src/utils/Amount";
import { ERC20, Validator } from "../typechain-types";

import assert from "assert";
import chai, { expect } from "chai";
import { solidity } from "ethereum-waffle";
import { Deployments } from "./helper/Deployments";

chai.use(solidity);

describe("Test for Validator", () => {
    const deployments = new Deployments();

    let tokenContract: ERC20;
    let contract: Validator;

    const amount = Amount.make(100_000, 18);
    const halfAmount = Amount.make(50_000, 18);

    before(async () => {
        await deployments.doDeployToken();

        tokenContract = deployments.getContract("TestKIOS") as ERC20;

        for (const elem of deployments.accounts.validators) {
            await tokenContract.connect(deployments.accounts.owner).transfer(elem.address, amount.value);
        }

        const factory = await ethers.getContractFactory("Validator");
        contract = (await upgrades.deployProxy(
            factory.connect(deployments.accounts.deployer),
            [tokenContract.address, deployments.accounts.validators.map((m) => m.address)],
            {
                initializer: "initialize",
                kind: "uups",
            }
        )) as Validator;
        await contract.deployed();
        await contract.deployTransaction.wait();
    });

    it("Check validator", async () => {
        let item = await contract.validatorOf(deployments.accounts.validators[0].address);
        assert.deepStrictEqual(item.validator, deployments.accounts.validators[0].address);
        assert.deepStrictEqual(item.status, 2);

        item = await contract.validatorOf(deployments.accounts.validators[1].address);
        assert.deepStrictEqual(item.validator, deployments.accounts.validators[1].address);
        assert.deepStrictEqual(item.status, 2);

        item = await contract.validatorOf(deployments.accounts.validators[2].address);
        assert.deepStrictEqual(item.validator, deployments.accounts.validators[2].address);
        assert.deepStrictEqual(item.status, 2);
    });

    it("Deposit not validator", async () => {
        await tokenContract.connect(deployments.accounts.deployer).approve(contract.address, amount.value);
        await expect(contract.connect(deployments.accounts.deployer).deposit(amount.value)).to.be.revertedWith("1000");
    });

    it("Deposit not allowed", async () => {
        await expect(contract.connect(deployments.accounts.validators[0]).deposit(amount.value)).to.be.revertedWith(
            "1020"
        );
    });

    it("Deposit 25,000", async () => {
        for (const elem of deployments.accounts.validators) {
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
        for (const elem of deployments.accounts.validators) {
            await tokenContract.connect(elem).approve(contract.address, halfAmount.value);
            await expect(contract.connect(elem).deposit(halfAmount.value))
                .to.emit(contract, "DepositedForValidator")
                .withArgs(elem.address, halfAmount.value, amount.value);
            const item = await contract.validatorOf(elem.address);
            assert.deepStrictEqual(item.validator, elem.address);
            assert.deepStrictEqual(item.status, 1);
            assert.deepStrictEqual(item.balance, amount.value);
        }

        assert.deepStrictEqual(
            (await contract.lengthOfActiveValidator()).toString(),
            deployments.accounts.validators.length.toString()
        );
    });
});
