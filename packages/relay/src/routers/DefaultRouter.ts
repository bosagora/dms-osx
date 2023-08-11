import { NonceManager } from "@ethersproject/experimental";
import { Signer, Wallet } from "ethers";
import * as hre from "hardhat";
import { Ledger, LinkCollection, Token } from "../../typechain-types";
import { Config } from "../common/Config";
import { GasPriceManager } from "../contract/GasPriceManager";
import { WebService } from "../service/WebService";

import express from "express";

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
    private static makeResponseData(code: number, data: any, error?: any): any {
        return {
            code,
            data,
            error,
        };
    }

    public registerRoutes() {
        this.app.get("/", [], DefaultRouter.getHealthStatus.bind(this));
        // TODO 필요한 기능을 추가한다.
        // 마일리지를 이용하여 구매할 때
        // 토큰을 이용하여 구매할 때
        // 마일리지를 토큰으로 교환할 때
        // 토큰을 마일리지로 교환할 때
    }

    private static async getHealthStatus(req: express.Request, res: express.Response) {
        return res.json("OK");
    }
}
