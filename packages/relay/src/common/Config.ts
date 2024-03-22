import { ArgumentParser } from "argparse";
import { Utils } from "../utils/Utils";

import extend from "extend";
import fs from "fs";
import ip from "ip";
import path from "path";
import { readYamlEnvSync } from "yaml-env-defaults";

export class Config implements IConfig {
    public server: ServerConfig;

    public database: DatabaseConfig;

    public graph: DatabaseConfig;

    public logging: LoggingConfig;

    public scheduler: SchedulerConfig;

    public relay: RelayConfig;

    public contracts: ContractsConfig;

    public metrics: MetricsConfig;

    constructor() {
        this.server = new ServerConfig();
        this.database = new DatabaseConfig();
        this.graph = new DatabaseConfig();
        this.logging = new LoggingConfig();
        this.scheduler = new SchedulerConfig();
        this.relay = new RelayConfig();
        this.contracts = new ContractsConfig();
        this.metrics = new MetricsConfig();
    }

    public static createWithArgument(): Config {
        // Parse the arguments
        const parser = new ArgumentParser();
        parser.add_argument("-c", "--config", {
            default: "config.yaml",
            help: "Path to the config file to use",
        });
        const args = parser.parse_args();

        let configPath = path.resolve(Utils.getInitCWD(), args.config);
        if (!fs.existsSync(configPath)) configPath = path.resolve(Utils.getInitCWD(), "config", "config.yaml");
        if (!fs.existsSync(configPath)) {
            console.error(`Config file '${configPath}' does not exists`);
            process.exit(1);
        }

        const cfg = new Config();
        try {
            cfg.readFromFile(configPath);
        } catch (error: any) {
            // Logging setup has not been completed and is output to the console.
            console.error(error.message);

            // If the process fails to read the configuration file, the process exits.
            process.exit(1);
        }
        return cfg;
    }

    public readFromFile(config_file: string) {
        const cfg = readYamlEnvSync([path.resolve(Utils.getInitCWD(), config_file)], (key) => {
            return (process.env || {})[key];
        }) as IConfig;
        this.server.readFromObject(cfg.server);
        this.database.readFromObject(cfg.database);
        this.graph.readFromObject(cfg.graph);
        this.logging.readFromObject(cfg.logging);
        this.scheduler.readFromObject(cfg.scheduler);
        this.relay.readFromObject(cfg.relay);
        this.contracts.readFromObject(cfg.contracts);
        this.metrics.readFromObject(cfg.metrics);
    }
}

export class ServerConfig implements IServerConfig {
    public address: string;
    public port: number;

    constructor(address?: string, port?: number) {
        const conf = extend(true, {}, ServerConfig.defaultValue());
        extend(true, conf, { address, port });

        if (!ip.isV4Format(conf.address) && !ip.isV6Format(conf.address)) {
            console.error(`${conf.address}' is not appropriate to use as an IP address.`);
            process.exit(1);
        }

        this.address = conf.address;
        this.port = conf.port;
    }

    public static defaultValue(): IServerConfig {
        return {
            address: "127.0.0.1",
            port: 3000,
        };
    }

    public readFromObject(config: IServerConfig) {
        const conf = extend(true, {}, ServerConfig.defaultValue());
        extend(true, conf, config);

        if (!ip.isV4Format(conf.address) && !ip.isV6Format(conf.address)) {
            console.error(`${conf.address}' is not appropriate to use as an IP address.`);
            process.exit(1);
        }
        this.address = conf.address;
        this.port = conf.port;
    }
}

export class DatabaseConfig implements IDatabaseConfig {
    host: string;
    user: string;
    password: string;
    database: string;
    scheme: string;
    port: number;
    connectionTimeoutMillis: number;
    max: number;

