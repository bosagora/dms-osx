import { FranchiseeCollection, Token, ValidatorCollection } from "../typechain-types";
import { Amount } from "./helper/Amount";

import "@nomiclabs/hardhat-ethers";
import "@nomiclabs/hardhat-waffle";

import assert from "assert";
import chai, { expect } from "chai";
import { solidity } from "ethereum-waffle";

import * as hre from "hardhat";
import { ContractUtils } from "./helper/ContractUtils";

chai.use(solidity);

describe("Test for FranchiseeCollection", () => {
    const provider = hre.waffle.provider;
    const [deployer, validator1, validator2, validator3, user1] = provider.getWallets();

    const validators = [validator1, validator2, validator3];
    let validatorContract: ValidatorCollection;
    let tokenContract: Token;
    let franchiseeCollection: FranchiseeCollection;

    const amount = Amount.make(50_000, 18);

    before(async () => {
        const tokenFactory = await hre.ethers.getContractFactory("Token");
        tokenContract = (await tokenFactory.connect(deployer).deploy("Sample", "SAM")) as Token;
        await tokenContract.deployed();
        await tokenContract.deployTransaction.wait();
        for (const elem of validators) {
            await tokenContract.connect(deployer).transfer(elem.address, amount.value);
        }

        const validatorFactory = await hre.ethers.getContractFactory("ValidatorCollection");
        validatorContract = (await validatorFactory.connect(deployer).deploy(
            tokenContract.address,
            validators.map((m) => m.address)
        )) as ValidatorCollection;
        await validatorContract.deployed();
        await validatorContract.deployTransaction.wait();

        for (const elem of validators) {
            await tokenContract.connect(elem).approve(validatorContract.address, amount.value);
            await expect(validatorContract.connect(elem).deposit(amount.value))
                .to.emit(validatorContract, "Deposited")
                .withArgs(elem.address, amount.value, amount.value);
            const item = await validatorContract.validatorOf(elem.address);
            assert.deepStrictEqual(item.validator, elem.address);
            assert.deepStrictEqual(item.status, 1);
            assert.deepStrictEqual(item.balance, amount.value);
        }
        await validatorContract.connect(validators[0]).makeActiveItems();

        const franchiseeCollectionFactory = await hre.ethers.getContractFactory("FranchiseeCollection");
        franchiseeCollection = (await franchiseeCollectionFactory
            .connect(deployer)
            .deploy(validatorContract.address)) as FranchiseeCollection;
        await franchiseeCollection.deployed();
        await franchiseeCollection.deployTransaction.wait();
    });

    context("Add", () => {
        interface IFranchiseeData {
            franchiseeId: string;
            payoutWaitTime: number;
            email: string;
        }

        const franchiseeData: IFranchiseeData[] = [
            {
                franchiseeId: "F000100",
                payoutWaitTime: 0,
                email: "f1@example.com",
            },
            {
                franchiseeId: "F000200",
                payoutWaitTime: 0,
                email: "f2@example.com",
            },
            {
                franchiseeId: "F000300",
                payoutWaitTime: 0,
                email: "f3@example.com",
            },
            {
                franchiseeId: "F000400",
                payoutWaitTime: 0,
                email: "f4@example.com",
            },
            {
                franchiseeId: "F000500",
                payoutWaitTime: 0,
                email: "f5@example.com",
            },
        ];

        it("Not validator", async () => {
            const email = ContractUtils.sha256String("f100@example.com");
            await expect(franchiseeCollection.connect(user1).add("F000100", 0, email)).to.revertedWith("Not validator");
        });

        it("Success", async () => {
            for (const elem of franchiseeData) {
                const email = ContractUtils.sha256String(elem.email);
                await expect(
                    franchiseeCollection.connect(validator1).add(elem.franchiseeId, elem.payoutWaitTime, email)
                )
                    .to.emit(franchiseeCollection, "Added")
                    .withArgs(elem.franchiseeId, elem.payoutWaitTime, email);
            }
            expect(await franchiseeCollection.franchiseesLength()).to.equal(franchiseeData.length);
        });
    });
});
