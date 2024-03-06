import {
    BIP20DelegatedTransfer,
    CurrencyRate,
    Ledger,
    LoyaltyExchanger,
    PhoneLinkCollection,
    Shop,
} from "../../typechain-types";
import { Config } from "../common/Config";
import { logger } from "../common/Logger";
import { WebService } from "../service/WebService";

import { body, query, validationResult } from "express-validator";
import * as hre from "hardhat";

import express from "express";
import { GraphStorage } from "../storage/GraphStorage";
import { RelayStorage } from "../storage/RelayStorage";
import { ResponseMessage } from "../utils/Errors";

// tslint:disable-next-line:no-implicit-dependencies
import { BigNumber } from "@ethersproject/bignumber";
// tslint:disable-next-line:no-implicit-dependencies
import { AddressZero } from "@ethersproject/constants";

import { ContractLoyaltyType, GWI_UNIT, IStorePurchaseData, PHONE_NULL } from "../types";

export class StorePurchaseRouter {
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

    /**
     * ERC20 토큰 컨트랙트
     * @private
     */
    private _tokenContract: BIP20DelegatedTransfer | undefined;

    /**
     * 사용자의 원장 컨트랙트
     * @private
     */
    private _ledgerContract: Ledger | undefined;

    /**
     * 사용자의 원장 컨트랙트
     * @private
     */
    private _shopContract: Shop | undefined;

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
    private _graph: GraphStorage;

    /**
     *
     * @param service  WebService
     * @param config Configuration
     * @param storage
     * @param graph
     */
    constructor(service: WebService, config: Config, storage: RelayStorage, graph: GraphStorage) {
        this._web_service = service;
        this._config = config;

        this._storage = storage;
        this._graph = graph;
    }

    private get app(): express.Application {
        return this._web_service.app;
    }