    constructor(
        host?: string,
        user?: string,
        password?: string,
        database?: string,
        scheme?: string,
        port?: number,
        connectionTimeoutMillis?: number,
        max?: number
    ) {
        const conf = extend(true, {}, DatabaseConfig.defaultValue());
        extend(true, conf, {
            host,
            user,
            password,
            database,
            scheme,
            port,
            connectionTimeoutMillis,
            max,
        });
        this.host = conf.host;
        this.user = conf.user;
        this.password = conf.password;
        this.database = conf.database;
        this.scheme = conf.scheme;
        this.port = conf.port;
        this.connectionTimeoutMillis = conf.connectionTimeoutMillis;
        this.max = conf.max;
    }

    public static defaultValue(): IDatabaseConfig {
        return {
            host: "localhost",
            user: "root",
            password: "12345678",
            database: "relay",
            scheme: "",
            port: 5432,
            connectionTimeoutMillis: 2000,
            max: 20,
        };
    }

    public readFromObject(config: IDatabaseConfig) {
        const conf = extend(true, {}, DatabaseConfig.defaultValue());
        extend(true, conf, config);
        this.host = conf.host;
        this.user = conf.user;
        this.password = conf.password;
        this.database = conf.database;
        this.scheme = conf.scheme;
        this.port = conf.port;
        this.connectionTimeoutMillis = conf.connectionTimeoutMillis;
        this.max = conf.max;
    }
}

export class RelayConfig implements IRelayConfig {
    public managerKeys: string[];
    public accessKey: string;
    public callbackAccessKey: string;
    public callbackEndpoint: string;
    public paymentTimeoutSecond: number;
    public approvalSecond: number;
    public forcedCloseSecond: number;
    public expoAccessToken: string;
    public relayEndpoint: string;
    public encryptKey: string;

    constructor() {
        const defaults = RelayConfig.defaultValue();

        this.managerKeys = defaults.managerKeys;
        this.accessKey = defaults.accessKey;
        this.callbackAccessKey = defaults.callbackAccessKey;
        this.callbackEndpoint = defaults.callbackEndpoint;
        this.paymentTimeoutSecond = defaults.paymentTimeoutSecond;
        this.approvalSecond = defaults.approvalSecond;
        this.forcedCloseSecond = defaults.forcedCloseSecond;
        this.expoAccessToken = defaults.expoAccessToken;
        this.relayEndpoint = defaults.relayEndpoint;
        this.encryptKey = defaults.encryptKey;
    }

    public static defaultValue(): IRelayConfig {
        return {
            managerKeys: [
                process.env.CERTIFIER01 || "",
                process.env.CERTIFIER02 || "",
                process.env.CERTIFIER03 || "",
                process.env.CERTIFIER04 || "",
                process.env.CERTIFIER01 || "",
            ],
            accessKey: process.env.ACCESS_SECRET || "",
            callbackAccessKey: process.env.CALLBACK_ACCESS_KEY || "",
            callbackEndpoint: process.env.CALLBACK_ENDPOINT || "",
            paymentTimeoutSecond: 45,
            approvalSecond: 3,
            forcedCloseSecond: 300,
            expoAccessToken: "",
            relayEndpoint: "",
            encryptKey: "",
        };
    }

    public readFromObject(config: IRelayConfig) {
        if (config.managerKeys !== undefined) this.managerKeys = config.managerKeys;
        if (config.accessKey !== undefined) this.accessKey = config.accessKey;
        if (config.callbackAccessKey !== undefined) this.callbackAccessKey = config.callbackAccessKey;
        if (config.callbackEndpoint !== undefined) this.callbackEndpoint = config.callbackEndpoint;
        if (config.paymentTimeoutSecond !== undefined) this.paymentTimeoutSecond = config.paymentTimeoutSecond;
        if (config.approvalSecond !== undefined) this.approvalSecond = config.approvalSecond;
        if (config.forcedCloseSecond !== undefined) this.forcedCloseSecond = config.forcedCloseSecond;
        if (config.expoAccessToken !== undefined) this.expoAccessToken = config.expoAccessToken;
        if (config.relayEndpoint !== undefined) this.relayEndpoint = config.relayEndpoint;
        if (config.encryptKey !== undefined) this.encryptKey = config.encryptKey;
    }
}

