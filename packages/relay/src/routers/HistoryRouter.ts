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

// tslint:disable-next-line:no-implicit-dependencies
import { AddressZero } from "@ethersproject/constants";
import { ethers } from "ethers";
import express from "express";
import { param, query, validationResult } from "express-validator";
import { PhoneNumberFormat, PhoneNumberUtil } from "google-libphonenumber";
import { ActionInLedger, ActionInShop } from "../types";

export class HistoryRouter {
    private web_service: WebService;
    private readonly config: Config;
    private readonly contractManager: ContractManager;
    private readonly metrics: Metrics;
    private readonly relaySigners: RelaySigners;
    private storage: RelayStorage;
    private graph_sidechain: GraphStorage;
    private graph_mainchain: GraphStorage;
    private phoneUtil: PhoneNumberUtil;

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
        this.phoneUtil = PhoneNumberUtil.getInstance();
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
            "/v1/token/main/history/:account",
            [
                param("account").exists().trim().isEthereumAddress(),
                query("pageNumber").exists().trim().isNumeric(),
                query("pageSize").exists().trim().isNumeric(),
            ],
            this.token_main_history.bind(this)
        );
        this.app.get(
            "/v1/token/side/history/:account",
            [
                param("account").exists().trim().isEthereumAddress(),
                query("pageNumber").exists().trim().isNumeric(),
                query("pageSize").exists().trim().isNumeric(),
            ],
            this.token_side_history.bind(this)
        );
        this.app.get(
            "/v1/ledger/history/account/:account",
            [
                param("account").exists().trim().isEthereumAddress(),
                query("pageNumber").exists().trim().isNumeric(),
                query("pageSize").exists().trim().isNumeric(),
                query("actions")
                    .exists()
                    .trim()
                    .matches(/^[0-9,]*$/),
            ],
            this.ledger_history_account.bind(this)
        );
        this.app.get(
            "/v1/ledger/history/phone/:phone",
            [
                param("phone").exists(),
                query("pageNumber").exists().trim().isNumeric(),
                query("pageSize").exists().trim().isNumeric(),
                query("actions")
                    .exists()
                    .trim()
                    .matches(/^[0-9,]*$/),
            ],
            this.ledger_history_phone.bind(this)
        );
        this.app.get(
            "/v1/shop/history/:shopId",
            [
                param("shopId")
                    .exists()
                    .matches(/^(0x)[0-9a-f]{64}$/i),
                query("pageNumber").exists().trim().isNumeric(),
                query("pageSize").exists().trim().isNumeric(),
                query("actions")
                    .exists()
                    .trim()
                    .matches(/^[0-9,]*$/),
            ],
            this.shop_history.bind(this)
        );
    }

    private async token_main_history(req: express.Request, res: express.Response) {
        logger.http(`GET /v1/token/main/history ${req.ip}:${JSON.stringify(req.params)}:${JSON.stringify(req.query)}`);
        const account: string = String(req.params.account).trim();

        let pageSize = Number(req.query.pageSize);
        if (pageSize > 50) pageSize = 50;
        let pageNumber = Number(req.query.pageNumber);
        if (pageNumber < 1) pageNumber = 1;

        try {
            const histories = await this.graph_mainchain.getTokenTransferHistory(account, pageNumber, pageSize);
            const pageInfo = await this.graph_mainchain.getTokenTransferPageInfo(account, pageSize);

            this.metrics.add("success", 1);
            return res.status(200).json(
                this.makeResponseData(0, {
                    pageInfo,
                    items: histories.map((m) => {
                        return {
                            from: m.from,
                            to: m.to,
                            value: m.value.toString(),
                            blockTimestamp: m.blockTimestamp.toString(),
                        };
                    }),
                })
            );
        } catch (error: any) {
            const msg = ResponseMessage.getEVMErrorMessage(error);
            logger.error(`GET /v1/token/main/history : ${msg.error.message}`);
            this.metrics.add("failure", 1);
            return res.status(200).json(this.makeResponseData(msg.code, undefined, msg.error));
        }
    }

    private async token_side_history(req: express.Request, res: express.Response) {
        logger.http(`GET /v1/token/side/history ${req.ip}:${JSON.stringify(req.params)}:${JSON.stringify(req.query)}`);

        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(200).json(ResponseMessage.getErrorMessage("2001", { validation: errors.array() }));
        }

        const account: string = String(req.params.account).trim();

        let pageSize = Number(req.query.pageSize);
        if (pageSize > 50) pageSize = 50;
        let pageNumber = Number(req.query.pageNumber);
        if (pageNumber < 1) pageNumber = 1;

        try {
            const histories = await this.graph_sidechain.getTokenTransferHistory(account, pageNumber, pageSize);
            const pageInfo = await this.graph_sidechain.getTokenTransferPageInfo(account, pageSize);

            this.metrics.add("success", 1);
            return res.status(200).json(
                this.makeResponseData(0, {
                    pageInfo,
                    items: histories.map((m) => {
                        return {
                            from: m.from,
                            to: m.to,
                            value: m.value.toString(),
                            blockTimestamp: m.blockTimestamp.toString(),
                        };
                    }),
                })
            );
        } catch (error: any) {
            const msg = ResponseMessage.getEVMErrorMessage(error);
            logger.error(`GET /v1/token/side/history : ${msg.error.message}`);
            this.metrics.add("failure", 1);
            return res.status(200).json(this.makeResponseData(msg.code, undefined, msg.error));
        }
    }

    private async ledger_history_account(req: express.Request, res: express.Response) {
        logger.http(
            `GET /v1/ledger/history/account ${req.ip}:${JSON.stringify(req.params)}:${JSON.stringify(req.query)}`
        );

        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(200).json(ResponseMessage.getErrorMessage("2001", { validation: errors.array() }));
        }

        const account: string = String(req.params.account).trim();

        let pageSize = Number(req.query.pageSize);
        if (pageSize > 50) pageSize = 50;
        let pageNumber = Number(req.query.pageNumber);
        if (pageNumber < 1) pageNumber = 1;
        const actions = String(req.query.actions)
            .trim()
            .split(",")
            .filter((m) => m.trim() !== "")
            .map((m) => Number(m));
        if (actions.length === 0) actions.push(...[ActionInLedger.SAVED, ActionInLedger.USED, ActionInLedger.BURNED]);

        try {
            const histories = await this.graph_sidechain.getHistoryOfAccountLedger(
                account,
                actions,
                pageNumber,
                pageSize
            );
            const pageInfo = await this.graph_sidechain.getHistoryPageInfoOfAccountLedger(account, actions, pageSize);

            this.metrics.add("success", 1);
            return res.status(200).json(
                this.makeResponseData(0, {
                    pageInfo,
                    items: histories.map((m) => {
                        return {
                            account: m.account,
                            action: m.action,
                            cancel: m.cancel,
                            amountPoint: m.amountPoint.toString(),
                            amountToken: m.amountToken.toString(),
                            amountValue: m.amountValue.toString(),
                            feePoint: m.feePoint.toString(),
                            feeToken: m.feeToken.toString(),
                            feeValue: m.feeValue.toString(),
                            balancePoint: m.balancePoint.toString(),
                            balanceToken: m.balanceToken.toString(),
                            purchaseId: m.purchaseId,
                            paymentId: m.paymentId,
                            shopId: m.shopId,
                            blockNumber: m.blockNumber.toString(),
                            blockTimestamp: m.blockTimestamp.toString(),
                            transactionHash: m.transactionHash,
                        };
                    }),
                })
            );
        } catch (error: any) {
            const msg = ResponseMessage.getEVMErrorMessage(error);
            logger.error(`GET /v1/ledger/history/account : ${msg.error.message}`);
            this.metrics.add("failure", 1);
            return res.status(200).json(this.makeResponseData(msg.code, undefined, msg.error));
        }
    }

    private async ledger_history_phone(req: express.Request, res: express.Response) {
        logger.http(
            `GET /v1/ledger/history/phone ${req.ip}:${JSON.stringify(req.params)}:${JSON.stringify(req.query)}`
        );

        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(200).json(ResponseMessage.getErrorMessage("2001", { validation: errors.array() }));
        }
        let phone: string = String(req.params.phone).trim();
        try {
            const number = this.phoneUtil.parseAndKeepRawInput(phone, "ZZ");
            if (!this.phoneUtil.isValidNumber(number)) {
                return res.status(200).json(ResponseMessage.getErrorMessage("2007"));
            } else {
                phone = this.phoneUtil.format(number, PhoneNumberFormat.INTERNATIONAL);
            }
        } catch (error) {
            return res.status(200).json(ResponseMessage.getErrorMessage("2007"));
        }
        const phoneHash: string = ContractUtils.getPhoneHash(phone);

        let pageSize = Number(req.query.pageSize);
        if (pageSize > 50) pageSize = 50;
        let pageNumber = Number(req.query.pageNumber);
        if (pageNumber < 1) pageNumber = 1;
        const actions = String(req.query.actions)
            .trim()
            .split(",")
            .filter((m) => m.trim() !== "")
            .map((m) => Number(m));
        if (actions.length === 0) actions.push(...[ActionInLedger.SAVED, ActionInLedger.USED, ActionInLedger.BURNED]);

        try {
            const account: string = await this.contractManager.sidePhoneLinkerContract.toAddress(phoneHash);
            if (account !== AddressZero) {
                const histories = await this.graph_sidechain.getHistoryOfAccountLedger(
                    account,
                    actions,
                    pageNumber,
                    pageSize
                );
                const pageInfo = await this.graph_sidechain.getHistoryPageInfoOfAccountLedger(
                    account,
                    actions,
                    pageSize
                );

                this.metrics.add("success", 1);
                return res.status(200).json(
                    this.makeResponseData(0, {
                        pageInfo,
                        type: "account",
                        items: histories.map((m) => {
                            return {
                                account: m.account,
                                action: m.action,
                                cancel: m.cancel,
                                amountPoint: m.amountPoint.toString(),
                                amountToken: m.amountToken.toString(),
                                amountValue: m.amountValue.toString(),
                                feePoint: m.feePoint.toString(),
                                feeToken: m.feeToken.toString(),
                                feeValue: m.feeValue.toString(),
                                balancePoint: m.balancePoint.toString(),
                                balanceToken: m.balanceToken.toString(),
                                purchaseId: m.purchaseId,
                                paymentId: m.paymentId,
                                shopId: m.shopId,
                                blockNumber: m.blockNumber.toString(),
                                blockTimestamp: m.blockTimestamp.toString(),
                                transactionHash: m.transactionHash,
                            };
                        }),
                    })
                );
            } else {
                const histories = await this.graph_sidechain.getHistoryOfPhoneLedger(phoneHash, pageNumber, pageSize);
                const pageInfo = await this.graph_sidechain.getHistoryPageInfoOfPhoneLedger(phoneHash, pageSize);

                this.metrics.add("success", 1);
                return res.status(200).json(
                    this.makeResponseData(0, {
                        pageInfo,
                        type: "phone",
                        items: histories.map((m) => {
                            return {
                                phone: m.phone,
                                action: m.action,
                                amount: m.amount.toString(),
                                balance: m.balance.toString(),
                                purchaseId: m.purchaseId,
                                shopId: m.shopId,
                                blockNumber: m.blockNumber.toString(),
                                blockTimestamp: m.blockTimestamp.toString(),
                                transactionHash: m.transactionHash,
                            };
                        }),
                    })
                );
            }
        } catch (error: any) {
            const msg = ResponseMessage.getEVMErrorMessage(error);
            logger.error(`GET /v1/ledger/history/phone : ${msg.error.message}`);
            this.metrics.add("failure", 1);
            return res.status(200).json(this.makeResponseData(msg.code, undefined, msg.error));
        }
    }

    private async shop_history(req: express.Request, res: express.Response) {
        logger.http(`GET /v1/shop/history ${req.ip}:${JSON.stringify(req.params)}:${JSON.stringify(req.query)}`);

        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(200).json(ResponseMessage.getErrorMessage("2001", { validation: errors.array() }));
        }

        const shopId: string = String(req.params.shopId).trim();

        let pageSize = Number(req.query.pageSize);
        if (pageSize > 50) pageSize = 50;
        let pageNumber = Number(req.query.pageNumber);
        if (pageNumber < 1) pageNumber = 1;
        const actions = String(req.query.actions)
            .trim()
            .split(",")
            .filter((m) => m.trim() !== "")
            .map((m) => Number(m));
        if (actions.length === 0) actions.push(...[ActionInShop.PROVIDED, ActionInShop.USED, ActionInShop.REFUNDED]);

        try {
            const histories = await this.graph_sidechain.getHistoryOfShop(shopId, actions, pageNumber, pageSize);
            const pageInfo = await this.graph_sidechain.getHistoryPageInfoOfShop(shopId, actions, pageSize);

            this.metrics.add("success", 1);
            return res.status(200).json(
                this.makeResponseData(0, {
                    pageInfo,
                    items: histories.map((m) => {
                        return {
                            shopId: m.shopId,
                            currency: m.currency,
                            action: m.action,
                            cancel: m.cancel,
                            increase: m.increase.toString(),
                            providedAmount: m.providedAmount.toString(),
                            usedAmount: m.usedAmount.toString(),
                            refundedAmount: m.refundedAmount.toString(),
                            purchaseId: m.purchaseId,
                            paymentId: m.paymentId,
                            blockNumber: m.blockNumber.toString(),
                            blockTimestamp: m.blockTimestamp.toString(),
                            transactionHash: m.transactionHash,
                        };
                    }),
                })
            );
        } catch (error: any) {
            const msg = ResponseMessage.getEVMErrorMessage(error);
            logger.error(`GET /v1/shop/history : ${msg.error.message}`);
            this.metrics.add("failure", 1);
            return res.status(200).json(this.makeResponseData(msg.code, undefined, msg.error));
        }
    }
}
