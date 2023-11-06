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
import extend from "extend";
import fs from "fs";
import ip from "ip";
import path from "path";
import { readYamlEnvSync } from "yaml-env-defaults";
import { Utils } from "../utils/Utils";

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
     * Logging config
     */
    public logging: LoggingConfig;

    public relay: RelayConfig;

    public contracts: ContractsConfig;

    /**
     * Constructor
     */
    constructor() {
        this.server = new ServerConfig();
        this.database = new DatabaseConfig();
        this.logging = new LoggingConfig();
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
        this.logging.readFromObject(cfg.logging);
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
    database?: string;

    /**
     * The host database port
     */
    port: number;

    /**
     * multiple Statements exec config
     */
    multipleStatements: boolean;

    /**
     * Determines the pool's action when no connections are available
     * and the limit has been reached.
     * If true, the pool will queue the connection request and call
     * it when one becomes available.
     * If false, the pool will immediately call back with an error.
     */
    waitForConnections: boolean;

    /**
     * The maximum number of connections to create at once.
     */
    connectionLimit: number;

    /**
     * The maximum number of connection requests the pool
     * will queue before returning an error from getConnection.
     * If set to 0, there is no limit to the number of queued connection requests.
     */
    queueLimit: number;

    /**
     * Constructor
     * @param host Mysql database host
     * @param user Mysql database user
     * @param password Mysql database password
     * @param database Mysql database name
     * @param port Mysql database port
     * @param multipleStatements Mysql allow multiple statement to execute (true / false)
     * @param waitForConnections Determines the pool's action when no connections are available
     * and the limit has been reached.
     * If true, the pool will queue the connection request and call
     * it when one becomes available.
     * If false, the pool will immediately call back with an error.
     * @param connectionLimit The maximum number of connections to create at once.
     * @param queueLimit The maximum number of connection requests the pool
     * will queue before returning an error from getConnection.
     * If set to 0, there is no limit to the number of queued connection requests.
     */
    constructor(
        host?: string,
        user?: string,
        password?: string,
        database?: string,
        port?: number,
        multipleStatements?: boolean,
        waitForConnections?: boolean,
        connectionLimit?: number,
        queueLimit?: number
    ) {
        const conf = extend(true, {}, DatabaseConfig.defaultValue());
        extend(true, conf, {
            host,
            user,
            password,
            database,
            port,
            multipleStatements,
            waitForConnections,
            connectionLimit,
            queueLimit,
        });
        this.host = conf.host;
        this.user = conf.user;
        this.password = conf.password;
        this.database = conf.database;
        this.port = conf.port;
        this.multipleStatements = conf.multipleStatements;
        this.waitForConnections = conf.waitForConnections;
        this.connectionLimit = conf.connectionLimit;
        this.queueLimit = conf.queueLimit;
    }

    /**
     * Returns default value
     */
    public static defaultValue(): IDatabaseConfig {
        return {
            host: "localhost",
            user: "root",
            password: "12345678",
            database: "boascan",
            port: 3306,
            multipleStatements: true,
            waitForConnections: true,
            connectionLimit: 10,
            queueLimit: 0,
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
        this.port = conf.port;
        this.multipleStatements = conf.multipleStatements;
        this.waitForConnections = conf.waitForConnections;
        this.connectionLimit = conf.connectionLimit;
        this.queueLimit = conf.queueLimit;
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
    public certifierKey: string;

    /**
     * Constructor
     */
    constructor() {
        const defaults = RelayConfig.defaultValue();

        this.managerKeys = defaults.managerKeys;
        this.accessKey = defaults.accessKey;
        this.certifierKey = defaults.certifierKey;
    }

    /**
     * Returns default value
     */
    public static defaultValue(): IRelayConfig {
        return {
            managerKeys: [
                process.env.MANAGER_KEY1 || "",
                process.env.MANAGER_KEY2 || "",
                process.env.MANAGER_KEY3 || "",
                process.env.MANAGER_KEY4 || "",
                process.env.MANAGER_KEY5 || "",
            ],
            accessKey: process.env.ACCESS_SECRET || "",
            certifierKey: process.env.CERTIFIER_KEY || "",
        };
    }

    /**
     * Reads from Object
     * @param config The object of ILoggingConfig
     */
    public readFromObject(config: IRelayConfig) {
        if (config.managerKeys !== undefined) this.managerKeys = config.managerKeys;
        if (config.accessKey !== undefined) this.accessKey = config.accessKey;
        if (config.certifierKey !== undefined) this.certifierKey = config.certifierKey;
    }
}

/**
 * Logging config
 */
export class ContractsConfig implements IContractsConfig {
    public tokenAddress: string;
    public ledgerAddress: string;
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
        if (config.phoneLinkerAddress !== undefined) this.phoneLinkerAddress = config.phoneLinkerAddress;
        if (config.shopAddress !== undefined) this.shopAddress = config.shopAddress;
    }
}

/**
 * Logging config
 */
export class LoggingConfig implements ILoggingConfig {
    /**
     * The path of logging files
     */
    public folder: string;

    /**
     * The level of logging
     */
    public level: string;

    /**
     * Whether the console is enabled as well
     */
    public console: boolean;

    /**
     * Constructor
     */
    constructor() {
        const defaults = LoggingConfig.defaultValue();
        this.folder = path.resolve(Utils.getInitCWD(), defaults.folder);
        this.level = defaults.level;
        this.console = defaults.console;
    }

    /**
     * Returns default value
     */
    public static defaultValue(): ILoggingConfig {
        return {
            folder: path.resolve(Utils.getInitCWD(), "logs"),
            level: "info",
            console: false,
        };
    }

    /**
     * Reads from Object
     * @param config The object of ILoggingConfig
     */
    public readFromObject(config: ILoggingConfig) {
        if (config.folder) this.folder = path.resolve(Utils.getInitCWD(), config.folder);
        if (config.level) this.level = config.level;
        if (config.console !== undefined) this.console = config.console;
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
    database?: string;

    /**
     * The host database port
     */
    port: number;

    /**
     * Multiple Statements execution statement Option
     */
    multipleStatements: boolean;

    /**
     * Determines the pool's action when no connections are available
     * and the limit has been reached.
     * If true, the pool will queue the connection request and call
     * it when one becomes available.
     * If false, the pool will immediately call back with an error.
     */
    waitForConnections: boolean;

    /**
     * The maximum number of connections to create at once.
     */
    connectionLimit: number;

    /**
     * The maximum number of connection requests the pool
     * will queue before returning an error from getConnection.
     * If set to 0, there is no limit to the number of queued connection requests.
     */
    queueLimit: number;
}

/**
 * The interface of logging config
 */
export interface ILoggingConfig {
    /**
     * The path of logging files
     */
    folder: string;

    /**
     * The level of logging
     */
    level: string;

    /**
     * Whether the console is enabled as well
     */
    console: boolean;
}

export interface IRelayConfig {
    managerKeys: string[];
    accessKey: string;
    certifierKey: string;
}

export interface IContractsConfig {
    tokenAddress: string;
    ledgerAddress: string;
    phoneLinkerAddress: string;
    shopAddress: string;
    currencyRateAddress: string;
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

    /**
     * Logging config
     */
    logging: ILoggingConfig;

    relay: IRelayConfig;

    contracts: IContractsConfig;
}
