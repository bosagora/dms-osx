import { Config } from "../common/Config";
import { logger } from "../common/Logger";
import { ContractManager } from "../contract/ContractManager";
import { ISignerItem, RelaySigners } from "../contract/Signers";
import { Metrics } from "../metrics/Metrics";
import { WebService } from "../service/WebService";
import { GraphStorage } from "../storage/GraphStorage";
import { RelayStorage } from "../storage/RelayStorage";
import { ContractUtils } from "../utils/ContractUtils";
import { ResponseMessage } from "../utils/Errors";

import { body, param, validationResult } from "express-validator";

import { ethers } from "ethers";
import express from "express";

export class PhoneLinkRouter {
    private web_service: WebService;
    private readonly config: Config;
    private readonly contractManager: ContractManager;
    private readonly metrics: Metrics;
    private readonly relaySigners: RelaySigners;
    private storage: RelayStorage;
    private graph_sidechain: GraphStorage;
    private graph_mainchain: GraphStorage;

    constructor(
        service: WebService,
        config: Config,
        contractManager: ContractManager,
        metrics: Metrics,
        storage: RelayStorage,
        graph_sidechain: GraphStorage,
        graph_mainchain: GraphStorage,
        relaySigners: RelaySigners
    ) {
        this.web_service = service;
        this.config = config;
        this.contractManager = contractManager;
        this.metrics = metrics;

        this.storage = storage;
        this.graph_sidechain = graph_sidechain;
        this.graph_mainchain = graph_mainchain;
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
        const nonce = await this.contractManager.sidePhoneLinkerContract.nonceOf(account);
        this.metrics.add("success", 1);
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
            const userNonce = await this.contractManager.sidePhoneLinkerContract.nonceOf(account);
            const message = ContractUtils.getRemoveMessage(account, userNonce, this.contractManager.sideChainId);
            if (!ContractUtils.verifyMessage(account, message, signature))
                return res.status(200).json(ResponseMessage.getErrorMessage("1501"));

            const tx = await this.contractManager.sidePhoneLinkerContract
                .connect(signerItem.signer)
                .remove(account, signature);

            logger.http(`TxHash(removePhoneInfoOfLink): ${tx.hash}`);
            this.metrics.add("success", 1);
            return res.status(200).json(this.makeResponseData(0, { txHash: tx.hash }));
        } catch (error: any) {
            const msg = ResponseMessage.getEVMErrorMessage(error);
            logger.error(`POST /v1/link/removePhoneInfo : ${msg.error.message}`);
            this.metrics.add("failure", 1);
            return res.status(200).json(msg);
        } finally {
            this.releaseRelaySigner(signerItem);
        }
    }
}
