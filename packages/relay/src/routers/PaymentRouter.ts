import { CurrencyRate, Ledger, PhoneLinkCollection, ShopCollection, Token } from "../../typechain-types";
import { Config } from "../common/Config";
import { logger } from "../common/Logger";
import { ISignerItem, RelaySigners } from "../contract/Signers";
import { INotificationSender } from "../delegator/NotificationSender";
import { WebService } from "../service/WebService";
import { RelayStorage } from "../storage/RelayStorage";
import {
    ContractLoyaltyPaymentEvent,
    LoyaltyPaymentTaskData,
    LoyaltyPaymentTaskStatus,
    LoyaltyType,
    PaymentResultData,
    ResponseMessage,
    TaskResultCode,
    TaskResultType,
    WithdrawStatus,
} from "../types";
import { ContractUtils } from "../utils/ContractUtils";
import { HTTPClient } from "../utils/Utils";
import { Validation } from "../validation";

import { BigNumber, ContractTransaction } from "ethers";
import { body, query, validationResult } from "express-validator";
import * as hre from "hardhat";

import express from "express";
import { Amount } from "../common/Amount";

export class PaymentRouter {
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

    private readonly _relaySigners: RelaySigners;

    /**
     * ERC20 토큰 컨트랙트
     * @private
     */
    private _tokenContract: Token | undefined;

    /**
     * 사용자의 원장 컨트랙트
     * @private
     */
    private _ledgerContract: Ledger | undefined;

    /**
     * 사용자의 원장 컨트랙트
     * @private
     */
    private _shopContract: ShopCollection | undefined;

    /**
     * 이메일 지갑주소 링크 컨트랙트
     * @private
     */
    private _phoneLinkerContract: PhoneLinkCollection | undefined;

    /**
     * 환률 컨트랙트
     * @private
     */
    private _currencyRateContract: CurrencyRate | undefined;

    private _storage: RelayStorage;

    private readonly _sender: INotificationSender;

    /**
     *
     * @param service  WebService
     * @param config Configuration
     * @param storage
     * @param relaySigners
     * @param sender
     */
    constructor(
        service: WebService,
        config: Config,
        storage: RelayStorage,
        relaySigners: RelaySigners,
        sender: INotificationSender
    ) {
        this._web_service = service;
        this._config = config;

        this._storage = storage;
        this._relaySigners = relaySigners;
        this._sender = sender;
    }

    private get app(): express.Application {
        return this._web_service.app;
    }

