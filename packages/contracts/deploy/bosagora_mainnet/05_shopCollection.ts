import "@nomiclabs/hardhat-ethers";
import "hardhat-deploy";
// tslint:disable-next-line:no-submodule-imports
import { DeployFunction } from "hardhat-deploy/types";
// tslint:disable-next-line:no-submodule-imports
import { HardhatRuntimeEnvironment } from "hardhat/types";
import { ShopCollection, ValidatorCollection } from "../../typechain-types";
import { getContractAddress } from "../helpers";

const func: DeployFunction = async (hre: HardhatRuntimeEnvironment) => {
    console.log(`\nDeploying ShopCollection.`);

    const { deployments, getNamedAccounts, ethers } = hre;
    const { deploy } = deployments;
    const { deployer } = await getNamedAccounts();

    const validatorContractAddress = await getContractAddress("ValidatorCollection", hre);

    await deploy("ShopCollection", {
        from: deployer,
        args: [validatorContractAddress],
        log: true,
    });
};
export default func;
func.tags = ["ShopCollection"];
