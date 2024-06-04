import "@nomiclabs/hardhat-ethers";
import "@nomiclabs/hardhat-waffle";
import "@openzeppelin/hardhat-upgrades";
import { ethers, upgrades } from "hardhat";

import { ContractShopStatus } from "../src/types";
import { ContractUtils, LoyaltyNetworkID } from "../src/utils/ContractUtils";
import { CurrencyRate, ERC20, Shop, Validator } from "../typechain-types";

import chai, { expect } from "chai";
import { solidity } from "ethereum-waffle";

import { Wallet } from "ethers";

import { AddressZero } from "@ethersproject/constants";
import { Deployments } from "./helper/Deployments";

chai.use(solidity);

describe("Test for Shop", () => {
    const deployments = new Deployments();

    let currencyContract: CurrencyRate;
    let shopContract: Shop;

    const deployAllContract = async () => {
        await deployments.doDeployCurrencyRate();

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

    const delegator = shopData[1].wallet;

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
            elem.shopId = ContractUtils.getShopId(elem.wallet.address, LoyaltyNetworkID.LYT);
        }
    });

    it("Success", async () => {
        for (const elem of shopData) {
            const nonce = await shopContract.nonceOf(elem.wallet.address);
            const message = ContractUtils.getShopAccountMessage(elem.shopId, elem.wallet.address, nonce);
            const signature = await ContractUtils.signMessage(elem.wallet, message);
            await expect(
                shopContract
                    .connect(deployments.accounts.certifiers[0])
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
        const message = ContractUtils.getShopAccountMessage(
            elem.shopId,
            elem.wallet.address,
            await shopContract.nonceOf(elem.wallet.address)
        );
        const signature = await ContractUtils.signMessage(elem.wallet, message);
        await expect(
            shopContract
                .connect(deployments.accounts.certifiers[0])
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
            const message = ContractUtils.getShopAccountMessage(
                elem.shopId,
                elem.wallet.address,
                await shopContract.nonceOf(elem.wallet.address)
            );
            const signature = await ContractUtils.signMessage(elem.wallet, message);
            await expect(
                shopContract
                    .connect(deployments.accounts.certifiers[0])
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

    it("Change status", async () => {
        for (const elem of shopData) {
            const message = ContractUtils.getShopAccountMessage(
                elem.shopId,
                elem.wallet.address,
                await shopContract.nonceOf(elem.wallet.address)
            );
            const signature = await ContractUtils.signMessage(elem.wallet, message);
            await expect(
                shopContract
                    .connect(deployments.accounts.certifiers[0])
                    .changeStatus(elem.shopId, ContractShopStatus.ACTIVE, elem.wallet.address, signature)
            )
                .to.emit(shopContract, "ChangedShopStatus")
                .withNamedArgs({
                    shopId: elem.shopId,
                    status: ContractShopStatus.ACTIVE,
                });
        }
    });

    it("Change delegator", async () => {
        const elem = shopData[0];
        elem.name = "New Shop";
        const message = ContractUtils.getShopDelegatorAccountMessage(
            elem.shopId,
            delegator.address,
            elem.wallet.address,
            await shopContract.nonceOf(elem.wallet.address)
        );
        const signature = await ContractUtils.signMessage(elem.wallet, message);
        await expect(
            shopContract
                .connect(deployments.accounts.certifiers[0])
                .changeDelegator(elem.shopId, delegator.address, elem.wallet.address, signature)
        )
            .to.emit(shopContract, "ChangedDelegator")
            .withNamedArgs({
                shopId: elem.shopId,
                delegator: delegator.address,
            });
    });

    it("Check delegator", async () => {
        const elem = shopData[0];
        const shop = await shopContract.shopOf(elem.shopId);
        expect(shop.delegator).to.deep.equal(delegator.address);
    });

    it("Update by delegator", async () => {
        const elem = shopData[0];
        elem.name = "New Shop";
        const message = ContractUtils.getShopAccountMessage(
            elem.shopId,
            delegator.address,
            await shopContract.nonceOf(delegator.address)
        );
        const signature = await ContractUtils.signMessage(delegator, message);
        await expect(
            shopContract
                .connect(deployments.accounts.certifiers[0])
                .update(elem.shopId, "new name", "usd", delegator.address, signature)
        )
            .to.emit(shopContract, "UpdatedShop")
            .withNamedArgs({
                shopId: elem.shopId,
                name: "new name",
                currency: "usd",
                account: delegator.address,
            });
    });

    it("Change status", async () => {
        const elem = shopData[0];
        const message = ContractUtils.getShopAccountMessage(
            elem.shopId,
            delegator.address,
            await shopContract.nonceOf(delegator.address)
        );
        const signature = await ContractUtils.signMessage(delegator, message);
        await expect(
            shopContract
                .connect(deployments.accounts.certifiers[0])
                .changeStatus(elem.shopId, ContractShopStatus.INACTIVE, delegator.address, signature)
        )
            .to.emit(shopContract, "ChangedShopStatus")
            .withNamedArgs({
                shopId: elem.shopId,
                status: ContractShopStatus.INACTIVE,
            });
    });
});
