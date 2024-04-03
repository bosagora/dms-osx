import "@nomiclabs/hardhat-ethers";
import "@nomiclabs/hardhat-waffle";

import { ethers, upgrades, waffle } from "hardhat";

import { Amount } from "../src/utils/Amount";
import { ContractUtils } from "../src/utils/ContractUtils";
import { CurrencyRate, ERC20, Validator } from "../typechain-types";

import assert from "assert";
import chai, { expect } from "chai";
import { solidity } from "ethereum-waffle";
import { Deployments } from "./helper/Deployments";

chai.use(solidity);

describe("Test for CurrencyRate", () => {
    const deployments = new Deployments();
    let validatorContract: Validator;
    let tokenContract: ERC20;
    let currencyRateContract: CurrencyRate;

    const amount = Amount.make(100_000, 18);

    before(async () => {
        await deployments.doDeployValidator();

        tokenContract = deployments.getContract("TestLYT") as ERC20;
        validatorContract = deployments.getContract("Validator") as Validator;

        const currencyRateFactory = await ethers.getContractFactory("CurrencyRate");
        currencyRateContract = (await upgrades.deployProxy(
            currencyRateFactory.connect(deployments.accounts.deployer),
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
        const height = Math.floor(ContractUtils.getTimeStamp() / 10) * 10;
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
                symbol: "LYT",
                rate: multiple.mul(150),
            },
        ];
        const message = ContractUtils.getCurrencyMessage(height, rates);
        const signatures = [deployments.accounts.validators[0]].map((m) => ContractUtils.signMessage(m, message));
        await expect(
            currencyRateContract.connect(deployments.accounts.validators[0]).set(height, rates, signatures)
        ).to.be.revertedWith("1174");
    });

    it("Set Array - revert", async () => {
        const multiple = await currencyRateContract.multiple();
        const height = Math.floor(ContractUtils.getTimeStamp() / 10) * 10;
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
                symbol: "LYT",
                rate: multiple.mul(150),
            },
        ];
        const message = ContractUtils.getCurrencyMessage(height, rates);
        const signatures = [deployments.accounts.validators[0], deployments.accounts.validators[0]].map((m) =>
            ContractUtils.signMessage(m, message)
        );
        await expect(
            currencyRateContract.connect(deployments.accounts.validators[0]).set(height, rates, signatures)
        ).to.be.revertedWith("1174");
    });

    it("Set Array - revert", async () => {
        const multiple = await currencyRateContract.multiple();
        const height = ContractUtils.getTimeStamp();
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
                symbol: "LYT",
                rate: multiple.mul(150),
            },
        ];
        const message = ContractUtils.getCurrencyMessage(height, rates);
        const signatures = [deployments.accounts.validators[0], deployments.accounts.users[0]].map((m) =>
            ContractUtils.signMessage(m, message)
        );
        await expect(
            currencyRateContract.connect(deployments.accounts.validators[0]).set(height, rates, signatures)
        ).to.be.revertedWith("1174");
    });

    it("Set Array - revert", async () => {
        const multiple = await currencyRateContract.multiple();
        const height = Math.floor(ContractUtils.getTimeStamp() / 10) * 10;
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
                symbol: "LYT",
                rate: multiple.mul(150),
            },
        ];
        const message = ContractUtils.getCurrencyMessage(height, rates);
        const signatures = [deployments.accounts.deployer, deployments.accounts.users[0]].map((m) =>
            ContractUtils.signMessage(m, message)
        );
        await expect(
            currencyRateContract.connect(deployments.accounts.validators[0]).set(height, rates, signatures)
        ).to.be.revertedWith("1174");
    });

    it("Set Array", async () => {
        const multiple = await currencyRateContract.multiple();
        const height = Math.floor(ContractUtils.getTimeStamp() / 10) * 10;
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
                symbol: "LYT",
                rate: multiple.mul(150),
            },
        ];
        const message = ContractUtils.getCurrencyMessage(height, rates);
        const signatures = [deployments.accounts.validators[0], deployments.accounts.validators[1]].map((m) =>
            ContractUtils.signMessage(m, message)
        );
        await expect(currencyRateContract.connect(deployments.accounts.validators[0]).set(height, rates, signatures))
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
        const height = Math.floor(ContractUtils.getTimeStamp() / 10) * 10;
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
                symbol: "LYT",
                rate: multiple.mul(150),
            },
        ];
        const message = ContractUtils.getCurrencyMessage(height, rates);
        const signatures = [
            deployments.accounts.validators[0],
            deployments.accounts.validators[1],
            deployments.accounts.users[0],
            deployments.accounts.deployer,
        ].map((m) => ContractUtils.signMessage(m, message));
        await expect(
            currencyRateContract.connect(deployments.accounts.validators[0]).set(height, rates, signatures)
        ).to.be.revertedWith("1173");
    });

    it("Set Array - revert", async () => {
        const multiple = await currencyRateContract.multiple();
        const height = ContractUtils.getTimeStamp() - 100;
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
                symbol: "LYT",
                rate: multiple.mul(150),
            },
        ];
        const message = ContractUtils.getCurrencyMessage(height, rates);
        const signatures = deployments.accounts.validators.map((m) => ContractUtils.signMessage(m, message));
        await expect(
            currencyRateContract.connect(deployments.accounts.validators[0]).set(height, rates, signatures)
        ).to.be.revertedWith("1171");
    });

    it("Get Fail - abc", async () => {
        const currency = "abc";
        await expect(currencyRateContract.connect(deployments.accounts.validators[0]).get(currency)).to.be.revertedWith(
            "1211"
        );
    });

    it("Function", async () => {
        const multiple = await currencyRateContract.multiple();
        const height = ContractUtils.getTimeStamp();
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
        const message = ContractUtils.getCurrencyMessage(height, rates);
        const signatures = deployments.accounts.validators.map((m) => ContractUtils.signMessage(m, message));
        await expect(currencyRateContract.connect(deployments.accounts.validators[0]).set(height, rates, signatures))
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
