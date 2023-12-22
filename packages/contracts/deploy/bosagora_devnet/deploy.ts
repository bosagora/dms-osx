import "@nomiclabs/hardhat-ethers";
import "@nomiclabs/hardhat-waffle";
import "@openzeppelin/hardhat-upgrades";
import { ethers, upgrades } from "hardhat";

import { HardhatAccount } from "../../src/HardhatAccount";
import { Amount } from "../../src/utils/Amount";
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

import { BaseContract, BigNumber, Contract, Wallet } from "ethers";

import fs from "fs";

const network = "bosagora_devnet";

export const PHONE_LINK_COLLECTION_ADDRESSES: { [key: string]: string } = {
    bosagora_mainnet: "0xaE7018CaF086EB2Ca62eAA7b91B61dDA6b046F70",
    bosagora_testnet: "0xaE7018CaF086EB2Ca62eAA7b91B61dDA6b046F70",
    bosagora_devnet: "0xaE7018CaF086EB2Ca62eAA7b91B61dDA6b046F70",
};

interface IDeployedContract {
    name: string;
    address: string;
    contract: BaseContract;
}

interface IAccount {
    deployer: Wallet;
    owner: Wallet;
    certifier: Wallet;
    foundation: Wallet;
    settlements: Wallet;
    fee: Wallet;
    validators: Wallet[];
    linkValidators: Wallet[];
    certifiers: Wallet[];
}

type FnDeployer = (accounts: IAccount, deployment: Deployments) => void;

class Deployments {
    public deployments: Map<string, IDeployedContract>;
    public deployers: FnDeployer[];
    public accounts: IAccount;

    private PHONE_LINK_COLLECTION_CONTRACT: Contract | undefined;

