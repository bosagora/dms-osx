import { LoyaltyConsumer } from "../../typechain-types";
import { Amount } from "../common/Amount";
import { Config } from "../common/Config";
import { logger } from "../common/Logger";
import { ContractManager } from "../contract/ContractManager";
import { ISignerItem, RelaySigners } from "../contract/Signers";
import { INotificationSender } from "../delegator/NotificationSender";
import { Metrics } from "../metrics/Metrics";
import { WebService } from "../service/WebService";
import { GraphStorage } from "../storage/GraphStorage";
import { RelayStorage } from "../storage/RelayStorage";
import {
    ContractLoyaltyPaymentEvent,
    ContractLoyaltyPaymentStatus,
    LoyaltyPaymentTaskData,
    LoyaltyPaymentTaskStatus,
    MobileType,
    PaymentResultData,
    TaskResultCode,
    TaskResultType,
} from "../types";
import { ContractUtils } from "../utils/ContractUtils";
import { ResponseMessage } from "../utils/Errors";
import { HTTPClient } from "../utils/Utils";
import { Validation } from "../validation";

// tslint:disable-next-line:no-implicit-dependencies
import { AddressZero } from "@ethersproject/constants";
import { BigNumber, ContractTransaction, ethers } from "ethers";
import express from "express";
import { body, query, validationResult } from "express-validator";

export class PaymentRouter {
    private web_service: WebService;
    private readonly config: Config;
    private readonly contractManager: ContractManager;
    private readonly metrics: Metrics;
    private readonly relaySigners: RelaySigners;
    private storage: RelayStorage;
    private graph_sidechain: GraphStorage;
    private graph_mainchain: GraphStorage;
    private readonly _sender: INotificationSender;

    constructor(
        service: WebService,
        config: Config,
        contractManager: ContractManager,
        metrics: Metrics,
        storage: RelayStorage,
        graph_sidechain: GraphStorage,
        graph_mainchain: GraphStorage,
        relaySigners: RelaySigners,
        sender: INotificationSender
    ) {
        this.web_service = service;
        this.config = config;
        this.contractManager = contractManager;
        this.metrics = metrics;

        this.storage = storage;
        this.graph_sidechain = graph_sidechain;
        this.graph_mainchain = graph_mainchain;
        this.relaySigners = relaySigners;
        this._sender = sender;
    }

    private get app(): express.Application {
        return this.web_service.app;
    }

    public registerRoutes() {
        this.app.post(
            "/v1/payment/account/temporary",
            [
                body("account").exists().trim().isEthereumAddress(),
                body("signature")
                    .exists()
                    .matches(/^(0x)[0-9a-f]{130}$/i),
            ],
            this.payment_account_temporary.bind(this)
        );

        this.app.get(
            "/v1/payment/info",
            [
                query("account").exists().trim().isEthereumAddress(),
                query("amount").exists().custom(Validation.isAmount),
                query("currency").exists(),
            ],
            this.payment_info.bind(this)
        );

        this.app.post(
            "/v1/payment/new/open",
            [
                body("purchaseId").exists(),
                body("amount").exists().custom(Validation.isAmount),
                body("currency").exists(),
                body("shopId")
                    .exists()
                    .trim()
                    .matches(/^(0x)[0-9a-f]{64}$/i),
                body("account").exists().trim().isEthereumAddress(),
            ],
            this.payment_new_open.bind(this)
        );

        this.app.post(
            "/v1/payment/new/close",
            [body("confirm").exists().trim().toLowerCase().isIn(["true", "false"]), body("paymentId").exists()],
            this.payment_new_close.bind(this)
        );

        this.app.post(
            "/v1/payment/new/approval",
            [
                body("paymentId").exists(),
                body("approval").exists().trim().toLowerCase().isIn(["true", "false"]),
                body("signature")
                    .exists()
                    .matches(/^(0x)[0-9a-f]{130}$/i),
            ],
            this.payment_new_approval.bind(this)
        );

        this.app.get("/v1/payment/item", [query("paymentId").exists()], this.payment_item.bind(this));

        this.app.post("/v1/payment/cancel/open", [body("paymentId").exists()], this.payment_cancel_open.bind(this));

        this.app.post(
            "/v1/payment/cancel/close",
            [body("confirm").exists().trim().toLowerCase().isIn(["true", "false"]), body("paymentId").exists()],
            this.payment_cancel_close.bind(this)
        );

        this.app.post(
            "/v1/payment/cancel/approval",
            [
                body("paymentId").exists(),
                body("approval").exists().trim().toLowerCase().isIn(["true", "false"]),
                body("signature")
                    .exists()
                    .matches(/^(0x)[0-9a-f]{130}$/i),
            ],
            this.payment_cancel_approval.bind(this)
        );
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

    private async getPaymentId(account: string): Promise<string> {
        const nonce = await this.contractManager.sideLedgerContract.nonceOf(account);
        // 내부에 랜덤으로 32 Bytes 를 생성하여 ID를 생성하므로 무한반복될 가능성이 극히 낮음
        while (true) {
            const id = ContractUtils.getPaymentId(account, nonce);
            if (await this.contractManager.sideLoyaltyConsumerContract.isAvailablePaymentId(id)) return id;
        }
    }

    /**
     * POST /v1/payment/account/temporary
     * @private
     */
    private async payment_account_temporary(req: express.Request, res: express.Response) {
        logger.http(`POST /v1/payment/account/temporary ${req.ip}:${JSON.stringify(req.body)}`);

        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(200).json(ResponseMessage.getErrorMessage("2001", { validation: errors.array() }));
        }

        const account: string = String(req.body.account).trim().toLowerCase();
        const signature: string = String(req.body.signature).trim();

        try {
            const message = ContractUtils.getAccountMessage(
                account,
                await this.contractManager.sideLedgerContract.nonceOf(account),
                this.contractManager.sideChainId
            );
            if (!ContractUtils.verifyMessage(account, message, signature)) {
                return res.status(200).json(ResponseMessage.getErrorMessage("1501"));
            }
            const temporaryAccount = await this.storage.getAccountOnTemporary(account);
            this.metrics.add("success", 1);
            return res.status(200).json(
                this.makeResponseData(0, {
                    temporaryAccount,
                })
            );
        } catch (error: any) {
            const msg = ResponseMessage.getEVMErrorMessage(error);
            logger.error(`POST /v1/payment/account/temporary : ${msg.error.message}`);
            this.metrics.add("failure", 1);
            return res.status(200).json(msg);
        }
    }

    /**
     * 결제 / 결제정보를 제공한다
     * GET /v1/payment/info
     * @private
     */
    private async payment_info(req: express.Request, res: express.Response) {
        logger.http(`GET /v1/payment/info ${req.ip}:${JSON.stringify(req.query)}`);

        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(200).json(ResponseMessage.getErrorMessage("2001", { validation: errors.array() }));
        }

