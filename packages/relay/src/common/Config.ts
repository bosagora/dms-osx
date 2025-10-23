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

    public graph_sidechain: DatabaseConfig;
    public graph_mainchain: DatabaseConfig;

    public logging: LoggingConfig;

    public scheduler: SchedulerConfig;

    public relay: RelayConfig;

    public contracts: ContractsConfig;

    public metrics: MetricsConfig;

    constructor() {
        this.server = new ServerConfig();
        this.database = new DatabaseConfig();
        this.graph_sidechain = new DatabaseConfig();
        this.graph_mainchain = new DatabaseConfig();
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
        this.graph_sidechain.readFromObject(cfg.graph_sidechain);
        this.graph_mainchain.readFromObject(cfg.graph_mainchain);
        this.logging.readFromObject(cfg.logging);
        this.scheduler.readFromObject(cfg.scheduler);
        this.relay.readFromObject(cfg.relay);
        this.contracts.readFromObject(cfg.contracts);
        this.metrics.readFromObject(cfg.metrics);
        //
        // console.log("Config.server", JSON.stringify(this.server));
        // console.log("Config.database", JSON.stringify(this.database));
        // console.log("Config.graph_sidechain", JSON.stringify(this.graph_sidechain));
        // console.log("Config.graph_mainchain", JSON.stringify(this.graph_mainchain));
        // console.log("Config.logging", JSON.stringify(this.logging));
        // console.log("Config.scheduler", JSON.stringify(this.scheduler));
        // console.log("Config.relay", JSON.stringify(this.relay));
        // console.log("Config.contracts", JSON.stringify(this.contracts));
        // console.log("Config.metrics", JSON.stringify(this.metrics));
    }
}

export class ServerConfig implements IServerConfig {
    public address: string;
    public http: HTTPConfig;
    public https: HTTPSConfig;

    constructor(address?: string, http?: HTTPConfig, https?: HTTPSConfig) {
        const conf = extend(true, {}, ServerConfig.defaultValue());
        extend(true, conf, { address, http, https });

        if (!ip.isV4Format(conf.address) && !ip.isV6Format(conf.address)) {
            console.error(`${conf.address}' is not appropriate to use as an IP address.`);
            process.exit(1);
        }

        this.address = conf.address;
        this.http = conf.http;
        this.https = conf.https;
    }

