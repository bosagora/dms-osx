import "@nomiclabs/hardhat-ethers";
import "@nomiclabs/hardhat-waffle";
import "@openzeppelin/hardhat-upgrades";
import { ethers, upgrades } from "hardhat";

import { BaseContract, Wallet } from "ethers";

import { HardhatAccount } from "../../src/HardhatAccount";
import { Amount, BOACoin } from "../../src/utils/Amount";
import { ContractUtils } from "../../src/utils/ContractUtils";

import {
    Bridge,
    BridgeValidator,
    CurrencyRate,
    Ledger,
    LoyaltyBridge,
    LoyaltyBurner,
    LoyaltyConsumer,
    LoyaltyExchanger,
    LoyaltyProvider,
    LoyaltyTransfer,
    PhoneLinkCollection,
    Shop,
    TestLYT,
    Validator,
} from "../../typechain-types";

interface IShopData {
    shopId: string;
    name: string;
    currency: string;
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
    foundation: Wallet;
    settlement: Wallet;
    fee: Wallet;
    txFee: Wallet;
    validators: Wallet[];
    linkValidators: Wallet[];
    bridgeValidators: Wallet[];
    certifiers: Wallet[];
    purchaseManager: Wallet;
    users: Wallet[];
    shops: Wallet[];
    tokenOwners: Wallet[];
    tokenRequire: number;
}

type FnDeployer = (accounts: IAccount, deployment: Deployments) => void;

export class Deployments {
    public deployments: Map<string, IDeployedContract>;
    public accounts: IAccount;
    public shops: IShopData[];

