import "@nomiclabs/hardhat-ethers";
import { LoyaltyProvider } from "../../typechain-types";
import { Config } from "../common/Config";
import { logger } from "../common/Logger";
import { RelayStorage } from "../storage/RelayStorage";
import { ContractUtils } from "../utils/ContractUtils";
import { Scheduler } from "./Scheduler";

import * as hre from "hardhat";

/**
 * Creates blocks at regular intervals and stores them in IPFS and databases.
 */
export class StorePurchaseScheduler extends Scheduler {
    private _config: Config | undefined;

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

    public setOption(options: any) {
        if (options) {
            if (options.config && options.config instanceof Config) this._config = options.config;
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
            logger.error(`Failed to execute the WatchScheduler: ${error}`);
        }
    }

    private _providerContract: LoyaltyProvider | undefined;
    private async getProviderContract(): Promise<LoyaltyProvider> {
        if (this._providerContract === undefined) {
            const factory = await hre.ethers.getContractFactory("LoyaltyProvider");
            this._providerContract = factory.attach(this.config.contracts.providerAddress);
        }
        return this._providerContract;
    }

    private async onWatchStorePurchase() {
        const purchases = await this.storage.getStorePurchase();
        for (const purchase of purchases) {
            const stored = await (await this.getProviderContract()).purchasesOf(purchase.purchaseId);
            if (stored) {
                await this.storage.doneStorePurchase(purchase.purchaseId);
            } else if (
                purchase.timestamp <
                ContractUtils.getTimeStampBigInt() - BigInt(this.config.relay.storePurchaseWaitingSecond)
            ) {
                await this.storage.doneStorePurchase(purchase.purchaseId);
            }
        }
    }
}
