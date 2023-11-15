import bodyParser from "body-parser";
import cors from "cors";
import { Config } from "./common/Config";
import { cors_options } from "./option/cors";
import { DefaultRouter } from "./routers/DefaultRouter";
import { LedgerRouter } from "./routers/LedgerRouter";
import { PaymentRouter } from "./routers/PaymentRouter";
import { ShopRouter } from "./routers/ShopRouter";
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

    public readonly defaultRouter: DefaultRouter;
    public readonly ledgerRouter: LedgerRouter;
    public readonly shopRouter: ShopRouter;
    public readonly paymentRouter: PaymentRouter;
    public readonly relaySigners: RelaySigners;
    public readonly storage: RelayStorage;
    private readonly sender: INotificationSender;

    /**
     * Constructor
     * @param config Configuration
     * @param storage
     * @param handler
     */
    constructor(config: Config, storage: RelayStorage, handler?: INotificationEventHandler) {
        super(config.server.port, config.server.address);

        this.config = config;
        this.storage = storage;
        this.sender = new NotificationSender(handler);
        this.relaySigners = new RelaySigners(this.config);
        this.defaultRouter = new DefaultRouter(this);
        this.ledgerRouter = new LedgerRouter(this, this.config, this.storage, this.relaySigners);
        this.shopRouter = new ShopRouter(this, this.config, this.storage, this.relaySigners, this.sender);
        this.paymentRouter = new PaymentRouter(this, this.config, this.storage, this.relaySigners, this.sender);
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

        return super.start();
    }

    public stop(): Promise<void> {
        return new Promise<void>(async (resolve, reject) => {
            if (this.server != null) {
                this.server.close((err?) => {
                    if (err) reject(err);
                    else resolve();
                });
            } else resolve();
        });
    }
}