    public registerRoutes() {
        this.app.get(
            "/v1/payment/user/balance",
            [query("account").exists().trim().isEthereumAddress()],
            this.user_balance.bind(this)
        );

        this.app.get(
            "/v1/payment/shop/info",
            [
                query("shopId")
                    .exists()
                    .trim()
                    .matches(/^(0x)[0-9a-f]{64}$/i),
            ],
            this.shop_info.bind(this)
        );

        this.app.get(
            "/v1/payment/shop/withdrawal",
            [
                query("shopId")
                    .exists()
                    .trim()
                    .matches(/^(0x)[0-9a-f]{64}$/i),
            ],
            this.shop_withdrawal.bind(this)
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
                body("accessKey").exists(),
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
            [body("accessKey").exists(), body("paymentId").exists()],
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

        this.app.post(
            "/v1/payment/cancel/open",
            [body("accessKey").exists(), body("paymentId").exists()],
            this.payment_cancel_open.bind(this)
        );

        this.app.post(
            "/v1/payment/cancel/close",
            [body("accessKey").exists(), body("paymentId").exists()],
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

    /**
     * ERC20 토큰 컨트랙트를 리턴한다.
     * 컨트랙트의 객체가 생성되지 않았다면 컨트랙트 주소를 이용하여 컨트랙트 객체를 생성한 후 반환한다.
     * @private
     */
    private async getTokenContract(): Promise<Token> {
        if (this._tokenContract === undefined) {
            const tokenFactory = await hre.ethers.getContractFactory("Token");
            this._tokenContract = tokenFactory.attach(this._config.contracts.tokenAddress);
        }
        return this._tokenContract;
    }

    /**
     * 사용자의 원장 컨트랙트를 리턴한다.
     * 컨트랙트의 객체가 생성되지 않았다면 컨트랙트 주소를 이용하여 컨트랙트 객체를 생성한 후 반환한다.
     * @private
     */
    private async getLedgerContract(): Promise<Ledger> {
        if (this._ledgerContract === undefined) {
            const ledgerFactory = await hre.ethers.getContractFactory("Ledger");
            this._ledgerContract = ledgerFactory.attach(this._config.contracts.ledgerAddress);
        }
        return this._ledgerContract;
    }

    private async getShopContract(): Promise<ShopCollection> {
        if (this._shopContract === undefined) {
            const shopFactory = await hre.ethers.getContractFactory("ShopCollection");
            this._shopContract = shopFactory.attach(this._config.contracts.shopAddress);
        }
        return this._shopContract;
    }

    /**
     * 이메일 지갑주소 링크 컨트랙트를 리턴한다.
     * 컨트랙트의 객체가 생성되지 않았다면 컨트랙트 주소를 이용하여 컨트랙트 객체를 생성한 후 반환한다.
     * @private
     */
    private async getPhoneLinkerContract(): Promise<PhoneLinkCollection> {
        if (this._phoneLinkerContract === undefined) {
            const linkCollectionFactory = await hre.ethers.getContractFactory("PhoneLinkCollection");
            this._phoneLinkerContract = linkCollectionFactory.attach(this._config.contracts.phoneLinkerAddress);
        }
        return this._phoneLinkerContract;
    }

    /**
     * 환률 컨트랙트를 리턴한다.
     * 컨트랙트의 객체가 생성되지 않았다면 컨트랙트 주소를 이용하여 컨트랙트 객체를 생성한 후 반환한다.
     * @private
     */
    private async getCurrencyRateContract(): Promise<CurrencyRate> {
        if (this._currencyRateContract === undefined) {
            const factory = await hre.ethers.getContractFactory("CurrencyRate");
            this._currencyRateContract = factory.attach(this._config.contracts.currencyRateAddress);
        }
        return this._currencyRateContract;
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
        const nonce = await (await this.getLedgerContract()).nonceOf(account);
        // 내부에 랜덤으로 32 Bytes 를 생성하여 ID를 생성하므로 무한반복될 가능성이 극히 낮음
        while (true) {
            const id = ContractUtils.getPaymentId(account, nonce);
            if (await (await this.getLedgerContract()).isAvailablePaymentId(id)) return id;
        }
    }

    /**
     * 사용자 정보 / 로열티 종류와 잔고를 제공하는 엔드포인트
     * GET /v1/payment/user/balance
     * @private
     */
    private async user_balance(req: express.Request, res: express.Response) {
        logger.http(`GET /v1/payment/user/balance`);

        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(200).json(ResponseMessage.getErrorMessage("2001", { validation: errors.array() }));
        }

        try {
            const account: string = String(req.query.account).trim();
            const loyaltyType = await (await this.getLedgerContract()).loyaltyTypeOf(account);
            const balance =
                loyaltyType === LoyaltyType.POINT
                    ? await (await this.getLedgerContract()).pointBalanceOf(account)
                    : await (await this.getLedgerContract()).tokenBalanceOf(account);
            return res
                .status(200)
                .json(this.makeResponseData(0, { account, loyaltyType, balance: balance.toString() }));
        } catch (error: any) {
            const msg = ResponseMessage.getEVMErrorMessage(error);
            logger.error(`GET /v1/payment/balance : ${msg.error.message}`);
            return res.status(200).json(this.makeResponseData(msg.code, undefined, msg.error));
        }
    }

    /**
     * 상점 정보 / 상점의 기본적인 정보를 제공하는 엔드포인트
     * GET /v1/payment/shop/info
     * @private
     */
    private async shop_info(req: express.Request, res: express.Response) {
        logger.http(`GET /v1/payment/shop/info`);

        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(200).json(ResponseMessage.getErrorMessage("2001", { validation: errors.array() }));
        }

        try {
            const shopId: string = String(req.query.shopId).trim();
            const info = await (await this.getShopContract()).shopOf(shopId);

            const shopInfo = {
                shopId: info.shopId,
                name: info.name,
                provideWaitTime: info.provideWaitTime.toNumber(),
                providePercent: info.provideWaitTime.toNumber(),
                status: info.status,
                account: info.account,
                providedPoint: info.providedPoint.toString(),
                usedPoint: info.usedPoint.toString(),
                settledPoint: info.settledPoint.toString(),
                withdrawnPoint: info.withdrawnPoint.toString(),
            };
            return res.status(200).json(this.makeResponseData(0, shopInfo));
        } catch (error: any) {
            const msg = ResponseMessage.getEVMErrorMessage(error);
            logger.error(`GET /v1/payment/shop/info : ${msg.error.message}`);
            return res.status(200).json(this.makeResponseData(msg.code, undefined, msg.error));
        }
    }

    /**
     * 상점 정보 / 상점의 기봊적인 정보를 제공하는 엔드포인트
     * GET /v1/payment/shop/withdrawal
     * @private
     */
    private async shop_withdrawal(req: express.Request, res: express.Response) {
        logger.http(`GET /v1/payment/shop/withdrawal`);

        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(200).json(ResponseMessage.getErrorMessage("2001", { validation: errors.array() }));
        }

        try {
            const shopId: string = String(req.query.shopId).trim();
            const info = await (await this.getShopContract()).shopOf(shopId);

            const status = info.withdrawData.status === WithdrawStatus.CLOSE ? "Closed" : "Opened";
            const shopWithdrawalInfo = {
                shopId: info.shopId,
                withdrawAmount: info.withdrawData.amount.toString(),
                withdrawStatus: status,
            };

            return res.status(200).json(this.makeResponseData(0, shopWithdrawalInfo));
        } catch (error: any) {
            const msg = ResponseMessage.getEVMErrorMessage(error);
            logger.error(`GET /v1/payment/shop/withdrawal : ${msg.error.message}`);
            return res.status(200).json(this.makeResponseData(msg.code, undefined, msg.error));
        }
    }

    /**
     * 결제 / 결제정보를 제공한다
     * GET /v1/payment/info
     * @private
     */
    private async payment_info(req: express.Request, res: express.Response) {
        logger.http(`GET /v1/payment/info`);

        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(200).json(ResponseMessage.getErrorMessage("2001", { validation: errors.array() }));
        }

