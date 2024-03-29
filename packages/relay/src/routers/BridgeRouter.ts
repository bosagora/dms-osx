import { Config } from "../common/Config";
import { logger } from "../common/Logger";
import { ContractManager } from "../contract/ContractManager";
import { ISignerItem, RelaySigners } from "../contract/Signers";
import { Metrics } from "../metrics/Metrics";
import { WebService } from "../service/WebService";
import { GraphStorage } from "../storage/GraphStorage";
import { RelayStorage } from "../storage/RelayStorage";
import { ContractLoyaltyType } from "../types";
import { ContractUtils } from "../utils/ContractUtils";
import { ResponseMessage } from "../utils/Errors";
import { Validation } from "../validation";

import { BigNumber, ethers } from "ethers";
import express from "express";
import { body, validationResult } from "express-validator";

export class BridgeRouter {
    private web_service: WebService;
    private readonly config: Config;
    private readonly contractManager: ContractManager;
    private readonly metrics: Metrics;
    private readonly relaySigners: RelaySigners;
    private storage: RelayStorage;
    private graph: GraphStorage;

    constructor(
        service: WebService,
        config: Config,
        contractManager: ContractManager,
        metrics: Metrics,
        storage: RelayStorage,
        graph: GraphStorage,
        relaySigners: RelaySigners
    ) {
        this.web_service = service;
        this.config = config;
        this.contractManager = contractManager;
        this.metrics = metrics;

        this.storage = storage;
        this.graph = graph;
        this.relaySigners = relaySigners;
    }

    private get app(): express.Application {
        return this.web_service.app;
    }

    /***
     * 트팬잭션을 중계할 때 사용될 서명자
     * @private
     */
    private async getRelaySigner(provider?: ethers.providers.Provider): Promise<ISignerItem> {
        if (provider === undefined) provider = this.contractManager.sideChainProvider;
        return this.relaySigners.getSigner(provider);
    }

    /***
     * 트팬잭션을 중계할 때 사용될 서명자
     * @private
     */
    private releaseRelaySigner(signer: ISignerItem) {
        signer.using = false;
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
            "/v1/bridge/withdraw",
            [
                body("account").exists().trim().isEthereumAddress(),
                body("amount").exists().custom(Validation.isAmount),
                body("signature")
                    .exists()
                    .trim()
                    .matches(/^(0x)[0-9a-f]{130}$/i),
            ],
            this.bridge_withdraw.bind(this)
        );

