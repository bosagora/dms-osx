import "@nomiclabs/hardhat-ethers";
import fs from "fs";
import "hardhat-deploy";
// tslint:disable-next-line:no-submodule-imports
import { DeployFunction } from "hardhat-deploy/types";
// tslint:disable-next-line:no-submodule-imports
import { HardhatRuntimeEnvironment } from "hardhat/types";
import { ContractUtils } from "../../src/utils/ContractUtils";
import { ShopCollection, ValidatorCollection } from "../../typechain-types";
import { getContractAddress } from "../helpers";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
    console.log(`\nDeploying ShopCollection.`);

    const { deployments, getNamedAccounts, ethers } = hre;
    const { deploy } = deployments;
    const { deployer, validator1, validator2, validator3, validator4, validator5 } = await getNamedAccounts();
    const validators = [validator1, validator2, validator3, validator4, validator5];

    const validatorContractAddress = await getContractAddress("ValidatorCollection", hre);

    const deployResult = await deploy("ShopCollection", {
        from: deployer,
        args: [validatorContractAddress],
        log: true,
    });

    if (deployResult.newlyDeployed) {
        interface IShopData {
            shopId: string;
            provideWaitTime: number;
            email: string;
        }
        const shopData: IShopData[] = JSON.parse(fs.readFileSync("./deploy/data/shops.json"));
        const contractAddress = await getContractAddress("ShopCollection", hre);
        const contract = (await ethers.getContractAt("ShopCollection", contractAddress)) as ShopCollection;

        for (const elem of shopData) {
            const email = ContractUtils.sha256String(elem.email);
            const tx = await contract
                .connect(await ethers.getSigner(validators[0]))
                .add(elem.shopId, elem.provideWaitTime, email);
            console.log(`Add shop data (tx: ${tx.hash})...`);
            await tx.wait();
        }
    }
};
export default func;
func.tags = ["ShopCollection"];
