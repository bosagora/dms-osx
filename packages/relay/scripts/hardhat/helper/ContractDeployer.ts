import { Amount } from "../../../src/common/Amount";
import { ContractUtils } from "../../../src/utils/ContractUtils";
import {
    CertifierCollection,
    CurrencyRate,
    Ledger,
    PhoneLinkCollection,
    Shop,
    Token,
    ValidatorCollection,
} from "../../../typechain-types";

import { ContractShopStatus, IShopData, IUserData } from "../../../src/types";

import { BigNumber, Contract, Wallet } from "ethers";
import fs from "fs";
import * as hre from "hardhat";

export interface Deployment {
    phoneLinkCollection: PhoneLinkCollection;
    token: Token;
    validatorCollection: ValidatorCollection;
    currencyRate: CurrencyRate;
    certifierCollection: CertifierCollection;
    shopCollection: Shop;
    ledger: Ledger;
}

export const multiple = BigNumber.from(1000000000);
export const price = BigNumber.from(150).mul(multiple);

export const depositAmount = Amount.make(20_000, 18);
export const foundationAmount = Amount.make(1_000_000_000, 18);

export const userData: IUserData[] = [];

export const shopData: IShopData[] = [];

export class ContractDeployer {
    public static initialAccounts: Wallet[];
    public static CreateInitialAccounts(): Wallet[] {
        const accounts: string[] = [];
        const reg_bytes64: RegExp = /^(0x)[0-9a-f]{64}$/i;
        if (
            process.env.DEPLOYER !== undefined &&
            process.env.DEPLOYER.trim() !== "" &&
            reg_bytes64.test(process.env.DEPLOYER)
        ) {
            accounts.push(process.env.DEPLOYER);
        } else {
            process.env.DEPLOYER = Wallet.createRandom().privateKey;
            accounts.push(process.env.DEPLOYER);
        }

        if (process.env.OWNER !== undefined && process.env.OWNER.trim() !== "" && reg_bytes64.test(process.env.OWNER)) {
            accounts.push(process.env.OWNER);
        } else {
            process.env.OWNER = Wallet.createRandom().privateKey;
            accounts.push(process.env.OWNER);
        }

        if (
            process.env.VALIDATOR1 !== undefined &&
            process.env.VALIDATOR1.trim() !== "" &&
            reg_bytes64.test(process.env.VALIDATOR1)
        ) {
            accounts.push(process.env.VALIDATOR1);
        } else {
            process.env.VALIDATOR1 = Wallet.createRandom().privateKey;
            accounts.push(process.env.VALIDATOR1);
        }

        if (
            process.env.VALIDATOR2 !== undefined &&
            process.env.VALIDATOR2.trim() !== "" &&
            reg_bytes64.test(process.env.VALIDATOR2)
        ) {
            accounts.push(process.env.VALIDATOR2);
        } else {
            process.env.VALIDATOR2 = Wallet.createRandom().privateKey;
            accounts.push(process.env.VALIDATOR2);
        }

        if (
            process.env.VALIDATOR3 !== undefined &&
            process.env.VALIDATOR3.trim() !== "" &&
            reg_bytes64.test(process.env.VALIDATOR3)
        ) {
            accounts.push(process.env.VALIDATOR3);
        } else {
            process.env.VALIDATOR3 = Wallet.createRandom().privateKey;
            accounts.push(process.env.VALIDATOR3);
        }

        if (
            process.env.VALIDATOR4 !== undefined &&
            process.env.VALIDATOR4.trim() !== "" &&
            reg_bytes64.test(process.env.VALIDATOR4)
        ) {
            accounts.push(process.env.VALIDATOR4);
        } else {
            process.env.VALIDATOR4 = Wallet.createRandom().privateKey;
            accounts.push(process.env.VALIDATOR4);
        }

        if (
            process.env.VALIDATOR5 !== undefined &&
            process.env.VALIDATOR5.trim() !== "" &&
            reg_bytes64.test(process.env.VALIDATOR5)
        ) {
            accounts.push(process.env.VALIDATOR5);
        } else {
            process.env.VALIDATOR5 = Wallet.createRandom().privateKey;
            accounts.push(process.env.VALIDATOR5);
        }

        if (
            process.env.FOUNDATION !== undefined &&
            process.env.FOUNDATION.trim() !== "" &&
            reg_bytes64.test(process.env.FOUNDATION)
        ) {
            accounts.push(process.env.FOUNDATION);
        } else {
            process.env.FOUNDATION = Wallet.createRandom().privateKey;
            accounts.push(process.env.FOUNDATION);
        }

        if (
            process.env.SETTLEMENTS !== undefined &&
            process.env.SETTLEMENTS.trim() !== "" &&
            reg_bytes64.test(process.env.SETTLEMENTS)
        ) {
            accounts.push(process.env.SETTLEMENTS);
        } else {
            process.env.SETTLEMENTS = Wallet.createRandom().privateKey;
            accounts.push(process.env.SETTLEMENTS);
        }

        if (process.env.FEE !== undefined && process.env.FEE.trim() !== "" && reg_bytes64.test(process.env.FEE)) {
            accounts.push(process.env.FEE);
        } else {
            process.env.FEE = Wallet.createRandom().privateKey;
            accounts.push(process.env.FEE);
        }

        if (
            process.env.CERTIFIER !== undefined &&
            process.env.CERTIFIER.trim() !== "" &&
            reg_bytes64.test(process.env.CERTIFIER)
        ) {
            accounts.push(process.env.CERTIFIER);
        } else {
            process.env.CERTIFIER = Wallet.createRandom().privateKey;
            accounts.push(process.env.CERTIFIER);
        }

        if (
            process.env.CERTIFIER01 !== undefined &&
            process.env.CERTIFIER01.trim() !== "" &&
            reg_bytes64.test(process.env.CERTIFIER01)
        ) {
            accounts.push(process.env.CERTIFIER01);
        } else {
            process.env.CERTIFIER01 = Wallet.createRandom().privateKey;
            accounts.push(process.env.CERTIFIER01);
        }

        if (
            process.env.CERTIFIER02 !== undefined &&
            process.env.CERTIFIER02.trim() !== "" &&
            reg_bytes64.test(process.env.CERTIFIER02)
        ) {
            accounts.push(process.env.CERTIFIER02);
        } else {
            process.env.CERTIFIER02 = Wallet.createRandom().privateKey;
            accounts.push(process.env.CERTIFIER02);
        }

        if (
            process.env.CERTIFIER03 !== undefined &&
            process.env.CERTIFIER03.trim() !== "" &&
            reg_bytes64.test(process.env.CERTIFIER03)
        ) {
            accounts.push(process.env.CERTIFIER03);
        } else {
            process.env.CERTIFIER03 = Wallet.createRandom().privateKey;
            accounts.push(process.env.CERTIFIER03);
        }

        if (
            process.env.CERTIFIER04 !== undefined &&
            process.env.CERTIFIER04.trim() !== "" &&
            reg_bytes64.test(process.env.CERTIFIER04)
        ) {
            accounts.push(process.env.CERTIFIER04);
        } else {
            process.env.CERTIFIER04 = Wallet.createRandom().privateKey;
            accounts.push(process.env.CERTIFIER04);
        }

        if (
            process.env.CERTIFIER05 !== undefined &&
            process.env.CERTIFIER05.trim() !== "" &&
            reg_bytes64.test(process.env.CERTIFIER05)
        ) {
            accounts.push(process.env.CERTIFIER05);
        } else {
            process.env.CERTIFIER05 = Wallet.createRandom().privateKey;
            accounts.push(process.env.CERTIFIER05);
        }

        if (
            process.env.CERTIFIER06 !== undefined &&
            process.env.CERTIFIER06.trim() !== "" &&
            reg_bytes64.test(process.env.CERTIFIER06)
        ) {
            accounts.push(process.env.CERTIFIER06);
        } else {
            process.env.CERTIFIER06 = Wallet.createRandom().privateKey;
            accounts.push(process.env.CERTIFIER06);
        }

        if (
            process.env.CERTIFIER07 !== undefined &&
            process.env.CERTIFIER07.trim() !== "" &&
            reg_bytes64.test(process.env.CERTIFIER07)
        ) {
            accounts.push(process.env.CERTIFIER07);
        } else {
            process.env.CERTIFIER07 = Wallet.createRandom().privateKey;
            accounts.push(process.env.CERTIFIER07);
        }

        if (
            process.env.CERTIFIER08 !== undefined &&
            process.env.CERTIFIER08.trim() !== "" &&
            reg_bytes64.test(process.env.CERTIFIER08)
        ) {
            accounts.push(process.env.CERTIFIER08);
        } else {
            process.env.CERTIFIER08 = Wallet.createRandom().privateKey;
            accounts.push(process.env.CERTIFIER08);
        }

        if (
            process.env.CERTIFIER09 !== undefined &&
            process.env.CERTIFIER09.trim() !== "" &&
            reg_bytes64.test(process.env.CERTIFIER09)
        ) {
            accounts.push(process.env.CERTIFIER09);
        } else {
            process.env.CERTIFIER09 = Wallet.createRandom().privateKey;
            accounts.push(process.env.CERTIFIER09);
        }

        if (
            process.env.CERTIFIER10 !== undefined &&
            process.env.CERTIFIER10.trim() !== "" &&
            reg_bytes64.test(process.env.CERTIFIER10)
        ) {
            accounts.push(process.env.CERTIFIER10);
        } else {
            process.env.CERTIFIER10 = Wallet.createRandom().privateKey;
            accounts.push(process.env.CERTIFIER10);
        }

        if (
            process.env.LINK_VALIDATOR1 !== undefined &&
            process.env.LINK_VALIDATOR1.trim() !== "" &&
            reg_bytes64.test(process.env.LINK_VALIDATOR1)
        ) {
            accounts.push(process.env.LINK_VALIDATOR1);
        } else {
            process.env.LINK_VALIDATOR1 = Wallet.createRandom().privateKey;
            accounts.push(process.env.LINK_VALIDATOR1);
        }

        if (
            process.env.LINK_VALIDATOR2 !== undefined &&
            process.env.LINK_VALIDATOR2.trim() !== "" &&
            reg_bytes64.test(process.env.LINK_VALIDATOR2)
        ) {
            accounts.push(process.env.LINK_VALIDATOR2);
        } else {
            process.env.LINK_VALIDATOR2 = Wallet.createRandom().privateKey;
            accounts.push(process.env.LINK_VALIDATOR2);
        }

        if (
            process.env.LINK_VALIDATOR3 !== undefined &&
            process.env.LINK_VALIDATOR3.trim() !== "" &&
            reg_bytes64.test(process.env.LINK_VALIDATOR3)
        ) {
            accounts.push(process.env.LINK_VALIDATOR3);
        } else {
            process.env.LINK_VALIDATOR3 = Wallet.createRandom().privateKey;
            accounts.push(process.env.LINK_VALIDATOR3);
        }

        const provider = hre.waffle.provider;
        return accounts.map((m) => new Wallet(m, provider));
    }

