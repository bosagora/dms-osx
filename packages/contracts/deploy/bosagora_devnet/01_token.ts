import "@nomiclabs/hardhat-ethers";
import fs from "fs";
import "hardhat-deploy";
// tslint:disable-next-line:no-submodule-imports
import { DeployFunction } from "hardhat-deploy/types";
// tslint:disable-next-line:no-submodule-imports
import { HardhatRuntimeEnvironment } from "hardhat/types";
import { Amount } from "../../src/utils/Amount";
import { Token } from "../../typechain-types";
import { getContractAddress } from "../helpers";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
    console.log(`\nDeploying Token.`);

    const { deployments, getNamedAccounts, ethers } = hre;
    const { deploy } = deployments;
    const { deployer, foundation } = await getNamedAccounts();

    const deployResult = await deploy("Token", {
        from: deployer,
        args: ["Sample", "SAM"],
        log: true,
    });

    if (deployResult.newlyDeployed) {
        const assetAmount = Amount.make(10_000_000, 18);
        const contractAddress = await getContractAddress("Token", hre);
        const contract = (await ethers.getContractAt("Token", contractAddress)) as Token;
        const tx = await contract.connect(await ethers.getSigner(deployer)).transfer(foundation, assetAmount.value);
        console.log(`Transfer token to foundation (tx: ${tx.hash})...`);
        await tx.wait();

        const users = JSON.parse(fs.readFileSync("./deploy/data/users.json"));
        const userAmount = Amount.make(100_000, 18);
        for (const user of users) {
            const tx2 = await contract
                .connect(await ethers.getSigner(deployer))
                .transfer(user.address, userAmount.value);
            console.log(`Transfer token to user ${user.address} (tx: ${tx2.hash})...`);
            await tx2.wait();
        }
    }
};
export default func;
func.tags = ["Token"];
