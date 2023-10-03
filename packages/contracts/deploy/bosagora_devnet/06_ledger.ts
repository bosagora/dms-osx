import "@nomiclabs/hardhat-ethers";
import "hardhat-deploy";
// tslint:disable-next-line:no-submodule-imports
import { DeployFunction } from "hardhat-deploy/types";
// tslint:disable-next-line:no-submodule-imports
import { HardhatRuntimeEnvironment } from "hardhat/types";
import { Amount } from "../../src/utils/Amount";
import { ContractUtils } from "../../src/utils/ContractUtils";
import { Ledger, ShopCollection, Token } from "../../typechain-types";
import { getContractAddress, getEmailLinkCollectionContractAddress } from "../helpers";

import { Wallet } from "ethers";

import fs from "fs";

// tslint:disable-next-line:only-arrow-functions
const func: DeployFunction = async (hre: HardhatRuntimeEnvironment) => {
    console.log(`\nDeploying Ledger.`);

    const { deployments, getNamedAccounts, ethers } = hre;
    const { deploy } = deployments;
    const { deployer, foundation, settlements, validator1 } = await getNamedAccounts();

    const linkCollectionContractAddress = await getEmailLinkCollectionContractAddress("EmailLinkCollection", hre);
    const tokenContractAddress = await getContractAddress("Token", hre);
    const validatorContractAddress = await getContractAddress("ValidatorCollection", hre);
    const currencyRateContractAddress = await getContractAddress("CurrencyRate", hre);
    const shopContractAddress = await getContractAddress("ShopCollection", hre);

    const deployResult = await deploy("Ledger", {
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

    if (deployResult.newlyDeployed) {
        const ledgerContractAddress = await getContractAddress("Ledger", hre);
        const ledgerContract = (await ethers.getContractAt("Ledger", ledgerContractAddress)) as Ledger;

        const shopCollection = (await ethers.getContractAt("ShopCollection", shopContractAddress)) as ShopCollection;
        const tx1 = await shopCollection
            .connect(await ethers.getSigner(deployer))
            .setLedgerAddress(ledgerContractAddress);
        console.log(`Set ledger address for shop collection (tx: ${tx1.hash})...`);
        await tx1.wait();

        const assetAmount = Amount.make(10_000_000, 18);
        const tokenContract = (await ethers.getContractAt("Token", tokenContractAddress)) as Token;

        const tx2 = await tokenContract
            .connect(await ethers.getSigner(foundation))
            .approve(ledgerContract.address, assetAmount.value);
        console.log(`Approve foundation's amount (tx: ${tx2.hash})...`);
        await tx2.wait();

        const tx3 = await ledgerContract.connect(await ethers.getSigner(foundation)).deposit(assetAmount.value);
        console.log(`Deposit foundation's amount (tx: ${tx3.hash})...`);
        await tx3.wait();

        const users = JSON.parse(fs.readFileSync("./deploy/data/users.json", "utf8"));
        for (const user of users) {
            const balance = await tokenContract.balanceOf(user.address);

            const depositAmount = balance.div(2);
            const signer = new Wallet(user.privateKey).connect(ethers.provider);
            const tx7 = await tokenContract.connect(signer).approve(ledgerContract.address, depositAmount);
            console.log(`Approve user's amount (tx: ${tx7.hash})...`);
            await tx7.wait();

            const tx8 = await ledgerContract.connect(signer).deposit(depositAmount);
            console.log(`Deposit user's amount (tx: ${tx8.hash})...`);
            await tx8.wait();

            if (user.pointType === 1) {
                const pointType = 1;
                const nonce = await ledgerContract.nonceOf(user.address);
                const signature = ContractUtils.signPointType(signer, pointType, nonce);
                const tx9 = await ledgerContract.connect(validator1).setPointType(pointType, user.address, signature);
                console.log(`Deposit user's amount (tx: ${tx9.hash})...`);
                await tx9.wait();
            }
        }
    }
};

export default func;
func.tags = ["Ledger"];
