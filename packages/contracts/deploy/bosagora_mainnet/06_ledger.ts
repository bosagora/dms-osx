import "@nomiclabs/hardhat-ethers";
import "hardhat-deploy";
// tslint:disable-next-line:no-submodule-imports
import { DeployFunction } from "hardhat-deploy/types";
// tslint:disable-next-line:no-submodule-imports
import { HardhatRuntimeEnvironment } from "hardhat/types";
import { Ledger, Shop, Token } from "../../typechain-types";
import { getContractAddress, getPhoneLinkCollectionContractAddress } from "../helpers";

const func: DeployFunction = async (hre: HardhatRuntimeEnvironment) => {
    console.log(`\nDeploying Ledger.`);

    const { deployments, getNamedAccounts, ethers } = hre;
    const { deploy } = deployments;
    const { deployer, foundation, settlements } = await getNamedAccounts();

    const linkCollectionContractAddress = await getPhoneLinkCollectionContractAddress("PhoneLinkCollection", hre);
    const tokenContractAddress = await getContractAddress("Token", hre);
    const validatorContractAddress = await getContractAddress("ValidatorCollection", hre);
    const currencyRateContractAddress = await getContractAddress("CurrencyRate", hre);
    const shopContractAddress = await getContractAddress("Shop", hre);

    await deploy("Ledger", {
        from: deployer,
        args: [
            foundation,
            settlements,
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
