import "@nomiclabs/hardhat-ethers";
import "@nomiclabs/hardhat-waffle";
import "@openzeppelin/hardhat-upgrades";
import { ethers, upgrades } from "hardhat";

import { BaseContract, BigNumber, Wallet } from "ethers";

import { Amount } from "../../src/common/Amount";
import { HardhatAccount } from "../../src/HardhatAccount";
import { ContractShopStatus } from "../../src/types";
import { ContractUtils } from "../../src/utils/ContractUtils";
import {
    Certifier,
    CurrencyRate,
    Ledger,
    LoyaltyConsumer,
    LoyaltyExchanger,
    LoyaltyProvider,
    PhoneLinkCollection,
    Shop,
    Token,
    Validator,
} from "../../typechain-types";

interface IShopData {
    shopId: string;
    name: string;
    currency: string;
    provideWaitTime: number;
    providePercent: number;
    wallet: Wallet;
}

interface IDeployedContract {
    name: string;
    address: string;
    contract: BaseContract;
}

export interface IAccount {
    deployer: Wallet;
    owner: Wallet;
    certifier: Wallet;
    foundation: Wallet;
    settlements: Wallet;
    fee: Wallet;
    validators: Wallet[];
    linkValidators: Wallet[];
    certifiers: Wallet[];
    users: Wallet[];
    shops: Wallet[];
}

type FnDeployer = (accounts: IAccount, deployment: Deployments) => void;

export class Deployments {
    public deployments: Map<string, IDeployedContract>;
    public deployers: FnDeployer[];
    public accounts: IAccount;
    public shops: IShopData[];

    constructor() {
        this.deployments = new Map<string, IDeployedContract>();
        this.deployers = [];
        this.shops = [];

        const raws = HardhatAccount.keys.map((m) => new Wallet(m, ethers.provider));
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
            linkValidator1,
            linkValidator2,
            linkValidator3,
            user01,
            user02,
            user03,
            user04,
            user05,
            user06,
            user07,
            user08,
            user09,
            user10,
            shop01,
            shop02,
            shop03,
            shop04,
            shop05,
            shop06,
            shop07,
            shop08,
            shop09,
            shop10,
        ] = raws;

        this.accounts = {
            deployer,
            owner,
            certifier,
            foundation,
            settlements,
            fee,
            validators: [validator1, validator2, validator3, validator4, validator5],
            linkValidators: [linkValidator1, linkValidator2, linkValidator3],
            certifiers: [
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
            ],
            users: [user01, user02, user03, user04, user05, user06, user07, user08, user09, user10],
            shops: [shop01, shop02, shop03, shop04, shop05, shop06, shop07, shop08, shop09, shop10],
        };

        this.addDeployer(deployPhoneLink);
        this.addDeployer(deployPhoneLink);
        this.addDeployer(deployToken);
        this.addDeployer(deployValidator);
        this.addDeployer(deployCurrencyRate);
        this.addDeployer(deployCertifier);
        this.addDeployer(deployLoyaltyProvider);
        this.addDeployer(deployLoyaltyConsumer);
        this.addDeployer(deployLoyaltyExchanger);
        this.addDeployer(deployShop);
        this.addDeployer(deployLedger);
    }

    public setShopData(shopData: IShopData[]) {
        this.shops = [];
        this.shops.push(...shopData);
    }

    public addContract(name: string, address: string, contract: BaseContract) {
        this.deployments.set(name, {
            name,
            address,
            contract,
        });
    }

    public getContract(name: string): BaseContract | undefined {
        const info = this.deployments.get(name);
        if (info !== undefined) {
            return info.contract;
        } else {
            return undefined;
        }
    }

    public getContractAddress(name: string): string | undefined {
        const info = this.deployments.get(name);
        if (info !== undefined) {
            return info.address;
        } else {
            return undefined;
        }
    }

    public addDeployer(deployer: FnDeployer) {
        this.deployers.push(deployer);
    }

    public async doDeploy() {
        for (const elem of this.deployers) {
            try {
                await elem(this.accounts, this);
            } catch (error) {
                console.log(error);
            }
        }
    }
}

