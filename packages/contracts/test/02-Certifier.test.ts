import "@nomiclabs/hardhat-ethers";
import "@nomiclabs/hardhat-waffle";
import "@openzeppelin/hardhat-upgrades";
import { ethers, upgrades, waffle } from "hardhat";

import { Amount } from "../src/utils/Amount";
import { Certifier } from "../typechain-types";

import assert from "assert";
import chai, { expect } from "chai";
import { solidity } from "ethereum-waffle";

chai.use(solidity);

describe("Test for Certifier", () => {
    const provider = waffle.provider;
    const [deployer, certifierAdmin, certifier1, certifier2, certifier3, certifier4, certifier5] =
        provider.getWallets();

    const certifiers = [certifier1, certifier2, certifier3, certifier4, certifier5];
    let certifierContract: Certifier;

    it("Deploy", async () => {
        const factory = await ethers.getContractFactory("Certifier");
        certifierContract = (await upgrades.deployProxy(factory.connect(deployer), [certifierAdmin.address], {
            initializer: "initialize",
            kind: "uups",
        })) as Certifier;
        await certifierContract.deployed();
        await certifierContract.deployTransaction.wait();
    });

    it("Certifier.isCertifier()", async () => {
        assert.deepStrictEqual(await certifierContract.isCertifier(certifierAdmin.address), true);
    });

    it("Certifier.isCertifier()", async () => {
        await certifierContract.connect(certifierAdmin).grantCertifier(certifier1.address);
        assert.deepStrictEqual(await certifierContract.isCertifier(certifier1.address), true);

        await expect(certifierContract.connect(certifier1).grantCertifier(certifier2.address)).to.be.reverted;
    });

    it("Certifier.grantRole()", async () => {
        await certifierContract.connect(certifierAdmin).grantCertifier(certifier2.address);
        assert.deepStrictEqual(await certifierContract.isCertifier(certifier2.address), true);
    });

    it("Certifier.revokeCertifier()", async () => {
        await certifierContract.connect(certifierAdmin).revokeCertifier(certifier2.address);
        assert.deepStrictEqual(await certifierContract.isCertifier(certifier2.address), false);
    });

    it("Certifier.renounceRole()", async () => {
        await certifierContract.connect(certifier1).renounceCertifier(certifier1.address);
        assert.deepStrictEqual(await certifierContract.isCertifier(certifier1.address), false);
    });
});
