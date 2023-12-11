import { Amount } from "../src/utils/Amount";
import { CurrencyRate, Token, Validator } from "../typechain-types";
import "@nomicfoundation/hardhat-ethers";
import "@openzeppelin/hardhat-upgrades";
import { ethers, upgrades } from "hardhat";

import assert from "assert";
import { expect } from "chai";

import { HardhatAccount } from "../src/HardhatAccount";

describe("Test for CurrencyRate", () => {
    const accounts = HardhatAccount.keys.map((m) => new ethers.Wallet(m, ethers.provider));
    const [deployer, validator1, validator2, validator3, user1] = accounts;

    const validators = [validator1, validator2, validator3];
    let validatorContract: Validator;
    let tokenContract: Token;
    let currencyRateContract: CurrencyRate;

    const amount = Amount.make(20_000, 18);

    before(async () => {
        const tokenFactory = await ethers.getContractFactory("Token");
        tokenContract = (await tokenFactory
            .connect(deployer)
            .deploy(deployer.address, "Sample", "SAM")) as unknown as Token;
        await tokenContract.waitForDeployment();
        for (const elem of validators) {
            await tokenContract.connect(deployer).transfer(elem.address, amount.value);
        }

        const validatorFactory = await ethers.getContractFactory("Validator");
        validatorContract = (await upgrades.deployProxy(
            validatorFactory.connect(deployer),
            [await tokenContract.getAddress(), validators.map((m) => m.address)],
            {
                initializer: "initialize",
                kind: "uups",
            }
        )) as unknown as Validator;
        await validatorContract.waitForDeployment();

        for (const elem of validators) {
            await tokenContract.connect(elem).approve(await validatorContract.getAddress(), amount.value);
            await expect(validatorContract.connect(elem).deposit(amount.value))
                .to.emit(validatorContract, "DepositedForValidator")
                .withArgs(elem.address, amount.value, amount.value);
            const item = await validatorContract.validatorOf(elem.address);
            assert.deepStrictEqual(item.validator, elem.address);
            assert.deepStrictEqual(item.status, 1n);
            assert.deepStrictEqual(item.balance, amount.value);
        }

        const currencyRateFactory = await ethers.getContractFactory("CurrencyRate");
        currencyRateContract = (await upgrades.deployProxy(
            currencyRateFactory.connect(deployer),
            [await validatorContract.getAddress(), await tokenContract.symbol()],
            {
                initializer: "initialize",
                kind: "uups",
            }
        )) as unknown as CurrencyRate;
        await currencyRateContract.waitForDeployment();
    });

    it("Set Not validator", async () => {
        const symbol = "the9";
        const rate = 123000000000n;
        await expect(currencyRateContract.connect(user1).set(symbol, rate)).to.revertedWith("1000");
    });
    it("Set Success", async () => {
        const symbol = "the9";
        const rate = 123000000000n;
        await expect(currencyRateContract.connect(validators[0]).set(symbol, rate))
            .to.emit(currencyRateContract, "SetRate")
            .withArgs(symbol, rate);
    });

    it("Get Fail - usd", async () => {
        const symbol = "usd";
        await expect(currencyRateContract.connect(validators[0]).get(symbol)).to.be.revertedWith("1211");
    });

    it("Get Success - the9", async () => {
        const symbol = "the9";
        const rate = 123000000000;
        expect(await currencyRateContract.connect(validators[0]).get(symbol)).to.equal(rate);
    });

    it("Function", async () => {
        const multiple = await currencyRateContract.multiple();
        const symbol = await tokenContract.symbol();

        let rate = 100n * multiple;
        await expect(currencyRateContract.connect(validators[0]).set(symbol, rate))
            .to.emit(currencyRateContract, "SetRate")
            .withArgs(symbol, rate);
        rate = 1000n * multiple;
        await expect(currencyRateContract.connect(validators[0]).set("usd", rate))
            .to.emit(currencyRateContract, "SetRate")
            .withArgs("usd", rate);

        rate = 10n * multiple;
        await expect(currencyRateContract.connect(validators[0]).set("jpy", rate))
            .to.emit(currencyRateContract, "SetRate")
            .withArgs("jpy", rate);

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
