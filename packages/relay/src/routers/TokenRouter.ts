import { BIP20DelegatedTransfer } from "../../typechain-types";
import { Config } from "../common/Config";
import { logger } from "../common/Logger";
import { WebService } from "../service/WebService";

import { param, validationResult } from "express-validator";
import * as hre from "hardhat";

import express from "express";
import { ISignerItem, RelaySigners } from "../contract/Signers";
import { Metrics } from "../metrics/Metrics";
import { GraphStorage } from "../storage/GraphStorage";
import { RelayStorage } from "../storage/RelayStorage";
import { ResponseMessage } from "../utils/Errors";

export class TokenRouter {
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

    private readonly _relaySigners: RelaySigners;

    private _storage: RelayStorage;
    private _graph: GraphStorage;

    /**
     *
     * @param service  WebService
     * @param config Configuration
     * @param metrics Metrics
     * @param storage
     * @param graph
     * @param relaySigners
     */
    constructor(
        service: WebService,
        config: Config,
        metrics: Metrics,
        storage: RelayStorage,
        graph: GraphStorage,
        relaySigners: RelaySigners
    ) {
        this._web_service = service;
        this._config = config;
        this._metrics = metrics;

        this._storage = storage;
        this._graph = graph;
        this._relaySigners = relaySigners;
    }

    private get app(): express.Application {
        return this._web_service.app;
    }

    /***
     * 트팬잭션을 중계할 때 사용될 서명자
     * @private
     */
    private async getRelaySigner(): Promise<ISignerItem> {
        return this._relaySigners.getSigner();
    }

    /***
     * 트팬잭션을 중계할 때 사용될 서명자
     * @private
     */
    private releaseRelaySigner(signer: ISignerItem) {
        signer.using = false;
    }

    private _tokenContract: BIP20DelegatedTransfer | undefined;
    private async getTokenContract(): Promise<BIP20DelegatedTransfer> {
        if (this._tokenContract === undefined) {
            const factory = await hre.ethers.getContractFactory("BIP20DelegatedTransfer");
            this._tokenContract = factory.attach(this._config.contracts.tokenAddress);
        }
        return this._tokenContract;
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

    private async token_side_nonce(req: express.Request, res: express.Response) {
        logger.http(`GET /v1/token/side/nonce ${req.ip}:${JSON.stringify(req.params)}`);
        const account: string = String(req.params.account).trim();
        const nonce = await (await this.getTokenContract()).nonceOf(account);
        this._metrics.add("success", 1);
        return res.status(200).json(this.makeResponseData(0, { account, nonce: nonce.toString() }));
    }

    /**
     * 사이드체인의 토큰의 잔고
     * GET /v1/token/side/balance/:account
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
            const contract = await this.getTokenContract();
            const balance = await contract.balanceOf(account);
            this._metrics.add("success", 1);
            return res.status(200).json(this.makeResponseData(0, { account, balance: balance.toString() }));
        } catch (error: any) {
            const msg = ResponseMessage.getEVMErrorMessage(error);
            logger.error(`POST /v1/token/side/balance/:account : ${msg.error.message}`);
            this._metrics.add("failure", 1);
            return res.status(200).json(msg);
        }
    }
}
