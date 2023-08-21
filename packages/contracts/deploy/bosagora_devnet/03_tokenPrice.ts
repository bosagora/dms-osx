import "@nomiclabs/hardhat-ethers";
import { BigNumber } from "ethers";
import "hardhat-deploy";
// tslint:disable-next-line:no-submodule-imports
import { DeployFunction } from "hardhat-deploy/types";
// tslint:disable-next-line:no-submodule-imports
import { HardhatRuntimeEnvironment } from "hardhat/types";
import { TokenPrice, ValidatorCollection } from "../../typechain-types";
import { getContractAddress } from "../helpers";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
    console.log(`\nDeploying TokenPrice.`);

    const { deployments, getNamedAccounts, ethers } = hre;
    const { deploy } = deployments;
    const { deployer, validator1, validator2, validator3, validator4, validator5 } = await getNamedAccounts();
    const validators = [validator1, validator2, validator3, validator4, validator5];

    const validatorContractAddress = await getContractAddress("ValidatorCollection", hre);

    const deployResult = await deploy("TokenPrice", {
        from: deployer,
        args: [validatorContractAddress],
        log: true,
    });

    if (deployResult.newlyDeployed) {
        const tokenPriceContractAddress = await getContractAddress("TokenPrice", hre);
        const tokenPriceContract = (await ethers.getContractAt("TokenPrice", tokenPriceContractAddress)) as TokenPrice;

        const multiple = BigNumber.from(1000000000);
        const price = BigNumber.from(150).mul(multiple);
        const tx1 = await tokenPriceContract.connect(await ethers.getSigner(validators[0])).set("KRW", price);
        console.log(`Set token price (tx: ${tx1.hash})...`);
        await tx1.wait();
    }
};
export default func;
func.tags = ["TokenPrice"];
