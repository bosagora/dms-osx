import "@nomiclabs/hardhat-ethers";
import "hardhat-deploy";
// tslint:disable-next-line:no-submodule-imports
import { DeployFunction } from "hardhat-deploy/types";
// tslint:disable-next-line:no-submodule-imports
import { HardhatRuntimeEnvironment } from "hardhat/types";
import { PhoneLinkCollection } from "../../typechain-types";
import { PHONE_LINK_COLLECTION_ADDRESSES } from "../helpers";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
    console.log(`\nDeploying EmailLinkCollection.`);

    const { network } = hre;

    const officialEmailLinkCollectionAddress = PHONE_LINK_COLLECTION_ADDRESSES[network.name];

    if (!officialEmailLinkCollectionAddress) {
        const { deployments, getNamedAccounts, ethers } = hre;
        const { deploy } = deployments;
        const { deployer, linkValidator1, linkValidator2, linkValidator3 } = await getNamedAccounts();
        const validators = [linkValidator1, linkValidator2, linkValidator3];

        await deploy("PhoneLinkCollection", {
            from: deployer,
            args: [validators],
            log: true,
        });
    }
};
export default func;
func.tags = ["EmailLinkCollection"];
