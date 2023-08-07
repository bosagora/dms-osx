import "@nomiclabs/hardhat-ethers";
import "hardhat-deploy";
// tslint:disable-next-line:no-submodule-imports
import { DeployFunction } from "hardhat-deploy/types";
// tslint:disable-next-line:no-submodule-imports
import { HardhatRuntimeEnvironment } from "hardhat/types";
import { Token } from "../../typechain-types";
import { getContractAddress } from "../helpers";
import { Amount } from "../../test/helper/Amount";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
    console.log(`\nDeploying Token.`);

    const { deployments, getNamedAccounts, ethers } = hre;
    const { deploy } = deployments;
    const { deployer, owner } = await getNamedAccounts();

    const deployResult = await deploy("Token", {
        from: deployer,
        args: ["Sample", "SAM"],
        log: true,
    });

    if (deployResult.newlyDeployed) {
        const assetAmount = Amount.make(10_000_000, 18);
        const contractAddress = await getContractAddress("Token", hre);
        const contract = (await ethers.getContractAt("Token", contractAddress)) as Token;
        const tx = await contract.connect(await ethers.getSigner(deployer)).transfer(owner, assetAmount.value);
        console.log(`Transfer token to foundation (tx: ${tx.hash})...`);
        await tx.wait();
    }
};
export default func;
func.tags = ["Token"];
