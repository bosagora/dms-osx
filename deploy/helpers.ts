import "@nomiclabs/hardhat-ethers";
import { promises as fs } from "fs";
import "hardhat-deploy";
// tslint:disable-next-line:no-submodule-imports
import { HardhatRuntimeEnvironment } from "hardhat/types";

export async function getContractAddress(contractName: string, hre: HardhatRuntimeEnvironment): Promise<string> {
    const { deployments } = hre;
    try {
        const contract = await deployments.get(contractName);
        if (contract) {
            return contract.address;
        }
    } catch (e) {
        //
    }

    const activeContracts = await getActiveContractsJSON();
    try {
        return activeContracts[hre.network.name][contractName];
    } catch (e) {
        console.error(e);
        return "";
    }
}

export async function getActiveContractsJSON(): Promise<{
    [index: string]: { [index: string]: string };
}> {
    const repoPath = process.env.GITHUB_WORKSPACE || "../../";
    const activeContractsFile = await fs.readFile(`${repoPath}/active_contracts.json`);
    const activeContracts = JSON.parse(activeContractsFile.toString());
    return activeContracts;
}

export async function updateActiveContractsJSON(payload: {
    [index: string]: { [index: string]: string };
}): Promise<void> {
    const repoPath = process.env.GITHUB_WORKSPACE || "../../";
    const activeContractsFile = await fs.readFile(`${repoPath}/active_contracts.json`);
    const activeContracts = JSON.parse(activeContractsFile.toString());
    Object.keys(payload).forEach((key) => {
        activeContracts[key] = { ...activeContracts[key], ...payload[key] };
    });

    await fs.writeFile(`${repoPath}/active_contracts.json`, JSON.stringify(activeContracts, null, 2));
}

// exports dummy function for hardhat-deploy. Otherwise, we would have to move this file
export default function () {
    //
}