    public static getWallets(): Wallet[] {
        if (ContractDeployer.initialAccounts === undefined) {
            ContractDeployer.initialAccounts = ContractDeployer.CreateInitialAccounts();
        }
        return ContractDeployer.initialAccounts;
    }

    public static LoadData() {
        userData.push(...(JSON.parse(fs.readFileSync("./src/data/users.json", "utf8")) as IUserData[]));
        shopData.push(...(JSON.parse(fs.readFileSync("./src/data/shops.json", "utf8")) as IShopData[]));
    }

    public static async deploy(): Promise<Deployment> {
        const provider = hre.waffle.provider;
        const accounts = ContractDeployer.getWallets();
        const [
            deployer,
            owner,
            validator1,
            validator2,
            validator3,
            validator4,
            validator5,
            foundation,
            settlements,
            fee,
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
            link_validator1,
            link_validator2,
            link_validator3,
        ] = accounts;
        const validators = [validator1, validator2, validator3, validator4, validator5];
        const link_validators = [link_validator1, link_validator2, link_validator3];

        try {
            console.log("Deploy Token");
            const tokenContract = await ContractDeployer.deployToken(deployer, validators);

            console.log("Deploy ValidatorCollection");
            const validatorCollectionContract: ValidatorCollection = (await ContractDeployer.deployValidatorCollection(
                deployer,
                tokenContract,
                validators
            )) as ValidatorCollection;

            console.log("Deposit Validator's Amount");
            await ContractDeployer.depositValidators(tokenContract, validatorCollectionContract, validators);
            const linkCollectionContract: PhoneLinkCollection = await ContractDeployer.deployLinkCollection(
                deployer,
                link_validators
            );

            console.log("Deploy CurrencyRate");
            const currencyRateContract: CurrencyRate = await ContractDeployer.deployCurrencyRate(
                deployer,
                validatorCollectionContract,
                tokenContract,
                validator1
            );

            console.log("Deploy CertifierCollection");
            const certifierCollection = await ContractDeployer.deployCertifierCollection(deployer, certifier, [
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
            ]);

            console.log("Deploy Shop");
            const shopCollectionContract: Shop = await ContractDeployer.deployShopCollection(
                deployer,
                certifierCollection.address
            );

            console.log("Deploy Ledger");
            const ledgerContract: Ledger = await ContractDeployer.deployLedger(
                deployer,
                foundation.address,
                settlements.address,
                fee.address,
                certifierCollection.address,
                tokenContract,
                validatorCollectionContract,
                linkCollectionContract,
                currencyRateContract,
                shopCollectionContract
            );

            console.log("Deposit Foundation Asset");
            await ContractDeployer.depositFoundationAsset(tokenContract, ledgerContract, deployer, foundation);

            console.log("Load User & Shop Data");
            ContractDeployer.LoadData();

            console.log("Add Shop Data");
            await ContractDeployer.addShopData(deployer, certifier, shopCollectionContract);

            console.log("Transfer native token");
            {
                for (const user of userData) {
                    const tx = await deployer.sendTransaction({
                        to: user.address,
                        value: Amount.make("100").value,
                    });
                    await tx.wait();
                }
                for (const shop of shopData) {
                    const tx = await deployer.sendTransaction({
                        to: shop.address,
                        value: Amount.make("100").value,
                    });
                    await tx.wait();
                }
            }

            console.log("Transfer token");
            {
                const tx1 = await tokenContract.connect(deployer).multiTransfer(
                    userData.map((m: { address: string }) => m.address),
                    depositAmount.value
                );
                await tx1.wait();

                const tx2 = await tokenContract.connect(deployer).multiTransfer(
                    shopData.map((m: { address: string }) => m.address),
                    depositAmount.value
                );
                await tx2.wait();
            }

            console.log("Change loyalty type");
            {
                for (const user of userData) {
                    const nonce = await ledgerContract.nonceOf(user.address);
                    const signature = await ContractUtils.signLoyaltyType(new Wallet(user.privateKey), nonce);
                    const tx = await ledgerContract.connect(deployer).changeToLoyaltyToken(user.address, signature);
                    await tx.wait();
                }
            }

            console.log("Deposit token");
            {
                const amt = depositAmount.value.div(2);
                for (const user of userData) {
                    const sender = new Wallet(user.privateKey, provider);
                    const tx1 = await tokenContract.connect(sender).approve(ledgerContract.address, amt);
                    await tx1.wait();
                    const tx2 = await ledgerContract.connect(sender).deposit(amt);
                    await tx2.wait();
                }
            }

            return {
                phoneLinkCollection: linkCollectionContract,
                token: tokenContract,
                validatorCollection: validatorCollectionContract,
                currencyRate: currencyRateContract,
                certifierCollection,
                shopCollection: shopCollectionContract,
                ledger: ledgerContract,
            };
        } catch (e) {
            throw e;
        }
    }