async function deployPhoneLink(accounts: IAccount, deployment: Deployments) {
    const contractName = "PhoneLinkCollection";
    console.log(`Deploy ${contractName}...`);
    const factory = await ethers.getContractFactory("PhoneLinkCollection");
    const contract = (await upgrades.deployProxy(
        factory.connect(accounts.deployer),
        [accounts.linkValidators.map((m) => m.address)],
        {
            initializer: "initialize",
            kind: "uups",
        }
    )) as PhoneLinkCollection;
    await contract.deployed();
    await contract.deployTransaction.wait();
    deployment.addContract(contractName, contract.address, contract);
    console.log(`Deployed ${contractName} to ${contract.address}`);
}

async function deployToken(accounts: IAccount, deployment: Deployments) {
    const contractName = "Token";
    console.log(`Deploy ${contractName}...`);
    const factory = await ethers.getContractFactory("Token");
    const contract = (await factory
        .connect(accounts.deployer)
        .deploy(accounts.owner.address, "Sample", "the9")) as Token;
    await contract.deployed();
    await contract.deployTransaction.wait();

    deployment.addContract(contractName, contract.address, contract);
    console.log(`Deployed ${contractName} to ${contract.address}`);

    {
        const assetAmount = Amount.make(100_000_000, 18);
        const tx1 = await contract.connect(accounts.owner).transfer(accounts.foundation.address, assetAmount.value);
        console.log(`Transfer token to foundation (tx: ${tx1.hash})...`);
        await tx1.wait();

        const addresses = accounts.users.map((m: { address: string }) => m.address);
        const userAmount = Amount.make(200_000, 18);
        const tx2 = await contract.connect(accounts.owner).multiTransfer(addresses, userAmount.value);
        console.log(`Transfer token to users (tx: ${tx2.hash})...`);
        await tx2.wait();

        const addresses2 = accounts.shops.map((m: { address: string }) => m.address);
        const tx3 = await contract.connect(accounts.owner).multiTransfer(addresses2, userAmount.value);
        console.log(`Transfer token to users (tx: ${tx3.hash})...`);
        await tx3.wait();
    }
}

async function deployValidator(accounts: IAccount, deployment: Deployments) {
    const contractName = "Validator";
    console.log(`Deploy ${contractName}...`);
    if (deployment.getContract("Token") === undefined) {
        console.error("Contract is not deployed!");
        return;
    }

    const factory = await ethers.getContractFactory("Validator");
    const contract = (await upgrades.deployProxy(
        factory.connect(accounts.deployer),
        [await deployment.getContractAddress("Token"), accounts.validators.map((m) => m.address)],
        {
            initializer: "initialize",
            kind: "uups",
        }
    )) as Validator;
    await contract.deployed();
    await contract.deployTransaction.wait();
    deployment.addContract(contractName, contract.address, contract);
    console.log(`Deployed ${contractName} to ${contract.address}`);

    {
        const amount = Amount.make(100_000, 18);
        const depositedToken = Amount.make(20_000, 18);

        for (const elem of accounts.validators) {
            const tx1 = await (deployment.getContract("Token") as Token)
                .connect(accounts.owner)
                .transfer(elem.address, amount.value);
            console.log(`Transfer token to validator (tx: ${tx1.hash})...`);
            await tx1.wait();

            const tx2 = await (deployment.getContract("Token") as Token)
                .connect(elem)
                .approve(contract.address, depositedToken.value);
            console.log(`Approve validator's amount (tx: ${tx2.hash})...`);
            await tx2.wait();

            const tx3 = await contract.connect(elem).deposit(depositedToken.value);
            console.log(`Deposit validator's amount (tx: ${tx3.hash})...`);
            await tx3.wait();
        }
    }
}

