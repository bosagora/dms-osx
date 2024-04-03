import "@nomiclabs/hardhat-ethers";
import "@nomiclabs/hardhat-waffle";
import "@openzeppelin/hardhat-upgrades";

import { HardhatAccount } from "../../src/HardhatAccount";
import { Amount, BOACoin } from "../../src/utils/Amount";
import { ContractUtils } from "../../src/utils/ContractUtils";
import { Bridge, BridgeValidator, LoyaltyToken, MultiSigWallet } from "../../typechain-types";

import { BaseContract, Contract, Wallet } from "ethers";

import fs from "fs";

import * as hre from "hardhat";
import { ethers, upgrades } from "hardhat";

const network = "main_chain_devnet";

export const MULTI_SIG_WALLET_ADDRESSES: { [key: string]: string } = {
    main_chain_devnet: "0x6d9493FB6D8c8bD3534a3E1F4163921161BEf187",
    side_chain_devnet: "0x6d9493FB6D8c8bD3534a3E1F4163921161BEf187",
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
    foundation: Wallet;
    settlement: Wallet;
    fee: Wallet;
    txFee: Wallet;
    validators: Wallet[];
    linkValidators: Wallet[];
    bridgeValidators: Wallet[];
    certifiers: Wallet[];
    tokenOwners: Wallet[];
}

type FnDeployer = (accounts: IAccount, deployment: Deployments) => void;

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
            tokenOwner1,
            tokenOwner2,
            tokenOwner3,
        ] = raws;

        this.accounts = {
            deployer,
            owner,
            foundation,
            settlement,
            fee,
            txFee,
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

    public async loadContractInfo() {
        if (!fs.existsSync(Deployments.filename)) return;

        const data: any = JSON.parse(fs.readFileSync(Deployments.filename, "utf-8"));

        for (const key of Object.keys(data)) {
            let name: string;
            if (key === "LoyaltyBridge") {
                name = "Bridge";
            } else if (key === "MainChainBridge") {
                name = "Bridge";
            } else {
                name = key;
            }
            const address = data[key];
            console.log(`Load ${name} - ${address}...`);
            this.deployments.set(key, {
                name,
                address,
                contract: (await hre.ethers.getContractFactory(name)).attach(address),
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

async function deployToken(accounts: IAccount, deployment: Deployments) {
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
        const tx1 = await contract.connect(accounts.owner).transfer(accounts.foundation.address, assetAmount.value);
        console.log(`Transfer token to foundation (tx: ${tx1.hash})...`);
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

    const chainId = (await ethers.provider.getNetwork()).chainId;
    {
        const tokenContract = (await deployment.getContract("LoyaltyToken")) as LoyaltyToken;
        const tokenId = ContractUtils.getTokenId(await tokenContract.name(), await tokenContract.symbol());
        const tx = await contract.connect(accounts.deployer).registerToken(tokenId, tokenContract.address);
        console.log(`Register Token (tx: ${tx.hash})...`);
        await tx.wait();

        const assetAmount = Amount.make(8_000_000_000, 18).value;
        const nonce = await tokenContract.nonceOf(accounts.owner.address);
        const message = ContractUtils.getTransferMessage(
            accounts.owner.address,
            contract.address,
            assetAmount,
            nonce,
            chainId
        );
        const signature = await ContractUtils.signMessage(accounts.owner, message);
        const tx1 = await contract.connect(accounts.owner).depositLiquidity(tokenId, assetAmount, signature);
        console.log(`Deposit liquidity token to SideChainBridge (tx: ${tx1.hash})...`);
        await tx1.wait();
    }
}

async function deployMainChainBridge(accounts: IAccount, deployment: Deployments) {
    const contractName = "MainChainBridge";
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

    const chainId = (await ethers.provider.getNetwork()).chainId;
    {
        const tokenContract = (await deployment.getContract("LoyaltyToken")) as LoyaltyToken;
        const tokenId = ContractUtils.getTokenId(await tokenContract.name(), await tokenContract.symbol());
        const tx = await contract.connect(accounts.deployer).registerToken(tokenId, tokenContract.address);
        console.log(`Register Token (tx: ${tx.hash})...`);
        await tx.wait();

        const assetAmount = Amount.make(100_000_000, 18).value;
        const nonce = await tokenContract.nonceOf(accounts.owner.address);
        const message = ContractUtils.getTransferMessage(
            accounts.owner.address,
            contract.address,
            assetAmount,
            nonce,
            chainId
        );
        const signature = await ContractUtils.signMessage(accounts.owner, message);
        const tx1 = await contract.connect(accounts.owner).depositLiquidity(tokenId, assetAmount, signature);
        console.log(`Deposit liquidity token to SideChainBridge (tx: ${tx1.hash})...`);
        await tx1.wait();
    }
}

async function main() {
    const deployments = new Deployments();

    await deployments.attachPreviousContracts();

    deployments.addDeployer(deployToken);
    deployments.addDeployer(deployBridgeValidator);
    deployments.addDeployer(deployLoyaltyBridge);
    deployments.addDeployer(deployMainChainBridge);

    await deployments.doDeploy();

    deployments.saveContractInfo();
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
