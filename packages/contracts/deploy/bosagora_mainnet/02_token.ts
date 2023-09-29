import "@nomiclabs/hardhat-ethers";
import "hardhat-deploy";
// tslint:disable-next-line:no-submodule-imports
import { DeployFunction } from "hardhat-deploy/types";
// tslint:disable-next-line:no-submodule-imports
import { HardhatRuntimeEnvironment } from "hardhat/types";
import { Token } from "../../typechain-types";

const func: DeployFunction = async (hre: HardhatRuntimeEnvironment) => {
    console.log(`\nDeploying Token.`);

    const { deployments, getNamedAccounts, ethers } = hre;
    const { deploy } = deployments;
    const { deployer, owner } = await getNamedAccounts();

    await deploy("Token", {
        from: deployer,
        args: ["Sample", "the9"],
        log: true,
    });
};
export default func;
func.tags = ["Token"];
