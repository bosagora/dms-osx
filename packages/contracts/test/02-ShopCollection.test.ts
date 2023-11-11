import { Amount } from "../src/utils/Amount";
import { ContractUtils } from "../src/utils/ContractUtils";
import { ShopCollection } from "../typechain-types";

import "@nomiclabs/hardhat-ethers";
import "@nomiclabs/hardhat-waffle";

import chai, { expect } from "chai";
import { solidity } from "ethereum-waffle";

import * as hre from "hardhat";

import { Wallet } from "ethers";

chai.use(solidity);

describe("Test for ShopCollection", () => {
    const provider = hre.waffle.provider;
    const [deployer, validator1, validator2, validator3, user1, shop1, shop2, shop3, shop4, shop5, relay] =
        provider.getWallets();

    const shopWallets: Wallet[] = [shop1, shop2, shop3, shop4, shop5];
    let shopCollection: ShopCollection;

    interface IShopData {
        shopId: string;
        name: string;
        provideWaitTime: number;
        providePercent: number;
        wallet: Wallet;
    }

    const shopData: IShopData[] = [
        {
            shopId: "",
            name: "Shop 1-1",
            provideWaitTime: 0,
            providePercent: 5,
            wallet: shopWallets[0],
        },
        {
            shopId: "",
            name: "Shop 1-2",
            provideWaitTime: 0,
            providePercent: 5,
            wallet: shopWallets[0],
        },
        {
            shopId: "",
            name: "Shop 2-1",
            provideWaitTime: 0,
            providePercent: 5,
            wallet: shopWallets[1],
        },
        {
            shopId: "",
            name: "Shop 2-2",
            provideWaitTime: 0,
            providePercent: 5,
            wallet: shopWallets[1],
        },
        {
            shopId: "",
            name: "Shop 3",
            provideWaitTime: 0,
            providePercent: 5,
            wallet: shopWallets[2],
        },
        {
            shopId: "",
            name: "Shop 4",
            provideWaitTime: 0,
            providePercent: 5,
            wallet: shopWallets[3],
        },
        {
            shopId: "",
            name: "Shop 5",
            provideWaitTime: 0,
            providePercent: 5,
            wallet: shopWallets[4],
        },
    ];

    context("Using Relay", () => {
        before(async () => {
            const shopCollectionFactory = await hre.ethers.getContractFactory("ShopCollection");
            shopCollection = (await shopCollectionFactory.connect(deployer).deploy()) as ShopCollection;
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
                const signature = ContractUtils.signShop(
                    elem.wallet,
                    elem.shopId,
                    elem.name,
                    elem.provideWaitTime,
                    elem.providePercent,
                    nonce
                );
                await expect(
                    shopCollection
                        .connect(relay)
                        .add(
                            elem.shopId,
                            elem.name,
                            elem.provideWaitTime,
                            elem.providePercent,
                            elem.wallet.address,
                            signature
                        )
                )
                    .to.emit(shopCollection, "AddedShop")
                    .withNamedArgs({
                        shopId: elem.shopId,
                        name: elem.name,
                        provideWaitTime: elem.provideWaitTime,
                        providePercent: elem.providePercent,
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
            const nonce = await shopCollection.nonceOf(elem.wallet.address);
            elem.name = "New Shop";
            elem.provideWaitTime = 86400 * 7;
            elem.providePercent = 10;
            const signature = ContractUtils.signShop(
                elem.wallet,
                elem.shopId,
                elem.name,
                elem.provideWaitTime,
                elem.providePercent,
                nonce
            );
            await expect(
                shopCollection
                    .connect(relay)
                    .update(
                        elem.shopId,
                        elem.name,
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
                    provideWaitTime: elem.provideWaitTime,
                    providePercent: elem.providePercent,
                    account: elem.wallet.address,
                });
        });

        it("Remove", async () => {
            const elem = shopData[0];
            const nonce = await shopCollection.nonceOf(elem.wallet.address);
            const signature = ContractUtils.signShopId(elem.wallet, elem.shopId, nonce);
            await expect(shopCollection.connect(elem.wallet).remove(elem.shopId, elem.wallet.address, signature))
                .to.emit(shopCollection, "RemovedShop")
                .withNamedArgs({
                    shopId: elem.shopId,
                });
        });

        it("Check remove", async () => {
            const ids = await shopCollection.shopsOf(shopWallets[0].address);
            expect(ids).to.deep.equal([shopData[1].shopId]);
        });
    });

    context("Using Direct", () => {
        before(async () => {
            const shopCollectionFactory = await hre.ethers.getContractFactory("ShopCollection");
            shopCollection = (await shopCollectionFactory.connect(deployer).deploy()) as ShopCollection;
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
                await expect(
                    shopCollection
                        .connect(elem.wallet)
                        .addDirect(elem.shopId, elem.name, elem.provideWaitTime, elem.providePercent)
                )
                    .to.emit(shopCollection, "AddedShop")
                    .withNamedArgs({
                        shopId: elem.shopId,
                        name: elem.name,
                        provideWaitTime: elem.provideWaitTime,
                        providePercent: elem.providePercent,
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
            await expect(
                shopCollection
                    .connect(elem.wallet)
                    .updateDirect(elem.shopId, elem.name, elem.provideWaitTime, elem.providePercent)
            )
                .to.emit(shopCollection, "UpdatedShop")
                .withNamedArgs({
                    shopId: elem.shopId,
                    name: elem.name,
                    provideWaitTime: elem.provideWaitTime,
                    providePercent: elem.providePercent,
                    account: elem.wallet.address,
                });
        });

        it("Remove", async () => {
            const elem = shopData[0];
            await expect(shopCollection.connect(elem.wallet).removeDirect(elem.shopId))
                .to.emit(shopCollection, "RemovedShop")
                .withNamedArgs({
                    shopId: elem.shopId,
                });
        });

        it("Check remove", async () => {
            const ids = await shopCollection.shopsOf(shopWallets[0].address);
            expect(ids).to.deep.equal([shopData[1].shopId]);
        });
    });
});
