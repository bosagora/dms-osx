import "@nomiclabs/hardhat-ethers";
import { Config } from "../common/Config";
import { logger } from "../common/Logger";
import { NodeStorage } from "../storage/NodeStorage";
import { Scheduler } from "./Scheduler";
import { CurrencyRate, LoyaltyProvider } from "../../typechain-types";
import { ethers } from "hardhat";
import { ContractUtils } from "../utils/ContractUtils";
import { ResponseMessage } from "../utils/Errors";
import { GasPriceManager } from "../contract/GasPriceManager";

import { NonceManager } from "@ethersproject/experimental";
import { BigNumber, Wallet } from "ethers";

import { NewTransaction } from "dms-store-purchase-sdk";

export class StoreScheduler extends Scheduler {
    private _config: Config | undefined;
    private _storage: NodeStorage | undefined;
    private _loyaltyProviderContract: LoyaltyProvider | undefined;
    private _currencyRateContract: CurrencyRate | undefined;
    private _validators: Wallet[] | undefined;

    constructor(expression: string) {
        super(expression);
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
        try {
            await this.onStorePurchase();
        } catch (error) {
            logger.error(`Failed to execute the onStorePurchase: ${error}`);
        }
        try {
            await this.onStoreExchangeRate();
        } catch (error) {
            logger.error(`Failed to execute the onStoreExchangeRate: ${error}`);
        }
    }

    private async onStorePurchase() {
        const txs = await this.storage.getPurchaseTransaction(this.config.setting.waitedProvide);
        if (txs.length > 0) {
            logger.info(`onStorePurchase, Length of txs: ${txs.length}`);
            await this.storePurchase(txs);
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

    private async storePurchase(txs: NewTransaction[]) {
        const contract = await this.getLoyaltyProviderContract();
        const validators = this.getValidators();
        const sender = new NonceManager(new GasPriceManager(validators[0]));
        const purchases = [];
        for (const tx of txs) {
            const loyalty = this.getLoyaltyInTransaction(tx);
            purchases.push({
                purchaseId: tx.purchaseId,
                amount: tx.cashAmount,
                loyalty: loyalty,
                currency: tx.currency.toLowerCase(),
                shopId: tx.shopId,
                account: tx.userAccount,
                phone: tx.userPhoneHash,
            });
        }
        const purchaseMessage = ContractUtils.getPurchasesMessage(0, purchases);
        const signatures = validators.map((m) => ContractUtils.signMessage(m, purchaseMessage));
        try {
            const contactTx = await contract.connect(sender).savePurchase(0, purchases, signatures);
            await contactTx.wait();
            await this.storage.storedTransaction(txs.map((m) => m.purchaseId));
            logger.info("onStorePurchase Success");
        } catch (error) {
            const msg = ResponseMessage.getEVMErrorMessage(error);
            logger.info(`onStorePurchase Fail - ${msg.code}, ${msg.error.message}`);
        }
    }

    private async onStoreExchangeRate() {
        const exchangeRates = await this.storage.getExchangeRate();
        if (exchangeRates.length > 0) {
            logger.info(`onStoreExchangeRate, Length of exchange rates: ${exchangeRates.length}`);
            const height = ContractUtils.getTimeStamp10();
            const validators = this.getValidators();
            const message = ContractUtils.getCurrencyMessage(height, exchangeRates);
            const signatures = validators.map((m) => ContractUtils.signMessage(m, message));
            const contract = await this.getCurrencyRateContract();
            const sender = new NonceManager(new GasPriceManager(validators[0]));
            try {
                const contactTx = await contract.connect(sender).set(height, exchangeRates, signatures);
                await contactTx.wait();
                logger.info("onStoreExchangeRate Success");
            } catch (error) {
                const msg = ResponseMessage.getEVMErrorMessage(error);
                logger.info(`onStoreExchangeRate Fail - ${msg.code}, ${msg.error.message}`);
            }
        }
    }
}
