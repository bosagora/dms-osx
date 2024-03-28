import { Config } from "../common/Config";
import { logger } from "../common/Logger";
import { ContractManager } from "../contract/ContractManager";
import { ISignerItem, RelaySigners } from "../contract/Signers";
import { Metrics } from "../metrics/Metrics";
import { WebService } from "../service/WebService";
import { GraphStorage } from "../storage/GraphStorage";
import { RelayStorage } from "../storage/RelayStorage";
import { ResponseMessage } from "../utils/Errors";

import { param, validationResult } from "express-validator";

import express from "express";

import { ethers } from "ethers";

export class TokenRouter {
    private web_service: WebService;
    private readonly config: Config;
    private readonly contractManager: ContractManager;
    private readonly metrics: Metrics;
    private readonly relaySigners: RelaySigners;
    private storage: RelayStorage;
    private graph: GraphStorage;

    constructor(
        service: WebService,
        config: Config,
        contractManager: ContractManager,
        metrics: Metrics,
        storage: RelayStorage,
        graph: GraphStorage,
        relaySigners: RelaySigners
    ) {
        this.web_service = service;
        this.config = config;
        this.contractManager = contractManager;
        this.metrics = metrics;

        this.storage = storage;
        this.graph = graph;
        this.relaySigners = relaySigners;
    }

    private get app(): express.Application {
        return this.web_service.app;
    }

    /***
     * 트팬잭션을 중계할 때 사용될 서명자
     * @private
     */
    private async getRelaySigner(provider?: ethers.providers.Provider): Promise<ISignerItem> {
        if (provider === undefined) provider = this.contractManager.sideChainProvider;
        return this.relaySigners.getSigner(provider);
    }

    /***
     * 트팬잭션을 중계할 때 사용될 서명자
     * @private
     */
    private releaseRelaySigner(signer: ISignerItem) {
        signer.using = false;
    }

    /**
     * Make the response data
     * @param code      The result code
     * @param data      The result data
     * @param error     The error
     * @private
     */
    private makeResponseData(code: number, data: any, error?: any): any {
        return {
            code,
            data,
            error,
        };
    }

    public registerRoutes() {
        this.app.get(
            "/v1/token/main/balance/:account",
            [param("account").exists().trim().isEthereumAddress()],
            this.token_main_balance.bind(this)
        );

        this.app.get(
            "/v1/token/main/nonce/:account",
            [param("account").exists().trim().isEthereumAddress()],
            this.token_main_nonce.bind(this)
        );

        this.app.get(
            "/v1/token/side/balance/:account",
            [param("account").exists().trim().isEthereumAddress()],
            this.token_side_balance.bind(this)
        );

        this.app.get(
            "/v1/token/side/nonce/:account",
            [param("account").exists().trim().isEthereumAddress()],
            this.token_side_nonce.bind(this)
        );
    }

    private async token_main_nonce(req: express.Request, res: express.Response) {
        logger.http(`GET /v1/token/main/nonce ${req.ip}:${JSON.stringify(req.params)}`);
        const account: string = String(req.params.account).trim();
        const nonce = await this.contractManager.mainTokenContract.nonceOf(account);
        this.metrics.add("success", 1);
        return res.status(200).json(this.makeResponseData(0, { account, nonce: nonce.toString() }));
    }

    private async token_side_nonce(req: express.Request, res: express.Response) {
        logger.http(`GET /v1/token/side/nonce ${req.ip}:${JSON.stringify(req.params)}`);
        const account: string = String(req.params.account).trim();
        const nonce = await this.contractManager.sideTokenContract.nonceOf(account);
        this.metrics.add("success", 1);
        return res.status(200).json(this.makeResponseData(0, { account, nonce: nonce.toString() }));
    }

    /**
     * 메인체인의 토큰의 잔고
     * GET /v1/token/main/balance/:account
     * @private
     */
    private async token_main_balance(req: express.Request, res: express.Response) {
        logger.http(`POST /v1/token/main/balance/:account ${req.ip}:${JSON.stringify(req.params)}`);

        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(200).json(ResponseMessage.getErrorMessage("2001", { validation: errors.array() }));
        }

        try {
            const account: string = String(req.params.account).trim();
            const balance = await this.contractManager.mainTokenContract.balanceOf(account);
            this.metrics.add("success", 1);
            return res.status(200).json(this.makeResponseData(0, { account, balance: balance.toString() }));
        } catch (error: any) {
            const msg = ResponseMessage.getEVMErrorMessage(error);
            logger.error(`POST /v1/token/main/balance/:account : ${msg.error.message}`);
            this.metrics.add("failure", 1);
            return res.status(200).json(msg);
        }
    }

    /**
     * 사이드체인의 토큰의 잔고
     * GET /v1/toke/side/balance/:account
     * @private
     */
    private async token_side_balance(req: express.Request, res: express.Response) {
        logger.http(`POST /v1/token/side/balance/:account ${req.ip}:${JSON.stringify(req.params)}`);

        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(200).json(ResponseMessage.getErrorMessage("2001", { validation: errors.array() }));
        }

        try {
            const account: string = String(req.params.account).trim();
            const balance = await this.contractManager.sideTokenContract.balanceOf(account);
            this.metrics.add("success", 1);
            return res.status(200).json(this.makeResponseData(0, { account, balance: balance.toString() }));
        } catch (error: any) {
            const msg = ResponseMessage.getEVMErrorMessage(error);
            logger.error(`POST /v1/token/side/balance/:account : ${msg.error.message}`);
            this.metrics.add("failure", 1);
            return res.status(200).json(msg);
        }
    }
}
