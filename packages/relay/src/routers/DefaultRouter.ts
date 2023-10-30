import { CurrencyRate, Ledger, PhoneLinkCollection, ShopCollection, Token } from "../../typechain-types";
import { Config } from "../common/Config";
import { logger } from "../common/Logger";
import { WebService } from "../service/WebService";
import { LoyaltyType } from "../types";
import { ContractUtils } from "../utils/ContractUtils";
import { Validation } from "../validation";

import { BigNumber } from "ethers";
import { body, query, validationResult } from "express-validator";
import * as hre from "hardhat";

import express from "express";
import { ISignerItem, RelaySigners } from "../contract/Signers";

export class DefaultRouter {
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

    /**
     *
     * @param service  WebService
     * @param config Configuration
     */
    constructor(service: WebService, config: Config, relaySigners: RelaySigners) {
        this._web_service = service;
        this._config = config;

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
        // Get Health Status
        this.app.get("/", [], this.getHealthStatus.bind(this));

        // 포인트를 이용하여 구매
        this.app.post(
            "/ledger/payPoint",
            [
                body("purchaseId").exists(),
                body("amount").exists().custom(Validation.isAmount),
                body("currency").exists(),
                body("shopId")
                    .exists()
                    .trim()
                    .matches(/^(0x)[0-9a-f]{64}$/i),
                body("account").exists().trim().isEthereumAddress(),
                body("signature")
                    .exists()
                    .trim()
                    .matches(/^(0x)[0-9a-f]{130}$/i),
            ],
            this.payPoint.bind(this)
        );

        // 토큰을 이용하여 구매할 때
        this.app.post(
            "/ledger/payToken",
            [
                body("purchaseId").exists(),
                body("amount").exists().trim().custom(Validation.isAmount),
                body("currency").exists(),
                body("shopId")
                    .exists()
                    .trim()
                    .matches(/^(0x)[0-9a-f]{64}$/i),
                body("account").exists().trim().isEthereumAddress(),
                body("signature")
                    .exists()
                    .trim()
                    .matches(/^(0x)[0-9a-f]{130}$/i),
            ],
            this.payToken.bind(this)
        );

        // 포인트의 종류를 선택하는 기능
        this.app.post(
            "/ledger/changeToLoyaltyToken",
            [
                body("account").exists().trim().isEthereumAddress(),
                body("signature")
                    .exists()
                    .trim()
                    .matches(/^(0x)[0-9a-f]{130}$/i),
            ],
            this.changeToLoyaltyToken.bind(this)
        );

        // 사용가능한 포인트로 전환
        this.app.post(
            "/ledger/changeToPayablePoint",
            [
                body("phone")
                    .exists()
                    .matches(/^(0x)[0-9a-f]{64}$/i),
                body("account").exists().trim().isEthereumAddress(),
                body("signature")
                    .exists()
                    .trim()
                    .matches(/^(0x)[0-9a-f]{130}$/i),
            ],
            this.changeToPayablePoint.bind(this)
        );

        this.app.post(
            "/shop/add",
            [
                body("shopId")
                    .exists()
                    .matches(/^(0x)[0-9a-f]{64}$/i),
                body("name").exists(),
                body("provideWaitTime").exists().trim().custom(Validation.isAmount),
                body("providePercent").exists().trim().custom(Validation.isAmount),
                body("account").exists().trim().isEthereumAddress(),
                body("signature")
                    .exists()
                    .trim()
                    .matches(/^(0x)[0-9a-f]{130}$/i),
            ],
            this.shop_add.bind(this)
        );
        this.app.post(
            "/shop/update",
            [
                body("shopId")
                    .exists()
                    .trim()
                    .matches(/^(0x)[0-9a-f]{64}$/i),
                body("name").exists(),
                body("provideWaitTime").exists().custom(Validation.isAmount),
                body("providePercent").exists().custom(Validation.isAmount),
                body("account").exists().trim().isEthereumAddress(),
                body("signature")
                    .exists()
                    .trim()
                    .matches(/^(0x)[0-9a-f]{130}$/i),
            ],
            this.shop_update.bind(this)
        );
        this.app.post(
            "/shop/remove",
            [
                body("shopId")
                    .exists()
                    .trim()
                    .matches(/^(0x)[0-9a-f]{64}$/i),
                body("account").exists().isEthereumAddress(),
                body("signature")
                    .exists()
                    .trim()
                    .matches(/^(0x)[0-9a-f]{130}$/i),
            ],
            this.shop_remove.bind(this)
        );
        this.app.post(
            "/shop/openWithdrawal",
            [
                body("shopId")
                    .exists()
                    .trim()
                    .matches(/^(0x)[0-9a-f]{64}$/i),
                body("amount").exists().custom(Validation.isAmount),
                body("account").exists().trim().isEthereumAddress(),
                body("signature")
                    .exists()
                    .trim()
                    .matches(/^(0x)[0-9a-f]{130}$/i),
            ],
            this.shop_openWithdrawal.bind(this)
        );
        this.app.post(
            "/shop/closeWithdrawal",
            [
                body("shopId")
                    .exists()
                    .trim()
                    .matches(/^(0x)[0-9a-f]{64}$/i),
                body("account").exists().trim().isEthereumAddress(),
                body("signature")
                    .exists()
                    .trim()
                    .matches(/^(0x)[0-9a-f]{130}$/i),
            ],
            this.shop_closeWithdrawal.bind(this)
        );
    }

