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

// tslint:disable-next-line:only-arrow-functions
const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
    console.log(`\nDeploying Token.`);

    const { deployments, getNamedAccounts, ethers } = hre;
    const { deploy } = deployments;
    const { deployer, owner, foundation } = await getNamedAccounts();

    const deployResult = await deploy("Token", {
        from: deployer,
        args: [owner, "Sample", "the9"],
        log: true,
    });

    if (deployResult.newlyDeployed) {
        const contractAddress = await getContractAddress("Token", hre);
        const contract = (await ethers.getContractAt("Token", contractAddress)) as Token;

        const assetAmount = Amount.make(100_000_000, 18);
        const tx1 = await contract.connect(await ethers.getSigner(owner)).transfer(foundation, assetAmount.value);
        console.log(`Transfer token to foundation (tx: ${tx1.hash})...`);
        await tx1.wait();

        const users = JSON.parse(fs.readFileSync("./deploy/data/users.json"));
        const addresses = users.map((m: { address: string }) => m.address);
        const userAmount = Amount.make(200_000, 18);
        const tx2 = await contract.connect(await ethers.getSigner(owner)).multiTransfer(addresses, userAmount.value);
        console.log(`Transfer token to users (tx: ${tx2.hash})...`);
        await tx2.wait();

        const users_mobile = JSON.parse(fs.readFileSync("./deploy/data/users_mobile.json", "utf8"));
        const addresses_mobile = users_mobile.map((m: { address: string }) => m.address);
        const tx3 = await contract
            .connect(await ethers.getSigner(owner))
            .multiTransfer(addresses_mobile, userAmount.value);
        console.log(`Transfer token to users (tx: ${tx3.hash})...`);
        await tx3.wait();
    }
};

export default func;
func.tags = ["Token"];
