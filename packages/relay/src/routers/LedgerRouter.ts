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
import { ContractUtils } from "../utils/ContractUtils";

import { body, param, validationResult } from "express-validator";
import * as hre from "hardhat";

import express from "express";
import { ISignerItem, RelaySigners } from "../contract/Signers";
import { GraphStorage } from "../storage/GraphStorage";
import { RelayStorage } from "../storage/RelayStorage";
import { ResponseMessage } from "../utils/Errors";
import { Metrics } from "../metrics/Metrics";

export class LedgerRouter {
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

    private readonly _metrics: Metrics;

    private readonly _relaySigners: RelaySigners;

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
     * @param metrics Metrics
     * @param storage
     * @param graph
     * @param relaySigners
     */
    constructor(
        service: WebService,
        config: Config,
        metrics: Metrics,
        storage: RelayStorage,
        graph: GraphStorage,
        relaySigners: RelaySigners
    ) {
        this._web_service = service;
        this._config = config;
        this._metrics = metrics;

        this._storage = storage;
        this._graph = graph;
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
        this.app.get(
            "/v1/ledger/nonce/:account",
            [param("account").exists().trim().isEthereumAddress()],
            this.getNonce.bind(this)
        );

        // 포인트의 종류를 선택하는 기능
        this.app.post(
            "/v1/ledger/changeToLoyaltyToken",
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
            "/v1/ledger/changeToPayablePoint",
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

        // 포인트의 종류를 선택하는 기능
        this.app.post(
            "/v1/ledger/removePhoneInfo",
            [
                body("account").exists().trim().isEthereumAddress(),
                body("signature")
                    .exists()
                    .trim()
                    .matches(/^(0x)[0-9a-f]{130}$/i),
            ],
            this.removePhoneInfoOfLedger.bind(this)
        );
    }

    private async getNonce(req: express.Request, res: express.Response) {
        logger.http(`GET /v1/ledge/nonce ${req.ip}:${JSON.stringify(req.params)}`);
        const account: string = String(req.params.account).trim();
        const nonce = await (await this.getLedgerContract()).nonceOf(account);
        this._metrics.add("success", 1);
        return res.status(200).json(this.makeResponseData(0, { account, nonce: nonce.toString() }));
    }

    /**
     * 포인트의 종류를 선택한다.
     * POST /v1/ledger/changeToLoyaltyToken
     * @private
     */
    private async changeToLoyaltyToken(req: express.Request, res: express.Response) {
        logger.http(`POST /v1/ledger/changeToLoyaltyToken ${req.ip}:${JSON.stringify(req.body)}`);

        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(200).json(ResponseMessage.getErrorMessage("2001", { validation: errors.array() }));
        }

        const signerItem = await this.getRelaySigner();
        try {
            const account: string = String(req.body.account).trim(); // 구매자의 주소
            const signature: string = String(req.body.signature).trim(); // 서명

            // 서명검증
            const userNonce = await (await this.getLedgerContract()).nonceOf(account);
            if (!ContractUtils.verifyLoyaltyType(account, userNonce, signature))
                return res.status(200).json(ResponseMessage.getErrorMessage("1501"));

            const tx = await (await this.getExchangerContract())
                .connect(signerItem.signer)
                .changeToLoyaltyToken(account, signature);

            logger.http(`TxHash(changeToLoyaltyToken): ${tx.hash}`);
            this._metrics.add("success", 1);
            return res.status(200).json(this.makeResponseData(0, { txHash: tx.hash }));
        } catch (error: any) {
            const msg = ResponseMessage.getEVMErrorMessage(error);
            logger.error(`POST /v1/ledger/changeToLoyaltyToken : ${msg.error.message}`);
            this._metrics.add("failure", 1);
            return res.status(200).json(msg);
        } finally {
            this.releaseRelaySigner(signerItem);
        }
    }

    /**
     * 포인트의 종류를 선택한다.
     * POST /v1/ledger/changeToPayablePoint
     * @private
     */
    private async changeToPayablePoint(req: express.Request, res: express.Response) {
        logger.http(`POST /v1/ledger/changeToPayablePoint ${req.ip}:${JSON.stringify(req.body)}`);

        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(200).json(ResponseMessage.getErrorMessage("2001", { validation: errors.array() }));
        }

        const signerItem = await this.getRelaySigner();
        try {
            const phone: string = String(req.body.phone).trim();
            const account: string = String(req.body.account).trim(); // 구매자의 주소
            const signature: string = String(req.body.signature).trim(); // 서명

            // 서명검증
            const userNonce = await (await this.getLedgerContract()).nonceOf(account);
            if (!ContractUtils.verifyChangePayablePoint(phone, account, userNonce, signature))
                return res.status(200).json(ResponseMessage.getErrorMessage("1501"));

            const tx = await (await this.getExchangerContract())
                .connect(signerItem.signer)
                .changeToPayablePoint(phone, account, signature);

            logger.http(`TxHash(changeToPayablePoint): ${tx.hash}`);
            this._metrics.add("success", 1);
            return res.status(200).json(this.makeResponseData(0, { txHash: tx.hash }));
        } catch (error: any) {
            const msg = ResponseMessage.getEVMErrorMessage(error);
            logger.error(`POST /v1/ledger/changeToPayablePoint : ${msg.error.message}`);
            this._metrics.add("failure", 1);
            return res.status(200).json(msg);
        } finally {
            this.releaseRelaySigner(signerItem);
        }
    }

    /**
     * 포인트의 종류를 선택한다.
     * POST /v1/ledger/removePhoneInfo
     * @private
     */
    private async removePhoneInfoOfLedger(req: express.Request, res: express.Response) {
        logger.http(`POST /v1/ledger/removePhoneInfo ${req.ip}:${JSON.stringify(req.body)}`);

        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(200).json(ResponseMessage.getErrorMessage("2001", { validation: errors.array() }));
        }

        const signerItem = await this.getRelaySigner();
        try {
            const account: string = String(req.body.account).trim();
            const signature: string = String(req.body.signature).trim(); // 서명

            // 서명검증
            const userNonce = await (await this.getLedgerContract()).nonceOf(account);
            const message = ContractUtils.getRemoveMessage(account, userNonce);
            if (!ContractUtils.verifyMessage(account, message, signature))
                return res.status(200).json(ResponseMessage.getErrorMessage("1501"));

            const tx = await (await this.getLedgerContract())
                .connect(signerItem.signer)
                .removePhoneInfo(account, signature);

            logger.http(`TxHash(removePhoneInfoOfLedger): ${tx.hash}`);
            this._metrics.add("success", 1);
            return res.status(200).json(this.makeResponseData(0, { txHash: tx.hash }));
        } catch (error: any) {
            const msg = ResponseMessage.getEVMErrorMessage(error);
            logger.error(`POST /v1/ledger/removePhoneInfo : ${msg.error.message}`);
            this._metrics.add("failure", 1);
            return res.status(200).json(msg);
        } finally {
            this.releaseRelaySigner(signerItem);
        }
    }
}
