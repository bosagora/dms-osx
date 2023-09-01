import { NonceManager } from "@ethersproject/experimental";
import { Signer, Wallet } from "ethers";
import { body, validationResult } from "express-validator";
import * as hre from "hardhat";
import { Ledger, LinkCollection, Token } from "../../typechain-types";
import { Config } from "../common/Config";
import { logger } from "../common/Logger";
import { GasPriceManager } from "../contract/GasPriceManager";
import { WebService } from "../service/WebService";

import express from "express";
import { Validation } from "../validation";
import { ContractUtils } from "../utils/ContractUtils";

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

    /***
     * 트팬잭션을 중계할 때 사용될 지갑
     * @private
     */
    private relayWallet: Wallet;

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
        this.relayWallet = new Wallet(this._config.relay.manager_key);
    }

    private get app(): express.Application {
        return this._web_service.app;
    }

    /***
     * 트팬잭션을 중계할 때 사용될 서명자
     * @private
     */
    private getRelaySigner(): Signer {
        return new NonceManager(new GasPriceManager(hre.ethers.provider.getSigner(this.relayWallet.address)));
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

        // 마일리지를 이용하여 구매
        this.app.post(
            "/payMileage",
            [
                body("purchaseId").exists(),
                body("amount").custom(Validation.isAmount),
                body("email")
                    .exists()
                    .matches(/^(0x)[0-9a-f]{64}$/i),
                body("franchiseeId").exists(),
                body("signer").exists().isEthereumAddress(),
                body("signature")
                    .exists()
                    .matches(/^(0x)[0-9a-f]{130}$/i),
            ],
            this.payMileage.bind(this)
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
                body("franchiseeId").exists(),
                body("signer").exists().isEthereumAddress(),
                body("signature")
                    .exists()
                    .matches(/^(0x)[0-9a-f]{130}$/i),
            ],
            this.payToken.bind(this)
        );

        // 토큰을 마일리지로 교환할 때
        this.app.post(
            "/exchangeTokenToMileage",
            [
                body("email")
                    .exists()
                    .matches(/^(0x)[0-9a-f]{64}$/i),
                body("amountToken").custom(Validation.isAmount),
                body("signer").exists().isEthereumAddress(),
                body("signature")
                    .exists()
                    .matches(/^(0x)[0-9a-f]{130}$/i),
            ],
            this.exchangeTokenToMileage.bind(this)
        );

        // 마일리지를 토큰으로 교환할 때
        this.app.post(
            "/exchangeMileageToToken",
            [
                body("email")
                    .exists()
                    .matches(/^(0x)[0-9a-f]{64}$/i),
                body("amountMileage").custom(Validation.isAmount),
                body("signer").exists().isEthereumAddress(),
                body("signature")
                    .exists()
                    .matches(/^(0x)[0-9a-f]{130}$/i),
            ],
            this.exchangeMileageToToken.bind(this)
        );
    }

    private async getHealthStatus(req: express.Request, res: express.Response) {
        return res.json("OK");
    }

    /**
     * 사용자 마일리지 지불
     * POST /payMileage
     * @private
     */
    private async payMileage(req: express.Request, res: express.Response) {
        logger.http(`POST /payMileage`);

        // TODO 필요시 access secret 검사
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.json(
                this.makeResponseData(501, undefined, {
                    message: "Failed to check the validity of parameters.",
                    validation: errors.array(),
                })
            );
        }

        try {
            const purchaseId: string = String(req.body.purchaseId); // 구매 아이디
            const amount: string = String(req.body.amount); // 구매 금액
            const email: string = String(req.body.email); // 구매한 사용자의 이메일 해시
            const franchiseeId: string = String(req.body.franchiseeId); // 구매한 가맹점 아이디
            const signer: string = String(req.body.signer); // 구매자의 주소
            const signature: string = String(req.body.signature); // 서명

            // TODO amount > 0 조건 검사

            // 서명검증
            const userNonce = await (await this.getLedgerContract()).nonceOf(signer);
            if (!ContractUtils.verifyPayment(purchaseId, amount, email, franchiseeId, signer, userNonce, signature))
                return res.status(200).json(
                    this.makeResponseData(500, undefined, {
                        message: "Signature is not valid.",
                    })
                );

            // 이메일 EmailLinkerContract에 이메일 등록여부 체크 및 구매자 주소와 동일여부
            const emailToAddress: string = await (await this.getEmailLinkerContract()).toAddress(email);
            if (emailToAddress !== signer) {
                return res.status(200).json(
                    this.makeResponseData(502, undefined, {
                        message: "Email is not valid.",
                    })
                );
            }
            const tx = await (await this.getLedgerContract())
                .connect(await this.getRelaySigner())
                .payMileage(purchaseId, amount, email, franchiseeId, signer, signature);

            logger.http(`TxHash(payMileage): `, tx.hash);
            return res.json(this.makeResponseData(200, { txHash: tx.hash }));
        } catch (error: any) {
            const message = error.message !== undefined ? error.message : "Failed pay mileage";
            logger.error(`POST /payMileage :`, message);
            return res.json(
                this.makeResponseData(500, undefined, {
                    message,
                })
            );
        }
    }

    /**
     * 사용자 토큰 지불
     * POST /payToken
     * @private
     */
    private async payToken(req: express.Request, res: express.Response) {
        logger.http(`POST /payToken`);

        // TODO 필요시 access secret 검사
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.json(
                this.makeResponseData(501, undefined, {
                    message: "Failed to check the validity of parameters.",
                    validation: errors.array(),
                })
            );
        }

        try {
            const purchaseId: string = String(req.body.purchaseId); // 구매 아이디
            const amount: string = String(req.body.amount); // 구매 금액
            const email: string = String(req.body.email); // 구매한 사용자의 이메일 해시
            const franchiseeId: string = String(req.body.franchiseeId); // 구매한 가맹점 아이디
            const signer: string = String(req.body.signer); // 구매자의 주소
            const signature: string = String(req.body.signature); // 서명

            // TODO amount > 0 조건 검사
            // 서명검증
            const userNonce = await (await this.getLedgerContract()).nonceOf(signer);
            if (!ContractUtils.verifyPayment(purchaseId, amount, email, franchiseeId, signer, userNonce, signature))
                return res.status(200).json(
                    this.makeResponseData(500, undefined, {
                        message: "Signature is not valid.",
                    })
                );

            // 이메일 EmailLinkerContract에 이메일 등록여부 체크 및 구매자 주소와 동일여부
            const emailToAddress: string = await (await this.getEmailLinkerContract()).toAddress(email);
            if (emailToAddress !== signer) {
                return res.status(200).json(
                    this.makeResponseData(502, undefined, {
                        message: "Email is not valid.",
                    })
                );
            }
            const tx = await (await this.getLedgerContract())
                .connect(await this.getRelaySigner())
                .payToken(purchaseId, amount, email, franchiseeId, signer, signature);

            logger.http(`TxHash(payToken): `, tx.hash);
            return res.json(this.makeResponseData(200, { txHash: tx.hash }));
        } catch (error: any) {
            const message = error.message !== undefined ? error.message : "Failed pay token";
            logger.error(`POST /payToken :`, message);
            return res.json(
                this.makeResponseData(500, undefined, {
                    message,
                })
            );
        }
    }

    /**
     * 토큰을 마일리지로 교환합니다
     * POST /exchangeTokenToMileage
     * @private
     */
    private async exchangeTokenToMileage(req: express.Request, res: express.Response) {
        logger.http(`POST /exchangeTokenToMileage`);

        // TODO 필요시 access secret 검사
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.json(
                this.makeResponseData(501, undefined, {
                    message: "Failed to check the validity of parameters.",
                    validation: errors.array(),
                })
            );
        }

        try {
            const email: string = String(req.body.email); // 구매한 사용자의 이메일 해시
            const amountToken: string = String(req.body.amountToken); // 교환할 마일리지의 량
            const signer: string = String(req.body.signer); // 구매자의 주소
            const signature: string = String(req.body.signature); // 서명

            // TODO amountToken > 0 조건 검사
            // 서명검증
            const userNonce = await (await this.getLedgerContract()).nonceOf(signer);
            if (!ContractUtils.verifyExchange(signer, email, amountToken, userNonce, signature))
                return res.status(200).json(
                    this.makeResponseData(500, undefined, {
                        message: "Signature is not valid.",
                    })
                );

            // 이메일 EmailLinkerContract에 이메일 등록여부 체크 및 구매자 주소와 동일여부
            const emailToAddress: string = await (await this.getEmailLinkerContract()).toAddress(email);
            if (emailToAddress !== signer) {
                return res.status(200).json(
                    this.makeResponseData(502, undefined, {
                        message: "Email is not valid.",
                    })
                );
            }
            const tx = await (await this.getLedgerContract())
                .connect(await this.getRelaySigner())
                .exchangeTokenToMileage(email, amountToken, signer, signature);

            logger.http(`TxHash(exchangeTokenToMileage): `, tx.hash);
            return res.json(this.makeResponseData(200, { txHash: tx.hash }));
        } catch (error: any) {
            const message = error.message !== undefined ? error.message : "Failed exchange Token To Mileage";
            logger.error(`POST /exchangeTokenToMileage :`, message);
            return res.json(
                this.makeResponseData(500, undefined, {
                    message,
                })
            );
        }
    }

    /**
     * 마일리지를 토큰으로 교환합니다
     * POST /exchangeMileageToToken
     * @private
     */
    private async exchangeMileageToToken(req: express.Request, res: express.Response) {
        logger.http(`POST /exchangeMileageToToken`);

        // TODO 필요시 access secret 검사
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.json(
                this.makeResponseData(501, undefined, {
                    message: "Failed to check the validity of parameters.",
                    validation: errors.array(),
                })
            );
        }

        try {
            const email: string = String(req.body.email); // 구매한 사용자의 이메일 해시
            const amountMileage: string = String(req.body.amountMileage); // 교환할 마일리지의 량
            const signer: string = String(req.body.signer); // 구매자의 주소
            const signature: string = String(req.body.signature); // 서명

            // TODO amountMileage > 0 조건 검사
            // 서명검증
            const userNonce = await (await this.getLedgerContract()).nonceOf(signer);
            if (!ContractUtils.verifyExchange(signer, email, amountMileage, userNonce, signature))
                return res.status(200).json(
                    this.makeResponseData(500, undefined, {
                        message: "Signature is not valid.",
                    })
                );

            // 이메일 EmailLinkerContract에 이메일 등록여부 체크 및 구매자 주소와 동일여부
            const emailToAddress: string = await (await this.getEmailLinkerContract()).toAddress(email);
            if (emailToAddress !== signer) {
                return res.status(200).json(
                    this.makeResponseData(502, undefined, {
                        message: "Email is not valid.",
                    })
                );
            }
            const tx = await (await this.getLedgerContract())
                .connect(await this.getRelaySigner())
                .exchangeMileageToToken(email, amountMileage, signer, signature);

            logger.http(`TxHash(exchangeMileageToToken): `, tx.hash);
            return res.json(this.makeResponseData(200, { txHash: tx.hash }));
        } catch (error: any) {
            const message = error.message !== undefined ? error.message : "Failed exchange Mileage To Token";
            logger.error(`POST /exchangeMileageToToken :`, message);
            return res.json(
                this.makeResponseData(500, undefined, {
                    message,
                })
            );
        }
    }
}
