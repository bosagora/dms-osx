import { CurrencyRate, Ledger, PhoneLinkCollection, ShopCollection, Token } from "../../typechain-types";
import { Config } from "../common/Config";
import { logger } from "../common/Logger";
import { WebService } from "../service/WebService";
import { LoyaltyPaymentInputDataStatus, LoyaltyType, WithdrawStatus } from "../types";
import { ContractUtils } from "../utils/ContractUtils";
import { Validation } from "../validation";

import { BigNumber } from "ethers";
import { body, query, validationResult } from "express-validator";
import * as hre from "hardhat";

import express from "express";
import { ISignerItem, RelaySigners } from "../contract/Signers";

export interface LoyaltyPaymentInputData {
    paymentId: string;
    purchaseId: string;
    amount: BigNumber;
    currency: string;
    shopId: string;
    account: string;
    loyaltyType: LoyaltyType;
    purchaseAmount: BigNumber;
    feeAmount: BigNumber;
    totalAmount: BigNumber;
    paymentStatus: LoyaltyPaymentInputDataStatus;
}

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

    private payments: Map<string, LoyaltyPaymentInputData>;

    /**
     *
     * @param service  WebService
     * @param config Configuration
     */
    constructor(service: WebService, config: Config, relaySigners: RelaySigners) {
        this._web_service = service;
        this._config = config;

        this._relaySigners = relaySigners;
        this.payments = new Map<string, LoyaltyPaymentInputData>();
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
            let purchaseAmount: BigNumber;
            let feeAmount: BigNumber;
            let totalAmount: BigNumber;

            if (loyaltyType === LoyaltyType.POINT) {
                balance = await (await this.getLedgerContract()).pointBalanceOf(account);
                purchaseAmount = amount.mul(rate).div(multiple);
                feeAmount = purchaseAmount.mul(feeRate).div(100);
                totalAmount = purchaseAmount.add(feeAmount);
            } else {
                balance = await (await this.getLedgerContract()).tokenBalanceOf(account);
                const symbol = await (await this.getTokenContract()).symbol();
                const tokenRate = await (await this.getCurrencyRateContract()).get(symbol);
                purchaseAmount = amount.mul(rate).div(tokenRate);
                feeAmount = purchaseAmount.mul(feeRate).div(100);
                totalAmount = purchaseAmount.add(feeAmount);
            }

            return res.status(200).json(
                this.makeResponseData(200, {
                    account,
                    loyaltyType,
                    amount: amount.toString(),
                    currency,
                    balance: balance.toString(),
                    purchaseAmount: purchaseAmount.toString(),
                    feeAmount: feeAmount.toString(),
                    totalAmount: totalAmount.toString(),
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
            let purchaseAmount: BigNumber;
            let feeAmount: BigNumber;
            let totalAmount: BigNumber;

            const loyaltyType = await (await this.getLedgerContract()).loyaltyTypeOf(account);
            if (loyaltyType === LoyaltyType.POINT) {
                balance = await (await this.getLedgerContract()).pointBalanceOf(account);
                purchaseAmount = amount.mul(rate).div(multiple);
                feeAmount = purchaseAmount.mul(feeRate).div(100);
                totalAmount = purchaseAmount.add(feeAmount);
            } else {
                balance = await (await this.getLedgerContract()).tokenBalanceOf(account);
                const symbol = await (await this.getTokenContract()).symbol();
                const tokenRate = await (await this.getCurrencyRateContract()).get(symbol);
                purchaseAmount = amount.mul(rate).div(tokenRate);
                feeAmount = purchaseAmount.mul(feeRate).div(100);
                totalAmount = purchaseAmount.add(feeAmount);
            }

            if (totalAmount.gt(balance)) {
                return res.status(200).json(this.makeResponseData(401, null, { message: "Insufficient balance" }));
            }

            const paymentId = await this.getPaymentId(account);
            const item = {
                paymentId,
                purchaseId,
                amount,
                currency,
                shopId,
                account,
                loyaltyType,
                purchaseAmount,
                feeAmount,
                totalAmount,
                paymentStatus: LoyaltyPaymentInputDataStatus.NULL,
            };
            this.payments.set(paymentId, item);

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
                    purchaseAmount: item.purchaseAmount.toString(),
                    feeAmount: item.feeAmount.toString(),
                    totalAmount: item.totalAmount.toString(),
                    paymentStatus: item.paymentStatus,
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
            const item = this.payments.get(paymentId);
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
                    purchaseAmount: item.purchaseAmount.toString(),
                    feeAmount: item.feeAmount.toString(),
                    totalAmount: item.totalAmount.toString(),
                    paymentStatus: item.paymentStatus,
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
            const item = this.payments.get(paymentId);
            if (item === undefined) {
                res.status(200).json(
                    this.makeResponseData(401, undefined, {
                        message: "Payment ID is not exist.",
                    })
                );
                return;
            } else {
                if (item.paymentStatus !== LoyaltyPaymentInputDataStatus.NULL) {
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

                const tx = await (await this.getLedgerContract()).connect(signerItem.signer).createLoyaltyPayment({
                    paymentId: item.paymentId,
                    purchaseId: item.purchaseId,
                    amount: item.amount,
                    currency: item.currency.toLowerCase(),
                    shopId: item.shopId,
                    account: item.account,
                    signature,
                });
                item.paymentStatus = LoyaltyPaymentInputDataStatus.CONFIRMED;
                return res.status(200).json(
                    this.makeResponseData(200, {
                        paymentId: item.paymentId,
                        purchaseId: item.purchaseId,
                        amount: item.amount.toString(),
                        currency: item.currency,
                        shopId: item.shopId,
                        account: item.account,
                        loyaltyType: item.loyaltyType,
                        purchaseAmount: item.purchaseAmount.toString(),
                        feeAmount: item.feeAmount.toString(),
                        totalAmount: item.totalAmount.toString(),
                        paymentStatus: item.paymentStatus,
                        txHash: tx.hash,
                    })
                );
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
            const item = this.payments.get(paymentId);
            if (item === undefined) {
                return res.status(200).json(
                    this.makeResponseData(401, undefined, {
                        message: "Payment ID is not exist.",
                    })
                );
            } else {
                if (item.paymentStatus !== LoyaltyPaymentInputDataStatus.NULL) {
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

                item.paymentStatus = LoyaltyPaymentInputDataStatus.DENIED;
                return res.status(200).json(
                    this.makeResponseData(200, {
                        paymentId: item.paymentId,
                        purchaseId: item.purchaseId,
                        amount: item.amount.toString(),
                        currency: item.currency,
                        shopId: item.shopId,
                        account: item.account,
                        loyaltyType: item.loyaltyType,
                        purchaseAmount: item.purchaseAmount.toString(),
                        feeAmount: item.feeAmount.toString(),
                        totalAmount: item.totalAmount.toString(),
                        paymentStatus: item.paymentStatus,
                    })
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
}