    constructor() {
        this.deployments = new Map<string, IDeployedContract>();
        this.deployers = [];

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
        };
        (async () => {
            const factory = await ethers.getContractFactory("PhoneLinkCollection");
            this.PHONE_LINK_COLLECTION_CONTRACT = factory.attach(
                PHONE_LINK_COLLECTION_ADDRESSES[network]
            ) as BaseContract;
        })();
    }

    public addContract(name: string, address: string, contract: BaseContract) {
        this.deployments.set(name, {
            name,
            address,
            contract,
        });
    }

    public getContract(name: string): BaseContract | undefined {
        if (name === "PhoneLinkCollection") {
            return this.PHONE_LINK_COLLECTION_CONTRACT;
        }
        const info = this.deployments.get(name);
        if (info !== undefined) {
            return info.contract;
        } else {
            return undefined;
        }
    }

    public getContractAddress(name: string): string | undefined {
        if (name === "PhoneLinkCollection") {
            return PHONE_LINK_COLLECTION_ADDRESSES[network];
        }
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

    static filename = "./deploy/bosagora_devnet/deployed_contracts.json";

    public async loadContractInfo() {
        if (!fs.existsSync(Deployments.filename)) return;

        const data: any = JSON.parse(fs.readFileSync(Deployments.filename, "utf-8"));

        for (const key of Object.keys(data)) {
            const name = key;
            const address = data[key];
            console.log(`Load ${name} - ${address}...`);
            this.deployments.set(key, {
                name,
                address,
                contract: (await ethers.getContractFactory(name)).attach(address),
            });
        }
    }

    public saveContractInfo() {
        const contents: any = {};
        for (const key of this.deployments.keys()) {
            const item = this.deployments.get(key);
            if (item !== undefined) {
                contents[key] = item.address;
            }
        }
        fs.writeFileSync(Deployments.filename, JSON.stringify(contents), "utf-8");
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

        const users = JSON.parse(fs.readFileSync("./deploy/data/users.json", "utf8"));
        const addresses = users.map((m: { address: string }) => m.address);
        const userAmount = Amount.make(200_000, 18);
        const tx2 = await contract.connect(accounts.owner).multiTransfer(addresses, userAmount.value);
        console.log(`Transfer token to users (tx: ${tx2.hash})...`);
        await tx2.wait();

        const users_mobile = JSON.parse(fs.readFileSync("./deploy/data/users_mobile.json", "utf8"));
        const addresses_mobile = users_mobile.map((m: { address: string }) => m.address);
        const tx3 = await contract.connect(accounts.owner).multiTransfer(addresses_mobile, userAmount.value);
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
        const multiple = BigNumber.from(1000000000);
        let price = BigNumber.from(150).mul(multiple);
        let tx1 = await contract.connect(accounts.validators[0]).set("the9", price);
        console.log(`Set token price (tx: ${tx1.hash})...`);
        await tx1.wait();

        price = BigNumber.from(1000).mul(multiple);
        tx1 = await contract.connect(accounts.validators[0]).set("usd", price);
        console.log(`Set token price (tx: ${tx1.hash})...`);
        await tx1.wait();

        price = BigNumber.from(10).mul(multiple);
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
        interface IShopData {
            shopId: string;
            name: string;
            currency: string;
            address: string;
            privateKey: string;
        }
        const shopData: IShopData[] = JSON.parse(fs.readFileSync("./deploy/data/shops.json", "utf8"));

        for (const shop of shopData) {
            const nonce = await contract.nonceOf(shop.address);
            const signature = await ContractUtils.signShop(
                new Wallet(shop.privateKey, ethers.provider),
                shop.shopId,
                nonce
            );
            const tx = await contract
                .connect(new Wallet(shop.privateKey, ethers.provider))
                .add(shop.shopId, shop.name, shop.currency, shop.address, signature);
            console.log(`Add shop data (tx: ${tx.hash})...`);
            await tx.wait();
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

        const users = JSON.parse(fs.readFileSync("./deploy/data/users.json", "utf8"));
        for (const user of users) {
            if (user.loyaltyType === 1) {
                const signer = new Wallet(user.privateKey).connect(ethers.provider);
                const nonce = await contract.nonceOf(user.address);
                const signature = await ContractUtils.signLoyaltyType(signer, nonce);
                const tx10 = await (deployment.getContract("LoyaltyExchanger") as LoyaltyExchanger)
                    .connect(signer)
                    .changeToLoyaltyToken(user.address, signature);
                console.log(`Deposit user's amount (tx: ${tx10.hash})...`);
                await tx10.wait();

                if (
                    (await (deployment.getContract("Ledger") as Ledger).connect(signer).loyaltyTypeOf(user.address)) ===
                    1
                ) {
                    console.log(`Success changeToLoyaltyToken...`);
                } else {
                    console.error(`Fail changeToLoyaltyToken...`);
                }

                const balance = await (deployment.getContract("Token") as Token).balanceOf(user.address);
                const depositedToken = balance.div(2);
                const tx8 = await (deployment.getContract("Token") as Token)
                    .connect(signer)
                    .approve((deployment.getContract("Ledger") as Ledger).address, depositedToken);
                console.log(`Approve user's amount (tx: ${tx8.hash})...`);
                await tx8.wait();

                const tx9 = await (deployment.getContract("Ledger") as Ledger).connect(signer).deposit(depositedToken);
                console.log(`Deposit user's amount (tx: ${tx9.hash})...`);
                await tx9.wait();
            }
        }

        const linkContract = deployment.getContract("PhoneLinkCollection") as PhoneLinkCollection;

        const users_mobile = JSON.parse(fs.readFileSync("./deploy/data/users_mobile.json", "utf8"));
        for (const user of users_mobile) {
            const userAccount = ContractUtils.getPhoneHash(user.phone);
            if ((await linkContract.toAddress(userAccount)) !== user.address) {
                const userNonce = await linkContract.nonceOf(user.address);
                const userSignature = await ContractUtils.signRequestHash(
                    new Wallet(user.privateKey),
                    userAccount,
                    userNonce
                );
                const reqId2 = ContractUtils.getRequestId(userAccount, user.address, userNonce);
                const tx14 = await linkContract
                    .connect(accounts.linkValidators[0])
                    .addRequest(reqId2, userAccount, user.address, userSignature);
                console.log(`Add phone-address of user (tx: ${tx14.hash})...`);
                await tx14.wait();

                const tx15 = await linkContract.connect(accounts.linkValidators[1]).voteRequest(reqId2);
                console.log(`Vote of validator1 (tx: ${tx15.hash})...`);
                await tx15.wait();

                const tx6 = await linkContract.connect(accounts.linkValidators[2]).voteRequest(reqId2);
                console.log(`Vote of validator2 (tx: ${tx6.hash})...`);
                await tx6.wait();

                const tx7 = await linkContract.connect(accounts.linkValidators[0]).countVote(reqId2);
                console.log(`Count of vote (tx: ${tx7.hash})...`);
                await tx7.wait();

                if ((await linkContract.toAddress(userAccount)) === user.address) {
                    console.log(`Success ${user.address}`);
                } else {
                    console.log(`Fail ${user.address}`);
                }
            }
        }

        for (const user of users_mobile) {
            if (user.loyaltyType === 1) {
                const signer = new Wallet(user.privateKey).connect(ethers.provider);
                const nonce = await (deployment.getContract("Ledger") as Ledger).nonceOf(user.address);
                const signature = await ContractUtils.signLoyaltyType(signer, nonce);
                const tx10 = await (deployment.getContract("LoyaltyExchanger") as LoyaltyExchanger)
                    .connect(signer)
                    .changeToLoyaltyToken(user.address, signature);
                console.log(`Deposit user's amount (tx: ${tx10.hash})...`);
                await tx10.wait();

                if (
                    (await (deployment.getContract("Ledger") as Ledger).connect(signer).loyaltyTypeOf(user.address)) ===
                    1
                ) {
                    console.log(`Success changeToLoyaltyToken...`);
                } else {
                    console.error(`Fail changeToLoyaltyToken...`);
                }

                const balance = await (deployment.getContract("Token") as Token).balanceOf(user.address);
                const depositedToken = balance.div(2);
                const tx8 = await (deployment.getContract("Token") as Token)
                    .connect(signer)
                    .approve((deployment.getContract("Ledger") as Ledger).address, depositedToken);
                console.log(`Approve user's amount (tx: ${tx8.hash})...`);
                await tx8.wait();

                const tx9 = await (deployment.getContract("Ledger") as Ledger).connect(signer).deposit(depositedToken);
                console.log(`Deposit user's amount (tx: ${tx9.hash})...`);
                await tx9.wait();
            }
        }
    }
}

async function main() {
    const deployments = new Deployments();

    // deployments.addDeployer(deployPhoneLink);
    deployments.addDeployer(deployToken);
    deployments.addDeployer(deployValidator);
    deployments.addDeployer(deployCurrencyRate);
    deployments.addDeployer(deployCertifier);
    deployments.addDeployer(deployLoyaltyProvider);
    deployments.addDeployer(deployLoyaltyConsumer);
    deployments.addDeployer(deployLoyaltyExchanger);
    deployments.addDeployer(deployShop);
    deployments.addDeployer(deployLedger);

    await deployments.loadContractInfo();

    await deployments.doDeploy();

    deployments.saveContractInfo();
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
