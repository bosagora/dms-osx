import { Config } from "./common/Config";
import { logger, Logger } from "./common/Logger";
import { DefaultServer } from "./DefaultServer";
import { GraphStorage } from "./storage/GraphStorage";
import { RelayStorage } from "./storage/RelayStorage";
import { ContractUtils } from "./utils/ContractUtils";

import { ApprovalScheduler } from "./scheduler/ApprovalScheduler";
import { CloseScheduler } from "./scheduler/CloseScheduler";
import { Scheduler } from "./scheduler/Scheduler";
import { WatchScheduler } from "./scheduler/WatchScheduler";

let server: DefaultServer;

async function main() {
    // Create with the arguments and read from file
    const config = Config.createWithArgument();

    logger.transports.forEach((tp) => {
        tp.level = config.logging.level;
    });

    logger.info(`address: ${config.server.address}`);
    logger.info(`port: ${config.server.port}`);

    await ContractUtils.delay(3000);
    const storage = await RelayStorage.make(config.database);
    const graph = await GraphStorage.make(config.graph);

    const schedulers: Scheduler[] = [];
    if (config.scheduler.enable) {
        let scheduler = config.scheduler.getScheduler("approval");
        if (scheduler && scheduler.enable) {
            schedulers.push(new ApprovalScheduler(scheduler.expression));
        }
        scheduler = config.scheduler.getScheduler("close");
        if (scheduler && scheduler.enable) {
            schedulers.push(new CloseScheduler(scheduler.expression));
        }
        scheduler = config.scheduler.getScheduler("watch");
        if (scheduler && scheduler.enable) {
            schedulers.push(new WatchScheduler(scheduler.expression));
        }
    }

    server = new DefaultServer(config, storage, graph, schedulers);
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
