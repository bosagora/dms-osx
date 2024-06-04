import "@nomiclabs/hardhat-ethers";
import { Config } from "../common/Config";
import { logger } from "../common/Logger";
import { ContractManager } from "../contract/ContractManager";
import { Metrics } from "../metrics/Metrics";
import { GraphStorage } from "../storage/GraphStorage";
import { RelayStorage } from "../storage/RelayStorage";
import { IStatisticsAccountBalance } from "../types";
import { Scheduler } from "./Scheduler";

/**
 * Creates blocks at regular intervals and stores them in IPFS and databases.
 */
export class MetricsScheduler extends Scheduler {
    private _config: Config | undefined;
    private _contractManager: ContractManager | undefined;
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

    private get contractManager(): ContractManager {
        if (this._contractManager !== undefined) return this._contractManager;
        else {
            logger.error("ContractManager is not ready yet.");
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
            if (options.contractManager && options.contractManager instanceof ContractManager)
                this._contractManager = options.contractManager;
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
                    "shop_total_refunded_amount_clear",
                    { currency: elem.currency },
                    elem.total_refunded_amount
                );
            }
        } catch (error) {
            logger.error(`Failed to execute the MetricsScheduler: ${error}`);
        }
    }

    private async scanBalance(): Promise<IStatisticsAccountBalance[]> {
        const res: IStatisticsAccountBalance[] = [];
        const contract = this.contractManager.sideLedgerContract;
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
        const symbol = await this.contractManager.sideTokenContract.symbol();
        const rate = await this.contractManager.sideCurrencyRateContract.get(symbol);
        return Number(rate);
    }
}
