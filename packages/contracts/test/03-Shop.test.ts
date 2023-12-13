import { ContractShopStatus } from "../src/types";
import { Amount } from "../src/utils/Amount";
import { ContractUtils } from "../src/utils/ContractUtils";
import { Certifier, CurrencyRate, Shop, Token, Validator } from "../typechain-types";

import "@nomiclabs/hardhat-ethers";
import "@nomiclabs/hardhat-waffle";
import "@openzeppelin/hardhat-upgrades";
import { ethers, upgrades, waffle } from "hardhat";

import chai, { expect } from "chai";
import { solidity } from "ethereum-waffle";

import * as hre from "hardhat";

import { BigNumber, Wallet } from "ethers";

import assert from "assert";
import { AddressZero } from "@ethersproject/constants";

chai.use(solidity);

describe("Test for Shop", () => {
    const provider = waffle.provider;
    const [
        deployer,
        ,
        ,
        ,
        certifier,
        validator1,
        validator2,
        validator3,
        user1,
        shop1,
        shop2,
        shop3,
        shop4,
        shop5,
        relay,
    ] = provider.getWallets();

    const validatorWallets = [validator1, validator2, validator3];
    const shopWallets: Wallet[] = [shop1, shop2, shop3, shop4, shop5];

    let validatorContract: Validator;
    let tokenContract: Token;
    let currencyContract: CurrencyRate;
    let shopContract: Shop;
    let certifierContract: Certifier;

    const multiple = BigNumber.from(1000000000);
    const price = BigNumber.from(150).mul(multiple);

    const amount = Amount.make(20_000, 18);
    const assetAmount = Amount.make(10_000_000, 18);

    const deployToken = async () => {
        const tokenFactory = await hre.ethers.getContractFactory("Token");
        tokenContract = (await tokenFactory.connect(deployer).deploy(deployer.address, "Sample", "SAM")) as Token;
        await tokenContract.deployed();
        await tokenContract.deployTransaction.wait();
        for (const elem of validatorWallets) {
            await tokenContract.connect(deployer).transfer(elem.address, amount.value);
        }
    };

    const deployValidatorCollection = async () => {
        const validatorFactory = await hre.ethers.getContractFactory("Validator");
        validatorContract = (await upgrades.deployProxy(
            validatorFactory.connect(deployer),
            [tokenContract.address, validatorWallets.map((m) => m.address)],
            {
                initializer: "initialize",
                kind: "uups",
            }
        )) as Validator;
        await validatorContract.deployed();
        await validatorContract.deployTransaction.wait();
    };

    const depositValidators = async () => {
        for (const elem of validatorWallets) {
            await tokenContract.connect(elem).approve(validatorContract.address, amount.value);
            await expect(validatorContract.connect(elem).deposit(amount.value))
                .to.emit(validatorContract, "DepositedForValidator")
                .withArgs(elem.address, amount.value, amount.value);
            const item = await validatorContract.validatorOf(elem.address);
            assert.deepStrictEqual(item.validator, elem.address);
            assert.deepStrictEqual(item.status, 1);
            assert.deepStrictEqual(item.balance, amount.value);
        }
    };

    const deployCurrencyRate = async () => {
        const currencyRateFactory = await hre.ethers.getContractFactory("CurrencyRate");
        currencyContract = (await upgrades.deployProxy(
            currencyRateFactory.connect(deployer),
            [validatorContract.address, await tokenContract.symbol()],
            {
                initializer: "initialize",
                kind: "uups",
            }
        )) as CurrencyRate;
        await currencyContract.deployed();
        await currencyContract.deployTransaction.wait();

        await currencyContract.connect(validatorWallets[0]).set(await tokenContract.symbol(), price);
        await currencyContract.connect(validatorWallets[0]).set("usd", BigNumber.from(1000).mul(multiple));
        await currencyContract.connect(validatorWallets[0]).set("jpy", BigNumber.from(1000).mul(multiple));
        await currencyContract.connect(validatorWallets[0]).set("eur", BigNumber.from(900).mul(multiple));
    };

    const deployCertifier = async () => {
        const factory = await hre.ethers.getContractFactory("Certifier");
        certifierContract = (await upgrades.deployProxy(factory.connect(deployer), [certifier.address], {
            initializer: "initialize",
            kind: "uups",
        })) as Certifier;
        await certifierContract.deployed();
        await certifierContract.deployTransaction.wait();

        await certifierContract.connect(certifier).grantCertifier(relay.address);
    };

    const deployAllContract = async () => {
        await deployToken();
        await deployValidatorCollection();
        await depositValidators();
        await deployCurrencyRate();
        await deployCertifier();
    };

    interface IShopData {
        shopId: string;
        name: string;
        currency: string;
        provideWaitTime: number;
        providePercent: number;
        wallet: Wallet;
    }

    const shopData: IShopData[] = [
        {
            shopId: "",
            name: "Shop 1-1",
            currency: "krw",
            provideWaitTime: 0,
            providePercent: 5,
            wallet: shopWallets[0],
        },
        {
            shopId: "",
            name: "Shop 1-2",
            currency: "krw",
            provideWaitTime: 0,
            providePercent: 5,
            wallet: shopWallets[0],
        },
        {
            shopId: "",
            name: "Shop 2-1",
            currency: "usd",
            provideWaitTime: 0,
            providePercent: 5,
            wallet: shopWallets[1],
        },
        {
            shopId: "",
            name: "Shop 2-2",
            currency: "jpy",
            provideWaitTime: 0,
            providePercent: 5,
            wallet: shopWallets[1],
        },
        {
            shopId: "",
            name: "Shop 3",
            currency: "jpy",
            provideWaitTime: 0,
            providePercent: 5,
            wallet: shopWallets[2],
        },
        {
            shopId: "",
            name: "Shop 4",
            currency: "jpy",
            provideWaitTime: 0,
            providePercent: 5,
            wallet: shopWallets[3],
        },
        {
            shopId: "",
            name: "Shop 5",
            currency: "jpy",
            provideWaitTime: 0,
            providePercent: 5,
            wallet: shopWallets[4],
        },
    ];

    before("Deploy", async () => {
        await deployAllContract();
    });

    before(async () => {
        const factory = await hre.ethers.getContractFactory("Shop");
        shopContract = (await upgrades.deployProxy(
            factory.connect(deployer),
            [certifierContract.address, currencyContract.address, AddressZero, AddressZero],
            {
                initializer: "initialize",
                kind: "uups",
            }
        )) as Shop;
        await shopContract.deployed();
        await shopContract.deployTransaction.wait();
    });

    before("Set Shop ID", async () => {
        for (const elem of shopData) {
            elem.shopId = ContractUtils.getShopId(elem.wallet.address);
        }
    });

    it("Success", async () => {
        for (const elem of shopData) {
            const nonce = await shopContract.nonceOf(elem.wallet.address);
            const signature = await ContractUtils.signShop(elem.wallet, elem.shopId, nonce);
            await expect(
                shopContract
                    .connect(relay)
                    .add(elem.shopId, elem.name, elem.currency.toLowerCase(), elem.wallet.address, signature)
            )
                .to.emit(shopContract, "AddedShop")
                .withNamedArgs({
                    shopId: elem.shopId,
                    name: elem.name,
                    currency: elem.currency.toLowerCase(),
                    account: elem.wallet.address,
                });
        }
        expect(await shopContract.shopsLength()).to.equal(shopData.length);
    });

    it("Check", async () => {
        const ids = await shopContract.shopsOf(shopWallets[0].address);
        expect(ids).to.deep.equal([shopData[0].shopId, shopData[1].shopId]);
    });

    it("Update", async () => {
        const elem = shopData[0];
        elem.name = "New Shop";
        elem.provideWaitTime = 86400 * 7;
        elem.providePercent = 10;
        const signature = await ContractUtils.signShop(
            elem.wallet,
            elem.shopId,
            await shopContract.nonceOf(elem.wallet.address)
        );
        await expect(
            shopContract
                .connect(certifier)
                .update(
                    elem.shopId,
                    elem.name,
                    "usd",
                    elem.provideWaitTime,
                    elem.providePercent,
                    elem.wallet.address,
                    signature
                )
        )
            .to.emit(shopContract, "UpdatedShop")
            .withNamedArgs({
                shopId: elem.shopId,
                name: elem.name,
                currency: "usd",
                provideWaitTime: elem.provideWaitTime,
                providePercent: elem.providePercent,
                account: elem.wallet.address,
            });
    });

    it("Check status", async () => {
        for (const elem of shopData) {
            const shop = await shopContract.shopOf(elem.shopId);
            expect(shop.status).to.deep.equal(ContractShopStatus.INACTIVE);
        }
    });

    it("Change status", async () => {
        for (const elem of shopData) {
            const signature = await ContractUtils.signShop(
                elem.wallet,
                elem.shopId,
                await shopContract.nonceOf(elem.wallet.address)
            );
            await expect(
                shopContract
                    .connect(certifier)
                    .changeStatus(elem.shopId, ContractShopStatus.ACTIVE, elem.wallet.address, signature)
            )
                .to.emit(shopContract, "ChangedShopStatus")
                .withNamedArgs({
                    shopId: elem.shopId,
                    status: ContractShopStatus.ACTIVE,
                });
        }
    });

    it("Check status", async () => {
        for (const elem of shopData) {
            const shop = await shopContract.shopOf(elem.shopId);
            expect(shop.status).to.deep.equal(ContractShopStatus.ACTIVE);
        }
    });
});