    private static async deployToken(deployer: Wallet, validators: Wallet[]): Promise<Token> {
        const tokenFactory = await hre.ethers.getContractFactory("Token");
        const tokenContract = (await tokenFactory
            .connect(deployer)
            .deploy(await deployer.getAddress(), "Sample", "SAM")) as Token;
        await tokenContract.deployed();
        await tokenContract.deployTransaction.wait();

        for (const elem of validators) {
            const tx = await tokenContract.connect(deployer).transfer(elem.address, depositAmount.value);
            await tx.wait();
        }
        return tokenContract;
    }

    private static async deployValidatorCollection(
        deployer: Wallet,
        tokenContract: Token,
        validators: Wallet[]
    ): Promise<ValidatorCollection> {
        const validatorFactory = await hre.ethers.getContractFactory("ValidatorCollection");
        const validatorContract: ValidatorCollection = (await validatorFactory.connect(deployer).deploy(
            tokenContract.address,
            validators.map((m) => m.address)
        )) as ValidatorCollection;
        await validatorContract.deployed();
        await validatorContract.deployTransaction.wait();
        return validatorContract;
    }

    private static async depositValidators(
        tokenContract: Contract,
        validatorContract: ValidatorCollection,
        validators: Wallet[]
    ): Promise<void> {
        for (const elem of validators) {
            const token = tokenContract.connect(elem);
            const address = await elem.getAddress();
            const tx1 = await token.approve(validatorContract.address, depositAmount.value);
            await tx1.wait();
            const tx2 = await validatorContract.connect(elem).deposit(depositAmount.value);
            await tx2.wait();
            await validatorContract.validatorOf(address);
        }
    }

