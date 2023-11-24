import { ContractShopStatus } from "../src/types";
import { ContractUtils } from "../src/utils/ContractUtils";
import { CertifierCollection, ShopCollection } from "../typechain-types";

import "@nomiclabs/hardhat-ethers";
import "@nomiclabs/hardhat-waffle";

import chai, { expect } from "chai";
import { solidity } from "ethereum-waffle";

import * as hre from "hardhat";

import { Wallet } from "ethers";

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

    const shopWallets: Wallet[] = [shop1, shop2, shop3, shop4, shop5];
    let shopCollection: ShopCollection;
    let certifierCollection: CertifierCollection;

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

    before(async () => {
        const certifierFactory = await hre.ethers.getContractFactory("CertifierCollection");
        certifierCollection = (await certifierFactory
            .connect(deployer)
            .deploy(certifier.address)) as CertifierCollection;
        await certifierCollection.deployed();
        await certifierCollection.deployTransaction.wait();

        const shopCollectionFactory = await hre.ethers.getContractFactory("ShopCollection");
        shopCollection = (await shopCollectionFactory
            .connect(deployer)
            .deploy(certifierCollection.address)) as ShopCollection;
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
            await expect(shopCollection.connect(relay).add(elem.shopId, elem.name, elem.wallet.address, signature))
                .to.emit(shopCollection, "AddedShop")
                .withNamedArgs({
                    shopId: elem.shopId,
                    name: elem.name,
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
