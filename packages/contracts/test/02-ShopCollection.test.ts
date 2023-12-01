import { ContractShopStatus } from "../src/types";
import { Amount } from "../src/utils/Amount";
import { ContractUtils } from "../src/utils/ContractUtils";
import { CertifierCollection, CurrencyRate, ShopCollection, Token, ValidatorCollection } from "../typechain-types";

import "@nomiclabs/hardhat-ethers";
import "@nomiclabs/hardhat-waffle";

import chai, { expect } from "chai";
import { solidity } from "ethereum-waffle";

import * as hre from "hardhat";

import { BigNumber, Wallet } from "ethers";

import assert from "assert";

chai.use(solidity);

describe("Test for ShopCollection", () => {
    const provider = hre.waffle.provider;
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

    let validatorContract: ValidatorCollection;
    let tokenContract: Token;
    let currencyRateContract: CurrencyRate;
    let shopCollection: ShopCollection;
    let certifierCollection: CertifierCollection;

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
        const validatorFactory = await hre.ethers.getContractFactory("ValidatorCollection");
        validatorContract = (await validatorFactory.connect(deployer).deploy(
            tokenContract.address,
            validatorWallets.map((m) => m.address)
        )) as ValidatorCollection;
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
        currencyRateContract = (await currencyRateFactory
            .connect(deployer)
            .deploy(validatorContract.address, await tokenContract.symbol())) as CurrencyRate;
        await currencyRateContract.deployed();
        await currencyRateContract.deployTransaction.wait();
        await currencyRateContract.connect(validatorWallets[0]).set(await tokenContract.symbol(), price);
        await currencyRateContract.connect(validatorWallets[0]).set("usd", BigNumber.from(1000).mul(multiple));
        await currencyRateContract.connect(validatorWallets[0]).set("jpy", BigNumber.from(1000).mul(multiple));
        await currencyRateContract.connect(validatorWallets[0]).set("eur", BigNumber.from(900).mul(multiple));
    };

    const deployCertifierCollection = async () => {
        const factory = await hre.ethers.getContractFactory("CertifierCollection");
        certifierCollection = (await factory.connect(deployer).deploy(certifier.address)) as CertifierCollection;
        await certifierCollection.deployed();
        await certifierCollection.deployTransaction.wait();

        await certifierCollection.connect(certifier).grantCertifier(relay.address);
    };

    const deployAllContract = async () => {
        await deployToken();
        await deployValidatorCollection();
        await depositValidators();
        await deployCurrencyRate();
        await deployCertifierCollection();
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
        const shopCollectionFactory = await hre.ethers.getContractFactory("ShopCollection");
        shopCollection = (await shopCollectionFactory
            .connect(deployer)
            .deploy(certifierCollection.address, currencyRateContract.address)) as ShopCollection;
        await shopCollection.deployed();
        await shopCollection.deployTransaction.wait();
    });

    before("Set Shop ID", async () => {
        for (const elem of shopData) {
            elem.shopId = ContractUtils.getShopId(elem.wallet.address);
        }
    });

    it("Success", async () => {
        for (const elem of shopData) {
            const nonce = await shopCollection.nonceOf(elem.wallet.address);
            const signature = ContractUtils.signShop(elem.wallet, elem.shopId, nonce);
            await expect(
                shopCollection
                    .connect(relay)
                    .add(elem.shopId, elem.name, elem.currency.toLowerCase(), elem.wallet.address, signature)
            )
                .to.emit(shopCollection, "AddedShop")
                .withNamedArgs({
                    shopId: elem.shopId,
                    name: elem.name,
                    currency: elem.currency.toLowerCase(),
                    account: elem.wallet.address,
                });
        }
        expect(await shopCollection.shopsLength()).to.equal(shopData.length);
    });

    it("Check", async () => {
        const ids = await shopCollection.shopsOf(shopWallets[0].address);
        expect(ids).to.deep.equal([shopData[0].shopId, shopData[1].shopId]);
    });

    it("Update", async () => {
        const elem = shopData[0];
        elem.name = "New Shop";
        elem.provideWaitTime = 86400 * 7;
        elem.providePercent = 10;
        const signature = ContractUtils.signShop(
            elem.wallet,
            elem.shopId,
            await shopCollection.nonceOf(elem.wallet.address)
        );
        await expect(
            shopCollection
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
            .to.emit(shopCollection, "UpdatedShop")
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
            const shop = await shopCollection.shopOf(elem.shopId);
            expect(shop.status).to.deep.equal(ContractShopStatus.INACTIVE);
        }
    });

    it("Change status", async () => {
        for (const elem of shopData) {
            const signature = ContractUtils.signShop(
                elem.wallet,
                elem.shopId,
                await shopCollection.nonceOf(elem.wallet.address)
            );
            await expect(
                shopCollection
                    .connect(certifier)
                    .changeStatus(elem.shopId, ContractShopStatus.ACTIVE, elem.wallet.address, signature)
            )
                .to.emit(shopCollection, "ChangedShopStatus")
                .withNamedArgs({
                    shopId: elem.shopId,
                    status: ContractShopStatus.ACTIVE,
                });
        }
    });

    it("Check status", async () => {
        for (const elem of shopData) {
            const shop = await shopCollection.shopOf(elem.shopId);
            expect(shop.status).to.deep.equal(ContractShopStatus.ACTIVE);
        }
    });
});
