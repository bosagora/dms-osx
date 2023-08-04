import { ValidatorCollection } from "../typechain-types";

import "@nomiclabs/hardhat-ethers";
import "@nomiclabs/hardhat-waffle";

import assert from "assert";
import chai, { expect } from "chai";
import { solidity } from "ethereum-waffle";

import * as hre from "hardhat";

chai.use(solidity);

describe("Test for LinkCollection", () => {
    const provider = hre.waffle.provider;
    const [deployer, validator1, validator2, validator3] = provider.getWallets();

    const validators = [validator1, validator2, validator3];
    let contract: ValidatorCollection;

    before(async () => {
        const factory = await hre.ethers.getContractFactory("ValidatorCollection");
        contract = (await factory.connect(deployer).deploy(validators.map((m) => m.address))) as ValidatorCollection;
        await contract.deployed();
        await contract.deployTransaction.wait();
    });

    it("Check validator", async () => {
        let item = await contract.items(0);
        assert.deepStrictEqual(item.validator, validator1.address);
        assert.deepStrictEqual(item.status, 2);

        item = await contract.items(1);
        assert.deepStrictEqual(item.validator, validator2.address);
        assert.deepStrictEqual(item.status, 2);

        item = await contract.items(2);
        assert.deepStrictEqual(item.validator, validator3.address);
        assert.deepStrictEqual(item.status, 2);
    });
});
