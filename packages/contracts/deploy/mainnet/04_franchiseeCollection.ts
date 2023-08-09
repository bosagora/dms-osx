import "@nomiclabs/hardhat-ethers";
import "hardhat-deploy";
// tslint:disable-next-line:no-submodule-imports
import { DeployFunction } from "hardhat-deploy/types";
// tslint:disable-next-line:no-submodule-imports
import { HardhatRuntimeEnvironment } from "hardhat/types";
import { FranchiseeCollection, ValidatorCollection } from "../../typechain-types";
import { getContractAddress } from "../helpers";
import { ContractUtils } from "../../test/helper/ContractUtils";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
    console.log(`\nDeploying FranchiseeCollection.`);

    const { deployments, getNamedAccounts, ethers } = hre;
    const { deploy } = deployments;
    const { deployer } = await getNamedAccounts();

    const validatorContractAddress = await getContractAddress("ValidatorCollection", hre);

    await deploy("FranchiseeCollection", {
        from: deployer,
        args: [validatorContractAddress],
        log: true,
    });
};
export default func;
func.tags = ["FranchiseeCollection"];
