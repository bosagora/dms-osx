import { PhoneLinkCollection } from "../../typechain-types";
import { Config } from "../common/Config";
import { logger } from "../common/Logger";
import { WebService } from "../service/WebService";
import { ContractUtils } from "../utils/ContractUtils";

import { body, param, validationResult } from "express-validator";
import * as hre from "hardhat";

import express from "express";
import { ISignerItem, RelaySigners } from "../contract/Signers";
import { Metrics } from "../metrics/Metrics";
import { GraphStorage } from "../storage/GraphStorage";
import { RelayStorage } from "../storage/RelayStorage";
import { ResponseMessage } from "../utils/Errors";

export class PhoneLinkRouter {
    private _web_service: WebService;

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

    private _phoneLinkContract: PhoneLinkCollection | undefined;
    private async getPhoneLinkContract(): Promise<PhoneLinkCollection> {
        if (this._phoneLinkContract === undefined) {
            const linkCollectionFactory = await hre.ethers.getContractFactory("PhoneLinkCollection");
            this._phoneLinkContract = linkCollectionFactory.attach(this._config.contracts.phoneLinkerAddress);
        }
        return this._phoneLinkContract;
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
            "/v1/link/nonce/:account",
            [param("account").exists().trim().isEthereumAddress()],
            this.phone_link_nonce.bind(this)
        );
        // 포인트의 종류를 선택하는 기능
        this.app.post(
            "/v1/link/removePhoneInfo",
            [
                body("account").exists().trim().isEthereumAddress(),
                body("signature")
                    .exists()
                    .trim()
                    .matches(/^(0x)[0-9a-f]{130}$/i),
            ],
            this.removePhoneInfoOfLink.bind(this)
        );
    }

    private async phone_link_nonce(req: express.Request, res: express.Response) {
        logger.http(`GET /v1/link/main/nonce ${req.ip}:${JSON.stringify(req.params)}`);
        const account: string = String(req.params.account).trim();
        const nonce = await (await this.getPhoneLinkContract()).nonceOf(account);
        this._metrics.add("success", 1);
        return res.status(200).json(this.makeResponseData(0, { account, nonce: nonce.toString() }));
    }
    /**
     * 포인트의 종류를 선택한다.
     * POST /v1/link/removePhoneInfo
     * @private
     */
    private async removePhoneInfoOfLink(req: express.Request, res: express.Response) {
        logger.http(`POST /v1/link/removePhoneInfo ${req.ip}:${JSON.stringify(req.body)}`);

        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(200).json(ResponseMessage.getErrorMessage("2001", { validation: errors.array() }));
        }

        const signerItem = await this.getRelaySigner();
        try {
            const account: string = String(req.body.account).trim();
            const signature: string = String(req.body.signature).trim(); // 서명

            // 서명검증
            const userNonce = await (await this.getPhoneLinkContract()).nonceOf(account);
            const message = ContractUtils.getRemoveMessage(account, userNonce);
            if (!ContractUtils.verifyMessage(account, message, signature))
                return res.status(200).json(ResponseMessage.getErrorMessage("1501"));

            const tx = await (await this.getPhoneLinkContract()).connect(signerItem.signer).remove(account, signature);

            logger.http(`TxHash(removePhoneInfoOfLink): ${tx.hash}`);
            this._metrics.add("success", 1);
            return res.status(200).json(this.makeResponseData(0, { txHash: tx.hash }));
        } catch (error: any) {
            const msg = ResponseMessage.getEVMErrorMessage(error);
            logger.error(`POST /v1/link/removePhoneInfo : ${msg.error.message}`);
            this._metrics.add("failure", 1);
            return res.status(200).json(msg);
        } finally {
            this.releaseRelaySigner(signerItem);
        }
    }
}
