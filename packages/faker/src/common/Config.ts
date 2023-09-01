import { Utils } from "../utils/Utils";

import { ArgumentParser } from "argparse";
import extend from "extend";
import * as fs from "fs";
import * as ip from "ip";
import * as path from "path";
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
     * Logging config
     */
    public logging: LoggingConfig;

    /**
     * Scheduler
     */
    public scheduler: SchedulerConfig;

    /**
     * Contracts
     */
    public setting: SettingConfig;

    public contracts: ContractsConfig;

    /**
     * Constructor
     */
    constructor() {
        this.server = new ServerConfig();
        this.logging = new LoggingConfig();
        this.scheduler = new SchedulerConfig();
        this.setting = new SettingConfig();
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
        this.logging.readFromObject(cfg.logging);
        this.scheduler.readFromObject(cfg.scheduler);
        this.setting.readFromObject(cfg.setting);
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
            address: "0.0.0.0",
            port: 7000,
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
                    interval: 1,
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
 * Setting config
 */
export class SettingConfig implements ISettingConfig {
    public validator_key: string;

    /**
     * Constructor
     */
    constructor() {
        const defaults = SettingConfig.defaultValue();
        this.validator_key = defaults.validator_key;
    }
    public readFromObject(config: ISettingConfig) {
        if (config.validator_key !== undefined) this.validator_key = config.validator_key;
    }
    /**
     * Returns default value
     */
    public static defaultValue(): ISettingConfig {
        return {
            validator_key: process.env.VALIDATOR1 || "",
        };
    }
}

export class ContractsConfig implements IContractsConfig {
    public tokenAddress: string;
    public ledgerAddress: string;
    public emailLinkerAddress: string;

    /**
     * Constructor
     */
    constructor() {
        const defaults = ContractsConfig.defaultValue();

        this.tokenAddress = defaults.tokenAddress;
        this.ledgerAddress = defaults.ledgerAddress;
        this.emailLinkerAddress = defaults.emailLinkerAddress;
    }

    /**
     * Returns default value
     */
    public static defaultValue(): IContractsConfig {
        return {
            tokenAddress: process.env.TOKEN_CONTRACT_ADDRESS || "",
            ledgerAddress: process.env.LEDGER_CONTRACT_ADDRESS || "",
            emailLinkerAddress: process.env.EMAIL_LINKER_CONTRACT_ADDRESS || "",
        };
    }

    /**
     * Reads from Object
     * @param config The object of ILoggingConfig
     */
    public readFromObject(config: IContractsConfig) {
        if (config.tokenAddress !== undefined) this.tokenAddress = config.tokenAddress;
        if (config.ledgerAddress !== undefined) this.ledgerAddress = config.ledgerAddress;
        if (config.emailLinkerAddress !== undefined) this.emailLinkerAddress = config.emailLinkerAddress;
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
 * The interface of logging config
 */
export interface ILoggingConfig {
    /**
     * The level of logging
     */
    level: string;
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

export interface ISettingConfig {
    validator_key: string;
}

export interface IContractsConfig {
    tokenAddress: string;
    ledgerAddress: string;
    emailLinkerAddress: string;
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
     * Logging config
     */
    logging: ILoggingConfig;

    /**
     * Scheduler
     */
    scheduler: ISchedulerConfig;

    /**
     * Contracts
     */
    setting: ISettingConfig;

    contracts: IContractsConfig;
}
