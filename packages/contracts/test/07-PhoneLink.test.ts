import "@nomiclabs/hardhat-ethers";
import "@nomiclabs/hardhat-waffle";
import "@openzeppelin/hardhat-upgrades";
import { ethers, upgrades, waffle } from "hardhat";

import { ContractUtils } from "../src/utils/ContractUtils";
import { ERC20, PhoneLinkCollection } from "../typechain-types";

import assert from "assert";
import chai, { expect } from "chai";
import { solidity } from "ethereum-waffle";

import { BigNumber } from "ethers";

// tslint:disable-next-line:no-implicit-dependencies
import { AddressZero, HashZero } from "@ethersproject/constants";
import { Deployments } from "./helper/Deployments";

chai.use(solidity);

describe("Test for PhoneLinkCollection", () => {
    const deployments = new Deployments();

    let contract: PhoneLinkCollection;
    let requestId: string;

    before(async () => {
        await deployments.doDeployLedger();
        contract = deployments.getContract("PhoneLinkCollection") as PhoneLinkCollection;
    });

    it("Add an request item", async () => {
        const nonce = await contract.nonceOf(deployments.accounts.users[0].address);
        assert.deepStrictEqual(nonce.toString(), "0");
        const phone = "08201012341234";
        const hash = ContractUtils.getPhoneHash(phone);
        const message = ContractUtils.getRequestMessage(hash, deployments.accounts.users[0].address, nonce);
        const signature = await ContractUtils.signMessage(deployments.accounts.users[0], message);
        requestId = ContractUtils.getRequestId(hash, deployments.accounts.users[0].address, nonce);
        expect(await contract.connect(deployments.accounts.certifiers[0]).isAvailable(requestId)).to.equal(true);
        await expect(
            contract
                .connect(deployments.accounts.certifiers[0])
                .addRequest(requestId, hash, deployments.accounts.users[0].address, signature)
        )
            .to.emit(contract, "AddedRequestItem")
            .withArgs(requestId, hash, deployments.accounts.users[0].address);
        assert.deepStrictEqual((await contract.nonceOf(deployments.accounts.users[0].address)).toString(), "1");
        expect(await contract.connect(deployments.accounts.certifiers[0]).isAvailable(requestId)).to.equal(false);
    });

    it("Vote of request item", async () => {
        const phone = "08201012341234";
        const hash = ContractUtils.getPhoneHash(phone);
        await contract.connect(deployments.accounts.linkValidators[0]).voteRequest(requestId);
        await contract.connect(deployments.accounts.linkValidators[1]).voteRequest(requestId);

        await expect(contract.connect(deployments.accounts.linkValidators[0]).countVote(requestId))
            .to.emit(contract, "AcceptedRequestItem")
            .withArgs(requestId, hash, deployments.accounts.users[0].address);

        assert.deepStrictEqual(await contract.toAddress(hash), deployments.accounts.users[0].address);
        assert.deepStrictEqual(await contract.toPhone(deployments.accounts.users[0].address), hash);
    });

    it("Update an item", async () => {
        const phone = "08201012341234";
        const hash = ContractUtils.getPhoneHash(phone);

        const nonce = await contract.nonceOf(deployments.accounts.users[1].address);
        const message = ContractUtils.getRequestMessage(hash, deployments.accounts.users[1].address, nonce);
        const signature = await ContractUtils.signMessage(deployments.accounts.users[1], message);

        requestId = ContractUtils.getRequestId(hash, deployments.accounts.users[1].address, nonce);
        expect(await contract.connect(deployments.accounts.certifiers[0]).isAvailable(requestId)).to.equal(true);
        await expect(
            contract
                .connect(deployments.accounts.certifiers[0])
                .addRequest(requestId, hash, deployments.accounts.users[1].address, signature)
        )
            .to.emit(contract, "AddedRequestItem")
            .withArgs(requestId, hash, deployments.accounts.users[1].address);
        assert.deepStrictEqual((await contract.nonceOf(deployments.accounts.users[1].address)).toString(), "1");
        expect(await contract.connect(deployments.accounts.certifiers[0]).isAvailable(requestId)).to.equal(false);
    });

    it("Vote of update item", async () => {
        const phone = "08201012341234";
        const hash = ContractUtils.getPhoneHash(phone);
        await contract.connect(deployments.accounts.linkValidators[0]).voteRequest(requestId);
        await contract.connect(deployments.accounts.linkValidators[1]).voteRequest(requestId);

        await expect(contract.connect(deployments.accounts.linkValidators[0]).countVote(requestId))
            .to.emit(contract, "AcceptedRequestItem")
            .withArgs(requestId, hash, deployments.accounts.users[1].address);

        assert.deepStrictEqual(await contract.toAddress(hash), deployments.accounts.users[1].address);
        assert.deepStrictEqual(await contract.toPhone(deployments.accounts.users[1].address), hash);
    });

    it("Remove item", async () => {
        const phone = "08201012341234";
        const hash = ContractUtils.getPhoneHash(phone);
        const nonce = await contract.nonceOf(deployments.accounts.users[1].address);
        const message = ContractUtils.getRemoveMessage(deployments.accounts.users[1].address, nonce);
        const signature = await ContractUtils.signMessage(deployments.accounts.users[1], message);

        await expect(
            contract
                .connect(deployments.accounts.linkValidators[0])
                .remove(deployments.accounts.users[1].address, signature)
        )
            .to.emit(contract, "RemovedItem")
            .withArgs(hash, deployments.accounts.users[1].address);

        assert.deepStrictEqual(await contract.toAddress(hash), AddressZero);
        assert.deepStrictEqual(await contract.toPhone(deployments.accounts.users[1].address), HashZero);
    });

    it("Check Null", async () => {
        const phone = "";
        const hash = ContractUtils.getPhoneHash(phone);
        expect(hash).to.equal("0x32105b1d0b88ada155176b58ee08b45c31e4f2f7337475831982c313533b880c");
        const nonce = await contract.nonceOf(deployments.accounts.users[2].address);
        const message = ContractUtils.getRequestMessage(hash, deployments.accounts.users[2].address, nonce);
        const signature = await ContractUtils.signMessage(deployments.accounts.users[2], message);
        requestId = ContractUtils.getRequestId(hash, deployments.accounts.users[2].address, nonce);
        await expect(
            contract
                .connect(deployments.accounts.certifiers[0])
                .addRequest(requestId, hash, deployments.accounts.users[2].address, signature)
        ).to.be.revertedWith("Invalid phone hash");
    });

    it("Validator's data", async () => {
        const res = await contract.getValidators();
        assert.deepStrictEqual(res.length, deployments.accounts.linkValidators.length);
        let idx = 0;
        for (const item of res) {
            assert.strictEqual(item.validator, deployments.accounts.linkValidators[idx++].address);
            assert.strictEqual(item.status, 1);
        }
    });

    it("Validator's address", async () => {
        const res = await contract.getAddressOfValidators();
        assert.deepStrictEqual(
            res,
            deployments.accounts.linkValidators.map((m) => m.address)
        );
    });

    it("Validator length", async () => {
        const res = await contract.getValidatorLength();
        assert.deepStrictEqual(res, BigNumber.from(3));
    });

    it("Check Validator", async () => {
        const length = (await contract.getValidatorLength()).toNumber();
        for (let idx = 0; idx < length; idx++) {
            const res = await contract.getValidator(idx);
            assert.strictEqual(res.validator, deployments.accounts.linkValidators[idx++].address);
            assert.strictEqual(res.status, 1);
        }
    });

    it("Set endpoint", async () => {
        for (let idx = 0; idx < deployments.accounts.linkValidators.length; idx++) {
            const res = await contract.getValidator(idx);
            assert.strictEqual(res.endpoint, "");
        }

        for (let idx = 0; idx < deployments.accounts.linkValidators.length; idx++) {
            const res = await contract
                .connect(deployments.accounts.linkValidators[idx])
                .updateEndpoint(`http://127.0.0.1:${idx + 7070}`);
        }

        for (let idx = 0; idx < deployments.accounts.linkValidators.length; idx++) {
            const res = await contract.getValidator(idx);
            assert.strictEqual(res.endpoint, `http://127.0.0.1:${idx + 7070}`);
        }
    });
});
