import "@nomiclabs/hardhat-ethers";
import "hardhat-deploy";
// tslint:disable-next-line:no-submodule-imports
import { DeployFunction } from "hardhat-deploy/types";
// tslint:disable-next-line:no-submodule-imports
import { HardhatRuntimeEnvironment } from "hardhat/types";
import { Amount } from "../../src/utils/Amount";
import { Token, ValidatorCollection } from "../../typechain-types";
import { getContractAddress } from "../helpers";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
    console.log(`\nDeploying ValidatorCollection.`);

    const { deployments, getNamedAccounts, ethers } = hre;
    const { deploy } = deployments;
    const { deployer, owner, validator1, validator2, validator3, validator4, validator5 } = await getNamedAccounts();
    const validators = [validator1, validator2, validator3, validator4, validator5];

    const tokenAddress = await getContractAddress("Token", hre);
    const tokenContract = (await ethers.getContractAt("Token", tokenAddress)) as Token;

    const deployResult = await deploy("ValidatorCollection", {
        from: deployer,
        args: [tokenAddress, validators],
        log: true,
    });

    if (deployResult.newlyDeployed) {
        const validatorContractAddress = await getContractAddress("ValidatorCollection", hre);
        const validatorContract = (await ethers.getContractAt(
            "ValidatorCollection",
            validatorContractAddress
        )) as ValidatorCollection;
        const amount = Amount.make(100_000, 18);
        const depositAmount = Amount.make(20_000, 18);

        for (const elem of validators) {
            await tokenContract.connect(await ethers.getSigner(owner)).transfer(elem, amount.value);
        }

        for (const elem of validators) {
            const tx1 = await tokenContract
                .connect(await ethers.getSigner(elem))
                .approve(validatorContractAddress, depositAmount.value);
            console.log(`Approve validator's amount (tx: ${tx1.hash})...`);
            await tx1.wait();

            const tx2 = await validatorContract.connect(await ethers.getSigner(elem)).deposit(depositAmount.value);
            console.log(`Deposit validator's amount (tx: ${tx2.hash})...`);
            await tx2.wait();
        }
    }
};
export default func;
func.tags = ["ValidatorCollection"];
