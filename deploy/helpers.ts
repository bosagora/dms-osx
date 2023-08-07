import "@nomiclabs/hardhat-ethers";
import "hardhat-deploy";
import { HardhatRuntimeEnvironment } from "hardhat/types";

export async function getContractAddress(contractName: string, hre: HardhatRuntimeEnvironment): Promise<string> {
    const { deployments } = hre;
    try {
        const contract = await deployments.get(contractName);
        if (contract) {
            return contract.address;
        } else {
            return "";
        }
    } catch (e) {
        console.error(e);
        return "";
    }
}

// exports dummy function for hardhat-deploy. Otherwise we would have to move this file
export default function () {}
