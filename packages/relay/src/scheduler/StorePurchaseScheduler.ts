import "@nomiclabs/hardhat-ethers";
import { Config } from "../common/Config";
import { logger } from "../common/Logger";
import { ContractManager } from "../contract/ContractManager";
import { RelayStorage } from "../storage/RelayStorage";
import { ContractUtils } from "../utils/ContractUtils";
import { Scheduler } from "./Scheduler";

/**
 * Creates blocks at regular intervals and stores them in IPFS and databases.
 */
export class StorePurchaseScheduler extends Scheduler {
    private _config: Config | undefined;
    private _contractManager: ContractManager | undefined;
    private _storage: RelayStorage | undefined;

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

    private get storage(): RelayStorage {
        if (this._storage !== undefined) return this._storage;
        else {
            logger.error("Storage is not ready yet.");
            process.exit(1);
        }
    }

    private get contractManager(): ContractManager {
        if (this._contractManager !== undefined) return this._contractManager;
        else {
            logger.error("ContractManager is not ready yet.");
            process.exit(1);
        }
    }

    public setOption(options: any) {
        if (options) {
            if (options.config && options.config instanceof Config) this._config = options.config;
            if (options.contractManager && options.contractManager instanceof ContractManager)
                this._contractManager = options.contractManager;
            if (options.storage && options.storage instanceof RelayStorage) this._storage = options.storage;
        }
    }

    public async onStart() {
        //
    }

    protected async work() {
        try {
            await this.onWatchStorePurchase();
        } catch (error) {
            logger.error(`Failed to execute the StorePurchaseScheduler: ${error}`);
        }
    }

    private async onWatchStorePurchase() {
        const purchases = await this.storage.getStorePurchase();
        for (const purchase of purchases) {
            const stored = await this.contractManager.sideLoyaltyProviderContract.purchasesOf(purchase.purchaseId);
            if (stored) {
                await this.storage.doneStorePurchase(purchase.purchaseId);
            } else if (purchase.timestamp + purchase.waiting + BigInt(60) < ContractUtils.getTimeStampBigInt()) {
                await this.storage.doneStorePurchase(purchase.purchaseId);
            }
        }
    }
}