    private static async deployLinkCollection(deployer: Wallet, validators: Wallet[]): Promise<PhoneLinkCollection> {
        const linkCollectionFactory = await hre.ethers.getContractFactory("PhoneLinkCollection");
        const linkCollectionContract: PhoneLinkCollection = (await linkCollectionFactory
            .connect(deployer)
            .deploy(validators.map((m) => m.address))) as PhoneLinkCollection;
        await linkCollectionContract.deployed();
        await linkCollectionContract.deployTransaction.wait();

        return linkCollectionContract;
    }

    private static async deployCurrencyRate(
        deployer: Wallet,
        validatorContract: ValidatorCollection,
        tokenContract: Token,
        validator: Wallet
    ): Promise<CurrencyRate> {
        const currencyRateFactory = await hre.ethers.getContractFactory("CurrencyRate");
        const currencyRateContract = (await currencyRateFactory
            .connect(deployer)
            .deploy(validatorContract.address)) as CurrencyRate;
        await currencyRateContract.deployed();
        await currencyRateContract.deployTransaction.wait();

        await (await currencyRateContract.connect(validator).set(await tokenContract.symbol(), price)).wait();
        await (await currencyRateContract.connect(validator).set("usd", BigNumber.from(1000).mul(multiple))).wait();
        await (await currencyRateContract.connect(validator).set("jpy", BigNumber.from(10).mul(multiple))).wait();
        await (await currencyRateContract.connect(validator).set("cny", BigNumber.from(150).mul(multiple))).wait();
        await (await currencyRateContract.connect(validator).set("krw", BigNumber.from(1).mul(multiple))).wait();
        await (await currencyRateContract.connect(validator).set("point", BigNumber.from(1).mul(multiple))).wait();
        return currencyRateContract;
    }

