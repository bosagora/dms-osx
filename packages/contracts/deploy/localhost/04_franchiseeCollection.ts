import "@nomiclabs/hardhat-ethers";
import fs from "fs";
import "hardhat-deploy";
// tslint:disable-next-line:no-submodule-imports
import { DeployFunction } from "hardhat-deploy/types";
// tslint:disable-next-line:no-submodule-imports
import { HardhatRuntimeEnvironment } from "hardhat/types";
import { ContractUtils } from "../../test/helper/ContractUtils";
import { FranchiseeCollection, ValidatorCollection } from "../../typechain-types";
import { getContractAddress } from "../helpers";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
    console.log(`\nDeploying FranchiseeCollection.`);

    const { deployments, getNamedAccounts, ethers } = hre;
    const { deploy } = deployments;
    const { deployer, validator1, validator2, validator3, validator4, validator5 } = await getNamedAccounts();
    const validators = [validator1, validator2, validator3, validator4, validator5];

    const validatorContractAddress = await getContractAddress("ValidatorCollection", hre);

    const deployResult = await deploy("FranchiseeCollection", {
        from: deployer,
        args: [validatorContractAddress],
        log: true,
    });

    if (deployResult.newlyDeployed) {
        interface IFranchiseeData {
            franchiseeId: string;
            payoutWaitTime: number;
            email: string;
        }
        const franchiseeData: IFranchiseeData[] = JSON.parse(fs.readFileSync("./deploy/data/franchisees.json"));
        const contractAddress = await getContractAddress("FranchiseeCollection", hre);
        const contract = (await ethers.getContractAt("FranchiseeCollection", contractAddress)) as FranchiseeCollection;

        for (const elem of franchiseeData) {
            const email = ContractUtils.sha256String(elem.email);
            const tx = await contract
                .connect(await ethers.getSigner(validators[0]))
                .add(elem.franchiseeId, elem.payoutWaitTime, email);
            console.log(`Add franchisee data (tx: ${tx.hash})...`);
            await tx.wait();
        }
    }
};
export default func;
func.tags = ["FranchiseeCollection"];
