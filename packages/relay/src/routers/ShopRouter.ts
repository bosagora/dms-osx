import { CurrencyRate, Ledger, PhoneLinkCollection, ShopCollection, Token } from "../../typechain-types";
import { Config } from "../common/Config";
import { logger } from "../common/Logger";
import { WebService } from "../service/WebService";
import { ContractUtils } from "../utils/ContractUtils";
import { Validation } from "../validation";

import { body, validationResult } from "express-validator";
import * as hre from "hardhat";

import express from "express";
import { ISignerItem, RelaySigners } from "../contract/Signers";
import { RelayStorage } from "../storage/RelayStorage";

export class ShopRouter {
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
        this.app.post(
            "/v1/shop/add",
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
            "/v1/shop/update",
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
            "/v1/shop/remove",
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
            "/v1/shop/openWithdrawal",
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
            "/v1/shop/closeWithdrawal",
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

    /**
     * 상점을 추가한다.
     * POST /v1/shop/add
     * @private
     */
    private async shop_add(req: express.Request, res: express.Response) {
        logger.http(`POST /v1/shop/add`);

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

            logger.http(`TxHash(/v1/shop/add): `, tx.hash);
            return res.status(200).json(this.makeResponseData(200, { txHash: tx.hash }));
        } catch (error: any) {
            let message = ContractUtils.cacheEVMError(error as any);
            if (message === "") message = "Failed /v1/shop/add";
            logger.error(`POST /v1/shop/add :`, message);
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
     * POST /v1/shop/update
     * @private
     */
    private async shop_update(req: express.Request, res: express.Response) {
        logger.http(`POST /v1/shop/update`);

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

            logger.http(`TxHash(/v1/shop/update): `, tx.hash);
            return res.status(200).json(this.makeResponseData(200, { txHash: tx.hash }));
        } catch (error: any) {
            let message = ContractUtils.cacheEVMError(error as any);
            if (message === "") message = "Failed /v1/shop/update";
            logger.error(`POST /v1/shop/update :`, message);
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
     * POST /v1/shop/remove
     * @private
     */
    private async shop_remove(req: express.Request, res: express.Response) {
        logger.http(`POST /v1/shop/remove`);

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

            logger.http(`TxHash(/v1/shop/remove): `, tx.hash);
            return res.status(200).json(this.makeResponseData(200, { txHash: tx.hash }));
        } catch (error: any) {
            let message = ContractUtils.cacheEVMError(error as any);
            if (message === "") message = "Failed /v1/shop/remove";
            logger.error(`POST /v1/shop/remove :`, message);
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
     * POST /v1/shop/openWithdrawal
     * @private
     */
    private async shop_openWithdrawal(req: express.Request, res: express.Response) {
        logger.http(`POST /v1/shop/openWithdrawal`);

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

            logger.http(`TxHash(/v1/shop/openWithdrawal): `, tx.hash);
            return res.status(200).json(this.makeResponseData(200, { txHash: tx.hash }));
        } catch (error: any) {
            let message = ContractUtils.cacheEVMError(error as any);
            if (message === "") message = "Failed /v1/shop/openWithdrawal";
            logger.error(`POST /v1/shop/openWithdrawal :`, message);
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
     * POST /v1/shop/closeWithdrawal
     * @private
     */
    private async shop_closeWithdrawal(req: express.Request, res: express.Response) {
        logger.http(`POST /v1/shop/closeWithdrawal`);

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

            logger.http(`TxHash(/v1/shop/closeWithdrawal): `, tx.hash);
            return res.status(200).json(this.makeResponseData(200, { txHash: tx.hash }));
        } catch (error: any) {
            let message = ContractUtils.cacheEVMError(error as any);
            if (message === "") message = "Failed /v1/shop/closeWithdrawal";
            logger.error(`POST /v1/shop/closeWithdrawal :`, message);
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
