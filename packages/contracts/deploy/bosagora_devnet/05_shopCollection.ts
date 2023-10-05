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

const func: DeployFunction = async (hre: HardhatRuntimeEnvironment) => {
    console.log(`\nDeploying ShopCollection.`);

    const { deployments, getNamedAccounts, ethers } = hre;
    const { deploy } = deployments;
    const { deployer } = await getNamedAccounts();

    const deployResult = await deploy("ShopCollection", {
        from: deployer,
        args: [],
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
            const tx = await contract
                .connect(new Wallet(shop.privateKey, ethers.provider))
                .add(shop.shopId, shop.name, shop.provideWaitTime, shop.providePercent);
            console.log(`Add shop data (tx: ${tx.hash})...`);
            await tx.wait();
        }
    }
};

export default func;
func.tags = ["ShopCollection"];