export class ContractsConfig implements IContractsConfig {
    public tokenAddress: string;
    public ledgerAddress: string;
    public phoneLinkerAddress: string;
    public shopAddress: string;
    public currencyRateAddress: string;
    public loyaltyProviderAddress: string;
    public loyaltyConsumerAddress: string;
    public loyaltyExchangerAddress: string;
    public loyaltyTransferAddress: string;
    public loyaltyBridgeAddress: string;
    public sideChainBridgeAddress: string;

    constructor() {
        const defaults = ContractsConfig.defaultValue();

        this.tokenAddress = defaults.tokenAddress;
        this.ledgerAddress = defaults.ledgerAddress;
        this.phoneLinkerAddress = defaults.phoneLinkerAddress;
        this.shopAddress = defaults.shopAddress;
        this.currencyRateAddress = defaults.currencyRateAddress;
        this.loyaltyProviderAddress = defaults.loyaltyProviderAddress;
        this.loyaltyConsumerAddress = defaults.loyaltyConsumerAddress;
        this.loyaltyExchangerAddress = defaults.loyaltyExchangerAddress;
        this.loyaltyTransferAddress = defaults.loyaltyTransferAddress;
        this.loyaltyBridgeAddress = defaults.loyaltyBridgeAddress;
        this.sideChainBridgeAddress = defaults.sideChainBridgeAddress;
    }

    public static defaultValue(): IContractsConfig {
        return {
            tokenAddress: process.env.TOKEN_CONTRACT_ADDRESS || "",
            ledgerAddress: process.env.LEDGER_CONTRACT_ADDRESS || "",
            phoneLinkerAddress: process.env.PHONE_LINKER_CONTRACT_ADDRESS || "",
            shopAddress: process.env.SHOP_CONTRACT_ADDRESS || "",
            currencyRateAddress: process.env.CURRENCY_RATE_CONTRACT_ADDRESS || "",
            loyaltyProviderAddress: process.env.LOYALTY_PROVIDER_CONTRACT_ADDRESS || "",
            loyaltyConsumerAddress: process.env.LOYALTY_CONSUMER_CONTRACT_ADDRESS || "",
            loyaltyExchangerAddress: process.env.LOYALTY_EXCHANGER_CONTRACT_ADDRESS || "",
            loyaltyTransferAddress: process.env.LOYALTY_TRANSFER_CONTRACT_ADDRESS || "",
            loyaltyBridgeAddress: process.env.LOYALTY_BRIDGE_CONTRACT_ADDRESS || "",
            sideChainBridgeAddress: process.env.SIDE_CHAIN_BRIDGE_CONTRACT_ADDRESS || "",
        };
    }

    public readFromObject(config: IContractsConfig) {
        if (config.tokenAddress !== undefined) this.tokenAddress = config.tokenAddress;
        if (config.ledgerAddress !== undefined) this.ledgerAddress = config.ledgerAddress;
        if (config.phoneLinkerAddress !== undefined) this.phoneLinkerAddress = config.phoneLinkerAddress;
        if (config.shopAddress !== undefined) this.shopAddress = config.shopAddress;
        if (config.currencyRateAddress !== undefined) this.currencyRateAddress = config.currencyRateAddress;
        if (config.loyaltyProviderAddress !== undefined) this.loyaltyProviderAddress = config.loyaltyProviderAddress;
        if (config.loyaltyConsumerAddress !== undefined) this.loyaltyConsumerAddress = config.loyaltyConsumerAddress;
        if (config.loyaltyExchangerAddress !== undefined) this.loyaltyExchangerAddress = config.loyaltyExchangerAddress;
        if (config.loyaltyTransferAddress !== undefined) this.loyaltyTransferAddress = config.loyaltyTransferAddress;
        if (config.loyaltyBridgeAddress !== undefined) this.loyaltyBridgeAddress = config.loyaltyBridgeAddress;
        if (config.sideChainBridgeAddress !== undefined) this.sideChainBridgeAddress = config.sideChainBridgeAddress;
    }
}

