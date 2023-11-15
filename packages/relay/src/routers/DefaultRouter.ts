import { WebService } from "../service/WebService";

import express from "express";

export class DefaultRouter {
    /**
     *
     * @private
     */
    private _web_service: WebService;

    /**
     *
     * @param service  WebService
     */
    constructor(service: WebService) {
        this._web_service = service;
    }

    private get app(): express.Application {
        return this._web_service.app;
    }

    public registerRoutes() {
        // Get Health Status
        this.app.get("/", [], this.getHealthStatus.bind(this));
        this.app.post("/callback", [], this.callback.bind(this));
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
}