    private async getHealthStatus(req: express.Request, res: express.Response) {
        return res.status(200).json("OK");
    }

    /**
     * 사용자 포인트 지불
     * POST /ledger/payPoint
     * @private
     */
    private async payPoint(req: express.Request, res: express.Response) {
        logger.http(`POST /ledger/payPoint`);

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
            const purchaseId: string = String(req.body.purchaseId).trim(); // 구매 아이디
            const amount: string = String(req.body.amount).trim(); // 구매 금액
            const currency: string = String(req.body.currency).toLowerCase().trim(); // 구매한 금액 통화코드
            const shopId: string = String(req.body.shopId).trim(); // 구매한 가맹점 아이디
            const account: string = String(req.body.account).trim(); // 구매자의 주소
            const signature: string = String(req.body.signature).trim(); // 서명

            // TODO amount > 0 조건 검사

            // 서명검증
            const userNonce = await (await this.getLedgerContract()).nonceOf(account);
            if (!ContractUtils.verifyPayment(purchaseId, amount, currency, shopId, account, userNonce, signature))
                return res.status(200).json(
                    this.makeResponseData(500, undefined, {
                        message: "Signature is not valid.",
                    })
                );

            const tx = await (await this.getLedgerContract())
                .connect(signerItem.signer)
                .payPoint({ purchaseId, amount, currency, shopId, account, signature });

            logger.http(`TxHash(payPoint): `, tx.hash);
            return res.status(200).json(this.makeResponseData(200, { txHash: tx.hash }));
        } catch (error: any) {
            let message = ContractUtils.cacheEVMError(error as any);
            if (message === "") message = "Failed pay point";
            logger.error(`POST /payPoint :`, message);
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
     * 사용자 토큰 지불
     * POST /ledger/payToken
     * @private
     */
    private async payToken(req: express.Request, res: express.Response) {
        logger.http(`POST /ledger/payToken`);

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
            const purchaseId: string = String(req.body.purchaseId).trim(); // 구매 아이디
            const amount: string = String(req.body.amount).trim(); // 구매 금액
            const currency: string = String(req.body.currency).toLowerCase().trim(); // 구매한 금액 통화코드
            const shopId: string = String(req.body.shopId).trim(); // 구매한 가맹점 아이디
            const account: string = String(req.body.account).trim(); // 구매자의 주소
            const signature: string = String(req.body.signature).trim(); // 서명

            // TODO amount > 0 조건 검사
            // 서명검증
            const userNonce = await (await this.getLedgerContract()).nonceOf(account);
            if (!ContractUtils.verifyPayment(purchaseId, amount, currency, shopId, account, userNonce, signature))
                return res.status(200).json(
                    this.makeResponseData(500, undefined, {
                        message: "Signature is not valid.",
                    })
                );

            const tx = await (await this.getLedgerContract())
                .connect(signerItem.signer)
                .payToken({ purchaseId, amount, currency, shopId, account, signature });

            logger.http(`TxHash(payToken): `, tx.hash);
            return res.status(200).json(this.makeResponseData(200, { txHash: tx.hash }));
        } catch (error: any) {
            let message = ContractUtils.cacheEVMError(error as any);
            if (message === "") message = "Failed pay token";
            logger.error(`POST /ledger/payToken :`, message);
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
     * 포인트의 종류를 선택한다.
     * POST /ledger/changeToLoyaltyToken
     * @private
     */
    private async changeToLoyaltyToken(req: express.Request, res: express.Response) {
        logger.http(`POST /ledger/changeToLoyaltyToken`);

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
            const account: string = String(req.body.account).trim(); // 구매자의 주소
            const signature: string = String(req.body.signature).trim(); // 서명

            // 서명검증
            const userNonce = await (await this.getLedgerContract()).nonceOf(account);
            if (!ContractUtils.verifyLoyaltyType(account, userNonce, signature))
                return res.status(200).json(
                    this.makeResponseData(500, undefined, {
                        message: "Signature is not valid.",
                    })
                );

            const tx = await (await this.getLedgerContract())
                .connect(signerItem.signer)
                .changeToLoyaltyToken(account, signature);

            logger.http(`TxHash(changeToLoyaltyToken): `, tx.hash);
            return res.status(200).json(this.makeResponseData(200, { txHash: tx.hash }));
        } catch (error: any) {
            let message = ContractUtils.cacheEVMError(error as any);
            if (message === "") message = "Failed change layalty type";
            logger.error(`POST /ledger/changeToLoyaltyToken :`, message);
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
     * 포인트의 종류를 선택한다.
     * POST /ledger/changeToPayablePoint
     * @private
     */
    private async changeToPayablePoint(req: express.Request, res: express.Response) {
        logger.http(`POST /ledger/changeToPayablePoint`);

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
            const phone: string = String(req.body.phone).trim();
            const account: string = String(req.body.account).trim(); // 구매자의 주소
            const signature: string = String(req.body.signature).trim(); // 서명

            // 서명검증
            const userNonce = await (await this.getLedgerContract()).nonceOf(account);
            if (!ContractUtils.verifyChangePayablePoint(phone, account, userNonce, signature))
                return res.status(200).json(
                    this.makeResponseData(500, undefined, {
                        message: "Signature is not valid.",
                    })
                );

            const tx = await (await this.getLedgerContract())
                .connect(signerItem.signer)
                .changeToPayablePoint(phone, account, signature);

            logger.http(`TxHash(changeToPayablePoint): `, tx.hash);
            return res.status(200).json(this.makeResponseData(200, { txHash: tx.hash }));
        } catch (error: any) {
            let message = ContractUtils.cacheEVMError(error as any);
            if (message === "") message = "Failed change to payable point";
            logger.error(`POST /ledger/changeToPayablePoint :`, message);
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
     * 상점을 추가한다.
     * POST /shop/add
     * @private
     */
    private async shop_add(req: express.Request, res: express.Response) {
        logger.http(`POST /shop/add`);

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
            const shopId: string = String(req.body.shopId).trim();
            const name: string = String(req.body.name).trim();
            const provideWaitTime: number = Number(req.body.provideWaitTime);
            const providePercent: number = Number(req.body.providePercent);
            const account: string = String(req.body.account).trim();
            const signature: string = String(req.body.signature).trim(); // 서명

            // 서명검증
            const nonce = await (await this.getShopContract()).nonceOf(account);
            if (!ContractUtils.verifyShop(shopId, name, provideWaitTime, providePercent, nonce, account, signature))
                return res.status(200).json(
                    this.makeResponseData(500, undefined, {
                        message: "Signature is not valid.",
                    })
                );

            const tx = await (await this.getShopContract())
                .connect(signerItem.signer)
                .add(shopId, name, provideWaitTime, providePercent, account, signature);

            logger.http(`TxHash(/shop/add): `, tx.hash);
            return res.status(200).json(this.makeResponseData(200, { txHash: tx.hash }));
        } catch (error: any) {
            let message = ContractUtils.cacheEVMError(error as any);
            if (message === "") message = "Failed /shop/add";
            logger.error(`POST /shop/add :`, message);
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
     * 상점정보를 수정한다.
     * POST /shop/update
     * @private
     */
    private async shop_update(req: express.Request, res: express.Response) {
        logger.http(`POST /shop/update`);

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
            const shopId: string = String(req.body.shopId).trim();
            const name: string = String(req.body.name).trim();
            const provideWaitTime: number = Number(String(req.body.provideWaitTime).trim());
            const providePercent: number = Number(String(req.body.providePercent).trim());
            const account: string = String(req.body.account).trim();
            const signature: string = String(req.body.signature).trim(); // 서명

            // 서명검증
            const nonce = await (await this.getShopContract()).nonceOf(account);
            if (!ContractUtils.verifyShop(shopId, name, provideWaitTime, providePercent, nonce, account, signature))
                return res.status(200).json(
                    this.makeResponseData(500, undefined, {
                        message: "Signature is not valid.",
                    })
                );

            const tx = await (await this.getShopContract())
                .connect(signerItem.signer)
                .update(shopId, name, provideWaitTime, providePercent, account, signature);

            logger.http(`TxHash(/shop/update): `, tx.hash);
            return res.status(200).json(this.makeResponseData(200, { txHash: tx.hash }));
        } catch (error: any) {
            let message = ContractUtils.cacheEVMError(error as any);
            if (message === "") message = "Failed /shop/update";
            logger.error(`POST /shop/update :`, message);
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
     * 상점정보를 삭제한다.
     * POST /shop/remove
     * @private
     */
    private async shop_remove(req: express.Request, res: express.Response) {
        logger.http(`POST /shop/remove`);

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
            const shopId: string = String(req.body.shopId).trim();
            const account: string = String(req.body.account).trim();
            const signature: string = String(req.body.signature).trim(); // 서명

            // 서명검증
            const nonce = await (await this.getShopContract()).nonceOf(account);
            if (!ContractUtils.verifyShopId(shopId, nonce, account, signature))
                return res.status(200).json(
                    this.makeResponseData(500, undefined, {
                        message: "Signature is not valid.",
                    })
                );

            const tx = await (await this.getShopContract())
                .connect(signerItem.signer)
                .remove(shopId, account, signature);

            logger.http(`TxHash(/shop/remove): `, tx.hash);
            return res.status(200).json(this.makeResponseData(200, { txHash: tx.hash }));
        } catch (error: any) {
            let message = ContractUtils.cacheEVMError(error as any);
            if (message === "") message = "Failed /shop/remove";
            logger.error(`POST /shop/remove :`, message);
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
     * 상점 정산금을 인출 신청한다.
     * POST /shop/openWithdrawal
     * @private
     */
    private async shop_openWithdrawal(req: express.Request, res: express.Response) {
        logger.http(`POST /shop/openWithdrawal`);

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
            const shopId: string = String(req.body.shopId).trim();
            const amount: string = String(req.body.amount).trim(); // 구매 금액
            const account: string = String(req.body.account).trim();
            const signature: string = String(req.body.signature).trim(); // 서명

            // 서명검증
            const nonce = await (await this.getShopContract()).nonceOf(account);
            if (!ContractUtils.verifyShopId(shopId, nonce, account, signature))
                return res.status(200).json(
                    this.makeResponseData(500, undefined, {
                        message: "Signature is not valid.",
                    })
                );

            const tx = await (await this.getShopContract())
                .connect(signerItem.signer)
                .openWithdrawal(shopId, amount, account, signature);

            logger.http(`TxHash(/shop/openWithdrawal): `, tx.hash);
            return res.status(200).json(this.makeResponseData(200, { txHash: tx.hash }));
        } catch (error: any) {
            let message = ContractUtils.cacheEVMError(error as any);
            if (message === "") message = "Failed /shop/openWithdrawal";
            logger.error(`POST /shop/openWithdrawal :`, message);
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
     * 상점 정산금을 인출을 받은것을 확인한다.
     * POST /shop/closeWithdrawal
     * @private
     */
    private async shop_closeWithdrawal(req: express.Request, res: express.Response) {
        logger.http(`POST /shop/closeWithdrawal`);

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
            const shopId: string = String(req.body.shopId).trim();
            const account: string = String(req.body.account).trim();
            const signature: string = String(req.body.signature).trim(); // 서명

            // 서명검증
            const nonce = await (await this.getShopContract()).nonceOf(account);
            if (!ContractUtils.verifyShopId(shopId, nonce, account, signature))
                return res.status(200).json(
                    this.makeResponseData(500, undefined, {
                        message: "Signature is not valid.",
                    })
                );

            const tx = await (await this.getShopContract())
                .connect(signerItem.signer)
                .closeWithdrawal(shopId, account, signature);

            logger.http(`TxHash(/shop/closeWithdrawal): `, tx.hash);
            return res.status(200).json(this.makeResponseData(200, { txHash: tx.hash }));
        } catch (error: any) {
            let message = ContractUtils.cacheEVMError(error as any);
            if (message === "") message = "Failed /shop/closeWithdrawal";
            logger.error(`POST /shop/closeWithdrawal :`, message);
            return res.status(200).json(
                this.makeResponseData(500, undefined, {
                    message,
                })
            );
        } finally {
            this.releaseRelaySigner(signerItem);
        }
    }
}