    private static async deployCertifierCollection(deployer: Wallet, certifier: Wallet, relay: Wallet[]) {
        const factory = await hre.ethers.getContractFactory("CertifierCollection");
        const certifierCollection = (await factory.connect(deployer).deploy(certifier.address)) as CertifierCollection;
        await certifierCollection.deployed();
        await certifierCollection.deployTransaction.wait();
        for (const w of relay) {
            const tx = await certifierCollection.connect(certifier).grantCertifier(w.address);
            await tx.wait();
        }
        return certifierCollection;
    }

    private static async deployShopCollection(deployer: Wallet, certifierAddress: string): Promise<Shop> {
        const shopCollectionFactory = await hre.ethers.getContractFactory("Shop");
        const shopCollection = (await shopCollectionFactory.connect(deployer).deploy(certifierAddress)) as Shop;
        await shopCollection.deployed();
        await shopCollection.deployTransaction.wait();
        return shopCollection;
    }

    private static async deployLedger(
        deployer: Wallet,
        foundationAddress: string,
        settlementAddress: string,
        feeAddress: string,
        certifierAddress: string,
        tokenContract: Contract,
        validatorContract: Contract,
        linkCollectionContract: Contract,
        currencyRateContract: Contract,
        shopCollection: Contract
    ): Promise<Ledger> {
        const ledgerFactory = await hre.ethers.getContractFactory("Ledger");
        const ledgerContract = (await ledgerFactory
            .connect(deployer)
            .deploy(
                foundationAddress,
                settlementAddress,
                feeAddress,
                certifierAddress,
                tokenContract.address,
                validatorContract.address,
                linkCollectionContract.address,
                currencyRateContract.address,
                shopCollection.address
            )) as Ledger;
        await ledgerContract.deployed();
        await ledgerContract.deployTransaction.wait();
        const tx = await shopCollection.connect(deployer).setLedgerAddress(ledgerContract.address);
        await tx.wait();
        return ledgerContract;
    }

