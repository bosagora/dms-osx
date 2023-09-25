import { Amount } from "../src/utils/Amount";
import { ShopCollection, Token, ValidatorCollection } from "../typechain-types";

import "@nomiclabs/hardhat-ethers";
import "@nomiclabs/hardhat-waffle";

import assert from "assert";
import chai, { expect } from "chai";
import { solidity } from "ethereum-waffle";

import * as hre from "hardhat";
import { ContractUtils } from "../src/utils/ContractUtils";

chai.use(solidity);

describe("Test for ShopCollection", () => {
    const provider = hre.waffle.provider;
    const [deployer, validator1, validator2, validator3, user1] = provider.getWallets();

    const validators = [validator1, validator2, validator3];
    let validatorContract: ValidatorCollection;
    let tokenContract: Token;
    let shopCollection: ShopCollection;

    const amount = Amount.make(50_000, 18);

    before(async () => {
        const tokenFactory = await hre.ethers.getContractFactory("Token");
        tokenContract = (await tokenFactory.connect(deployer).deploy(deployer.address, "Sample", "SAM")) as Token;
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
                .to.emit(validatorContract, "DepositedForValidator")
                .withArgs(elem.address, amount.value, amount.value);
            const item = await validatorContract.validatorOf(elem.address);
            assert.deepStrictEqual(item.validator, elem.address);
            assert.deepStrictEqual(item.status, 1);
            assert.deepStrictEqual(item.balance, amount.value);
        }
        await validatorContract.connect(validators[0]).makeActiveItems();

        const shopCollectionFactory = await hre.ethers.getContractFactory("ShopCollection");
        shopCollection = (await shopCollectionFactory
            .connect(deployer)
            .deploy(validatorContract.address)) as ShopCollection;
        await shopCollection.deployed();
        await shopCollection.deployTransaction.wait();
    });

    context("Add", () => {
        interface IShopData {
            shopId: string;
            provideWaitTime: number;
            email: string;
        }

        const shopData: IShopData[] = [
            {
                shopId: "F000100",
                provideWaitTime: 0,
                email: "f1@example.com",
            },
            {
                shopId: "F000200",
                provideWaitTime: 0,
                email: "f2@example.com",
            },
            {
                shopId: "F000300",
                provideWaitTime: 0,
                email: "f3@example.com",
            },
            {
                shopId: "F000400",
                provideWaitTime: 0,
                email: "f4@example.com",
            },
            {
                shopId: "F000500",
                provideWaitTime: 0,
                email: "f5@example.com",
            },
        ];

        it("Not validator", async () => {
            const email = ContractUtils.sha256String("f100@example.com");
            await expect(shopCollection.connect(user1).add("F000100", 0, email)).to.revertedWith("Not validator");
        });

        it("Success", async () => {
            for (const elem of shopData) {
                const email = ContractUtils.sha256String(elem.email);
                await expect(shopCollection.connect(validator1).add(elem.shopId, elem.provideWaitTime, email))
                    .to.emit(shopCollection, "AddedShop")
                    .withArgs(elem.shopId, elem.provideWaitTime, email);
            }
            expect(await shopCollection.shopsLength()).to.equal(shopData.length);
        });
    });
});
