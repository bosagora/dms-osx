import "@nomiclabs/hardhat-ethers";
import "hardhat-deploy";
// tslint:disable-next-line:no-submodule-imports
import { DeployFunction } from "hardhat-deploy/types";
// tslint:disable-next-line:no-submodule-imports
import { HardhatRuntimeEnvironment } from "hardhat/types";
import { LinkCollection } from "../../typechain-types";
import { getContractAddress } from "../helpers";
import { ContractUtils } from "../../test/helper/ContractUtils";

import { Wallet } from "ethers";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
    console.log(`\nDeploying LinkCollection.`);

    const { deployments, getNamedAccounts, ethers } = hre;
    const { deploy } = deployments;
    const { deployer, owner, validator1, validator2, validator3, validator4, validator5 } = await getNamedAccounts();
    const validators = [validator1, validator2, validator3, validator4, validator5];

    const deployResult = await deploy("LinkCollection", {
        from: deployer,
        args: [validators],
        log: true,
    });

    if (deployResult.newlyDeployed) {
        const linkCollectionContractAddress = await getContractAddress("LinkCollection", hre);
        const linkCollectionContract = (await ethers.getContractAt(
            "LinkCollection",
            linkCollectionContractAddress
        )) as LinkCollection;

        const foundationAccount = ContractUtils.sha256String(process.env.FOUNDATION_EMAIL || "");
        const nonce = await linkCollectionContract.nonce(owner);
        const signature = await ContractUtils.sign(new Wallet(process.env.OWNER || ""), foundationAccount, nonce);

        const tx = await linkCollectionContract
            .connect(await ethers.getSigner(validators[0]))
            .add(foundationAccount, owner, signature);
        console.log(`Add email-address of foundation (tx: ${tx.hash})...`);
        await tx.wait();
    }
};
export default func;
func.tags = ["LinkCollection"];
