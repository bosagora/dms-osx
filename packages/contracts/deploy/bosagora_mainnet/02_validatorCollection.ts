import "@nomiclabs/hardhat-ethers";
import "hardhat-deploy";
// tslint:disable-next-line:no-submodule-imports
import { DeployFunction } from "hardhat-deploy/types";
// tslint:disable-next-line:no-submodule-imports
import { HardhatRuntimeEnvironment } from "hardhat/types";
import { Amount } from "../../test/helper/Amount";
import { Token, ValidatorCollection } from "../../typechain-types";
import { getContractAddress } from "../helpers";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
    console.log(`\nDeploying ValidatorCollection.`);

    const { deployments, getNamedAccounts, ethers } = hre;
    const { deploy } = deployments;
    const { deployer, validator1 } = await getNamedAccounts();
    const validators = [validator1];

    const tokenAddress = await getContractAddress("Token", hre);

    await deploy("ValidatorCollection", {
        from: deployer,
        args: [tokenAddress, validators],
        log: true,
    });
};
export default func;
func.tags = ["ValidatorCollection"];