async function deployCurrencyRate(accounts: IAccount, deployment: Deployments) {
    const contractName = "CurrencyRate";
    console.log(`Deploy ${contractName}...`);
    if (deployment.getContract("Validator") === undefined || deployment.getContract("Token") === undefined) {
        console.error("Contract is not deployed!");
        return;
    }

    const factory = await ethers.getContractFactory("CurrencyRate");
    const contract = (await upgrades.deployProxy(
        factory.connect(accounts.deployer),
        [await deployment.getContractAddress("Validator"), await (deployment.getContract("Token") as Token).symbol()],
        {
            initializer: "initialize",
            kind: "uups",
        }
    )) as CurrencyRate;
    await contract.deployed();
    await contract.deployTransaction.wait();
    deployment.addContract(contractName, contract.address, contract);
    console.log(`Deployed ${contractName} to ${contract.address}`);

    {
        const multiple = await contract.multiple();
        let price = BigNumber.from(150).mul(multiple);
        let tx1 = await contract.connect(accounts.validators[0]).set("the9", price);
        console.log(`Set token price (tx: ${tx1.hash})...`);
        await tx1.wait();

        price = BigNumber.from(1000).mul(multiple);
        tx1 = await contract.connect(accounts.validators[0]).set("usd", price);
        console.log(`Set token price (tx: ${tx1.hash})...`);
        await tx1.wait();

        price = BigNumber.from(100).mul(multiple);
        tx1 = await contract.connect(accounts.validators[0]).set("jpy", price);
        console.log(`Set token price (tx: ${tx1.hash})...`);
        await tx1.wait();

        price = BigNumber.from(1).mul(multiple);
        tx1 = await contract.connect(accounts.validators[0]).set("krw", price);
        console.log(`Set token price (tx: ${tx1.hash})...`);
        await tx1.wait();

        price = BigNumber.from(1).mul(multiple);
        tx1 = await contract.connect(accounts.validators[0]).set("point", price);
        console.log(`Set token price (tx: ${tx1.hash})...`);
        await tx1.wait();
    }
}

async function deployCertifier(accounts: IAccount, deployment: Deployments) {
    const contractName = "Certifier";
    console.log(`Deploy ${contractName}...`);
    const factory = await ethers.getContractFactory("Certifier");
    const contract = (await upgrades.deployProxy(factory.connect(accounts.deployer), [accounts.certifier.address], {
        initializer: "initialize",
        kind: "uups",
    })) as Certifier;
    await contract.deployed();
    await contract.deployTransaction.wait();
    deployment.addContract(contractName, contract.address, contract);
    console.log(`Deployed ${contractName} to ${contract.address}`);

    {
        for (const elem of accounts.certifiers) {
            const tx = await contract.connect(accounts.certifier).grantCertifier(elem.address);
            console.log(`Grant Certifier (tx: ${tx.hash})...`);
            await tx.wait();
        }
    }
}

async function deployLoyaltyProvider(accounts: IAccount, deployment: Deployments) {
    const contractName = "LoyaltyProvider";
    console.log(`Deploy ${contractName}...`);
    if (
        deployment.getContract("Validator") === undefined ||
        deployment.getContract("PhoneLinkCollection") === undefined ||
        deployment.getContract("CurrencyRate") === undefined
    ) {
        console.error("Contract is not deployed!");
        return;
    }

    const factory = await ethers.getContractFactory("LoyaltyProvider");
    const contract = (await upgrades.deployProxy(
        factory.connect(accounts.deployer),
        [
            await deployment.getContractAddress("Validator"),
            await deployment.getContractAddress("PhoneLinkCollection"),
            await deployment.getContractAddress("CurrencyRate"),
        ],
        {
            initializer: "initialize",
            kind: "uups",
        }
    )) as LoyaltyProvider;
    await contract.deployed();
    await contract.deployTransaction.wait();
    deployment.addContract(contractName, contract.address, contract);
    console.log(`Deployed ${contractName} to ${contract.address}`);
}

