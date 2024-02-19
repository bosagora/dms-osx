/**
 *  Define the configuration objects that are used through the application
 *
 *  Copyright:
 *      Copyright (c) 2023 BOSAGORA Foundation All rights reserved.
 *
 *  License:
 *       MIT License. See LICENSE for details.
 */

import { ArgumentParser } from "argparse";
import { Utils } from "../utils/Utils";

import extend from "extend";
import fs from "fs";
import ip from "ip";
import path from "path";
import { readYamlEnvSync } from "yaml-env-defaults";

/**
 * Main config
 */
export class Config implements IConfig {
    /**
     * Server config
     */
    public server: ServerConfig;

    /**
     * Database config
     */
    public database: DatabaseConfig;

    /**
     * Database config
     */
    public graph: DatabaseConfig;

    /**
     * Logging config
     */
    public logging: LoggingConfig;

    /**
     * Scheduler
     */
    public scheduler: SchedulerConfig;

    public relay: RelayConfig;

    public contracts: ContractsConfig;

    /**
     * Constructor
     */
    constructor() {
        this.server = new ServerConfig();
        this.database = new DatabaseConfig();
        this.graph = new DatabaseConfig();
        this.logging = new LoggingConfig();
        this.scheduler = new SchedulerConfig();
        this.relay = new RelayConfig();
        this.contracts = new ContractsConfig();
    }

    /**
     * Parses the command line arguments, Reads from the configuration file
     */
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

    /**
     * Reads from file
     * @param config_file The file name of configuration
     */
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
    }
}

/**
 * Server config
 */
export class ServerConfig implements IServerConfig {
    /**
     * THe address to which we bind
     */
    public address: string;

    /**
     * The port on which we bind
     */
    public port: number;

    /**
     * Constructor
     * @param address The address to which we bind
     * @param port The port on which we bind
     */
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

    /**
     * Returns default value
     */
    public static defaultValue(): IServerConfig {
        return {
            address: "127.0.0.1",
            port: 3000,
        };
    }

    /**
     * Reads from Object
     * @param config The object of IServerConfig
     */
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

/**
 * Database config
 */
export class DatabaseConfig implements IDatabaseConfig {
    /**
     * The host of mysql
     */
    host: string;

    /**
     * The user of mysql
     */
    user: string;

    /**
     * The password of mysql
     */
    password: string;

    /**
     * The database name
     */
    database: string;

    scheme: string;

    /**
     * The host database port
     */
    port: number;

    /**
     * number of milliseconds to wait before timing out when connecting a new client
     * by default this is 0 which means no timeout
     */
    connectionTimeoutMillis: number;

    /**
     * maximum number of clients the pool should contain
     * by default this is set to 10.
     */
    max: number;

    /**
     * Constructor
     * @param host Postgresql database host
     * @param user Postgresql database user
     * @param password Postgresql database password
     * @param database Postgresql database name
     * @param scheme
     * @param port Postgresql database port
     * @param connectionTimeoutMillis Number of milliseconds to wait before
     * timing out when connecting a new client.
     * By default this is 0 which means no timeout.
     * @param max Number of milliseconds to wait before timing out when
     * connecting a new client by default this is 0 which means no timeout.
     */
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

    /**
     * Returns default value
     */
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

    /**
     * Reads from Object
     * @param config The object of IDatabaseConfig
     */
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

/**
 * Logging config
 */
export class RelayConfig implements IRelayConfig {
    /**
     * 계정의 비밀키 또는 키파일
     */
    public managerKeys: string[];
    public accessKey: string;
    public callbackAccessKey: string;
    public callbackEndpoint: string;
    public paymentTimeoutSecond: number;
    public approvalSecond: number;
    public forcedCloseSecond: number;
    public expoAccessToken: string;
    public relayEndpoint: string;
    public storePurchaseWaitingSecond: number;

    /**
     * Constructor
     */
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
        this.storePurchaseWaitingSecond = defaults.storePurchaseWaitingSecond;
    }

    /**
     * Returns default value
     */
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
            storePurchaseWaitingSecond: 694800,
        };
    }

    /**
     * Reads from Object
     * @param config The object of ILoggingConfig
     */
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
        if (config.storePurchaseWaitingSecond !== undefined)
            this.storePurchaseWaitingSecond = config.storePurchaseWaitingSecond;
    }
}

/**
 * Logging config
 */
export class ContractsConfig implements IContractsConfig {
    public tokenAddress: string;
    public ledgerAddress: string;
    public providerAddress: string;
    public consumerAddress: string;
    public exchangerAddress: string;
    public phoneLinkerAddress: string;
    public shopAddress: string;
    public currencyRateAddress: string;

    /**
     * Constructor
     */
    constructor() {
        const defaults = ContractsConfig.defaultValue();

        this.tokenAddress = defaults.tokenAddress;
        this.ledgerAddress = defaults.ledgerAddress;
        this.providerAddress = defaults.providerAddress;
        this.consumerAddress = defaults.consumerAddress;
        this.exchangerAddress = defaults.exchangerAddress;
        this.phoneLinkerAddress = defaults.phoneLinkerAddress;
        this.shopAddress = defaults.shopAddress;
        this.currencyRateAddress = defaults.currencyRateAddress;
    }

