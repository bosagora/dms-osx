import { Certifier, Validator } from "../typechain-types";
import "@nomicfoundation/hardhat-ethers";
import "@openzeppelin/hardhat-upgrades";
import { ethers, upgrades } from "hardhat";

import assert from "assert";
import { expect } from "chai";

import { HardhatAccount } from "../src/HardhatAccount";

describe("Test for CertifierCollection", () => {
    const accounts = HardhatAccount.keys.map((m) => new ethers.Wallet(m, ethers.provider));
    const [deployer, certifierAdmin, certifier1, certifier2, certifier3, certifier4, certifier5] = accounts;

    let certifierContract: Certifier;

    it("Deploy", async () => {
        const factory = await ethers.getContractFactory("Certifier");
        certifierContract = (await upgrades.deployProxy(factory.connect(deployer), [certifierAdmin.address], {
            initializer: "initialize",
            kind: "uups",
        })) as unknown as Certifier;
        await certifierContract.waitForDeployment();
    });

    it("CertifierCollection.isCertifier()", async () => {
        assert.deepStrictEqual(await certifierContract.isCertifier(certifierAdmin.address), true);
    });

    it("CertifierCollection.isCertifier()", async () => {
        await certifierContract.connect(certifierAdmin).grantCertifier(certifier1.address);
        assert.deepStrictEqual(await certifierContract.isCertifier(certifier1.address), true);

        await expect(certifierContract.connect(certifier1).grantCertifier(certifier2.address)).to.be.reverted;
    });

    it("CertifierCollection.grantRole()", async () => {
        await certifierContract.connect(certifierAdmin).grantCertifier(certifier2.address);
        assert.deepStrictEqual(await certifierContract.isCertifier(certifier2.address), true);
    });

    it("CertifierCollection.revokeCertifier()", async () => {
        await certifierContract.connect(certifierAdmin).revokeCertifier(certifier2.address);
        assert.deepStrictEqual(await certifierContract.isCertifier(certifier2.address), false);
    });

    it("CertifierCollection.renounceRole()", async () => {
        await certifierContract.connect(certifier1).renounceCertifier(certifier1.address);
        assert.deepStrictEqual(await certifierContract.isCertifier(certifier1.address), false);
    });
});
