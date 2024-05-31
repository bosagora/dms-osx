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
import { Validation } from "../validation";

// tslint:disable-next-line:no-implicit-dependencies
import { AddressZero } from "@ethersproject/constants";
import { BigNumber, ethers } from "ethers";
import express from "express";
import { body, param, validationResult } from "express-validator";

export class TokenRouter {
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

        this.app.post(
            "/v1/token/main/transfer",
            [
                body("amount").exists().custom(Validation.isAmount),
                body("from").exists().trim().isEthereumAddress(),
                body("to").exists().trim().isEthereumAddress(),
                body("expiry").exists().isNumeric(),
                body("signature")
                    .exists()
                    .trim()
                    .matches(/^(0x)[0-9a-f]{130}$/i),
            ],
            this.token_main_transfer.bind(this)
        );

        this.app.post(
            "/v1/token/side/transfer",
            [
                body("amount").exists().custom(Validation.isAmount),
                body("from").exists().trim().isEthereumAddress(),
                body("expiry").exists().isNumeric(),
                body("to").exists().trim().isEthereumAddress(),
                body("signature")
                    .exists()
                    .trim()
                    .matches(/^(0x)[0-9a-f]{130}$/i),
            ],
            this.token_side_transfer.bind(this)
        );
        this.app.get("/v1/chain/main/id", [], this.chain_main_id.bind(this));
        this.app.get("/v1/chain/side/id", [], this.chain_side_id.bind(this));
        this.app.get("/v1/chain/main/info", [], this.chain_main_info.bind(this));
        this.app.get("/v1/chain/side/info", [], this.chain_side_info.bind(this));
        this.app.get("/v1/system/info", [], this.system_info.bind(this));
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

    private async token_main_transfer(req: express.Request, res: express.Response) {
        logger.http(`POST /v1/token/main/transfer ${req.ip}:${JSON.stringify(req.body)}`);

        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(200).json(ResponseMessage.getErrorMessage("2001", { validation: errors.array() }));
        }

