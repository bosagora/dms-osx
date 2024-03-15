import "@nomiclabs/hardhat-ethers";
import { CurrencyRate, Ledger, LoyaltyToken } from "../../typechain-types";
import { Config } from "../common/Config";
import { logger } from "../common/Logger";
import { GraphStorage } from "../storage/GraphStorage";
import { RelayStorage } from "../storage/RelayStorage";
import { Scheduler } from "./Scheduler";
import { Metrics } from "../metrics/Metrics";

import { IStatisticsAccountBalance } from "../types";

import * as hre from "hardhat";

/**
 * Creates blocks at regular intervals and stores them in IPFS and databases.
 */
export class MetricsScheduler extends Scheduler {
    private _config: Config | undefined;
    private _metrics: Metrics | undefined;
    private _storage: RelayStorage | undefined;
    private _graph: GraphStorage | undefined;

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

    private get metrics(): Metrics {
        if (this._metrics !== undefined) return this._metrics;
        else {
            logger.error("Metrics is not ready yet.");
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

    private get graph(): GraphStorage {
        if (this._graph !== undefined) return this._graph;
        else {
            logger.error("GraphStorage is not ready yet.");
            process.exit(1);
        }
    }

    public setOption(options: any) {
        if (options) {
            if (options.config && options.config instanceof Config) this._config = options.config;
            if (options.storage && options.storage instanceof RelayStorage) this._storage = options.storage;
            if (options.graph && options.graph instanceof GraphStorage) this._graph = options.graph;
            if (options.metrics && options.metrics instanceof Metrics) this._metrics = options.metrics;
        }
    }

    public async onStart() {
        //
    }

    protected async work() {
        try {
            const balances = await this.scanBalance();
            for (const m of balances) {
                this.metrics.gaugeLabels("system_account_balance", { name: m.name }, m.balance);
            }
            const phoneAccountStatistics = await this.graph.getPhoneAccountStatistics();
            this.metrics.add("phone_account_count", phoneAccountStatistics.account_count);
            this.metrics.add("phone_account_total_balance", phoneAccountStatistics.total_balance);

            const pointAccountStatistics = await this.graph.getPointAccountStatistics(
                this.config.metrics.accounts.map((m) => m.address.toLowerCase())
            );
            this.metrics.add("point_account_count", pointAccountStatistics.account_count);
            this.metrics.add("point_account_total_balance", pointAccountStatistics.total_balance);

            const tokenAccountStatistics = await this.graph.getTokenAccountStatistics(
                this.config.metrics.accounts.map((m) => m.address.toLowerCase())
            );
            this.metrics.add("token_account_count", tokenAccountStatistics.account_count);
            this.metrics.add("token_account_total_balance", tokenAccountStatistics.total_balance);

            const price = await this.scanTokenPrice();
            this.metrics.add("token_price", price);

            const shopCount = await this.graph.getShopCount();
            this.metrics.add("shop_count", shopCount);

            const shopStatistics = await this.graph.getShopStatistics();
            for (const elem of shopStatistics) {
                if (elem.shop_count > 0)
                    this.metrics.gaugeLabels("shop_count_clear", { currency: elem.currency }, elem.shop_count);
                this.metrics.gaugeLabels(
                    "shop_total_provided_amount_clear",
                    { currency: elem.currency },
                    elem.total_provided_amount
                );
                this.metrics.gaugeLabels(
                    "shop_total_used_amount_clear",
                    { currency: elem.currency },
                    elem.total_used_amount
                );
                this.metrics.gaugeLabels(
                    "shop_total_withdrawable_amount_clear",
                    { currency: elem.currency },
                    elem.total_withdrawable_amount
                );
            }
        } catch (error) {
            logger.error(`Failed to execute the MetricsScheduler: ${error}`);
        }
    }

    private _ledgerContract: Ledger | undefined;
    private async getLedgerContract(): Promise<Ledger> {
        if (this._ledgerContract === undefined) {
            const factory = await hre.ethers.getContractFactory("Ledger");
            this._ledgerContract = factory.attach(this.config.contracts.ledgerAddress);
        }
        return this._ledgerContract;
    }

    private _currencyContract: CurrencyRate | undefined;
    private async getCurrencyContract(): Promise<CurrencyRate> {
        if (this._currencyContract === undefined) {
            const factory = await hre.ethers.getContractFactory("CurrencyRate");
            this._currencyContract = factory.attach(this.config.contracts.currencyRateAddress);
        }
        return this._currencyContract;
    }

    private _tokenContract: LoyaltyToken | undefined;
    private async getLoyaltyTokenContract(): Promise<LoyaltyToken> {
        if (this._tokenContract === undefined) {
            const factory = await hre.ethers.getContractFactory("LoyaltyToken");
            this._tokenContract = factory.attach(this.config.contracts.tokenAddress);
        }
        return this._tokenContract;
    }

    private async scanBalance(): Promise<IStatisticsAccountBalance[]> {
        const res: IStatisticsAccountBalance[] = [];
        const contract = await this.getLedgerContract();
        for (const account of this.config.metrics.accounts) {
            const balance = await contract.tokenBalanceOf(account.address);
            res.push({
                name: account.name,
                balance: Number(balance.div(1_000_000_000)),
            });
        }
        return res;
    }

    private async scanTokenPrice(): Promise<number> {
        const token = await this.getLoyaltyTokenContract();
        const contract = await this.getCurrencyContract();
        const symbol = await token.symbol();
        const rate = await contract.get(symbol);
        return Number(rate);
    }
}
