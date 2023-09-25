import { Ledger, LinkCollection, Token } from "../../typechain-types";
import { Config } from "../common/Config";
import { logger } from "../common/Logger";
import { GasPriceManager } from "../contract/GasPriceManager";
import { WebService } from "../service/WebService";
import { ContractUtils } from "../utils/ContractUtils";
import { Validation } from "../validation";

import { NonceManager } from "@ethersproject/experimental";
import { Signer, Wallet } from "ethers";
import { body, validationResult } from "express-validator";
import * as hre from "hardhat";

import express from "express";

interface ISignerItem {
    index: number;
    signer: Signer;
    using: boolean;
}

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

    private readonly _signers: ISignerItem[];

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
     * 이메일 지갑주소 링크 컨트랙트
     * @private
     */
    private _emailLinkerContract: LinkCollection | undefined;

    /**
     *
     * @param service  WebService
     * @param config Configuration
     */
    constructor(service: WebService, config: Config) {
        this._web_service = service;
        this._config = config;

        let idx = 0;
        this._signers = this._config.relay.managerKeys.map((m) => {
            return {
                index: idx++,
                signer: new Wallet(m, hre.ethers.provider) as Signer,
                using: false,
            };
        });
    }

    private get app(): express.Application {
        return this._web_service.app;
    }

    /***
     * 트팬잭션을 중계할 때 사용될 서명자
     * @private
     */
    private async getRelaySigner(): Promise<ISignerItem> {
        let signerItem: ISignerItem | undefined;
        let done = false;

        const startTime = ContractUtils.getTimeStamp();
        while (done) {
            for (signerItem of this._signers) {
                if (!signerItem.using) {
                    signerItem.using = true;
                    done = true;
                    break;
                }
            }
            if (ContractUtils.getTimeStamp() - startTime > 10) break;
            await ContractUtils.delay(1000);
        }

        if (signerItem !== undefined) {
            signerItem.using = true;
            signerItem.signer = new NonceManager(
                new GasPriceManager(new Wallet(this._config.relay.managerKeys[signerItem.index], hre.ethers.provider))
            );
        } else {
            signerItem = this._signers[0];
            signerItem.using = true;
            signerItem.signer = new NonceManager(
                new GasPriceManager(new Wallet(this._config.relay.managerKeys[signerItem.index], hre.ethers.provider))
            );
        }

        return signerItem;
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

    /**
     * 이메일 지갑주소 링크 컨트랙트를 리턴한다.
     * 컨트랙트의 객체가 생성되지 않았다면 컨트랙트 주소를 이용하여 컨트랙트 객체를 생성한 후 반환한다.
     * @private
     */
    private async getEmailLinkerContract(): Promise<LinkCollection> {
        if (this._emailLinkerContract === undefined) {
            const linkCollectionFactory = await hre.ethers.getContractFactory("LinkCollection");
            this._emailLinkerContract = linkCollectionFactory.attach(this._config.contracts.emailLinkerAddress);
        }
        return this._emailLinkerContract;
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
            "/payPoint",
            [
                body("purchaseId").exists(),
                body("amount").custom(Validation.isAmount),
                body("email")
                    .exists()
                    .matches(/^(0x)[0-9a-f]{64}$/i),
                body("shopId").exists(),
                body("signer").exists().isEthereumAddress(),
                body("signature")
                    .exists()
                    .matches(/^(0x)[0-9a-f]{130}$/i),
            ],
            this.payPoint.bind(this)
        );

        // 토큰을 이용하여 구매할 때
        this.app.post(
            "/payToken",
            [
                body("purchaseId").exists(),
                body("amount").custom(Validation.isAmount),
                body("email")
                    .exists()
                    .matches(/^(0x)[0-9a-f]{64}$/i),
                body("shopId").exists(),
                body("signer").exists().isEthereumAddress(),
                body("signature")
                    .exists()
                    .matches(/^(0x)[0-9a-f]{130}$/i),
            ],
            this.payToken.bind(this)
        );
    }

    private async getHealthStatus(req: express.Request, res: express.Response) {
        return res.status(200).json("OK");
    }

    /**
     * 사용자 포인트 지불
     * POST /payPoint
     * @private
     */
    private async payPoint(req: express.Request, res: express.Response) {
        logger.http(`POST /payPoint`);

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
            const purchaseId: string = String(req.body.purchaseId); // 구매 아이디
            const amount: string = String(req.body.amount); // 구매 금액
            const email: string = String(req.body.email); // 구매한 사용자의 이메일 해시
            const shopId: string = String(req.body.shopId); // 구매한 가맹점 아이디
            const signer: string = String(req.body.signer); // 구매자의 주소
            const signature: string = String(req.body.signature); // 서명

            // TODO amount > 0 조건 검사

            // 서명검증
            const userNonce = await (await this.getLedgerContract()).nonceOf(signer);
            if (!ContractUtils.verifyPayment(purchaseId, amount, email, shopId, signer, userNonce, signature))
                return res.status(200).json(
                    this.makeResponseData(500, undefined, {
                        message: "Signature is not valid.",
                    })
                );

            // 컨트랙트에서 이메일 등록여부 체크 및 구매자 주소와 동일여부
            const emailToAddress: string = await (await this.getEmailLinkerContract()).toAddress(email);
            if (emailToAddress !== signer) {
                return res.status(200).json(
                    this.makeResponseData(502, undefined, {
                        message: "Email is not valid.",
                    })
                );
            }
            const tx = await (await this.getLedgerContract())
                .connect(signerItem.signer)
                .payPoint(purchaseId, amount, email, shopId, signer, signature);

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
     * POST /payToken
     * @private
     */
    private async payToken(req: express.Request, res: express.Response) {
        logger.http(`POST /payToken`);

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
            const purchaseId: string = String(req.body.purchaseId); // 구매 아이디
            const amount: string = String(req.body.amount); // 구매 금액
            const email: string = String(req.body.email); // 구매한 사용자의 이메일 해시
            const shopId: string = String(req.body.shopId); // 구매한 가맹점 아이디
            const signer: string = String(req.body.signer); // 구매자의 주소
            const signature: string = String(req.body.signature); // 서명

            // TODO amount > 0 조건 검사
            // 서명검증
            const userNonce = await (await this.getLedgerContract()).nonceOf(signer);
            if (!ContractUtils.verifyPayment(purchaseId, amount, email, shopId, signer, userNonce, signature))
                return res.status(200).json(
                    this.makeResponseData(500, undefined, {
                        message: "Signature is not valid.",
                    })
                );

            // 컨트랙트에서 이메일 등록여부 체크 및 구매자 주소와 동일여부
            const emailToAddress: string = await (await this.getEmailLinkerContract()).toAddress(email);
            if (emailToAddress !== signer) {
                return res.status(200).json(
                    this.makeResponseData(502, undefined, {
                        message: "Email is not valid.",
                    })
                );
            }
            const tx = await (await this.getLedgerContract())
                .connect(signerItem.signer)
                .payToken(purchaseId, amount, email, shopId, signer, signature);

            logger.http(`TxHash(payToken): `, tx.hash);
            return res.status(200).json(this.makeResponseData(200, { txHash: tx.hash }));
        } catch (error: any) {
            let message = ContractUtils.cacheEVMError(error as any);
            if (message === "") message = "Failed pay token";
            logger.error(`POST /payToken :`, message);
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
