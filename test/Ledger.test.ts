import { Ledger, Token, ValidatorCollection } from "../typechain-types";
import { Amount } from "./helper/Amount";
import { ContractUtils } from "./helper/ContractUtils";

import "@nomiclabs/hardhat-ethers";
import "@nomiclabs/hardhat-waffle";

import assert from "assert";
import chai, { expect } from "chai";
import { solidity } from "ethereum-waffle";

import * as hre from "hardhat";

chai.use(solidity);

interface PurchaseData {
    purchaseId: string;
    timestamp: number;
    amount: number;
    userEmail: string;
    franchiseeId: string;
}

const purchaseData: PurchaseData[] = [
    {
        purchaseId: "P000001",
        timestamp: 1672844400,
        amount: 10000,
        userEmail: "a@example.com",
        franchiseeId: "F000100",
    },
    {
        purchaseId: "P000002",
        timestamp: 1675522800,
        amount: 10000,
        userEmail: "b@example.com",
        franchiseeId: "F000100",
    },
    {
        purchaseId: "P000003",
        timestamp: 1677942000,
        amount: 10000,
        userEmail: "c@example.com",
        franchiseeId: "F000200",
    },
    {
        purchaseId: "P000004",
        timestamp: 1680620400,
        amount: 10000,
        userEmail: "d@example.com",
        franchiseeId: "F000300",
    },
    {
        purchaseId: "P000005",
        timestamp: 1683212400,
        amount: 10000,
        userEmail: "a@example.com",
        franchiseeId: "F000200",
    },
];

describe("Test for Ledger", () => {
    const provider = hre.waffle.provider;
    const [deployer, validator1, validator2, validator3] = provider.getWallets();

    const validators = [validator1, validator2, validator3];
    let validatorContract: ValidatorCollection;
    let tokenContract: Token;
    let ledgerContract: Ledger;

    const amount = Amount.make(50000, 18);

    before(async () => {
        const tokenFactory = await hre.ethers.getContractFactory("Token");
        tokenContract = (await tokenFactory.connect(deployer).deploy("Sample", "SAM")) as Token;
        await tokenContract.deployed();
        await tokenContract.deployTransaction.wait();
        for (const elem of validators) {
            await tokenContract.connect(deployer).transfer(elem.address, amount.value);
        }

        const validatorFactory = await hre.ethers.getContractFactory("ValidatorCollection");
        validatorContract = (await validatorFactory.connect(deployer).deploy(
            tokenContract.address,
            validators.map((m) => m.address)
        )) as ValidatorCollection;
        await validatorContract.deployed();
        await validatorContract.deployTransaction.wait();

        for (const elem of validators) {
            await tokenContract.connect(elem).approve(validatorContract.address, amount.value);
            await expect(validatorContract.connect(elem).deposit(amount.value))
                .to.emit(validatorContract, "Deposited")
                .withArgs(elem.address, amount.value, amount.value);
            let item = await validatorContract.validators(elem.address);
            assert.deepStrictEqual(item.validator, elem.address);
            assert.deepStrictEqual(item.status, 1);
            assert.deepStrictEqual(item.balance, amount.value);
        }
        await validatorContract.connect(validator1).makeActiveItems();

        const ledgerFactory = await hre.ethers.getContractFactory("Ledger");
        ledgerContract = (await ledgerFactory
            .connect(deployer)
            .deploy(tokenContract.address, validatorContract.address)) as Ledger;
        await ledgerContract.deployed();
        await ledgerContract.deployTransaction.wait();
    });

    it("Save Purchase Data - Not validator", async () => {
        for (const purchase of purchaseData) {
            const hash = ContractUtils.sha256String(purchase.userEmail);
            await expect(
                ledgerContract
                    .connect(deployer)
                    .savePurchase(purchase.purchaseId, purchase.timestamp, purchase.amount, hash, purchase.franchiseeId)
            ).to.be.revertedWith("Not validator");
        }
    });

    it("Save Purchase Data", async () => {
        for (const purchase of purchaseData) {
            const emailHash = ContractUtils.sha256String(purchase.userEmail);
            await expect(
                ledgerContract
                    .connect(validator1)
                    .savePurchase(
                        purchase.purchaseId,
                        purchase.timestamp,
                        purchase.amount,
                        emailHash,
                        purchase.franchiseeId
                    )
            )
                .to.emit(ledgerContract, "SavedPurchase")
                .withArgs(purchase.purchaseId, purchase.timestamp, purchase.amount, emailHash, purchase.franchiseeId)
                .emit(ledgerContract, "ProvidedMileage")
                .withArgs(emailHash, Math.floor(purchase.amount / 100));
        }
    });

    it("Check balances", async () => {
        const expected: Map<string, number> = new Map<string, number>();
        for (const purchase of purchaseData) {
            const key = ContractUtils.sha256String(purchase.userEmail);
            const oldValue = expected.get(key);
            const mileage = Math.floor(purchase.amount / 100);
            if (oldValue !== undefined) expected.set(key, oldValue + mileage);
            else expected.set(key, mileage);
        }
        for (let key of expected.keys())
            expect(await ledgerContract.mileageLedger(key)).to.deep.equal(expected.get(key));
    });
});
