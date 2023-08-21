import "@nomiclabs/hardhat-ethers";
import "hardhat-deploy";
// tslint:disable-next-line:no-submodule-imports
import { DeployFunction } from "hardhat-deploy/types";
// tslint:disable-next-line:no-submodule-imports
import { HardhatRuntimeEnvironment } from "hardhat/types";
import { ContractUtils } from "../../test/helper/ContractUtils";
import { LinkCollection } from "../../typechain-types";
import { getContractAddress } from "../helpers";

import { Wallet } from "ethers";
import fs from "fs";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
    console.log(`\nDeploying LinkCollection.`);

    const { deployments, getNamedAccounts, ethers } = hre;
    const { deploy } = deployments;
    const { deployer, foundation, validator1, validator2, validator3, validator4, validator5 } =
        await getNamedAccounts();
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

        const foundationAccount = ContractUtils.sha256String(process.env.FOUNDATION_EMAIL || "foundation@example.com");
        const nonce = await linkCollectionContract.nonce(foundation);
        const signature = await ContractUtils.sign(await ethers.getSigner(foundation), foundationAccount, nonce);

        const tx = await linkCollectionContract
            .connect(await ethers.getSigner(validators[0]))
            .add(foundationAccount, foundation, signature);
        console.log(`Add email-address of foundation (tx: ${tx.hash})...`);
        await tx.wait();

        const users = JSON.parse(fs.readFileSync("./deploy/data/users.json"));
        for (const user of users) {
            if (!user.register) continue;
            const userAccount = ContractUtils.sha256String(user.email);
            const userNonce = await linkCollectionContract.nonce(user.address);
            const userSignature = await ContractUtils.sign(new Wallet(user.privateKey), userAccount, userNonce);
            const tx2 = await linkCollectionContract
                .connect(await ethers.getSigner(validators[0]))
                .add(userAccount, user.address, userSignature);
            console.log(`Add email-address of user (tx: ${tx2.hash})...`);
            await tx2.wait();
        }
    }
};
export default func;
func.tags = ["LinkCollection"];
