import { CurrencyRate, Ledger, PhoneLinkCollection, ShopCollection, Token } from "../../typechain-types";
import { Config } from "../common/Config";
import { logger } from "../common/Logger";
import { WebService } from "../service/WebService";
import { ContractUtils } from "../utils/ContractUtils";
import { Validation } from "../validation";

import { body, query, validationResult } from "express-validator";
import * as hre from "hardhat";

import { BigNumber, ContractTransaction } from "ethers";
import express from "express";
import { ISignerItem, RelaySigners } from "../contract/Signers";
import { INotificationSender } from "../delegator/NotificationSender";
import { RelayStorage } from "../storage/RelayStorage";
import {
    ContractShopStatus,
    ContractShopStatusEvent,
    ContractShopUpdateEvent,
    ShopTaskData,
    ShopTaskStatus,
    TaskResultCode,
    TaskResultType,
} from "../types";
import { ResponseMessage } from "../utils/Errors";
import { HTTPClient } from "../utils/Utils";

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
    private _shopContract: ShopCollection | undefined;

    private _storage: RelayStorage;

    private readonly _sender: INotificationSender;

    /**
     *
     * @param service  WebService
     * @param config Configuration
     * @param storage
     * @param relaySigners
     * @param sender
     */
    constructor(
        service: WebService,
        config: Config,
        storage: RelayStorage,
        relaySigners: RelaySigners,
        sender: INotificationSender
    ) {
        this._web_service = service;
        this._config = config;

        this._storage = storage;
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

    private async getShopContract(): Promise<ShopCollection> {
        if (this._shopContract === undefined) {
            const shopFactory = await hre.ethers.getContractFactory("ShopCollection");
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
            "/v1/shop/add",
            [
                body("shopId")
                    .exists()
                    .matches(/^(0x)[0-9a-f]{64}$/i),
                body("name").exists(),
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
                body("accessKey").exists(),
                body("shopId")
                    .exists()
                    .trim()
                    .matches(/^(0x)[0-9a-f]{64}$/i),
                body("name").exists(),
                body("provideWaitTime").exists().custom(Validation.isAmount),
                body("providePercent").exists().custom(Validation.isAmount),
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
                body("accessKey").exists(),
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
            return res.status(200).json(ResponseMessage.getErrorMessage("2001", { validation: errors.array() }));
        }

        const signerItem = await this.getRelaySigner();
        try {
            const shopId: string = String(req.body.shopId).trim();
            const name: string = String(req.body.name).trim();
            const account: string = String(req.body.account).trim();
            const signature: string = String(req.body.signature).trim(); // 서명

            const contract = await this.getShopContract();
            if (!ContractUtils.verifyShop(shopId, await contract.nonceOf(account), account, signature))
                return res.status(200).json(ResponseMessage.getErrorMessage("1501"));

            const tx = await contract.connect(signerItem.signer).add(shopId, name, account, signature);

            logger.http(`TxHash(/v1/shop/add): ${tx.hash}`);
            res.status(200).json(this.makeResponseData(0, { txHash: tx.hash }));

            const event = await this.waitAndAddEvent(contract, tx);
            if (event !== undefined) {
                await this.sendTaskResult(TaskResultType.ADD, TaskResultCode.SUCCESS, "Success", {
                    taskId: "",
                    shopId: event.shopId,
                    name: event.name,
                    provideWaitTime: BigNumber.from(event.providePercent).toNumber(),
                    providePercent: BigNumber.from(event.providePercent).toNumber(),
                    status: event.status,
                    account: event.account,
                });
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
        logger.http(`GET /v1/shop/task`);

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
                    provideWaitTime: item.provideWaitTime,
                    providePercent: item.providePercent,
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
        logger.http(`POST /v1/shop/update/create`);

        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(200).json(ResponseMessage.getErrorMessage("2001", { validation: errors.array() }));
        }

        try {
            const accessKey: string = String(req.body.accessKey).trim();
            if (accessKey !== this._config.relay.accessKey) {
                return res.json(ResponseMessage.getErrorMessage("2002"));
            }

            const shopId: string = String(req.body.shopId).trim();
            const name: string = String(req.body.name).trim();
            const provideWaitTime: number = Number(String(req.body.provideWaitTime).trim());
            const providePercent: number = Number(String(req.body.providePercent).trim());

            const shopInfo = await (await this.getShopContract()).shopOf(shopId);
            if (shopInfo.status !== ContractShopStatus.INVALID) {
                const taskId = ContractUtils.getTaskId(shopId);

                const item: ShopTaskData = {
                    taskId,
                    type: TaskResultType.UPDATE,
                    shopId,
                    name,
                    provideWaitTime,
                    providePercent,
                    status: shopInfo.status,
                    account: shopInfo.account,
                    taskStatus: ShopTaskStatus.OPENED,
                    timestamp: ContractUtils.getTimeStamp(),
                };
                await this._storage.postTask(item);

                /// 사용자에게 푸쉬 메세지 발송
                const title = "KIOS 상점 정보 변경 요청";
                const contents: string[] = [];
                contents.push(`상점이름 : ${item.name}`);
                contents.push(`작업아이디 : ${item.taskId}`);
                contents.push(`적립비율 : ${item.providePercent}`);
                contents.push(`지연시간 : ${item.provideWaitTime}`);
                this._sender.send(title, contents.join("\n"));

                return res.status(200).json(
                    this.makeResponseData(0, {
                        taskId: item.taskId,
                        shopId: item.shopId,
                        name: item.name,
                        provideWaitTime: item.provideWaitTime,
                        providePercent: item.providePercent,
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
        logger.http(`POST /v1/shop/update/approval`);

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

                const nonce = await contract.nonceOf(item.account);
                if (!ContractUtils.verifyShop(item.shopId, nonce, item.account, signature)) {
                    return res.status(200).json(ResponseMessage.getErrorMessage("1501"));
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
                    const certifier = signerItem.signer;
                    const signature2 = await ContractUtils.signShop(
                        certifier,
                        item.shopId,
                        await contract.nonceOf(await certifier.getAddress())
                    );

                    try {
                        const tx = await contract
                            .connect(signerItem.signer)
                            .update(
                                item.shopId,
                                item.name,
                                item.provideWaitTime,
                                item.providePercent,
                                item.account,
                                signature,
                                await certifier.getAddress(),
                                signature2
                            );

                        item.taskStatus = ShopTaskStatus.CONFIRMED;
                        await this._storage.updateTaskStatus(item.taskId, item.taskStatus);

                        const event = await this.waitAndUpdateEvent(contract, tx);
                        if (event !== undefined) {
                            item.name = event.name;
                            item.providePercent = event.providePercent;
                            item.provideWaitTime = event.provideWaitTime;
                            item.status = event.status;
                            item.taskStatus = ShopTaskStatus.COMPLETED;
                            await this._storage.updateTask(item);

                            await this.sendTaskResult(
                                TaskResultType.UPDATE,
                                TaskResultCode.SUCCESS,
                                "Success",
                                this.getCallBackResponse(item)
                            );

                            return res.status(200).json(
                                this.makeResponseData(0, {
                                    taskId: item.taskId,
                                    shopId: item.shopId,
                                    name: item.name,
                                    provideWaitTime: item.provideWaitTime,
                                    providePercent: item.providePercent,
                                    taskStatus: item.taskStatus,
                                    timestamp: item.timestamp,
                                    txHash: tx.hash,
                                })
                            );
                        } else {
                            return res.status(200).json(ResponseMessage.getErrorMessage("5000"));
                        }
                    } catch (error) {
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
                            provideWaitTime: item.provideWaitTime,
                            providePercent: item.providePercent,
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
        logger.http(`POST /v1/shop/status/create`);

        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(200).json(ResponseMessage.getErrorMessage("2001", { validation: errors.array() }));
        }

        const signerItem = await this.getRelaySigner();
        try {
            const accessKey: string = String(req.body.accessKey).trim();
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
                    provideWaitTime: shopInfo.provideWaitTime.toNumber(),
                    providePercent: shopInfo.providePercent.toNumber(),
                    status,
                    account: shopInfo.account,
                    taskStatus: ShopTaskStatus.OPENED,
                    timestamp: ContractUtils.getTimeStamp(),
                };
                await this._storage.postTask(item);

                /// 사용자에게 푸쉬 메세지 발송
                const title = "KIOS 상점 상태 변경 요청";
                const contents: string[] = [];
                contents.push(`상점 이름 : ${item.name}`);
                contents.push(`상태 : ${item.status}`);
                contents.push(`처리 아이디 : ${item.taskId}`);
                this._sender.send(title, contents.join("\n"));

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
        logger.http(`POST /v1/shop/status/approval`);

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

                if (
                    !ContractUtils.verifyShop(
                        item.shopId,
                        await (await this.getShopContract()).nonceOf(item.account),
                        item.account,
                        signature
                    )
                ) {
                    return res.status(200).json(ResponseMessage.getErrorMessage("1501"));
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
                    const certifier = signerItem.signer;
                    const signature2 = await ContractUtils.signShop(
                        certifier,
                        item.shopId,
                        await contract.nonceOf(await certifier.getAddress())
                    );

                    try {
                        const tx = await contract
                            .connect(signerItem.signer)
                            .changeStatus(
                                item.shopId,
                                item.status,
                                item.account,
                                signature,
                                await certifier.getAddress(),
                                signature2
                            );

                        item.taskStatus = ShopTaskStatus.CONFIRMED;
                        await this._storage.updateTaskStatus(item.taskId, item.taskStatus);

                        const event = await this.waitAndChangeStatusEvent(contract, tx);
                        if (event !== undefined) {
                            item.status = event.status;
                            item.taskStatus = ShopTaskStatus.COMPLETED;
                            await this._storage.updateTask(item);

                            await this.sendTaskResult(
                                TaskResultType.STATUS,
                                TaskResultCode.SUCCESS,
                                "Success",
                                this.getCallBackResponse(item)
                            );

                            return res.status(200).json(
                                this.makeResponseData(0, {
                                    taskId: item.taskId,
                                    shopId: item.shopId,
                                    status: item.status,
                                    taskStatus: item.taskStatus,
                                    timestamp: item.timestamp,
                                    txHash: tx.hash,
                                })
                            );
                        } else {
                            return res.status(200).json(ResponseMessage.getErrorMessage("5000"));
                        }
                    } catch (error) {
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
        logger.http(`POST /v1/shop/withdrawal/open`);

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
            if (!ContractUtils.verifyShop(shopId, nonce, account, signature))
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
        logger.http(`POST /v1/shop/withdrawal/close`);

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
            if (!ContractUtils.verifyShop(shopId, nonce, account, signature))
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
            provideWaitTime: item.provideWaitTime,
            providePercent: item.providePercent,
            status: item.status,
            account: item.account,
        };
    }

    private async waitAndAddEvent(
        contract: ShopCollection,
        tx: ContractTransaction
    ): Promise<ContractShopUpdateEvent | undefined> {
        const contractReceipt = await tx.wait();
        const log = ContractUtils.findLog(contractReceipt, contract.interface, "AddedShop");
        if (log !== undefined) {
            const parsedLog = contract.interface.parseLog(log);

            return {
                shopId: parsedLog.args.shopId,
                name: parsedLog.args.name,
                provideWaitTime: (parsedLog.args.provideWaitTime as BigNumber).toNumber(),
                providePercent: (parsedLog.args.providePercent as BigNumber).toNumber(),
                account: parsedLog.args.account,
                status: parsedLog.args.status,
            };
        } else return undefined;
    }

    private async waitAndUpdateEvent(
        contract: ShopCollection,
        tx: ContractTransaction
    ): Promise<ContractShopUpdateEvent | undefined> {
        const contractReceipt = await tx.wait();
        const log = ContractUtils.findLog(contractReceipt, contract.interface, "UpdatedShop");
        if (log !== undefined) {
            const parsedLog = contract.interface.parseLog(log);

            return {
                shopId: parsedLog.args.shopId,
                name: parsedLog.args.name,
                provideWaitTime: (parsedLog.args.provideWaitTime as BigNumber).toNumber(),
                providePercent: (parsedLog.args.providePercent as BigNumber).toNumber(),
                account: parsedLog.args.account,
                status: parsedLog.args.status,
            };
        } else return undefined;
    }

    private async waitAndChangeStatusEvent(
        contract: ShopCollection,
        tx: ContractTransaction
    ): Promise<ContractShopStatusEvent | undefined> {
        const contractReceipt = await tx.wait();
        const log = ContractUtils.findLog(contractReceipt, contract.interface, "ChangedShopStatus");
        if (log !== undefined) {
            const parsedLog = contract.interface.parseLog(log);
            return {
                shopId: parsedLog.args.shopId,
                status: parsedLog.args.status,
            };
        } else return undefined;
    }

    private async sendTaskResult(type: TaskResultType, code: TaskResultCode, message: string, data: any) {
        try {
            const client = new HTTPClient();
            await client.post(this._config.relay.callbackEndpoint, {
                accessKey: this._config.relay.callbackAccessKey,
                type,
                code,
                message,
                data,
            });
        } catch (error) {
            if (error instanceof Error) {
                logger.error(`sendTaskResult : ${error.message}`);
            } else {
                logger.error(`sendTaskResult : ${JSON.stringify(error)}`);
            }
        }
    }
}
