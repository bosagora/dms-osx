import { CurrencyRate, Ledger, PhoneLinkCollection, ShopCollection, Token } from "../../typechain-types";
import { Config } from "../common/Config";
import { logger } from "../common/Logger";
import { WebService } from "../service/WebService";
import {
    LoyaltyPaymentInputDataStatus,
    LoyaltyPaymentInternalData,
    LoyaltyType,
    PaymentResultCode,
    PaymentResultData,
    PaymentResultType,
    WithdrawStatus,
} from "../types";
import { ContractUtils } from "../utils/ContractUtils";
import { Validation } from "../validation";

import { BigNumber } from "ethers";
import { body, query, validationResult } from "express-validator";
import * as hre from "hardhat";

import express from "express";
import { ISignerItem, RelaySigners } from "../contract/Signers";
import { RelayStorage } from "../storage/RelayStorage";
import { HTTPClient } from "../utils/Utils";

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

    /**
     *
     * @param service  WebService
     * @param config Configuration
     * @param storage
     * @param relaySigners
     */
    constructor(service: WebService, config: Config, storage: RelayStorage, relaySigners: RelaySigners) {
        this._web_service = service;
        this._config = config;

        this._storage = storage;
        this._relaySigners = relaySigners;
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

        this.app.post(
            "/v1/payment/info",
            [
                body("accessKey").exists(),
                body("account").exists().trim().isEthereumAddress(),
                body("amount").exists().custom(Validation.isAmount),
                body("currency").exists(),
            ],
            this.payment_info.bind(this)
        );

        this.app.post(
            "/v1/payment/create",
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
            this.payment_create.bind(this)
        );

        this.app.post("/v1/payment/create/item", [body("paymentId").exists()], this.payment_create_item.bind(this));

        this.app.post(
            "/v1/payment/create/confirm",
            [
                body("paymentId").exists(),
                body("signature")
                    .exists()
                    .matches(/^(0x)[0-9a-f]{130}$/i),
            ],
            this.payment_create_confirm.bind(this)
        );

        this.app.post(
            "/v1/payment/create/deny",
            [
                body("paymentId").exists(),
                body("signature")
                    .exists()
                    .matches(/^(0x)[0-9a-f]{130}$/i),
            ],
            this.payment_create_deny.bind(this)
        );

        this.app.post(
            "/v1/payment/cancel",
            [body("accessKey").exists(), body("paymentId").exists()],
            this.payment_cancel.bind(this)
        );

        this.app.post(
            "/v1/payment/cancel/confirm",
            [
                body("paymentId").exists(),
                body("signature")
                    .exists()
                    .matches(/^(0x)[0-9a-f]{130}$/i),
            ],
            this.payment_cancel_confirm.bind(this)
        );

        this.app.post(
            "/v1/payment/cancel/deny",
            [
                body("paymentId").exists(),
                body("signature")
                    .exists()
                    .matches(/^(0x)[0-9a-f]{130}$/i),
            ],
            this.payment_cancel_deny.bind(this)
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
            return res.status(200).json(
                this.makeResponseData(501, undefined, {
                    message: "Failed to check the validity of parameters.",
                    validation: errors.array(),
                })
            );
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
                .json(this.makeResponseData(200, { account, loyaltyType, balance: balance.toString() }));
        } catch (error: any) {
            let message = ContractUtils.cacheEVMError(error as any);
            if (message === "") message = "Failed /payment/balance";
            logger.error(`GET /payment/balance :`, message);
            return res.status(200).json(
                this.makeResponseData(500, undefined, {
                    message,
                })
            );
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
            return res.status(200).json(
                this.makeResponseData(501, undefined, {
                    message: "Failed to check the validity of parameters.",
                    validation: errors.array(),
                })
            );
        }

        try {
            const shopId: string = String(req.query.shopId).trim();
            const info = await (await this.getShopContract()).shopOf(shopId);

            const shopInfo = {
                shopId: info.shopId,
                name: info.name,
                provideWaitTime: info.provideWaitTime.toString(),
                providePercent: info.provideWaitTime.toString(),
                account: info.account,
                providedPoint: info.providedPoint.toString(),
                usedPoint: info.usedPoint.toString(),
                settledPoint: info.settledPoint.toString(),
                withdrawnPoint: info.withdrawnPoint.toString(),
            };
            return res.status(200).json(this.makeResponseData(200, shopInfo));
        } catch (error: any) {
            let message = ContractUtils.cacheEVMError(error as any);
            if (message === "") message = "Failed /v1/payment/shop/info";
            logger.error(`GET /v1/payment/shop/info :`, message);
            return res.status(200).json(
                this.makeResponseData(500, undefined, {
                    message,
                })
            );
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
            return res.status(200).json(
                this.makeResponseData(501, undefined, {
                    message: "Failed to check the validity of parameters.",
                    validation: errors.array(),
                })
            );
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

            return res.status(200).json(this.makeResponseData(200, shopWithdrawalInfo));
        } catch (error: any) {
            let message = ContractUtils.cacheEVMError(error as any);
            if (message === "") message = "Failed /v1/payment/shop/withdrawal";
            logger.error(`GET /v1/payment/shop/withdrawal :`, message);
            return res.status(200).json(
                this.makeResponseData(500, undefined, {
                    message,
                })
            );
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
            return res.status(200).json(
                this.makeResponseData(501, undefined, {
                    message: "Failed to check the validity of parameters.",
                    validation: errors.array(),
                })
            );
        }

        try {
            const accessKey: string = String(req.body.accessKey).trim();
            if (accessKey !== this._config.relay.accessKey) {
                return res.json(
                    this.makeResponseData(400, undefined, {
                        message: "The access key entered is not valid.",
                    })
                );
            }

            const account: string = String(req.body.account).trim();
            const amount: BigNumber = BigNumber.from(req.body.amount);
            const currency: string = String(req.body.currency).trim();
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
                this.makeResponseData(200, {
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
            let message = ContractUtils.cacheEVMError(error as any);
            if (message === "") message = "Failed /v1/payment/info";
            logger.error(`GET /v1/payment/info :`, message);
            return res.status(200).json(
                this.makeResponseData(500, undefined, {
                    message,
                })
            );
        }
    }

    /**
     * 결제 / 결제정보를 제공한다
     * GET /v1/payment/create
     * @private
     */
    private async payment_create(req: express.Request, res: express.Response) {
        logger.http(`GET /v1/payment/create`);

        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(200).json(
                this.makeResponseData(501, undefined, {
                    message: "Failed to check the validity of parameters.",
                    validation: errors.array(),
                })
            );
        }

        try {
            const accessKey: string = String(req.body.accessKey).trim();
            if (accessKey !== this._config.relay.accessKey) {
                return res.json(
                    this.makeResponseData(400, undefined, {
                        message: "The access key entered is not valid.",
                    })
                );
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

            const loyaltyType = await (await this.getLedgerContract()).loyaltyTypeOf(account);
            if (loyaltyType === LoyaltyType.POINT) {
                balance = await (await this.getLedgerContract()).pointBalanceOf(account);
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
                balance = await (await this.getLedgerContract()).tokenBalanceOf(account);
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
            const item: LoyaltyPaymentInternalData = {
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
                paymentStatus: LoyaltyPaymentInputDataStatus.CREATED,
                createTimestamp: ContractUtils.getTimeStamp(),
                cancelTimestamp: 0,
            };
            await this._storage.postPayment(
                item.paymentId,
                item.purchaseId,
                item.amount,
                item.currency,
                item.shopId,
                item.account,
                item.loyaltyType,
                item.paidPoint,
                item.paidToken,
                item.paidValue,
                item.feePoint,
                item.feeToken,
                item.feeValue,
                item.totalPoint,
                item.totalToken,
                item.totalValue,
                item.paymentStatus,
                item.createTimestamp
            );

            /// 사용자에게 푸쉬 메세지 발송 후 서명을 확인함

            return res.status(200).json(
                this.makeResponseData(200, {
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
                    createTimestamp: item.createTimestamp,
                })
            );
        } catch (error: any) {
            let message = ContractUtils.cacheEVMError(error as any);
            if (message === "") message = "Failed /v1/payment/create";
            logger.error(`GET /v1/payment/create :`, message);
            return res.status(200).json(
                this.makeResponseData(500, undefined, {
                    message,
                })
            );
        }
    }

    /**
     * GET /v1/payment/create/item
     * @private
     */
    private async payment_create_item(req: express.Request, res: express.Response) {
        logger.http(`GET /v1/payment/create/item`);

        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(200).json(
                this.makeResponseData(501, undefined, {
                    message: "Failed to check the validity of parameters.",
                    validation: errors.array(),
                })
            );
        }

        try {
            const paymentId: string = String(req.body.paymentId).trim();
            const item = await this._storage.getPayment(paymentId);
            if (item === undefined) {
                return res.status(200).json(
                    this.makeResponseData(402, undefined, {
                        message: "Payment ID is not exist ",
                    })
                );
            }
            return res.status(200).json(
                this.makeResponseData(200, {
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
                    createTimestamp: item.createTimestamp,
                })
            );
        } catch (error: any) {
            let message = ContractUtils.cacheEVMError(error as any);
            if (message === "") message = "Failed /v1/payment/create/item";
            logger.error(`GET /v1/payment/create/item :`, message);
            return res.status(200).json(
                this.makeResponseData(500, undefined, {
                    message,
                })
            );
        }
    }

    /**
     * GET /v1/payment/create/confirm
     * @private
     */
    private async payment_create_confirm(req: express.Request, res: express.Response) {
        logger.http(`GET /v1/payment/create/confirm`);

        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(200).json(
                this.makeResponseData(501, undefined, {
                    message: "Failed to check the validity of parameters.",
                    validation: errors.array(),
                })
            );
        }

        const signerItem = await this.getRelaySigner();
        try {
            const paymentId: string = String(req.body.paymentId).trim();
            const signature: string = String(req.body.signature).trim();
            const item = await this._storage.getPayment(paymentId);
            if (item === undefined) {
                res.status(200).json(
                    this.makeResponseData(401, undefined, {
                        message: "Payment ID is not exist.",
                    })
                );
                return;
            } else {
                if (item.paymentStatus !== LoyaltyPaymentInputDataStatus.CREATED) {
                    res.status(200).json(
                        this.makeResponseData(402, undefined, {
                            message: "This payment has already been closed.",
                        })
                    );
                    return;
                }

                if (
                    !ContractUtils.verifyLoyaltyPayment(
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
                    res.status(200).json(
                        this.makeResponseData(403, undefined, {
                            message: "The signature value entered is not valid.",
                        })
                    );
                    return;
                }

                const defaultResult: PaymentResultData = {
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
                };

                if (ContractUtils.getTimeStamp() - item.cancelTimestamp > this._config.relay.paymentTimeoutSecond) {
                    const message = "Timeout period expired";
                    res.status(200).json(
                        this.makeResponseData(404, undefined, {
                            message,
                        })
                    );

                    item.paymentStatus = LoyaltyPaymentInputDataStatus.TIMEOUT;
                    await this._storage.updatePaymentStatus(item.paymentId, item.paymentStatus);

                    await this.sendPaymentResult(
                        PaymentResultType.CREATE,
                        PaymentResultCode.TIMEOUT,
                        message,
                        defaultResult
                    );
                    return;
                }

                let success = true;
                const contract = await this.getLedgerContract();
                let tx: any;
                try {
                    tx = await contract.connect(signerItem.signer).createLoyaltyPayment({
                        paymentId: item.paymentId,
                        purchaseId: item.purchaseId,
                        amount: item.amount,
                        currency: item.currency.toLowerCase(),
                        shopId: item.shopId,
                        account: item.account,
                        signature,
                    });

                    item.paymentStatus = LoyaltyPaymentInputDataStatus.CREATE_CONFIRMED;
                    await this._storage.updatePaymentStatus(item.paymentId, item.paymentStatus);
                    res.status(200).json(
                        this.makeResponseData(200, {
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
                            createTimestamp: item.createTimestamp,
                            txHash: tx.hash,
                        })
                    );
                } catch (error) {
                    success = false;
                    const message = ContractUtils.cacheEVMError(error as any);
                    await this.sendPaymentResult(
                        PaymentResultType.CREATE,
                        PaymentResultCode.CONTRACT_ERROR,
                        `An error occurred while executing the contract. (${message})`,
                        defaultResult
                    );
                }

                if (success && tx !== undefined) {
                    const contractReceipt = await tx.wait();
                    const log = ContractUtils.findLog(contractReceipt, contract.interface, "CreatedLoyaltyPayment");
                    if (log !== undefined) {
                        const parsedLog = contract.interface.parseLog(log);
                        if (item.paymentId === parsedLog.args.paymentId) {
                            item.paidPoint =
                                parsedLog.args.loyaltyType === LoyaltyType.POINT
                                    ? BigNumber.from(parsedLog.args.paidPoint)
                                    : BigNumber.from(0);
                            item.paidToken =
                                parsedLog.args.loyaltyType === LoyaltyType.TOKEN
                                    ? BigNumber.from(parsedLog.args.paidToken)
                                    : BigNumber.from(0);
                            item.paidValue = BigNumber.from(parsedLog.args.paidValue);

                            item.feePoint =
                                parsedLog.args.loyaltyType === LoyaltyType.POINT
                                    ? BigNumber.from(parsedLog.args.feePoint)
                                    : BigNumber.from(0);
                            item.feeToken =
                                parsedLog.args.loyaltyType === LoyaltyType.TOKEN
                                    ? BigNumber.from(parsedLog.args.feeToken)
                                    : BigNumber.from(0);
                            item.feeValue = BigNumber.from(parsedLog.args.feeValue);

                            item.totalPoint = item.paidPoint.add(item.feePoint);
                            item.totalToken = item.paidToken.add(item.feeToken);
                            item.totalValue = item.paidValue.add(item.feeValue);

                            await this.sendPaymentResult(
                                PaymentResultType.CREATE,
                                PaymentResultCode.SUCCESS,
                                "The payment has been successfully completed.",
                                {
                                    paymentId: parsedLog.args.paymentId,
                                    purchaseId: parsedLog.args.purchaseId,
                                    amount: parsedLog.args.paidValue.toString(),
                                    currency: parsedLog.args.currency,
                                    account: parsedLog.args.account,
                                    shopId: parsedLog.args.shopId,
                                    loyaltyType: parsedLog.args.loyaltyType,
                                    paidPoint: item.paidPoint.toString(),
                                    paidToken: item.paidToken.toString(),
                                    paidValue: item.paidValue.toString(),
                                    feePoint: item.feePoint.toString(),
                                    feeToken: item.feeToken.toString(),
                                    feeValue: item.feeValue.toString(),
                                    totalPoint: item.totalPoint.toString(),
                                    totalToken: item.totalToken.toString(),
                                    totalValue: item.totalValue.toString(),
                                    balance: parsedLog.args.balance.toString(),
                                }
                            );
                            item.paymentStatus = LoyaltyPaymentInputDataStatus.CREATE_COMPLETE;
                            await this._storage.updatePaymentStatus(item.paymentId, item.paymentStatus);
                        } else {
                            await this.sendPaymentResult(
                                PaymentResultType.CREATE,
                                PaymentResultCode.INTERNAL_ERROR,
                                `An error occurred while executing the contract.`,
                                defaultResult
                            );
                        }
                    } else {
                        await this.sendPaymentResult(
                            PaymentResultType.CREATE,
                            PaymentResultCode.INTERNAL_ERROR,
                            `An error occurred while executing the contract.`,
                            defaultResult
                        );
                    }
                }
            }
        } catch (error: any) {
            let message = ContractUtils.cacheEVMError(error as any);
            if (message === "") message = "Failed /v1/payment/create/confirm";
            logger.error(`GET /v1/payment/create/confirm :`, message);
            return res.status(200).json(
                this.makeResponseData(500, undefined, {
                    message,
                })
            );
        } finally {
            this.releaseRelaySigner(signerItem);
        }
    }

    /**
     * GET /v1/payment/create/deny
     * @private
     */
    private async payment_create_deny(req: express.Request, res: express.Response) {
        logger.http(`GET /v1/payment/create/deny`);

        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(200).json(
                this.makeResponseData(501, undefined, {
                    message: "Failed to check the validity of parameters.",
                    validation: errors.array(),
                })
            );
        }

        try {
            const paymentId: string = String(req.body.paymentId).trim();
            const signature: string = String(req.body.signature).trim();
            const item = await this._storage.getPayment(paymentId);
            if (item === undefined) {
                return res.status(200).json(
                    this.makeResponseData(401, undefined, {
                        message: "Payment ID is not exist.",
                    })
                );
            } else {
                if (item.paymentStatus !== LoyaltyPaymentInputDataStatus.CREATED) {
                    res.status(200).json(
                        this.makeResponseData(402, undefined, {
                            message: "This payment has already been closed.",
                        })
                    );
                    return;
                }

                if (
                    !ContractUtils.verifyLoyaltyPayment(
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
                    res.status(200).json(
                        this.makeResponseData(403, undefined, {
                            message: "The signature value entered is not valid.",
                        })
                    );
                    return;
                }

                const defaultResult: PaymentResultData = {
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
                };

                if (ContractUtils.getTimeStamp() - item.createTimestamp > this._config.relay.paymentTimeoutSecond) {
                    const message = "Timeout period expired";
                    res.status(200).json(
                        this.makeResponseData(404, undefined, {
                            message,
                        })
                    );

                    item.paymentStatus = LoyaltyPaymentInputDataStatus.TIMEOUT;
                    await this._storage.updatePaymentStatus(item.paymentId, item.paymentStatus);

                    await this.sendPaymentResult(
                        PaymentResultType.CREATE,
                        PaymentResultCode.TIMEOUT,
                        message,
                        defaultResult
                    );
                    return;
                }

                item.paymentStatus = LoyaltyPaymentInputDataStatus.CREATE_DENIED;
                await this._storage.updatePaymentStatus(item.paymentId, item.paymentStatus);

                item.cancelTimestamp = ContractUtils.getTimeStamp();
                await this._storage.updateCancelTimestamp(item.paymentId, item.cancelTimestamp);

                res.status(200).json(
                    this.makeResponseData(200, {
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
                        createTimestamp: item.createTimestamp,
                    })
                );

                await this.sendPaymentResult(
                    PaymentResultType.CREATE,
                    PaymentResultCode.DENIED,
                    "The payment denied by user.",
                    defaultResult
                );
            }
        } catch (error: any) {
            let message = ContractUtils.cacheEVMError(error as any);
            if (message === "") message = "Failed /v1/payment/create/deny";
            logger.error(`GET /v1/payment/create/deny :`, message);
            return res.status(200).json(
                this.makeResponseData(500, undefined, {
                    message,
                })
            );
        }
    }

    /**
     * 결제 / 결제정보를 제공한다
     * GET /v1/payment/cancel
     * @private
     */
    private async payment_cancel(req: express.Request, res: express.Response) {
        logger.http(`GET /v1/payment/cancel`);

        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(200).json(
                this.makeResponseData(501, undefined, {
                    message: "Failed to check the validity of parameters.",
                    validation: errors.array(),
                })
            );
        }

        try {
            const accessKey: string = String(req.body.accessKey).trim();
            if (accessKey !== this._config.relay.accessKey) {
                return res.json(
                    this.makeResponseData(400, undefined, {
                        message: "The access key entered is not valid.",
                    })
                );
            }

            const paymentId: string = String(req.body.paymentId).trim();
            const item = await this._storage.getPayment(paymentId);
            if (item === undefined) {
                return res.status(200).json(
                    this.makeResponseData(401, undefined, {
                        message: "Payment ID is not exist.",
                    })
                );
            } else {
                if (item.paymentStatus !== LoyaltyPaymentInputDataStatus.CREATE_COMPLETE) {
                    res.status(200).json(
                        this.makeResponseData(402, undefined, {
                            message: "This payment has not been completed.",
                        })
                    );
                    return;
                }

                item.cancelTimestamp = LoyaltyPaymentInputDataStatus.CANCELED;
                item.paymentStatus = LoyaltyPaymentInputDataStatus.CANCELED;
                await this._storage.updatePaymentStatus(item.paymentId, item.paymentStatus);
                return res.status(200).json(
                    this.makeResponseData(200, {
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
                        createTimestamp: item.createTimestamp,
                    })
                );
            }
        } catch (error: any) {
            let message = ContractUtils.cacheEVMError(error as any);
            if (message === "") message = "Failed /v1/payment/cancel";
            logger.error(`GET /v1/payment/cancel :`, message);
            return res.status(200).json(
                this.makeResponseData(500, undefined, {
                    message,
                })
            );
        }
    }

    /**
     * GET /v1/payment/cancel/confirm
     * @private
     */
    private async payment_cancel_confirm(req: express.Request, res: express.Response) {
        logger.http(`GET /v1/payment/create/confirm`);

        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(200).json(
                this.makeResponseData(501, undefined, {
                    message: "Failed to check the validity of parameters.",
                    validation: errors.array(),
                })
            );
        }

        const signerItem = await this.getRelaySigner();
        try {
            const paymentId: string = String(req.body.paymentId).trim();
            const signature: string = String(req.body.signature).trim();
            const item = await this._storage.getPayment(paymentId);
            if (item === undefined) {
                res.status(200).json(
                    this.makeResponseData(401, undefined, {
                        message: "Payment ID is not exist.",
                    })
                );
                return;
            } else {
                if (item.paymentStatus !== LoyaltyPaymentInputDataStatus.CANCELED) {
                    res.status(200).json(
                        this.makeResponseData(402, undefined, {
                            message: "This payment is not in a cancellable state.",
                        })
                    );
                    return;
                }

                if (
                    !ContractUtils.verifyLoyaltyPaymentCancel(
                        item.paymentId,
                        item.purchaseId,
                        await (await this.getLedgerContract()).nonceOf(item.account),
                        item.account,
                        signature
                    )
                ) {
                    res.status(200).json(
                        this.makeResponseData(403, undefined, {
                            message: "The signature value entered is not valid.",
                        })
                    );
                    return;
                }

                const defaultResult: PaymentResultData = {
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
                };

                if (ContractUtils.getTimeStamp() - item.cancelTimestamp > this._config.relay.paymentTimeoutSecond) {
                    const message = "Timeout period expired";
                    res.status(200).json(
                        this.makeResponseData(404, undefined, {
                            message,
                        })
                    );

                    item.paymentStatus = LoyaltyPaymentInputDataStatus.TIMEOUT;
                    await this._storage.updatePaymentStatus(item.paymentId, item.paymentStatus);

                    await this.sendPaymentResult(
                        PaymentResultType.CANCEL,
                        PaymentResultCode.TIMEOUT,
                        message,
                        defaultResult
                    );
                    return;
                }

                const wallet = new hre.ethers.Wallet(this._config.relay.certifierKey);
                const certifierSignature = await ContractUtils.signLoyaltyPaymentCancel(
                    wallet,
                    item.paymentId,
                    item.purchaseId,
                    await (await this.getLedgerContract()).nonceOf(wallet.address)
                );

                let success = true;
                const contract = await this.getLedgerContract();
                let tx: any;
                try {
                    tx = await (await this.getLedgerContract()).connect(signerItem.signer).cancelLoyaltyPayment({
                        paymentId: item.paymentId,
                        purchaseId: item.purchaseId,
                        account: item.account,
                        signature,
                        certifierSignature,
                    });

                    item.paymentStatus = LoyaltyPaymentInputDataStatus.CANCEL_CONFIRMED;
                    await this._storage.updatePaymentStatus(item.paymentId, item.paymentStatus);
                    res.status(200).json(
                        this.makeResponseData(200, {
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
                            createTimestamp: item.createTimestamp,
                            txHash: tx.hash,
                        })
                    );
                } catch (error) {
                    success = false;
                    const message = ContractUtils.cacheEVMError(error as any);
                    await this.sendPaymentResult(
                        PaymentResultType.CANCEL,
                        PaymentResultCode.CONTRACT_ERROR,
                        `An error occurred while executing the contract. (${message})`,
                        defaultResult
                    );
                }

                if (success && tx !== undefined) {
                    const contractReceipt = await tx.wait();
                    const log = ContractUtils.findLog(contractReceipt, contract.interface, "CancelledLoyaltyPayment");
                    if (log !== undefined) {
                        const parsedLog = contract.interface.parseLog(log);
                        if (item.amount.eq(parsedLog.args.paidValue)) {
                            await this.sendPaymentResult(
                                PaymentResultType.CANCEL,
                                PaymentResultCode.SUCCESS,
                                "The cancellation has been successfully completed.",
                                {
                                    paymentId: parsedLog.args.paymentId,
                                    purchaseId: parsedLog.args.purchaseId,
                                    amount: parsedLog.args.paidValue.toString(),
                                    currency: parsedLog.args.currency,
                                    account: parsedLog.args.account,
                                    shopId: parsedLog.args.shopId,
                                    loyaltyType: parsedLog.args.loyaltyType,
                                    paidPoint: item.paidPoint.toString(),
                                    paidToken: item.paidToken.toString(),
                                    paidValue: item.paidValue.toString(),
                                    feePoint: item.feePoint.toString(),
                                    feeToken: item.feeToken.toString(),
                                    feeValue: item.feeValue.toString(),
                                    totalPoint: item.totalPoint.toString(),
                                    totalToken: item.totalToken.toString(),
                                    totalValue: item.totalValue.toString(),
                                    balance: parsedLog.args.balance.toString(),
                                }
                            );
                            item.paymentStatus = LoyaltyPaymentInputDataStatus.CANCEL_COMPLETE;
                            await this._storage.updatePaymentStatus(item.paymentId, item.paymentStatus);
                        } else {
                            await this.sendPaymentResult(
                                PaymentResultType.CANCEL,
                                PaymentResultCode.INTERNAL_ERROR,
                                `An error occurred while executing the contract.`,
                                defaultResult
                            );
                        }
                    } else {
                        await this.sendPaymentResult(
                            PaymentResultType.CANCEL,
                            PaymentResultCode.INTERNAL_ERROR,
                            `An error occurred while executing the contract.`,
                            defaultResult
                        );
                    }
                }
            }
        } catch (error: any) {
            let message = ContractUtils.cacheEVMError(error as any);
            if (message === "") message = "Failed /v1/payment/cancel/confirm";
            logger.error(`GET /v1/payment/cancel/confirm :`, message);
            return res.status(200).json(
                this.makeResponseData(500, undefined, {
                    message,
                })
            );
        } finally {
            this.releaseRelaySigner(signerItem);
        }
    }

    /**
     * GET /v1/payment/cancel/deny
     * @private
     */
    private async payment_cancel_deny(req: express.Request, res: express.Response) {
        logger.http(`GET /v1/payment/cancel/deny`);

        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(200).json(
                this.makeResponseData(501, undefined, {
                    message: "Failed to check the validity of parameters.",
                    validation: errors.array(),
                })
            );
        }

        try {
            const paymentId: string = String(req.body.paymentId).trim();
            const signature: string = String(req.body.signature).trim();
            const item = await this._storage.getPayment(paymentId);
            if (item === undefined) {
                return res.status(200).json(
                    this.makeResponseData(401, undefined, {
                        message: "Payment ID is not exist.",
                    })
                );
            } else {
                if (item.paymentStatus !== LoyaltyPaymentInputDataStatus.CANCELED) {
                    res.status(200).json(
                        this.makeResponseData(402, undefined, {
                            message: "This payment is not in a cancellable state.",
                        })
                    );
                    return;
                }

                if (
                    !ContractUtils.verifyLoyaltyPaymentCancel(
                        item.paymentId,
                        item.purchaseId,
                        await (await this.getLedgerContract()).nonceOf(item.account),
                        item.account,
                        signature
                    )
                ) {
                    res.status(200).json(
                        this.makeResponseData(403, undefined, {
                            message: "The signature value entered is not valid.",
                        })
                    );
                    return;
                }

                const defaultResult: PaymentResultData = {
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
                };

                if (ContractUtils.getTimeStamp() - item.cancelTimestamp > this._config.relay.paymentTimeoutSecond) {
                    const message = "Timeout period expired";
                    res.status(200).json(
                        this.makeResponseData(404, undefined, {
                            message,
                        })
                    );

                    item.paymentStatus = LoyaltyPaymentInputDataStatus.TIMEOUT;
                    await this._storage.updatePaymentStatus(item.paymentId, item.paymentStatus);

                    await this.sendPaymentResult(
                        PaymentResultType.CANCEL,
                        PaymentResultCode.TIMEOUT,
                        message,
                        defaultResult
                    );
                    return;
                }

                item.paymentStatus = LoyaltyPaymentInputDataStatus.CANCEL_DENIED;
                await this._storage.updatePaymentStatus(item.paymentId, item.paymentStatus);
                res.status(200).json(
                    this.makeResponseData(200, {
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
                        createTimestamp: item.createTimestamp,
                    })
                );

                await this.sendPaymentResult(
                    PaymentResultType.CANCEL,
                    PaymentResultCode.DENIED,
                    "The cancellation denied by user.",
                    defaultResult
                );
            }
        } catch (error: any) {
            let message = ContractUtils.cacheEVMError(error as any);
            if (message === "") message = "Failed /v1/payment/cancel/deny";
            logger.error(`GET /v1/payment/cancel/deny :`, message);
            return res.status(200).json(
                this.makeResponseData(500, undefined, {
                    message,
                })
            );
        }
    }

    private async sendPaymentResult(
        type: PaymentResultType,
        code: PaymentResultCode,
        message: string,
        data: PaymentResultData
    ) {
        const client = new HTTPClient();
        await client.post(this._config.relay.callbackEndpoint, {
            type,
            code,
            message,
            data,
        });
    }
}
