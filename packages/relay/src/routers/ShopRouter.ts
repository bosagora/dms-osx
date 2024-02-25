import { Shop } from "../../typechain-types";
import { Config } from "../common/Config";
import { logger } from "../common/Logger";
import { WebService } from "../service/WebService";
import { ContractUtils } from "../utils/ContractUtils";
import { Validation } from "../validation";

import { body, query, validationResult } from "express-validator";
import * as hre from "hardhat";

import { ContractTransaction } from "ethers";
import express from "express";
import { ISignerItem, RelaySigners } from "../contract/Signers";
import { INotificationSender } from "../delegator/NotificationSender";
import { GraphStorage } from "../storage/GraphStorage";
import { RelayStorage } from "../storage/RelayStorage";
import {
    ContractShopStatus,
    ContractShopUpdateEvent,
    MobileType,
    ShopTaskData,
    ShopTaskStatus,
    TaskResultCode,
    TaskResultType,
} from "../types";
import { ResponseMessage } from "../utils/Errors";
import { HTTPClient } from "../utils/Utils";

// tslint:disable-next-line:no-implicit-dependencies
import { AddressZero } from "@ethersproject/constants";

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
     * 사용자의 원장 컨트랙트
     * @private
     */
    private _shopContract: Shop | undefined;

    private _storage: RelayStorage;
    private _graph: GraphStorage;

    private readonly _sender: INotificationSender;

    /**
     *
     * @param service  WebService
     * @param config Configuration
     * @param storage
     * @param graph
     * @param relaySigners
     * @param sender
     */
    constructor(
        service: WebService,
        config: Config,
        storage: RelayStorage,
        graph: GraphStorage,
        relaySigners: RelaySigners,
        sender: INotificationSender
    ) {
        this._web_service = service;
        this._config = config;

        this._storage = storage;
        this._graph = graph;
        this._relaySigners = relaySigners;
        this._sender = sender;
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

    private async getShopContract(): Promise<Shop> {
        if (this._shopContract === undefined) {
            const shopFactory = await hre.ethers.getContractFactory("Shop");
            this._shopContract = shopFactory.attach(this._config.contracts.shopAddress);
        }
        return this._shopContract;
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
            "/v1/shop/account/delegator/create",
            [
                body("shopId")
                    .exists()
                    .matches(/^(0x)[0-9a-f]{64}$/i),
                body("account").exists().trim().isEthereumAddress(),
                body("signature")
                    .exists()
                    .trim()
                    .matches(/^(0x)[0-9a-f]{130}$/i),
            ],
            this.shop_account_delegator_create.bind(this)
        );
        this.app.post(
            "/v1/shop/account/delegator/remove",
            [
                body("shopId")
                    .exists()
                    .matches(/^(0x)[0-9a-f]{64}$/i),
                body("account").exists().trim().isEthereumAddress(),
                body("signature")
                    .exists()
                    .trim()
                    .matches(/^(0x)[0-9a-f]{130}$/i),
            ],
            this.shop_account_delegator_remove.bind(this)
        );
        this.app.post(
            "/v1/shop/account/delegator/save",
            [
                body("shopId")
                    .exists()
                    .matches(/^(0x)[0-9a-f]{64}$/i),
                body("account").exists().trim().isEthereumAddress(),
                body("delegator").exists().trim().isEthereumAddress(),
                body("signature")
                    .exists()
                    .trim()
                    .matches(/^(0x)[0-9a-f]{130}$/i),
            ],
            this.shop_account_delegator_save.bind(this)
        );
        this.app.post(
            "/v1/shop/add",
            [
                body("shopId")
                    .exists()
                    .matches(/^(0x)[0-9a-f]{64}$/i),
                body("name").exists(),
                body("currency").exists(),
                body("account").exists().trim().isEthereumAddress(),
                body("signature")
                    .exists()
                    .trim()
                    .matches(/^(0x)[0-9a-f]{130}$/i),
            ],
            this.shop_add.bind(this)
        );
        this.app.get("/v1/shop/task", [query("taskId").exists()], this.shop_task.bind(this));
        this.app.post(
            "/v1/shop/update/create",
            [
                body("shopId")
                    .exists()
                    .trim()
                    .matches(/^(0x)[0-9a-f]{64}$/i),
                body("name").exists(),
                body("currency").exists(),
            ],
            this.shop_update_create.bind(this)
        );
        this.app.post(
            "/v1/shop/update/approval",
            [
                body("taskId").exists(),
                body("approval").exists().trim().toLowerCase().isIn(["true", "false"]),
                body("signature")
                    .exists()
                    .trim()
                    .matches(/^(0x)[0-9a-f]{130}$/i),
            ],
            this.shop_update_approval.bind(this)
        );
        this.app.post(
            "/v1/shop/status/create",
            [
                body("shopId")
                    .exists()
                    .trim()
                    .matches(/^(0x)[0-9a-f]{64}$/i),
                body("status").exists().trim().isIn(["1", "2"]),
            ],
            this.shop_status_create.bind(this)
        );
        this.app.post(
            "/v1/shop/status/approval",
            [
                body("taskId").exists(),
                body("approval").exists().trim().toLowerCase().isIn(["true", "false"]),
                body("signature")
                    .exists()
                    .trim()
                    .matches(/^(0x)[0-9a-f]{130}$/i),
            ],
            this.shop_status_approval.bind(this)
        );
        this.app.post(
            "/v1/shop/withdrawal/open",
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
            this.shop_withdrawal_open.bind(this)
        );
        this.app.post(
            "/v1/shop/withdrawal/close",
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
            this.shop_withdrawal_close.bind(this)
        );
        this.app.get(
            "/v1/shop/list",
            [query("pageNumber").exists().trim().isNumeric(), query("pageSize").exists().trim().isNumeric()],
            this.shop_list.bind(this)
        );
    }

    /**
     * POST /v1/shop/account/delegator/create
     * @private
     */
    private async shop_account_delegator_create(req: express.Request, res: express.Response) {
        logger.http(`POST /v1/account/delegator/create ${req.ip}:${JSON.stringify(req.body)}`);

        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(200).json(ResponseMessage.getErrorMessage("2001", { validation: errors.array() }));
        }

        try {
            const shopId: string = String(req.body.shopId).trim();
            const account: string = String(req.body.account).trim();
            const signature: string = String(req.body.signature).trim(); // 서명

            try {
                const contract = await this.getShopContract();
                const message = ContractUtils.getShopAccountMessage(shopId, account, await contract.nonceOf(account));
                if (!ContractUtils.verifyMessage(account, message, signature))
                    return res.status(200).json(ResponseMessage.getErrorMessage("1501"));

                const delegator = await this._storage.createDelegator(account, this._config.relay.encryptKey);

                return res.status(200).json(
                    this.makeResponseData(0, {
                        shopId,
                        account,
                        delegator,
                    })
                );
            } catch (error: any) {
                const msg = ResponseMessage.getEVMErrorMessage(error);
                logger.error(`POST /v1/shop/account/delegator/create : ${msg.error.message}`);
                return res.status(200).json(msg);
            }
        } catch (error: any) {
            const msg = ResponseMessage.getEVMErrorMessage(error);
            logger.error(`POST /v1/shop/account/delegator/create : ${msg.error.message}`);
            return res.status(200).json(msg);
        }
    }

    /**
     * POST /v1/shop/account/delegator/remove
     * @private
     */
    private async shop_account_delegator_remove(req: express.Request, res: express.Response) {
        logger.http(`POST /v1/account/delegator/create ${req.ip}:${JSON.stringify(req.body)}`);

        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(200).json(ResponseMessage.getErrorMessage("2001", { validation: errors.array() }));
        }

        try {
            const shopId: string = String(req.body.shopId).trim();
            const account: string = String(req.body.account).trim();
            const signature: string = String(req.body.signature).trim(); // 서명

            try {
                const contract = await this.getShopContract();
                const message = ContractUtils.getShopAccountMessage(shopId, account, await contract.nonceOf(account));
                if (!ContractUtils.verifyMessage(account, message, signature))
                    return res.status(200).json(ResponseMessage.getErrorMessage("1501"));

                await this._storage.removeDelegator(account);

                return res.status(200).json(
                    this.makeResponseData(0, {
                        shopId,
                        account,
                    })
                );
            } catch (error: any) {
                const msg = ResponseMessage.getEVMErrorMessage(error);
                logger.error(`POST /v1/shop/account/delegator/remove : ${msg.error.message}`);
                return res.status(200).json(msg);
            }
        } catch (error: any) {
            const msg = ResponseMessage.getEVMErrorMessage(error);
            logger.error(`POST /v1/shop/account/delegator/remove : ${msg.error.message}`);
            return res.status(200).json(msg);
        }
    }

    /**
     * POST /v1/shop/account/delegator/save
     * @private
     */
    private async shop_account_delegator_save(req: express.Request, res: express.Response) {
        logger.http(`POST /v1/account/delegator/save ${req.ip}:${JSON.stringify(req.body)}`);

        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(200).json(ResponseMessage.getErrorMessage("2001", { validation: errors.array() }));
        }

        const signerItem = await this.getRelaySigner();
        try {
            const shopId: string = String(req.body.shopId).trim();
            const account: string = String(req.body.account).trim();
            const delegator: string = String(req.body.delegator).trim();
            const signature: string = String(req.body.signature).trim();

            const contract = await this.getShopContract();
            const message = ContractUtils.getShopDelegatorAccountMessage(
                shopId,
                delegator,
                account,
                await contract.nonceOf(account)
            );
            if (!ContractUtils.verifyMessage(account, message, signature))
                return res.status(200).json(ResponseMessage.getErrorMessage("1501"));

            if (delegator !== AddressZero) {
                const savedDelegator = await this._storage.getDelegator(account, this._config.relay.encryptKey);
                if (savedDelegator === undefined) return res.status(200).json(ResponseMessage.getErrorMessage("2006"));
                const wallet = new hre.ethers.Wallet(savedDelegator);
                if (wallet.address.toLowerCase() !== delegator.toLowerCase())
                    return res.status(200).json(ResponseMessage.getErrorMessage("2006"));
            } else {
                await this._storage.removeDelegator(account);
            }

            const tx = await contract.connect(signerItem.signer).changeDelegator(shopId, delegator, account, signature);
            return res.status(200).json(
                this.makeResponseData(0, {
                    shopId,
                    delegator,
                    account,
                    txHash: tx.hash,
                })
            );
        } catch (error: any) {
            const msg = ResponseMessage.getEVMErrorMessage(error);
            logger.error(`POST /v1/shop/account/delegator/save : ${msg.error.message}`);
            return res.status(200).json(msg);
        } finally {
            this.releaseRelaySigner(signerItem);
        }
    }

    /**
     * 상점을 추가한다.
     * POST /v1/shop/add
     * @private
     */
    private async shop_add(req: express.Request, res: express.Response) {
        logger.http(`POST /v1/shop/add ${req.ip}:${JSON.stringify(req.body)}`);

        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(200).json(ResponseMessage.getErrorMessage("2001", { validation: errors.array() }));
        }

        const signerItem = await this.getRelaySigner();
        try {
            const shopId: string = String(req.body.shopId).trim();
            const name: string = String(req.body.name).trim();
            const currency: string = String(req.body.currency).trim().toLowerCase();
            const account: string = String(req.body.account).trim();
            const signature: string = String(req.body.signature).trim(); // 서명

            const taskId = ContractUtils.getTaskId(shopId);
            const item: ShopTaskData = {
                taskId,
                type: TaskResultType.ADD,
                shopId,
                name,
                currency,
                status: ContractShopStatus.INVALID,
                account,
                taskStatus: ShopTaskStatus.OPENED,
                timestamp: ContractUtils.getTimeStamp(),
                txId: "",
                txTime: 0,
            };
            await this._storage.postTask(item);

            try {
                const contract = await this.getShopContract();
                const message = ContractUtils.getShopAccountMessage(
                    item.shopId,
                    item.account,
                    await contract.nonceOf(account)
                );
                if (!ContractUtils.verifyMessage(account, message, signature))
                    return res.status(200).json(ResponseMessage.getErrorMessage("1501"));

                const tx = await contract.connect(signerItem.signer).add(shopId, name, currency, account, signature);
                logger.http(`TxHash(/v1/shop/add): ${tx.hash}`);

                item.txId = tx.hash;
                item.txTime = ContractUtils.getTimeStamp();
                item.taskStatus = ShopTaskStatus.SENT_TX;
                await this._storage.updateTaskTx(item.taskId, item.txId, item.txTime, item.taskStatus);

                return res.status(200).json(
                    this.makeResponseData(0, {
                        taskId: item.taskId,
                        shopId: item.shopId,
                        name: item.name,
                        currency: item.currency,
                        account: item.account,
                        taskStatus: item.taskStatus,
                        timestamp: item.timestamp,
                        txHash: tx.hash,
                    })
                );
            } catch (error: any) {
                item.taskStatus = ShopTaskStatus.FAILED_TX;
                await this._storage.forcedUpdateTaskStatus(item.taskId, item.taskStatus);

                const msg = ResponseMessage.getEVMErrorMessage(error);
                logger.error(`POST /v1/shop/add : ${msg.error.message}`);
                return res.status(200).json(msg);
            }
        } catch (error: any) {
            const msg = ResponseMessage.getEVMErrorMessage(error);
            logger.error(`POST /v1/shop/add : ${msg.error.message}`);
            return res.status(200).json(msg);
        } finally {
            this.releaseRelaySigner(signerItem);
        }
    }

    /**
     * GET /v1/shop/task
     * @private
     */
    private async shop_task(req: express.Request, res: express.Response) {
        logger.http(`GET /v1/shop/task ${req.ip}:${JSON.stringify(req.query)}`);

        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(200).json(ResponseMessage.getErrorMessage("2001", { validation: errors.array() }));
        }

        try {
            const taskId: string = String(req.query.taskId).trim();
            const item = await this._storage.getTask(taskId);
            if (item === undefined) {
                return res.status(200).json(ResponseMessage.getErrorMessage("2033"));
            }
            return res.status(200).json(
                this.makeResponseData(0, {
                    taskId: item.taskId,
                    type: item.type,
                    shopId: item.shopId,
                    name: item.name,
                    currency: item.currency,
                    status: item.status,
                    taskStatus: item.taskStatus,
                    account: item.account,
                    timestamp: item.timestamp,
                })
            );
        } catch (error: any) {
            const msg = ResponseMessage.getEVMErrorMessage(error);
            logger.error(`GET /v1/shop/task : ${msg.error.message}`);
            return res.status(200).json(this.makeResponseData(msg.code, undefined, msg.error));
        }
    }

    /**
     * 상점정보를 수정한다.
     * POST /v1/shop/update/create
     * @private
     */
    private async shop_update_create(req: express.Request, res: express.Response) {
        logger.http(`POST /v1/shop/update/create ${req.ip}:${JSON.stringify(req.body)}`);

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

            const shopId: string = String(req.body.shopId).trim();
            const name: string = String(req.body.name).trim();
            const currency: string = String(req.body.currency).trim().toLowerCase();

            const shopInfo = await (await this.getShopContract()).shopOf(shopId);
            if (shopInfo.status !== ContractShopStatus.INVALID) {
                const taskId = ContractUtils.getTaskId(shopId);

                const item: ShopTaskData = {
                    taskId,
                    type: TaskResultType.UPDATE,
                    shopId,
                    name,
                    currency,
                    status: shopInfo.status,
                    account: shopInfo.account,
                    taskStatus: ShopTaskStatus.OPENED,
                    timestamp: ContractUtils.getTimeStamp(),
                    txId: "",
                    txTime: 0,
                };
                await this._storage.postTask(item);

                let hasDelegator: boolean = false;
                if (shopInfo.delegator !== AddressZero) {
                    const wallet = await this._storage.getDelegator(shopInfo.account, this._config.relay.encryptKey);
                    if (wallet !== undefined && wallet.address.toLowerCase() === shopInfo.delegator.toLowerCase()) {
                        hasDelegator = true;
                    }
                }

                if (hasDelegator) {
                    return res.status(200).json(
                        this.makeResponseData(0, {
                            taskId: item.taskId,
                            shopId: item.shopId,
                            name: item.name,
                            currency: item.currency,
                            taskStatus: item.taskStatus,
                            timestamp: item.timestamp,
                        })
                    );
                }

                const mobileData = await this._storage.getMobile(item.account, MobileType.SHOP_APP);

                if (!process.env.TESTING && mobileData === undefined) {
                    return res.status(200).json(ResponseMessage.getErrorMessage("2005"));
                }

                if (mobileData !== undefined) {
                    /// 사용자에게 메세지 발송
                    const to = mobileData.token;
                    const title = "KIOS 상점 정보 변경 요청";
                    const contents: string[] = [];
                    const data = { type: "shop_update", taskId: item.taskId };
                    contents.push(`상점이름 : ${item.name}`);
                    contents.push(`정산 환률 심벌 : ${item.currency}`);
                    await this._sender.send(to, title, contents.join(", "), data);
                }

                return res.status(200).json(
                    this.makeResponseData(0, {
                        taskId: item.taskId,
                        shopId: item.shopId,
                        name: item.name,
                        currency: item.currency,
                        taskStatus: item.taskStatus,
                        timestamp: item.timestamp,
                    })
                );
            } else {
                return res.status(200).json(ResponseMessage.getErrorMessage("1201"));
            }
        } catch (error: any) {
            const msg = ResponseMessage.getEVMErrorMessage(error);
            logger.error(`POST /v1/shop/update/create : ${msg.error.message}`);
            return res.status(200).json(msg);
        }
    }

    /**
     * 상점정보를 수정한다.
     * POST /v1/shop/update/approval
     * @private
     */
    private async shop_update_approval(req: express.Request, res: express.Response) {
        logger.http(`POST /v1/shop/update/approval ${req.ip}:${JSON.stringify(req.body)}`);

        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(200).json(ResponseMessage.getErrorMessage("2001", { validation: errors.array() }));
        }

        const signerItem = await this.getRelaySigner();
        try {
            const taskId: string = String(req.body.taskId).trim();
            const approval: boolean = String(req.body.approval).trim().toLowerCase() === "true";
            const signature: string = String(req.body.signature).trim();
            const item = await this._storage.getTask(taskId);
            if (item === undefined) {
                return res.status(200).json(ResponseMessage.getErrorMessage("2033"));
            } else {
                const contract = await this.getShopContract();

                if (item.taskStatus !== ShopTaskStatus.OPENED || item.type !== TaskResultType.UPDATE) {
                    return res.status(200).json(ResponseMessage.getErrorMessage("2040"));
                }

                const shopContract = await this.getShopContract();
                const shopInfo = await shopContract.shopOf(item.shopId);
                let approver: string = item.account;

                let hasDelegator: boolean = false;
                if (shopInfo.delegator !== AddressZero) {
                    const wallet = await this._storage.getDelegator(item.account, this._config.relay.encryptKey);
                    if (wallet !== undefined && wallet.address.toLowerCase() === shopInfo.delegator.toLowerCase()) {
                        hasDelegator = true;
                        approver = wallet.address;
                    }
                }

                if (!hasDelegator) {
                    const nonce = await shopContract.nonceOf(item.account);
                    const message = ContractUtils.getShopAccountMessage(item.shopId, item.account, nonce);
                    if (!ContractUtils.verifyMessage(item.account, message, signature)) {
                        return res.status(200).json(ResponseMessage.getErrorMessage("1501"));
                    }
                } else {
                    const nonce = await shopContract.nonceOf(shopInfo.delegator);
                    const message = ContractUtils.getShopAccountMessage(item.shopId, shopInfo.delegator, nonce);
                    if (!ContractUtils.verifyMessage(shopInfo.delegator, message, signature)) {
                        return res.status(200).json(ResponseMessage.getErrorMessage("1501"));
                    }
                }

                if (ContractUtils.getTimeStamp() - item.timestamp > this._config.relay.paymentTimeoutSecond) {
                    const data = ResponseMessage.getErrorMessage("7000");

                    item.taskStatus = ShopTaskStatus.TIMEOUT;
                    await this._storage.updateTaskStatus(item.taskId, item.taskStatus);

                    await this.sendTaskResult(
                        TaskResultType.UPDATE,
                        TaskResultCode.TIMEOUT,
                        data.error.message,
                        this.getCallBackResponse(item)
                    );

                    return res.status(200).json(data);
                }

                if (approval) {
                    try {
                        const tx = await contract
                            .connect(signerItem.signer)
                            .update(item.shopId, item.name, item.currency, approver, signature);

                        item.taskStatus = ShopTaskStatus.SENT_TX;
                        item.txId = tx.hash;
                        item.txTime = ContractUtils.getTimeStamp();
                        await this._storage.updateTaskTx(item.taskId, item.txId, item.txTime, item.taskStatus);

                        return res.status(200).json(
                            this.makeResponseData(0, {
                                taskId: item.taskId,
                                shopId: item.shopId,
                                name: item.name,
                                currency: item.currency,
                                taskStatus: item.taskStatus,
                                timestamp: item.timestamp,
                                txHash: item.txId,
                            })
                        );
                    } catch (error) {
                        item.taskStatus = ShopTaskStatus.FAILED_TX;
                        await this._storage.forcedUpdateTaskStatus(item.taskId, item.taskStatus);

                        const msg = ResponseMessage.getEVMErrorMessage(error);
                        logger.error(`POST /v1/shop/update/approval : ${msg.error.message}`);
                        return res.status(200).json(msg);
                    }
                } else {
                    item.taskStatus = ShopTaskStatus.DENIED;
                    await this._storage.updateTaskStatus(item.taskId, item.taskStatus);

                    await this.sendTaskResult(
                        TaskResultType.UPDATE,
                        TaskResultCode.DENIED,
                        "Denied by user",
                        this.getCallBackResponse(item)
                    );

                    return res.status(200).json(
                        this.makeResponseData(0, {
                            taskId: item.taskId,
                            shopId: item.shopId,
                            name: item.name,
                            currency: item.currency,
                            taskStatus: item.taskStatus,
                            timestamp: item.timestamp,
                        })
                    );
                }
            }
        } catch (error: any) {
            const msg = ResponseMessage.getEVMErrorMessage(error);
            logger.error(`POST /v1/shop/update/approval : ${msg.error.message}`);
            return res.status(200).json(msg);
        } finally {
            this.releaseRelaySigner(signerItem);
        }
    }

    /**
     * 상점정보를 삭제한다.
     * POST /v1/shop/status/create
     * @private
     */
    private async shop_status_create(req: express.Request, res: express.Response) {
        logger.http(`POST /v1/shop/status/create ${req.ip}:${JSON.stringify(req.body)}`);

        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(200).json(ResponseMessage.getErrorMessage("2001", { validation: errors.array() }));
        }

        const signerItem = await this.getRelaySigner();
        try {
            let accessKey = req.get("Authorization");
            if (accessKey === undefined) accessKey = String(req.body.accessKey).trim();
            if (accessKey !== this._config.relay.accessKey) {
                return res.json(ResponseMessage.getErrorMessage("2002"));
            }

            const shopId: string = String(req.body.shopId).trim();
            const status: number = Number(String(req.body.status).trim());
            const shopInfo = await (await this.getShopContract()).shopOf(shopId);
            if (shopInfo.status !== 0) {
                const taskId = ContractUtils.getTaskId(shopId);

                const item: ShopTaskData = {
                    taskId,
                    type: TaskResultType.STATUS,
                    shopId,
                    name: shopInfo.name,
                    currency: shopInfo.currency,
                    status,
                    account: shopInfo.account,
                    taskStatus: ShopTaskStatus.OPENED,
                    timestamp: ContractUtils.getTimeStamp(),
                    txId: "",
                    txTime: 0,
                };
                await this._storage.postTask(item);

                let hasDelegator: boolean = false;
                if (shopInfo.delegator !== AddressZero) {
                    const wallet = await this._storage.getDelegator(shopInfo.account, this._config.relay.encryptKey);
                    if (wallet !== undefined && wallet.address.toLowerCase() === shopInfo.delegator.toLowerCase()) {
                        hasDelegator = true;
                    }
                }

                if (hasDelegator) {
                    return res.status(200).json(
                        this.makeResponseData(0, {
                            taskId: item.taskId,
                            shopId: item.shopId,
                            status: item.status,
                            taskStatus: item.taskStatus,
                            timestamp: item.timestamp,
                        })
                    );
                }

                /// 사용자에게 푸쉬 메세지 발송
                const mobileData = await this._storage.getMobile(item.account, MobileType.SHOP_APP);

                if (!process.env.TESTING && mobileData === undefined) {
                    return res.status(200).json(ResponseMessage.getErrorMessage("2005"));
                }

                if (mobileData !== undefined) {
                    /// 사용자에게 메세지 발송
                    const to = mobileData.token;
                    const title = "KIOS 상점 상태 변경 요청";
                    const contents: string[] = [];
                    const data = { type: "shop_status", taskId: item.taskId };
                    contents.push(`상점이름 : ${item.name}`);
                    contents.push(`변경할 상태값 : ${item.status === ContractShopStatus.ACTIVE ? "활성" : "비활성"}`);
                    await this._sender.send(to, title, contents.join(", "), data);
                }

                return res.status(200).json(
                    this.makeResponseData(0, {
                        taskId: item.taskId,
                        shopId: item.shopId,
                        status: item.status,
                        taskStatus: item.taskStatus,
                        timestamp: item.timestamp,
                    })
                );
            } else {
                return res
                    .status(200)
                    .json(this.makeResponseData(0, undefined, { message: "존재하지 않는 상점 아이디입니다" }));
            }
        } catch (error: any) {
            const msg = ResponseMessage.getEVMErrorMessage(error);
            logger.error(`POST /v1/shop/status/create : ${msg.error.message}`);
            return res.status(200).json(msg);
        } finally {
            this.releaseRelaySigner(signerItem);
        }
    }

    /**
     * 상점정보를 수정한다.
     * POST /v1/shop/status/approval
     * @private
     */
    private async shop_status_approval(req: express.Request, res: express.Response) {
        logger.http(`POST /v1/shop/status/approval ${req.ip}:${JSON.stringify(req.body)}`);

        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(200).json(ResponseMessage.getErrorMessage("2001", { validation: errors.array() }));
        }

        const signerItem = await this.getRelaySigner();
        try {
            const taskId: string = String(req.body.taskId).trim();
            const approval: boolean = String(req.body.approval).trim().toLowerCase() === "true";
            const signature: string = String(req.body.signature).trim();
            const item = await this._storage.getTask(taskId);
            if (item === undefined) {
                return res.status(200).json(ResponseMessage.getErrorMessage("2033"));
            } else {
                if (item.taskStatus !== ShopTaskStatus.OPENED || item.type !== TaskResultType.STATUS) {
                    return res.status(200).json(ResponseMessage.getErrorMessage("2040"));
                }

                const shopContract = await this.getShopContract();
                const shopInfo = await shopContract.shopOf(item.shopId);
                let approver: string = item.account;

                let hasDelegator: boolean = false;
                if (shopInfo.delegator !== AddressZero) {
                    const wallet = await this._storage.getDelegator(shopInfo.account, this._config.relay.encryptKey);
                    if (wallet !== undefined && wallet.address.toLowerCase() === shopInfo.delegator.toLowerCase()) {
                        hasDelegator = true;
                        approver = wallet.address;
                    }
                }

                if (!hasDelegator) {
                    const nonce = await shopContract.nonceOf(item.account);
                    const message = ContractUtils.getShopAccountMessage(item.shopId, item.account, nonce);
                    if (!ContractUtils.verifyMessage(item.account, message, signature)) {
                        return res.status(200).json(ResponseMessage.getErrorMessage("1501"));
                    }
                } else {
                    const nonce = await shopContract.nonceOf(shopInfo.delegator);
                    const message = ContractUtils.getShopAccountMessage(item.shopId, shopInfo.delegator, nonce);
                    if (!ContractUtils.verifyMessage(shopInfo.delegator, message, signature)) {
                        return res.status(200).json(ResponseMessage.getErrorMessage("1501"));
                    }
                }

                if (ContractUtils.getTimeStamp() - item.timestamp > this._config.relay.paymentTimeoutSecond) {
                    const data = ResponseMessage.getErrorMessage("7000");

                    item.taskStatus = ShopTaskStatus.TIMEOUT;
                    await this._storage.updateTaskStatus(item.taskId, item.taskStatus);

                    await this.sendTaskResult(
                        TaskResultType.STATUS,
                        TaskResultCode.TIMEOUT,
                        data.error.message,
                        this.getCallBackResponse(item)
                    );
                    return res.status(200).json(data);
                }

                if (approval) {
                    const contract = await this.getShopContract();
                    try {
                        const tx = await contract
                            .connect(signerItem.signer)
                            .changeStatus(item.shopId, item.status, approver, signature);

                        item.taskStatus = ShopTaskStatus.SENT_TX;
                        item.txId = tx.hash;
                        item.txTime = ContractUtils.getTimeStamp();
                        await this._storage.updateTaskTx(item.taskId, item.txId, item.txTime, item.taskStatus);

                        return res.status(200).json(
                            this.makeResponseData(0, {
                                taskId: item.taskId,
                                shopId: item.shopId,
                                status: item.status,
                                taskStatus: item.taskStatus,
                                timestamp: item.timestamp,
                                txHash: item.txId,
                            })
                        );
                    } catch (error) {
                        item.taskStatus = ShopTaskStatus.FAILED_TX;
                        await this._storage.forcedUpdateTaskStatus(item.taskId, item.taskStatus);

                        const msg = ResponseMessage.getEVMErrorMessage(error);
                        logger.error(`POST /v1/shop/status/approval : ${msg.error.message}`);
                        return res.status(200).json(msg);
                    }
                } else {
                    item.taskStatus = ShopTaskStatus.DENIED;
                    await this._storage.updateTaskStatus(item.taskId, item.taskStatus);

                    await this.sendTaskResult(
                        TaskResultType.STATUS,
                        TaskResultCode.DENIED,
                        "Denied by user",
                        this.getCallBackResponse(item)
                    );

                    return res.status(200).json(
                        this.makeResponseData(0, {
                            taskId: item.taskId,
                            shopId: item.shopId,
                            status: item.status,
                            taskStatus: item.taskStatus,
                            timestamp: item.timestamp,
                        })
                    );
                }
            }
        } catch (error: any) {
            const msg = ResponseMessage.getEVMErrorMessage(error);
            logger.error(`POST /v1/shop/status/approval : ${msg.error.message}`);
            return res.status(200).json(msg);
        } finally {
            this.releaseRelaySigner(signerItem);
        }
    }

    /**
     * 상점 정산금을 인출 신청한다.
     * POST /v1/shop/withdrawal/open
     * @private
     */
    private async shop_withdrawal_open(req: express.Request, res: express.Response) {
        logger.http(`POST /v1/shop/withdrawal/open ${req.ip}:${JSON.stringify(req.body)}`);

        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(200).json(ResponseMessage.getErrorMessage("2001", { validation: errors.array() }));
        }

        const signerItem = await this.getRelaySigner();
        try {
            const shopId: string = String(req.body.shopId).trim();
            const amount: string = String(req.body.amount).trim(); // 구매 금액
            const account: string = String(req.body.account).trim();
            const signature: string = String(req.body.signature).trim(); // 서명

            // 서명검증
            const nonce = await (await this.getShopContract()).nonceOf(account);
            const message = ContractUtils.getShopAccountMessage(shopId, account, nonce);
            if (!ContractUtils.verifyMessage(account, message, signature))
                return res.status(200).json(ResponseMessage.getErrorMessage("1501"));

            const tx = await (await this.getShopContract())
                .connect(signerItem.signer)
                .openWithdrawal(shopId, amount, account, signature);

            logger.http(`TxHash(/v1/shop/withdrawal/open): ${tx.hash}`);
            return res.status(200).json(this.makeResponseData(0, { txHash: tx.hash }));
        } catch (error: any) {
            const msg = ResponseMessage.getEVMErrorMessage(error);
            logger.error(`POST /v1/shop/withdrawal/open : ${msg.error.message}`);
            return res.status(200).json(msg);
        } finally {
            this.releaseRelaySigner(signerItem);
        }
    }

    /**
     * 상점 정산금을 인출을 받은것을 확인한다.
     * POST /v1/shop/withdrawal/close
     * @private
     */
    private async shop_withdrawal_close(req: express.Request, res: express.Response) {
        logger.http(`POST /v1/shop/withdrawal/close ${req.ip}:${JSON.stringify(req.body)}`);

        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(200).json(ResponseMessage.getErrorMessage("2001", { validation: errors.array() }));
        }

        const signerItem = await this.getRelaySigner();
        try {
            const shopId: string = String(req.body.shopId).trim();
            const account: string = String(req.body.account).trim();
            const signature: string = String(req.body.signature).trim(); // 서명

            // 서명검증
            const nonce = await (await this.getShopContract()).nonceOf(account);
            const message = ContractUtils.getShopAccountMessage(shopId, account, nonce);
            if (!ContractUtils.verifyMessage(account, message, signature))
                return res.status(200).json(ResponseMessage.getErrorMessage("1501"));

            const tx = await (await this.getShopContract())
                .connect(signerItem.signer)
                .closeWithdrawal(shopId, account, signature);

            logger.http(`TxHash(/v1/shop/withdrawal/close): ${tx.hash}`);
            return res.status(200).json(this.makeResponseData(0, { txHash: tx.hash }));
        } catch (error: any) {
            const msg = ResponseMessage.getEVMErrorMessage(error);
            logger.error(`POST /v1/shop/withdrawal/close : ${msg.error.message}`);
            return res.status(200).json(msg);
        } finally {
            this.releaseRelaySigner(signerItem);
        }
    }

    private getCallBackResponse(item: ShopTaskData): any {
        return {
            taskId: item.taskId,
            shopId: item.shopId,
            name: item.name,
            currency: item.currency,
            status: item.status,
            account: item.account,
        };
    }

    private async waitAndAddEvent(
        contract: Shop,
        tx: ContractTransaction
    ): Promise<ContractShopUpdateEvent | undefined> {
        const contractReceipt = await tx.wait();
        const log = ContractUtils.findLog(contractReceipt, contract.interface, "AddedShop");
        if (log !== undefined) {
            const parsedLog = contract.interface.parseLog(log);

            return {
                shopId: parsedLog.args.shopId,
                name: parsedLog.args.name,
                currency: parsedLog.args.currency,
                account: parsedLog.args.account,
                status: parsedLog.args.status,
            };
        } else return undefined;
    }

    private async sendTaskResult(type: TaskResultType, code: TaskResultCode, message: string, data: any) {
        try {
            const client = new HTTPClient();
            const res = await client.post(this._config.relay.callbackEndpoint, {
                accessKey: this._config.relay.callbackAccessKey,
                type,
                code,
                message,
                data,
            });
            logger.info(res.data);
        } catch (error) {
            if (error instanceof Error) {
                logger.error(`sendTaskResult : ${error.message}`);
            } else {
                logger.error(`sendTaskResult : ${JSON.stringify(error)}`);
            }
        }
    }

    /**
     * GET /v1/shop/list
     * @private
     */
    private async shop_list(req: express.Request, res: express.Response) {
        logger.http(`GET /v1/shop/list ${req.ip}:${JSON.stringify(req.query)}`);

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

            let pageSize = Number(req.query.pageSize);
            if (pageSize > 50) pageSize = 50;
            let pageNumber = Number(req.query.pageNumber);
            if (pageNumber < 1) pageNumber = 1;

            const shops = await this._graph.getShopList(pageNumber, pageSize);
            const pageInfo = await this._graph.getShopPageInfo(pageSize);
            return res.status(200).json(
                this.makeResponseData(0, {
                    pageInfo,
                    shops: shops.map((m) => {
                        return {
                            shopId: m.shopId,
                            name: m.name,
                            currency: m.currency,
                            status: m.status,
                            account: m.account,
                            providedAmount: m.providedAmount.toString(),
                            usedAmount: m.usedAmount.toString(),
                            settledAmount: m.settledAmount.toString(),
                            withdrawnAmount: m.withdrawnAmount.toString(),
                            withdrawReqId: m.withdrawReqId.toString(),
                            withdrawReqAmount: m.withdrawReqAmount.toString(),
                            withdrawReqStatus: m.withdrawReqStatus,
                        };
                    }),
                })
            );
        } catch (error: any) {
            const msg = ResponseMessage.getEVMErrorMessage(error);
            logger.error(`GET /v1/shop/list : ${msg.error.message}`);
            return res.status(200).json(this.makeResponseData(msg.code, undefined, msg.error));
        }
    }
}
