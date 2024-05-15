import { BOACoin } from "../src/common/Amount";

import "@nomiclabs/hardhat-ethers";
import * as hre from "hardhat";

async function main() {
    const provider = hre.ethers.provider;
    const account = "0x9E8549cc1B5b9036AC410Ed11966BB3c6B94A77d";
    const balance = await provider.getBalance(account);
    console.log(`${account} : ${new BOACoin(balance).toBOAString()}`);
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