        const signerItem = await this.getRelaySigner(this.contractManager.mainChainProvider);
        try {
            const from: string = String(req.body.from).trim();
            const to: string = String(req.body.to).trim();
            const amount: BigNumber = BigNumber.from(req.body.amount);
            const expiry: number = Number(req.body.expiry);
            const signature: string = String(req.body.signature).trim();
            const balance = await this.contractManager.mainTokenContract.balanceOf(from);
            if (balance.lt(amount)) return res.status(200).json(ResponseMessage.getErrorMessage("1511"));

            const nonce = await this.contractManager.mainTokenContract.nonceOf(from);
            const message = ContractUtils.getTransferMessage(
                this.contractManager.mainChainId,
                this.contractManager.mainTokenContract.address,
                from,
                to,
                amount,
                nonce,
                expiry
            );
            if (!ContractUtils.verifyMessage(from, message, signature))
                return res.status(200).json(ResponseMessage.getErrorMessage("1501"));
            const tx = await this.contractManager.mainTokenContract
                .connect(signerItem.signer)
                .delegatedTransfer(from, to, amount, expiry, signature);
            this.metrics.add("success", 1);
            return res.status(200).json(this.makeResponseData(0, { from, to, amount, txHash: tx.hash }));
        } catch (error: any) {
            const msg = ResponseMessage.getEVMErrorMessage(error);
            logger.error(`POST /v1/token/main/transfer : ${msg.error.message}`);
            this.metrics.add("failure", 1);
            return res.status(200).json(this.makeResponseData(msg.code, undefined, msg.error));
        } finally {
            this.releaseRelaySigner(signerItem);
        }
    }

    private async token_side_transfer(req: express.Request, res: express.Response) {
        logger.http(`POST /v1/token/side/transfer ${req.ip}:${JSON.stringify(req.body)}`);

        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(200).json(ResponseMessage.getErrorMessage("2001", { validation: errors.array() }));
        }

        const signerItem = await this.getRelaySigner(this.contractManager.sideChainProvider);
        try {
            const from: string = String(req.body.from).trim();
            const to: string = String(req.body.to).trim();
            const amount: BigNumber = BigNumber.from(req.body.amount);
            const expiry: number = Number(req.body.expiry);
            const signature: string = String(req.body.signature).trim();
            const balance = await this.contractManager.sideTokenContract.balanceOf(from);
            if (balance.lt(amount)) return res.status(200).json(ResponseMessage.getErrorMessage("1511"));

            const nonce = await this.contractManager.sideTokenContract.nonceOf(from);
            const message = ContractUtils.getTransferMessage(
                this.contractManager.sideChainId,
                this.contractManager.sideTokenContract.address,
                from,
                to,
                amount,
                nonce,
                expiry
            );
            if (!ContractUtils.verifyMessage(from, message, signature))
                return res.status(200).json(ResponseMessage.getErrorMessage("1501"));
            const tx = await this.contractManager.sideTokenContract
                .connect(signerItem.signer)
                .delegatedTransfer(from, to, amount, expiry, signature);
            this.metrics.add("success", 1);
            return res.status(200).json(this.makeResponseData(0, { from, to, amount, txHash: tx.hash }));
        } catch (error: any) {
            const msg = ResponseMessage.getEVMErrorMessage(error);
            logger.error(`GET /v1/token/side/transfer : ${msg.error.message}`);
            this.metrics.add("failure", 1);
            return res.status(200).json(this.makeResponseData(msg.code, undefined, msg.error));
        } finally {
            this.releaseRelaySigner(signerItem);
        }
    }

    /**
     * 메인체인의 체인 아이디
     * GET /v1/chain/main/id
     * @private
     */
    private async chain_main_id(req: express.Request, res: express.Response) {
        logger.http(`GET /v1/chain/main/id ${req.ip}:${JSON.stringify(req.params)}`);
        try {
            this.metrics.add("success", 1);
            return res.status(200).json(this.makeResponseData(0, { chainId: this.contractManager.mainChainId }));
        } catch (error: any) {
            const msg = ResponseMessage.getEVMErrorMessage(error);
            logger.error(`GET /v1/chain/main/id : ${msg.error.message}`);
            this.metrics.add("failure", 1);
            return res.status(200).json(msg);
        }
    }

    /**
     * 사이드체인의 체인 아이디
     * GET /v1/chain/side/id
     * @private
     */
    private async chain_side_id(req: express.Request, res: express.Response) {
        logger.http(`GET /v1/chain/side/id ${req.ip}:${JSON.stringify(req.params)}`);
        try {
            this.metrics.add("success", 1);
            return res.status(200).json(this.makeResponseData(0, { chainId: this.contractManager.sideChainId }));
        } catch (error: any) {
            const msg = ResponseMessage.getEVMErrorMessage(error);
            logger.error(`GET /v1/chain/side/id : ${msg.error.message}`);
            this.metrics.add("failure", 1);
            return res.status(200).json(msg);
        }
    }

    /**
     * 메인체인의 체인 정보
     * GET /v1/chain/main/info
     * @private
     */
    private async chain_main_info(req: express.Request, res: express.Response) {
        logger.http(`GET /v1/chain/main/info ${req.ip}:${JSON.stringify(req.params)}`);
        try {
            this.metrics.add("success", 1);
            return res.status(200).json(
                this.makeResponseData(0, {
                    url: this.contractManager.mainChainURL,
                    network: {
                        name: "main-chain",
                        chainId: this.contractManager.mainChainId,
                        ensAddress: AddressZero,
                        transferFee: "0",
                        bridgeFee: (
                            await this.contractManager.mainLoyaltyBridgeContract.getFee(
                                this.contractManager.mainTokenId
                            )
                        ).toString(),
                    },
                    contract: {
                        token: this.contractManager.mainTokenContract.address,
                        chainBridge: this.contractManager.mainChainBridgeContract.address,
                        loyaltyBridge: this.contractManager.mainLoyaltyBridgeContract.address,
                    },
                })
            );
        } catch (error: any) {
            const msg = ResponseMessage.getEVMErrorMessage(error);
            logger.error(`GET /v1/chain/main/info : ${msg.error.message}`);
            this.metrics.add("failure", 1);
            return res.status(200).json(msg);
        }
    }

    /**
     * 사이드체인의 체인 정보
     * GET /v1/chain/side/info
     * @private
     */
    private async chain_side_info(req: express.Request, res: express.Response) {
        logger.http(`GET /v1/chain/side/info ${req.ip}:${JSON.stringify(req.params)}`);
        try {
            this.metrics.add("success", 1);
            return res.status(200).json(
                this.makeResponseData(0, {
                    url: this.contractManager.sideChainURL,
                    network: {
                        name: "side-chain",
                        chainId: this.contractManager.sideChainId,
                        ensAddress: AddressZero,
                        transferFee: (await this.contractManager.sideLoyaltyTransferContract.getFee()).toString(),
                        bridgeFee: (
                            await this.contractManager.sideLoyaltyBridgeContract.getFee(
                                this.contractManager.sideTokenId
                            )
                        ).toString(),
                    },
                    contract: {
                        token: this.contractManager.sideTokenContract.address,
                        chainBridge: this.contractManager.sideChainBridgeContract.address,
                        loyaltyBridge: this.contractManager.sideLoyaltyBridgeContract.address,
                    },
                })
            );
        } catch (error: any) {
            const msg = ResponseMessage.getEVMErrorMessage(error);
            logger.error(`GET /v1/chain/side/info : ${msg.error.message}`);
            this.metrics.add("failure", 1);
            return res.status(200).json(msg);
        }
    }

    /**
     * 사이드체인의 체인 정보
     * GET /v1/system/info
     * @private
     */
    private async system_info(req: express.Request, res: express.Response) {
        logger.http(`GET /v1/system/info ${req.ip}:${JSON.stringify(req.query)}`);
        try {
            const tokenSymbol = await this.contractManager.sideTokenContract.symbol();
            const precision = tokenSymbol === "ACC" ? 2 : 0;
            const equivalentCurrency = tokenSymbol === "ACC" ? "PHP" : "KRW";
            const language = tokenSymbol === "ACC" ? "en" : "kr";
            this.metrics.add("success", 1);
            return res.status(200).json(
                this.makeResponseData(0, {
                    token: {
                        symbol: tokenSymbol,
                    },
                    point: {
                        precision,
                        equivalentCurrency,
                    },
                    language,
                })
            );
        } catch (error: any) {
            const msg = ResponseMessage.getEVMErrorMessage(error);
            logger.error(`GET /v1/system/info : ${msg.error.message}`);
            this.metrics.add("failure", 1);
            return res.status(200).json(msg);
        }
    }
}
