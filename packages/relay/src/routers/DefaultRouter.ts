import { Config } from "../common/Config";
import { ContractManager } from "../contract/ContractManager";
import { Metrics } from "../metrics/Metrics";
import { WebService } from "../service/WebService";

import { BigNumber, Wallet } from "ethers";
import express from "express";
import * as hre from "hardhat";

export class DefaultRouter {
    private web_service: WebService;
    private readonly config: Config;
    private readonly contractManager: ContractManager;
    private readonly metrics: Metrics;

    constructor(service: WebService, config: Config, contractManager: ContractManager, metrics: Metrics) {
        this.web_service = service;
        this.config = config;
        this.contractManager = contractManager;
        this.metrics = metrics;
    }

    private get app(): express.Application {
        return this.web_service.app;
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
        res.set("Content-Type", this.metrics.contentType());
        this.metrics.add("status", 1);
        for (const elem of this.config.relay.managerKeys) {
            const wallet = new Wallet(elem, hre.ethers.provider);
            const balance = (await wallet.getBalance()).div(BigNumber.from(1_000_000_000)).toNumber();
            this.metrics.gaugeLabels("certifier_balance", { address: wallet.address }, balance);
        }
        res.end(await this.metrics.metrics());
    }
}
