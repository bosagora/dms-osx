import "@nomiclabs/hardhat-ethers";
import "@nomiclabs/hardhat-waffle";
import "@openzeppelin/hardhat-upgrades";

import { HardhatAccount } from "../../src/HardhatAccount";
import { Amount, BOACoin } from "../../src/utils/Amount";
import { ContractUtils } from "../../src/utils/ContractUtils";
import {
    Bridge,
    BridgeValidator,
    NonDelegatedBridge,
    LoyaltyToken,
    MultiSigWallet,
    ERC20,
} from "../../typechain-types";

import { BaseContract, Contract, Wallet } from "ethers";

import fs from "fs";

import * as hre from "hardhat";

import { AddressZero, HashZero } from "@ethersproject/constants";

const network = "main_chain_devnet";

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
            deployer: deployer_main_chain,
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

    static filename = "./deploy/main_chain_devnet/deployed_contracts.json";

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
        const assetAmount = Amount.make(1_500_000_000, 18);
        const tx1 = await contract.connect(accounts.owner).transfer(accounts.system.address, assetAmount.value);
        console.log(`Transfer token to system (tx: ${tx1.hash})...`);
        await tx1.wait();

        const userAmount = Amount.make(200_000, 18);
        const users = JSON.parse(fs.readFileSync("./deploy/data/users.json", "utf8"));
        for (const account of users) {
            const tx = await contract.connect(accounts.owner).transfer(account.address, userAmount.value);
            console.log(`Transfer token to users (tx: ${tx.hash})...`);
            // await tx.wait();
            await ContractUtils.delay(3000);
        }

        const users_mobile = JSON.parse(fs.readFileSync("./deploy/data/users_mobile.json", "utf8"));
        for (const account of users_mobile) {
            const tx = await contract.connect(accounts.owner).transfer(account.address, userAmount.value);
            console.log(`Transfer token to users_mobile (tx: ${tx.hash})...`);
            // await tx.wait();
            await ContractUtils.delay(3000);
        }
    }
    console.log(`Distribute ${contractName}`);
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
        const tokenContract = deployment.getContract("LoyaltyToken") as LoyaltyToken;
        const tokenId = ContractUtils.getTokenId(await tokenContract.name(), await tokenContract.symbol());
        const tx = await contract.connect(accounts.deployer).registerToken(tokenId, tokenContract.address);
        console.log(`Register Token (tx: ${tx.hash})...`);
        await tx.wait();

        const assetAmount = Amount.make(8_000_000_000, 18).value;
        const tx1 = await tokenContract.connect(accounts.owner).transfer(contract.address, assetAmount);
        await tx1.wait();
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
        console.log(`Deposit Native Token to InnerChainBridge Bridge (tx: ${tx2.hash})...`);
        await tx2.wait();

        // BIP20 Token
        const tokenContract = deployment.getContract("LoyaltyToken") as LoyaltyToken;
        const tokenId = ContractUtils.getTokenId(await tokenContract.name(), await tokenContract.symbol());
        const tx3 = await contract.connect(accounts.deployer).registerToken(tokenId, tokenContract.address);
        console.log(`Register Loyalty Token (tx: ${tx3.hash})...`);
        await tx3.wait();

        const assetAmount = Amount.make(200_000_000, 18).value;
        const tx4 = await tokenContract.connect(accounts.owner).transfer(contract.address, assetAmount);
        console.log(`Deposit Loyalty Token to InnerChainBridge (tx: ${tx4.hash})...`);
        await tx4.wait();
    }
}

async function deployOuterChainBridge(accounts: IAccount, deployment: Deployments) {
    const contractName = "OuterChainBridge";
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
    )) as NonDelegatedBridge;
    await contract.deployed();
    await contract.deployTransaction.wait();

    deployment.addContract(contractName, contract.address, contract);
    console.log(`Deployed ${contractName} to ${contract.address}`);

    {
        // BIP20 Token
        const tokenContract = deployment.getContract("LoyaltyToken") as LoyaltyToken;
        const tokenId = ContractUtils.getTokenId(await tokenContract.name(), await tokenContract.symbol());
        const tx3 = await contract.connect(accounts.deployer).registerToken(tokenId, tokenContract.address);
        console.log(`Register Loyalty Token (tx: ${tx3.hash})...`);
        await tx3.wait();

        const assetAmount = Amount.make(200_000_000, 18).value;
        const tx4 = await tokenContract.connect(accounts.owner).transfer(contract.address, assetAmount);
        console.log(`Deposit Loyalty Token to OuterChainBridge (tx: ${tx4.hash})...`);
        await tx4.wait();
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
    console.log(`Balance of owner's token          ${(new BOACoin(await tokenContract.balanceOf(accounts.owner.address))).toDisplayString(true, 4)}`);
    console.log(`Balance of loyalty bridge's token ${(new BOACoin(await tokenContract.balanceOf(deployment.getContractAddress("LoyaltyBridge") || ""))).toDisplayString(true, 4)}`);
    console.log(`Balance of inner chain bridge's token   ${(new BOACoin(await tokenContract.balanceOf(deployment.getContractAddress("InnerChainBridge") || ""))).toDisplayString(true, 4)}`);
    console.log(`Balance of outer chain bridge's token   ${(new BOACoin(await tokenContract.balanceOf(deployment.getContractAddress("OuterChainBridge") || ""))).toDisplayString(true, 4)}`);
}

async function main() {
    const deployments = new Deployments();

    await deployments.attachPreviousContracts();

    deployments.addDeployer(mintInitialSupplyToken);
    deployments.addDeployer(distributeToken);

    deployments.addDeployer(writeTokenInfo);
    deployments.addDeployer(writeAccountInfo);

    deployments.addDeployer(deployBridgeValidator);
    deployments.addDeployer(deployLoyaltyBridge);
    deployments.addDeployer(deployInnerChainBridge);
    deployments.addDeployer(deployOuterChainBridge);
    deployments.addDeployer(writeBalanceOfBridges);

    await deployments.doDeploy();

    deployments.saveContractInfo();
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
