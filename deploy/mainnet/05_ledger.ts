import "@nomiclabs/hardhat-ethers";
import "hardhat-deploy";
// tslint:disable-next-line:no-submodule-imports
import { DeployFunction } from "hardhat-deploy/types";
// tslint:disable-next-line:no-submodule-imports
import { HardhatRuntimeEnvironment } from "hardhat/types";
import { FranchiseeCollection, Ledger, Token } from "../../typechain-types";
import { getContractAddress } from "../helpers";
import { ContractUtils } from "../../test/helper/ContractUtils";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
    console.log(`\nDeploying Ledger.`);

    const { deployments, getNamedAccounts, ethers } = hre;
    const { deploy } = deployments;
    const { deployer, owner } = await getNamedAccounts();

    const linkCollectionContractAddress = await getContractAddress("LinkCollection", hre);
    const tokenContractAddress = await getContractAddress("Token", hre);
    const validatorContractAddress = await getContractAddress("ValidatorCollection", hre);
    const tokenPriceContractAddress = await getContractAddress("TokenPrice", hre);
    const franchiseeContractAddress = await getContractAddress("FranchiseeCollection", hre);

    const foundationAccount = ContractUtils.sha256String(process.env.FOUNDATION_EMAIL || "");
    await deploy("Ledger", {
        from: deployer,
        args: [
            foundationAccount,
            tokenContractAddress,
            validatorContractAddress,
            linkCollectionContractAddress,
            tokenPriceContractAddress,
            franchiseeContractAddress,
        ],
        log: true,
    });
};
export default func;
func.tags = ["Ledger"];
