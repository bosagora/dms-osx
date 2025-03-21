import "@nomiclabs/hardhat-ethers";
import "@nomiclabs/hardhat-waffle";
import "@openzeppelin/hardhat-upgrades";

import { HardhatAccount } from "../../src/HardhatAccount";
import { Amount, BOACoin } from "../../src/utils/Amount";
import { ContractUtils } from "../../src/utils/ContractUtils";
import {
    Bridge,
    BridgeValidator,
    CurrencyRate, ERC20,
    Ledger,
    LoyaltyBridge,
    LoyaltyBurner,
    LoyaltyConsumer,
    LoyaltyExchanger,
    LoyaltyProvider,
    LoyaltyToken,
    LoyaltyTransfer,
    MultiSigWallet,
    PhoneLinkCollection,
    Shop,
    Validator,
} from "../../typechain-types";

import { AddressZero, HashZero } from "@ethersproject/constants";
import { BaseContract, BigNumber, Contract, Wallet } from "ethers";

import fs from "fs";

import * as hre from "hardhat";

const network = "side_chain_devnet";

export const MULTI_SIG_WALLET_ADDRESSES: { [key: string]: string } = {
    main_chain_devnet: "0x580f0F058D1eD4A317FF4Ce2668Ae25fbF21A2d9",
    side_chain_devnet: "0x580f0F058D1eD4A317FF4Ce2668Ae25fbF21A2d9",
};

export const LOYALTY_TOKEN_ADDRESSES: { [key: string]: string } = {
    main_chain_devnet: "0xB1A90a5C6e30d64Ab6f64C30eD392F46eDBcb022",
    side_chain_devnet: "0xB1A90a5C6e30d64Ab6f64C30eD392F46eDBcb022",
};

interface IDeployedContract {
    name: string;
    address: string;
    contract: BaseContract;
}

interface IAccount {
    deployer: Wallet;
    owner: Wallet;
    system: Wallet;
    paymentFee: Wallet;
    protocolFee: Wallet;
    adProtocolFee: Wallet;
    validators: Wallet[];
    linkValidators: Wallet[];
    bridgeValidators: Wallet[];
    certifiers: Wallet[];
    tokenOwners: Wallet[];
    publisher: Wallet;
}

type FnDeployer = (accounts: IAccount, deployment: Deployments) => Promise<any>;

const BASE_CURRENCY = "KRW";

class Deployments {
    public deployments: Map<string, IDeployedContract>;
    public deployers: FnDeployer[];
    public accounts: IAccount;

    private MULTI_SIG_WALLET_CONTRACT: Contract | undefined;
    private LOYALTY_TOKEN_CONTRACT: Contract | undefined;

    constructor() {
        this.deployments = new Map<string, IDeployedContract>();
        this.deployers = [];

        const raws = HardhatAccount.keys.map((m) => new Wallet(m, hre.ethers.provider));
        const [
            deployer_side_chain,
            deployer_main_chain,
            owner,
            system,
            paymentFee,
            protocolFee,
            adProtocolFee,
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
            tokenOwner1,
            tokenOwner2,
            tokenOwner3,
            publisher,
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
        ] = raws;

        this.accounts = {
            deployer: deployer_side_chain,
            owner,
            system,
            paymentFee,
            protocolFee,
            adProtocolFee,
            validators: [
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
            ],
            bridgeValidators: [bridgeValidator1, bridgeValidator2, bridgeValidator3],
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

            tokenOwners: [tokenOwner1, tokenOwner2, tokenOwner3],
            publisher,
        };
    }

    public async attachPreviousContracts() {
        this.MULTI_SIG_WALLET_CONTRACT = (await hre.ethers.getContractFactory("MultiSigWallet")).attach(
            MULTI_SIG_WALLET_ADDRESSES[network]
        ) as MultiSigWallet;
        this.LOYALTY_TOKEN_CONTRACT = (await hre.ethers.getContractFactory("LoyaltyToken")).attach(
            LOYALTY_TOKEN_ADDRESSES[network]
        ) as LoyaltyToken;
    }

    public addContract(name: string, address: string, contract: BaseContract) {
        this.deployments.set(name, {
            name,
            address,
            contract,
        });
    }

    public getContract(name: string): BaseContract | undefined {
        if (name === "MultiSigWallet") {
            return this.MULTI_SIG_WALLET_CONTRACT;
        } else if (name === "LoyaltyToken") {
            return this.LOYALTY_TOKEN_CONTRACT;
        }
        const info = this.deployments.get(name);
        if (info !== undefined) {
            return info.contract;
        } else {
            return undefined;
        }
    }

