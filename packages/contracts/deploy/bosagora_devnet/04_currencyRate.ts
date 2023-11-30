import "@nomiclabs/hardhat-ethers";
import { BigNumber } from "ethers";
import "hardhat-deploy";
// tslint:disable-next-line:no-submodule-imports
import { DeployFunction } from "hardhat-deploy/types";
// tslint:disable-next-line:no-submodule-imports
import { HardhatRuntimeEnvironment } from "hardhat/types";
import { CurrencyRate, Token, ValidatorCollection } from "../../typechain-types";
import { getContractAddress } from "../helpers";

const func: DeployFunction = async (hre: HardhatRuntimeEnvironment) => {
    console.log(`\nDeploying CurrencyRate.`);

    const { deployments, getNamedAccounts, ethers } = hre;
    const { deploy } = deployments;
    const { deployer, validator1, validator2, validator3, validator4, validator5 } = await getNamedAccounts();
    const validators = [validator1, validator2, validator3, validator4, validator5];

    const validatorContractAddress = await getContractAddress("ValidatorCollection", hre);

    const tokenContractAddress = await getContractAddress("Token", hre);
    const tokenContract = (await ethers.getContractAt("Token", tokenContractAddress)) as Token;

    const deployResult = await deploy("CurrencyRate", {
        from: deployer,
        args: [validatorContractAddress, await tokenContract.symbol()],
        log: true,
    });

    if (deployResult.newlyDeployed) {
        const currencyRateContractAddress = await getContractAddress("CurrencyRate", hre);
        const currencyRateContract = (await ethers.getContractAt(
            "CurrencyRate",
            currencyRateContractAddress
        )) as CurrencyRate;

        const multiple = BigNumber.from(1000000000);
        let price = BigNumber.from(150).mul(multiple);
        let tx1 = await currencyRateContract.connect(await ethers.getSigner(validators[0])).set("the9", price);
        console.log(`Set token price (tx: ${tx1.hash})...`);
        await tx1.wait();

        price = BigNumber.from(1000).mul(multiple);
        tx1 = await currencyRateContract.connect(await ethers.getSigner(validators[0])).set("usd", price);
        console.log(`Set token price (tx: ${tx1.hash})...`);
        await tx1.wait();

        price = BigNumber.from(10).mul(multiple);
        tx1 = await currencyRateContract.connect(await ethers.getSigner(validators[0])).set("jpy", price);
        console.log(`Set token price (tx: ${tx1.hash})...`);
        await tx1.wait();

        price = BigNumber.from(1).mul(multiple);
        tx1 = await currencyRateContract.connect(await ethers.getSigner(validators[0])).set("krw", price);
        console.log(`Set token price (tx: ${tx1.hash})...`);
        await tx1.wait();

        price = BigNumber.from(1).mul(multiple);
        tx1 = await currencyRateContract.connect(await ethers.getSigner(validators[0])).set("point", price);
        console.log(`Set token price (tx: ${tx1.hash})...`);
        await tx1.wait();
    }
};
export default func;
func.tags = ["CurrencyRate"];
