import { WebService } from "../service/WebService";

import express from "express";

import { Metrics } from "../metrics/Metrics";
import { Config } from "../common/Config";

import * as hre from "hardhat";
import { BigNumber, Wallet } from "ethers";

export class DefaultRouter {
    /**
     *
     * @private
     */
    private _web_service: WebService;

    /**
     * The configuration of the database
     * @private
     */
    private readonly _config: Config;

    private readonly _metrics: Metrics;

    /**
     *
     * @param service  WebService
     * @param config Config
     * @param metrics Metrics
     */
    constructor(service: WebService, config: Config, metrics: Metrics) {
        this._web_service = service;
        this._config = config;
        this._metrics = metrics;
    }

    private get app(): express.Application {
        return this._web_service.app;
    }

    public registerRoutes() {
        // Get Health Status
        this.app.get("/", [], this.getHealthStatus.bind(this));
        this.app.post("/callback", [], this.callback.bind(this));
        this.app.get("/metrics", [], this.getMetrics.bind(this));
    }

    private async getHealthStatus(req: express.Request, res: express.Response) {
        return res.status(200).json("OK");
    }

    private async callback(req: express.Request, res: express.Response) {
        console.log(JSON.stringify(req.body));
        res.status(200).json(this.makeResponseData(0, { message: "OK" }, undefined));
    }

    private makeResponseData(code: number, data: any, error?: any): any {
        return {
            code,
            data,
            error,
        };
    }

    /**
     * GET /metrics
     * @private
     */
    private async getMetrics(req: express.Request, res: express.Response) {
        res.set("Content-Type", this._metrics.contentType());
        this._metrics.add("status", 1);
        for (const elem of this._config.relay.managerKeys) {
            const wallet = new Wallet(elem, hre.ethers.provider);
            const balance = (await wallet.getBalance()).div(BigNumber.from(1_000_000_000)).toNumber();
            this._metrics.gaugeLabels("certifier_balance", { address: wallet.address }, balance);
        }
        res.end(await this._metrics.metrics());
    }
}
