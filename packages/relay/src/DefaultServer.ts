import bodyParser from "body-parser";
import cors from "cors";
import { Config } from "./common/Config";
import { DefaultRouter } from "./routers/DefaultRouter";
import { ETCRouter } from "./routers/ETCRouter";
import { LedgerRouter } from "./routers/LedgerRouter";
import { PaymentRouter } from "./routers/PaymentRouter";
import { ShopRouter } from "./routers/ShopRouter";
import { Scheduler } from "./scheduler/Scheduler";
import { WebService } from "./service/WebService";

import { register } from "prom-client";
import { ContractManager } from "./contract/ContractManager";
import { RelaySigners } from "./contract/Signers";
import { INotificationEventHandler, INotificationSender, NotificationSender } from "./delegator/NotificationSender";
import { Metrics } from "./metrics/Metrics";
import { AgentRouter } from "./routers/AgentRouter";
import { BridgeRouter } from "./routers/BridgeRouter";
import { HistoryRouter } from "./routers/HistoryRouter";
import { PhoneLinkRouter } from "./routers/PhoneLinkRouter";
import { ProviderRouter } from "./routers/ProviderRouter";
import { StorePurchaseRouter } from "./routers/StorePurchaseRouter";
import { TaskRouter } from "./routers/TaskRouter";
import { TokenRouter } from "./routers/TokenRouter";
import { GraphStorage } from "./storage/GraphStorage";
import { RelayStorage } from "./storage/RelayStorage";

export class DefaultServer extends WebService {
    private readonly config: Config;
    private readonly contractManager: ContractManager;
    protected schedules: Scheduler[] = [];

    public readonly defaultRouter: DefaultRouter;
    public readonly ledgerRouter: LedgerRouter;
    public readonly shopRouter: ShopRouter;
    public readonly paymentRouter: PaymentRouter;
    public readonly relaySigners: RelaySigners;
    public readonly storage: RelayStorage;
    public readonly graph_sidechain: GraphStorage;
    public readonly graph_mainchain: GraphStorage;
    private readonly sender: INotificationSender;
    public readonly etcRouter: ETCRouter;
    public readonly purchaseRouter: StorePurchaseRouter;
    public readonly tokenRouter: TokenRouter;
    public readonly taskRouter: TaskRouter;
    public readonly agentRouter: AgentRouter;
    public readonly phoneLinkRouter: PhoneLinkRouter;
    public readonly providerRouter: ProviderRouter;
    public readonly bridgeRouter: BridgeRouter;
    public readonly historyRouter: HistoryRouter;

    private readonly metrics: Metrics;

