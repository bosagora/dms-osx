import { Config } from "../common/Config";
import { logger } from "../common/Logger";
import { WebService } from "../service/WebService";
import { ContractUtils } from "../utils/ContractUtils";

import { body, validationResult } from "express-validator";

import express from "express";
import { RelayStorage } from "../storage/RelayStorage";
import { ResponseMessage } from "../utils/Errors";

export class ETCRouter {
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

    private _storage: RelayStorage;

    /**
     *
     * @param service  WebService
     * @param config Configuration
     * @param storage
     */
    constructor(service: WebService, config: Config, storage: RelayStorage) {
        this._web_service = service;
        this._config = config;
        this._storage = storage;
    }

    private get app(): express.Application {
        return this._web_service.app;
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
            const token: string = String(req.body.token).trim();
            const language: string = String(req.body.language).trim();
            const os: string = String(req.body.os).trim();
            const signature: string = String(req.body.signature).trim();

            // 서명검증
            if (!ContractUtils.verifyMobileToken(account, token, signature))
                return res.status(200).json(ResponseMessage.getErrorMessage("1501"));

            const item = {
                account,
                token,
                language,
                os,
            };
            await this._storage.postMobile(item);

            return res.status(200).json(this.makeResponseData(0, item));
        } catch (error: any) {
            const msg = ResponseMessage.getEVMErrorMessage(error);
            logger.error(`POST /v1/mobile/register : ${msg.error.message}`);
            return res.status(200).json(msg);
        }
    }
}
