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

import { BigNumber } from "@ethersproject/bignumber";
import { AddressZero } from "@ethersproject/constants";
import { ethers } from "ethers";
import express from "express";
import { body, param, validationResult } from "express-validator";
import { BOACoin } from "../common/Amount";

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

    public async registerRoutes() {
        this.app.get(
            "/v1/token/outer/balance/:account",
            [param("account").exists().trim().isEthereumAddress()],
            this.token_outer_balance.bind(this)
        );

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
        this.app.get(
            "/v1/summary/account/:account",
            [param("account").exists().trim().isEthereumAddress()],
            this.summary_account.bind(this)
        );
        this.app.get(
            "/v1/summary/shop/:shopId",
            [
                param("shopId")
                    .exists()
                    .trim()
                    .matches(/^(0x)[0-9a-f]{64}$/i),
            ],
            this.summary_shop.bind(this)
        );
        this.app.get(
            "/v2/summary/account/:account",
            [param("account").exists().trim().isEthereumAddress()],
            this.v2_summary_account.bind(this)
        );
        this.app.get(
            "/v2/summary/shop/:shopId",
            [
                param("shopId")
                    .exists()
                    .trim()
                    .matches(/^(0x)[0-9a-f]{64}$/i),
            ],
            this.v2_summary_shop.bind(this)
        );

        this.app.get("/v3/chain/outer/id", [], this.v3_chain_outer_id.bind(this));
        this.app.get("/v3/chain/main/id", [], this.v3_chain_main_id.bind(this));
        this.app.get("/v3/chain/side/id", [], this.v3_chain_side_id.bind(this));
        this.app.get("/v3/chain/outer/info", [], this.v3_chain_outer_info.bind(this));
        this.app.get("/v3/chain/main/info", [], this.v3_chain_main_info.bind(this));
        this.app.get("/v3/chain/side/info", [], this.v3_chain_side_info.bind(this));
        this.app.get("/v3/system/info", [], this.v3_system_info.bind(this));
        this.app.get(
            "/v3/summary/account/:account",
            [param("account").exists().trim().isEthereumAddress()],
            this.v3_summary_account.bind(this)
        );
        this.app.get(
            "/v3/summary/shop/:shopId",
            [
                param("shopId")
                    .exists()
                    .trim()
                    .matches(/^(0x)[0-9a-f]{64}$/i),
            ],
            this.v3_summary_shop.bind(this)
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
     * outer 체인의 토큰의 잔고
     * GET /v1/token/outer/balance/:account
     * @private
     */
    private async token_outer_balance(req: express.Request, res: express.Response) {
        logger.http(`GET /v1/token/outer/balance/:account ${req.ip}:${JSON.stringify(req.params)}`);

        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(200).json(ResponseMessage.getErrorMessage("2001", { validation: errors.array() }));
        }

        try {
            const account: string = String(req.params.account).trim();
            const balance = await this.contractManager.outerTokenContract.balanceOf(account);
            this.metrics.add("success", 1);
            return res.status(200).json(this.makeResponseData(0, { account, balance: balance.toString() }));
        } catch (error: any) {
            const msg = ResponseMessage.getEVMErrorMessage(error);
            logger.error(`GET /v1/token/outer/balance/:account : ${msg.error.message}`);
            this.metrics.add("failure", 1);
            return res.status(200).json(msg);
        }
    }

    /**
     * 메인체인의 토큰의 잔고
     * GET /v1/token/main/balance/:account
     * @private
     */
    private async token_main_balance(req: express.Request, res: express.Response) {
        logger.http(`GET /v1/token/main/balance/:account ${req.ip}:${JSON.stringify(req.params)}`);

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
            logger.error(`GET /v1/token/main/balance/:account : ${msg.error.message}`);
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
        logger.http(`GET /v1/token/side/balance/:account ${req.ip}:${JSON.stringify(req.params)}`);

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
            logger.error(`GET /v1/token/side/balance/:account : ${msg.error.message}`);
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
                .delegatedTransferWithFee(from, to, amount, expiry, signature);
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
                .delegatedTransferWithFee(from, to, amount, expiry, signature);
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
                        chainTransferFee: (await this.contractManager.mainTokenContract.getProtocolFee()).toString(),
                        chainBridgeFee: (
                            await this.contractManager.mainInnerChainBridgeContract.getProtocolFee(
                                this.contractManager.mainTokenId
                            )
                        ).toString(),
                        loyaltyTransferFee: BigNumber.from(0).toString(),
                        loyaltyBridgeFee: (
                            await this.contractManager.mainLoyaltyBridgeContract.getProtocolFee(
                                this.contractManager.mainTokenId
                            )
                        ).toString(),
                    },
                    contract: {
                        token: this.contractManager.mainTokenContract.address,
                        chainBridge: this.contractManager.mainInnerChainBridgeContract.address,
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
                        chainTransferFee: (await this.contractManager.sideTokenContract.getProtocolFee()).toString(),
                        chainBridgeFee: (
                            await this.contractManager.sideInnerChainBridgeContract.getProtocolFee(
                                this.contractManager.sideTokenId
                            )
                        ).toString(),
                        loyaltyTransferFee: (
                            await this.contractManager.sideLoyaltyTransferContract.getProtocolFee()
                        ).toString(),
                        loyaltyBridgeFee: (
                            await this.contractManager.sideLoyaltyBridgeContract.getProtocolFee(
                                this.contractManager.sideTokenId
                            )
                        ).toString(),
                    },
                    contract: {
                        token: this.contractManager.sideTokenContract.address,
                        phoneLink: this.contractManager.sidePhoneLinkerContract.address,
                        currencyRate: this.contractManager.sideCurrencyRateContract.address,
                        loyaltyProvider: this.contractManager.sideLoyaltyProviderContract.address,
                        loyaltyConsumer: this.contractManager.sideLoyaltyConsumerContract.address,
                        loyaltyTransfer: this.contractManager.sideLoyaltyTransferContract.address,
                        loyaltyExchanger: this.contractManager.sideLoyaltyExchangerContract.address,
                        loyaltyBridge: this.contractManager.sideLoyaltyBridgeContract.address,
                        shop: this.contractManager.sideShopContract.address,
                        ledger: this.contractManager.sideLedgerContract.address,
                        chainBridge: this.contractManager.sideInnerChainBridgeContract.address,
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
            const language = tokenSymbol === "ACC" ? "en" : "ko";
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
                    support: {
                        chainBridge: this.config.relay.supportChainBridge,
                        loyaltyBridge: this.config.relay.supportLoyaltyBridge,
                        exchange: this.config.relay.supportExchange,
                    },
                })
            );
        } catch (error: any) {
            const msg = ResponseMessage.getEVMErrorMessage(error);
            logger.error(`GET /v1/system/info : ${msg.error.message}`);
            this.metrics.add("failure", 1);
            return res.status(200).json(msg);
        }
    }

    private async summary_account(req: express.Request, res: express.Response) {
        logger.http(`GET /v1/summary/account/:account ${req.ip}:${JSON.stringify(req.params)}`);

        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(200).json(ResponseMessage.getErrorMessage("2001", { validation: errors.array() }));
        }

        try {
            let account: string = String(req.params.account).trim();
            if (ContractUtils.isTemporaryAccount(account)) {
                const realAccount = await this.storage.getRealAccountOnTemporary(account);
                if (realAccount === undefined) {
                    return res.status(200).json(ResponseMessage.getErrorMessage("2004"));
                } else {
                    account = realAccount;
                }
            }

            const isProvider = await this.contractManager.sideLedgerContract.isProvider(account);
            const assistant = await this.contractManager.sideLedgerContract.provisionAgentOf(account);

            const symbol = await this.contractManager.sideTokenContract.symbol();
            const name = await this.contractManager.sideTokenContract.name();
            const tokenAmount = BOACoin.make(1).value;
            const pointAmount = await this.contractManager.sideCurrencyRateContract.convertTokenToPoint(tokenAmount);
            const decimals = await this.contractManager.sideTokenContract.decimals();

            const pointBalance = await this.contractManager.sideLedgerContract.pointBalanceOf(account);
            const pointValue = BigNumber.from(pointBalance);

            const tokenBalanceInLedger = await this.contractManager.sideLedgerContract.tokenBalanceOf(account);
            const tokenValueInLedger = await this.contractManager.sideCurrencyRateContract.convertTokenToPoint(
                tokenBalanceInLedger
            );
            const tokenBalanceInMainChain = await this.contractManager.mainTokenContract.balanceOf(account);
            const tokenValueInMainChain = await this.contractManager.sideCurrencyRateContract.convertTokenToPoint(
                tokenBalanceInMainChain
            );
            const tokenBalanceInSideChain = await this.contractManager.sideTokenContract.balanceOf(account);
            const tokenValueInSideChain = await this.contractManager.sideCurrencyRateContract.convertTokenToPoint(
                tokenBalanceInSideChain
            );

            const defaultCurrencySymbol = await this.contractManager.sideCurrencyRateContract.defaultSymbol();

            this.metrics.add("success", 1);
            return res.status(200).json(
                this.makeResponseData(0, {
                    account,
                    tokenInfo: {
                        symbol,
                        name,
                        decimals,
                    },
                    exchangeRate: {
                        token: {
                            symbol,
                            value: tokenAmount.toString(),
                        },
                        currency: {
                            symbol: defaultCurrencySymbol,
                            value: pointAmount.toString(),
                        },
                    },
                    provider: {
                        enable: isProvider,
                        assistant,
                    },
                    ledger: {
                        point: { balance: pointBalance.toString(), value: pointValue.toString() },
                        token: { balance: tokenBalanceInLedger.toString(), value: tokenValueInLedger.toString() },
                    },
                    mainChain: {
                        point: { balance: "0", value: "0" },
                        token: { balance: tokenBalanceInMainChain.toString(), value: tokenValueInMainChain.toString() },
                    },
                    sideChain: {
                        point: { balance: "0", value: "0" },
                        token: { balance: tokenBalanceInSideChain.toString(), value: tokenValueInSideChain.toString() },
                    },
                    protocolFees: {
                        transfer: (await this.contractManager.mainTokenContract.getProtocolFee()).toString(),
                        withdraw: (
                            await this.contractManager.mainInnerChainBridgeContract.getProtocolFee(
                                this.contractManager.mainTokenId
                            )
                        ).toString(),
                        deposit: (
                            await this.contractManager.sideLoyaltyBridgeContract.getProtocolFee(
                                this.contractManager.sideTokenId
                            )
                        ).toString(),
                    },
                })
            );
        } catch (error: any) {
            const msg = ResponseMessage.getEVMErrorMessage(error);
            logger.error(`GET /v1/summary/account/:account : ${msg.error.message}`);
            this.metrics.add("failure", 1);
            return res.status(200).json(this.makeResponseData(msg.code, undefined, msg.error));
        }
    }

    private async summary_shop(req: express.Request, res: express.Response) {
        logger.http(`GET /v1/summary/shop/:shopId ${req.ip}:${JSON.stringify(req.params)}`);

        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(200).json(ResponseMessage.getErrorMessage("2001", { validation: errors.array() }));
        }

        try {
            const shopId: string = String(req.params.shopId).trim();
            const info = await this.contractManager.sideShopContract.shopOf(shopId);
            const info2 = await this.contractManager.sideShopContract.refundableOf(shopId);

            const shopInfo = {
                shopId: info.shopId,
                name: info.name,
                currency: info.currency,
                status: info.status,
                account: info.account,
                delegator: info.delegator,
                providedAmount: info.providedAmount.toString(),
                usedAmount: info.usedAmount.toString(),
                refundedAmount: info.refundedAmount.toString(),
                refundableAmount: info2.refundableAmount.toString(),
                refundableToken: info2.refundableToken.toString(),
            };

            const account: string = shopInfo.account;

            const symbol = await this.contractManager.sideTokenContract.symbol();
            const name = await this.contractManager.sideTokenContract.name();
            const tokenAmount = BOACoin.make(1).value;
            const pointAmount = await this.contractManager.sideCurrencyRateContract.convertTokenToPoint(tokenAmount);
            const decimals = await this.contractManager.sideTokenContract.decimals();

            const pointBalance = await this.contractManager.sideLedgerContract.pointBalanceOf(account);
            const pointValue = BigNumber.from(pointBalance);

            const tokenBalanceInLedger = await this.contractManager.sideLedgerContract.tokenBalanceOf(account);
            const tokenValueInLedger = await this.contractManager.sideCurrencyRateContract.convertTokenToPoint(
                tokenBalanceInLedger
            );
            const tokenBalanceInMainChain = await this.contractManager.mainTokenContract.balanceOf(account);
            const tokenValueInMainChain = await this.contractManager.sideCurrencyRateContract.convertTokenToPoint(
                tokenBalanceInMainChain
            );
            const tokenBalanceInSideChain = await this.contractManager.sideTokenContract.balanceOf(account);
            const tokenValueInSideChain = await this.contractManager.sideCurrencyRateContract.convertTokenToPoint(
                tokenBalanceInSideChain
            );
            const defaultCurrencySymbol = await this.contractManager.sideCurrencyRateContract.defaultSymbol();

            this.metrics.add("success", 1);
            return res.status(200).json(
                this.makeResponseData(0, {
                    shopInfo,
                    tokenInfo: {
                        symbol,
                        name,
                        decimals,
                    },
                    exchangeRate: {
                        token: {
                            symbol,
                            value: tokenAmount.toString(),
                        },
                        currency: {
                            symbol: defaultCurrencySymbol,
                            value: pointAmount.toString(),
                        },
                    },
                    ledger: {
                        point: { balance: pointBalance.toString(), value: pointValue.toString() },
                        token: { balance: tokenBalanceInLedger.toString(), value: tokenValueInLedger.toString() },
                    },
                    mainChain: {
                        point: { balance: "0", value: "0" },
                        token: { balance: tokenBalanceInMainChain.toString(), value: tokenValueInMainChain.toString() },
                    },
                    sideChain: {
                        point: { balance: "0", value: "0" },
                        token: { balance: tokenBalanceInSideChain.toString(), value: tokenValueInSideChain.toString() },
                    },
                    protocolFees: {
                        transfer: (await this.contractManager.mainTokenContract.getProtocolFee()).toString(),
                        withdraw: (
                            await this.contractManager.mainInnerChainBridgeContract.getProtocolFee(
                                this.contractManager.mainTokenId
                            )
                        ).toString(),
                        deposit: (
                            await this.contractManager.sideLoyaltyBridgeContract.getProtocolFee(
                                this.contractManager.sideTokenId
                            )
                        ).toString(),
                    },
                })
            );
        } catch (error: any) {
            const msg = ResponseMessage.getEVMErrorMessage(error);
            logger.error(`GET /v1/summary/shop/:shopId : ${msg.error.message}`);
            this.metrics.add("failure", 1);
            return res.status(200).json(this.makeResponseData(msg.code, undefined, msg.error));
        }
    }

    private async v2_summary_account(req: express.Request, res: express.Response) {
        logger.http(`GET /v2/summary/account/:account ${req.ip}:${JSON.stringify(req.params)}`);

        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(200).json(ResponseMessage.getErrorMessage("2001", { validation: errors.array() }));
        }

        try {
            let account: string = String(req.params.account).trim();
            if (ContractUtils.isTemporaryAccount(account)) {
                const realAccount = await this.storage.getRealAccountOnTemporary(account);
                if (realAccount === undefined) {
                    return res.status(200).json(ResponseMessage.getErrorMessage("2004"));
                } else {
                    account = realAccount;
                }
            }

            const isProvider = await this.contractManager.sideLedgerContract.isProvider(account);
            const provisionAgent = await this.contractManager.sideLedgerContract.provisionAgentOf(account);
            const refundAgent = await this.contractManager.sideLedgerContract.refundAgentOf(account);
            const withdrawalAgent = await this.contractManager.sideLedgerContract.withdrawalAgentOf(account);

            const symbol = await this.contractManager.sideTokenContract.symbol();
            const name = await this.contractManager.sideTokenContract.name();
            const tokenAmount = BOACoin.make(1).value;
            const pointAmount = await this.contractManager.sideCurrencyRateContract.convertTokenToPoint(tokenAmount);
            const decimals = await this.contractManager.sideTokenContract.decimals();

            const pointBalance = await this.contractManager.sideLedgerContract.pointBalanceOf(account);
            const pointValue = BigNumber.from(pointBalance);

            const tokenBalanceInLedger = await this.contractManager.sideLedgerContract.tokenBalanceOf(account);
            const tokenValueInLedger = await this.contractManager.sideCurrencyRateContract.convertTokenToPoint(
                tokenBalanceInLedger
            );
            const tokenBalanceInMainChain = await this.contractManager.mainTokenContract.balanceOf(account);
            const tokenValueInMainChain = await this.contractManager.sideCurrencyRateContract.convertTokenToPoint(
                tokenBalanceInMainChain
            );
            const tokenBalanceInSideChain = await this.contractManager.sideTokenContract.balanceOf(account);
            const tokenValueInSideChain = await this.contractManager.sideCurrencyRateContract.convertTokenToPoint(
                tokenBalanceInSideChain
            );

            const defaultCurrencySymbol = await this.contractManager.sideCurrencyRateContract.defaultSymbol();

            this.metrics.add("success", 1);
            return res.status(200).json(
                this.makeResponseData(0, {
                    account,
                    tokenInfo: {
                        symbol,
                        name,
                        decimals,
                    },
                    exchangeRate: {
                        token: {
                            symbol,
                            value: tokenAmount.toString(),
                        },
                        currency: {
                            symbol: defaultCurrencySymbol,
                            value: pointAmount.toString(),
                        },
                    },
                    provider: {
                        enable: isProvider,
                        assistant: provisionAgent,
                    },
                    agent: {
                        provision: provisionAgent,
                        refund: refundAgent,
                        withdrawal: withdrawalAgent,
                    },
                    ledger: {
                        point: { balance: pointBalance.toString(), value: pointValue.toString() },
                        token: { balance: tokenBalanceInLedger.toString(), value: tokenValueInLedger.toString() },
                    },
                    mainChain: {
                        point: { balance: "0", value: "0" },
                        token: { balance: tokenBalanceInMainChain.toString(), value: tokenValueInMainChain.toString() },
                    },
                    sideChain: {
                        point: { balance: "0", value: "0" },
                        token: { balance: tokenBalanceInSideChain.toString(), value: tokenValueInSideChain.toString() },
                    },
                    protocolFees: {
                        transfer: (await this.contractManager.mainTokenContract.getProtocolFee()).toString(),
                        withdraw: (
                            await this.contractManager.mainInnerChainBridgeContract.getProtocolFee(
                                this.contractManager.mainTokenId
                            )
                        ).toString(),
                        deposit: (
                            await this.contractManager.sideLoyaltyBridgeContract.getProtocolFee(
                                this.contractManager.sideTokenId
                            )
                        ).toString(),
                    },
                })
            );
        } catch (error: any) {
            const msg = ResponseMessage.getEVMErrorMessage(error);
            logger.error(`GET /v2/summary/account/:account : ${msg.error.message}`);
            this.metrics.add("failure", 1);
            return res.status(200).json(this.makeResponseData(msg.code, undefined, msg.error));
        }
    }

    private async v2_summary_shop(req: express.Request, res: express.Response) {
        logger.http(`GET /v2/summary/shop/:shopId ${req.ip}:${JSON.stringify(req.params)}`);

        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(200).json(ResponseMessage.getErrorMessage("2001", { validation: errors.array() }));
        }

        try {
            const shopId: string = String(req.params.shopId).trim();
            const info = await this.contractManager.sideShopContract.shopOf(shopId);
            const info2 = await this.contractManager.sideShopContract.refundableOf(shopId);

            const shopInfo = {
                shopId: info.shopId,
                name: info.name,
                currency: info.currency,
                status: info.status,
                account: info.account,
                delegator: info.delegator,
                providedAmount: info.providedAmount.toString(),
                usedAmount: info.usedAmount.toString(),
                collectedAmount: info.collectedAmount.toString(),
                refundedAmount: info.refundedAmount.toString(),
                refundableAmount: info2.refundableAmount.toString(),
                refundableToken: info2.refundableToken.toString(),
            };

            const account: string = shopInfo.account;

            const symbol = await this.contractManager.sideTokenContract.symbol();
            const name = await this.contractManager.sideTokenContract.name();
            const tokenAmount = BOACoin.make(1).value;
            const pointAmount = await this.contractManager.sideCurrencyRateContract.convertTokenToPoint(tokenAmount);
            const decimals = await this.contractManager.sideTokenContract.decimals();

            const pointBalance = await this.contractManager.sideLedgerContract.pointBalanceOf(account);
            const pointValue = BigNumber.from(pointBalance);

            const tokenBalanceInLedger = await this.contractManager.sideLedgerContract.tokenBalanceOf(account);
            const tokenValueInLedger = await this.contractManager.sideCurrencyRateContract.convertTokenToPoint(
                tokenBalanceInLedger
            );
            const tokenBalanceInMainChain = await this.contractManager.mainTokenContract.balanceOf(account);
            const tokenValueInMainChain = await this.contractManager.sideCurrencyRateContract.convertTokenToPoint(
                tokenBalanceInMainChain
            );
            const tokenBalanceInSideChain = await this.contractManager.sideTokenContract.balanceOf(account);
            const tokenValueInSideChain = await this.contractManager.sideCurrencyRateContract.convertTokenToPoint(
                tokenBalanceInSideChain
            );
            const defaultCurrencySymbol = await this.contractManager.sideCurrencyRateContract.defaultSymbol();

            const provisionAgent = await this.contractManager.sideLedgerContract.provisionAgentOf(account);
            const refundAgent = await this.contractManager.sideLedgerContract.refundAgentOf(account);
            const withdrawalAgent = await this.contractManager.sideLedgerContract.withdrawalAgentOf(account);

            const settlementManager = await this.contractManager.sideShopContract.settlementManagerOf(shopId);

            this.metrics.add("success", 1);
            return res.status(200).json(
                this.makeResponseData(0, {
                    shopInfo,
                    tokenInfo: {
                        symbol,
                        name,
                        decimals,
                    },
                    exchangeRate: {
                        token: {
                            symbol,
                            value: tokenAmount.toString(),
                        },
                        currency: {
                            symbol: defaultCurrencySymbol,
                            value: pointAmount.toString(),
                        },
                    },
                    settlement: {
                        manager: settlementManager,
                    },
                    agent: {
                        provision: provisionAgent,
                        refund: refundAgent,
                        withdrawal: withdrawalAgent,
                    },
                    ledger: {
                        point: { balance: pointBalance.toString(), value: pointValue.toString() },
                        token: { balance: tokenBalanceInLedger.toString(), value: tokenValueInLedger.toString() },
                    },
                    mainChain: {
                        point: { balance: "0", value: "0" },
                        token: { balance: tokenBalanceInMainChain.toString(), value: tokenValueInMainChain.toString() },
                    },
                    sideChain: {
                        point: { balance: "0", value: "0" },
                        token: { balance: tokenBalanceInSideChain.toString(), value: tokenValueInSideChain.toString() },
                    },
                    protocolFees: {
                        transfer: (await this.contractManager.mainTokenContract.getProtocolFee()).toString(),
                        withdraw: (
                            await this.contractManager.mainInnerChainBridgeContract.getProtocolFee(
                                this.contractManager.mainTokenId
                            )
                        ).toString(),
                        deposit: (
                            await this.contractManager.sideLoyaltyBridgeContract.getProtocolFee(
                                this.contractManager.sideTokenId
                            )
                        ).toString(),
                    },
                })
            );
        } catch (error: any) {
            const msg = ResponseMessage.getEVMErrorMessage(error);
            logger.error(`GET /v2/summary/shop/:shopId : ${msg.error.message}`);
            this.metrics.add("failure", 1);
            return res.status(200).json(this.makeResponseData(msg.code, undefined, msg.error));
        }
    }

    /**
     * 외부체인의 체인 아이디
     * GET /v3/chain/outer/id
     * @private
     */
    private async v3_chain_outer_id(req: express.Request, res: express.Response) {
        logger.http(`GET /v3/chain/outer/id ${req.ip}:${JSON.stringify(req.params)}`);
        try {
            this.metrics.add("success", 1);
            return res.status(200).json(this.makeResponseData(0, { chainId: this.contractManager.outerChainId }));
        } catch (error: any) {
            const msg = ResponseMessage.getEVMErrorMessage(error);
            logger.error(`GET /v1/chain/outer/id : ${msg.error.message}`);
            this.metrics.add("failure", 1);
            return res.status(200).json(msg);
        }
    }
    /**
     * 메인체인의 체인 아이디
     * GET /v3/chain/main/id
     * @private
     */
    private async v3_chain_main_id(req: express.Request, res: express.Response) {
        logger.http(`GET /v3/chain/main/id ${req.ip}:${JSON.stringify(req.params)}`);
        try {
            this.metrics.add("success", 1);
            return res.status(200).json(this.makeResponseData(0, { chainId: this.contractManager.mainChainId }));
        } catch (error: any) {
            const msg = ResponseMessage.getEVMErrorMessage(error);
            logger.error(`GET /v3/chain/main/id : ${msg.error.message}`);
            this.metrics.add("failure", 1);
            return res.status(200).json(msg);
        }
    }

    /**
     * 사이드체인의 체인 아이디
     * GET /v3/chain/side/id
     * @private
     */
    private async v3_chain_side_id(req: express.Request, res: express.Response) {
        logger.http(`GET /v3/chain/side/id ${req.ip}:${JSON.stringify(req.params)}`);
        try {
            this.metrics.add("success", 1);
            return res.status(200).json(this.makeResponseData(0, { chainId: this.contractManager.sideChainId }));
        } catch (error: any) {
            const msg = ResponseMessage.getEVMErrorMessage(error);
            logger.error(`GET /v3/chain/side/id : ${msg.error.message}`);
            this.metrics.add("failure", 1);
            return res.status(200).json(msg);
        }
    }

    /**
     * 외부체인의 체인 정보
     * GET /v3/chain/outer/info
     * @private
     */
    private async v3_chain_outer_info(req: express.Request, res: express.Response) {
        logger.http(`GET /v3/chain/outer/info ${req.ip}:${JSON.stringify(req.params)}`);
        try {
            this.metrics.add("success", 1);
            return res.status(200).json(
                this.makeResponseData(0, {
                    url: this.contractManager.mainChainURL,
                    network: {
                        name: "outer-chain",
                        chainId: this.contractManager.outerChainId,
                        ensAddress: AddressZero,
                        chainTransferFee: "0",
                        loyaltyTransferFee: "0",
                        loyaltyBridgeFee: "0",
                        innerChainBridgeFee: "0",
                        outerChainBridgeFee: (
                            await this.contractManager.outerOuterChainBridgeContract.getProtocolFee(
                                this.contractManager.outerTokenId
                            )
                        ).toString(),
                    },
                    contract: {
                        token: this.contractManager.outerTokenContract.address,
                        loyaltyBridge: AddressZero,
                        innerChainBridge: AddressZero,
                        outerChainBridge: this.contractManager.outerOuterChainBridgeContract.address,
                    },
                })
            );
        } catch (error: any) {
            const msg = ResponseMessage.getEVMErrorMessage(error);
            logger.error(`GET /v3/chain/outer/info : ${msg.error.message}`);
            this.metrics.add("failure", 1);
            return res.status(200).json(msg);
        }
    }

    /**
     * 메인체인의 체인 정보
     * GET /v3/chain/main/info
     * @private
     */
    private async v3_chain_main_info(req: express.Request, res: express.Response) {
        logger.http(`GET /v3/chain/main/info ${req.ip}:${JSON.stringify(req.params)}`);
        try {
            this.metrics.add("success", 1);
            return res.status(200).json(
                this.makeResponseData(0, {
                    url: this.contractManager.mainChainURL,
                    network: {
                        name: "main-chain",
                        chainId: this.contractManager.mainChainId,
                        ensAddress: AddressZero,
                        chainTransferFee: (await this.contractManager.mainTokenContract.getProtocolFee()).toString(),
                        loyaltyTransferFee: BigNumber.from(0).toString(),
                        loyaltyBridgeFee: (
                            await this.contractManager.mainLoyaltyBridgeContract.getProtocolFee(
                                this.contractManager.mainTokenId
                            )
                        ).toString(),
                        innerChainBridgeFee: (
                            await this.contractManager.mainInnerChainBridgeContract.getProtocolFee(
                                this.contractManager.mainTokenId
                            )
                        ).toString(),
                        outerChainBridgeFee: (
                            await this.contractManager.mainOuterChainBridgeContract.getProtocolFee(
                                this.contractManager.mainTokenId
                            )
                        ).toString(),
                    },
                    contract: {
                        token: this.contractManager.mainTokenContract.address,
                        loyaltyBridge: this.contractManager.mainLoyaltyBridgeContract.address,
                        innerChainBridge: this.contractManager.mainInnerChainBridgeContract.address,
                        outerChainBridge: this.contractManager.mainOuterChainBridgeContract.address,
                    },
                })
            );
        } catch (error: any) {
            const msg = ResponseMessage.getEVMErrorMessage(error);
            logger.error(`GET /v3/chain/main/info : ${msg.error.message}`);
            this.metrics.add("failure", 1);
            return res.status(200).json(msg);
        }
    }

    /**
     * 사이드체인의 체인 정보
     * GET /v3/chain/side/info
     * @private
     */
    private async v3_chain_side_info(req: express.Request, res: express.Response) {
        logger.http(`GET /v3/chain/side/info ${req.ip}:${JSON.stringify(req.params)}`);
        try {
            this.metrics.add("success", 1);
            return res.status(200).json(
                this.makeResponseData(0, {
                    url: this.contractManager.sideChainURL,
                    network: {
                        name: "side-chain",
                        chainId: this.contractManager.sideChainId,
                        ensAddress: AddressZero,
                        chainTransferFee: (await this.contractManager.sideTokenContract.getProtocolFee()).toString(),
                        loyaltyTransferFee: (
                            await this.contractManager.sideLoyaltyTransferContract.getProtocolFee()
                        ).toString(),
                        loyaltyBridgeFee: (
                            await this.contractManager.sideLoyaltyBridgeContract.getProtocolFee(
                                this.contractManager.sideTokenId
                            )
                        ).toString(),
                        innerChainBridgeFee: (
                            await this.contractManager.sideInnerChainBridgeContract.getProtocolFee(
                                this.contractManager.sideTokenId
                            )
                        ).toString(),
                        outerChainBridgeFee: "0",
                    },
                    contract: {
                        token: this.contractManager.sideTokenContract.address,
                        phoneLink: this.contractManager.sidePhoneLinkerContract.address,
                        currencyRate: this.contractManager.sideCurrencyRateContract.address,
                        loyaltyProvider: this.contractManager.sideLoyaltyProviderContract.address,
                        loyaltyConsumer: this.contractManager.sideLoyaltyConsumerContract.address,
                        loyaltyTransfer: this.contractManager.sideLoyaltyTransferContract.address,
                        loyaltyExchanger: this.contractManager.sideLoyaltyExchangerContract.address,
                        loyaltyBridge: this.contractManager.sideLoyaltyBridgeContract.address,
                        shop: this.contractManager.sideShopContract.address,
                        ledger: this.contractManager.sideLedgerContract.address,
                        innerChainBridge: this.contractManager.sideInnerChainBridgeContract.address,
                        outerChainBridge: AddressZero,
                    },
                })
            );
        } catch (error: any) {
            const msg = ResponseMessage.getEVMErrorMessage(error);
            logger.error(`GET /v3/chain/side/info : ${msg.error.message}`);
            this.metrics.add("failure", 1);
            return res.status(200).json(msg);
        }
    }

    /**
     * 사이드체인의 체인 정보
     * GET /v1/system/info
     * @private
     */
    private async v3_system_info(req: express.Request, res: express.Response) {
        logger.http(`GET /v3/system/info ${req.ip}:${JSON.stringify(req.query)}`);
        try {
            const tokenSymbol = await this.contractManager.sideTokenContract.symbol();
            const precision = tokenSymbol === "ACC" ? 2 : 0;
            const equivalentCurrency = tokenSymbol === "ACC" ? "PHP" : "KRW";
            const language = tokenSymbol === "ACC" ? "en" : "ko";
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
                    support: {
                        outerChainBridge: this.config.relay.supportOuterChainBridge,
                        innerChainBridge: this.config.relay.supportChainBridge,
                        loyaltyBridge: this.config.relay.supportLoyaltyBridge,
                        exchange: this.config.relay.supportExchange,
                    },
                })
            );
        } catch (error: any) {
            const msg = ResponseMessage.getEVMErrorMessage(error);
            logger.error(`GET /v3/system/info : ${msg.error.message}`);
            this.metrics.add("failure", 1);
            return res.status(200).json(msg);
        }
    }

    private async v3_summary_account(req: express.Request, res: express.Response) {
        logger.http(`GET /v3/summary/account/:account ${req.ip}:${JSON.stringify(req.params)}`);

        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(200).json(ResponseMessage.getErrorMessage("2001", { validation: errors.array() }));
        }

        try {
            let account: string = String(req.params.account).trim();
            if (ContractUtils.isTemporaryAccount(account)) {
                const realAccount = await this.storage.getRealAccountOnTemporary(account);
                if (realAccount === undefined) {
                    return res.status(200).json(ResponseMessage.getErrorMessage("2004"));
                } else {
                    account = realAccount;
                }
            }

            const isProvider = await this.contractManager.sideLedgerContract.isProvider(account);
            const provisionAgent = await this.contractManager.sideLedgerContract.provisionAgentOf(account);
            const refundAgent = await this.contractManager.sideLedgerContract.refundAgentOf(account);
            const withdrawalAgent = await this.contractManager.sideLedgerContract.withdrawalAgentOf(account);

            const symbol = await this.contractManager.sideTokenContract.symbol();
            const name = await this.contractManager.sideTokenContract.name();
            const tokenAmount = BOACoin.make(1).value;
            const pointAmount = await this.contractManager.sideCurrencyRateContract.convertTokenToPoint(tokenAmount);
            const decimals = await this.contractManager.sideTokenContract.decimals();

            const pointBalance = await this.contractManager.sideLedgerContract.pointBalanceOf(account);
            const pointValue = BigNumber.from(pointBalance);

            const tokenBalanceInLedger = await this.contractManager.sideLedgerContract.tokenBalanceOf(account);
            const tokenValueInLedger = await this.contractManager.sideCurrencyRateContract.convertTokenToPoint(
                tokenBalanceInLedger
            );
            const nativeBalanceInMainChain = await this.contractManager.mainChainProvider.getBalance(account);
            const tokenBalanceInMainChain = await this.contractManager.mainTokenContract.balanceOf(account);
            const tokenValueInMainChain = await this.contractManager.sideCurrencyRateContract.convertTokenToPoint(
                tokenBalanceInMainChain
            );
            const nativeBalanceInSideChain = await this.contractManager.sideChainProvider.getBalance(account);
            const tokenBalanceInSideChain = await this.contractManager.sideTokenContract.balanceOf(account);
            const tokenValueInSideChain = await this.contractManager.sideCurrencyRateContract.convertTokenToPoint(
                tokenBalanceInSideChain
            );
            const nativeBalanceInOuterChain = await this.contractManager.outerChainProvider.getBalance(account);
            const tokenBalanceInOuterChain = await this.contractManager.outerTokenContract.balanceOf(account);
            const tokenValueInOuterChain = await this.contractManager.sideCurrencyRateContract.convertTokenToPoint(
                tokenBalanceInOuterChain
            );
            const defaultCurrencySymbol = await this.contractManager.sideCurrencyRateContract.defaultSymbol();

            this.metrics.add("success", 1);
            return res.status(200).json(
                this.makeResponseData(0, {
                    account,
                    tokenInfo: {
                        symbol,
                        name,
                        decimals,
                    },
                    exchangeRate: {
                        token: {
                            symbol,
                            value: tokenAmount.toString(),
                        },
                        currency: {
                            symbol: defaultCurrencySymbol,
                            value: pointAmount.toString(),
                        },
                    },
                    provider: {
                        enable: isProvider,
                        assistant: provisionAgent,
                    },
                    agent: {
                        provision: provisionAgent,
                        refund: refundAgent,
                        withdrawal: withdrawalAgent,
                    },
                    ledger: {
                        point: { balance: pointBalance.toString(), value: pointValue.toString() },
                        token: { balance: tokenBalanceInLedger.toString(), value: tokenValueInLedger.toString() },
                    },
                    outerChain: {
                        point: { balance: "0", value: "0" },
                        token: {
                            balance: tokenBalanceInOuterChain.toString(),
                            value: tokenValueInOuterChain.toString(),
                        },
                        native: { balance: nativeBalanceInOuterChain.toString(), symbol: "BNB" },
                    },
                    mainChain: {
                        point: { balance: "0", value: "0" },
                        token: { balance: tokenBalanceInMainChain.toString(), value: tokenValueInMainChain.toString() },
                        native: { balance: nativeBalanceInMainChain.toString(), symbol: "BOA" },
                    },
                    sideChain: {
                        point: { balance: "0", value: "0" },
                        token: { balance: tokenBalanceInSideChain.toString(), value: tokenValueInSideChain.toString() },
                        native: { balance: nativeBalanceInSideChain.toString(), symbol: "BOA" },
                    },
                    protocolFees: {
                        transferInMainNet: (await this.contractManager.mainTokenContract.getProtocolFee()).toString(),
                        withdrawToMainNet: (
                            await this.contractManager.mainInnerChainBridgeContract.getProtocolFee(
                                this.contractManager.mainTokenId
                            )
                        ).toString(),
                        depositFromMainNet: (
                            await this.contractManager.sideLoyaltyBridgeContract.getProtocolFee(
                                this.contractManager.sideTokenId
                            )
                        ).toString(),
                        withdrawToOuterNet: (
                            await this.contractManager.mainOuterChainBridgeContract.getProtocolFee(
                                this.contractManager.mainTokenId
                            )
                        ).toString(),
                        depositFromOuterNet: (
                            await this.contractManager.outerOuterChainBridgeContract.getProtocolFee(
                                this.contractManager.outerTokenId
                            )
                        ).toString(),
                    },
                })
            );
        } catch (error: any) {
            const msg = ResponseMessage.getEVMErrorMessage(error);
            logger.error(`GET /v3/summary/account/:account : ${msg.error.message}`);
            this.metrics.add("failure", 1);
            return res.status(200).json(this.makeResponseData(msg.code, undefined, msg.error));
        }
    }

    private async v3_summary_shop(req: express.Request, res: express.Response) {
        logger.http(`GET /v3/summary/shop/:shopId ${req.ip}:${JSON.stringify(req.params)}`);

        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(200).json(ResponseMessage.getErrorMessage("2001", { validation: errors.array() }));
        }

        try {
            const shopId: string = String(req.params.shopId).trim();
            const info = await this.contractManager.sideShopContract.shopOf(shopId);
            const info2 = await this.contractManager.sideShopContract.refundableOf(shopId);

            const shopInfo = {
                shopId: info.shopId,
                name: info.name,
                currency: info.currency,
                status: info.status,
                account: info.account,
                delegator: info.delegator,
                providedAmount: info.providedAmount.toString(),
                usedAmount: info.usedAmount.toString(),
                collectedAmount: info.collectedAmount.toString(),
                refundedAmount: info.refundedAmount.toString(),
                refundableAmount: info2.refundableAmount.toString(),
                refundableToken: info2.refundableToken.toString(),
            };

            const account: string = shopInfo.account;

            const symbol = await this.contractManager.sideTokenContract.symbol();
            const name = await this.contractManager.sideTokenContract.name();
            const tokenAmount = BOACoin.make(1).value;
            const pointAmount = await this.contractManager.sideCurrencyRateContract.convertTokenToPoint(tokenAmount);
            const decimals = await this.contractManager.sideTokenContract.decimals();

            const pointBalance = await this.contractManager.sideLedgerContract.pointBalanceOf(account);
            const pointValue = BigNumber.from(pointBalance);

            const tokenBalanceInLedger = await this.contractManager.sideLedgerContract.tokenBalanceOf(account);
            const tokenValueInLedger = await this.contractManager.sideCurrencyRateContract.convertTokenToPoint(
                tokenBalanceInLedger
            );
            const nativeBalanceInMainChain = await this.contractManager.mainChainProvider.getBalance(account);
            const tokenBalanceInMainChain = await this.contractManager.mainTokenContract.balanceOf(account);
            const tokenValueInMainChain = await this.contractManager.sideCurrencyRateContract.convertTokenToPoint(
                tokenBalanceInMainChain
            );
            const nativeBalanceInSideChain = await this.contractManager.sideChainProvider.getBalance(account);
            const tokenBalanceInSideChain = await this.contractManager.sideTokenContract.balanceOf(account);
            const tokenValueInSideChain = await this.contractManager.sideCurrencyRateContract.convertTokenToPoint(
                tokenBalanceInSideChain
            );
            const nativeBalanceInOuterChain = await this.contractManager.outerChainProvider.getBalance(account);
            const tokenBalanceInOuterChain = await this.contractManager.outerTokenContract.balanceOf(account);
            const tokenValueInOuterChain = await this.contractManager.sideCurrencyRateContract.convertTokenToPoint(
                tokenBalanceInOuterChain
            );
            const defaultCurrencySymbol = await this.contractManager.sideCurrencyRateContract.defaultSymbol();

            const provisionAgent = await this.contractManager.sideLedgerContract.provisionAgentOf(account);
            const refundAgent = await this.contractManager.sideLedgerContract.refundAgentOf(account);
            const withdrawalAgent = await this.contractManager.sideLedgerContract.withdrawalAgentOf(account);

            const settlementManager = await this.contractManager.sideShopContract.settlementManagerOf(shopId);

            this.metrics.add("success", 1);
            return res.status(200).json(
                this.makeResponseData(0, {
                    shopInfo,
                    tokenInfo: {
                        symbol,
                        name,
                        decimals,
                    },
                    exchangeRate: {
                        token: {
                            symbol,
                            value: tokenAmount.toString(),
                        },
                        currency: {
                            symbol: defaultCurrencySymbol,
                            value: pointAmount.toString(),
                        },
                    },
                    settlement: {
                        manager: settlementManager,
                    },
                    agent: {
                        provision: provisionAgent,
                        refund: refundAgent,
                        withdrawal: withdrawalAgent,
                    },
                    ledger: {
                        point: { balance: pointBalance.toString(), value: pointValue.toString() },
                        token: { balance: tokenBalanceInLedger.toString(), value: tokenValueInLedger.toString() },
                    },
                    outerChain: {
                        point: { balance: "0", value: "0" },
                        token: {
                            balance: tokenBalanceInOuterChain.toString(),
                            value: tokenValueInOuterChain.toString(),
                        },
                        native: { balance: nativeBalanceInOuterChain.toString(), symbol: "BNB" },
                    },
                    mainChain: {
                        point: { balance: "0", value: "0" },
                        token: { balance: tokenBalanceInMainChain.toString(), value: tokenValueInMainChain.toString() },
                        native: { balance: nativeBalanceInMainChain.toString(), symbol: "BOA" },
                    },
                    sideChain: {
                        point: { balance: "0", value: "0" },
                        token: { balance: tokenBalanceInSideChain.toString(), value: tokenValueInSideChain.toString() },
                        native: { balance: nativeBalanceInSideChain.toString(), symbol: "BOA" },
                    },
                    protocolFees: {
                        transferInMainNet: (await this.contractManager.mainTokenContract.getProtocolFee()).toString(),
                        withdrawToMainNet: (
                            await this.contractManager.mainInnerChainBridgeContract.getProtocolFee(
                                this.contractManager.mainTokenId
                            )
                        ).toString(),
                        depositFromMainNet: (
                            await this.contractManager.sideLoyaltyBridgeContract.getProtocolFee(
                                this.contractManager.sideTokenId
                            )
                        ).toString(),
                        withdrawToOuterNet: (
                            await this.contractManager.mainOuterChainBridgeContract.getProtocolFee(
                                this.contractManager.mainTokenId
                            )
                        ).toString(),
                        depositFromOuterNet: (
                            await this.contractManager.outerOuterChainBridgeContract.getProtocolFee(
                                this.contractManager.outerTokenId
                            )
                        ).toString(),
                    },
                })
            );
        } catch (error: any) {
            const msg = ResponseMessage.getEVMErrorMessage(error);
            logger.error(`GET /v3/summary/shop/:shopId : ${msg.error.message}`);
            this.metrics.add("failure", 1);
            return res.status(200).json(this.makeResponseData(msg.code, undefined, msg.error));
        }
    }
}
