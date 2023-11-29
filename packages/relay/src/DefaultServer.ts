import bodyParser from "body-parser";
import cors from "cors";
import { Config } from "./common/Config";
import { cors_options } from "./option/cors";
import { DefaultRouter } from "./routers/DefaultRouter";
import { ETCRouter } from "./routers/ETCRouter";
import { LedgerRouter } from "./routers/LedgerRouter";
import { PaymentRouter } from "./routers/PaymentRouter";
import { ShopRouter } from "./routers/ShopRouter";
import { Scheduler } from "./scheduler/Scheduler";
import { WebService } from "./service/WebService";

import { RelaySigners } from "./contract/Signers";
import { INotificationEventHandler, INotificationSender, NotificationSender } from "./delegator/NotificationSender";
import { RelayStorage } from "./storage/RelayStorage";

export class DefaultServer extends WebService {
    /**
     * The configuration of the database
     * @private
     */
    private readonly config: Config;
    protected schedules: Scheduler[] = [];

    public readonly defaultRouter: DefaultRouter;
    public readonly ledgerRouter: LedgerRouter;
    public readonly shopRouter: ShopRouter;
    public readonly paymentRouter: PaymentRouter;
    public readonly relaySigners: RelaySigners;
    public readonly storage: RelayStorage;
    private readonly sender: INotificationSender;
    public readonly etcRouter: ETCRouter;

    /**
     * Constructor
     * @param config Configuration
     * @param storage
     * @param schedules
     * @param handler
     */
    constructor(config: Config, storage: RelayStorage, schedules?: Scheduler[], handler?: INotificationEventHandler) {
        super(config.server.port, config.server.address);

        this.config = config;
        this.storage = storage;
        this.sender = new NotificationSender(handler);
        this.relaySigners = new RelaySigners(this.config);
        this.defaultRouter = new DefaultRouter(this);
        this.ledgerRouter = new LedgerRouter(this, this.config, this.storage, this.relaySigners);
        this.shopRouter = new ShopRouter(this, this.config, this.storage, this.relaySigners, this.sender);
        this.paymentRouter = new PaymentRouter(this, this.config, this.storage, this.relaySigners, this.sender);
        this.etcRouter = new ETCRouter(this, this.config, this.storage);

        if (schedules) {
            schedules.forEach((m) => this.schedules.push(m));
            this.schedules.forEach((m) =>
                m.setOption({
                    config: this.config,
                    storage: this.storage,
                    signers: this.relaySigners,
                })
            );
        }
    }

    /**
     * Setup and start the server
     */
    public async start(): Promise<void> {
        // parse application/x-www-form-urlencoded
        this.app.use(bodyParser.urlencoded({ extended: false, limit: "1mb" }));
        // parse application/json
        this.app.use(bodyParser.json({ limit: "1mb" }));
        this.app.use(cors(cors_options));

        this.defaultRouter.registerRoutes();
        this.ledgerRouter.registerRoutes();
        this.shopRouter.registerRoutes();
        this.paymentRouter.registerRoutes();
        this.etcRouter.registerRoutes();

        for (const m of this.schedules) await m.start();

        return super.start();
    }

    public stop(): Promise<void> {
        return new Promise<void>(async (resolve, reject) => {
            for (const m of this.schedules) await m.stop();
            for (const m of this.schedules) await m.waitForStop();
            if (this.server != null) {
                this.server.close((err?) => {
                    if (err) reject(err);
                    else resolve();
                });
            } else resolve();
        });
    }
}