async function deployLoyaltyConsumer(accounts: IAccount, deployment: Deployments) {
    const contractName = "LoyaltyConsumer";
    console.log(`Deploy ${contractName}...`);
    if (deployment.getContract("Certifier") === undefined || deployment.getContract("CurrencyRate") === undefined) {
        console.error("Contract is not deployed!");
        return;
    }

    const factory = await ethers.getContractFactory("LoyaltyConsumer");
    const contract = (await upgrades.deployProxy(
        factory.connect(accounts.deployer),
        [await deployment.getContractAddress("Certifier"), await deployment.getContractAddress("CurrencyRate")],
        {
            initializer: "initialize",
            kind: "uups",
        }
    )) as LoyaltyConsumer;
    await contract.deployed();
    await contract.deployTransaction.wait();
    deployment.addContract(contractName, contract.address, contract);
    console.log(`Deployed ${contractName} to ${contract.address}`);
}

async function deployLoyaltyExchanger(accounts: IAccount, deployment: Deployments) {
    const contractName = "LoyaltyExchanger";
    console.log(`Deploy ${contractName}...`);
    if (
        deployment.getContract("PhoneLinkCollection") === undefined ||
        deployment.getContract("CurrencyRate") === undefined
    ) {
        console.error("Contract is not deployed!");
        return;
    }

    const factory = await ethers.getContractFactory("LoyaltyExchanger");
    const contract = (await upgrades.deployProxy(
        factory.connect(accounts.deployer),
        [
            await deployment.getContractAddress("PhoneLinkCollection"),
            await deployment.getContractAddress("CurrencyRate"),
        ],
        {
            initializer: "initialize",
            kind: "uups",
        }
    )) as LoyaltyExchanger;
    await contract.deployed();
    await contract.deployTransaction.wait();
    deployment.addContract(contractName, contract.address, contract);
    console.log(`Deployed ${contractName} to ${contract.address}`);
}

async function deployShop(accounts: IAccount, deployment: Deployments) {
    const contractName = "Shop";
    console.log(`Deploy ${contractName}...`);
    if (
        deployment.getContract("Certifier") === undefined ||
        deployment.getContract("CurrencyRate") === undefined ||
        deployment.getContract("LoyaltyProvider") === undefined ||
        deployment.getContract("LoyaltyConsumer") === undefined
    ) {
        console.error("Contract is not deployed!");
        return;
    }

    const factory = await ethers.getContractFactory("Shop");
    const contract = (await upgrades.deployProxy(
        factory.connect(accounts.deployer),
        [
            await deployment.getContractAddress("Certifier"),
            await deployment.getContractAddress("CurrencyRate"),
            await deployment.getContractAddress("LoyaltyProvider"),
            await deployment.getContractAddress("LoyaltyConsumer"),
        ],
        {
            initializer: "initialize",
            kind: "uups",
        }
    )) as Shop;
    await contract.deployed();
    await contract.deployTransaction.wait();
    deployment.addContract(contractName, contract.address, contract);

    const tx1 = await (deployment.getContract("LoyaltyProvider") as LoyaltyProvider)
        .connect(accounts.deployer)
        .setShop(contract.address);
    console.log(`Set address of LoyaltyProvider (tx: ${tx1.hash})...`);
    await tx1.wait();

    const tx2 = await (deployment.getContract("LoyaltyConsumer") as LoyaltyConsumer)
        .connect(accounts.deployer)
        .setShop(contract.address);
    console.log(`Set address of LoyaltyConsumer (tx: ${tx2.hash})...`);
    await tx2.wait();

    console.log(`Deployed ${contractName} to ${contract.address}`);

    {
        for (const shop of deployment.shops) {
            const nonce = await contract.nonceOf(shop.wallet.address);
            const signature = await ContractUtils.signShop(shop.wallet, shop.shopId, nonce);
            const tx3 = await contract
                .connect(shop.wallet)
                .add(shop.shopId, shop.name, shop.currency, shop.wallet.address, signature);
            console.log(`Add shop data (tx: ${tx3.hash})...`);
            await tx3.wait();

            const signature1 = await ContractUtils.signShop(
                shop.wallet,
                shop.shopId,
                await contract.nonceOf(shop.wallet.address)
            );
            const tx4 = await contract
                .connect(accounts.certifier)
                .update(
                    shop.shopId,
                    shop.name,
                    shop.currency,
                    shop.provideWaitTime,
                    shop.providePercent,
                    shop.wallet.address,
                    signature1
                );
            console.log(`Update shop data (tx: ${tx4.hash})...`);
            await tx4.wait();

            const signature3 = await ContractUtils.signShop(
                shop.wallet,
                shop.shopId,
                await contract.nonceOf(shop.wallet.address)
            );
            const tx5 = await contract
                .connect(accounts.certifier)
                .changeStatus(shop.shopId, ContractShopStatus.ACTIVE, shop.wallet.address, signature3);
            console.log(`Change shop status (tx: ${tx5.hash})...`);
            await tx5.wait();
        }
    }
}

