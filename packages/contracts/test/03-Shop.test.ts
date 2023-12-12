import { ContractShopStatus } from "../src/types";
import { Amount } from "../src/utils/Amount";
import { ContractUtils } from "../src/utils/ContractUtils";
import { Certifier, CurrencyRate, Shop, Token, Validator } from "../typechain-types";

import "@nomicfoundation/hardhat-ethers";
import "@openzeppelin/hardhat-upgrades";
import { ethers, upgrades } from "hardhat";

import assert from "assert";
import { expect } from "chai";

import { HardhatAccount } from "../src/HardhatAccount";

import { AddressZero } from "@ethersproject/constants";

describe("Test for Shop", () => {
    const accounts = HardhatAccount.keys.map((m) => new ethers.Wallet(m, ethers.provider));

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
    ] = accounts;

    const validatorWallets = [validator1, validator2, validator3];
    const shopWallets = [shop1, shop2, shop3, shop4, shop5];

    let validatorContract: Validator;
    let tokenContract: Token;
    let currencyContract: CurrencyRate;
    let shopContract: Shop;
    let certifierContract: Certifier;

    const multiple = 1000000000n;
    const price = 150n * multiple;

    const amount = Amount.make(20_000, 18);
    const assetAmount = Amount.make(10_000_000, 18);

    const deployToken = async () => {
        const factory = await ethers.getContractFactory("Token");
        tokenContract = (await factory.connect(deployer).deploy(deployer.address, "Sample", "SAM")) as unknown as Token;
        await tokenContract.waitForDeployment();
        for (const elem of validatorWallets) {
            await tokenContract.connect(deployer).transfer(elem.address, amount.value);
        }
    };

    const deployValidator = async () => {
        const factory = await ethers.getContractFactory("Validator");
        validatorContract = (await upgrades.deployProxy(
            factory.connect(deployer),
            [await tokenContract.getAddress(), validatorWallets.map((m) => m.address)],
            {
                initializer: "initialize",
                kind: "uups",
            }
        )) as unknown as Validator;
        await validatorContract.waitForDeployment();
    };

    const depositValidators = async () => {
        for (const elem of validatorWallets) {
            await tokenContract.connect(elem).approve(await validatorContract.getAddress(), amount.value);
            await expect(validatorContract.connect(elem).deposit(amount.value))
                .to.emit(validatorContract, "DepositedForValidator")
                .withArgs(elem.address, amount.value, amount.value);
            const item = await validatorContract.validatorOf(elem.address);
            assert.deepStrictEqual(item.validator, elem.address);
            assert.deepStrictEqual(item.status, 1n);
            assert.deepStrictEqual(item.balance, amount.value);
        }
    };

    const deployCurrencyRate = async () => {
        const factory = await ethers.getContractFactory("CurrencyRate");
        currencyContract = (await upgrades.deployProxy(
            factory.connect(deployer),
            [await validatorContract.getAddress(), await tokenContract.symbol()],
            {
                initializer: "initialize",
                kind: "uups",
            }
        )) as unknown as CurrencyRate;
        await currencyContract.waitForDeployment();

        await currencyContract.connect(validatorWallets[0]).set(await tokenContract.symbol(), price);
        await currencyContract.connect(validatorWallets[0]).set("usd", 1000n * multiple);
        await currencyContract.connect(validatorWallets[0]).set("jpy", 1000n * multiple);
        await currencyContract.connect(validatorWallets[0]).set("eur", 900n * multiple);
    };

    const deployCertifier = async () => {
        const factory = await ethers.getContractFactory("Certifier");
        certifierContract = (await upgrades.deployProxy(factory.connect(deployer), [certifier.address], {
            initializer: "initialize",
            kind: "uups",
        })) as unknown as Certifier;
        await certifierContract.waitForDeployment();
    };

    const deployAllContract = async () => {
        await deployToken();
        await deployValidator();
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
        // @ts-ignore
        wallet: ethers.Wallet;
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
        const factory = await ethers.getContractFactory("Shop");
        shopContract = (await upgrades.deployProxy(
            factory.connect(deployer),
            [await certifierContract.getAddress(), await currencyContract.getAddress(), AddressZero, AddressZero],
            {
                initializer: "initialize",
                kind: "uups",
            }
        )) as unknown as Shop;
        await shopContract.waitForDeployment();
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
                .withArgs(
                    elem.shopId,
                    elem.name,
                    elem.currency.toLowerCase(),
                    7n * 86400n,
                    5n,
                    elem.wallet.address,
                    ContractShopStatus.INACTIVE
                );
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
            .withArgs(
                elem.shopId,
                elem.name,
                "usd",
                BigInt(elem.provideWaitTime),
                BigInt(elem.providePercent),
                elem.wallet.address,
                ContractShopStatus.INACTIVE
            );
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
                .withArgs(elem.shopId, ContractShopStatus.ACTIVE);
        }
    });

    it("Check status", async () => {
        for (const elem of shopData) {
            const shop = await shopContract.shopOf(elem.shopId);
            expect(shop.status).to.deep.equal(ContractShopStatus.ACTIVE);
        }
    });
});
