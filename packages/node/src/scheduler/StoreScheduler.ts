import "@nomiclabs/hardhat-ethers";
import { CurrencyRate, LoyaltyProvider } from "../../typechain-types";
import { Block } from "../block/Block";
import { BlockStorage } from "../block/BlockStorage";
import { ExchangeRate, ExchangeRateRoot } from "../block/ExchangeRate";
import { Purchase, PurchaseRoot } from "../block/Purchase";
import { Config } from "../common/Config";
import { logger } from "../common/Logger";
import { GasPriceManager } from "../contract/GasPriceManager";
import { NodeStorage } from "../storage/NodeStorage";
import { ContractUtils } from "../utils/ContractUtils";
import { ResponseMessage } from "../utils/Errors";
import { Scheduler } from "./Scheduler";

import { ethers } from "hardhat";

import { BigNumber, Wallet } from "ethers";

import { NonceManager } from "@ethersproject/experimental";
import { NewTransaction } from "dms-store-purchase-sdk";

export class StoreScheduler extends Scheduler {
    private _config: Config | undefined;
    private _storage: NodeStorage | undefined;
    private _loyaltyProviderContract: LoyaltyProvider | undefined;
    private _currencyRateContract: CurrencyRate | undefined;
    private _validators: Wallet[] | undefined;
    private _blockStorage: BlockStorage;

    constructor(expression: string) {
        super(expression);
        this._blockStorage = new BlockStorage();
    }

    private get config(): Config {
        if (this._config !== undefined) return this._config;
        else {
            logger.error("Config is not ready yet.");
            process.exit(1);
        }
    }

    private get storage(): NodeStorage {
        if (this._storage !== undefined) return this._storage;
        else {
            logger.error("Storage is not ready yet.");
            process.exit(1);
        }
    }

    public setOption(options: any) {
        if (options) {
            if (options.config && options.config instanceof Config) this._config = options.config;
            if (options.storage && options.storage instanceof NodeStorage) this._storage = options.storage;
        }
    }

    private async getLoyaltyProviderContract(): Promise<LoyaltyProvider> {
        if (this._loyaltyProviderContract === undefined) {
            const factory = await ethers.getContractFactory("LoyaltyProvider");
            this._loyaltyProviderContract = factory.attach(this.config.contracts.providerAddress);
        }
        return this._loyaltyProviderContract;
    }

    private async getCurrencyRateContract(): Promise<CurrencyRate> {
        if (this._currencyRateContract === undefined) {
            const factory = await ethers.getContractFactory("CurrencyRate");
            this._currencyRateContract = factory.attach(this.config.contracts.currencyRateAddress);
        }
        return this._currencyRateContract;
    }

    private getValidators(): Wallet[] {
        if (this._validators === undefined) {
            this._validators = this.config.validator.keys.map((m) => new Wallet(m, ethers.provider));
        }
        return this._validators;
    }

    protected async work() {
        const latestBlockTime = this._blockStorage.getLatestBlockTimestamp();
        const currentTime = BigInt(ContractUtils.getTimeStamp());
        if (currentTime - latestBlockTime >= BigInt(this.config.setting.blockInterval)) {
            const latestHash = this._blockStorage.getLatestBlockHash();
            const latestHeight = this._blockStorage.getLatestBlockHeight();
            const block = Block.createBlankBlock(latestHash, latestHeight);
            try {
                await this.loadRawData(block);
                await this.makeHash(block);
                await this.makeProposal(block);
                await this.makeAgreement(block);
                await this.saveToContract(block);
                await this.saveToStorage(block);
                console.log(JSON.stringify(block));
            } catch (error) {
                logger.error(`Failed to execute the StoreScheduler: ${error}`);
            }
        }
    }

    private async loadRawData(block: Block) {
        await this.loadPurchase(block.purchases);
        await this.loadExchangeRate(block.exchangeRates);
    }

    private async loadPurchase(purchases: PurchaseRoot) {
        const contract = await this.getLoyaltyProviderContract();
        const txs = await this.storage.getPurchaseTransaction(this.config.setting.waitedProvide);
        if (txs.length > 0) {
            logger.info(`onStorePurchase, Length of txs: ${txs.length}`);
            for (const tx of txs) {
                if (await contract.purchasesOf(tx.purchaseId)) {
                    await this.storage.storedTransaction([tx.purchaseId]);
                } else {
                    const loyalty = this.getLoyaltyInTransaction(tx);
                    const purchase = new Purchase(
                        tx.purchaseId,
                        tx.cashAmount,
                        loyalty,
                        tx.currency.toLowerCase(),
                        tx.shopId,
                        tx.userAccount,
                        tx.userPhoneHash
                    );
                    purchases.addItem(purchase);
                }
            }
        }
    }

