import { Amount } from "../src/utils/Amount";
import { CertifierCollection } from "../typechain-types";

import "@nomiclabs/hardhat-ethers";
import "@nomiclabs/hardhat-waffle";

import assert from "assert";
import chai, { expect } from "chai";
import { solidity } from "ethereum-waffle";

import * as hre from "hardhat";

chai.use(solidity);

describe("Test for CertifierCollection", () => {
    const provider = hre.waffle.provider;
    const [deployer, certifierAdmin, certifier1, certifier2, certifier3, certifier4, certifier5] =
        provider.getWallets();

    const certifiers = [certifier1, certifier2, certifier3, certifier4, certifier5];
    let certifierCollection: CertifierCollection;

    it("Deploy", async () => {
        const factory = await hre.ethers.getContractFactory("CertifierCollection");
        certifierCollection = (await factory.connect(deployer).deploy(certifierAdmin.address)) as CertifierCollection;
        await certifierCollection.deployed();
        await certifierCollection.deployTransaction.wait();
    });

    it("CertifierCollection.isCertifier()", async () => {
        assert.deepStrictEqual(await certifierCollection.isCertifier(certifierAdmin.address), true);
    });

    it("CertifierCollection.isCertifier()", async () => {
        await certifierCollection.connect(certifierAdmin).grantCertifier(certifier1.address);
        assert.deepStrictEqual(await certifierCollection.isCertifier(certifier1.address), true);

        await expect(certifierCollection.connect(certifier1).grantCertifier(certifier2.address)).to.be.reverted;
    });

    it("CertifierCollection.grantRole()", async () => {
        await certifierCollection.connect(certifierAdmin).grantCertifier(certifier2.address);
        assert.deepStrictEqual(await certifierCollection.isCertifier(certifier2.address), true);
    });

    it("CertifierCollection.revokeCertifier()", async () => {
        await certifierCollection.connect(certifierAdmin).revokeCertifier(certifier2.address);
        assert.deepStrictEqual(await certifierCollection.isCertifier(certifier2.address), false);
    });

    it("CertifierCollection.renounceRole()", async () => {
        await certifierCollection.connect(certifier1).renounceCertifier(certifier1.address);
        assert.deepStrictEqual(await certifierCollection.isCertifier(certifier1.address), false);
    });
});
