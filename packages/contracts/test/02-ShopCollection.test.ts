import { Amount } from "../src/utils/Amount";
import { ContractUtils } from "../src/utils/ContractUtils";
import { ShopCollection, Token, ValidatorCollection } from "../typechain-types";

import "@nomiclabs/hardhat-ethers";
import "@nomiclabs/hardhat-waffle";

import assert from "assert";
import chai, { expect } from "chai";
import { solidity } from "ethereum-waffle";

import * as hre from "hardhat";

chai.use(solidity);

describe("Test for ShopCollection", () => {
    const provider = hre.waffle.provider;
    const [deployer, validator1, validator2, validator3, user1] = provider.getWallets();

    const validators = [validator1, validator2, validator3];
    let validatorContract: ValidatorCollection;
    let tokenContract: Token;
    let shopCollection: ShopCollection;

    const amount = Amount.make(20_000, 18);

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
            providePercent: number;
        }

        const shopData: IShopData[] = [
            {
                shopId: "F000100",
                provideWaitTime: 0,
                providePercent: 5,
            },
            {
                shopId: "F000200",
                provideWaitTime: 0,
                providePercent: 5,
            },
            {
                shopId: "F000300",
                provideWaitTime: 0,
                providePercent: 5,
            },
            {
                shopId: "F000400",
                provideWaitTime: 0,
                providePercent: 5,
            },
            {
                shopId: "F000500",
                provideWaitTime: 0,
                providePercent: 5,
            },
        ];

        it("Not validator", async () => {
            const phone = ContractUtils.getPhoneHash("08201012341001");
            await expect(shopCollection.connect(user1).add("F000100", 0, 5)).to.revertedWith("Not validator");
        });

        it("Success", async () => {
            for (const elem of shopData) {
                await expect(
                    shopCollection.connect(validator1).add(elem.shopId, elem.provideWaitTime, elem.providePercent)
                )
                    .to.emit(shopCollection, "AddedShop")
                    .withArgs(elem.shopId, elem.provideWaitTime, elem.providePercent);
            }
            expect(await shopCollection.shopsLength()).to.equal(shopData.length);
        });
    });
});