export class LoggingConfig implements ILoggingConfig {
    public level: string;

    constructor() {
        const defaults = LoggingConfig.defaultValue();
        this.level = defaults.level;
    }

    public static defaultValue(): ILoggingConfig {
        return {
            level: "info",
        };
    }

    public readFromObject(config: ILoggingConfig) {
        if (config.level) this.level = config.level;
    }
}

export class MetricsConfig implements IMetricsConfig {
    public accounts: IAddressItem[];

    constructor() {
        const defaults = MetricsConfig.defaultValue();
        this.accounts = defaults.accounts;
    }

    public static defaultValue(): IMetricsConfig {
        return {
            accounts: [],
        } as unknown as IMetricsConfig;
    }

    public readFromObject(config: IMetricsConfig) {
        this.accounts = [];
        if (config === undefined) return;
        if (config.accounts !== undefined) this.accounts = config.accounts;
    }
}

export class SchedulerConfig implements ISchedulerConfig {
    public enable: boolean;
    public items: ISchedulerItemConfig[];

    constructor() {
        const defaults = SchedulerConfig.defaultValue();
        this.enable = defaults.enable;
        this.items = defaults.items;
    }

    public static defaultValue(): ISchedulerConfig {
        return {
            enable: false,
            items: [
                {
                    name: "node",
                    enable: false,
                    expression: "*/1 * * * * *",
                },
            ],
        } as unknown as ISchedulerConfig;
    }

    public readFromObject(config: ISchedulerConfig) {
        this.enable = false;
        this.items = [];
        if (config === undefined) return;
        if (config.enable !== undefined) this.enable = config.enable;
        if (config.items !== undefined) this.items = config.items;
    }

    public getScheduler(name: string): ISchedulerItemConfig | undefined {
        return this.items.find((m) => m.name === name);
    }
}

export interface IServerConfig {
    address: string;
    port: number;
}

export interface IDatabaseConfig {
    host: string;
    user: string;
    password: string;
    database: string;
    scheme: string;
    port: number;
    connectionTimeoutMillis: number;
    max: number;
}

export interface ILoggingConfig {
    level: string;
}

export interface IRelayConfig {
    managerKeys: string[];
    accessKey: string;
    callbackAccessKey: string;
    callbackEndpoint: string;
    paymentTimeoutSecond: number;
    approvalSecond: number;
    forcedCloseSecond: number;
    expoAccessToken: string;
    relayEndpoint: string;
    encryptKey: string;
}

export interface IContractsConfig {
    tokenAddress: string;
    ledgerAddress: string;
    phoneLinkerAddress: string;
    shopAddress: string;
    currencyRateAddress: string;
    loyaltyProviderAddress: string;
    loyaltyConsumerAddress: string;
    loyaltyExchangerAddress: string;
    loyaltyTransferAddress: string;
    loyaltyBridgeAddress: string;
    sideChainBridgeAddress: string;
}

export interface ISchedulerItemConfig {
    name: string;
    enable: boolean;
    expression: string;
}

export interface ISchedulerConfig {
    enable: boolean;
    items: ISchedulerItemConfig[];
    getScheduler(name: string): ISchedulerItemConfig | undefined;
}

export interface IAddressItem {
    name: string;
    address: string;
}

export interface IMetricsConfig {
    accounts: IAddressItem[];
}

export interface IConfig {
    server: IServerConfig;
    database: IDatabaseConfig;
    graph: DatabaseConfig;
    logging: ILoggingConfig;
    scheduler: ISchedulerConfig;
    relay: IRelayConfig;
    contracts: IContractsConfig;
    metrics: IMetricsConfig;
}
