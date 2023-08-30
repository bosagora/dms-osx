import "@nomiclabs/hardhat-ethers";
import "hardhat-deploy";
// tslint:disable-next-line:no-submodule-imports
import { DeployFunction } from "hardhat-deploy/types";
// tslint:disable-next-line:no-submodule-imports
import { HardhatRuntimeEnvironment } from "hardhat/types";
import { ContractUtils } from "../../src/utils/ContractUtils";
import { LinkCollection } from "../../typechain-types";
import { getContractAddress, LINK_COLLECTION_ADDRESSES } from "../helpers";

import { BigNumber, Wallet } from "ethers";
import fs from "fs";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
    console.log(`\nDeploying LinkCollection.`);

    const { network } = hre;

    const officialLinkCollectionAddress = LINK_COLLECTION_ADDRESSES[network.name];

    if (!officialLinkCollectionAddress) {
        const { deployments, getNamedAccounts, ethers } = hre;
        const { deploy } = deployments;
        const { deployer, linkValidator1, linkValidator2, linkValidator3 } = await getNamedAccounts();
        const validators = [linkValidator1, linkValidator2, linkValidator3];

        await deploy("LinkCollection", {
            from: deployer,
            args: [validators],
            log: true,
        });
    }
};
export default func;
func.tags = ["LinkCollection"];