    /**
     * Returns default value
     */
    public static defaultValue(): IContractsConfig {
        return {
            tokenAddress: process.env.TOKEN_CONTRACT_ADDRESS || "",
            ledgerAddress: process.env.LEDGER_CONTRACT_ADDRESS || "",
            providerAddress: process.env.LOYALTY_PROVIDER_CONTRACT_ADDRESS || "",
            consumerAddress: process.env.LOYALTY_CONSUMER_CONTRACT_ADDRESS || "",
            exchangerAddress: process.env.LOYALTY_EXCHANGER_CONTRACT_ADDRESS || "",
            phoneLinkerAddress: process.env.PHONE_LINKER_CONTRACT_ADDRESS || "",
            shopAddress: process.env.SHOP_CONTRACT_ADDRESS || "",
            currencyRateAddress: process.env.CURRENCY_RATE_CONTRACT_ADDRESS || "",
        };
    }

    /**
     * Reads from Object
     * @param config The object of ILoggingConfig
     */
    public readFromObject(config: IContractsConfig) {
        if (config.tokenAddress !== undefined) this.tokenAddress = config.tokenAddress;
        if (config.ledgerAddress !== undefined) this.ledgerAddress = config.ledgerAddress;
        if (config.providerAddress !== undefined) this.providerAddress = config.providerAddress;
        if (config.consumerAddress !== undefined) this.consumerAddress = config.consumerAddress;
        if (config.exchangerAddress !== undefined) this.exchangerAddress = config.exchangerAddress;
        if (config.phoneLinkerAddress !== undefined) this.phoneLinkerAddress = config.phoneLinkerAddress;
        if (config.shopAddress !== undefined) this.shopAddress = config.shopAddress;
        if (config.currencyRateAddress !== undefined) this.currencyRateAddress = config.currencyRateAddress;
    }
}

/**
 * Logging config
 */
export class LoggingConfig implements ILoggingConfig {
    /**
     * The level of logging
     */
    public level: string;

    /**
     * Constructor
     */
    constructor() {
        const defaults = LoggingConfig.defaultValue();
        this.level = defaults.level;
    }

    /**
     * Returns default value
     */
    public static defaultValue(): ILoggingConfig {
        return {
            level: "info",
        };
    }

    /**
     * Reads from Object
     * @param config The object of ILoggingConfig
     */
    public readFromObject(config: ILoggingConfig) {
        if (config.level) this.level = config.level;
    }
}

/**
 * Information on the scheduler.
 */
export class SchedulerConfig implements ISchedulerConfig {
    /**
     * Whether the scheduler is used or not
     */
    public enable: boolean;

    /**
     * Container for scheduler items
     */
    public items: ISchedulerItemConfig[];

    /**
     * Constructor
     */
    constructor() {
        const defaults = SchedulerConfig.defaultValue();
        this.enable = defaults.enable;
        this.items = defaults.items;
    }

    /**
     * Returns default value
     */
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

    /**
     * Reads from Object
     * @param config The object of ILoggingConfig
     */
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

/**
 * The interface of server config
 */
export interface IServerConfig {
    /**
     * The address to which we bind
     */
    address: string;

    /**
     * The port on which we bind
     */
    port: number;
}

/**
 * The interface of database config
 */
export interface IDatabaseConfig {
    /**
     * The host of mysql
     */
    host: string;

    /**
     * The user of mysql
     */
    user: string;

    /**
     * The password of mysql
     */
    password: string;

    /**
     * The database name
     */
    database: string;

    scheme: string;

    /**
     * The host database port
     */
    port: number;

    /**
     * number of milliseconds to wait before timing out when connecting a new client
     * by default this is 0 which means no timeout
     */
    connectionTimeoutMillis: number;

    /**
     * maximum number of clients the pool should contain
     * by default this is set to 10.
     */
    max: number;
}

/**
 * The interface of logging config
 */
export interface ILoggingConfig {
    /**
     * The level of logging
     */
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
    storePurchaseWaitingSecond: number;
}

export interface IContractsConfig {
    tokenAddress: string;
    ledgerAddress: string;
    providerAddress: string;
    consumerAddress: string;
    exchangerAddress: string;
    phoneLinkerAddress: string;
    shopAddress: string;
    currencyRateAddress: string;
}

/**
 * The interface of Scheduler Item Config
 */
export interface ISchedulerItemConfig {
    /**
     * Name
     */
    name: string;

    /**
     * Whether it's used or not
     */
    enable: boolean;

    /**
     * Execution cycle (seconds)
     */
    expression: string;
}

/**
 * The interface of Scheduler Config
 */
export interface ISchedulerConfig {
    /**
     * Whether the scheduler is used or not
     */
    enable: boolean;

    /**
     * Container for scheduler items
     */
    items: ISchedulerItemConfig[];

    /**
     * Find the scheduler item with your name
     * @param name The name of the scheduler item
     */
    getScheduler(name: string): ISchedulerItemConfig | undefined;
}

/**
 * The interface of main config
 */
export interface IConfig {
    /**
     * Server config
     */
    server: IServerConfig;

    /**
     * Database config
     */
    database: IDatabaseConfig;

    graph: DatabaseConfig;

    /**
     * Logging config
     */
    logging: ILoggingConfig;

    /**
     * Scheduler
     */
    scheduler: ISchedulerConfig;

    relay: IRelayConfig;

    contracts: IContractsConfig;
}
