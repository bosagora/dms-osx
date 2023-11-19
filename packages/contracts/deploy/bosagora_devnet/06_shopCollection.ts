import "@nomiclabs/hardhat-ethers";
import fs from "fs";
import "hardhat-deploy";
// tslint:disable-next-line:no-submodule-imports
import { DeployFunction } from "hardhat-deploy/types";
// tslint:disable-next-line:no-submodule-imports
import { HardhatRuntimeEnvironment } from "hardhat/types";
import { ShopCollection } from "../../typechain-types";
import { getContractAddress } from "../helpers";

import { Wallet } from "ethers";
import { ContractShopStatus } from "../../src/types";
import { ContractUtils } from "../../src/utils/ContractUtils";

const func: DeployFunction = async (hre: HardhatRuntimeEnvironment) => {
    console.log(`\nDeploying ShopCollection.`);

    const { deployments, getNamedAccounts, ethers } = hre;
    const { deploy } = deployments;
    const { deployer, owner, certifier } = await getNamedAccounts();

    const certifierCollectionAddress = await getContractAddress("CertifierCollection", hre);

    const deployResult = await deploy("ShopCollection", {
        from: deployer,
        args: [certifierCollectionAddress],
        log: true,
    });

    if (deployResult.newlyDeployed) {
        interface IShopData {
            shopId: string;
            name: string;
            provideWaitTime: number;
            providePercent: number;
            address: string;
            privateKey: string;
        }
        const shopData: IShopData[] = JSON.parse(fs.readFileSync("./deploy/data/shops.json"));
        const contractAddress = await getContractAddress("ShopCollection", hre);
        const contract = (await ethers.getContractAt("ShopCollection", contractAddress)) as ShopCollection;

        for (const shop of shopData) {
            const nonce = await contract.nonceOf(shop.address);
            const signature = ContractUtils.signShop(new Wallet(shop.privateKey, ethers.provider), shop.shopId, nonce);
            const tx = await contract
                .connect(new Wallet(shop.privateKey, ethers.provider))
                .add(shop.shopId, shop.name, shop.address, signature);
            console.log(`Add shop data (tx: ${tx.hash})...`);
            await tx.wait();

            const signature1 = ContractUtils.signShop(
                new Wallet(shop.privateKey, ethers.provider),
                shop.shopId,
                await contract.nonceOf(shop.address)
            );
            const signature2 = ContractUtils.signShop(
                await ethers.getSigner(certifier),
                shop.shopId,
                await contract.nonceOf(certifier)
            );

            const tx2 = await contract
                .connect(await ethers.getSigner(owner))
                .update(
                    shop.shopId,
                    shop.name,
                    shop.provideWaitTime,
                    shop.providePercent,
                    shop.address,
                    signature1,
                    certifier,
                    signature2
                );
            console.log(`Update shop data (tx: ${tx2.hash})...`);
            await tx2.wait();

            const signature3 = ContractUtils.signShop(
                new Wallet(shop.privateKey, ethers.provider),
                shop.shopId,
                await contract.nonceOf(shop.address)
            );
            const signature4 = ContractUtils.signShop(
                await ethers.getSigner(certifier),
                shop.shopId,
                await contract.nonceOf(certifier)
            );
            const tx3 = await contract
                .connect(await ethers.getSigner(owner))
                .changeStatus(shop.shopId, ContractShopStatus.ACTIVE, shop.address, signature3, certifier, signature4);
            console.log(`Change shop status (tx: ${tx3.hash})...`);
            await tx3.wait();
        }
    }
};

export default func;
func.tags = ["ShopCollection"];
