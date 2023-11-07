import bodyParser from "body-parser";
import cors from "cors";
import express from "express";
import http from "http";

export class FakerCallbackServer {
    protected app: express.Application;
    protected server: http.Server | null = null;
    private readonly port: number;
    public responseData: any[] = [];

    constructor(port: number | string) {
        if (typeof port === "string") this.port = parseInt(port, 10);
        else this.port = port;

        this.app = express();
    }

    public start(): Promise<void> {
        this.app.use(bodyParser.urlencoded({ extended: false }));
        this.app.use(bodyParser.json());
        this.app.use(
            cors({
                allowedHeaders: "*",
                credentials: true,
                methods: "GET, POST",
                origin: "*",
                preflightContinue: false,
            })
        );

        this.app.get("/", [], this.getHealthStatus.bind(this));
        // 포인트를 이용하여 구매
        this.app.post("/callback", [], this.callback.bind(this));

        // Listen on provided this.port on this.address.
        return new Promise<void>((resolve, reject) => {
            // Create HTTP server.
            this.server = http.createServer(this.app);
            this.server.on("error", reject);
            this.server.listen(this.port, () => {
                resolve();
            });
        });
    }

    public stop(): Promise<void> {
        return new Promise<void>((resolve, reject) => {
            if (this.server != null)
                this.server.close((err?) => {
                    err === undefined ? resolve() : reject(err);
                });
            else resolve();
        });
    }

    private makeResponseData(code: number, data: any, error?: any): any {
        return {
            code,
            data,
            error,
        };
    }

    private async getHealthStatus(req: express.Request, res: express.Response) {
        return res.status(200).json("OK");
    }

    private async callback(req: express.Request, res: express.Response) {
        console.log(JSON.stringify(req.body));
        this.responseData.push(req.body);
        res.status(200).json(this.makeResponseData(200, { message: "OK" }, undefined));
    }
}