        try {
            let account: string = String(req.query.account).trim();
            if (ContractUtils.isTemporaryAccount(account)) {
                const realAccount = await this.storage.getRealAccountOnTemporary(account);
                if (realAccount === undefined) {
                    return res.status(200).json(ResponseMessage.getErrorMessage("2004"));
                } else {
                    account = realAccount;
                }
            }

            const amount: BigNumber = BigNumber.from(req.query.amount);
            const currency: string = String(req.query.currency).trim().toLowerCase();

            const feeRate = await this.contractManager.sideLedgerContract.getFee();
            const rate = await this.contractManager.sideCurrencyRateContract.get(currency.toLowerCase());
            const multiple = await this.contractManager.sideCurrencyRateContract.multiple();

            let balance: BigNumber;
            let balanceValue: BigNumber;
            let paidPoint: BigNumber;
            let paidValue: BigNumber;
            let feePoint: BigNumber;
            let feeValue: BigNumber;
            let totalPoint: BigNumber;
            let totalValue: BigNumber;

            balance = await this.contractManager.sideLedgerContract.pointBalanceOf(account);
            balanceValue = ContractUtils.zeroGWEI(balance.mul(multiple).div(rate));
            paidPoint = ContractUtils.zeroGWEI(amount.mul(rate).div(multiple));
            feePoint = ContractUtils.zeroGWEI(paidPoint.mul(feeRate).div(10000));
            totalPoint = paidPoint.add(feePoint);
            paidValue = BigNumber.from(amount);
            feeValue = ContractUtils.zeroGWEI(paidValue.mul(feeRate).div(10000));
            totalValue = paidValue.add(feeValue);

            this.metrics.add("success", 1);
            return res.status(200).json(
                this.makeResponseData(0, {
                    account,
                    amount: amount.toString(),
                    currency,
                    balance: balance.toString(),
                    balanceValue: balanceValue.toString(),
                    paidPoint: paidPoint.toString(),
                    paidValue: paidValue.toString(),
                    feePoint: feePoint.toString(),
                    feeValue: feeValue.toString(),
                    totalPoint: totalPoint.toString(),
                    totalValue: totalValue.toString(),
                    feeRate: feeRate / 10000,
                })
            );
        } catch (error: any) {
            const msg = ResponseMessage.getEVMErrorMessage(error);
            logger.error(`GET /v1/payment/info : ${msg.error.message}`);
            this.metrics.add("failure", 1);
            return res.status(200).json(this.makeResponseData(msg.code, undefined, msg.error));
        }
    }

    /**
     * POST /v1/payment/new/open
     * @private
     */
    private async payment_new_open(req: express.Request, res: express.Response) {
        logger.http(`POST /v1/payment/new/open ${req.ip}:${JSON.stringify(req.body)}`);

        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(200).json(ResponseMessage.getErrorMessage("2001", { validation: errors.array() }));
        }

        try {
            let accessKey = req.get("Authorization");
            if (accessKey === undefined) accessKey = String(req.body.accessKey).trim();
            if (accessKey !== this.config.relay.accessKey) {
                return res.json(ResponseMessage.getErrorMessage("2002"));
            }

            let account: string = String(req.body.account).trim();
            let temporaryAccount: string = "";
            if (ContractUtils.isTemporaryAccount(account)) {
                const realAccount = await this.storage.getRealAccountOnTemporary(account);
                if (realAccount === undefined) {
                    return res.status(200).json(ResponseMessage.getErrorMessage("2004"));
                } else {
                    temporaryAccount = account;
                    account = realAccount;
                }
            }

            const purchaseId: string = String(req.body.purchaseId).trim();
            const amount: BigNumber = BigNumber.from(req.body.amount);
            const currency: string = String(req.body.currency).trim();
            const shopId: string = String(req.body.shopId).trim();

            const feeRate = await this.contractManager.sideLedgerContract.getFee();
            const rate = await this.contractManager.sideCurrencyRateContract.get(currency.toLowerCase());
            const multiple = await this.contractManager.sideCurrencyRateContract.multiple();

            let balance: BigNumber;
            let paidPoint: BigNumber;
            let paidValue: BigNumber;
            let feePoint: BigNumber;
            let feeValue: BigNumber;
            let totalPoint: BigNumber;
            let totalValue: BigNumber;

            const contract = this.contractManager.sideLedgerContract;
            balance = await contract.pointBalanceOf(account);
            paidPoint = ContractUtils.zeroGWEI(amount.mul(rate).div(multiple));
            feePoint = ContractUtils.zeroGWEI(paidPoint.mul(feeRate).div(10000));
            totalPoint = paidPoint.add(feePoint);
            if (totalPoint.gt(balance)) {
                return res.status(200).json(ResponseMessage.getErrorMessage("1511"));
            }
            paidValue = BigNumber.from(amount);
            feeValue = ContractUtils.zeroGWEI(paidValue.mul(feeRate).div(10000));
            totalValue = paidValue.add(feeValue);

            const paymentId = await this.getPaymentId(account);
            const [secret, secretLock] = ContractUtils.getSecret();
            const item: LoyaltyPaymentTaskData = {
                paymentId,
                purchaseId,
                amount,
                currency,
                shopId,
                account,
                secret,
                secretLock,
                paidPoint,
                paidValue,
                feePoint,
                feeValue,
                totalPoint,
                totalValue,
                paymentStatus: LoyaltyPaymentTaskStatus.OPENED_NEW,
                contractStatus: ContractLoyaltyPaymentStatus.INVALID,
                openNewTimestamp: ContractUtils.getTimeStamp(),
                closeNewTimestamp: 0,
                openCancelTimestamp: 0,
                closeCancelTimestamp: 0,
                openNewTxId: "",
                openNewTxTime: 0,
                openCancelTxId: "",
                openCancelTxTime: 0,
            };
            await this.storage.postPayment(item);

            const shopContract = this.contractManager.sideShopContract;
            const shopInfo = await shopContract.shopOf(item.shopId);

            const mobileData = await this.storage.getMobile(item.account, MobileType.USER_APP);

            if (!this.config.relay.testMode && mobileData === undefined) {
                return res.status(200).json(ResponseMessage.getErrorMessage("2005"));
            }

            if (mobileData !== undefined) {
                // tslint:disable-next-line:one-variable-per-declaration
                let title, shopLabel, amountLabel, pointLabel: string;
                if (mobileData.language === "kr") {
                    title = "포인트 사용 알림";
                    shopLabel = "구매처";
                    amountLabel = "구매 금액";
                    pointLabel = "포인트 사용";
                } else {
                    title = "Loyalty usage notification";
                    shopLabel = "Place of purchase";
                    amountLabel = "Amount";
                    pointLabel = "Points used";
                }
                /// 사용자에게 메세지 발송
                const to = mobileData.token;
                const contents: string[] = [];
                const data = {
                    type: "new",
                    paymentId: item.paymentId,
                    timestamp: item.openNewTimestamp,
                    timeout: 30,
                };
                contents.push(`${shopLabel} : ${shopInfo.name}`);
                contents.push(
                    `${amountLabel} : ${new Amount(item.amount, 18).toDisplayString(
                        true,
                        0
                    )} ${item.currency.toUpperCase()}`
                );
                contents.push(`${pointLabel} : ${new Amount(item.paidPoint, 18).toDisplayString(true, 0)} POINT`);

                await this._sender.send(to, title, contents.join(", "), data);
            }

            try {
                if (temporaryAccount !== "") await this.storage.removeAccountTemporary(temporaryAccount);
            } catch (_) {
                //
            }

            this.metrics.add("success", 1);
            return res.status(200).json(
                this.makeResponseData(0, {
                    paymentId: item.paymentId,
                    purchaseId: item.purchaseId,
                    amount: item.amount.toString(),
                    currency: item.currency,
                    shopId: item.shopId,
                    account: item.account,
                    paidPoint: item.paidPoint.toString(),
                    paidValue: item.paidValue.toString(),
                    feePoint: item.feePoint.toString(),
                    feeValue: item.feeValue.toString(),
                    totalPoint: item.totalPoint.toString(),
                    totalValue: item.totalValue.toString(),
                    paymentStatus: item.paymentStatus,
                    openNewTimestamp: item.openNewTimestamp,
                    closeNewTimestamp: item.closeNewTimestamp,
                    openCancelTimestamp: item.openCancelTimestamp,
                    closeCancelTimestamp: item.closeCancelTimestamp,
                })
            );
        } catch (error: any) {
            const msg = ResponseMessage.getEVMErrorMessage(error);
            logger.error(`POST /v1/payment/new/open : ${msg.error.message}`);
            this.metrics.add("failure", 1);
            return res.status(200).json(msg);
        }
    }

    /**
     * POST /v1/payment/new/approval
     * @private
     */
    private async payment_new_approval(req: express.Request, res: express.Response) {
        logger.http(`POST /v1/payment/new/approval ${req.ip}:${JSON.stringify(req.body)}`);

        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(200).json(ResponseMessage.getErrorMessage("2001", { validation: errors.array() }));
        }

        const signerItem = await this.getRelaySigner();
        try {
            const paymentId: string = String(req.body.paymentId).trim();
            const approval: boolean = String(req.body.approval).trim().toLowerCase() === "true";
            const signature: string = String(req.body.signature).trim();

            const item = await this.storage.getPayment(paymentId);
            if (item === undefined) {
                return res.status(200).json(ResponseMessage.getErrorMessage("2003"));
            } else {
                if (
                    item.paymentStatus !== LoyaltyPaymentTaskStatus.OPENED_NEW &&
                    item.paymentStatus !== LoyaltyPaymentTaskStatus.APPROVED_NEW_FAILED_TX &&
                    item.paymentStatus !== LoyaltyPaymentTaskStatus.APPROVED_NEW_REVERTED_TX
                ) {
                    return res.status(200).json(ResponseMessage.getErrorMessage("2020"));
                }

                if (
                    !ContractUtils.verifyLoyaltyNewPayment(
                        item.paymentId,
                        item.purchaseId,
                        item.amount,
                        item.currency,
                        item.shopId,
                        await this.contractManager.sideLedgerContract.nonceOf(item.account),
                        item.account,
                        signature,
                        this.contractManager.sideChainId
                    )
                ) {
                    return res.status(200).json(ResponseMessage.getErrorMessage("1501"));
                }

                if (ContractUtils.getTimeStamp() - item.openNewTimestamp > this.config.relay.paymentTimeoutSecond) {
                    const data = ResponseMessage.getErrorMessage("7000");

                    await this.sendPaymentResult(
                        TaskResultType.NEW,
                        TaskResultCode.TIMEOUT,
                        data.error.message,
                        this.getCallBackResponse(item)
                    );
                    return res.status(200).json(data);
                }

                const contract = this.contractManager.sideLoyaltyConsumerContract;
                const loyaltyPaymentData = await contract.loyaltyPaymentOf(paymentId);
                if (approval) {
                    if (loyaltyPaymentData.status === ContractLoyaltyPaymentStatus.INVALID) {
                        try {
                            const tx = await contract.connect(signerItem.signer).openNewLoyaltyPayment({
                                paymentId: item.paymentId,
                                purchaseId: item.purchaseId,
                                amount: item.amount,
                                currency: item.currency.toLowerCase(),
                                shopId: item.shopId,
                                account: item.account,
                                signature,
                                secretLock: item.secretLock,
                            });

                            item.openNewTxId = tx.hash;
                            item.openNewTimestamp = ContractUtils.getTimeStamp();
                            item.paymentStatus = LoyaltyPaymentTaskStatus.APPROVED_NEW_SENT_TX;
                            await this.storage.updateOpenNewTx(
                                item.paymentId,
                                item.openNewTxId,
                                item.openNewTimestamp,
                                item.paymentStatus
                            );

                            this.metrics.add("success", 1);
                            return res.status(200).json(
                                this.makeResponseData(0, {
                                    paymentId: item.paymentId,
                                    purchaseId: item.purchaseId,
                                    amount: item.amount.toString(),
                                    currency: item.currency,
                                    shopId: item.shopId,
                                    account: item.account,
                                    paymentStatus: item.paymentStatus,
                                    txHash: tx.hash,
                                })
                            );
                        } catch (error) {
                            item.paymentStatus = LoyaltyPaymentTaskStatus.APPROVED_NEW_FAILED_TX;
                            await this.storage.forcedUpdatePaymentStatus(item.paymentId, item.paymentStatus);
                            const msg = ResponseMessage.getEVMErrorMessage(error);
                            logger.error(`POST /v1/payment/new/approval : ${msg.error.message}`);
                            return res.status(200).json(msg);
                        }
                    } else if (loyaltyPaymentData.status === ContractLoyaltyPaymentStatus.OPENED_PAYMENT) {
                        item.paymentStatus = LoyaltyPaymentTaskStatus.REPLY_COMPLETED_NEW;
                        await this.storage.updatePaymentStatus(item.paymentId, item.paymentStatus);
                        return res.status(200).json(ResponseMessage.getErrorMessage("2025"));
                    } else if (loyaltyPaymentData.status === ContractLoyaltyPaymentStatus.CLOSED_PAYMENT) {
                        item.paymentStatus = LoyaltyPaymentTaskStatus.CLOSED_NEW;
                        await this.storage.updatePaymentStatus(item.paymentId, item.paymentStatus);
                        return res.status(200).json(ResponseMessage.getErrorMessage("2026"));
                    } else if (loyaltyPaymentData.status === ContractLoyaltyPaymentStatus.FAILED_PAYMENT) {
                        item.paymentStatus = LoyaltyPaymentTaskStatus.FAILED_NEW;
                        await this.storage.updatePaymentStatus(item.paymentId, item.paymentStatus);
                        return res.status(200).json(ResponseMessage.getErrorMessage("2027"));
                    } else {
                        return res.status(200).json(ResponseMessage.getErrorMessage("2020"));
                    }
                } else {
                    if (loyaltyPaymentData.status === ContractLoyaltyPaymentStatus.INVALID) {
                        item.paymentStatus = LoyaltyPaymentTaskStatus.DENIED_NEW;
                        await this.storage.updatePaymentStatus(item.paymentId, item.paymentStatus);

                        await this.sendPaymentResult(
                            TaskResultType.NEW,
                            TaskResultCode.DENIED,
                            "Denied by user",
                            this.getCallBackResponse(item)
                        );

                        this.metrics.add("success", 1);
                        return res.status(200).json(
                            this.makeResponseData(0, {
                                paymentId: item.paymentId,
                                purchaseId: item.purchaseId,
                                amount: item.amount.toString(),
                                currency: item.currency,
                                shopId: item.shopId,
                                account: item.account,
                                paymentStatus: item.paymentStatus,
                            })
                        );
                    } else {
                        return res.status(200).json(ResponseMessage.getErrorMessage("2028"));
                    }
                }
            }
        } catch (error: any) {
            const msg = ResponseMessage.getEVMErrorMessage(error);
            logger.error(`POST /v1/payment/new/approval : ${msg.error.message}`);
            this.metrics.add("failure", 1);
            return res.status(200).json(msg);
        } finally {
            this.releaseRelaySigner(signerItem);
        }
    }

    /**
     * POST /v1/payment/new/close
     * @private
     */
    private async payment_new_close(req: express.Request, res: express.Response) {
        logger.http(`POST /v1/payment/new/close ${req.ip}:${JSON.stringify(req.body)}`);

        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(200).json(ResponseMessage.getErrorMessage("2001", { validation: errors.array() }));
        }

        let accessKey = req.get("Authorization");
        if (accessKey === undefined) accessKey = String(req.body.accessKey).trim();
        if (accessKey !== this.config.relay.accessKey) {
            return res.json(ResponseMessage.getErrorMessage("2002"));
        }

        const confirm: boolean = String(req.body.confirm).trim().toLowerCase() === "true";
        const paymentId: string = String(req.body.paymentId).trim();
        const item = await this.storage.getPayment(paymentId);
        if (item === undefined) {
            return res.status(200).json(ResponseMessage.getErrorMessage("2003"));
        } else {
            const signerItem = await this.getRelaySigner();
            try {
                const contract = this.contractManager.sideLoyaltyConsumerContract;
                const loyaltyPaymentData = await contract.loyaltyPaymentOf(paymentId);
                if (loyaltyPaymentData.status === ContractLoyaltyPaymentStatus.INVALID) {
                    if (item.paymentStatus === LoyaltyPaymentTaskStatus.DENIED_NEW) {
                        item.paymentStatus = LoyaltyPaymentTaskStatus.FAILED_NEW;
                        item.closeNewTimestamp = ContractUtils.getTimeStamp();
                        await this.storage.updateCloseNewTimestamp(
                            item.paymentId,
                            item.paymentStatus,
                            item.closeNewTimestamp
                        );

                        this.metrics.add("success", 1);
                        return res.status(200).json(
                            this.makeResponseData(0, {
                                paymentId: item.paymentId,
                                purchaseId: item.purchaseId,
                                amount: item.amount.toString(),
                                currency: item.currency,
                                shopId: item.shopId,
                                account: item.account,
                                paidPoint: item.paidPoint.toString(),
                                paidValue: item.paidValue.toString(),
                                feePoint: item.feePoint.toString(),
                                feeValue: item.feeValue.toString(),
                                totalPoint: item.totalPoint.toString(),
                                totalValue: item.totalValue.toString(),
                                paymentStatus: item.paymentStatus,
                                openNewTimestamp: item.openNewTimestamp,
                                closeNewTimestamp: item.closeNewTimestamp,
                                openCancelTimestamp: item.openCancelTimestamp,
                                closeCancelTimestamp: item.closeCancelTimestamp,
                            })
                        );
                    } else if (
                        item.paymentStatus === LoyaltyPaymentTaskStatus.OPENED_NEW ||
                        item.paymentStatus === LoyaltyPaymentTaskStatus.APPROVED_NEW_FAILED_TX ||
                        item.paymentStatus === LoyaltyPaymentTaskStatus.APPROVED_NEW_SENT_TX ||
                        item.paymentStatus === LoyaltyPaymentTaskStatus.APPROVED_NEW_CONFIRMED_TX ||
                        item.paymentStatus === LoyaltyPaymentTaskStatus.APPROVED_NEW_REVERTED_TX
                    ) {
                        const timeout = this.config.relay.paymentTimeoutSecond - 5;
                        if (ContractUtils.getTimeStamp() - item.openNewTimestamp > timeout) {
                            item.paymentStatus = LoyaltyPaymentTaskStatus.FAILED_NEW;
                            item.closeNewTimestamp = ContractUtils.getTimeStamp();
                            await this.storage.updateCloseNewTimestamp(
                                item.paymentId,
                                item.paymentStatus,
                                item.closeNewTimestamp
                            );
                            this.metrics.add("success", 1);
                            return res.status(200).json(
                                this.makeResponseData(0, {
                                    paymentId: item.paymentId,
                                    purchaseId: item.purchaseId,
                                    amount: item.amount.toString(),
                                    currency: item.currency,
                                    shopId: item.shopId,
                                    account: item.account,
                                    paidPoint: item.paidPoint.toString(),
                                    paidValue: item.paidValue.toString(),
                                    feePoint: item.feePoint.toString(),
                                    feeValue: item.feeValue.toString(),
                                    totalPoint: item.totalPoint.toString(),
                                    totalValue: item.totalValue.toString(),
                                    paymentStatus: item.paymentStatus,
                                    openNewTimestamp: item.openNewTimestamp,
                                    closeNewTimestamp: item.closeNewTimestamp,
                                    openCancelTimestamp: item.openCancelTimestamp,
                                    closeCancelTimestamp: item.closeCancelTimestamp,
                                })
                            );
                        } else {
                            return res.status(200).json(ResponseMessage.getErrorMessage("2030"));
                        }
                    } else if (
                        item.paymentStatus === LoyaltyPaymentTaskStatus.CLOSED_NEW ||
                        item.paymentStatus === LoyaltyPaymentTaskStatus.FAILED_NEW
                    ) {
                        item.paymentStatus = LoyaltyPaymentTaskStatus.FAILED_NEW;
                        item.closeNewTimestamp = ContractUtils.getTimeStamp();
                        await this.storage.updateCloseNewTimestamp(
                            item.paymentId,
                            item.paymentStatus,
                            item.closeNewTimestamp
                        );
                        return res.status(200).json(ResponseMessage.getErrorMessage("2029"));
                    } else {
                        return res.status(200).json(ResponseMessage.getErrorMessage("2024"));
                    }
                } else if (loyaltyPaymentData.status === ContractLoyaltyPaymentStatus.OPENED_PAYMENT) {
                    try {
                        const tx = await contract
                            .connect(signerItem.signer)
                            .closeNewLoyaltyPayment(item.paymentId, item.secret, confirm);

                        const event = await this.waitPaymentLoyalty(contract, tx);
                        if (event !== undefined) {
                            item.paymentStatus = confirm
                                ? LoyaltyPaymentTaskStatus.CLOSED_NEW
                                : LoyaltyPaymentTaskStatus.FAILED_NEW;
                            item.closeNewTimestamp = ContractUtils.getTimeStamp();
                            this.updateEvent(event, item);
                            await this.storage.updatePayment(item);

                            this.metrics.add("success", 1);
                            return res.status(200).json(
                                this.makeResponseData(0, {
                                    paymentId: item.paymentId,
                                    purchaseId: item.purchaseId,
                                    amount: item.amount.toString(),
                                    currency: item.currency,
                                    shopId: item.shopId,
                                    account: item.account,
                                    paidPoint: item.paidPoint.toString(),
                                    paidValue: item.paidValue.toString(),
                                    feePoint: item.feePoint.toString(),
                                    feeValue: item.feeValue.toString(),
                                    totalPoint: item.totalPoint.toString(),
                                    totalValue: item.totalValue.toString(),
                                    paymentStatus: item.paymentStatus,
                                    openNewTimestamp: item.openNewTimestamp,
                                    closeNewTimestamp: item.closeNewTimestamp,
                                    openCancelTimestamp: item.openCancelTimestamp,
                                    closeCancelTimestamp: item.closeCancelTimestamp,
                                })
                            );
                        } else {
                            return res.status(200).json(ResponseMessage.getErrorMessage("5000"));
                        }
                    } catch (error) {
                        const msg = ResponseMessage.getEVMErrorMessage(error);
                        logger.error(`POST /v1/payment/new/close : ${msg.error.message}`);
                        return res.status(200).json(this.makeResponseData(msg.code, undefined, msg.error));
                    }
                } else if (loyaltyPaymentData.status === ContractLoyaltyPaymentStatus.CLOSED_PAYMENT) {
                    item.paymentStatus = LoyaltyPaymentTaskStatus.CLOSED_NEW;
                    item.closeNewTimestamp = ContractUtils.getTimeStamp();
                    await this.storage.updateCloseNewTimestamp(
                        item.paymentId,
                        item.paymentStatus,
                        item.closeNewTimestamp
                    );
                    return res.status(200).json(ResponseMessage.getErrorMessage("2026"));
                } else if (loyaltyPaymentData.status === ContractLoyaltyPaymentStatus.FAILED_PAYMENT) {
                    item.paymentStatus = LoyaltyPaymentTaskStatus.FAILED_NEW;
                    item.closeNewTimestamp = ContractUtils.getTimeStamp();
                    await this.storage.updateCloseNewTimestamp(
                        item.paymentId,
                        item.paymentStatus,
                        item.closeNewTimestamp
                    );
                    return res.status(200).json(ResponseMessage.getErrorMessage("2026"));
                } else {
                    logger.warn(
                        `POST /v1/payment/new/close : contractStatus : ${loyaltyPaymentData.status} : ${item.contractStatus}`
                    );
                    if (loyaltyPaymentData.status === ContractLoyaltyPaymentStatus.INVALID) {
                        item.contractStatus = ContractLoyaltyPaymentStatus.FAILED_PAYMENT;
                        await this.storage.updatePaymentContractStatus(item.paymentId, item.contractStatus);

                        item.paymentStatus = LoyaltyPaymentTaskStatus.FAILED_NEW;
                        item.closeNewTimestamp = ContractUtils.getTimeStamp();
                        await this.storage.updateCloseNewTimestamp(
                            item.paymentId,
                            item.paymentStatus,
                            item.closeNewTimestamp
                        );
                    }
                    return res.status(200).json(ResponseMessage.getErrorMessage("2024"));
                }
            } catch (error: any) {
                const msg = ResponseMessage.getEVMErrorMessage(error);
                logger.error(`POST /v1/payment/new/close : ${msg.error.message}`);
                this.metrics.add("failure", 1);
                return res.status(200).json(msg);
            } finally {
                this.releaseRelaySigner(signerItem);
            }
        }
    }

    /**
     * GET /v1/payment/item
     * @private
     */
    private async payment_item(req: express.Request, res: express.Response) {
        logger.http(`GET /v1/payment/item ${req.ip}:${JSON.stringify(req.query)}`);

        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(200).json(ResponseMessage.getErrorMessage("2001", { validation: errors.array() }));
        }

        try {
            const paymentId: string = String(req.query.paymentId).trim();
            const item = await this.storage.getPayment(paymentId);
            if (item === undefined) {
                return res.status(200).json(ResponseMessage.getErrorMessage("2003"));
            }
            this.metrics.add("success", 1);
            return res.status(200).json(
                this.makeResponseData(0, {
                    paymentId: item.paymentId,
                    purchaseId: item.purchaseId,
                    amount: item.amount.toString(),
                    currency: item.currency,
                    shopId: item.shopId,
                    account: item.account,
                    paidPoint: item.paidPoint.toString(),
                    paidValue: item.paidValue.toString(),
                    feePoint: item.feePoint.toString(),
                    feeValue: item.feeValue.toString(),
                    totalPoint: item.totalPoint.toString(),
                    totalValue: item.totalValue.toString(),
                    paymentStatus: item.paymentStatus,
                    openNewTimestamp: item.openNewTimestamp,
                    closeNewTimestamp: item.closeNewTimestamp,
                    openCancelTimestamp: item.openCancelTimestamp,
                    closeCancelTimestamp: item.closeCancelTimestamp,
                })
            );
        } catch (error: any) {
            const msg = ResponseMessage.getEVMErrorMessage(error);
            logger.error(`GET /v1/payment/item : ${msg.error.message}`);
            this.metrics.add("failure", 1);
            return res.status(200).json(this.makeResponseData(msg.code, undefined, msg.error));
        }
    }

    /**
     * 결제 / 결제정보를 제공한다
     * POST /v1/payment/cancel/open
     * @private
     */
    private async payment_cancel_open(req: express.Request, res: express.Response) {
        logger.http(`POST /v1/payment/cancel/open ${req.ip}:${JSON.stringify(req.body)}`);

        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(200).json(ResponseMessage.getErrorMessage("2001", { validation: errors.array() }));
        }

        try {
            let accessKey = req.get("Authorization");
            if (accessKey === undefined) accessKey = String(req.body.accessKey).trim();
            if (accessKey !== this.config.relay.accessKey) {
                return res.json(ResponseMessage.getErrorMessage("2002"));
            }

            const paymentId: string = String(req.body.paymentId).trim();
            const item = await this.storage.getPayment(paymentId);
            if (item === undefined) {
                return res.status(200).json(ResponseMessage.getErrorMessage("2003"));
            } else {
                if (item.paymentStatus !== LoyaltyPaymentTaskStatus.CLOSED_NEW) {
                    return res.status(200).json(ResponseMessage.getErrorMessage("2022"));
                }

                item.paymentStatus = LoyaltyPaymentTaskStatus.OPENED_CANCEL;
                item.openCancelTimestamp = ContractUtils.getTimeStamp();
                await this.storage.updateOpenCancelTimestamp(
                    item.paymentId,
                    item.paymentStatus,
                    item.openCancelTimestamp
                );
                [item.secret, item.secretLock] = ContractUtils.getSecret();
                await this.storage.updateSecret(item.paymentId, item.secret, item.secretLock);

                const shopContract = this.contractManager.sideShopContract;
                const shopInfo = await shopContract.shopOf(item.shopId);

                let hasDelegator: boolean = false;
                if (shopInfo.delegator !== AddressZero) {
                    const wallet = await this.storage.getDelegator(shopInfo.account, this.config.relay.encryptKey);
                    if (wallet !== undefined && wallet.address.toLowerCase() === shopInfo.delegator.toLowerCase()) {
                        hasDelegator = true;
                    }
                }

                if (hasDelegator) {
                    this.metrics.add("success", 1);
                    return res.status(200).json(
                        this.makeResponseData(0, {
                            paymentId: item.paymentId,
                            purchaseId: item.purchaseId,
                            amount: item.amount.toString(),
                            currency: item.currency,
                            shopId: item.shopId,
                            account: item.account,
                            paidPoint: item.paidPoint.toString(),
                            paidValue: item.paidValue.toString(),
                            feePoint: item.feePoint.toString(),
                            feeValue: item.feeValue.toString(),
                            totalPoint: item.totalPoint.toString(),
                            totalValue: item.totalValue.toString(),
                            paymentStatus: item.paymentStatus,
                            openNewTimestamp: item.openNewTimestamp,
                            closeNewTimestamp: item.closeNewTimestamp,
                            openCancelTimestamp: item.openCancelTimestamp,
                            closeCancelTimestamp: item.closeCancelTimestamp,
                        })
                    );
                }

                const mobileData = await this.storage.getMobile(shopInfo.account, MobileType.SHOP_APP);

                if (!this.config.relay.testMode && mobileData === undefined) {
                    return res.status(200).json(ResponseMessage.getErrorMessage("2005"));
                }

                if (mobileData !== undefined) {
                    /// 상점주에게 메세지 발송
                    // tslint:disable-next-line:one-variable-per-declaration
                    let title, shopLabel, amountLabel, pointLabel: string;
                    if (mobileData.language === "kr") {
                        title = "마일리지 사용 취소 알림";
                        shopLabel = "구매처";
                        amountLabel = "구매 금액";
                        pointLabel = "포인트 사용";
                    } else {
                        title = "Loyalty cancellation notification";
                        shopLabel = "Place of purchase";
                        amountLabel = "Amount";
                        pointLabel = "Points used";
                    }
                    const to = mobileData.token;
                    const contents: string[] = [];
                    const data = {
                        type: "cancel",
                        paymentId: item.paymentId,
                        timestamp: item.openCancelTimestamp,
                        timeout: 30,
                    };
                    contents.push(`${shopLabel} : ${shopInfo.name}`);
                    contents.push(
                        `${amountLabel} : ${new Amount(item.amount, 18).toDisplayString(
                            true,
                            0
                        )} ${item.currency.toUpperCase()}`
                    );
                    contents.push(`${pointLabel} : ${new Amount(item.paidPoint, 18).toDisplayString(true, 0)} POINT`);

                    await this._sender.send(to, title, contents.join(", "), data);
                }

                this.metrics.add("success", 1);
                return res.status(200).json(
                    this.makeResponseData(0, {
                        paymentId: item.paymentId,
                        purchaseId: item.purchaseId,
                        amount: item.amount.toString(),
                        currency: item.currency,
                        shopId: item.shopId,
                        account: item.account,
                        paidPoint: item.paidPoint.toString(),
                        paidValue: item.paidValue.toString(),
                        feePoint: item.feePoint.toString(),
                        feeValue: item.feeValue.toString(),
                        totalPoint: item.totalPoint.toString(),
                        totalValue: item.totalValue.toString(),
                        paymentStatus: item.paymentStatus,
                        openNewTimestamp: item.openNewTimestamp,
                        closeNewTimestamp: item.closeNewTimestamp,
                        openCancelTimestamp: item.openCancelTimestamp,
                        closeCancelTimestamp: item.closeCancelTimestamp,
                    })
                );
            }
        } catch (error: any) {
            const msg = ResponseMessage.getEVMErrorMessage(error);
            logger.error(`POST /v1/payment/cancel/open : ${msg.error.message}`);
            this.metrics.add("failure", 1);
            return res.status(200).json(msg);
        }
    }

    /**
     * POST /v1/payment/cancel/approval
     * @private
     */
    private async payment_cancel_approval(req: express.Request, res: express.Response) {
        logger.http(`POST /v1/payment/cancel/approval ${req.ip}:${JSON.stringify(req.body)}`);

        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(200).json(ResponseMessage.getErrorMessage("2001", { validation: errors.array() }));
        }

        const paymentId: string = String(req.body.paymentId).trim();
        const approval: boolean = String(req.body.approval).trim().toLowerCase() === "true";
        const signature: string = String(req.body.signature).trim();
        const item = await this.storage.getPayment(paymentId);
        if (item === undefined) {
            return res.status(200).json(ResponseMessage.getErrorMessage("2003"));
        } else {
            const signerItem = await this.getRelaySigner();
            try {
                if (
                    item.paymentStatus !== LoyaltyPaymentTaskStatus.OPENED_CANCEL &&
                    item.paymentStatus !== LoyaltyPaymentTaskStatus.APPROVED_CANCEL_FAILED_TX &&
                    item.paymentStatus !== LoyaltyPaymentTaskStatus.APPROVED_CANCEL_REVERTED_TX
                ) {
                    return res.status(200).json(ResponseMessage.getErrorMessage("2020"));
                }

                const shopContract = this.contractManager.sideShopContract;
                const shopData = await shopContract.shopOf(item.shopId);

                let hasDelegator: boolean = false;
                if (shopData.delegator !== AddressZero) {
                    const wallet = await this.storage.getDelegator(shopData.account, this.config.relay.encryptKey);
                    if (wallet !== undefined && wallet.address.toLowerCase() === shopData.delegator.toLowerCase()) {
                        hasDelegator = true;
                    }
                }

                if (!hasDelegator) {
                    const nonce = await this.contractManager.sideLedgerContract.nonceOf(shopData.account);
                    if (
                        !ContractUtils.verifyLoyaltyCancelPayment(
                            item.paymentId,
                            item.purchaseId,
                            nonce,
                            shopData.account,
                            signature,
                            this.contractManager.sideChainId
                        )
                    ) {
                        return res.status(200).json(ResponseMessage.getErrorMessage("1501"));
                    }
                } else {
                    const nonce = await this.contractManager.sideLedgerContract.nonceOf(shopData.delegator);
                    if (
                        !ContractUtils.verifyLoyaltyCancelPayment(
                            item.paymentId,
                            item.purchaseId,
                            nonce,
                            shopData.delegator,
                            signature,
                            this.contractManager.sideChainId
                        )
                    ) {
                        return res.status(200).json(ResponseMessage.getErrorMessage("1501"));
                    }
                }

                if (ContractUtils.getTimeStamp() - item.openCancelTimestamp > this.config.relay.paymentTimeoutSecond) {
                    const msg = ResponseMessage.getErrorMessage("7000");

                    await this.sendPaymentResult(
                        TaskResultType.CANCEL,
                        TaskResultCode.TIMEOUT,
                        msg.error.message,
                        this.getCallBackResponse(item)
                    );

                    return res.status(200).json(msg);
                }

                const contract = this.contractManager.sideLoyaltyConsumerContract;
                const loyaltyPaymentData = await contract.loyaltyPaymentOf(paymentId);
                if (approval) {
                    if (loyaltyPaymentData.status === ContractLoyaltyPaymentStatus.CLOSED_PAYMENT) {
                        try {
                            const tx = await contract
                                .connect(signerItem.signer)
                                .openCancelLoyaltyPayment(item.paymentId, item.secretLock, signature);

                            item.openCancelTxId = tx.hash;
                            item.openCancelTimestamp = ContractUtils.getTimeStamp();
                            item.paymentStatus = LoyaltyPaymentTaskStatus.APPROVED_CANCEL_SENT_TX;
                            await this.storage.updateOpenCancelTx(
                                item.paymentId,
                                item.openCancelTxId,
                                item.openCancelTimestamp,
                                item.paymentStatus
                            );

                            this.metrics.add("success", 1);
                            return res.status(200).json(
                                this.makeResponseData(0, {
                                    paymentId: item.paymentId,
                                    purchaseId: item.purchaseId,
                                    amount: item.amount.toString(),
                                    currency: item.currency,
                                    shopId: item.shopId,
                                    account: item.account,
                                    paymentStatus: item.paymentStatus,
                                    txHash: tx.hash,
                                })
                            );
                        } catch (error) {
                            item.paymentStatus = LoyaltyPaymentTaskStatus.APPROVED_CANCEL_FAILED_TX;
                            await this.storage.updatePaymentStatus(item.paymentId, item.paymentStatus);
                            const msg = ResponseMessage.getEVMErrorMessage(error);
                            logger.error(`POST /v1/payment/cancel/approval : ${msg.error.message}`);
                            return res.status(200).json(msg);
                        }
                    } else if (loyaltyPaymentData.status === ContractLoyaltyPaymentStatus.OPENED_CANCEL) {
                        item.paymentStatus = LoyaltyPaymentTaskStatus.REPLY_COMPLETED_CANCEL;
                        await this.storage.updatePaymentStatus(item.paymentId, item.paymentStatus);
                        return res.status(200).json(ResponseMessage.getErrorMessage("2025"));
                    } else if (loyaltyPaymentData.status === ContractLoyaltyPaymentStatus.CLOSED_CANCEL) {
                        item.paymentStatus = LoyaltyPaymentTaskStatus.CLOSED_CANCEL;
                        await this.storage.updatePaymentStatus(item.paymentId, item.paymentStatus);
                        return res.status(200).json(ResponseMessage.getErrorMessage("2026"));
                    } else if (loyaltyPaymentData.status === ContractLoyaltyPaymentStatus.FAILED_CANCEL) {
                        item.paymentStatus = LoyaltyPaymentTaskStatus.FAILED_CANCEL;
                        await this.storage.updatePaymentStatus(item.paymentId, item.paymentStatus);
                        return res.status(200).json(ResponseMessage.getErrorMessage("2027"));
                    } else {
                        return res.status(200).json(ResponseMessage.getErrorMessage("2020"));
                    }
                } else {
                    if (loyaltyPaymentData.status === ContractLoyaltyPaymentStatus.CLOSED_PAYMENT) {
                        item.paymentStatus = LoyaltyPaymentTaskStatus.DENIED_CANCEL;
                        await this.storage.updatePaymentStatus(item.paymentId, item.paymentStatus);

                        await this.sendPaymentResult(
                            TaskResultType.CANCEL,
                            TaskResultCode.DENIED,
                            "Denied by user",
                            this.getCallBackResponse(item)
                        );

                        this.metrics.add("success", 1);
                        return res.status(200).json(
                            this.makeResponseData(0, {
                                paymentId: item.paymentId,
                                purchaseId: item.purchaseId,
                                amount: item.amount.toString(),
                                currency: item.currency,
                                shopId: item.shopId,
                                account: item.account,
                                paymentStatus: item.paymentStatus,
                            })
                        );
                    } else {
                        return res.status(200).json(ResponseMessage.getErrorMessage("2028"));
                    }
                }
            } catch (error: any) {
                const msg = ResponseMessage.getEVMErrorMessage(error);
                logger.error(`POST /v1/payment/cancel/approval : ${msg.error.message}`);
                this.metrics.add("failure", 1);
                return res.status(200).json(msg);
            } finally {
                this.releaseRelaySigner(signerItem);
            }
        }
    }

    /**
     * 결제 / 결제정보를 제공한다
     * POST /v1/payment/cancel/close
     * @private
     */
    private async payment_cancel_close(req: express.Request, res: express.Response) {
        logger.http(`POST /v1/payment/cancel/close ${req.ip}:${JSON.stringify(req.body)}`);

        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(200).json(ResponseMessage.getErrorMessage("2001", { validation: errors.array() }));
        }

        let accessKey = req.get("Authorization");
        if (accessKey === undefined) accessKey = String(req.body.accessKey).trim();
        if (accessKey !== this.config.relay.accessKey) {
            return res.json(ResponseMessage.getErrorMessage("2002"));
        }

        const confirm: boolean = String(req.body.confirm).trim().toLowerCase() === "true";
        const paymentId: string = String(req.body.paymentId).trim();
        const item = await this.storage.getPayment(paymentId);
        if (item === undefined) {
            return res.status(200).json(ResponseMessage.getErrorMessage("2003"));
        } else {
            const signerItem = await this.getRelaySigner();
            try {
                const contract = this.contractManager.sideLoyaltyConsumerContract;
                const loyaltyPaymentData = await contract.loyaltyPaymentOf(paymentId);
                if (loyaltyPaymentData.status === ContractLoyaltyPaymentStatus.CLOSED_PAYMENT) {
                    if (item.paymentStatus === LoyaltyPaymentTaskStatus.DENIED_CANCEL) {
                        item.paymentStatus = LoyaltyPaymentTaskStatus.FAILED_CANCEL;
                        item.closeCancelTimestamp = ContractUtils.getTimeStamp();
                        await this.storage.updateCloseCancelTimestamp(
                            item.paymentId,
                            item.paymentStatus,
                            item.closeCancelTimestamp
                        );

                        this.metrics.add("success", 1);
                        res.status(200).json(
                            this.makeResponseData(0, {
                                paymentId: item.paymentId,
                                purchaseId: item.purchaseId,
                                amount: item.amount.toString(),
                                currency: item.currency,
                                shopId: item.shopId,
                                account: item.account,
                                paidPoint: item.paidPoint.toString(),
                                paidValue: item.paidValue.toString(),
                                feePoint: item.feePoint.toString(),
                                feeValue: item.feeValue.toString(),
                                totalPoint: item.totalPoint.toString(),
                                totalValue: item.totalValue.toString(),
                                paymentStatus: item.paymentStatus,
                                openNewTimestamp: item.openNewTimestamp,
                                closeNewTimestamp: item.closeNewTimestamp,
                                openCancelTimestamp: item.openCancelTimestamp,
                                closeCancelTimestamp: item.closeCancelTimestamp,
                            })
                        );
                    } else if (
                        item.paymentStatus === LoyaltyPaymentTaskStatus.OPENED_CANCEL ||
                        item.paymentStatus === LoyaltyPaymentTaskStatus.APPROVED_CANCEL_FAILED_TX ||
                        item.paymentStatus === LoyaltyPaymentTaskStatus.APPROVED_CANCEL_SENT_TX ||
                        item.paymentStatus === LoyaltyPaymentTaskStatus.APPROVED_CANCEL_CONFIRMED_TX ||
                        item.paymentStatus === LoyaltyPaymentTaskStatus.APPROVED_CANCEL_REVERTED_TX
                    ) {
                        const timeout = this.config.relay.paymentTimeoutSecond - 5;
                        if (ContractUtils.getTimeStamp() - item.openCancelTimestamp > timeout) {
                            item.paymentStatus = LoyaltyPaymentTaskStatus.FAILED_CANCEL;
                            item.closeCancelTimestamp = ContractUtils.getTimeStamp();
                            await this.storage.updateCloseCancelTimestamp(
                                item.paymentId,
                                item.paymentStatus,
                                item.closeCancelTimestamp
                            );
                            this.metrics.add("success", 1);
                            return res.status(200).json(
                                this.makeResponseData(0, {
                                    paymentId: item.paymentId,
                                    purchaseId: item.purchaseId,
                                    amount: item.amount.toString(),
                                    currency: item.currency,
                                    shopId: item.shopId,
                                    account: item.account,
                                    paidPoint: item.paidPoint.toString(),
                                    paidValue: item.paidValue.toString(),
                                    feePoint: item.feePoint.toString(),
                                    feeValue: item.feeValue.toString(),
                                    totalPoint: item.totalPoint.toString(),
                                    totalValue: item.totalValue.toString(),
                                    paymentStatus: item.paymentStatus,
                                    openNewTimestamp: item.openNewTimestamp,
                                    closeNewTimestamp: item.closeNewTimestamp,
                                    openCancelTimestamp: item.openCancelTimestamp,
                                    closeCancelTimestamp: item.closeCancelTimestamp,
                                })
                            );
                        } else {
                            return res.status(200).json(ResponseMessage.getErrorMessage("2030"));
                        }
                    } else if (
                        item.paymentStatus === LoyaltyPaymentTaskStatus.CLOSED_CANCEL ||
                        item.paymentStatus === LoyaltyPaymentTaskStatus.FAILED_CANCEL
                    ) {
                        item.paymentStatus = LoyaltyPaymentTaskStatus.FAILED_CANCEL;
                        item.closeCancelTimestamp = ContractUtils.getTimeStamp();
                        await this.storage.updateCloseCancelTimestamp(
                            item.paymentId,
                            item.paymentStatus,
                            item.closeCancelTimestamp
                        );
                        return res.status(200).json(ResponseMessage.getErrorMessage("2029"));
                    } else {
                        return res.status(200).json(ResponseMessage.getErrorMessage("2024"));
                    }
                } else if (loyaltyPaymentData.status === ContractLoyaltyPaymentStatus.OPENED_CANCEL) {
                    try {
                        const tx = await contract
                            .connect(signerItem.signer)
                            .closeCancelLoyaltyPayment(item.paymentId, item.secret, confirm);

                        const event = await this.waitPaymentLoyalty(contract, tx);
                        if (event !== undefined) {
                            item.paymentStatus = confirm
                                ? LoyaltyPaymentTaskStatus.CLOSED_CANCEL
                                : LoyaltyPaymentTaskStatus.FAILED_CANCEL;
                            item.closeCancelTimestamp = ContractUtils.getTimeStamp();
                            this.updateEvent(event, item);
                            await this.storage.updatePayment(item);

                            this.metrics.add("success", 1);
                            return res.status(200).json(
                                this.makeResponseData(0, {
                                    paymentId: item.paymentId,
                                    purchaseId: item.purchaseId,
                                    amount: item.amount.toString(),
                                    currency: item.currency,
                                    shopId: item.shopId,
                                    account: item.account,
                                    paidPoint: item.paidPoint.toString(),
                                    paidValue: item.paidValue.toString(),
                                    feePoint: item.feePoint.toString(),
                                    feeValue: item.feeValue.toString(),
                                    totalPoint: item.totalPoint.toString(),
                                    totalValue: item.totalValue.toString(),
                                    paymentStatus: item.paymentStatus,
                                    openNewTimestamp: item.openNewTimestamp,
                                    closeNewTimestamp: item.closeNewTimestamp,
                                    openCancelTimestamp: item.openCancelTimestamp,
                                    closeCancelTimestamp: item.closeCancelTimestamp,
                                })
                            );
                        } else {
                            res.status(200).json(ResponseMessage.getErrorMessage("5000"));
                        }
                    } catch (error) {
                        const msg = ResponseMessage.getEVMErrorMessage(error);
                        logger.error(`POST /v1/payment/cancel/close : ${msg.error.message}`);
                        return res.status(200).json(msg);
                    }
                } else if (loyaltyPaymentData.status === ContractLoyaltyPaymentStatus.CLOSED_CANCEL) {
                    item.paymentStatus = LoyaltyPaymentTaskStatus.CLOSED_CANCEL;
                    item.closeCancelTimestamp = ContractUtils.getTimeStamp();
                    await this.storage.updateCloseCancelTimestamp(
                        item.paymentId,
                        item.paymentStatus,
                        item.closeCancelTimestamp
                    );
                    return res.status(200).json(ResponseMessage.getErrorMessage("2026"));
                } else if (loyaltyPaymentData.status === ContractLoyaltyPaymentStatus.FAILED_PAYMENT) {
                    item.paymentStatus = LoyaltyPaymentTaskStatus.FAILED_CANCEL;
                    item.closeCancelTimestamp = ContractUtils.getTimeStamp();
                    await this.storage.updateCloseCancelTimestamp(
                        item.paymentId,
                        item.paymentStatus,
                        item.closeCancelTimestamp
                    );
                    return res.status(200).json(ResponseMessage.getErrorMessage("2026"));
                } else {
                    logger.warn(
                        `POST /v1/payment/cancel/close : contractStatus : ${loyaltyPaymentData.status} : ${item.contractStatus}`
                    );
                    if (loyaltyPaymentData.status === ContractLoyaltyPaymentStatus.INVALID) {
                        item.contractStatus = ContractLoyaltyPaymentStatus.FAILED_CANCEL;
                        await this.storage.updatePaymentContractStatus(item.paymentId, item.contractStatus);

                        item.paymentStatus = LoyaltyPaymentTaskStatus.FAILED_CANCEL;
                        item.closeCancelTimestamp = ContractUtils.getTimeStamp();
                        await this.storage.updateCloseCancelTimestamp(
                            item.paymentId,
                            item.paymentStatus,
                            item.closeCancelTimestamp
                        );
                    }
                    return res.status(200).json(ResponseMessage.getErrorMessage("2024"));
                }
            } catch (error: any) {
                const msg = ResponseMessage.getEVMErrorMessage(error);
                logger.error(`POST /v1/payment/cancel/close : ${msg.error.message}`);
                this.metrics.add("failure", 1);
                return res.status(200).json(msg);
            } finally {
                this.releaseRelaySigner(signerItem);
            }
        }
    }

    private getCallBackResponse(item: LoyaltyPaymentTaskData): any {
        return {
            paymentId: item.paymentId,
            purchaseId: item.purchaseId,
            amount: item.amount.toString(),
            currency: item.currency,
            shopId: item.shopId,
            account: item.account,
            paidPoint: item.paidPoint.toString(),
            paidValue: item.paidValue.toString(),
            feePoint: item.feePoint.toString(),
            feeValue: item.feeValue.toString(),
            totalPoint: item.totalPoint.toString(),
            totalValue: item.totalValue.toString(),
            paymentStatus: item.paymentStatus,
        };
    }

    private updateEvent(event: ContractLoyaltyPaymentEvent, item: LoyaltyPaymentTaskData): void {
        if (item.paymentId !== event.paymentId) return;
        item.purchaseId = event.purchaseId;
        item.currency = event.currency;
        item.shopId = event.shopId;
        item.account = event.account;
        item.paidPoint = event.paidPoint;
        item.paidValue = event.paidValue;
        item.feePoint = event.feePoint;
        item.feeValue = event.feeValue;
        item.totalPoint = event.totalPoint;
        item.totalValue = event.totalValue;
        item.contractStatus = event.status;
    }

    private async waitPaymentLoyalty(
        contract: LoyaltyConsumer,
        tx: ContractTransaction
    ): Promise<ContractLoyaltyPaymentEvent | undefined> {
        const res: any = {};
        const contractReceipt = await tx.wait();
        const log = ContractUtils.findLog(contractReceipt, contract.interface, "LoyaltyPaymentEvent");
        if (log !== undefined) {
            const parsedLog = contract.interface.parseLog(log);

            res.paymentId = parsedLog.args.payment.paymentId;
            res.purchaseId = parsedLog.args.payment.purchaseId;
            res.amount = BigNumber.from(parsedLog.args.payment.paidValue);
            res.currency = parsedLog.args.payment.currency;
            res.shopId = parsedLog.args.payment.shopId;
            res.account = parsedLog.args.payment.account;
            res.timestamp = parsedLog.args.payment.timestamp;
            res.paidPoint = BigNumber.from(parsedLog.args.payment.paidPoint);
            res.paidValue = BigNumber.from(parsedLog.args.payment.paidValue);
            res.feePoint = BigNumber.from(parsedLog.args.payment.feePoint);
            res.feeValue = BigNumber.from(parsedLog.args.payment.feeValue);
            res.status = BigNumber.from(parsedLog.args.payment.status);
            res.balance = BigNumber.from(parsedLog.args.balance);
            res.totalPoint = res.paidPoint.add(res.feePoint);
            res.totalValue = res.paidValue.add(res.feeValue);

            return res;
        } else return undefined;
    }

    private async sendPaymentResult(
        type: TaskResultType,
        code: TaskResultCode,
        message: string,
        data: PaymentResultData
    ) {
        try {
            const client = new HTTPClient();
            const res = await client.post(this.config.relay.callbackEndpoint, {
                accessKey: this.config.relay.callbackAccessKey,
                type,
                code,
                message,
                data,
            });
            logger.info(res.data);
        } catch (error) {
            if (error instanceof Error) {
                logger.error(`sendPaymentResult : ${error.message}`);
            } else {
                logger.error(`sendPaymentResult : ${JSON.stringify(error)}`);
            }
        }
    }
}
