import "@nomiclabs/hardhat-ethers";
import "hardhat-deploy";
// tslint:disable-next-line:no-submodule-imports
import { DeployFunction } from "hardhat-deploy/types";
// tslint:disable-next-line:no-submodule-imports
import { HardhatRuntimeEnvironment } from "hardhat/types";
import { Amount } from "../../src/utils/Amount";
import { ContractUtils } from "../../src/utils/ContractUtils";
import { Ledger, PhoneLinkCollection, Shop, Token } from "../../typechain-types";
import { getContractAddress, getPhoneLinkCollectionContractAddress } from "../helpers";

import { Wallet } from "ethers";

import fs from "fs";

// tslint:disable-next-line:only-arrow-functions
const func: DeployFunction = async (hre: HardhatRuntimeEnvironment) => {
    console.log(`\nDeploying Ledger.`);

    const { deployments, getNamedAccounts, ethers } = hre;
    const { deploy } = deployments;
    const {
        deployer,
        foundation,
        settlements,
        fee,
        certifier,
        validator1,
        linkValidator1,
        linkValidator2,
        linkValidator3,
    } = await getNamedAccounts();

    const linkCollectionContractAddress = await getPhoneLinkCollectionContractAddress("PhoneLinkCollection", hre);
    const tokenContractAddress = await getContractAddress("Token", hre);
    const validatorContractAddress = await getContractAddress("ValidatorCollection", hre);
    const currencyRateContractAddress = await getContractAddress("CurrencyRate", hre);
    const shopContractAddress = await getContractAddress("Shop", hre);
    const certifierCollectionAddress = await getContractAddress("CertifierCollection", hre);

    const deployResult = await deploy("Ledger", {
        from: deployer,
        args: [
            foundation,
            settlements,
            fee,
            certifierCollectionAddress,
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

        const shopCollection = (await ethers.getContractAt("Shop", shopContractAddress)) as Shop;
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

        const linkCollectionContract = (await ethers.getContractAt(
            "PhoneLinkCollection",
            linkCollectionContractAddress
        )) as PhoneLinkCollection;

        const users = JSON.parse(fs.readFileSync("./deploy/data/users.json", "utf8"));

        for (const user of users) {
            if (user.loyaltyType === 1) {
                const signer = new Wallet(user.privateKey).connect(ethers.provider);
                const nonce = await ledgerContract.nonceOf(user.address);
                const signature = ContractUtils.signLoyaltyType(signer, nonce);
                const tx10 = await ledgerContract.connect(signer).changeToLoyaltyToken(user.address, signature);
                console.log(`Deposit user's amount (tx: ${tx10.hash})...`);
                await tx10.wait();

                if ((await ledgerContract.connect(signer).loyaltyTypeOf(user.address)) === 1) {
                    console.log(`Success changeToLoyaltyToken...`);
                } else {
                    console.error(`Fail changeToLoyaltyToken...`);
                }

                const balance = await tokenContract.balanceOf(user.address);
                const depositedToken = balance.div(2);
                const tx8 = await tokenContract.connect(signer).approve(ledgerContract.address, depositedToken);
                console.log(`Approve user's amount (tx: ${tx8.hash})...`);
                await tx8.wait();

                const tx9 = await ledgerContract.connect(signer).deposit(depositedToken);
                console.log(`Deposit user's amount (tx: ${tx9.hash})...`);
                await tx9.wait();
            }
        }

        const users_mobile = JSON.parse(fs.readFileSync("./deploy/data/users_mobile.json", "utf8"));
        for (const user of users_mobile) {
            const userAccount = ContractUtils.getPhoneHash(user.phone);
            if ((await linkCollectionContract.toAddress(userAccount)) !== user.address) {
                const userNonce = await linkCollectionContract.nonceOf(user.address);
                const userSignature = await ContractUtils.signRequestHash(
                    new Wallet(user.privateKey),
                    userAccount,
                    userNonce
                );
                const reqId2 = ContractUtils.getRequestId(userAccount, user.address, userNonce);
                const tx4 = await linkCollectionContract
                    .connect(await ethers.getSigner(linkValidator1))
                    .addRequest(reqId2, userAccount, user.address, userSignature);
                console.log(`Add phone-address of user (tx: ${tx4.hash})...`);
                await tx4.wait();

                const tx5 = await linkCollectionContract
                    .connect(await ethers.getSigner(linkValidator1))
                    .voteRequest(reqId2);
                console.log(`Vote of validator1 (tx: ${tx5.hash})...`);
                await tx5.wait();

                const tx6 = await linkCollectionContract
                    .connect(await ethers.getSigner(linkValidator2))
                    .voteRequest(reqId2);
                console.log(`Vote of validator2 (tx: ${tx6.hash})...`);
                await tx6.wait();

                const tx7 = await linkCollectionContract
                    .connect(await ethers.getSigner(linkValidator1))
                    .countVote(reqId2);
                console.log(`Count of vote (tx: ${tx7.hash})...`);
                await tx7.wait();

                if ((await linkCollectionContract.toAddress(userAccount)) === user.address) {
                    console.log(`Success ${user.address}`);
                } else {
                    console.log(`Fail ${user.address}`);
                }
            }
        }

        for (const user of users_mobile) {
            if (user.loyaltyType === 1) {
                const signer = new Wallet(user.privateKey).connect(ethers.provider);
                const nonce = await ledgerContract.nonceOf(user.address);
                const signature = ContractUtils.signLoyaltyType(signer, nonce);
                const tx10 = await ledgerContract.connect(signer).changeToLoyaltyToken(user.address, signature);
                console.log(`Deposit user's amount (tx: ${tx10.hash})...`);
                await tx10.wait();

                if ((await ledgerContract.connect(signer).loyaltyTypeOf(user.address)) === 1) {
                    console.log(`Success changeToLoyaltyToken...`);
                } else {
                    console.error(`Fail changeToLoyaltyToken...`);
                }

                const balance = await tokenContract.balanceOf(user.address);
                const depositedToken = balance.div(2);
                const tx8 = await tokenContract.connect(signer).approve(ledgerContract.address, depositedToken);
                console.log(`Approve user's amount (tx: ${tx8.hash})...`);
                await tx8.wait();

                const tx9 = await ledgerContract.connect(signer).deposit(depositedToken);
                console.log(`Deposit user's amount (tx: ${tx9.hash})...`);
                await tx9.wait();
            }
        }
    }
};

export default func;
func.tags = ["Ledger"];
