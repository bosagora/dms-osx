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

// tslint:disable-next-line:no-implicit-dependencies
import { AddressZero } from "@ethersproject/constants";

import { BigNumber, ethers } from "ethers";
import express from "express";
import { body, param, query, validationResult } from "express-validator";
import { PhoneNumberFormat, PhoneNumberUtil } from "google-libphonenumber";

export class LedgerRouter {
    private web_service: WebService;
    private readonly config: Config;
    private readonly contractManager: ContractManager;
    private readonly metrics: Metrics;
    private readonly relaySigners: RelaySigners;
    private storage: RelayStorage;
    private graph: GraphStorage;
    private phoneUtil: PhoneNumberUtil;

    constructor(
        service: WebService,
        config: Config,
        contractManager: ContractManager,
        metrics: Metrics,
        storage: RelayStorage,
        graph: GraphStorage,
        relaySigners: RelaySigners
    ) {
        this.phoneUtil = PhoneNumberUtil.getInstance();
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

        this.app.get(
            "/v1/ledger/balance/account/:account",
            [param("account").exists().trim().isEthereumAddress()],
            this.balance_account.bind(this)
        );

        this.app.get("/v1/ledger/balance/phone/:phone", [param("phone").exists()], this.balance_phone.bind(this));

        this.app.get(
            "/v1/ledger/balance/phoneHash/:phoneHash",
            [
                param("phoneHash")
                    .exists()
                    .trim()
                    .matches(/^(0x)[0-9a-f]{64}$/i),
            ],
            this.balance_hash.bind(this)
        );

        this.app.get("/v1/phone/hash/:phone", [param("phone")], this.phone_hash.bind(this));

        this.app.get(
            "/v1/currency/convert",
            [query("amount").exists().custom(Validation.isAmount), query("from").exists(), query("to").exists()],
            this.currency_convert.bind(this)
        );

        this.app.post(
            "/v1/ledger/transfer",
            [
                body("amount").exists().custom(Validation.isAmount),
                body("from").exists().trim().isEthereumAddress(),
                body("to").exists().trim().isEthereumAddress(),
                body("signature")
                    .exists()
                    .trim()
                    .matches(/^(0x)[0-9a-f]{130}$/i),
            ],
            this.ledger_transfer.bind(this)
        );

        this.app.post(
            "/v1/ledger/withdraw_by_bridge",
            [
                body("account").exists().trim().isEthereumAddress(),
                body("amount").exists().custom(Validation.isAmount),
                body("signature")
                    .exists()
                    .trim()
                    .matches(/^(0x)[0-9a-f]{130}$/i),
            ],
            this.ledger_withdraw_by_bridge.bind(this)
        );

        this.app.post(
            "/v1/ledger/deposit_by_bridge",
            [
                body("account").exists().trim().isEthereumAddress(),
                body("amount").exists().custom(Validation.isAmount),
                body("signature")
                    .exists()
                    .trim()
                    .matches(/^(0x)[0-9a-f]{130}$/i),
            ],
            this.ledger_deposit_by_bridge.bind(this)
        );
    }

