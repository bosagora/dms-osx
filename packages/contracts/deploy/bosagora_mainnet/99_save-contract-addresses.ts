import { promises as fs } from "fs";
import "hardhat-deploy";
// tslint:disable-next-line:no-submodule-imports
import { DeployFunction } from "hardhat-deploy/types";
// tslint:disable-next-line:no-submodule-imports
import { HardhatRuntimeEnvironment } from "hardhat/types";

const func: DeployFunction = async (hre: HardhatRuntimeEnvironment) => {
    console.log("\nPrinting deployed contracts.");
    const { deployments } = hre;

    const deployedContracts = await deployments.all();
    const deployedContractAddresses: { [index: string]: string } = {};

    for (const deployment in deployedContracts) {
        deployedContractAddresses[deployment] = deployedContracts[deployment].address;
        console.log(`${deployment}: ${deployedContracts[deployment].address}`);
    }

    await fs.writeFile("deployed_contracts.json", JSON.stringify(deployedContractAddresses));
};
export default func;
func.tags = ["Conclude"];
func.runAtTheEnd = true;
