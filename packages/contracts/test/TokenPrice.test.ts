import { Amount } from "../src/utils/Amount";
import { Token, TokenPrice, ValidatorCollection } from "../typechain-types";

import "@nomiclabs/hardhat-ethers";
import "@nomiclabs/hardhat-waffle";

import assert from "assert";
import chai, { expect } from "chai";
import { solidity } from "ethereum-waffle";

import * as hre from "hardhat";

chai.use(solidity);

describe("Test for TokenPrice", () => {
    const provider = hre.waffle.provider;
    const [deployer, validator1, validator2, validator3, user1] = provider.getWallets();

    const validators = [validator1, validator2, validator3];
    let validatorContract: ValidatorCollection;
    let tokenContract: Token;
    let tokenPriceContract: TokenPrice;

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

        const tokenPriceFactory = await hre.ethers.getContractFactory("TokenPrice");
        tokenPriceContract = (await tokenPriceFactory
            .connect(deployer)
            .deploy(validatorContract.address)) as TokenPrice;
        await tokenPriceContract.deployed();
        await tokenPriceContract.deployTransaction.wait();
    });

    context("Set", () => {
        it("Not validator", async () => {
            const currency = "KRW";
            const price = 123000000000;
            await expect(tokenPriceContract.connect(user1).set(currency, price)).to.revertedWith("Not validator");
        });
        it("Success", async () => {
            const currency = "KRW";
            const price = 123000000000;
            await expect(tokenPriceContract.connect(validators[0]).set(currency, price))
                .to.emit(tokenPriceContract, "SetPrice")
                .withNamedArgs({ currency, price });
        });
    });

    context("Get", () => {
        it("Success - USD", async () => {
            const currency = "USD";
            const price = 0;
            expect(await tokenPriceContract.connect(validators[0]).get(currency)).to.equal(price);
        });

        it("Success - KRW", async () => {
            const currency = "KRW";
            const price = 123000000000;
            expect(await tokenPriceContract.connect(validators[0]).get(currency)).to.equal(price);
        });
    });
});
