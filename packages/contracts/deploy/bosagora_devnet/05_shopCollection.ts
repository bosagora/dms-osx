import "@nomiclabs/hardhat-ethers";
import fs from "fs";
import "hardhat-deploy";
// tslint:disable-next-line:no-submodule-imports
import { DeployFunction } from "hardhat-deploy/types";
// tslint:disable-next-line:no-submodule-imports
import { HardhatRuntimeEnvironment } from "hardhat/types";
import { ContractUtils } from "../../src/utils/ContractUtils";
import { PhoneLinkCollection, ShopCollection, ValidatorCollection } from "../../typechain-types";
import { getContractAddress, getPhoneLinkCollectionContractAddress } from "../helpers";

import { Wallet } from "ethers";

const func: DeployFunction = async (hre: HardhatRuntimeEnvironment) => {
    console.log(`\nDeploying ShopCollection.`);

    const { deployments, getNamedAccounts, ethers } = hre;
    const { deploy } = deployments;
    const {
        deployer,
        validator1,
        validator2,
        validator3,
        validator4,
        validator5,
        linkValidator1,
        linkValidator2,
        linkValidator3,
    } = await getNamedAccounts();
    const validators = [validator1, validator2, validator3, validator4, validator5];

    const validatorContractAddress = await getContractAddress("ValidatorCollection", hre);

    const deployResult = await deploy("ShopCollection", {
        from: deployer,
        args: [validatorContractAddress],
        log: true,
    });

    if (deployResult.newlyDeployed) {
        interface IShopData {
            shopId: string;
            provideWaitTime: number;
            providePercent: number;
            phone: string;
            address: string;
            privateKey: string;
        }
        const shopData: IShopData[] = JSON.parse(fs.readFileSync("./deploy/data/shops.json"));
        const contractAddress = await getContractAddress("ShopCollection", hre);
        const contract = (await ethers.getContractAt("ShopCollection", contractAddress)) as ShopCollection;

        for (const shop of shopData) {
            const tx = await contract
                .connect(await ethers.getSigner(validators[0]))
                .add(shop.shopId, shop.provideWaitTime, shop.providePercent, ContractUtils.getPhoneHash(shop.phone));
            console.log(`Add shop data (tx: ${tx.hash})...`);
            await tx.wait();
        }

        const linkCollectionContractAddress = await getPhoneLinkCollectionContractAddress("PhoneLinkCollection", hre);
        const linkCollectionContract = (await ethers.getContractAt(
            "PhoneLinkCollection",
            linkCollectionContractAddress
        )) as PhoneLinkCollection;

        for (const shop of shopData) {
            const phoneHash = ContractUtils.getPhoneHash(shop.phone);
            if ((await linkCollectionContract.toAddress(phoneHash)) !== shop.address) {
                const userNonce = await linkCollectionContract.nonceOf(shop.address);
                const userSignature = await ContractUtils.signRequestHash(
                    new Wallet(shop.privateKey),
                    phoneHash,
                    userNonce
                );
                const reqId2 = ContractUtils.getRequestId(phoneHash, shop.address, userNonce);
                const tx5 = await linkCollectionContract
                    .connect(await ethers.getSigner(linkValidator1))
                    .addRequest(reqId2, phoneHash, shop.address, userSignature);
                console.log(`Add phone-address of user (tx: ${tx5.hash})...`);
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

                const tx8 = await linkCollectionContract
                    .connect(await ethers.getSigner(linkValidator1))
                    .countVote(reqId2);
                console.log(`Count of vote (tx: ${tx8.hash})...`);
                await tx8.wait();

                if ((await linkCollectionContract.toAddress(phoneHash)) === shop.address) {
                    console.log(`Success ${shop.address}`);
                } else {
                    console.log(`Fail ${shop.address}`);
                }
            }
        }

        const users = JSON.parse(fs.readFileSync("./deploy/data/users.json", "utf8"));
        let idx = 0;
        for (const user of users) {
            if (++idx % 2 === 1) continue;
            const userAccount = ContractUtils.getPhoneHash(user.phone);
            if ((await linkCollectionContract.toAddress(userAccount)) !== user.address) {
                const userNonce = await linkCollectionContract.nonceOf(user.address);
                const userSignature = await ContractUtils.signRequestHash(
                    new Wallet(user.privateKey),
                    userAccount,
                    userNonce
                );
                const reqId2 = ContractUtils.getRequestId(userAccount, user.address, userNonce);
                const tx5 = await linkCollectionContract
                    .connect(await ethers.getSigner(linkValidator1))
                    .addRequest(reqId2, userAccount, user.address, userSignature);
                console.log(`Add phone-address of user (tx: ${tx5.hash})...`);
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

                const tx8 = await linkCollectionContract
                    .connect(await ethers.getSigner(linkValidator1))
                    .countVote(reqId2);
                console.log(`Count of vote (tx: ${tx8.hash})...`);
                await tx8.wait();

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
func.tags = ["ShopCollection"];
