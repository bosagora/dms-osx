import "@nomiclabs/hardhat-ethers";
import { BigNumber } from "ethers";
import "hardhat-deploy";
// tslint:disable-next-line:no-submodule-imports
import { DeployFunction } from "hardhat-deploy/types";
// tslint:disable-next-line:no-submodule-imports
import { HardhatRuntimeEnvironment } from "hardhat/types";
import { CertifierCollection } from "../../typechain-types";
import { getContractAddress } from "../helpers";

const func: DeployFunction = async (hre: HardhatRuntimeEnvironment) => {
    console.log(`\nDeploying CertifierCollection.`);

    const { deployments, getNamedAccounts, ethers } = hre;
    const { deploy } = deployments;
    const {
        deployer,
        certifier,
        certifier01,
        certifier02,
        certifier03,
        certifier04,
        certifier05,
        certifier06,
        certifier07,
        certifier08,
        certifier09,
        certifier10,
    } = await getNamedAccounts();

    const deployResult = await deploy("CertifierCollection", {
        from: certifier,
        args: [certifier],
        log: true,
    });

    if (deployResult.newlyDeployed) {
        const contractAddress = await getContractAddress("CertifierCollection", hre);
        const certifierCollection = (await ethers.getContractAt(
            "CertifierCollection",
            contractAddress
        )) as CertifierCollection;

        let tx1 = await certifierCollection.connect(await ethers.getSigner(certifier)).grantCertifier(certifier01);
        console.log(`Grant Certifier (tx: ${tx1.hash})...`);
        await tx1.wait();

        tx1 = await certifierCollection.connect(await ethers.getSigner(certifier)).grantCertifier(certifier02);
        console.log(`Grant Certifier (tx: ${tx1.hash})...`);
        await tx1.wait();

        tx1 = await certifierCollection.connect(await ethers.getSigner(certifier)).grantCertifier(certifier03);
        console.log(`Grant Certifier (tx: ${tx1.hash})...`);
        await tx1.wait();

        tx1 = await certifierCollection.connect(await ethers.getSigner(certifier)).grantCertifier(certifier04);
        console.log(`Grant Certifier (tx: ${tx1.hash})...`);
        await tx1.wait();

        tx1 = await certifierCollection.connect(await ethers.getSigner(certifier)).grantCertifier(certifier05);
        console.log(`Grant Certifier (tx: ${tx1.hash})...`);
        await tx1.wait();

        tx1 = await certifierCollection.connect(await ethers.getSigner(certifier)).grantCertifier(certifier06);
        console.log(`Grant Certifier (tx: ${tx1.hash})...`);
        await tx1.wait();

        tx1 = await certifierCollection.connect(await ethers.getSigner(certifier)).grantCertifier(certifier07);
        console.log(`Grant Certifier (tx: ${tx1.hash})...`);
        await tx1.wait();

        tx1 = await certifierCollection.connect(await ethers.getSigner(certifier)).grantCertifier(certifier08);
        console.log(`Grant Certifier (tx: ${tx1.hash})...`);
        await tx1.wait();

        tx1 = await certifierCollection.connect(await ethers.getSigner(certifier)).grantCertifier(certifier09);
        console.log(`Grant Certifier (tx: ${tx1.hash})...`);
        await tx1.wait();

        tx1 = await certifierCollection.connect(await ethers.getSigner(certifier)).grantCertifier(certifier10);
        console.log(`Grant Certifier (tx: ${tx1.hash})...`);
        await tx1.wait();
    }
};
export default func;
func.tags = ["CurrencyRate"];