    private async getNonce(req: express.Request, res: express.Response) {
        logger.http(`GET /v1/ledge/nonce ${req.ip}:${JSON.stringify(req.params)}`);
        const account: string = String(req.params.account).trim();
        const nonce = await this.contractManager.sideLedgerContract.nonceOf(account);
        this.metrics.add("success", 1);
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
            const userNonce = await this.contractManager.sideLedgerContract.nonceOf(account);
            if (!ContractUtils.verifyLoyaltyType(account, userNonce, signature, this.contractManager.sideChainId))
                return res.status(200).json(ResponseMessage.getErrorMessage("1501"));

            const tx = await this.contractManager.sideLoyaltyExchangerContract
                .connect(signerItem.signer)
                .changeToLoyaltyToken(account, signature);

            logger.http(`TxHash(changeToLoyaltyToken): ${tx.hash}`);
            this.metrics.add("success", 1);
            return res.status(200).json(this.makeResponseData(0, { txHash: tx.hash }));
        } catch (error: any) {
            const msg = ResponseMessage.getEVMErrorMessage(error);
            logger.error(`POST /v1/ledger/changeToLoyaltyToken : ${msg.error.message}`);
            this.metrics.add("failure", 1);
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
            const userNonce = await this.contractManager.sideLedgerContract.nonceOf(account);
            if (
                !ContractUtils.verifyChangePayablePoint(
                    phone,
                    account,
                    userNonce,
                    signature,
                    this.contractManager.sideChainId
                )
            )
                return res.status(200).json(ResponseMessage.getErrorMessage("1501"));

            const tx = await this.contractManager.sideLoyaltyExchangerContract
                .connect(signerItem.signer)
                .changeToPayablePoint(phone, account, signature);

            logger.http(`TxHash(changeToPayablePoint): ${tx.hash}`);
            this.metrics.add("success", 1);
            return res.status(200).json(this.makeResponseData(0, { txHash: tx.hash }));
        } catch (error: any) {
            const msg = ResponseMessage.getEVMErrorMessage(error);
            logger.error(`POST /v1/ledger/changeToPayablePoint : ${msg.error.message}`);
            this.metrics.add("failure", 1);
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
            const userNonce = await this.contractManager.sideLedgerContract.nonceOf(account);
            const message = ContractUtils.getRemoveMessage(account, userNonce, this.contractManager.sideChainId);
            if (!ContractUtils.verifyMessage(account, message, signature))
                return res.status(200).json(ResponseMessage.getErrorMessage("1501"));

            const tx = await this.contractManager.sideLedgerContract
                .connect(signerItem.signer)
                .removePhoneInfo(account, signature);

            logger.http(`TxHash(removePhoneInfoOfLedger): ${tx.hash}`);
            this.metrics.add("success", 1);
            return res.status(200).json(this.makeResponseData(0, { txHash: tx.hash }));
        } catch (error: any) {
            const msg = ResponseMessage.getEVMErrorMessage(error);
            logger.error(`POST /v1/ledger/removePhoneInfo : ${msg.error.message}`);
            this.metrics.add("failure", 1);
            return res.status(200).json(msg);
        } finally {
            this.releaseRelaySigner(signerItem);
        }
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

    private async balance_phone(req: express.Request, res: express.Response) {
        logger.http(`GET /v1/ledger/balance/phone/:phone ${req.ip}:${JSON.stringify(req.params)}`);

        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(200).json(ResponseMessage.getErrorMessage("2001", { validation: errors.array() }));
        }
        let phone: string = String(req.params.phone).trim();
        try {
            const number = this.phoneUtil.parseAndKeepRawInput(phone, "ZZ");
            if (!this.phoneUtil.isValidNumber(number)) {
                return res.status(200).json(ResponseMessage.getErrorMessage("2003"));
            } else {
                phone = this.phoneUtil.format(number, PhoneNumberFormat.INTERNATIONAL);
            }
        } catch (error) {
            return res.status(200).json(ResponseMessage.getErrorMessage("2003"));
        }
        const phoneHash: string = ContractUtils.getPhoneHash(phone);

