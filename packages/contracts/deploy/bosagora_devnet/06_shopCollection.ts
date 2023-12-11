import "@nomiclabs/hardhat-ethers";
import fs from "fs";
import "hardhat-deploy";
// tslint:disable-next-line:no-submodule-imports
import { DeployFunction } from "hardhat-deploy/types";
// tslint:disable-next-line:no-submodule-imports
import { HardhatRuntimeEnvironment } from "hardhat/types";
import { Shop } from "../../typechain-types";
import { getContractAddress } from "../helpers";

import { Wallet } from "ethers";
import { ContractShopStatus } from "../../src/types";
import { ContractUtils } from "../../src/utils/ContractUtils";

const func: DeployFunction = async (hre: HardhatRuntimeEnvironment) => {
    console.log(`\nDeploying Shop.`);

    const { deployments, getNamedAccounts, ethers } = hre;
    const { deploy } = deployments;
    const { deployer, owner, certifier } = await getNamedAccounts();

    const certifierCollectionAddress = await getContractAddress("CertifierCollection", hre);
    const currencyRateContractAddress = await getContractAddress("CurrencyRate", hre);

    const deployResult = await deploy("Shop", {
        from: deployer,
        args: [certifierCollectionAddress, currencyRateContractAddress],
        log: true,
    });

    if (deployResult.newlyDeployed) {
        interface IShopData {
            shopId: string;
            name: string;
            currency: string;
            provideWaitTime: number;
            providePercent: number;
            address: string;
            privateKey: string;
        }
        const shopData: IShopData[] = JSON.parse(fs.readFileSync("./deploy/data/shops.json"));
        const contractAddress = await getContractAddress("Shop", hre);
        const contract = (await ethers.getContractAt("Shop", contractAddress)) as Shop;

        for (const shop of shopData) {
            const nonce = await contract.nonceOf(shop.address);
            const signature = ContractUtils.signShop(new Wallet(shop.privateKey, ethers.provider), shop.shopId, nonce);
            const tx = await contract
                .connect(new Wallet(shop.privateKey, ethers.provider))
                .add(shop.shopId, shop.name, shop.currency, shop.address, signature);
            console.log(`Add shop data (tx: ${tx.hash})...`);
            await tx.wait();

            const signature1 = ContractUtils.signShop(
                new Wallet(shop.privateKey, ethers.provider),
                shop.shopId,
                await contract.nonceOf(shop.address)
            );
            const tx2 = await contract
                .connect(await ethers.getSigner(certifier))
                .update(
                    shop.shopId,
                    shop.name,
                    shop.currency,
                    shop.provideWaitTime,
                    shop.providePercent,
                    shop.address,
                    signature1
                );
            console.log(`Update shop data (tx: ${tx2.hash})...`);
            await tx2.wait();

            const signature3 = ContractUtils.signShop(
                new Wallet(shop.privateKey, ethers.provider),
                shop.shopId,
                await contract.nonceOf(shop.address)
            );
            const tx3 = await contract
                .connect(await ethers.getSigner(certifier))
                .changeStatus(shop.shopId, ContractShopStatus.ACTIVE, shop.address, signature3);
            console.log(`Change shop status (tx: ${tx3.hash})...`);
            await tx3.wait();
        }
    }
};

export default func;
func.tags = ["Shop"];