        try {
            const account: string = String(req.query.account).trim();
            const amount: BigNumber = BigNumber.from(req.query.amount);
            const currency: string = String(req.query.currency).trim();
            const loyaltyType = await (await this.getLedgerContract()).loyaltyTypeOf(account);

            const feeRate = await (await this.getLedgerContract()).fee();
            const rate = await (await this.getCurrencyRateContract()).get(currency.toLowerCase());
            const multiple = await (await this.getCurrencyRateContract()).MULTIPLE();

            let balance: BigNumber;
            let paidPoint: BigNumber;
            let paidToken: BigNumber;
            let paidValue: BigNumber;
            let feePoint: BigNumber;
            let feeToken: BigNumber;
            let feeValue: BigNumber;
            let totalPoint: BigNumber;
            let totalToken: BigNumber;
            let totalValue: BigNumber;

            if (loyaltyType === LoyaltyType.POINT) {
                balance = await (await this.getLedgerContract()).pointBalanceOf(account);
                paidPoint = amount.mul(rate).div(multiple);
                feePoint = paidPoint.mul(feeRate).div(100);
                totalPoint = paidPoint.add(feePoint);
                paidToken = BigNumber.from(0);
                feeToken = BigNumber.from(0);
                totalToken = BigNumber.from(0);
            } else {
                balance = await (await this.getLedgerContract()).tokenBalanceOf(account);
                const symbol = await (await this.getTokenContract()).symbol();
                const tokenRate = await (await this.getCurrencyRateContract()).get(symbol);
                paidToken = amount.mul(rate).div(tokenRate);
                feeToken = paidToken.mul(feeRate).div(100);
                totalToken = paidToken.add(feeToken);
                paidPoint = BigNumber.from(0);
                feePoint = BigNumber.from(0);
                totalPoint = BigNumber.from(0);
            }
            paidValue = BigNumber.from(amount);
            feeValue = paidValue.mul(feeRate).div(100);
            totalValue = paidValue.add(feeValue);

            return res.status(200).json(
                this.makeResponseData(0, {
                    account,
                    loyaltyType,
                    amount: amount.toString(),
                    currency,
                    balance: balance.toString(),
                    paidPoint: paidPoint.toString(),
                    paidToken: paidToken.toString(),
                    paidValue: paidValue.toString(),
                    feePoint: feePoint.toString(),
                    feeToken: feeToken.toString(),
                    feeValue: feeValue.toString(),
                    totalPoint: totalPoint.toString(),
                    totalToken: totalToken.toString(),
                    totalValue: totalValue.toString(),
                    feeRate: feeRate / 100,
                })
            );
        } catch (error: any) {
            const msg = ResponseMessage.getEVMErrorMessage(error);
            logger.error(`GET /v1/payment/info : ${msg.error.message}`);
            return res.status(200).json(this.makeResponseData(msg.code, undefined, msg.error));
        }
    }

    /**
     * POST /v1/payment/new/open
     * @private
     */
    private async payment_new_open(req: express.Request, res: express.Response) {
        logger.http(`POST /v1/payment/new/open`);

        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(200).json(ResponseMessage.getErrorMessage("2001", { validation: errors.array() }));
        }

        try {
            const accessKey: string = String(req.body.accessKey).trim();
            if (accessKey !== this._config.relay.accessKey) {
                return res.json(ResponseMessage.getErrorMessage("2002"));
            }

            const purchaseId: string = String(req.body.purchaseId).trim();
            const amount: BigNumber = BigNumber.from(req.body.amount);
            const currency: string = String(req.body.currency).trim();
            const shopId: string = String(req.body.shopId).trim();
            const account: string = String(req.body.account).trim();

            const feeRate = await (await this.getLedgerContract()).fee();
            const rate = await (await this.getCurrencyRateContract()).get(currency.toLowerCase());
            const multiple = await (await this.getCurrencyRateContract()).MULTIPLE();

            let balance: BigNumber;
            let paidPoint: BigNumber;
            let paidToken: BigNumber;
            let paidValue: BigNumber;
            let feePoint: BigNumber;
            let feeToken: BigNumber;
            let feeValue: BigNumber;
            let totalPoint: BigNumber;
            let totalToken: BigNumber;
            let totalValue: BigNumber;

            const contract = await this.getLedgerContract();
            const loyaltyType = await contract.loyaltyTypeOf(account);
            if (loyaltyType === LoyaltyType.POINT) {
                balance = await contract.pointBalanceOf(account);
                paidPoint = amount.mul(rate).div(multiple);
                feePoint = paidPoint.mul(feeRate).div(100);
                totalPoint = paidPoint.add(feePoint);
                if (totalPoint.gt(balance)) {
                    return res.status(200).json(this.makeResponseData(401, null, { message: "Insufficient balance" }));
                }
                paidToken = BigNumber.from(0);
                feeToken = BigNumber.from(0);
                totalToken = BigNumber.from(0);
            } else {
                balance = await contract.tokenBalanceOf(account);
                const symbol = await (await this.getTokenContract()).symbol();
                const tokenRate = await (await this.getCurrencyRateContract()).get(symbol);
                paidToken = amount.mul(rate).div(tokenRate);
                feeToken = paidToken.mul(feeRate).div(100);
                totalToken = paidToken.add(feeToken);
                if (totalToken.gt(balance)) {
                    return res.status(200).json(this.makeResponseData(401, null, { message: "Insufficient balance" }));
                }
                paidPoint = BigNumber.from(0);
                feePoint = BigNumber.from(0);
                totalPoint = BigNumber.from(0);
            }
            paidValue = BigNumber.from(amount);
            feeValue = paidValue.mul(feeRate).div(100);
            totalValue = paidValue.add(feeValue);

            const paymentId = await this.getPaymentId(account);
            const item: LoyaltyPaymentTaskData = {
                paymentId,
                purchaseId,
                amount,
                currency,
                shopId,
                account,
                loyaltyType,
                paidPoint,
                paidToken,
                paidValue,
                feePoint,
                feeToken,
                feeValue,
                totalPoint,
                totalToken,
                totalValue,
                paymentStatus: LoyaltyPaymentTaskStatus.OPENED_NEW,
                openNewTimestamp: ContractUtils.getTimeStamp(),
                closeNewTimestamp: 0,
                openCancelTimestamp: 0,
                closeCancelTimestamp: 0,
            };
            await this._storage.postPayment(item);

            res.status(200).json(
                this.makeResponseData(0, {
                    paymentId: item.paymentId,
                    purchaseId: item.purchaseId,
                    amount: item.amount.toString(),
                    currency: item.currency,
                    shopId: item.shopId,
                    account: item.account,
                    loyaltyType: item.loyaltyType,
                    paidPoint: item.paidPoint.toString(),
                    paidToken: item.paidToken.toString(),
                    paidValue: item.paidValue.toString(),
                    feePoint: item.feePoint.toString(),
                    feeToken: item.feeToken.toString(),
                    feeValue: item.feeValue.toString(),
                    totalPoint: item.totalPoint.toString(),
                    totalToken: item.totalToken.toString(),
                    totalValue: item.totalValue.toString(),
                    paymentStatus: item.paymentStatus,
                    openNewTimestamp: item.openNewTimestamp,
                    closeNewTimestamp: item.closeNewTimestamp,
                    openCancelTimestamp: item.openCancelTimestamp,
                    closeCancelTimestamp: item.closeCancelTimestamp,
                })
            );

            /// 사용자에게 푸쉬 메세지 발송
            const title = "KIOS 결제 승인 요청";
            const contents: string[] = [];
            contents.push(`결제 금액 : ${new Amount(item.amount, 18).toBOAString()}`);
            contents.push(`결제 아이디 : ${item.paymentId}`);
            this._sender.send(title, contents.join("\n"));

            return;
        } catch (error: any) {
            const msg = ResponseMessage.getEVMErrorMessage(error);
            logger.error(`GET /v1/payment/new/open : ${msg.error.message}`);
            return res.status(200).json(msg);
        }
    }

    /**
     * POST /v1/payment/new/approval
     * @private
     */
    private async payment_new_approval(req: express.Request, res: express.Response) {
        logger.http(`POST /v1/payment/new/approval`);

        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(200).json(ResponseMessage.getErrorMessage("2001", { validation: errors.array() }));
        }

        const signerItem = await this.getRelaySigner();
        try {
            const paymentId: string = String(req.body.paymentId).trim();
            const approval: boolean = String(req.body.approval).trim().toLowerCase() === "true";
            const signature: string = String(req.body.signature).trim();
            const item = await this._storage.getPayment(paymentId);
            if (item === undefined) {
                return res.status(200).json(ResponseMessage.getErrorMessage("2003"));
            } else {
                if (item.paymentStatus !== LoyaltyPaymentTaskStatus.OPENED_NEW) {
                    return res.status(200).json(ResponseMessage.getErrorMessage("2020"));
                }

                if (
                    !ContractUtils.verifyLoyaltyNewPayment(
                        item.paymentId,
                        item.purchaseId,
                        item.amount,
                        item.currency,
                        item.shopId,
                        await (await this.getLedgerContract()).nonceOf(item.account),
                        item.account,
                        signature
                    )
                ) {
                    return res.status(200).json(ResponseMessage.getErrorMessage("1501"));
                }

                if (ContractUtils.getTimeStamp() - item.openNewTimestamp > this._config.relay.paymentTimeoutSecond) {
                    const data = ResponseMessage.getErrorMessage("7000");
                    res.status(200).json(data);

                    item.paymentStatus = LoyaltyPaymentTaskStatus.TIMEOUT;
                    await this._storage.updatePaymentStatus(item.paymentId, item.paymentStatus);

                    await this.sendPaymentResult(
                        TaskResultType.NEW,
                        TaskResultCode.TIMEOUT,
                        data.error.message,
                        this.getCallBackResponse(item)
                    );
                    return;
                }

                if (approval) {
                    const contract = await this.getLedgerContract();
                    try {
                        const tx = await contract.connect(signerItem.signer).openNewLoyaltyPayment({
                            paymentId: item.paymentId,
                            purchaseId: item.purchaseId,
                            amount: item.amount,
                            currency: item.currency.toLowerCase(),
                            shopId: item.shopId,
                            account: item.account,
                            signature,
                        });

                        item.paymentStatus = LoyaltyPaymentTaskStatus.CONFIRMED_NEW;
                        await this._storage.updatePaymentStatus(item.paymentId, item.paymentStatus);

                        res.status(200).json(
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

                        const event = await this.waitPaymentLoyalty(contract, tx);
                        if (event !== undefined) {
                            item.paymentStatus = LoyaltyPaymentTaskStatus.REPLY_COMPLETED_NEW;
                            this.updateEvent(event, item);
                            await this._storage.updatePayment(item);

                            await this.sendPaymentResult(
                                TaskResultType.NEW,
                                TaskResultCode.SUCCESS,
                                "Success",
                                this.getCallBackResponse(item)
                            );
                        }
                    } catch (error) {
                        const msg = ResponseMessage.getEVMErrorMessage(error);
                        logger.error(`POST /v1/payment/new/approval : ${msg.error.message}`);
                        return res.status(200).json(msg);
                    }
                } else {
                    item.paymentStatus = LoyaltyPaymentTaskStatus.DENIED_NEW;
                    await this._storage.updatePaymentStatus(item.paymentId, item.paymentStatus);

                    res.status(200).json(
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

                    await this.sendPaymentResult(
                        TaskResultType.NEW,
                        TaskResultCode.DENIED,
                        "Denied by user",
                        this.getCallBackResponse(item)
                    );
                }
            }
        } catch (error: any) {
            const msg = ResponseMessage.getEVMErrorMessage(error);
            logger.error(`POST /v1/payment/new/approval : ${msg.error.message}`);
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
        logger.http(`POST /v1/payment/new/close`);

        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(200).json(ResponseMessage.getErrorMessage("2001", { validation: errors.array() }));
        }

        const signerItem = await this.getRelaySigner();
        try {
            const accessKey: string = String(req.body.accessKey).trim();
            if (accessKey !== this._config.relay.accessKey) {
                return res.json(ResponseMessage.getErrorMessage("2002"));
            }

            const paymentId: string = String(req.body.paymentId).trim();
            const item = await this._storage.getPayment(paymentId);
            if (item === undefined) {
                return res.status(200).json(ResponseMessage.getErrorMessage("2003"));
            } else {
                if (
                    item.paymentStatus === LoyaltyPaymentTaskStatus.CONFIRMED_NEW ||
                    item.paymentStatus === LoyaltyPaymentTaskStatus.REPLY_COMPLETED_NEW
                ) {
                    const contract = await this.getLedgerContract();
                    const signature = await ContractUtils.signLoyaltyClosePayment(
                        signerItem.signer,
                        paymentId,
                        item.purchaseId,
                        true,
                        await contract.nonceOf(await signerItem.signer.getAddress())
                    );

                    try {
                        const tx = await contract
                            .connect(signerItem.signer)
                            .closeNewLoyaltyPayment(
                                item.paymentId,
                                true,
                                await signerItem.signer.getAddress(),
                                signature
                            );

                        const event = await this.waitPaymentLoyalty(contract, tx);
                        if (event !== undefined) {
                            item.paymentStatus = LoyaltyPaymentTaskStatus.CLOSED_NEW;
                            item.closeNewTimestamp = ContractUtils.getTimeStamp();
                            this.updateEvent(event, item);
                            await this._storage.updatePayment(item);

                            res.status(200).json(
                                this.makeResponseData(0, {
                                    paymentId: item.paymentId,
                                    purchaseId: item.purchaseId,
                                    amount: item.amount.toString(),
                                    currency: item.currency,
                                    shopId: item.shopId,
                                    account: item.account,
                                    loyaltyType: item.loyaltyType,
                                    paidPoint: item.paidPoint.toString(),
                                    paidToken: item.paidToken.toString(),
                                    paidValue: item.paidValue.toString(),
                                    feePoint: item.feePoint.toString(),
                                    feeToken: item.feeToken.toString(),
                                    feeValue: item.feeValue.toString(),
                                    totalPoint: item.totalPoint.toString(),
                                    totalToken: item.totalToken.toString(),
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
                        logger.error(`POST /v1/payment/new/close : ${msg.error.message}`);
                        return res.status(200).json(this.makeResponseData(msg.code, undefined, msg.error));
                    }
                } else if (item.paymentStatus === LoyaltyPaymentTaskStatus.DENIED_NEW) {
                    item.paymentStatus = LoyaltyPaymentTaskStatus.CLOSED_NEW;
                    item.closeNewTimestamp = ContractUtils.getTimeStamp();
                    await this._storage.updatePayment(item);

                    res.status(200).json(
                        this.makeResponseData(0, {
                            paymentId: item.paymentId,
                            purchaseId: item.purchaseId,
                            amount: item.amount.toString(),
                            currency: item.currency,
                            shopId: item.shopId,
                            account: item.account,
                            loyaltyType: item.loyaltyType,
                            paidPoint: item.paidPoint.toString(),
                            paidToken: item.paidToken.toString(),
                            paidValue: item.paidValue.toString(),
                            feePoint: item.feePoint.toString(),
                            feeToken: item.feeToken.toString(),
                            feeValue: item.feeValue.toString(),
                            totalPoint: item.totalPoint.toString(),
                            totalToken: item.totalToken.toString(),
                            totalValue: item.totalValue.toString(),
                            paymentStatus: item.paymentStatus,
                            openNewTimestamp: item.openNewTimestamp,
                            closeNewTimestamp: item.closeNewTimestamp,
                            openCancelTimestamp: item.openCancelTimestamp,
                            closeCancelTimestamp: item.closeCancelTimestamp,
                        })
                    );
                } else {
                    item.paymentStatus = LoyaltyPaymentTaskStatus.CLOSED_NEW;
                    item.closeNewTimestamp = ContractUtils.getTimeStamp();
                    await this._storage.updatePayment(item);

                    res.status(200).json(ResponseMessage.getErrorMessage("2024"));
                }
            }
        } catch (error: any) {
            const msg = ResponseMessage.getEVMErrorMessage(error);
            logger.error(`POST /v1/payment/new/close : ${msg.error.message}`);
            return res.status(200).json(msg);
        } finally {
            this.releaseRelaySigner(signerItem);
        }
    }

    /**
     * GET /v1/payment/item
     * @private
     */
    private async payment_item(req: express.Request, res: express.Response) {
        logger.http(`GET /v1/payment/item`);

        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(200).json(ResponseMessage.getErrorMessage("2001", { validation: errors.array() }));
        }

        try {
            const paymentId: string = String(req.query.paymentId).trim();
            const item = await this._storage.getPayment(paymentId);
            if (item === undefined) {
                return res.status(200).json(ResponseMessage.getErrorMessage("2003"));
            }
            return res.status(200).json(
                this.makeResponseData(0, {
                    paymentId: item.paymentId,
                    purchaseId: item.purchaseId,
                    amount: item.amount.toString(),
                    currency: item.currency,
                    shopId: item.shopId,
                    account: item.account,
                    loyaltyType: item.loyaltyType,
                    paidPoint: item.paidPoint.toString(),
                    paidToken: item.paidToken.toString(),
                    paidValue: item.paidValue.toString(),
                    feePoint: item.feePoint.toString(),
                    feeToken: item.feeToken.toString(),
                    feeValue: item.feeValue.toString(),
                    totalPoint: item.totalPoint.toString(),
                    totalToken: item.totalToken.toString(),
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
            return res.status(200).json(this.makeResponseData(msg.code, undefined, msg.error));
        }
    }

    /**
     * 결제 / 결제정보를 제공한다
     * POST /v1/payment/cancel/open
     * @private
     */
    private async payment_cancel_open(req: express.Request, res: express.Response) {
        logger.http(`POST /v1/payment/cancel/open`);

        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(200).json(ResponseMessage.getErrorMessage("2001", { validation: errors.array() }));
        }

        try {
            const accessKey: string = String(req.body.accessKey).trim();
            if (accessKey !== this._config.relay.accessKey) {
                return res.json(ResponseMessage.getErrorMessage("2002"));
            }

            const paymentId: string = String(req.body.paymentId).trim();
            const item = await this._storage.getPayment(paymentId);
            if (item === undefined) {
                return res.status(200).json(ResponseMessage.getErrorMessage("2003"));
            } else {
                if (item.paymentStatus !== LoyaltyPaymentTaskStatus.CLOSED_NEW) {
                    return res.status(200).json(ResponseMessage.getErrorMessage("2022"));
                }

                item.paymentStatus = LoyaltyPaymentTaskStatus.OPENED_CANCEL;
                await this._storage.updatePaymentStatus(item.paymentId, item.paymentStatus);

                item.openCancelTimestamp = ContractUtils.getTimeStamp();
                await this._storage.updateOpenCancelTimestamp(item.paymentId, item.openCancelTimestamp);

                res.status(200).json(
                    this.makeResponseData(0, {
                        paymentId: item.paymentId,
                        purchaseId: item.purchaseId,
                        amount: item.amount.toString(),
                        currency: item.currency,
                        shopId: item.shopId,
                        account: item.account,
                        loyaltyType: item.loyaltyType,
                        paidPoint: item.paidPoint.toString(),
                        paidToken: item.paidToken.toString(),
                        paidValue: item.paidValue.toString(),
                        feePoint: item.feePoint.toString(),
                        feeToken: item.feeToken.toString(),
                        feeValue: item.feeValue.toString(),
                        totalPoint: item.totalPoint.toString(),
                        totalToken: item.totalToken.toString(),
                        totalValue: item.totalValue.toString(),
                        paymentStatus: item.paymentStatus,
                        openNewTimestamp: item.openNewTimestamp,
                        closeNewTimestamp: item.closeNewTimestamp,
                        openCancelTimestamp: item.openCancelTimestamp,
                        closeCancelTimestamp: item.closeCancelTimestamp,
                    })
                );
            }

            const title = "KIOS 결제 취소 요청";
            const contents: string[] = [];
            contents.push(`결제 금액 : ${new Amount(item.amount, 18).toBOAString()}`);
            contents.push(`결제 아이디 : ${item.paymentId}`);
            this._sender.send(title, contents.join("\n"));
            return;
        } catch (error: any) {
            const msg = ResponseMessage.getEVMErrorMessage(error);
            logger.error(`POST /v1/payment/cancel/open : ${msg.error.message}`);
            return res.status(200).json(msg);
        }
    }

    /**
     * POST /v1/payment/cancel/approval
     * @private
     */
    private async payment_cancel_approval(req: express.Request, res: express.Response) {
        logger.http(`POST /v1/payment/cancel/approval`);

        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(200).json(ResponseMessage.getErrorMessage("2001", { validation: errors.array() }));
        }

        const signerItem = await this.getRelaySigner();
        try {
            const paymentId: string = String(req.body.paymentId).trim();
            const approval: boolean = String(req.body.approval).trim().toLowerCase() === "true";
            const signature: string = String(req.body.signature).trim();
            const item = await this._storage.getPayment(paymentId);
            if (item === undefined) {
                return res.status(200).json(ResponseMessage.getErrorMessage("2003"));
            } else {
                if (item.paymentStatus !== LoyaltyPaymentTaskStatus.OPENED_CANCEL) {
                    return res.status(200).json(ResponseMessage.getErrorMessage("2020"));
                }

                const shopContract = await this.getShopContract();
                const shopData = await shopContract.shopOf(item.shopId);

                if (
                    !ContractUtils.verifyLoyaltyCancelPayment(
                        item.paymentId,
                        item.purchaseId,
                        await (await this.getLedgerContract()).nonceOf(shopData.account),
                        shopData.account,
                        signature
                    )
                ) {
                    return res.status(200).json(ResponseMessage.getErrorMessage("1501"));
                }

                if (ContractUtils.getTimeStamp() - item.openCancelTimestamp > this._config.relay.paymentTimeoutSecond) {
                    const msg = ResponseMessage.getErrorMessage("7000");
                    res.status(200).json(msg);
                    item.paymentStatus = LoyaltyPaymentTaskStatus.TIMEOUT;
                    await this._storage.updatePaymentStatus(item.paymentId, item.paymentStatus);

                    await this.sendPaymentResult(
                        TaskResultType.CANCEL,
                        TaskResultCode.TIMEOUT,
                        msg.error.message,
                        this.getCallBackResponse(item)
                    );
                    return;
                }

                if (approval) {
                    const contract = await this.getLedgerContract();
                    try {
                        const tx = await contract
                            .connect(signerItem.signer)
                            .openCancelLoyaltyPayment(item.paymentId, signature);

                        item.paymentStatus = LoyaltyPaymentTaskStatus.CONFIRMED_CANCEL;
                        await this._storage.updatePaymentStatus(item.paymentId, item.paymentStatus);

                        res.status(200).json(
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
                        const event = await this.waitPaymentLoyalty(contract, tx);
                        if (event !== undefined) {
                            item.paymentStatus = LoyaltyPaymentTaskStatus.REPLY_COMPLETED_CANCEL;
                            this.updateEvent(event, item);
                            await this._storage.updatePayment(item);

                            await this.sendPaymentResult(
                                TaskResultType.CANCEL,
                                TaskResultCode.SUCCESS,
                                "Success",
                                this.getCallBackResponse(item)
                            );
                        }
                    } catch (error) {
                        const msg = ResponseMessage.getEVMErrorMessage(error);
                        logger.error(`POST /v1/payment/cancel/approval : ${msg.error.message}`);
                        return res.status(200).json(msg);
                    }
                } else {
                    item.paymentStatus = LoyaltyPaymentTaskStatus.DENIED_CANCEL;
                    await this._storage.updatePaymentStatus(item.paymentId, item.paymentStatus);

                    res.status(200).json(
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

                    await this.sendPaymentResult(
                        TaskResultType.CANCEL,
                        TaskResultCode.DENIED,
                        "Denied by user",
                        this.getCallBackResponse(item)
                    );
                }
            }
        } catch (error: any) {
            const msg = ResponseMessage.getEVMErrorMessage(error);
            logger.error(`POST /v1/payment/cancel/approval : ${msg.error.message}`);
            return res.status(200).json(msg);
        } finally {
            this.releaseRelaySigner(signerItem);
        }
    }

    /**
     * 결제 / 결제정보를 제공한다
     * POST /v1/payment/cancel/close
     * @private
     */
    private async payment_cancel_close(req: express.Request, res: express.Response) {
        logger.http(`POST /v1/payment/cancel/close`);

        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(200).json(ResponseMessage.getErrorMessage("2001", { validation: errors.array() }));
        }

        const signerItem = await this.getRelaySigner();
        try {
            const accessKey: string = String(req.body.accessKey).trim();
            if (accessKey !== this._config.relay.accessKey) {
                return res.json(ResponseMessage.getErrorMessage("2002"));
            }

            const paymentId: string = String(req.body.paymentId).trim();
            const item = await this._storage.getPayment(paymentId);
            if (item === undefined) {
                return res.status(200).json(ResponseMessage.getErrorMessage("2003"));
            } else {
                if (
                    item.paymentStatus === LoyaltyPaymentTaskStatus.CONFIRMED_CANCEL ||
                    item.paymentStatus === LoyaltyPaymentTaskStatus.REPLY_COMPLETED_CANCEL
                ) {
                    const contract = await this.getLedgerContract();
                    const signature = await ContractUtils.signLoyaltyClosePayment(
                        signerItem.signer,
                        paymentId,
                        item.purchaseId,
                        true,
                        await contract.nonceOf(await signerItem.signer.getAddress())
                    );

                    try {
                        const tx = await contract
                            .connect(signerItem.signer)
                            .closeCancelLoyaltyPayment(
                                item.paymentId,
                                true,
                                await signerItem.signer.getAddress(),
                                signature
                            );

                        const event = await this.waitPaymentLoyalty(contract, tx);
                        if (event !== undefined) {
                            item.paymentStatus = LoyaltyPaymentTaskStatus.CLOSED_CANCEL;
                            item.closeCancelTimestamp = ContractUtils.getTimeStamp();
                            this.updateEvent(event, item);
                            await this._storage.updatePayment(item);

                            res.status(200).json(
                                this.makeResponseData(0, {
                                    paymentId: item.paymentId,
                                    purchaseId: item.purchaseId,
                                    amount: item.amount.toString(),
                                    currency: item.currency,
                                    shopId: item.shopId,
                                    account: item.account,
                                    loyaltyType: item.loyaltyType,
                                    paidPoint: item.paidPoint.toString(),
                                    paidToken: item.paidToken.toString(),
                                    paidValue: item.paidValue.toString(),
                                    feePoint: item.feePoint.toString(),
                                    feeToken: item.feeToken.toString(),
                                    feeValue: item.feeValue.toString(),
                                    totalPoint: item.totalPoint.toString(),
                                    totalToken: item.totalToken.toString(),
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
                } else if (item.paymentStatus === LoyaltyPaymentTaskStatus.DENIED_CANCEL) {
                    item.paymentStatus = LoyaltyPaymentTaskStatus.CLOSED_CANCEL;
                    item.closeCancelTimestamp = ContractUtils.getTimeStamp();
                    await this._storage.updatePayment(item);

                    res.status(200).json(
                        this.makeResponseData(0, {
                            paymentId: item.paymentId,
                            purchaseId: item.purchaseId,
                            amount: item.amount.toString(),
                            currency: item.currency,
                            shopId: item.shopId,
                            account: item.account,
                            loyaltyType: item.loyaltyType,
                            paidPoint: item.paidPoint.toString(),
                            paidToken: item.paidToken.toString(),
                            paidValue: item.paidValue.toString(),
                            feePoint: item.feePoint.toString(),
                            feeToken: item.feeToken.toString(),
                            feeValue: item.feeValue.toString(),
                            totalPoint: item.totalPoint.toString(),
                            totalToken: item.totalToken.toString(),
                            totalValue: item.totalValue.toString(),
                            paymentStatus: item.paymentStatus,
                            openNewTimestamp: item.openNewTimestamp,
                            closeNewTimestamp: item.closeNewTimestamp,
                            openCancelTimestamp: item.openCancelTimestamp,
                            closeCancelTimestamp: item.closeCancelTimestamp,
                        })
                    );
                } else {
                    item.paymentStatus = LoyaltyPaymentTaskStatus.CLOSED_CANCEL;
                    item.closeCancelTimestamp = ContractUtils.getTimeStamp();
                    await this._storage.updatePayment(item);
                    return res.status(200).json(ResponseMessage.getErrorMessage("2024"));
                }
            }
        } catch (error: any) {
            const msg = ResponseMessage.getEVMErrorMessage(error);
            logger.error(`POST /v1/payment/cancel/close : ${msg.error.message}`);
            return res.status(200).json(msg);
        } finally {
            this.releaseRelaySigner(signerItem);
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
            loyaltyType: item.loyaltyType,
            paidPoint: item.paidPoint.toString(),
            paidToken: item.paidToken.toString(),
            paidValue: item.paidValue.toString(),
            feePoint: item.feePoint.toString(),
            feeToken: item.feeToken.toString(),
            feeValue: item.feeValue.toString(),
            totalPoint: item.totalPoint.toString(),
            totalToken: item.totalToken.toString(),
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
        item.loyaltyType = event.loyaltyType;
        item.paidPoint = event.paidPoint;
        item.paidToken = event.paidToken;
        item.paidValue = event.paidValue;
        item.feePoint = event.feePoint;
        item.feeToken = event.feeToken;
        item.feeValue = event.feeValue;
        item.totalPoint = event.totalPoint;
        item.totalToken = event.totalToken;
        item.totalValue = event.totalValue;
    }

    private async waitPaymentLoyalty(
        contract: Ledger,
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
            res.loyaltyType = parsedLog.args.payment.loyaltyType;
            res.paidPoint =
                parsedLog.args.payment.loyaltyType === LoyaltyType.POINT
                    ? BigNumber.from(parsedLog.args.payment.paidPoint)
                    : BigNumber.from(0);
            res.paidToken =
                parsedLog.args.payment.loyaltyType === LoyaltyType.TOKEN
                    ? BigNumber.from(parsedLog.args.payment.paidToken)
                    : BigNumber.from(0);
            res.paidValue = BigNumber.from(parsedLog.args.payment.paidValue);

            res.feePoint =
                parsedLog.args.payment.loyaltyType === LoyaltyType.POINT
                    ? BigNumber.from(parsedLog.args.payment.feePoint)
                    : BigNumber.from(0);
            res.feeToken =
                parsedLog.args.payment.loyaltyType === LoyaltyType.TOKEN
                    ? BigNumber.from(parsedLog.args.payment.feeToken)
                    : BigNumber.from(0);
            res.feeValue = BigNumber.from(parsedLog.args.payment.feeValue);

            res.status = BigNumber.from(parsedLog.args.payment.status);
            res.balance = BigNumber.from(parsedLog.args.balance);

            res.totalPoint = res.paidPoint.add(res.feePoint);
            res.totalToken = res.paidToken.add(res.feeToken);
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
            await client.post(this._config.relay.callbackEndpoint, {
                accessKey: this._config.relay.callbackAccessKey,
                type,
                code,
                message,
                data,
            });
        } catch (error) {
            if (error instanceof Error) {
                logger.error(`sendPaymentResult : ${error.message}`);
            } else {
                logger.error(`sendPaymentResult : ${JSON.stringify(error)}`);
            }
        }
    }
}