        try {
            const account: string = await this.contractManager.sidePhoneLinkerContract.toAddress(phoneHash);
            if (account !== AddressZero) {
                const loyaltyType = await this.contractManager.sideLedgerContract.loyaltyTypeOf(account);
                if (loyaltyType === ContractLoyaltyType.POINT) {
                    const balance = await this.contractManager.sideLedgerContract.pointBalanceOf(account);
                    const value = BigNumber.from(balance);
                    this.metrics.add("success", 1);
                    return res.status(200).json(
                        this.makeResponseData(0, {
                            phone,
                            phoneHash,
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
                            phone,
                            phoneHash,
                            account,
                            loyaltyType,
                            point: { balance: "0", value: "0" },
                            token: { balance: balance.toString(), value: value.toString() },
                        })
                    );
                }
            } else {
                const loyaltyType = ContractLoyaltyType.POINT;
                const balance = await this.contractManager.sideLedgerContract.unPayablePointBalanceOf(phoneHash);
                const value = BigNumber.from(balance);
                this.metrics.add("success", 1);
                return res.status(200).json(
                    this.makeResponseData(0, {
                        phone,
                        phoneHash,
                        account,
                        loyaltyType,
                        point: { balance: balance.toString(), value: value.toString() },
                        token: { balance: "0", value: "0" },
                    })
                );
            }
        } catch (error: any) {
            const msg = ResponseMessage.getEVMErrorMessage(error);
            logger.error(`GET /v1/ledger/balance/phone/:phone : ${msg.error.message}`);
            this.metrics.add("failure", 1);
            return res.status(200).json(this.makeResponseData(msg.code, undefined, msg.error));
        }
    }

    private async balance_hash(req: express.Request, res: express.Response) {
        logger.http(`GET /v1/ledger/balance/phoneHash/:phoneHash ${req.ip}:${JSON.stringify(req.params)}`);

        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(200).json(ResponseMessage.getErrorMessage("2001", { validation: errors.array() }));
        }
        const phoneHash: string = String(req.params.phoneHash).trim();

        try {
            const account: string = await this.contractManager.sidePhoneLinkerContract.toAddress(phoneHash);
            if (account !== AddressZero) {
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
                            phoneHash,
                            account,
                            loyaltyType,
                            point: { balance: "0", value: "0" },
                            token: { balance: balance.toString(), value: value.toString() },
                        })
                    );
                }
            } else {
                const loyaltyType = ContractLoyaltyType.POINT;
                const balance = await this.contractManager.sideLedgerContract.unPayablePointBalanceOf(phoneHash);
                const value = BigNumber.from(balance);
                this.metrics.add("success", 1);
                return res.status(200).json(
                    this.makeResponseData(0, {
                        phoneHash,
                        account,
                        loyaltyType,
                        point: { balance: balance.toString(), value: value.toString() },
                        token: { balance: "0", value: "0" },
                    })
                );
            }
        } catch (error: any) {
            const msg = ResponseMessage.getEVMErrorMessage(error);
            logger.error(`GET /v1/ledger/balance/phoneHash/:phoneHash : ${msg.error.message}`);
            this.metrics.add("failure", 1);
            return res.status(200).json(this.makeResponseData(msg.code, undefined, msg.error));
        }
    }

    private async phone_hash(req: express.Request, res: express.Response) {
        logger.http(`GET /v1/phone/hash/:phone ${req.ip}:${JSON.stringify(req.params)}`);

        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(200).json(ResponseMessage.getErrorMessage("2001", { validation: errors.array() }));
        }

        let phone: string = String(req.params.phone).trim();
        try {
            const number = this.phoneUtil.parseAndKeepRawInput(phone, "ZZ");
            if (!this.phoneUtil.isValidNumber(number)) {
                return res.status(200).json(ResponseMessage.getErrorMessage("2003"));
            } else {
                phone = this.phoneUtil.format(number, PhoneNumberFormat.INTERNATIONAL);
            }
        } catch (error) {
            return res.status(200).json(ResponseMessage.getErrorMessage("2003"));
        }
        const phoneHash: string = ContractUtils.getPhoneHash(phone);

        try {
            this.metrics.add("success", 1);
            return res.status(200).json(this.makeResponseData(0, { phone, phoneHash }));
        } catch (error: any) {
            const msg = ResponseMessage.getEVMErrorMessage(error);
            logger.error(`GET /v1/phone/hash/:phone : ${msg.error.message}`);
            this.metrics.add("failure", 1);
            return res.status(200).json(this.makeResponseData(msg.code, undefined, msg.error));
        }
    }

    private async currency_convert(req: express.Request, res: express.Response) {
        logger.http(`GET /v1/currency/convert ${req.ip}:${JSON.stringify(req.query)}`);

        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(200).json(ResponseMessage.getErrorMessage("2001", { validation: errors.array() }));
        }

        try {
            const amount: BigNumber = BigNumber.from(req.query.amount);
            const from: string = String(req.query.from).trim();
            const to: string = String(req.query.to).trim();

            const result = await this.contractManager.sideCurrencyRateContract.convertCurrency(amount, from, to);
            this.metrics.add("success", 1);
            return res.status(200).json(this.makeResponseData(0, { amount: result.toString() }));
        } catch (error: any) {
            const msg = ResponseMessage.getEVMErrorMessage(error);
            logger.error(`GET /v1/currency/convert : ${msg.error.message}`);
            this.metrics.add("failure", 1);
            return res.status(200).json(this.makeResponseData(msg.code, undefined, msg.error));
        }
    }

    private async ledger_transfer(req: express.Request, res: express.Response) {
        logger.http(`POST /v1/ledger/transfer ${req.ip}:${JSON.stringify(req.body)}`);

        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(200).json(ResponseMessage.getErrorMessage("2001", { validation: errors.array() }));
        }

        const signerItem = await this.getRelaySigner();
        try {
            const from: string = String(req.body.from).trim();
            const to: string = String(req.body.to).trim();
            const amount: BigNumber = BigNumber.from(req.body.amount);
            const signature: string = String(req.body.signature).trim();

            const balance = await this.contractManager.sideLedgerContract.tokenBalanceOf(from);
            if (balance.lt(amount)) return res.status(200).json(ResponseMessage.getErrorMessage("1511"));

            const nonce = await this.contractManager.sideLedgerContract.nonceOf(from);
            const message = ContractUtils.getTransferMessage(from, to, amount, nonce, this.contractManager.sideChainId);
            if (!ContractUtils.verifyMessage(from, message, signature))
                return res.status(200).json(ResponseMessage.getErrorMessage("1501"));
            const tx = await this.contractManager.sideLoyaltyTransferContract
                .connect(signerItem.signer)
                .transferToken(from, to, amount, signature);
            this.metrics.add("success", 1);
            return res.status(200).json(this.makeResponseData(0, { from, to, amount, txHash: tx.hash }));
        } catch (error: any) {
            const msg = ResponseMessage.getEVMErrorMessage(error);
            logger.error(`POST /v1/ledger/transfer : ${msg.error.message}`);
            this.metrics.add("failure", 1);
            return res.status(200).json(this.makeResponseData(msg.code, undefined, msg.error));
        } finally {
            this.releaseRelaySigner(signerItem);
        }
    }

    private async getDepositId(account: string): Promise<string> {
        while (true) {
            const id = ContractUtils.getRandomId(account);
            if (await this.contractManager.sideLoyaltyBridgeContract.isAvailableDepositId(id)) return id;
        }
    }

    private async ledger_withdraw_by_bridge(req: express.Request, res: express.Response) {
        logger.http(`POST /v1/ledger/withdraw_by_bridge ${req.ip}:${JSON.stringify(req.body)}`);

        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(200).json(ResponseMessage.getErrorMessage("2001", { validation: errors.array() }));
        }

        const signerItem = await this.getRelaySigner();
        try {
            const account: string = String(req.body.account).trim();
            const amount: BigNumber = BigNumber.from(req.body.amount);
            const signature: string = String(req.body.signature).trim();

            const balance = await this.contractManager.sideLedgerContract.tokenBalanceOf(account);
            if (balance.lt(amount)) return res.status(200).json(ResponseMessage.getErrorMessage("1511"));

            const nonce = await this.contractManager.sideLedgerContract.nonceOf(account);
            const message = ContractUtils.getTransferMessage(
                account,
                this.contractManager.sideLoyaltyBridgeContract.address,
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
            const tx = await this.contractManager.sideLoyaltyBridgeContract
                .connect(signerItem.signer)
                .depositToBridge(tokenId, depositId, account, amount, signature);

            return res.status(200).json(this.makeResponseData(0, { tokenId, depositId, amount, txHash: tx.hash }));
        } catch (error: any) {
            const msg = ResponseMessage.getEVMErrorMessage(error);
            logger.error(`POST /v1/ledger/withdraw_by_bridge : ${msg.error.message}`);
            this.metrics.add("failure", 1);
            return res.status(200).json(this.makeResponseData(msg.code, undefined, msg.error));
        } finally {
            this.releaseRelaySigner(signerItem);
        }
    }

    private async ledger_deposit_by_bridge(req: express.Request, res: express.Response) {
        logger.http(`POST /v1/ledger/deposit_by_bridge ${req.ip}:${JSON.stringify(req.body)}`);

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
                this.contractManager.mainLoyaltyBridgeContract.address,
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
            const tx = await this.contractManager.mainLoyaltyBridgeContract
                .connect(signerItem.signer)
                .depositToBridge(tokenId, depositId, account, amount, signature);

            return res.status(200).json(this.makeResponseData(0, { tokenId, depositId, amount, txHash: tx.hash }));
        } catch (error: any) {
            const msg = ResponseMessage.getEVMErrorMessage(error);
            logger.error(`POST /v1/ledger/deposit_by_bridge : ${msg.error.message}`);
            this.metrics.add("failure", 1);
            return res.status(200).json(this.makeResponseData(msg.code, undefined, msg.error));
        } finally {
            this.releaseRelaySigner(signerItem);
        }
    }
}
