import "@nomiclabs/hardhat-ethers";
import "hardhat-deploy";
// tslint:disable-next-line:no-submodule-imports
import { DeployFunction } from "hardhat-deploy/types";
// tslint:disable-next-line:no-submodule-imports
import { HardhatRuntimeEnvironment } from "hardhat/types";
import { ShopCollection, Ledger, Token } from "../../typechain-types";
import { getContractAddress, getEmailLinkCollectionContractAddress } from "../helpers";
import { ContractUtils } from "../../src/utils/ContractUtils";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
    console.log(`\nDeploying Ledger.`);

    const { deployments, getNamedAccounts, ethers } = hre;
    const { deploy } = deployments;
    const { deployer, owner } = await getNamedAccounts();

    const linkCollectionContractAddress = await getEmailLinkCollectionContractAddress("EmailLinkCollection", hre);
    const tokenContractAddress = await getContractAddress("Token", hre);
    const validatorContractAddress = await getContractAddress("ValidatorCollection", hre);
    const currencyRateContractAddress = await getContractAddress("TokenPrice", hre);
    const shopContractAddress = await getContractAddress("ShopCollection", hre);

    const foundationAccount = ContractUtils.sha256String(process.env.FOUNDATION_EMAIL || "");
    await deploy("Ledger", {
        from: deployer,
        args: [
            foundationAccount,
            tokenContractAddress,
            validatorContractAddress,
            linkCollectionContractAddress,
            currencyRateContractAddress,
            shopContractAddress,
        ],
        log: true,
    });
};
export default func;
func.tags = ["Ledger"];