    constructor(
        config: Config,
        contractManager: ContractManager,
        storage: RelayStorage,
        graph_sidechain: GraphStorage,
        graph_mainchain: GraphStorage,
        schedules?: Scheduler[],
        handler?: INotificationEventHandler
    ) {
        super(config.server);
        register.clear();
        this.metrics = new Metrics();
        this.metrics.create("gauge", "status", "serve status");
        this.metrics.create("summary", "success", "request success");
        this.metrics.create("summary", "failure", "request failure");
        this.metrics.createGauge("certifier_balance", "certifier balance", ["address"]);
        this.metrics.createGauge("system_account_balance", "the balance of the system account", ["name"]);
        this.metrics.create("gauge", "phone_account_count", "phone account count");
        this.metrics.create("gauge", "phone_account_total_balance", "phone account total balance");
        this.metrics.create("gauge", "point_account_count", "point account count");
        this.metrics.create("gauge", "point_account_total_balance", "point account total balance");
        this.metrics.create("gauge", "token_account_count", "token account count");
        this.metrics.create("gauge", "token_account_total_balance", "token account total balance");
        this.metrics.create("gauge", "token_price", "token price");

        this.metrics.create("gauge", "shop_count", "number of shops");
        this.metrics.createGauge("shop_count_clear", "number of shops", ["currency"]);
        this.metrics.createGauge("shop_total_provided_amount_clear", "total provided amount of shops", ["currency"]);
        this.metrics.createGauge("shop_total_used_amount_clear", "total used amount of shops", ["currency"]);
        this.metrics.createGauge("shop_total_refunded_amount_clear", "total refundable amount of shops", ["currency"]);

        this.config = config;
        this.contractManager = contractManager;
        this.storage = storage;
        this.graph_sidechain = graph_sidechain;
        this.graph_mainchain = graph_mainchain;
        this.sender = new NotificationSender(this.config, handler);
        this.relaySigners = new RelaySigners(this.config);
        this.defaultRouter = new DefaultRouter(this, this.config, this.contractManager, this.metrics);
        this.ledgerRouter = new LedgerRouter(
            this,
            this.config,
            this.contractManager,
            this.metrics,
            this.storage,
            this.graph_sidechain,
            this.graph_mainchain,
            this.relaySigners
        );
        this.shopRouter = new ShopRouter(
            this,
            this.config,
            this.contractManager,
            this.metrics,
            this.storage,
            this.graph_sidechain,
            this.graph_mainchain,
            this.relaySigners,
            this.sender
        );
        this.paymentRouter = new PaymentRouter(
            this,
            this.config,
            this.contractManager,
            this.metrics,
            this.storage,
            this.graph_sidechain,
            this.graph_mainchain,
            this.relaySigners,
            this.sender
        );
        this.etcRouter = new ETCRouter(
            this,
            this.config,
            this.contractManager,
            this.metrics,
            this.storage,
            this.graph_sidechain,
            this.graph_mainchain,
            this.sender
        );
        this.purchaseRouter = new StorePurchaseRouter(
            this,
            this.config,
            this.contractManager,
            this.metrics,
            this.storage,
            this.graph_sidechain,
            this.graph_mainchain
        );
        this.tokenRouter = new TokenRouter(
            this,
            this.config,
            this.contractManager,
            this.metrics,
            this.storage,
            this.graph_sidechain,
            this.graph_mainchain,
            this.relaySigners
        );
        this.phoneLinkRouter = new PhoneLinkRouter(
            this,
            this.config,
            this.contractManager,
            this.metrics,
            this.storage,
            this.graph_sidechain,
            this.graph_mainchain,
            this.relaySigners
        );
        this.agentRouter = new AgentRouter(
            this,
            this.config,
            this.contractManager,
            this.metrics,
            this.storage,
            this.graph_sidechain,
            this.graph_mainchain,
            this.relaySigners
        );
        this.providerRouter = new ProviderRouter(
            this,
            this.config,
            this.contractManager,
            this.metrics,
            this.storage,
            this.graph_sidechain,
            this.graph_mainchain,
            this.relaySigners
        );
        this.bridgeRouter = new BridgeRouter(
            this,
            this.config,
            this.contractManager,
            this.metrics,
            this.storage,
            this.graph_sidechain,
            this.graph_mainchain,
            this.relaySigners
        );
        this.historyRouter = new HistoryRouter(
            this,
            this.config,
            this.contractManager,
            this.metrics,
            this.storage,
            this.graph_sidechain,
            this.graph_mainchain,
            this.relaySigners
        );
        this.taskRouter = new TaskRouter(this, this.config, this.contractManager, this.metrics, this.storage);

        if (schedules) {
            schedules.forEach((m) => this.schedules.push(m));
            this.schedules.forEach((m) =>
                m.setOption({
                    config: this.config,
                    contractManager: this.contractManager,
                    storage: this.storage,
                    metrics: this.metrics,
                    graph: this.graph_sidechain,
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
        this.app.use(
            cors({
                origin: "*",
                methods: "GET, POST, OPTIONS",
                allowedHeaders: "Content-Type, Authorization",
                credentials: true,
                preflightContinue: false,
            })
        );

        await this.defaultRouter.registerRoutes();
        await this.ledgerRouter.registerRoutes();
        await this.shopRouter.registerRoutes();
        await this.paymentRouter.registerRoutes();
        await this.etcRouter.registerRoutes();
        await this.purchaseRouter.registerRoutes();
        await this.tokenRouter.registerRoutes();
        await this.phoneLinkRouter.registerRoutes();
        await this.agentRouter.registerRoutes();
        await this.providerRouter.registerRoutes();
        await this.bridgeRouter.registerRoutes();
        await this.historyRouter.registerRoutes();
        await this.taskRouter.registerRoutes();

        for (const m of this.schedules) await m.start();

        return super.start();
    }

    public async stop(): Promise<void> {
        for (const m of this.schedules) await m.stop();
        for (const m of this.schedules) await m.waitForStop();
        return super.stop();
    }
}