    private getLoyaltyInTransaction(tx: NewTransaction): BigNumber {
        if (tx.totalAmount.eq(0)) return BigNumber.from(0);
        if (tx.cashAmount.eq(0)) return BigNumber.from(0);
        let sum: BigNumber = BigNumber.from(0);
        for (const elem of tx.details) {
            sum = sum.add(elem.amount.mul(elem.providePercent));
        }
        return sum.mul(tx.cashAmount).div(tx.totalAmount).div(10000);
    }

    private async loadExchangeRate(exchangeRates: ExchangeRateRoot) {
        const records = await this.storage.getExchangeRate();
        if (records.length > 0) {
            logger.info(`onStoreExchangeRate, Length of exchange rates: ${records.length}`);
            for (const elem of records) exchangeRates.addItem(new ExchangeRate(elem.symbol, BigNumber.from(elem.rate)));
        }
    }

    private async makeHash(block: Block) {
        block.header.purchaseHash = block.purchases.computeHash(block.header.height);
        block.header.exchangeRateHash = block.exchangeRates.computeHash(block.header.height);
        block.header.burnPointHash = block.burnPoints.computeHash(block.header.height);
    }

    private async makeProposal(block: Block) {
        const validators = this.getValidators();
        await block.header.sign(validators[0]);
    }

    private async makeAgreement(block: Block) {
        const validators = this.getValidators();

        for (const validator of validators) {
            for (let index = 0; index < block.purchases.branches.length; index++) {
                const branch = block.purchases.branches[index];
                block.purchases.signatures.push({
                    index,
                    signature: await branch.sign(validator, block.header.height),
                });
            }
            for (let index = 0; index < block.exchangeRates.branches.length; index++) {
                const branch = block.exchangeRates.branches[index];
                block.exchangeRates.signatures.push({
                    index,
                    signature: await branch.sign(validator, block.header.height),
                });
            }
            for (let index = 0; index < block.burnPoints.branches.length; index++) {
                const branch = block.burnPoints.branches[index];
                block.burnPoints.signatures.push({
                    index,
                    signature: await branch.sign(validator, block.header.height),
                });
            }
        }
    }

    private async saveToContract(block: Block) {
        await this.savePurchaseToContract(block);
        await this.saveExchangeRateToContract(block);
    }

    private async savePurchaseToContract(block: Block) {
        const contract = await this.getLoyaltyProviderContract();
        const validators = this.getValidators();
        const sender = new NonceManager(new GasPriceManager(validators[0]));
        for (let index = 0; index < block.purchases.branches.length; index++) {
            const branch = block.purchases.branches[index];
            try {
                const signatures = block.purchases.signatures.filter((m) => m.index === index).map((m) => m.signature);
                const contactTx = await contract
                    .connect(sender)
                    .savePurchase(block.header.height, branch.items, signatures);
                await contactTx.wait();
                await this.storage.storedTransaction(branch.items.map((m) => m.purchaseId));
                logger.info("onStorePurchase Success");
            } catch (error) {
                const msg = ResponseMessage.getEVMErrorMessage(error);
                logger.info(`onStorePurchase Fail - ${msg.code}, ${msg.error.message}`);
            }
        }
    }

    private async saveExchangeRateToContract(block: Block) {
        const contract = await this.getCurrencyRateContract();
        const validators = this.getValidators();
        const sender = new NonceManager(new GasPriceManager(validators[0]));
        for (let index = 0; index < block.exchangeRates.branches.length; index++) {
            const branch = block.exchangeRates.branches[index];
            try {
                const signatures = block.exchangeRates.signatures
                    .filter((m) => m.index === index)
                    .map((m) => m.signature);
                const contactTx = await contract.connect(sender).set(block.header.height, branch.items, signatures);
                await contactTx.wait();
                logger.info("onStoreExchangeRate Success");
            } catch (error) {
                const msg = ResponseMessage.getEVMErrorMessage(error);
                logger.info(`onStoreExchangeRate Fail - ${msg.code}, ${msg.error.message}`);
            }
        }
    }

    private async saveToStorage(block: Block) {
        await this._blockStorage.save(block);
    }
}
