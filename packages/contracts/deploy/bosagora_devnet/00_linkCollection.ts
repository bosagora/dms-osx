import "@nomiclabs/hardhat-ethers";
import "hardhat-deploy";
// tslint:disable-next-line:no-submodule-imports
import { DeployFunction } from "hardhat-deploy/types";
// tslint:disable-next-line:no-submodule-imports
import { HardhatRuntimeEnvironment } from "hardhat/types";
import { ContractUtils } from "../../test/helper/ContractUtils";
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
        const { deployer, foundation, linkValidator1 } = await getNamedAccounts();
        const validators = [linkValidator1];

        const deployResult = await deploy("LinkCollection", {
            from: deployer,
            args: [validators],
            log: true,
        });

        if (deployResult.newlyDeployed) {
            const linkCollectionContractAddress = await getContractAddress("LinkCollection", hre);
            const linkCollectionContract = (await ethers.getContractAt(
                "LinkCollection",
                linkCollectionContractAddress
            )) as LinkCollection;

            const foundationAccount = ContractUtils.sha256String(process.env.FOUNDATION_EMAIL || "");
            const nonce = await linkCollectionContract.nonceOf(foundation);
            const signature = await ContractUtils.sign(await ethers.getSigner(foundation), foundationAccount, nonce);

            const tx1 = await linkCollectionContract
                .connect(await ethers.getSigner(linkValidator1))
                .addRequest(foundationAccount, foundation, signature);
            console.log(`Add email-address of foundation (tx: ${tx1.hash})...`);
            const receipt = await tx1.wait();
            const events = receipt.events?.filter((x) => x.event === "AddedRequestItem");
            const reqId =
                events !== undefined && events.length > 0 && events[0].args !== undefined
                    ? BigNumber.from(events[0].args[0])
                    : BigNumber.from(0);
            console.log(`Req ID:  ${reqId.toString()}`);

            const tx2 = await linkCollectionContract
                .connect(await ethers.getSigner(linkValidator1))
                .voteRequest(reqId, 1);
            console.log(`Vote of validator1 (tx: ${tx2.hash})...`);
            await tx2.wait();

            if ((await linkCollectionContract.toAddress(foundationAccount)) === foundation) {
                console.log(`Success ${foundation}`);
            } else {
                console.log(`Fail ${foundation}`);
            }
            console.log(`Foundation address : ${await linkCollectionContract.toAddress(foundationAccount)}`);

            const users = JSON.parse(fs.readFileSync("./deploy/data/users.json", "utf8"));
            for (const user of users) {
                if (!user.register) continue;
                const userAccount = ContractUtils.sha256String(user.email);
                const userNonce = await linkCollectionContract.nonceOf(user.address);
                const userSignature = await ContractUtils.sign(new Wallet(user.privateKey), userAccount, userNonce);
                const tx5 = await linkCollectionContract
                    .connect(await ethers.getSigner(linkValidator1))
                    .addRequest(userAccount, user.address, userSignature);
                console.log(`Add email-address of user (tx: ${tx5.hash})...`);
                const receipt2 = await tx5.wait();
                const events2 = receipt2.events?.filter((x) => x.event === "AddedRequestItem");
                const reqId2 =
                    events2 !== undefined && events2.length > 0 && events2[0].args !== undefined
                        ? BigNumber.from(events2[0].args[0])
                        : BigNumber.from(0);
                console.log(`Req ID:  ${reqId2.toString()}`);

                const tx6 = await linkCollectionContract
                    .connect(await ethers.getSigner(linkValidator1))
                    .voteRequest(reqId2, 1);
                console.log(`Vote of validator1 (tx: ${tx6.hash})...`);
                await tx6.wait();

                if ((await linkCollectionContract.toAddress(userAccount)) === user.address) {
                    console.log(`Success ${user.address}`);
                } else {
                    console.log(`Fail ${user.address}`);
                }
            }
        }
    }
};
export default func;
func.tags = ["LinkCollection"];
