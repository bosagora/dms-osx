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
    const [deployer, validator1, validator2, validator3, user1, shop1, shop2, shop3, shop4, shop5] =
        provider.getWallets();

    const validators = [validator1, validator2, validator3];
    const shopWallets = [shop1, shop2, shop3, shop4, shop5];
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
            phone: string;
            account: string;
        }

        const shopData: IShopData[] = [
            {
                shopId: "F000100",
                provideWaitTime: 0,
                providePercent: 5,
                phone: "08201020001000",
                account: shopWallets[0].address,
            },
            {
                shopId: "F000200",
                provideWaitTime: 0,
                providePercent: 5,
                phone: "08201020001001",
                account: shopWallets[1].address,
            },
            {
                shopId: "F000300",
                provideWaitTime: 0,
                providePercent: 5,
                phone: "08201020001002",
                account: shopWallets[2].address,
            },
            {
                shopId: "F000400",
                provideWaitTime: 0,
                providePercent: 5,
                phone: "08201020001003",
                account: shopWallets[3].address,
            },
            {
                shopId: "F000500",
                provideWaitTime: 0,
                providePercent: 5,
                phone: "08201020001004",
                account: shopWallets[4].address,
            },
        ];

        it("Not validator", async () => {
            await expect(
                shopCollection
                    .connect(user1)
                    .add(
                        shopData[0].shopId,
                        shopData[0].provideWaitTime,
                        shopData[0].providePercent,
                        shopData[0].account
                    )
            ).to.revertedWith("Not validator");
        });

        it("Success", async () => {
            for (const elem of shopData) {
                const phoneHash = ContractUtils.getPhoneHash(elem.phone);
                await expect(
                    shopCollection
                        .connect(validator1)
                        .add(elem.shopId, elem.provideWaitTime, elem.providePercent, elem.account)
                )
                    .to.emit(shopCollection, "AddedShop")
                    .withArgs(elem.shopId, elem.provideWaitTime, elem.providePercent, elem.account);
            }
            expect(await shopCollection.shopsLength()).to.equal(shopData.length);
        });
    });
});
