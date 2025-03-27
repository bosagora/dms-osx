import "@nomiclabs/hardhat-ethers";
import "@nomiclabs/hardhat-waffle";
import "@openzeppelin/hardhat-upgrades";

import { HardhatAccount } from "../../src/HardhatAccount";
import { Amount, BOACoin } from "../../src/utils/Amount";
import { ContractUtils } from "../../src/utils/ContractUtils";
import { BridgeValidator, ERC20, LoyaltyToken, NonDelegatedBridge } from "../../typechain-types";

import { BaseContract, Contract, Wallet } from "ethers";

import fs from "fs";

import * as hre from "hardhat";

const network = "outer_chain_devnet";

export const LOYALTY_TOKEN_ADDRESSES: { [key: string]: string } = {
    outer_chain_devnet: "0x173A004aCf3aF9ccc0785346F17733eA33f65BB9",
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
        this.LOYALTY_TOKEN_CONTRACT = (await hre.ethers.getContractFactory("ERC20")).attach(
            LOYALTY_TOKEN_ADDRESSES[network]
        ) as ERC20;
    }

    public addContract(name: string, address: string, contract: BaseContract) {
        this.deployments.set(name, {
            name,
            address,
            contract,
        });
    }

    public getContract(name: string): BaseContract | undefined {
        if (name === "LoyaltyToken") {
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
        if (name === "LoyaltyToken") {
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

    static filename = "./deploy/outer_chain_devnet/deployed_contracts.json";

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

async function distributeToken(accounts: IAccount, deployment: Deployments) {
    const contractName = "LoyaltyToken";

    const contract = deployment.getContract("LoyaltyToken") as LoyaltyToken;

    {
        const userAmount = BOACoin.make(200_000);
        const users = JSON.parse(fs.readFileSync("./deploy/data/users.json", "utf8"));
        for (const account of users) {
            const tx = await contract.connect(accounts.owner).transfer(account.address, userAmount.value);
            console.log(`Transfer token to users (tx: ${tx.hash})...`);
            // await tx.wait();
            await ContractUtils.delay(3000);
        }
    }
    console.log(`Distribute ${contractName}`);
}

async function writeTokenInfo(accounts: IAccount, deployment: Deployments) {
    console.log(`Information of token`);
    const tokenContract = deployment.getContract("LoyaltyToken") as ERC20;
    console.log(`Name of token: ${await tokenContract.name()}`);
    console.log(`Symbol of token: ${await tokenContract.symbol()}`);
    console.log(`Address of token: ${tokenContract.address}`);
    console.log(`Total supply of token: ${new BOACoin(await tokenContract.totalSupply()).toDisplayString(true, 4)}`);
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

async function deployOuterChainBridge(accounts: IAccount, deployment: Deployments) {
    const contractName = "OuterChainBridge";
    console.log(`Deploy ${contractName}...`);
    if (deployment.getContract("BridgeValidator") === undefined) {
        console.error("Contract is not deployed!");
        return;
    }

    const factory = await hre.ethers.getContractFactory("NonDelegatedBridge");
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
        // ERC20 Token
        const tokenContract = deployment.getContract("LoyaltyToken") as ERC20;

        const tokenId = ContractUtils.getTokenId(await tokenContract.name(), await tokenContract.symbol());
        const tx3 = await contract.connect(accounts.deployer).registerToken(tokenId, tokenContract.address);
        console.log(`Register Token (tx: ${tx3.hash})...`);
        await tx3.wait();

        const assetAmount = Amount.make(9_800_000_000, 18).value;
        const tx4 = await tokenContract.connect(accounts.owner).transfer(contract.address, assetAmount);
        console.log(`Deposit Token to OutChainBridge (tx: ${tx4.hash})...`);
        await tx4.wait();
    }
}

async function writeBalanceOfBridges(accounts: IAccount, deployment: Deployments) {
    const tokenContract = deployment.getContract("LoyaltyToken") as ERC20;
    console.log(
        `Balance of owner's token ${new BOACoin(await tokenContract.balanceOf(accounts.owner.address)).toDisplayString(
            true,
            4
        )}`
    );
    console.log(
        `Balance of outer chain bridge's token   ${new BOACoin(
            await tokenContract.balanceOf(deployment.getContractAddress("OuterChainBridge") || "")
        ).toDisplayString(true, 4)}`
    );
}

async function main() {
    const deployments = new Deployments();

    await deployments.attachPreviousContracts();

    deployments.addDeployer(distributeToken);
    deployments.addDeployer(writeTokenInfo);
    deployments.addDeployer(writeAccountInfo);
    deployments.addDeployer(deployBridgeValidator);
    deployments.addDeployer(deployOuterChainBridge);
    deployments.addDeployer(writeBalanceOfBridges);
    await deployments.doDeploy();
    deployments.saveContractInfo();
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
