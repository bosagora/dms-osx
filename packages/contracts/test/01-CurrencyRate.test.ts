import "@nomiclabs/hardhat-ethers";
import "@nomiclabs/hardhat-waffle";

import { ethers, upgrades, waffle } from "hardhat";

import { Amount } from "../src/utils/Amount";
import { ContractUtils } from "../src/utils/ContractUtils";
import { CurrencyRate, Token, Validator } from "../typechain-types";

import assert from "assert";
import chai, { expect } from "chai";
import { solidity } from "ethereum-waffle";

chai.use(solidity);

describe("Test for CurrencyRate", () => {
    const provider = waffle.provider;
    const [deployer, validator1, validator2, validator3, user1] = provider.getWallets();

    const validators = [validator1, validator2, validator3];
    let validatorContract: Validator;
    let tokenContract: Token;
    let currencyRateContract: CurrencyRate;

    const amount = Amount.make(20_000, 18);

    before(async () => {
        const tokenFactory = await ethers.getContractFactory("Token");
        tokenContract = (await tokenFactory.connect(deployer).deploy(deployer.address, "Sample", "SAM")) as Token;
        await tokenContract.deployed();
        await tokenContract.deployTransaction.wait();
        for (const elem of validators) {
            await tokenContract.connect(deployer).transfer(elem.address, amount.value);
        }

        const validatorFactory = await ethers.getContractFactory("Validator");
        validatorContract = (await upgrades.deployProxy(
            validatorFactory.connect(deployer),
            [tokenContract.address, validators.map((m) => m.address)],
            {
                initializer: "initialize",
                kind: "uups",
            }
        )) as Validator;
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

        const currencyRateFactory = await ethers.getContractFactory("CurrencyRate");
        currencyRateContract = (await upgrades.deployProxy(
            currencyRateFactory.connect(deployer),
            [validatorContract.address, await tokenContract.symbol()],
            {
                initializer: "initialize",
                kind: "uups",
            }
        )) as CurrencyRate;
        await currencyRateContract.deployed();
        await currencyRateContract.deployTransaction.wait();
    });

    it("Set Array - revert", async () => {
        const multiple = await currencyRateContract.multiple();
        const timestamp = Math.floor(ContractUtils.getTimeStamp() / 10) * 10;
        const rates = [
            {
                symbol: "usd",
                rate: multiple.mul(1200),
            },
            {
                symbol: "jpy",
                rate: multiple.mul(80),
            },
            {
                symbol: "krw",
                rate: multiple.mul(1),
            },
            {
                symbol: "the9",
                rate: multiple.mul(150),
            },
        ];
        const message = ContractUtils.getCurrencyMessage(timestamp, rates);
        const signatures = [validator1].map((m) => ContractUtils.signMessage(m, message));
        await expect(currencyRateContract.connect(validators[0]).set(timestamp, rates, signatures)).to.be.revertedWith(
            "1174"
        );
    });

    it("Set Array - revert", async () => {
        const multiple = await currencyRateContract.multiple();
        const timestamp = Math.floor(ContractUtils.getTimeStamp() / 10) * 10;
        const rates = [
            {
                symbol: "usd",
                rate: multiple.mul(1200),
            },
            {
                symbol: "jpy",
                rate: multiple.mul(80),
            },
            {
                symbol: "krw",
                rate: multiple.mul(1),
            },
            {
                symbol: "the9",
                rate: multiple.mul(150),
            },
        ];
        const message = ContractUtils.getCurrencyMessage(timestamp, rates);
        const signatures = [validator1, validator1].map((m) => ContractUtils.signMessage(m, message));
        await expect(currencyRateContract.connect(validators[0]).set(timestamp, rates, signatures)).to.be.revertedWith(
            "1174"
        );
    });

    it("Set Array - revert", async () => {
        const multiple = await currencyRateContract.multiple();
        const timestamp = ContractUtils.getTimeStamp();
        const rates = [
            {
                symbol: "usd",
                rate: multiple.mul(1200),
            },
            {
                symbol: "jpy",
                rate: multiple.mul(80),
            },
            {
                symbol: "krw",
                rate: multiple.mul(1),
            },
            {
                symbol: "the9",
                rate: multiple.mul(150),
            },
        ];
        const message = ContractUtils.getCurrencyMessage(timestamp, rates);
        const signatures = [validator1, user1].map((m) => ContractUtils.signMessage(m, message));
        await expect(currencyRateContract.connect(validators[0]).set(timestamp, rates, signatures)).to.be.revertedWith(
            "1174"
        );
    });

    it("Set Array - revert", async () => {
        const multiple = await currencyRateContract.multiple();
        const timestamp = Math.floor(ContractUtils.getTimeStamp() / 10) * 10;
        const rates = [
            {
                symbol: "usd",
                rate: multiple.mul(1200),
            },
            {
                symbol: "jpy",
                rate: multiple.mul(80),
            },
            {
                symbol: "krw",
                rate: multiple.mul(1),
            },
            {
                symbol: "the9",
                rate: multiple.mul(150),
            },
        ];
        const message = ContractUtils.getCurrencyMessage(timestamp, rates);
        const signatures = [deployer, user1].map((m) => ContractUtils.signMessage(m, message));
        await expect(currencyRateContract.connect(validators[0]).set(timestamp, rates, signatures)).to.be.revertedWith(
            "1174"
        );
    });

    it("Set Array", async () => {
        const multiple = await currencyRateContract.multiple();
        const timestamp = Math.floor(ContractUtils.getTimeStamp() / 10) * 10;
        const rates = [
            {
                symbol: "usd",
                rate: multiple.mul(1200),
            },
            {
                symbol: "jpy",
                rate: multiple.mul(80),
            },
            {
                symbol: "krw",
                rate: multiple.mul(1),
            },
            {
                symbol: "the9",
                rate: multiple.mul(150),
            },
        ];
        const message = ContractUtils.getCurrencyMessage(timestamp, rates);
        const signatures = [validator1, validator2].map((m) => ContractUtils.signMessage(m, message));
        await expect(currencyRateContract.connect(validators[0]).set(timestamp, rates, signatures))
            .to.emit(currencyRateContract, "SetRate")
            .withNamedArgs({ currency: rates[0].symbol, rate: rates[0].rate })
            .to.emit(currencyRateContract, "SetRate")
            .withNamedArgs({ currency: rates[1].symbol, rate: rates[1].rate })
            .to.emit(currencyRateContract, "SetRate")
            .withNamedArgs({ currency: rates[2].symbol, rate: rates[2].rate })
            .to.emit(currencyRateContract, "SetRate")
            .withNamedArgs({ currency: rates[3].symbol, rate: rates[3].rate });
    });

    it("Set Array", async () => {
        const multiple = await currencyRateContract.multiple();
        const timestamp = Math.floor(ContractUtils.getTimeStamp() / 10) * 10;
        const rates = [
            {
                symbol: "usd",
                rate: multiple.mul(1200),
            },
            {
                symbol: "jpy",
                rate: multiple.mul(80),
            },
            {
                symbol: "krw",
                rate: multiple.mul(1),
            },
            {
                symbol: "the9",
                rate: multiple.mul(150),
            },
        ];
        const message = ContractUtils.getCurrencyMessage(timestamp, rates);
        const signatures = [validator1, validator2, user1, deployer].map((m) => ContractUtils.signMessage(m, message));
        await expect(currencyRateContract.connect(validators[0]).set(timestamp, rates, signatures)).to.be.revertedWith(
            "1173"
        );
    });

    it("Set Array - revert", async () => {
        const multiple = await currencyRateContract.multiple();
        const timestamp = ContractUtils.getTimeStamp() - 100;
        const rates = [
            {
                symbol: "usd",
                rate: multiple.mul(1200),
            },
            {
                symbol: "jpy",
                rate: multiple.mul(80),
            },
            {
                symbol: "krw",
                rate: multiple.mul(1),
            },
            {
                symbol: "the9",
                rate: multiple.mul(150),
            },
        ];
        const message = ContractUtils.getCurrencyMessage(timestamp, rates);
        const signatures = validators.map((m) => ContractUtils.signMessage(m, message));
        await expect(currencyRateContract.connect(validators[0]).set(timestamp, rates, signatures)).to.be.revertedWith(
            "1171"
        );
    });

    it("Get Fail - abc", async () => {
        const currency = "abc";
        await expect(currencyRateContract.connect(validators[0]).get(currency)).to.be.revertedWith("1211");
    });

    it("Function", async () => {
        const multiple = await currencyRateContract.multiple();
        const timestamp = ContractUtils.getTimeStamp();
        const rates = [
            {
                symbol: await tokenContract.symbol(),
                rate: multiple.mul(100),
            },
            {
                symbol: "usd",
                rate: multiple.mul(1000),
            },
            {
                symbol: "jpy",
                rate: multiple.mul(10),
            },
            {
                symbol: "krw",
                rate: multiple.mul(1),
            },
        ];
        const message = ContractUtils.getCurrencyMessage(timestamp, rates);
        const signatures = validators.map((m) => ContractUtils.signMessage(m, message));
        await expect(currencyRateContract.connect(validators[0]).set(timestamp, rates, signatures))
            .to.emit(currencyRateContract, "SetRate")
            .withNamedArgs({ currency: rates[0].symbol, rate: rates[0].rate })
            .to.emit(currencyRateContract, "SetRate")
            .withNamedArgs({ currency: rates[1].symbol, rate: rates[1].rate })
            .to.emit(currencyRateContract, "SetRate")
            .withNamedArgs({ currency: rates[2].symbol, rate: rates[2].rate })
            .to.emit(currencyRateContract, "SetRate")
            .withNamedArgs({ currency: rates[3].symbol, rate: rates[3].rate });

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