    constructor() {
        this.deployments = new Map<string, IDeployedContract>();
        this.shops = [];

        const raws = HardhatAccount.keys.map((m) => new Wallet(m, ethers.provider));
        const [
            deployer,
            owner,
            foundation,
            settlement,
            fee,
            txFee,
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
            validator01,
            validator02,
            validator03,
            validator04,
            validator05,
            validator06,
            validator07,
            validator08,
            validator09,
            validator10,
            validator11,
            validator12,
            validator13,
            validator14,
            validator15,
            validator16,
            linkValidator1,
            linkValidator2,
            linkValidator3,
            bridgeValidator1,
            bridgeValidator2,
            bridgeValidator3,
            bridgeValidator4,
            bridgeValidator5,
            purchaseManager,
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
            foundation,
            settlement,
            fee,
            txFee,
            validators: [validator01, validator02, validator03],
            linkValidators: [bridgeValidator1],
            bridgeValidators: [validator04, validator05, validator06],
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
            purchaseManager,
            users: [user01, user02, user03, user04, user05, user06, user07, user08, user09, user10],
            shops: [shop01, shop02, shop03, shop04, shop05, shop06, shop07, shop08, shop09, shop10],

            tokenOwners: [certifier01, certifier02, certifier03],
            tokenRequire: 2,
        };
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

    public async doDeployAll() {
        const deployers: FnDeployer[] = [
            deployToken,
            deployPhoneLink,
            deployValidator,
            deployCurrencyRate,
            deployLoyaltyProvider,
            deployLoyaltyConsumer,
            deployLoyaltyExchanger,
            deployLoyaltyBurner,
            deployLoyaltyTransfer,
            deployBridgeValidator,
            deployBridge,
            deployLoyaltyBridge,
            deployShop,
            deployLedger,
        ];
        for (const elem of deployers) {
            try {
                await elem(this.accounts, this);
            } catch (error) {
                console.log(error);
            }
        }
    }

    public async doDeployToken() {
        const deployers: FnDeployer[] = [deployToken];
        for (const elem of deployers) {
            try {
                await elem(this.accounts, this);
            } catch (error) {
                console.log(error);
            }
        }
    }

    public async doDeployValidator() {
        const deployers: FnDeployer[] = [deployToken, deployPhoneLink, deployValidator];
        for (const elem of deployers) {
            try {
                await elem(this.accounts, this);
            } catch (error) {
                console.log(error);
            }
        }
    }

    public async doDeployCurrencyRate() {
        const deployers: FnDeployer[] = [deployToken, deployPhoneLink, deployValidator, deployCurrencyRate];
        for (const elem of deployers) {
            try {
                await elem(this.accounts, this);
            } catch (error) {
                console.log(error);
            }
        }
    }

    public async doDeployShop() {
        const deployers: FnDeployer[] = [
            deployToken,
            deployPhoneLink,
            deployValidator,
            deployCurrencyRate,
            deployLoyaltyProvider,
            deployLoyaltyConsumer,
            deployShop,
        ];
        for (const elem of deployers) {
            try {
                await elem(this.accounts, this);
            } catch (error) {
                console.log(error);
            }
        }
    }

    public async doDeployLedger() {
        const deployers: FnDeployer[] = [
            deployToken,
            deployPhoneLink,
            deployValidator,
            deployCurrencyRate,
            deployLoyaltyProvider,
            deployLoyaltyConsumer,
            deployLoyaltyExchanger,
            deployLoyaltyBurner,
            deployLoyaltyTransfer,
            deployBridgeValidator,
            deployBridge,
            deployLoyaltyBridge,
            deployShop,
            deployLedger,
        ];
        for (const elem of deployers) {
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
    const contractName = "TestLYT";
    console.log(`Deploy ${contractName}...`);

    const factory = await ethers.getContractFactory("TestLYT");
    const contract = (await factory.connect(accounts.deployer).deploy(accounts.owner.address)) as TestLYT;
    await contract.deployed();
    await contract.deployTransaction.wait();

    const balance = await contract.balanceOf(accounts.owner.address);
    console.log(`TestLYT token's owner: ${accounts.owner.address}`);
    console.log(`TestLYT token's balance of owner: ${new BOACoin(balance).toDisplayString(true, 2)}`);

    deployment.addContract(contractName, contract.address, contract);
    console.log(`Deployed ${contractName} to ${contract.address}`);

    {
        const assetAmount = Amount.make(7_000_000_000, 18);
        const tx1 = await contract.connect(accounts.owner).transfer(accounts.foundation.address, assetAmount.value);
        console.log(`Transfer token to foundation (tx: ${tx1.hash})...`);
        await tx1.wait();

        const userAmount = Amount.make(200_000, 18);
        const tx2 = await contract.connect(accounts.owner).multiTransfer(
            accounts.users.map((m) => m.address),
            userAmount.value
        );
        console.log(`Transfer token to users (tx: ${tx2.hash})...`);
        await tx2.wait();

        const tx3 = await contract.connect(accounts.owner).multiTransfer(
            accounts.shops.map((m) => m.address),
            userAmount.value
        );
        console.log(`Transfer token to shops (tx: ${tx3.hash})...`);
        await tx3.wait();
    }
}

async function deployValidator(accounts: IAccount, deployment: Deployments) {
    const contractName = "Validator";
    console.log(`Deploy ${contractName}...`);
    if (deployment.getContract("TestLYT") === undefined) {
        console.error("Contract is not deployed!");
        return;
    }

    const factory = await ethers.getContractFactory("Validator");
    const contract = (await upgrades.deployProxy(
        factory.connect(accounts.deployer),
        [await deployment.getContractAddress("TestLYT"), accounts.validators.map((m) => m.address)],
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
        const amount = Amount.make(200_000, 18);
        const depositedToken = Amount.make(100_000, 18);

        for (const elem of accounts.validators) {
            const tx1 = await (deployment.getContract("TestLYT") as TestLYT)
                .connect(accounts.owner)
                .transfer(elem.address, amount.value);
            console.log(`Transfer token to validator (tx: ${tx1.hash})...`);
            await tx1.wait();

            const tx2 = await (deployment.getContract("TestLYT") as TestLYT)
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
    if (deployment.getContract("Validator") === undefined || deployment.getContract("TestLYT") === undefined) {
        console.error("Contract is not deployed!");
        return;
    }

    const factory = await ethers.getContractFactory("CurrencyRate");
    const contract = (await upgrades.deployProxy(
        factory.connect(accounts.deployer),
        [
            await deployment.getContractAddress("Validator"),
            await (deployment.getContract("TestLYT") as TestLYT).symbol(),
        ],
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
        const height = 0;
        const rates = [
            {
                symbol: "LYT",
                rate: multiple.mul(150),
            },
            {
                symbol: "krw",
                rate: multiple,
            },
            {
                symbol: "usd",
                rate: multiple.mul(1000),
            },
            {
                symbol: "jpy",
                rate: multiple.mul(10),
            },
        ];
        const message = ContractUtils.getCurrencyMessage(height, rates);
        const signatures = accounts.validators.map((m) => ContractUtils.signMessage(m, message));
        const tx1 = await contract.connect(accounts.validators[0]).set(height, rates, signatures);
        await tx1.wait();
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
    if (deployment.getContract("CurrencyRate") === undefined) {
        console.error("Contract is not deployed!");
        return;
    }

    const factory = await ethers.getContractFactory("LoyaltyConsumer");
    const contract = (await upgrades.deployProxy(
        factory.connect(accounts.deployer),
        [await deployment.getContractAddress("CurrencyRate")],
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

async function deployLoyaltyBurner(accounts: IAccount, deployment: Deployments) {
    const contractName = "LoyaltyBurner";
    console.log(`Deploy ${contractName}...`);
    if (
        deployment.getContract("Validator") === undefined ||
        deployment.getContract("PhoneLinkCollection") === undefined
    ) {
        console.error("Contract is not deployed!");
        return;
    }

    const factory = await ethers.getContractFactory("LoyaltyBurner");
    const contract = (await upgrades.deployProxy(
        factory.connect(accounts.deployer),
        [await deployment.getContractAddress("Validator"), await deployment.getContractAddress("PhoneLinkCollection")],
        {
            initializer: "initialize",
            kind: "uups",
        }
    )) as LoyaltyBurner;
    await contract.deployed();
    await contract.deployTransaction.wait();
    deployment.addContract(contractName, contract.address, contract);
    console.log(`Deployed ${contractName} to ${contract.address}`);
}

async function deployLoyaltyTransfer(accounts: IAccount, deployment: Deployments) {
    const contractName = "LoyaltyTransfer";
    console.log(`Deploy ${contractName}...`);

    const factory = await ethers.getContractFactory("LoyaltyTransfer");
    const contract = (await upgrades.deployProxy(factory.connect(accounts.deployer), [], {
        initializer: "initialize",
        kind: "uups",
    })) as LoyaltyTransfer;
    await contract.deployed();
    await contract.deployTransaction.wait();
    deployment.addContract(contractName, contract.address, contract);
    console.log(`Deployed ${contractName} to ${contract.address}`);
}

async function deployBridgeValidator(accounts: IAccount, deployment: Deployments) {
    const contractName = "BridgeValidator";
    console.log(`Deploy ${contractName}...`);

    const factory = await ethers.getContractFactory("BridgeValidator");
    const contract = (await upgrades.deployProxy(
        factory.connect(accounts.deployer),
        [accounts.bridgeValidators.map((m) => m.address), 2],
        {
            initializer: "initialize",
            kind: "uups",
        }
    )) as BridgeValidator;
    await contract.deployed();
    await contract.deployTransaction.wait();
    deployment.addContract(contractName, contract.address, contract);
    console.log(`Deployed ${contractName} to ${contract.address}`);
}

async function deployBridge(accounts: IAccount, deployment: Deployments) {
    const contractName = "Bridge";
    console.log(`Deploy ${contractName}...`);

    if (deployment.getContract("BridgeValidator") === undefined) {
        console.error("Contract is not deployed!");
        return;
    }
    const factory = await ethers.getContractFactory("Bridge");
    const contract = (await upgrades.deployProxy(
        factory.connect(accounts.deployer),
        [await deployment.getContractAddress("BridgeValidator"), accounts.txFee.address],
        {
            initializer: "initialize",
            kind: "uups",
        }
    )) as Bridge;
    await contract.deployed();
    await contract.deployTransaction.wait();
    deployment.addContract(contractName, contract.address, contract);
    console.log(`Deployed ${contractName} to ${contract.address}`);

    {
        const tokenContract = (await deployment.getContract("TestLYT")) as TestLYT;
        const tokenId = ContractUtils.getTokenId(await tokenContract.name(), await tokenContract.symbol());
        await contract.connect(accounts.deployer).registerToken(tokenId, tokenContract.address);
        const assetAmount = Amount.make(1_000_000_000, 18).value;
        const nonce = await tokenContract.nonceOf(accounts.owner.address);
        const message = ContractUtils.getTransferMessage(accounts.owner.address, contract.address, assetAmount, nonce);
        const signature = await ContractUtils.signMessage(accounts.owner, message);
        const tx1 = await contract.connect(accounts.owner).depositLiquidity(tokenId, assetAmount, signature);
        console.log(`Deposit liquidity token (tx: ${tx1.hash})...`);
        await tx1.wait();
    }
}

async function deployLoyaltyBridge(accounts: IAccount, deployment: Deployments) {
    const contractName = "LoyaltyBridge";
    console.log(`Deploy ${contractName}...`);
    if (deployment.getContract("BridgeValidator") === undefined) {
        console.error("Contract is not deployed!");
        return;
    }

    const factory = await ethers.getContractFactory("LoyaltyBridge");
    const contract = (await upgrades.deployProxy(
        factory.connect(accounts.deployer),
        [await deployment.getContractAddress("BridgeValidator")],
        {
            initializer: "initialize",
            kind: "uups",
        }
    )) as LoyaltyBridge;
    await contract.deployed();
    await contract.deployTransaction.wait();
    deployment.addContract(contractName, contract.address, contract);
    console.log(`Deployed ${contractName} to ${contract.address}`);
}

async function deployShop(accounts: IAccount, deployment: Deployments) {
    const contractName = "Shop";
    console.log(`Deploy ${contractName}...`);
    if (
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
            const message = ContractUtils.getShopAccountMessage(shop.shopId, shop.wallet.address, nonce);
            const signature = await ContractUtils.signMessage(shop.wallet, message);
            const tx3 = await contract
                .connect(shop.wallet)
                .add(shop.shopId, shop.name, shop.currency, shop.wallet.address, signature);
            console.log(`Add shop data (tx: ${tx3.hash})...`);
            await tx3.wait();
        }
    }
}

async function deployLedger(accounts: IAccount, deployment: Deployments) {
    const contractName = "Ledger";
    console.log(`Deploy ${contractName}...`);
    if (
        deployment.getContract("TestLYT") === undefined ||
        deployment.getContract("PhoneLinkCollection") === undefined ||
        deployment.getContract("CurrencyRate") === undefined ||
        deployment.getContract("LoyaltyProvider") === undefined ||
        deployment.getContract("LoyaltyConsumer") === undefined ||
        deployment.getContract("LoyaltyExchanger") === undefined ||
        deployment.getContract("LoyaltyBurner") === undefined ||
        deployment.getContract("LoyaltyTransfer") === undefined ||
        deployment.getContract("LoyaltyBridge") === undefined
    ) {
        console.error("Contract is not deployed!");
        return;
    }

    const factory = await ethers.getContractFactory("Ledger");

    const contract = (await upgrades.deployProxy(
        factory.connect(accounts.deployer),
        [
            {
                foundation: accounts.foundation.address,
                settlement: accounts.settlement.address,
                fee: accounts.fee.address,
                txFee: accounts.txFee.address,
            },
            {
                token: await deployment.getContractAddress("TestLYT"),
                phoneLink: await deployment.getContractAddress("PhoneLinkCollection"),
                currencyRate: await deployment.getContractAddress("CurrencyRate"),
                provider: await deployment.getContractAddress("LoyaltyProvider"),
                consumer: await deployment.getContractAddress("LoyaltyConsumer"),
                exchanger: await deployment.getContractAddress("LoyaltyExchanger"),
                burner: await deployment.getContractAddress("LoyaltyBurner"),
                transfer: await deployment.getContractAddress("LoyaltyTransfer"),
                bridge: await deployment.getContractAddress("LoyaltyBridge"),
            },
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

    const tx4 = await (deployment.getContract("LoyaltyBurner") as LoyaltyBurner)
        .connect(accounts.deployer)
        .setLedger(contract.address);
    console.log(`Set address of LoyaltyBurner (tx: ${tx4.hash})...`);
    await tx4.wait();

    const tx5 = await (deployment.getContract("LoyaltyTransfer") as LoyaltyBurner)
        .connect(accounts.deployer)
        .setLedger(contract.address);
    console.log(`Set address of LoyaltyTransfer (tx: ${tx5.hash})...`);
    await tx5.wait();

    const tx6 = await (deployment.getContract("LoyaltyBridge") as LoyaltyBridge)
        .connect(accounts.deployer)
        .setLedger(contract.address);
    console.log(`Set address of LoyaltyBridge (tx: ${tx6.hash})...`);
    await tx6.wait();

    console.log(`Deployed ${contractName} to ${contract.address}`);

    {
        const assetAmount = Amount.make(100_000_000, 18);
        const tx11 = await (deployment.getContract("TestLYT") as TestLYT)
            .connect(accounts.foundation)
            .approve(contract.address, assetAmount.value);
        console.log(`Approve foundation's amount (tx: ${tx11.hash})...`);
        await tx11.wait();

        const tx12 = await contract.connect(accounts.foundation).deposit(assetAmount.value);
        console.log(`Deposit foundation's amount (tx: ${tx12.hash})...`);
        await tx12.wait();
    }
    {
        const tokenContract = (await deployment.getContract("TestLYT")) as TestLYT;
        const tokenId = ContractUtils.getTokenId(await tokenContract.name(), await tokenContract.symbol());
        const assetAmount = Amount.make(1_000_000_000, 18).value;
        const nonce = await tokenContract.nonceOf(accounts.owner.address);
        const message = ContractUtils.getTransferMessage(accounts.owner.address, contract.address, assetAmount, nonce);
        const signature = await ContractUtils.signMessage(accounts.owner, message);
        const tx22 = await contract.connect(accounts.owner).depositLiquidity(tokenId, assetAmount, signature);
        console.log(`Deposit liquidity token (tx: ${tx22.hash})...`);
        await tx22.wait();
    }
}