async function deployLedger(accounts: IAccount, deployment: Deployments) {
    const contractName = "Ledger";
    console.log(`Deploy ${contractName}...`);
    if (
        deployment.getContract("Token") === undefined ||
        deployment.getContract("PhoneLinkCollection") === undefined ||
        deployment.getContract("CurrencyRate") === undefined ||
        deployment.getContract("LoyaltyProvider") === undefined ||
        deployment.getContract("LoyaltyConsumer") === undefined ||
        deployment.getContract("LoyaltyExchanger") === undefined
    ) {
        console.error("Contract is not deployed!");
        return;
    }

    const factory = await ethers.getContractFactory("Ledger");
    const contract = (await upgrades.deployProxy(
        factory.connect(accounts.deployer),
        [
            accounts.foundation.address,
            accounts.settlements.address,
            accounts.fee.address,
            await deployment.getContractAddress("Token"),
            await deployment.getContractAddress("PhoneLinkCollection"),
            await deployment.getContractAddress("CurrencyRate"),
            await deployment.getContractAddress("LoyaltyProvider"),
            await deployment.getContractAddress("LoyaltyConsumer"),
            await deployment.getContractAddress("LoyaltyExchanger"),
        ],
        {
            initializer: "initialize",
            kind: "uups",
        }
    )) as Ledger;
    await contract.deployed();
    await contract.deployTransaction.wait();
    deployment.addContract(contractName, contract.address, contract);

    const tx1 = await (deployment.getContract("LoyaltyProvider") as LoyaltyProvider)
        .connect(accounts.deployer)
        .setLedger(contract.address);
    console.log(`Set address of LoyaltyProvider (tx: ${tx1.hash})...`);
    await tx1.wait();

    const tx2 = await (deployment.getContract("LoyaltyConsumer") as LoyaltyConsumer)
        .connect(accounts.deployer)
        .setLedger(contract.address);
    console.log(`Set address of LoyaltyConsumer (tx: ${tx2.hash})...`);
    await tx2.wait();

    const tx3 = await (deployment.getContract("LoyaltyExchanger") as LoyaltyExchanger)
        .connect(accounts.deployer)
        .setLedger(contract.address);
    console.log(`Set address of LoyaltyExchanger (tx: ${tx3.hash})...`);
    await tx3.wait();

    console.log(`Deployed ${contractName} to ${contract.address}`);

    {
        const assetAmount = Amount.make(100_000_000, 18);
        const tx4 = await (deployment.getContract("Token") as Token)
            .connect(accounts.foundation)
            .approve(contract.address, assetAmount.value);
        console.log(`Approve foundation's amount (tx: ${tx4.hash})...`);
        await tx4.wait();

        const tx5 = await contract.connect(accounts.foundation).deposit(assetAmount.value);
        console.log(`Deposit foundation's amount (tx: ${tx5.hash})...`);
        await tx5.wait();
    }
}