        this.app.post(
            "/v1/bridge/deposit",
            [
                body("account").exists().trim().isEthereumAddress(),
                body("amount").exists().custom(Validation.isAmount),
                body("signature")
                    .exists()
                    .trim()
                    .matches(/^(0x)[0-9a-f]{130}$/i),
            ],
            this.bridge_deposit.bind(this)
        );
    }

    private async balance_account(req: express.Request, res: express.Response) {
        logger.http(`GET /v1/ledger/balance/account/:account ${req.ip}:${JSON.stringify(req.params)}`);

        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(200).json(ResponseMessage.getErrorMessage("2001", { validation: errors.array() }));
        }

        try {
            let account: string = String(req.params.account).trim();
            if (ContractUtils.isTemporaryAccount(account)) {
                const realAccount = await this.storage.getRealAccount(account);
                if (realAccount === undefined) {
                    return res.status(200).json(ResponseMessage.getErrorMessage("2004"));
                } else {
                    account = realAccount;
                }
            }
            const loyaltyType = await this.contractManager.sideLedgerContract.loyaltyTypeOf(account);
            if (loyaltyType === ContractLoyaltyType.POINT) {
                const balance = await this.contractManager.sideLedgerContract.pointBalanceOf(account);
                const value = BigNumber.from(balance);
                this.metrics.add("success", 1);
                return res.status(200).json(
                    this.makeResponseData(0, {
                        account,
                        loyaltyType,
                        point: { balance: balance.toString(), value: value.toString() },
                        token: { balance: "0", value: "0" },
                    })
                );
            } else {
                const balance = await this.contractManager.sideLedgerContract.tokenBalanceOf(account);
                const value = await this.contractManager.sideCurrencyRateContract.convertTokenToPoint(balance);
                this.metrics.add("success", 1);
                return res.status(200).json(
                    this.makeResponseData(0, {
                        account,
                        loyaltyType,
                        point: { balance: "0", value: "0" },
                        token: { balance: balance.toString(), value: value.toString() },
                    })
                );
            }
        } catch (error: any) {
            const msg = ResponseMessage.getEVMErrorMessage(error);
            logger.error(`GET /v1/ledger/balance/account/:account : ${msg.error.message}`);
            this.metrics.add("failure", 1);
            return res.status(200).json(this.makeResponseData(msg.code, undefined, msg.error));
        }
    }

    private async getDepositId(account: string): Promise<string> {
        while (true) {
            const id = ContractUtils.getRandomId(account);
            if (await this.contractManager.sideBridge.isAvailableDepositId(id)) return id;
        }
    }

    private async bridge_withdraw(req: express.Request, res: express.Response) {
        logger.http(`POST /v1/bridge/withdraw ${req.ip}:${JSON.stringify(req.body)}`);

        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(200).json(ResponseMessage.getErrorMessage("2001", { validation: errors.array() }));
        }

        const signerItem = await this.getRelaySigner();
        try {
            const account: string = String(req.body.account).trim();
            const amount: BigNumber = BigNumber.from(req.body.amount);
            const signature: string = String(req.body.signature).trim();

            const balance = await this.contractManager.sideTokenContract.balanceOf(account);
            if (balance.lt(amount)) return res.status(200).json(ResponseMessage.getErrorMessage("1511"));

            const nonce = await this.contractManager.sideTokenContract.nonceOf(account);
            const message = ContractUtils.getTransferMessage(
                account,
                this.contractManager.sideBridge.address,
                amount,
                nonce,
                this.contractManager.sideChainId
            );
            if (!ContractUtils.verifyMessage(account, message, signature))
                return res.status(200).json(ResponseMessage.getErrorMessage("1501"));

            const tokenId = ContractUtils.getTokenId(
                await this.contractManager.sideTokenContract.name(),
                await this.contractManager.sideTokenContract.symbol()
            );
            const depositId = await this.getDepositId(account);
            const tx = await this.contractManager.sideBridge
                .connect(signerItem.signer)
                .depositToBridge(tokenId, depositId, account, amount, signature);

            return res.status(200).json(this.makeResponseData(0, { tokenId, depositId, amount, txHash: tx.hash }));
        } catch (error: any) {
            const msg = ResponseMessage.getEVMErrorMessage(error);
            logger.error(`POST /v1/bridge/withdraw : ${msg.error.message}`);
            this.metrics.add("failure", 1);
            return res.status(200).json(this.makeResponseData(msg.code, undefined, msg.error));
        } finally {
            this.releaseRelaySigner(signerItem);
        }
    }

    private async bridge_deposit(req: express.Request, res: express.Response) {
        logger.http(`POST /v1/bridge/deposit ${req.ip}:${JSON.stringify(req.body)}`);

        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(200).json(ResponseMessage.getErrorMessage("2001", { validation: errors.array() }));
        }

        const signerItem = await this.getRelaySigner(this.contractManager.mainChainProvider);
        try {
            const account: string = String(req.body.account).trim();
            const amount: BigNumber = BigNumber.from(req.body.amount);
            const signature: string = String(req.body.signature).trim();

            const balance = await this.contractManager.mainTokenContract.balanceOf(account);
            if (balance.lt(amount)) return res.status(200).json(ResponseMessage.getErrorMessage("1511"));

            const nonce = await this.contractManager.mainTokenContract.nonceOf(account);
            const message = ContractUtils.getTransferMessage(
                account,
                this.contractManager.mainBridge.address,
                amount,
                nonce,
                this.contractManager.mainChainId
            );
            if (!ContractUtils.verifyMessage(account, message, signature))
                return res.status(200).json(ResponseMessage.getErrorMessage("1501"));

            const tokenId = ContractUtils.getTokenId(
                await this.contractManager.mainTokenContract.name(),
                await this.contractManager.mainTokenContract.symbol()
            );
            const depositId = await this.getDepositId(account);
            const tx = await this.contractManager.mainBridge
                .connect(signerItem.signer)
                .depositToBridge(tokenId, depositId, account, amount, signature);

            return res.status(200).json(this.makeResponseData(0, { tokenId, depositId, amount, txHash: tx.hash }));
        } catch (error: any) {
            const msg = ResponseMessage.getEVMErrorMessage(error);
            logger.error(`POST /v1/bridge/deposit : ${msg.error.message}`);
            this.metrics.add("failure", 1);
            return res.status(200).json(this.makeResponseData(msg.code, undefined, msg.error));
        } finally {
            this.releaseRelaySigner(signerItem);
        }
    }
}
