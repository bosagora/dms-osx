import "@nomiclabs/hardhat-ethers";
import "hardhat-deploy";
// tslint:disable-next-line:no-submodule-imports
import { DeployFunction } from "hardhat-deploy/types";
// tslint:disable-next-line:no-submodule-imports
import { HardhatRuntimeEnvironment } from "hardhat/types";
import { ContractUtils } from "../../src/utils/ContractUtils";
import { LinkCollection } from "../../typechain-types";
import { getLinkCollectionContractAddress, LINK_COLLECTION_ADDRESSES } from "../helpers";

import { BigNumber, Wallet } from "ethers";
import fs from "fs";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
    console.log(`\nDeploying LinkCollection.`);

    const { network } = hre;
    const { deployments, getNamedAccounts, ethers } = hre;
    const { deploy } = deployments;
    const { deployer, owner, foundation, linkValidator1, linkValidator2, linkValidator3 } = await getNamedAccounts();
    const validators = [linkValidator1, linkValidator2, linkValidator3];

    const officialLinkCollectionAddress = LINK_COLLECTION_ADDRESSES[network.name];

    if (!officialLinkCollectionAddress) {
        await deploy("LinkCollection", {
            from: deployer,
            args: [validators],
            log: true,
        });
    }

    const linkCollectionContractAddress = await getLinkCollectionContractAddress("LinkCollection", hre);
    const linkCollectionContract = (await ethers.getContractAt(
        "LinkCollection",
        linkCollectionContractAddress
    )) as LinkCollection;

    const foundationAccount = ContractUtils.sha256String(process.env.FOUNDATION_EMAIL || "");
    if ((await linkCollectionContract.toAddress(foundationAccount)) !== foundation) {
        const nonce = await linkCollectionContract.nonceOf(foundation);
        const signature = await ContractUtils.sign(await ethers.getSigner(foundation), foundationAccount, nonce);

        const reqId1 = ContractUtils.getRequestId(foundationAccount, foundation, nonce);
        const tx1 = await linkCollectionContract
            .connect(await ethers.getSigner(linkValidator1))
            .addRequest(reqId1, foundationAccount, foundation, signature);
        console.log(`Add email-address of foundation (tx: ${tx1.hash})...`);
        await tx1.wait();

        const tx2 = await linkCollectionContract.connect(await ethers.getSigner(linkValidator1)).voteRequest(reqId1);
        console.log(`Vote of validator1 (tx: ${tx2.hash})...`);
        await tx2.wait();

        const tx3 = await linkCollectionContract.connect(await ethers.getSigner(linkValidator2)).voteRequest(reqId1);
        console.log(`Vote of validator2 (tx: ${tx3.hash})...`);
        await tx3.wait();

        const tx4 = await linkCollectionContract.connect(await ethers.getSigner(linkValidator1)).countVote(reqId1);
        console.log(`Count of vote (tx: ${tx4.hash})...`);
        await tx4.wait();

        if ((await linkCollectionContract.toAddress(foundationAccount)) === foundation) {
            console.log(`Success ${foundation}`);
        } else {
            console.log(`Fail ${foundation}`);
        }
        console.log(`Foundation address : ${await linkCollectionContract.toAddress(foundationAccount)}`);
    }

    const users = JSON.parse(fs.readFileSync("./deploy/data/users.json", "utf8"));
    for (const user of users) {
        if (!user.register) continue;
        const userAccount = ContractUtils.sha256String(user.email);
        if ((await linkCollectionContract.toAddress(userAccount)) !== user.address) {
            const userNonce = await linkCollectionContract.nonceOf(user.address);
            const userSignature = await ContractUtils.sign(new Wallet(user.privateKey), userAccount, userNonce);
            const reqId2 = ContractUtils.getRequestId(userAccount, user.address, userNonce);
            const tx5 = await linkCollectionContract
                .connect(await ethers.getSigner(linkValidator1))
                .addRequest(reqId2, userAccount, user.address, userSignature);
            console.log(`Add email-address of user (tx: ${tx5.hash})...`);
            await tx5.wait();

            const tx6 = await linkCollectionContract
                .connect(await ethers.getSigner(linkValidator1))
                .voteRequest(reqId2);
            console.log(`Vote of validator1 (tx: ${tx6.hash})...`);
            await tx6.wait();

            const tx7 = await linkCollectionContract
                .connect(await ethers.getSigner(linkValidator2))
                .voteRequest(reqId2);
            console.log(`Vote of validator2 (tx: ${tx7.hash})...`);
            await tx7.wait();

            const tx8 = await linkCollectionContract.connect(await ethers.getSigner(linkValidator1)).countVote(reqId2);
            console.log(`Count of vote (tx: ${tx8.hash})...`);
            await tx8.wait();

            if ((await linkCollectionContract.toAddress(userAccount)) === user.address) {
                console.log(`Success ${user.address}`);
            } else {
                console.log(`Fail ${user.address}`);
            }
        }
    }
};
export default func;
func.tags = ["LinkCollection"];