    /**
     * ERC20 토큰 컨트랙트를 리턴한다.
     * 컨트랙트의 객체가 생성되지 않았다면 컨트랙트 주소를 이용하여 컨트랙트 객체를 생성한 후 반환한다.
     * @private
     */
    private async getTokenContract(): Promise<BIP20DelegatedTransfer> {
        if (this._tokenContract === undefined) {
            const tokenFactory = await hre.ethers.getContractFactory("BIP20DelegatedTransfer");
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

    private async getShopContract(): Promise<Shop> {
        if (this._shopContract === undefined) {
            const shopFactory = await hre.ethers.getContractFactory("Shop");
            this._shopContract = shopFactory.attach(this._config.contracts.shopAddress);
        }
        return this._shopContract;
    }

    private _exchangerContract: LoyaltyExchanger | undefined;
    private async getExchangerContract(): Promise<LoyaltyExchanger> {
        if (this._exchangerContract === undefined) {
            const factory = await hre.ethers.getContractFactory("LoyaltyExchanger");
            this._exchangerContract = factory.attach(this._config.contracts.exchangerAddress);
        }
        return this._exchangerContract;
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
            "/v1/purchase/save",
            [
                body("purchaseId").exists().not().isEmpty(),
                body("timestamp").exists().isNumeric(),
                body("waiting").exists().isNumeric(),
                body("account").exists().trim().isEthereumAddress(),
                body("phone")
                    .exists()
                    .trim()
                    .matches(/^(0x)[0-9a-f]{64}$/i),
                body("shopId")
                    .exists()
                    .trim()
                    .matches(/^(0x)[0-9a-f]{64}$/i),
                body("loyaltyValue").exists().trim().isNumeric(),
                body("currency").exists().not().isEmpty(),
            ],
            this.purchase_save.bind(this)
        );

        this.app.post(
            "/v1/purchase/cancel",
            [body("purchaseId").exists().not().isEmpty()],
            this.purchase_cancel.bind(this)
        );

        this.app.get(
            "/v1/purchase/user/provide",
            [query("account").exists().trim().isEthereumAddress()],
            this.purchase_user_provide.bind(this)
        );

        this.app.get(
            "/v1/purchase/user/provide/total",
            [query("account").exists().trim().isEthereumAddress()],
            this.purchase_user_provide_total.bind(this)
        );

        this.app.get(
            "/v1/purchase/shop/provide",
            [
                query("shopId")
                    .exists()
                    .trim()
                    .matches(/^(0x)[0-9a-f]{64}$/i),
            ],
            this.purchase_shop_provide.bind(this)
        );

        this.app.get(
            "/v1/purchase/shop/provide/total",
            [
                query("shopId")
                    .exists()
                    .trim()
                    .matches(/^(0x)[0-9a-f]{64}$/i),
            ],
            this.purchase_shop_provide_total.bind(this)
        );
    }

    /**
     * POST /v1/purchase/save
     * @private
     */
    private async purchase_save(req: express.Request, res: express.Response) {
        logger.http(`POST /v1/purchase/save ${req.ip}:${JSON.stringify(req.body)}`);

        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(200).json(ResponseMessage.getErrorMessage("2001", { validation: errors.array() }));
        }

        try {
            let accessKey = req.get("Authorization");
            if (accessKey === undefined) accessKey = String(req.body.accessKey).trim();
            if (accessKey !== this._config.relay.accessKey) {
                return res.json(ResponseMessage.getErrorMessage("2002"));
            }
            const loyaltyValue: BigNumber = BigNumber.from(String(req.body.loyaltyValue).trim());

            if (loyaltyValue.gt(0)) {
                const phone: string = String(req.body.phone).trim();
                const purchaseData: IStorePurchaseData = {
                    purchaseId: String(req.body.purchaseId).trim(),
                    timestamp: BigInt(String(req.body.timestamp).trim()),
                    waiting: BigInt(String(req.body.waiting).trim()),
                    account: String(req.body.account).trim(),
                    loyaltyType: ContractLoyaltyType.POINT,
                    currency: String(req.body.currency).trim(),
                    providePoint: BigNumber.from(0),
                    provideToken: BigNumber.from(0),
                    provideValue: BigNumber.from(loyaltyValue),
                    shopId: String(req.body.shopId).trim(),
                    shopCurrency: "",
                    shopProvidedAmount: BigNumber.from(0),
                };

                let loyaltyPoint: BigNumber;
                if (purchaseData.currency === "krw") {
                    loyaltyPoint = loyaltyValue;
                } else {
                    loyaltyPoint = await (
                        await this.getCurrencyRateContract()
                    ).convertCurrency(loyaltyValue, purchaseData.currency, "point");
                }
                if (purchaseData.account === AddressZero && phone.toLowerCase() !== PHONE_NULL) {
                    purchaseData.account = await (await this.getPhoneLinkerContract()).toAddress(phone);
                }

                if (purchaseData.account !== AddressZero) {
                    purchaseData.loyaltyType = await (
                        await this.getLedgerContract()
                    ).loyaltyTypeOf(purchaseData.account);
                    if (purchaseData.loyaltyType === ContractLoyaltyType.POINT) {
                        purchaseData.providePoint = BigNumber.from(loyaltyPoint);
                        purchaseData.provideToken = BigNumber.from(0);
                        purchaseData.provideValue = BigNumber.from(loyaltyValue);
                    } else {
                        purchaseData.providePoint = BigNumber.from(0);
                        purchaseData.provideToken = await (
                            await this.getCurrencyRateContract()
                        ).convertPointToToken(loyaltyPoint);
                        purchaseData.provideValue = BigNumber.from(loyaltyValue);
                    }
                    const shopInfo = await (await this.getShopContract()).shopOf(purchaseData.shopId);
                    purchaseData.shopCurrency = shopInfo.currency;
                    purchaseData.shopProvidedAmount = await (
                        await this.getCurrencyRateContract()
                    ).convertCurrency(loyaltyValue, purchaseData.currency, purchaseData.shopCurrency);
                }
                await this._storage.postStorePurchase(purchaseData);
            }
            return res.status(200).json(this.makeResponseData(0, {}));
        } catch (error: any) {
            const msg = ResponseMessage.getEVMErrorMessage(error);
            logger.error(`POST /v1/purchase/save : ${msg.error.message}`);
            return res.status(200).json(msg);
        }
    }

    /**
     * POST /v1/purchase/cancel
     * @private
     */
    private async purchase_cancel(req: express.Request, res: express.Response) {
        logger.http(`POST /v1/purchase/cancel ${req.ip}:${JSON.stringify(req.body)}`);

        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(200).json(ResponseMessage.getErrorMessage("2001", { validation: errors.array() }));
        }