    private static async depositFoundationAsset(
        tokenContract: Token,
        ledgerContract: Ledger,
        deployer: Wallet,
        foundation: Wallet
    ): Promise<void> {
        const tx1 = await tokenContract.connect(deployer).transfer(foundation.address, foundationAmount.value);
        await tx1.wait();
        const tx2 = await tokenContract.connect(foundation).approve(ledgerContract.address, foundationAmount.value);
        await tx2.wait();
        const tx3 = await ledgerContract.connect(foundation).deposit(foundationAmount.value);
        await tx3.wait();
    }

    private static async addShopData(deployer: Wallet, certifier: Wallet, shopCollection: Shop) {
        for (const shop of shopData) {
            const nonce = await shopCollection.nonceOf(shop.address);
            const signature = await ContractUtils.signShop(new Wallet(shop.privateKey), shop.shopId, nonce);
            await (await shopCollection.connect(deployer).add(shop.shopId, shop.name, shop.address, signature)).wait();
        }

        for (const shop of shopData) {
            const signature1 = ContractUtils.signShop(
                new Wallet(shop.privateKey),
                shop.shopId,
                await shopCollection.nonceOf(shop.address)
            );
            await (
                await shopCollection
                    .connect(certifier)
                    .update(shop.shopId, shop.name, shop.provideWaitTime, shop.providePercent, shop.address, signature1)
            ).wait();
        }

        for (const shop of shopData) {
            const signature1 = ContractUtils.signShop(
                new Wallet(shop.privateKey),
                shop.shopId,
                await shopCollection.nonceOf(shop.address)
            );
            await (
                await shopCollection
                    .connect(certifier)
                    .changeStatus(shop.shopId, ContractShopStatus.ACTIVE, shop.address, signature1)
            ).wait();
        }
    }
}
