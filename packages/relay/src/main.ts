import { Config } from "./common/Config";
import { logger, Logger } from "./common/Logger";
import { DefaultServer } from "./DefaultServer";

let server: DefaultServer;

async function main() {
    // Create with the arguments and read from file
    const config = Config.createWithArgument();

    // Now configure the logger with the expected transports
    switch (process.env.NODE_ENV) {
        case "test":
            // Logger is silent, do nothing
            break;

        case "development":
            // Only use the console log
            if (config.logging.console) logger.add(Logger.defaultConsoleTransport());
            break;

        case "production":
        default:
            // Read the config file and potentially use both
            // logger.add(Logger.defaultFileTransport(config.logging.folder));
            if (config.logging.console) logger.add(Logger.defaultConsoleTransport());
    }
    logger.transports.forEach((tp) => {
        tp.level = config.logging.level;
    });

    logger.info(`address: ${config.server.address}`);
    logger.info(`port: ${config.server.port}`);

    server = new DefaultServer(config);
    return server.start().catch((error: any) => {
        // handle specific listen errors with friendly messages
        switch (error.code) {
            case "EACCES":
                logger.error(`${config.server.port} requires elevated privileges`);
                break;
            case "EADDRINUSE":
                logger.error(`Port ${config.server.port} is already in use`);
                break;
            default:
                logger.error(`An error occurred while starting the server: ${error.stack}`);
        }
        process.exit(1);
    });
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});

process.on("SIGINT", () => {
    server.stop().then(() => {
        process.exit(0);
    });
});