        try {
            let accessKey = req.get("Authorization");
            if (accessKey === undefined) accessKey = String(req.body.accessKey).trim();
            if (accessKey !== this._config.relay.accessKey) {
                return res.json(ResponseMessage.getErrorMessage("2002"));
            }
            const purchaseId: string = String(req.body.purchaseId).trim();
            await this._storage.cancelStorePurchase(purchaseId);
            return res.status(200).json(this.makeResponseData(0, {}));
        } catch (error: any) {
            const msg = ResponseMessage.getEVMErrorMessage(error);
            logger.error(`POST /v1/purchase/cancel : ${msg.error.message}`);
            return res.status(200).json(msg);
        }
    }

    /**
     * GET /v1/purchase/user/provide
     * @private
     */
    private async purchase_user_provide(req: express.Request, res: express.Response) {
        logger.http(`GET /v1/purchase/user/provide ${req.ip}:${JSON.stringify(req.query)}`);

        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(200).json(ResponseMessage.getErrorMessage("2001", { validation: errors.array() }));
        }

        try {
            const account: string = String(req.query.account).trim();
            const data = await this._storage.getToBeProvideOfUser(account);
            return res.status(200).json(
                this.makeResponseData(
                    0,
                    data.map((m) => {
                        return {
                            account: m.account,
                            timestamp: m.timestamp.toString(),
                            loyaltyType: m.loyaltyType,
                            currency: m.currency,
                            providePoint: m.providePoint.toString(),
                            provideToken: m.provideToken.toString(),
                            provideValue: m.provideValue.toString(),
                            purchaseId: m.purchaseId,
                            shopId: m.shopId,
                        };
                    })
                )
            );
        } catch (error: any) {
            const msg = ResponseMessage.getEVMErrorMessage(error);
            logger.error(`GET /v1/purchase/user/provide : ${msg.error.message}`);
            return res.status(200).json(msg);
        }
    }

    /**
     * GET /v1/purchase/user/provide/total
     * @private
     */
    private async purchase_user_provide_total(req: express.Request, res: express.Response) {
        logger.http(`GET /v1/purchase/user/provide/total ${req.ip}:${JSON.stringify(req.query)}`);

        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(200).json(ResponseMessage.getErrorMessage("2001", { validation: errors.array() }));
        }

        try {
            const account: string = String(req.query.account).trim();
            const data = await this._storage.getTotalToBeProvideOfUser(account);
            const loyaltyType = await (await this.getLedgerContract()).loyaltyTypeOf(account);
            return res.status(200).json(
                this.makeResponseData(0, {
                    account,
                    loyaltyType,
                    providePoint: data.providePoint.toString(),
                    provideToken: data.provideToken.toString(),
                    provideValue: data.provideValue.toString(),
                })
            );
        } catch (error: any) {
            const msg = ResponseMessage.getEVMErrorMessage(error);
            logger.error(`GET /v1/purchase/user/provide/total : ${msg.error.message}`);
            return res.status(200).json(msg);
        }
    }

    /**
     * GET /v1/purchase/shop/provide
     * @private
     */
    private async purchase_shop_provide(req: express.Request, res: express.Response) {
        logger.http(`GET /v1/purchase/shop/provide ${req.ip}:${JSON.stringify(req.query)}`);

        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(200).json(ResponseMessage.getErrorMessage("2001", { validation: errors.array() }));
        }

        try {
            const shopId: string = String(req.query.shopId).trim();
            const data = await this._storage.getToBeProvideOfShop(shopId);
            return res.status(200).json(
                this.makeResponseData(
                    0,
                    data.map((m) => {
                        return {
                            shopId: m.shopId,
                            timestamp: m.timestamp.toString(),
                            currency: m.currency,
                            providedAmount: m.providedAmount.toString(),
                            purchaseId: m.purchaseId,
                        };
                    })
                )
            );
        } catch (error: any) {
            const msg = ResponseMessage.getEVMErrorMessage(error);
            logger.error(`GET /v1/purchase/shop/provide : ${msg.error.message}`);
            return res.status(200).json(msg);
        }
    }

    /**
     * GET /v1/purchase/shop/provide/total
     * @private
     */
    private async purchase_shop_provide_total(req: express.Request, res: express.Response) {
        logger.http(`GET /v1/purchase/shop/provide/total ${req.ip}:${JSON.stringify(req.query)}`);

        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(200).json(ResponseMessage.getErrorMessage("2001", { validation: errors.array() }));
        }

        try {
            const shopId: string = String(req.query.shopId).trim();
            const data = await this._storage.getTotalToBeProvideOfShop(shopId);
            return res.status(200).json(
                this.makeResponseData(0, {
                    shopId,
                    providedAmount: data.providedAmount.toString(),
                })
            );
        } catch (error: any) {
            const msg = ResponseMessage.getEVMErrorMessage(error);
            logger.error(`GET /v1/purchase/shop/provide/total : ${msg.error.message}`);
            return res.status(200).json(msg);
        }
    }
}
