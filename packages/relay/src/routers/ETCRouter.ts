import { Config } from "../common/Config";
import { logger } from "../common/Logger";
import { ContractManager } from "../contract/ContractManager";
import { INotificationSender } from "../delegator/NotificationSender";
import { Metrics } from "../metrics/Metrics";
import { WebService } from "../service/WebService";
import { GraphStorage } from "../storage/GraphStorage";
import { RelayStorage } from "../storage/RelayStorage";
import { ContractUtils } from "../utils/ContractUtils";
import { ResponseMessage } from "../utils/Errors";

import express from "express";
import { body, param, query, validationResult } from "express-validator";

export class ETCRouter {
    private web_service: WebService;
    private readonly config: Config;
    private readonly contractManager: ContractManager;
    private readonly metrics: Metrics;
    private storage: RelayStorage;
    private graph_sidechain: GraphStorage;
    private graph_mainchain: GraphStorage;
    private readonly sender: INotificationSender;

    constructor(
        service: WebService,
        config: Config,
        contractManager: ContractManager,
        metrics: Metrics,
        storage: RelayStorage,
        graph_sidechain: GraphStorage,
        graph_mainchain: GraphStorage,
        sender: INotificationSender
    ) {
        this.web_service = service;
        this.config = config;
        this.contractManager = contractManager;
        this.metrics = metrics;
        this.storage = storage;
        this.graph_sidechain = graph_sidechain;
        this.graph_mainchain = graph_mainchain;
        this.sender = sender;
    }

    private get app(): express.Application {
        return this.web_service.app;
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
        // 포인트의 종류를 선택하는 기능
        this.app.post(
            "/v1/mobile/register",
            [
                body("account").exists().trim().isEthereumAddress(),
                body("token").exists(),
                body("language").exists(),
                body("os").exists(),
                body("signature")
                    .exists()
                    .trim()
                    .matches(/^(0x)[0-9a-f]{130}$/i),
            ],
            this.mobile_register.bind(this)
        );

        // 포인트의 종류를 선택하는 기능
        this.app.post(
            "/v1/mobile/send",
            [
                body("account").exists().trim().isEthereumAddress(),
                body("type").exists(),
                body("title").exists(),
                body("contents").exists(),
                body("contentType").exists(),
            ],
            this.mobile_send.bind(this)
        );

        // 포인트의 종류를 선택하는 기능
        this.app.get(
            "/v1/mobile/info/:account",
            [param("account").exists().trim().isEthereumAddress(), query("type").exists()],
            this.mobile_info.bind(this)
        );
    }

    /**
     * POST /v1/mobile/register
     * @private
     */
    private async mobile_register(req: express.Request, res: express.Response) {
        logger.http(`POST /v1/mobile/register`);

        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(200).json(ResponseMessage.getErrorMessage("2001", { validation: errors.array() }));
        }

        try {
            const account: string = String(req.body.account).trim();
            const type = req.body.type === undefined ? 0 : Number(req.body.type);
            const token: string = String(req.body.token).trim();
            const language: string = String(req.body.language).trim();
            const os: string = String(req.body.os).trim();
            const signature: string = String(req.body.signature).trim();

            // 서명검증
            if (!ContractUtils.verifyMobileToken(account, token, signature))
                return res.status(200).json(ResponseMessage.getErrorMessage("1501"));

            const item = {
                account,
                type,
                token,
                language,
                os,
            };
            await this.storage.postMobile(item);

            this.metrics.add("success", 1);
            return res.status(200).json(this.makeResponseData(0, item));
        } catch (error: any) {
            const msg = ResponseMessage.getEVMErrorMessage(error);
            logger.error(`POST /v1/mobile/register : ${msg.error.message}`);
            this.metrics.add("failure", 1);
            return res.status(200).json(msg);
        }
    }

    /**
     * POST /v1/mobile/send
     * @private
     */
    private async mobile_send(req: express.Request, res: express.Response) {
        logger.http(`POST /v1/mobile/send`);

        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(200).json(ResponseMessage.getErrorMessage("2001", { validation: errors.array() }));
        }

        let accessKey = req.get("Authorization");
        if (accessKey === undefined) accessKey = String(req.body.accessKey).trim();
        if (accessKey !== this.config.relay.accessKey) {
            return res.json(ResponseMessage.getErrorMessage("2002"));
        }

        try {
            const account: string = String(req.body.account).trim();
            const type: number = Number(req.body.type);
            const title: string = String(req.body.title).trim();
            const contents: string = String(req.body.contents).trim();
            const contentType: string = String(req.body.contentType).trim();

            const mobileData = await this.storage.getMobile(account, type);
            if (mobileData !== undefined) {
                await this.sender.send(mobileData.token, title, contents, { type: contentType });
            }
            this.metrics.add("success", 1);
            return res.status(200).json(this.makeResponseData(0, {}));
        } catch (error: any) {
            const msg = ResponseMessage.getEVMErrorMessage(error);
            logger.error(`POST /v1/mobile/send : ${msg.error.message}`);
            this.metrics.add("failure", 1);
            return res.status(200).json(msg);
        }
    }

    /**
     * POST /v1/mobile/info
     * @private
     */
    private async mobile_info(req: express.Request, res: express.Response) {
        logger.http(`POST /v1/mobile/info`);

        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(200).json(ResponseMessage.getErrorMessage("2001", { validation: errors.array() }));
        }

        if (req.get("Authorization") !== this.config.relay.accessKey) {
            return res.json(ResponseMessage.getErrorMessage("2002"));
        }

        try {
            const account: string = String(req.params.account).trim();
            const type: number = Number(req.query.type);

            const mobileData = await this.storage.getMobile(account, type);
            if (mobileData === undefined) {
                return res.status(200).json(ResponseMessage.getErrorMessage("2008"));
            }

            this.metrics.add("success", 1);
            return res.status(200).json(
                this.makeResponseData(0, {
                    account: mobileData.account,
                    type: mobileData.type,
                    token: mobileData.token,
                    language: mobileData.language,
                    os: mobileData.os,
                })
            );
        } catch (error: any) {
            const msg = ResponseMessage.getEVMErrorMessage(error);
            logger.error(`POST /v1/mobile/info : ${msg.error.message}`);
            this.metrics.add("failure", 1);
            return res.status(200).json(msg);
        }
    }
}