    public static defaultValue(): IServerConfig {
        return {
            address: "127.0.0.1",
            http: {
                enable: true,
                port: 7070,
            },
            https: {
                enable: false,
                port: 7443,
                cert: "",
                key: "",
            },
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
        this.http.enable = conf.http.enable.toString().toLowerCase() === "true";
        this.http.port = conf.http.port;
        this.https.enable = conf.https.enable.toString().toLowerCase() === "true";
        this.https.port = conf.https.port;
        this.https.cert = conf.https.cert;
        this.https.key = conf.https.key;
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
    public certifiers: string[];
    public paymentSigners: string[];
    public accessKey: string;
    public callbackAccessKey: string;
    public callbackEndpoint: string;
    public paymentTimeoutSecond: number;
    public approvalSecond: number;
    public forcedCloseSecond: number;
    public expoAccessToken: string;
    public relayEndpoint: string;
    public encryptKey: string;
    public testMode: boolean;
    public allowedShopIdPrefix: string;
    public initialBalanceOfProvider: number;
    public supportChainBridge: boolean;
    public supportLoyaltyBridge: boolean;
    public supportExchange: boolean;
    public supportPaymentV1: boolean;

    constructor() {
        const defaults = RelayConfig.defaultValue();

        this.certifiers = defaults.certifiers;
        this.paymentSigners = defaults.paymentSigners;
        this.accessKey = defaults.accessKey;
        this.callbackAccessKey = defaults.callbackAccessKey;
        this.callbackEndpoint = defaults.callbackEndpoint;
        this.paymentTimeoutSecond = defaults.paymentTimeoutSecond;
        this.approvalSecond = defaults.approvalSecond;
        this.forcedCloseSecond = defaults.forcedCloseSecond;
        this.expoAccessToken = defaults.expoAccessToken;
        this.relayEndpoint = defaults.relayEndpoint;
        this.encryptKey = defaults.encryptKey;
        this.testMode = defaults.testMode;
        this.allowedShopIdPrefix = defaults.allowedShopIdPrefix;
        this.initialBalanceOfProvider = defaults.initialBalanceOfProvider;
        this.supportChainBridge = defaults.supportChainBridge;
        this.supportLoyaltyBridge = defaults.supportLoyaltyBridge;
        this.supportExchange = defaults.supportExchange;
        this.supportPaymentV1 = defaults.supportPaymentV1;
    }

    public static defaultValue(): IRelayConfig {
        return {
            certifiers: [
                process.env.CERTIFIER01 || "",
                process.env.CERTIFIER02 || "",
                process.env.CERTIFIER03 || "",
                process.env.CERTIFIER04 || "",
                process.env.CERTIFIER01 || "",
            ],
            paymentSigners: [],
            accessKey: process.env.ACCESS_SECRET || "",
            callbackAccessKey: process.env.CALLBACK_ACCESS_KEY || "",
            callbackEndpoint: process.env.CALLBACK_ENDPOINT || "",
            paymentTimeoutSecond: 45,
            approvalSecond: 3,
            forcedCloseSecond: 300,
            expoAccessToken: "",
            relayEndpoint: "",
            encryptKey: "",
            testMode: false,
            allowedShopIdPrefix: "0x0001",
            initialBalanceOfProvider: 50000,
            supportChainBridge: true,
            supportLoyaltyBridge: true,
            supportExchange: true,
            supportPaymentV1: true,
        };
    }

    public readFromObject(config: IRelayConfig) {
        if (config.certifiers !== undefined) this.certifiers = config.certifiers;
        if (config.paymentSigners !== undefined) this.paymentSigners = config.paymentSigners;
        if (config.accessKey !== undefined) this.accessKey = config.accessKey;
        if (config.callbackAccessKey !== undefined) this.callbackAccessKey = config.callbackAccessKey;
        if (config.callbackEndpoint !== undefined) this.callbackEndpoint = config.callbackEndpoint;
        if (config.paymentTimeoutSecond !== undefined) this.paymentTimeoutSecond = config.paymentTimeoutSecond;
        if (config.approvalSecond !== undefined) this.approvalSecond = config.approvalSecond;
        if (config.forcedCloseSecond !== undefined) this.forcedCloseSecond = config.forcedCloseSecond;
        if (config.expoAccessToken !== undefined) this.expoAccessToken = config.expoAccessToken;
        if (config.relayEndpoint !== undefined) this.relayEndpoint = config.relayEndpoint;
        if (config.encryptKey !== undefined) this.encryptKey = config.encryptKey;
        if (config.testMode !== undefined) this.testMode = config.testMode.toString().toLowerCase() === "true";
        if (config.allowedShopIdPrefix !== undefined) this.allowedShopIdPrefix = config.allowedShopIdPrefix;
        if (config.initialBalanceOfProvider !== undefined)
            this.initialBalanceOfProvider = config.initialBalanceOfProvider;
        if (config.supportChainBridge !== undefined)
            this.supportChainBridge = config.supportChainBridge.toString().toLowerCase() === "true";
        if (config.supportLoyaltyBridge !== undefined)
            this.supportLoyaltyBridge = config.supportLoyaltyBridge.toString().toLowerCase() === "true";
        if (config.supportExchange !== undefined)
            this.supportExchange = config.supportExchange.toString().toLowerCase() === "true";
        if (config.supportPaymentV1 !== undefined)
            this.supportPaymentV1 = config.supportPaymentV1.toString().toLowerCase() === "true";
    }

    public isPaymentSigner(account: string): boolean {
        const acc = account.toLowerCase();
        return this.paymentSigners.find((m) => m.toLowerCase() === acc) !== undefined;
    }
}

export class ContractsConfig implements IContractsConfig {
    public sideChain: {
        network: string;
        url: string;
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
        chainBridgeAddress: string;
    };
    public mainChain: {
        network: string;
        url: string;
        tokenAddress: string;
        token2Address: string;
        loyaltyBridgeAddress: string;
        chainBridgeAddress: string;
    };

    constructor() {
        const defaults = ContractsConfig.defaultValue();

        this.sideChain = {
            network: defaults.sideChain.network,
            url: defaults.sideChain.url,
            tokenAddress: defaults.sideChain.tokenAddress,
            ledgerAddress: defaults.sideChain.ledgerAddress,
            phoneLinkerAddress: defaults.sideChain.phoneLinkerAddress,
            shopAddress: defaults.sideChain.shopAddress,
            currencyRateAddress: defaults.sideChain.currencyRateAddress,
            loyaltyProviderAddress: defaults.sideChain.loyaltyProviderAddress,
            loyaltyConsumerAddress: defaults.sideChain.loyaltyConsumerAddress,
            loyaltyExchangerAddress: defaults.sideChain.loyaltyExchangerAddress,
            loyaltyTransferAddress: defaults.sideChain.loyaltyTransferAddress,
            loyaltyBridgeAddress: defaults.sideChain.loyaltyBridgeAddress,
            chainBridgeAddress: defaults.sideChain.chainBridgeAddress,
        };
        this.mainChain = {
            network: defaults.mainChain.network,
            url: defaults.mainChain.url,
            tokenAddress: defaults.mainChain.tokenAddress,
            token2Address: defaults.mainChain.token2Address,
            loyaltyBridgeAddress: defaults.mainChain.loyaltyBridgeAddress,
            chainBridgeAddress: defaults.mainChain.chainBridgeAddress,
        };
    }

    public static defaultValue(): IContractsConfig {
        return {
            sideChain: {
                network: "production_side",
                url: "",
                tokenAddress: process.env.TOKEN_CONTRACT_ADDRESS || "",
                ledgerAddress: process.env.LEDGER_CONTRACT_ADDRESS || "",
                phoneLinkerAddress: process.env.PHONE_LINKER_CONTRACT_ADDRESS || "",
                shopAddress: process.env.SHOP_CONTRACT_ADDRESS || "",
                currencyRateAddress: process.env.CURRENCY_RATE_CONTRACT_ADDRESS || "",
                loyaltyProviderAddress: process.env.LOYALTY_PROVIDER_CONTRACT_ADDRESS || "",
                loyaltyConsumerAddress: process.env.LOYALTY_CONSUMER_CONTRACT_ADDRESS || "",
                loyaltyExchangerAddress: process.env.LOYALTY_EXCHANGER_CONTRACT_ADDRESS || "",
                loyaltyTransferAddress: process.env.LOYALTY_TRANSFER_CONTRACT_ADDRESS || "",
                loyaltyBridgeAddress: process.env.SIDE_CHAIN_LOYALTY_BRIDGE_CONTRACT_ADDRESS || "",
                chainBridgeAddress: process.env.SIDE_CHAIN_BRIDGE_CONTRACT_ADDRESS || "",
            },
            mainChain: {
                network: "production_main",
                url: "",
                tokenAddress: process.env.MAIN_CHAIN_TOKEN_CONTRACT_ADDRESS || "",
                token2Address: process.env.MAIN_CHAIN_TOKEN2_CONTRACT_ADDRESS || "",
                loyaltyBridgeAddress: process.env.MAIN_CHAIN_LOYALTY_BRIDGE_CONTRACT_ADDRESS || "",
                chainBridgeAddress: process.env.MAIN_CHAIN_BRIDGE_CONTRACT_ADDRESS || "",
            },
        };
    }

    public readFromObject(config: IContractsConfig) {
        if (config.sideChain.network !== undefined) this.sideChain.network = config.sideChain.network;
        if (config.sideChain.url !== undefined) this.sideChain.url = config.sideChain.url;
        if (config.sideChain.tokenAddress !== undefined) this.sideChain.tokenAddress = config.sideChain.tokenAddress;
        if (config.sideChain.ledgerAddress !== undefined) this.sideChain.ledgerAddress = config.sideChain.ledgerAddress;
        if (config.sideChain.phoneLinkerAddress !== undefined)
            this.sideChain.phoneLinkerAddress = config.sideChain.phoneLinkerAddress;
        if (config.sideChain.shopAddress !== undefined) this.sideChain.shopAddress = config.sideChain.shopAddress;
        if (config.sideChain.currencyRateAddress !== undefined)
            this.sideChain.currencyRateAddress = config.sideChain.currencyRateAddress;
        if (config.sideChain.loyaltyProviderAddress !== undefined)
            this.sideChain.loyaltyProviderAddress = config.sideChain.loyaltyProviderAddress;
        if (config.sideChain.loyaltyConsumerAddress !== undefined)
            this.sideChain.loyaltyConsumerAddress = config.sideChain.loyaltyConsumerAddress;
        if (config.sideChain.loyaltyExchangerAddress !== undefined)
            this.sideChain.loyaltyExchangerAddress = config.sideChain.loyaltyExchangerAddress;
        if (config.sideChain.loyaltyTransferAddress !== undefined)
            this.sideChain.loyaltyTransferAddress = config.sideChain.loyaltyTransferAddress;
        if (config.sideChain.loyaltyBridgeAddress !== undefined)
            this.sideChain.loyaltyBridgeAddress = config.sideChain.loyaltyBridgeAddress;
        if (config.sideChain.chainBridgeAddress !== undefined)
            this.sideChain.chainBridgeAddress = config.sideChain.chainBridgeAddress;

        if (config.mainChain.network !== undefined) this.mainChain.network = config.mainChain.network;
        if (config.mainChain.url !== undefined) this.mainChain.url = config.mainChain.url;
        if (config.mainChain.tokenAddress !== undefined) this.mainChain.tokenAddress = config.mainChain.tokenAddress;
        if (config.mainChain.loyaltyBridgeAddress !== undefined)
            this.mainChain.loyaltyBridgeAddress = config.mainChain.loyaltyBridgeAddress;
        if (config.mainChain.chainBridgeAddress !== undefined)
            this.mainChain.chainBridgeAddress = config.mainChain.chainBridgeAddress;
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
        if (config.enable !== undefined) this.enable = config.enable.toString().toLowerCase() === "true";
        if (config.items !== undefined) this.items = config.items;
    }

    public getScheduler(name: string): ISchedulerItemConfig | undefined {
        return this.items.find((m) => m.name === name);
    }
}

export interface HTTPConfig {
    enable: boolean;
    port: number;
}

export interface HTTPSConfig {
    enable: boolean;
    port: number;
    cert: string;
    key: string;
}

export interface IServerConfig {
    address: string;
    http: HTTPConfig;
    https: HTTPSConfig;
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
    certifiers: string[];
    paymentSigners: string[];
    accessKey: string;
    callbackAccessKey: string;
    callbackEndpoint: string;
    paymentTimeoutSecond: number;
    approvalSecond: number;
    forcedCloseSecond: number;
    expoAccessToken: string;
    relayEndpoint: string;
    encryptKey: string;
    testMode: boolean;
    allowedShopIdPrefix: string;
    initialBalanceOfProvider: number;
    supportChainBridge: boolean;
    supportLoyaltyBridge: boolean;
    supportExchange: boolean;
    supportPaymentV1: boolean;
}

export interface IContractsConfig {
    sideChain: {
        network: string;
        url: string;
        tokenAddress: string;
        ledgerAddress: string;
        loyaltyProviderAddress: string;
        loyaltyConsumerAddress: string;
        loyaltyExchangerAddress: string;
        phoneLinkerAddress: string;
        shopAddress: string;
        currencyRateAddress: string;
        loyaltyTransferAddress: string;
        loyaltyBridgeAddress: string;
        chainBridgeAddress: string;
    };
    mainChain: {
        network: string;
        url: string;
        tokenAddress: string;
        token2Address: string;
        loyaltyBridgeAddress: string;
        chainBridgeAddress: string;
    };
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
    graph_sidechain: DatabaseConfig;
    graph_mainchain: DatabaseConfig;
    logging: ILoggingConfig;
    scheduler: ISchedulerConfig;
    relay: IRelayConfig;
    contracts: IContractsConfig;
    metrics: IMetricsConfig;
}
