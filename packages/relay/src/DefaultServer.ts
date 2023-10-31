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

    /**
     * Constructor
     * @param config Configuration
     */
    constructor(config: Config) {
        super(config.server.port, config.server.address);

        this.config = config;
        this.relaySigners = new RelaySigners(this.config);
        this.defaultRouter = new DefaultRouter(this, this.config, this.relaySigners);
        this.ledgerRouter = new LedgerRouter(this, this.config, this.relaySigners);
        this.shopRouter = new ShopRouter(this, this.config, this.relaySigners);
        this.paymentRouter = new PaymentRouter(this, this.config, this.relaySigners);
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
