import "@nomiclabs/hardhat-ethers";
import "hardhat-deploy";
// tslint:disable-next-line:no-submodule-imports
import { DeployFunction } from "hardhat-deploy/types";
// tslint:disable-next-line:no-submodule-imports
import { HardhatRuntimeEnvironment } from "hardhat/types";
import { FranchiseeCollection, Ledger, Token } from "../../typechain-types";
import { getContractAddress } from "../helpers";
import { ContractUtils } from "../../test/helper/ContractUtils";
import { Amount } from "../../test/helper/Amount";

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
    const deployResult = await deploy("Ledger", {
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

    if (deployResult.newlyDeployed) {
        const ledgerContractAddress = await getContractAddress("Ledger", hre);
        const ledgerContract = (await ethers.getContractAt("Ledger", ledgerContractAddress)) as Ledger;

        const franchiseeCollection = (await ethers.getContractAt(
            "FranchiseeCollection",
            franchiseeContractAddress
        )) as FranchiseeCollection;
        await franchiseeCollection.connect(await ethers.getSigner(deployer)).setLedgerAddress(ledgerContractAddress);

        const assetAmount = Amount.make(10_000_000, 18);
        const tokenContractAddress = await getContractAddress("Token", hre);
        const tokenContract = (await ethers.getContractAt("Token", tokenContractAddress)) as Token;

        const tx1 = await tokenContract
            .connect(await ethers.getSigner(owner))
            .approve(ledgerContract.address, assetAmount.value);
        console.log(`Approve foundation's amount (tx: ${tx1.hash})...`);
        await tx1.wait();

        const tx2 = await ledgerContract.connect(await ethers.getSigner(owner)).deposit(assetAmount.value);
        console.log(`Deposit foundation's amount (tx: ${tx2.hash})...`);
        await tx2.wait();
    }
};
export default func;
func.tags = ["Ledger"];
