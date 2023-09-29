import "@nomiclabs/hardhat-ethers";
import { BigNumber } from "ethers";
import "hardhat-deploy";
// tslint:disable-next-line:no-submodule-imports
import { DeployFunction } from "hardhat-deploy/types";
// tslint:disable-next-line:no-submodule-imports
import { HardhatRuntimeEnvironment } from "hardhat/types";
import { CurrencyRate, ValidatorCollection } from "../../typechain-types";
import { getContractAddress } from "../helpers";

const func: DeployFunction = async (hre: HardhatRuntimeEnvironment) => {
    console.log(`\nDeploying CurrencyRate.`);

    const { deployments, getNamedAccounts, ethers } = hre;
    const { deploy } = deployments;
    const { deployer, validator1 } = await getNamedAccounts();
    const validators = [validator1];

    const validatorContractAddress = await getContractAddress("ValidatorCollection", hre);

    const deployResult = await deploy("CurrencyRate", {
        from: deployer,
        args: [validatorContractAddress],
        log: true,
    });

    if (deployResult.newlyDeployed) {
        const currencyRateContractAddress = await getContractAddress("CurrencyRate", hre);
        const currencyRateContract = (await ethers.getContractAt(
            "CurrencyRate",
            currencyRateContractAddress
        )) as CurrencyRate;

        const multiple = BigNumber.from(1000000000);
        const price = BigNumber.from(150).mul(multiple);
        const tx1 = await currencyRateContract.connect(await ethers.getSigner(validators[0])).set("the9", price);
        console.log(`Set token price (tx: ${tx1.hash})...`);
        await tx1.wait();
    }
};
export default func;
func.tags = ["CurrencyRate"];
