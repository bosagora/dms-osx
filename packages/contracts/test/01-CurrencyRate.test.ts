import { Amount } from "../src/utils/Amount";
import { CurrencyRate, Token, ValidatorCollection } from "../typechain-types";

import "@nomiclabs/hardhat-ethers";
import "@nomiclabs/hardhat-waffle";

import assert from "assert";
import chai, { expect } from "chai";
import { solidity } from "ethereum-waffle";

import * as hre from "hardhat";

chai.use(solidity);

describe("Test for CurrencyRate", () => {
    const provider = hre.waffle.provider;
    const [deployer, validator1, validator2, validator3, user1] = provider.getWallets();

    const validators = [validator1, validator2, validator3];
    let validatorContract: ValidatorCollection;
    let tokenContract: Token;
    let currencyRateContract: CurrencyRate;

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

        const currencyRateFactory = await hre.ethers.getContractFactory("CurrencyRate");
        currencyRateContract = (await currencyRateFactory
            .connect(deployer)
            .deploy(validatorContract.address)) as CurrencyRate;
        await currencyRateContract.deployed();
        await currencyRateContract.deployTransaction.wait();
    });

    context("Set", () => {
        it("Not validator", async () => {
            const currency = "the9";
            const price = 123000000000;
            await expect(currencyRateContract.connect(user1).set(currency, price)).to.revertedWith("Not validator");
        });
        it("Success", async () => {
            const currency = "the9";
            const price = 123000000000;
            await expect(currencyRateContract.connect(validators[0]).set(currency, price))
                .to.emit(currencyRateContract, "SetPrice")
                .withNamedArgs({ currency, price });
        });
    });

    context("Get", () => {
        it("Success - usd", async () => {
            const currency = "usd";
            const price = 0;
            expect(await currencyRateContract.connect(validators[0]).get(currency)).to.equal(price);
        });

        it("Success - the9", async () => {
            const currency = "the9";
            const price = 123000000000;
            expect(await currencyRateContract.connect(validators[0]).get(currency)).to.equal(price);
        });
    });
});
