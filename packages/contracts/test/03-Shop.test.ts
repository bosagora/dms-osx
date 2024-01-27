import "@nomiclabs/hardhat-ethers";
import "@nomiclabs/hardhat-waffle";
import "@openzeppelin/hardhat-upgrades";
import { ethers, upgrades } from "hardhat";

import { ContractShopStatus } from "../src/types";
import { ContractUtils } from "../src/utils/ContractUtils";
import { CurrencyRate, ERC20, Shop, Validator } from "../typechain-types";

import chai, { expect } from "chai";
import { solidity } from "ethereum-waffle";

import { Wallet } from "ethers";

import { AddressZero } from "@ethersproject/constants";
import { Deployments } from "./helper/Deployments";

chai.use(solidity);

describe("Test for Shop", () => {
    const deployments = new Deployments();

    let validatorContract: Validator;
    let tokenContract: ERC20;
    let currencyContract: CurrencyRate;
    let shopContract: Shop;

    const deployAllContract = async () => {
        await deployments.doDeployCurrencyRate();

        tokenContract = deployments.getContract("TestKIOS") as ERC20;
        validatorContract = deployments.getContract("Validator") as Validator;
        currencyContract = deployments.getContract("CurrencyRate") as CurrencyRate;
    };

    interface IShopData {
        shopId: string;
        name: string;
        currency: string;
        wallet: Wallet;
    }

    const shopData: IShopData[] = [
        {
            shopId: "",
            name: "Shop 1-1",
            currency: "krw",
            wallet: deployments.accounts.shops[0],
        },
        {
            shopId: "",
            name: "Shop 1-2",
            currency: "krw",
            wallet: deployments.accounts.shops[0],
        },
        {
            shopId: "",
            name: "Shop 2-1",
            currency: "usd",
            wallet: deployments.accounts.shops[1],
        },
        {
            shopId: "",
            name: "Shop 2-2",
            currency: "jpy",
            wallet: deployments.accounts.shops[1],
        },
        {
            shopId: "",
            name: "Shop 3",
            currency: "jpy",
            wallet: deployments.accounts.shops[2],
        },
        {
            shopId: "",
            name: "Shop 4",
            currency: "jpy",
            wallet: deployments.accounts.shops[3],
        },
        {
            shopId: "",
            name: "Shop 5",
            currency: "jpy",
            wallet: deployments.accounts.shops[4],
        },
    ];

    before("Deploy", async () => {
        await deployAllContract();
    });

    before(async () => {
        const factory = await ethers.getContractFactory("Shop");
        shopContract = (await upgrades.deployProxy(
            factory.connect(deployments.accounts.deployer),
            [currencyContract.address, AddressZero, AddressZero],
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
                    .connect(deployments.accounts.certifier)
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
        const count = await shopContract.getShopsCountOfAccount(deployments.accounts.shops[0].address);
        const ids = await shopContract.getShopsOfAccount(deployments.accounts.shops[0].address, 0, count);
        expect(ids).to.deep.equal([shopData[0].shopId, shopData[1].shopId]);
    });

    it("Update", async () => {
        const elem = shopData[0];
        elem.name = "New Shop";
        const signature = await ContractUtils.signShop(
            elem.wallet,
            elem.shopId,
            await shopContract.nonceOf(elem.wallet.address)
        );
        await expect(
            shopContract
                .connect(deployments.accounts.certifier)
                .update(elem.shopId, elem.name, "usd", elem.wallet.address, signature)
        )
            .to.emit(shopContract, "UpdatedShop")
            .withNamedArgs({
                shopId: elem.shopId,
                name: elem.name,
                currency: "usd",
                account: elem.wallet.address,
            });
    });

    it("Check status", async () => {
        for (const elem of shopData) {
            const shop = await shopContract.shopOf(elem.shopId);
            expect(shop.status).to.deep.equal(ContractShopStatus.ACTIVE);
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
                    .connect(deployments.accounts.certifier)
                    .changeStatus(elem.shopId, ContractShopStatus.INACTIVE, elem.wallet.address, signature)
            )
                .to.emit(shopContract, "ChangedShopStatus")
                .withNamedArgs({
                    shopId: elem.shopId,
                    status: ContractShopStatus.INACTIVE,
                });
        }
    });

    it("Check status", async () => {
        for (const elem of shopData) {
            const shop = await shopContract.shopOf(elem.shopId);
            expect(shop.status).to.deep.equal(ContractShopStatus.INACTIVE);
        }
    });
});
