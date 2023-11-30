import { Amount } from "../src/utils/Amount";
import { CurrencyRate, Token, ValidatorCollection } from "../typechain-types";

import "@nomiclabs/hardhat-ethers";
import "@nomiclabs/hardhat-waffle";

import assert from "assert";
import chai, { expect } from "chai";
import { solidity } from "ethereum-waffle";

import * as hre from "hardhat";

import { BigNumber } from "ethers";

chai.use(solidity);

describe("Test for CurrencyRate", () => {
    const provider = hre.waffle.provider;
    const [deployer, validator1, validator2, validator3, user1] = provider.getWallets();

    const validators = [validator1, validator2, validator3];
    let validatorContract: ValidatorCollection;
    let tokenContract: Token;
    let currencyRateContract: CurrencyRate;

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

        const currencyRateFactory = await hre.ethers.getContractFactory("CurrencyRate");
        currencyRateContract = (await currencyRateFactory
            .connect(deployer)
            .deploy(validatorContract.address, await tokenContract.symbol())) as CurrencyRate;
        await currencyRateContract.deployed();
        await currencyRateContract.deployTransaction.wait();
    });

    it("Set Not validator", async () => {
        const currency = "the9";
        const rate = 123000000000;
        await expect(currencyRateContract.connect(user1).set(currency, rate)).to.revertedWith("1000");
    });
    it("Set Success", async () => {
        const currency = "the9";
        const rate = 123000000000;
        await expect(currencyRateContract.connect(validators[0]).set(currency, rate))
            .to.emit(currencyRateContract, "SetRate")
            .withNamedArgs({ currency, rate });
    });

    it("Get Fail - usd", async () => {
        const currency = "usd";
        await expect(currencyRateContract.connect(validators[0]).get(currency)).to.be.revertedWith("1211");
    });

    it("Get Success - the9", async () => {
        const currency = "the9";
        const rate = 123000000000;
        expect(await currencyRateContract.connect(validators[0]).get(currency)).to.equal(rate);
    });

    it("Function", async () => {
        const multiple = await currencyRateContract.MULTIPLE();
        const symbol = await tokenContract.symbol();

        let rate = BigNumber.from(100).mul(multiple);
        await expect(currencyRateContract.connect(validators[0]).set(symbol, rate))
            .to.emit(currencyRateContract, "SetRate")
            .withNamedArgs({ rate });
        rate = BigNumber.from(1000).mul(multiple);
        await expect(currencyRateContract.connect(validators[0]).set("usd", rate))
            .to.emit(currencyRateContract, "SetRate")
            .withNamedArgs({ rate });

        rate = BigNumber.from(10).mul(multiple);
        await expect(currencyRateContract.connect(validators[0]).set("jpy", rate))
            .to.emit(currencyRateContract, "SetRate")
            .withNamedArgs({ rate });

        assert.deepStrictEqual(
            (await currencyRateContract.convertPointToToken(Amount.make(100).value)).toString(),
            Amount.make(1).toString()
        );
        assert.deepStrictEqual(
            (await currencyRateContract.convertTokenToPoint(Amount.make(1).value)).toString(),
            Amount.make(100).toString()
        );
        assert.deepStrictEqual(
            (await currencyRateContract.convertCurrencyToToken(Amount.make(1).value, "usd")).toString(),
            Amount.make(10).toString()
        );
        assert.deepStrictEqual(
            (await currencyRateContract.convertCurrencyToToken(Amount.make(1).value, "jpy")).toString(),
            Amount.make(0.1).toString()
        );
        assert.deepStrictEqual(
            (await currencyRateContract.convertCurrencyToPoint(Amount.make(1).value, "usd")).toString(),
            Amount.make(1000).toString()
        );
        assert.deepStrictEqual(
            (await currencyRateContract.convertCurrencyToPoint(Amount.make(1).value, "jpy")).toString(),
            Amount.make(10).toString()
        );
        assert.deepStrictEqual(
            (await currencyRateContract.convertCurrency(Amount.make(1).value, "jpy", "usd")).toString(),
            Amount.make(0.01).toString()
        );
        assert.deepStrictEqual(
            (await currencyRateContract.convertCurrency(Amount.make(1).value, "usd", "jpy")).toString(),
            Amount.make(100).toString()
        );
    });
});