    public getContractAddress(name: string): string | undefined {
        if (name === "MultiSigWallet") {
            return MULTI_SIG_WALLET_ADDRESSES[network];
        } else if (name === "LoyaltyToken") {
            return LOYALTY_TOKEN_ADDRESSES[network];
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

    static filename = "./deploy/side_chain_devnet/deployed_contracts.json";

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
    const factory = await hre.ethers.getContractFactory("PhoneLinkCollection");
    const contract = (await hre.upgrades.deployProxy(
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

async function mintInitialSupplyToken(accounts: IAccount, deployment: Deployments) {
    const contractName = "LoyaltyToken";

    const contract = deployment.getContract("LoyaltyToken") as LoyaltyToken;

    const amount = BOACoin.make(10_000_000_000);

    const encodedData = contract.interface.encodeFunctionData("mint", [amount.value]);
    const wallet = deployment.getContract("MultiSigWallet") as MultiSigWallet;
    const transactionId = await ContractUtils.getEventValueBigNumber(
        await wallet
            .connect(accounts.tokenOwners[0])
            .submitTransaction("Mint", `Mint ${amount.toDisplayString()}`, contract.address, 0, encodedData),
        wallet.interface,
        "Submission",
        "transactionId"
    );

    if (transactionId === undefined) {
        console.error(`Failed to submit transaction for token mint`);
    } else {
        const executedTransactionId = await ContractUtils.getEventValueBigNumber(
            await wallet.connect(accounts.tokenOwners[1]).confirmTransaction(transactionId),
            wallet.interface,
            "Execution",
            "transactionId"
        );

        if (executedTransactionId === undefined || !transactionId.eq(executedTransactionId)) {
            console.error(`Failed to confirm transaction for token mint`);
        }
    }

    console.log(`Mint ${contractName} to ${wallet.address}`);
}

async function distributeToken(accounts: IAccount, deployment: Deployments) {
    const contractName = "LoyaltyToken";

    const contract = deployment.getContract("LoyaltyToken") as LoyaltyToken;

    {
        const amount = BOACoin.make(10_000_000_000);

        const encodedData = contract.interface.encodeFunctionData("transfer", [accounts.owner.address, amount.value]);
        const wallet = deployment.getContract("MultiSigWallet") as MultiSigWallet;
        const transactionId = await ContractUtils.getEventValueBigNumber(
            await wallet
                .connect(accounts.tokenOwners[0])
                .submitTransaction(
                    "Transfer",
                    `Transfer ${amount.toDisplayString()} to ${accounts.owner.address}`,
                    contract.address,
                    0,
                    encodedData
                ),
            wallet.interface,
            "Submission",
            "transactionId"
        );

        if (transactionId === undefined) {
            console.error(`Failed to submit transaction for token transfer`);
        } else {
            const executedTransactionId = await ContractUtils.getEventValueBigNumber(
                await wallet.connect(accounts.tokenOwners[1]).confirmTransaction(transactionId),
                wallet.interface,
                "Execution",
                "transactionId"
            );

            if (executedTransactionId === undefined || !transactionId.eq(executedTransactionId)) {
                console.error(`Failed to confirm transaction for token transfer`);
            }
        }
    }

    {
        const assetAmount = Amount.make(9_000_000_000, 18);
        const tx1 = await contract.connect(accounts.owner).transfer(accounts.system.address, assetAmount.value);
        console.log(`Transfer token to system (tx: ${tx1.hash})...`);
        // await tx1.wait();

        const userAmount = Amount.make(200_000, 18);
        const users = JSON.parse(fs.readFileSync("./deploy/data/users.json", "utf8"));
        for (const account of users) {
            const tx = await contract.connect(accounts.owner).transfer(account.address, userAmount.value);
            console.log(`Transfer token to users (tx: ${tx.hash})...`);
            // await tx.wait();
        }

        const users_mobile = JSON.parse(fs.readFileSync("./deploy/data/users_mobile.json", "utf8"));
        for (const account of users_mobile) {
            const tx = await contract.connect(accounts.owner).transfer(account.address, userAmount.value);
            console.log(`Transfer token to users_mobile (tx: ${tx.hash})...`);
            // await tx.wait();
        }
    }
    console.log(`Distribute ${contractName}`);
}

async function deployValidator(accounts: IAccount, deployment: Deployments) {
    const contractName = "Validator";
    console.log(`Deploy ${contractName}...`);
    if (deployment.getContract("LoyaltyToken") === undefined) {
        console.error("Contract is not deployed!");
        return;
    }

    const factory = await hre.ethers.getContractFactory("Validator");
    const contract = (await hre.upgrades.deployProxy(
        factory.connect(accounts.deployer),
        [deployment.getContractAddress("LoyaltyToken"), accounts.validators.map((m) => m.address)],
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
            const tx1 = await (deployment.getContract("LoyaltyToken") as LoyaltyToken)
                .connect(accounts.owner)
                .transfer(elem.address, amount.value);
            console.log(`Transfer token to validator (tx: ${tx1.hash})...`);
            // await tx1.wait();

            const tx2 = await (deployment.getContract("LoyaltyToken") as LoyaltyToken)
                .connect(elem)
                .approve(contract.address, depositedToken.value);
            console.log(`Approve validator's amount (tx: ${tx2.hash})...`);
            // await tx2.wait();

            const tx3 = await contract.connect(elem).deposit(depositedToken.value);
            console.log(`Deposit validator's amount (tx: ${tx3.hash})...`);
            // await tx3.wait();
        }
    }
}

async function deployCurrencyRate(accounts: IAccount, deployment: Deployments) {
    const contractName = "CurrencyRate";
    console.log(`Deploy ${contractName}...`);
    if (deployment.getContract("Validator") === undefined || deployment.getContract("LoyaltyToken") === undefined) {
        console.error("Contract is not deployed!");
        return;
    }

    const factory = await hre.ethers.getContractFactory("CurrencyRate");
    const tokenSymbol = await (deployment.getContract("LoyaltyToken") as LoyaltyToken).symbol();
    const contract = (await hre.upgrades.deployProxy(
        factory.connect(accounts.deployer),
        [deployment.getContractAddress("Validator"), tokenSymbol],
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
                symbol: tokenSymbol,
                rate: multiple.mul(100),
            },
            {
                symbol: BASE_CURRENCY.toLowerCase(),
                rate: multiple,
            },
            {
                symbol: BASE_CURRENCY.toUpperCase(),
                rate: multiple,
            },
        ];
        const chainId = (await hre.ethers.provider.getNetwork()).chainId;
        const message = ContractUtils.getCurrencyMessage(height, rates, chainId);
        const signatures = await Promise.all(accounts.validators.map((m) => ContractUtils.signMessage(m, message)));
        const proposeMessage = ContractUtils.getCurrencyProposeMessage(height, rates, signatures, chainId);
        const proposerSignature = await ContractUtils.signMessage(accounts.validators[0], proposeMessage);
        const tx = await contract.connect(accounts.certifiers[0]).set(height, rates, signatures, proposerSignature);
        console.log(`Set currency rate (tx: ${tx.hash})...`);
        // await tx.wait();
    }
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

    const factory = await hre.ethers.getContractFactory("LoyaltyBurner");
    const contract = (await hre.upgrades.deployProxy(
        factory.connect(accounts.deployer),
        [deployment.getContractAddress("Validator"), deployment.getContractAddress("PhoneLinkCollection")],
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

    const factory = await hre.ethers.getContractFactory("LoyaltyProvider");
    const contract = (await hre.upgrades.deployProxy(
        factory.connect(accounts.deployer),
        [
            deployment.getContractAddress("Validator"),
            deployment.getContractAddress("PhoneLinkCollection"),
            deployment.getContractAddress("CurrencyRate"),
            accounts.adProtocolFee.address,
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

    const factory = await hre.ethers.getContractFactory("LoyaltyConsumer");
    const contract = (await hre.upgrades.deployProxy(
        factory.connect(accounts.deployer),
        [deployment.getContractAddress("CurrencyRate")],
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

    const factory = await hre.ethers.getContractFactory("LoyaltyExchanger");
    const contract = (await hre.upgrades.deployProxy(
        factory.connect(accounts.deployer),
        [deployment.getContractAddress("PhoneLinkCollection"), deployment.getContractAddress("CurrencyRate")],
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

async function deployLoyaltyTransfer(accounts: IAccount, deployment: Deployments) {
    const contractName = "LoyaltyTransfer";
    console.log(`Deploy ${contractName}...`);

    const factory = await hre.ethers.getContractFactory("LoyaltyTransfer");
    const contract = (await hre.upgrades.deployProxy(factory.connect(accounts.owner), [], {
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

    const factory = await hre.ethers.getContractFactory("BridgeValidator");
    const contract = (await hre.upgrades.deployProxy(
        factory.connect(accounts.owner),
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

async function deployLoyaltyBridge(accounts: IAccount, deployment: Deployments) {
    const contractName = "LoyaltyBridge";
    console.log(`Deploy ${contractName}...`);
    if (deployment.getContract("BridgeValidator") === undefined) {
        console.error("Contract is not deployed!");
        return;
    }

    const factory = await hre.ethers.getContractFactory("LoyaltyBridge");
    const contract = (await hre.upgrades.deployProxy(
        factory.connect(accounts.deployer),
        [deployment.getContractAddress("BridgeValidator")],
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

    const factory = await hre.ethers.getContractFactory("Shop");
    const contract = (await hre.upgrades.deployProxy(
        factory.connect(accounts.deployer),
        [
            deployment.getContractAddress("CurrencyRate"),
            deployment.getContractAddress("LoyaltyProvider"),
            deployment.getContractAddress("LoyaltyConsumer"),
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
    // await tx1.wait();

    const tx2 = await (deployment.getContract("LoyaltyConsumer") as LoyaltyConsumer)
        .connect(accounts.deployer)
        .setShop(contract.address);
    console.log(`Set address of LoyaltyConsumer (tx: ${tx2.hash})...`);
    // await tx2.wait();

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
            const message = ContractUtils.getShopAccountMessage(shop.shopId, shop.address, nonce);
            const signature = await ContractUtils.signMessage(
                new Wallet(shop.privateKey, hre.ethers.provider),
                message
            );
            const tx = await contract
                .connect(new Wallet(shop.privateKey, hre.ethers.provider))
                .add(shop.shopId, shop.name, shop.currency, shop.address, signature);
            console.log(`Add shop data (tx: ${tx.hash})...`);
            // await tx.wait();
        }
    }
}

async function deployLedger(accounts: IAccount, deployment: Deployments) {
    const contractName = "Ledger";
    console.log(`Deploy ${contractName}...`);
    if (
        deployment.getContract("LoyaltyToken") === undefined ||
        deployment.getContract("PhoneLinkCollection") === undefined ||
        deployment.getContract("CurrencyRate") === undefined ||
        deployment.getContract("LoyaltyProvider") === undefined ||
        deployment.getContract("LoyaltyConsumer") === undefined ||
        deployment.getContract("LoyaltyExchanger") === undefined ||
        deployment.getContract("LoyaltyBurner") === undefined ||
        deployment.getContract("LoyaltyTransfer") === undefined ||
        deployment.getContract("LoyaltyBridge") === undefined ||
        deployment.getContract("Shop") === undefined
    ) {
        console.error("Contract is not deployed!");
        return;
    }

    const factory = await hre.ethers.getContractFactory("Ledger");
    const contract = (await hre.upgrades.deployProxy(
        factory.connect(accounts.deployer),
        [
            {
                system: accounts.system.address,
                paymentFee: accounts.paymentFee.address,
                protocolFee: accounts.protocolFee.address,
            },
            {
                token: deployment.getContractAddress("LoyaltyToken"),
                phoneLink: deployment.getContractAddress("PhoneLinkCollection"),
                currencyRate: deployment.getContractAddress("CurrencyRate"),
                provider: deployment.getContractAddress("LoyaltyProvider"),
                consumer: deployment.getContractAddress("LoyaltyConsumer"),
                exchanger: deployment.getContractAddress("LoyaltyExchanger"),
                burner: deployment.getContractAddress("LoyaltyBurner"),
                transfer: deployment.getContractAddress("LoyaltyTransfer"),
                bridge: deployment.getContractAddress("LoyaltyBridge"),
                shop: deployment.getContractAddress("Shop"),
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

    const tx21 = await (deployment.getContract("LoyaltyProvider") as LoyaltyProvider)
        .connect(accounts.deployer)
        .setLedger(contract.address);
    console.log(`Set address of LoyaltyProvider (tx: ${tx21.hash})...`);
    // await tx21.wait();

    const tx22 = await (deployment.getContract("LoyaltyConsumer") as LoyaltyConsumer)
        .connect(accounts.deployer)
        .setLedger(contract.address);
    console.log(`Set address of LoyaltyConsumer (tx: ${tx22.hash})...`);
    // await tx22.wait();

    const tx23 = await (deployment.getContract("LoyaltyExchanger") as LoyaltyExchanger)
        .connect(accounts.deployer)
        .setLedger(contract.address);
    console.log(`Set address of LoyaltyExchanger (tx: ${tx23.hash})...`);
    // await tx23.wait();

    const tx24 = await (deployment.getContract("LoyaltyBurner") as LoyaltyBurner)
        .connect(accounts.deployer)
        .setLedger(contract.address);
    console.log(`Set address of LoyaltyBurner (tx: ${tx24.hash})...`);
    // await tx24.wait();

    const tx25 = await (deployment.getContract("LoyaltyTransfer") as LoyaltyTransfer)
        .connect(accounts.owner)
        .setLedger(contract.address);
    console.log(`Set address of LoyaltyTransfer (tx: ${tx25.hash})...`);
    // await tx25.wait();

    const tx26 = await (deployment.getContract("LoyaltyBridge") as LoyaltyBridge)
        .connect(accounts.deployer)
        .setLedger(contract.address);
    console.log(`Set address of LoyaltyBridge (tx: ${tx26.hash})...`);
    // await tx26.wait();

    const tx27 = await (deployment.getContract("Shop") as Shop).connect(accounts.deployer).setLedger(contract.address);
    console.log(`Set address of Shop (tx: ${tx27.hash})...`);
    // await tx27.wait();

    console.log(`Deployed ${contractName} to ${contract.address}`);

    {
        const assetAmount = Amount.make(8_000_000_000, 18);
        const tx5 = await (deployment.getContract("LoyaltyToken") as LoyaltyToken)
            .connect(accounts.system)
            .approve(contract.address, assetAmount.value);
        console.log(`Approve system's amount (tx: ${tx5.hash})...`);
        // await tx5.wait();

        const tx6 = await contract.connect(accounts.system).deposit(assetAmount.value);
        console.log(`Deposit system's amount (tx: ${tx6.hash})...`);
        // await tx6.wait();

        console.log(`Deposit users.json`);
        const users = JSON.parse(fs.readFileSync("./deploy/data/users.json", "utf8"));
        for (const user of users) {
            const signer = new Wallet(user.privateKey).connect(hre.ethers.provider);

            const balance = await (deployment.getContract("LoyaltyToken") as LoyaltyToken).balanceOf(user.address);
            const depositedToken = ContractUtils.zeroGWEI(balance.div(2));
            const tx8 = await (deployment.getContract("LoyaltyToken") as LoyaltyToken)
                .connect(signer)
                .approve((deployment.getContract("Ledger") as Ledger).address, depositedToken);
            console.log(`Approve user's amount (tx: ${tx8.hash})...`);
            // await tx8.wait();

            const tx9 = await (deployment.getContract("Ledger") as Ledger).connect(signer).deposit(depositedToken);
            console.log(`Deposit user's amount (tx: ${tx9.hash})...`);
            // await tx9.wait();
        }

        const linkContract = deployment.getContract("PhoneLinkCollection") as PhoneLinkCollection;

        console.log(`Link users_mobile.json`);
        const users_mobile = JSON.parse(fs.readFileSync("./deploy/data/users_mobile.json", "utf8"));
        for (const user of users_mobile) {
            const userAccount = ContractUtils.getPhoneHash(user.phone);
            if ((await linkContract.toAddress(userAccount)) !== user.address) {
                const userNonce = await linkContract.nonceOf(user.address);
                const msg = ContractUtils.getRequestMessage(userAccount, user.address, userNonce);
                const userSignature = await ContractUtils.signMessage(new Wallet(user.privateKey), msg);
                const reqId2 = ContractUtils.getRequestId(userAccount, user.address, userNonce);
                const tx14 = await linkContract
                    .connect(accounts.linkValidators[0])
                    .addRequest(reqId2, userAccount, user.address, userSignature);
                console.log(`Add phone-address of user (tx: ${tx14.hash})...`);
                // await tx14.wait();

                const tx15 = await linkContract.connect(accounts.linkValidators[1]).voteRequest(reqId2);
                console.log(`Vote of validator1 (tx: ${tx15.hash})...`);
                // await tx15.wait();

                const tx16 = await linkContract.connect(accounts.linkValidators[2]).voteRequest(reqId2);
                console.log(`Vote of validator2 (tx: ${tx16.hash})...`);
                // await tx16.wait();

                const tx17 = await linkContract.connect(accounts.linkValidators[0]).countVote(reqId2);
                console.log(`Count of vote (tx: ${tx17.hash})...`);
                // await tx17.wait();

                if ((await linkContract.toAddress(userAccount)) === user.address) {
                    console.log(`Success ${user.address}`);
                } else {
                    console.log(`Fail ${user.address}`);
                }
            }
        }

        console.log(`Deposit users_mobile.json`);
        for (const user of users_mobile) {
            const signer = new Wallet(user.privateKey).connect(hre.ethers.provider);

            const balance = await (deployment.getContract("LoyaltyToken") as LoyaltyToken).balanceOf(user.address);
            const depositedToken = ContractUtils.zeroGWEI(balance.div(2));
            const tx8 = await (deployment.getContract("LoyaltyToken") as LoyaltyToken)
                .connect(signer)
                .approve((deployment.getContract("Ledger") as Ledger).address, depositedToken);
            console.log(`Approve user's amount (tx: ${tx8.hash})...`);
            // await tx8.wait();

            const tx9 = await (deployment.getContract("Ledger") as Ledger).connect(signer).deposit(depositedToken);
            console.log(`Deposit user's amount (tx: ${tx9.hash})...`);
            // await tx9.wait();
        }

        const chainId = (await hre.ethers.provider.getNetwork()).chainId;
        {
            const assetAmount2 = Amount.make(1_000_000_000, 18).value;
            const tokenContract = deployment.getContract("LoyaltyToken") as LoyaltyToken;
            const tokenId = ContractUtils.getTokenId(await tokenContract.name(), await tokenContract.symbol());
            const nonce = await tokenContract.nonceOf(accounts.system.address);
            const expiry = ContractUtils.getTimeStamp() + 3600;
            const message = ContractUtils.getTransferMessage(
                chainId,
                tokenContract.address,
                accounts.system.address,
                contract.address,
                assetAmount2,
                nonce,
                expiry
            );
            const signature = await ContractUtils.signMessage(accounts.system, message);
            const tx1 = await contract
                .connect(accounts.system)
                .depositLiquidity(tokenId, assetAmount2, expiry, signature);
            console.log(`Deposit liquidity token (tx: ${tx1.hash})...`);
            // await tx1.wait();
        }

        {
            const nonce = await contract.nonceOf(accounts.system.address);
            const message = ContractUtils.getRegisterAgentMessage(
                accounts.system.address,
                accounts.publisher.address,
                nonce,
                hre.ethers.provider.network.chainId
            );
            const signature = await ContractUtils.signMessage(accounts.system, message);
            const tx = await contract
                .connect(accounts.certifiers[0])
                .registerProvisionAgent(accounts.system.address, accounts.publisher.address, signature);
            console.log(`Register agent address of system (tx: ${tx.hash})...`);
            // await tx.wait();

            const value = await contract.provisionAgentOf(accounts.system.address);
            console.log("Assistance of System Account: ", value);
        }
    }
}

async function deployInnerChainBridge(accounts: IAccount, deployment: Deployments) {
    const contractName = "InnerChainBridge";
    console.log(`Deploy ${contractName}...`);
    if (deployment.getContract("BridgeValidator") === undefined) {
        console.error("Contract is not deployed!");
        return;
    }

    const factory = await hre.ethers.getContractFactory("Bridge");
    const contract = (await hre.upgrades.deployProxy(
        factory.connect(accounts.deployer),
        [deployment.getContractAddress("BridgeValidator"), accounts.protocolFee.address],
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
        // Native Token
        const tx1 = await contract.connect(accounts.deployer).registerToken(HashZero, AddressZero);
        console.log(`Register Native Token (tx: ${tx1.hash})...`);
        await tx1.wait();

        const nativeTokenAmount = Amount.make(500_000, 18).value;
        const tx2 = await accounts.owner.sendTransaction({ to: contract.address, value: nativeTokenAmount });
        console.log(`Deposit Native Token to Chain Bridge (tx: ${tx2.hash})...`);
        await tx2.wait();

        // BIP20 Token
        const tokenContract = deployment.getContract("LoyaltyToken") as LoyaltyToken;
        const tokenId = ContractUtils.getTokenId(await tokenContract.name(), await tokenContract.symbol());
        const tx3 = await contract.connect(accounts.deployer).registerToken(tokenId, tokenContract.address);
        console.log(`Register Loyalty Token (tx: ${tx3.hash})...`);
        await tx3.wait();

        const assetAmount = Amount.make(200_000_000, 18).value;
        const tx4 = await tokenContract.connect(accounts.owner).transfer(contract.address, assetAmount);
        console.log(`Deposit Loyalty Token to Inner Chain Bridge (tx: ${tx4.hash})...`);
        await tx4.wait();
    }

    {
        // Register Loyalty Provider for Testing
        const users = JSON.parse(fs.readFileSync("./deploy/data/users.json", "utf8"));
        for (const user of users) {
            const tx10 = await (deployment.getContract("Ledger") as Ledger)
                .connect(accounts.deployer)
                .registerProvider(user.address);
            console.log(`Register provider (tx: ${tx10.hash})...`);
        }
    }
}

async function writeTokenInfo(accounts: IAccount, deployment: Deployments) {
    console.log(`Information of token`);
    const tokenContract = deployment.getContract("LoyaltyToken") as ERC20;
    console.log(`Name of token: ${await tokenContract.name()}`);
    console.log(`Symbol of token: ${await tokenContract.symbol()}`);
    console.log(`Address of token: ${tokenContract.address}`);
    console.log(`Total supply of token: ${(new BOACoin(await tokenContract.totalSupply())).toDisplayString(true, 4)}`);
}

async function writeAccountInfo(accounts: IAccount, deployment: Deployments) {
    console.log(`Information of accounts`);
    console.log(`deployer      : ${accounts.deployer.address}`);
    console.log(`owner         : ${accounts.owner.address}`);
    console.log(`system        : ${accounts.system.address}`);
    console.log(`paymentFee    : ${accounts.paymentFee.address}`);
    console.log(`protocolFee   : ${accounts.protocolFee.address}`);
    console.log(`adProtocolFee : ${accounts.protocolFee.address}`);
}

async function writeBalanceOfBridges(accounts: IAccount, deployment: Deployments) {
    const tokenContract = deployment.getContract("LoyaltyToken") as LoyaltyToken;
    console.log(`Balance of owner's token ${(new BOACoin(await tokenContract.balanceOf(accounts.owner.address))).toDisplayString(true, 4)}`);
    console.log(`Balance of loyalty bridge's token ${(new BOACoin(await tokenContract.balanceOf(deployment.getContractAddress("LoyaltyBridge") || ""))).toDisplayString(true, 4)}`);
    console.log(`Balance of inner chain bridge's token   ${(new BOACoin(await tokenContract.balanceOf(deployment.getContractAddress("InnerChainBridge") || ""))).toDisplayString(true, 4)}`);
}

async function storeSampleExchangeRate(accounts: IAccount, deployment: Deployments) {
    const contract = deployment.getContract("CurrencyRate") as CurrencyRate;
    if (contract === undefined) {
        console.error("CurrencyRate is not deployed!");
        return;
    }
    console.log(`Store Sample Exchange Rate...`);
    const height = 0;
    const rates = [
        {
            symbol: "KIOS",
            rate: BigNumber.from(41405238963),
        },
        {
            symbol: "KRW",
            rate: BigNumber.from(1000000000),
        },
        {
            symbol: "USD",
            rate: BigNumber.from(1380174632544),
        },
        {
            symbol: "PHP",
            rate: BigNumber.from(23500000270),
        },
        {
            symbol: "krw",
            rate: BigNumber.from(1000000000),
        },
        {
            symbol: "usd",
            rate: BigNumber.from(1380174632544),
        },
        {
            symbol: "php",
            rate: BigNumber.from(23500000270),
        },
    ];
    const chainId = (await hre.ethers.provider.getNetwork()).chainId;
    const message = ContractUtils.getCurrencyMessage(height, rates, chainId);
    const signatures = await Promise.all(accounts.validators.map((m) => ContractUtils.signMessage(m, message)));
    const proposeMessage = ContractUtils.getCurrencyProposeMessage(height, rates, signatures, chainId);
    const proposerSignature = await ContractUtils.signMessage(accounts.validators[0], proposeMessage);
    const tx1 = await contract.connect(accounts.certifiers[0]).set(height, rates, signatures, proposerSignature);
    await tx1.wait();
}

let purchaseId = 0;
function getPurchaseId(): string {
    const randomIdx = Math.floor(Math.random() * 1000);
    const res = "P" + purchaseId.toString().padStart(10, "0") + randomIdx.toString().padStart(4, "0");
    purchaseId++;
    return res;
}

async function storeSamplePurchase1(accounts: IAccount, deployment: Deployments) {
    const contract = deployment.getContract("LoyaltyProvider") as LoyaltyProvider;
    if (contract === undefined) {
        console.error("LoyaltyProvider is not deployed!");
        return;
    }

    console.log(`Store Sample Purchase 1 - 1/4 ...`);
    const users = JSON.parse(fs.readFileSync("deploy/data/users.json", "utf8"));
    const shops = JSON.parse(fs.readFileSync("deploy/data/shops.json", "utf8"));

    const purchaseAmount = Amount.make(100_000_000, 18).value;
    const loyaltyAmount = purchaseAmount.mul(5).div(100);
    const phoneHash = ContractUtils.getPhoneHash("");

    const purchaseParams = await Promise.all(
        users.slice(0, 50).map(async (m: any) => {
            const purchaseItem = {
                purchaseId: getPurchaseId(),
                amount: purchaseAmount,
                loyalty: loyaltyAmount,
                currency: "php",
                shopId: shops[shops.length - 1].shopId,
                account: m.address,
                phone: phoneHash,
                sender: accounts.system.address,
                signature: "",
            };
            purchaseItem.signature = await ContractUtils.getPurchaseSignature(accounts.publisher, purchaseItem);
            return purchaseItem;
        })
    );

    const chainId = (await hre.ethers.provider.getNetwork()).chainId;
    const purchaseMessage = ContractUtils.getPurchasesMessage(0, purchaseParams, chainId);
    const signatures = await Promise.all(accounts.validators.map((m) => ContractUtils.signMessage(m, purchaseMessage)));
    const proposeMessage = ContractUtils.getPurchasesProposeMessage(0, purchaseParams, signatures, chainId);
    const proposerSignature = await ContractUtils.signMessage(accounts.validators[0], proposeMessage);
    const tx1 = await contract
        .connect(accounts.certifiers[0])
        .savePurchase(0, purchaseParams, signatures, proposerSignature);
    await tx1.wait();

    console.log(`Store Sample Purchase 1 - 2/4 ...`);
    const purchaseParams2 = await Promise.all(
        users.slice(50, 100).map(async (m: any) => {
            const purchaseItem = {
                purchaseId: getPurchaseId(),
                amount: purchaseAmount,
                loyalty: loyaltyAmount,
                currency: "php",
                shopId: shops[shops.length - 1].shopId,
                account: m.address,
                phone: phoneHash,
                sender: accounts.system.address,
                signature: "",
            };
            purchaseItem.signature = await ContractUtils.getPurchaseSignature(accounts.publisher, purchaseItem);
            return purchaseItem;
        })
    );

    const purchaseMessage2 = ContractUtils.getPurchasesMessage(0, purchaseParams2, chainId);
    const signatures2 = await Promise.all(
        accounts.validators.map((m) => ContractUtils.signMessage(m, purchaseMessage2))
    );
    const proposeMessage2 = ContractUtils.getPurchasesProposeMessage(0, purchaseParams2, signatures2, chainId);
    const proposerSignature2 = await ContractUtils.signMessage(accounts.validators[0], proposeMessage2);
    const tx2 = await contract
        .connect(accounts.certifiers[0])
        .savePurchase(0, purchaseParams2, signatures2, proposerSignature2);
    await tx2.wait();

    console.log(`Store Sample Purchase 1 - 3/4 ...`);
    const purchaseParams3 = await Promise.all(
        users.slice(0, 50).map(async (m: any) => {
            const purchaseItem = {
                purchaseId: getPurchaseId(),
                amount: purchaseAmount,
                loyalty: loyaltyAmount,
                currency: "php",
                shopId: shops[shops.length - 1].shopId,
                account: AddressZero,
                phone: ContractUtils.getPhoneHash(m.phone),
                sender: accounts.system.address,
                signature: "",
            };
            purchaseItem.signature = await ContractUtils.getPurchaseSignature(accounts.publisher, purchaseItem);
            return purchaseItem;
        })
    );
    const purchaseMessage3 = ContractUtils.getPurchasesMessage(0, purchaseParams3, chainId);
    const signatures3 = await Promise.all(
        accounts.validators.map((m) => ContractUtils.signMessage(m, purchaseMessage3))
    );
    const proposeMessage3 = ContractUtils.getPurchasesProposeMessage(0, purchaseParams3, signatures3, chainId);
    const proposerSignature3 = await ContractUtils.signMessage(accounts.validators[0], proposeMessage3);
    const tx3 = await contract
        .connect(accounts.certifiers[0])
        .savePurchase(0, purchaseParams3, signatures3, proposerSignature3);
    await tx3.wait();

    console.log(`Store Sample Purchase 1 - 4/4 ...`);
    const purchaseParams4 = await Promise.all(
        users.slice(50, 100).map(async (m: any) => {
            const purchaseItem = {
                purchaseId: getPurchaseId(),
                amount: purchaseAmount,
                loyalty: loyaltyAmount,
                currency: "php",
                shopId: shops[shops.length - 1].shopId,
                account: AddressZero,
                phone: ContractUtils.getPhoneHash(m.phone),
                sender: accounts.system.address,
                signature: "",
            };
            purchaseItem.signature = await ContractUtils.getPurchaseSignature(accounts.publisher, purchaseItem);
            return purchaseItem;
        })
    );
    const purchaseMessage4 = ContractUtils.getPurchasesMessage(0, purchaseParams4, chainId);
    const signatures4 = await Promise.all(
        accounts.validators.map((m) => ContractUtils.signMessage(m, purchaseMessage4))
    );
    const proposeMessage4 = ContractUtils.getPurchasesProposeMessage(0, purchaseParams4, signatures4, chainId);
    const proposerSignature4 = await ContractUtils.signMessage(accounts.validators[0], proposeMessage4);
    const tx4 = await contract
        .connect(accounts.certifiers[0])
        .savePurchase(0, purchaseParams4, signatures4, proposerSignature4);
    await tx4.wait();
}

async function storeSamplePurchase2(accounts: IAccount, deployment: Deployments) {
    const contract = deployment.getContract("LoyaltyProvider") as LoyaltyProvider;
    if (contract === undefined) {
        console.error("LoyaltyProvider is not deployed!");
        return;
    }

    console.log(`Store Sample Purchase 2 - 1/2...`);
    const users = JSON.parse(fs.readFileSync("deploy/data/users_mobile.json", "utf8"));
    const shops = JSON.parse(fs.readFileSync("deploy/data/shops.json", "utf8"));

    const purchaseAmount = Amount.make(100_000_000, 18).value;
    const loyaltyAmount = purchaseAmount.mul(5).div(100);
    const phoneHash = ContractUtils.getPhoneHash("");

    const purchaseParams = await Promise.all(
        users.map(async (m: any) => {
            const purchaseItem = {
                purchaseId: getPurchaseId(),
                amount: purchaseAmount,
                loyalty: loyaltyAmount,
                currency: "php",
                shopId: shops[shops.length - 1].shopId,
                account: m.address,
                phone: phoneHash,
                sender: accounts.system.address,
                signature: "",
            };
            purchaseItem.signature = await ContractUtils.getPurchaseSignature(accounts.publisher, purchaseItem);
            return purchaseItem;
        })
    );
    const chainId = (await hre.ethers.provider.getNetwork()).chainId;
    const purchaseMessage = ContractUtils.getPurchasesMessage(0, purchaseParams, chainId);
    const signatures = await Promise.all(accounts.validators.map((m) => ContractUtils.signMessage(m, purchaseMessage)));
    const proposeMessage = ContractUtils.getPurchasesProposeMessage(0, purchaseParams, signatures, chainId);
    const proposerSignature = ContractUtils.signMessage(accounts.validators[0], proposeMessage);
    const tx1 = await contract
        .connect(accounts.certifiers[4])
        .savePurchase(0, purchaseParams, signatures, proposerSignature);
    await tx1.wait();

    console.log(`Store Sample Purchase 2 - 2/2...`);

    const purchaseParams3 = await Promise.all(
        users.map(async (m: any) => {
            const purchaseItem = {
                purchaseId: getPurchaseId(),
                amount: purchaseAmount,
                loyalty: loyaltyAmount,
                currency: "php",
                shopId: shops[shops.length - 1].shopId,
                account: AddressZero,
                phone: ContractUtils.getPhoneHash(m.phone),
                sender: accounts.system.address,
                signature: "",
            };
            purchaseItem.signature = await ContractUtils.getPurchaseSignature(accounts.publisher, purchaseItem);
            return purchaseItem;
        })
    );
    const purchaseMessage3 = ContractUtils.getPurchasesMessage(0, purchaseParams3, chainId);
    const signatures3 = await Promise.all(
        accounts.validators.map((m) => ContractUtils.signMessage(m, purchaseMessage3))
    );
    const proposeMessage3 = ContractUtils.getPurchasesProposeMessage(0, purchaseParams3, signatures3, chainId);
    const proposerSignature3 = await ContractUtils.signMessage(accounts.validators[0], proposeMessage3);
    const tx3 = await contract
        .connect(accounts.certifiers[4])
        .savePurchase(0, purchaseParams3, signatures3, proposerSignature3);
    await tx3.wait();
}

async function main() {
    const deployments = new Deployments();

    await deployments.attachPreviousContracts();

    deployments.addDeployer(deployPhoneLink);
    deployments.addDeployer(mintInitialSupplyToken);
    deployments.addDeployer(distributeToken);

    deployments.addDeployer(writeTokenInfo);
    deployments.addDeployer(writeAccountInfo);

    deployments.addDeployer(deployValidator);
    deployments.addDeployer(deployCurrencyRate);
    deployments.addDeployer(deployLoyaltyBurner);
    deployments.addDeployer(deployLoyaltyProvider);
    deployments.addDeployer(deployLoyaltyConsumer);
    deployments.addDeployer(deployLoyaltyExchanger);
    deployments.addDeployer(deployLoyaltyTransfer);
    deployments.addDeployer(deployBridgeValidator);
    deployments.addDeployer(deployLoyaltyBridge);
    deployments.addDeployer(deployShop);
    deployments.addDeployer(deployLedger);
    deployments.addDeployer(deployInnerChainBridge);
    deployments.addDeployer(writeBalanceOfBridges);
    deployments.addDeployer(storeSampleExchangeRate);
    deployments.addDeployer(storeSamplePurchase1);
    deployments.addDeployer(storeSamplePurchase2);

    await deployments.doDeploy();

    deployments.saveContractInfo();
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
