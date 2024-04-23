import { Config } from "../common/Config";
import { logger } from "../common/Logger";
import { ContractManager } from "../contract/ContractManager";
import { ISignerItem, RelaySigners } from "../contract/Signers";
import { Metrics } from "../metrics/Metrics";
import { WebService } from "../service/WebService";
import { GraphStorage } from "../storage/GraphStorage";
import { RelayStorage } from "../storage/RelayStorage";
import { ResponseMessage } from "../utils/Errors";
import { ContractUtils } from "../utils/ContractUtils";

import { body, param, query, validationResult } from "express-validator";

import { AddressZero } from "@ethersproject/constants";

import express from "express";

import { BigNumber, ethers } from "ethers";
import { Validation } from "../validation";
import { toChecksumAddress } from "ethereumjs-util";
import { PhoneNumberFormat, PhoneNumberUtil } from "google-libphonenumber";

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
                query("pageType").exists().trim().isNumeric(),
            ],
            this.ledger_history_account.bind(this)
        );
        this.app.get(
            "/v1/ledger/history/phone/:phone",
            [
                param("phone").exists(),
                query("pageNumber").exists().trim().isNumeric(),
                query("pageSize").exists().trim().isNumeric(),
            ],
            this.ledger_history_phone.bind(this)
        );
    }

    private async token_main_history(req: express.Request, res: express.Response) {
        logger.http(`GET /v1/token/main/history ${req.ip}:${JSON.stringify(req.params)}`);
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
        logger.http(`GET /v1/token/side/history ${req.ip}:${JSON.stringify(req.params)}`);

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
        logger.http(`GET /v1/ledger/history/account ${req.ip}:${JSON.stringify(req.params)}`);

        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(200).json(ResponseMessage.getErrorMessage("2001", { validation: errors.array() }));
        }

        const account: string = String(req.params.account).trim();

        let pageSize = Number(req.query.pageSize);
        if (pageSize > 50) pageSize = 50;
        let pageNumber = Number(req.query.pageNumber);
        if (pageNumber < 1) pageNumber = 1;
        let pageType = Number(req.query.pageType);

        try {
            const histories = await this.graph_sidechain.getAccountLedgerHistory(
                account,
                pageType,
                pageNumber,
                pageSize
            );
            const pageInfo = await this.graph_sidechain.getAccountLedgerHistoryPageInfo(account, pageType, pageSize);

            this.metrics.add("success", 1);
            return res.status(200).json(
                this.makeResponseData(0, {
                    pageInfo,
                    items: histories.map((m) => {
                        return {
                            account: m.account,
                            pageType: m.pageType,
                            action: m.action,
                            cancel: m.cancel,
                            loyaltyType: m.loyaltyType,
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
        logger.http(`GET /v1/ledger/history/phone ${req.ip}:${JSON.stringify(req.params)}`);

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

        try {
            const account: string = await this.contractManager.sidePhoneLinkerContract.toAddress(phoneHash);
            if (account !== AddressZero) {
                const histories = await this.graph_sidechain.getAccountLedgerHistory(account, 1, pageNumber, pageSize);
                const pageInfo = await this.graph_sidechain.getAccountLedgerHistoryPageInfo(account, 1, pageSize);

                this.metrics.add("success", 1);
                return res.status(200).json(
                    this.makeResponseData(0, {
                        pageInfo,
                        type: "account",
                        items: histories.map((m) => {
                            return {
                                account: m.account,
                                pageType: m.pageType,
                                action: m.action,
                                cancel: m.cancel,
                                loyaltyType: m.loyaltyType,
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
                const histories = await this.graph_sidechain.getPhoneLedgerHistory(phoneHash, pageNumber, pageSize);
                const pageInfo = await this.graph_sidechain.getPhoneLedgerHistoryPageInfo(phoneHash, pageSize);

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
}
