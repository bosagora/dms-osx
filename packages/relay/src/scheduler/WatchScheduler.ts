import "@nomiclabs/hardhat-ethers";
import { Ledger, LoyaltyConsumer, Shop } from "../../typechain-types";
import { Config } from "../common/Config";
import { logger } from "../common/Logger";
import { ISignerItem, RelaySigners } from "../contract/Signers";
import { RelayStorage } from "../storage/RelayStorage";
import { ContractUtils } from "../utils/ContractUtils";
import { HTTPClient } from "../utils/Utils";
import { Scheduler } from "./Scheduler";

import { BigNumber } from "ethers";
import * as hre from "hardhat";
import {
    ContractLoyaltyPaymentEvent,
    ContractLoyaltyType,
    ContractShopStatusEvent,
    ContractShopUpdateEvent,
    LoyaltyPaymentTaskData,
    LoyaltyPaymentTaskStatus,
    PaymentResultData,
    ShopTaskData,
    ShopTaskStatus,
    TaskResultCode,
    TaskResultType,
} from "../types";

// tslint:disable-next-line:no-implicit-dependencies
import { ContractTransaction } from "@ethersproject/contracts";

/**
 * Creates blocks at regular intervals and stores them in IPFS and databases.
 */
export class WatchScheduler extends Scheduler {
    private _config: Config | undefined;

    private _storage: RelayStorage | undefined;

    private _ledgerContract: Ledger | undefined;

    private _shopContract: Shop | undefined;

    private _signers: RelaySigners | undefined;

    constructor(expression: string) {
        super(expression);
    }

    private get config(): Config {
        if (this._config !== undefined) return this._config;
        else {
            logger.error("Config is not ready yet.");
            process.exit(1);
        }
    }

    private get storage(): RelayStorage {
        if (this._storage !== undefined) return this._storage;
        else {
            logger.error("Storage is not ready yet.");
            process.exit(1);
        }
    }

    private get signers(): RelaySigners {
        if (this._signers !== undefined) return this._signers;
        else {
            logger.error("Signers is not ready yet.");
            process.exit(1);
        }
    }

    private async getRelaySigner(): Promise<ISignerItem> {
        return this.signers.getSigner();
    }

    private releaseRelaySigner(signer: ISignerItem) {
        signer.using = false;
    }

    public setOption(options: any) {
        if (options) {
            if (options.config && options.config instanceof Config) this._config = options.config;
            if (options.storage && options.storage instanceof RelayStorage) this._storage = options.storage;
            if (options.signers && options.signers instanceof RelaySigners) this._signers = options.signers;
        }
    }

    public async onStart() {
        //
    }

    protected async work() {
        try {
            await this.onWatchPayment();
            await this.onWatchTask();
        } catch (error) {
            logger.error(`Failed to execute the WatchScheduler: ${error}`);
        }
    }

    private async getLedgerContract(): Promise<Ledger> {
        if (this._ledgerContract === undefined) {
            const ledgerFactory = await hre.ethers.getContractFactory("Ledger");
            this._ledgerContract = ledgerFactory.attach(this.config.contracts.ledgerAddress);
        }
        return this._ledgerContract;
    }

    private _consumerContract: LoyaltyConsumer | undefined;
    private async getConsumerContract(): Promise<LoyaltyConsumer> {
        if (this._consumerContract === undefined) {
            const factory = await hre.ethers.getContractFactory("LoyaltyConsumer");
            this._consumerContract = factory.attach(this.config.contracts.consumerAddress);
        }
        return this._consumerContract;
    }

    private async getShopContract(): Promise<Shop> {
        if (this._shopContract === undefined) {
            const factory = await hre.ethers.getContractFactory("Shop");
            this._shopContract = factory.attach(this.config.contracts.shopAddress) as Shop;
        }
        return this._shopContract;
    }

    /// region Payment
    private async onWatchPayment() {
        const payments = await this.storage.getPaymentsStatusOf([
            LoyaltyPaymentTaskStatus.APPROVED_NEW_SENT_TX,
            LoyaltyPaymentTaskStatus.APPROVED_CANCEL_SENT_TX,
        ]);
        for (const payment of payments) {
            if (payment.paymentStatus === LoyaltyPaymentTaskStatus.APPROVED_NEW_SENT_TX) {
                await this.onApproveNewPayment(payment);
            } else if (payment.paymentStatus === LoyaltyPaymentTaskStatus.APPROVED_CANCEL_SENT_TX) {
                await this.onApproveCancelPayment(payment);
            }
        }
    }

    private async onApproveNewPayment(payment: LoyaltyPaymentTaskData) {
        logger.info(`WatchScheduler.onApproveNewPayment ${payment.paymentId}`);
        const contract = await this.getConsumerContract();
        const signerItem = await this.getRelaySigner();
        try {
            if (signerItem.signer.provider) {
                const contractTx = (await signerItem.signer.provider.getTransaction(
                    payment.openNewTxId
                )) as ContractTransaction;
                const event = await this.waitPaymentLoyalty(contract, contractTx);
                if (event !== undefined) {
                    this.updateEvent(event, payment);
                    const item = await this.storage.getPayment(payment.paymentId);
                    if (item !== undefined && item.paymentStatus === LoyaltyPaymentTaskStatus.APPROVED_NEW_SENT_TX) {
                        payment.paymentStatus = LoyaltyPaymentTaskStatus.APPROVED_NEW_CONFIRMED_TX;
                        await this.storage.updatePayment(payment);
                    }

                    await this.sendPaymentResult(
                        TaskResultType.NEW,
                        TaskResultCode.SUCCESS,
                        "Success",
                        this.getCallBackResponse(payment)
                    );

                    if (item !== undefined && item.paymentStatus === LoyaltyPaymentTaskStatus.APPROVED_NEW_SENT_TX) {
                        payment.paymentStatus = LoyaltyPaymentTaskStatus.REPLY_COMPLETED_NEW;
                        await this.storage.updatePaymentStatus(payment.paymentId, payment.paymentStatus);
                    }
                } else {
                    const item = await this.storage.getPayment(payment.paymentId);
                    if (item !== undefined && item.paymentStatus === LoyaltyPaymentTaskStatus.APPROVED_NEW_SENT_TX) {
                        payment.paymentStatus = LoyaltyPaymentTaskStatus.APPROVED_NEW_REVERTED_TX;
                        await this.storage.forcedUpdatePaymentStatus(payment.paymentId, payment.paymentStatus);
                    }
                }
            }
        } catch (error) {
            payment.paymentStatus = LoyaltyPaymentTaskStatus.APPROVED_NEW_REVERTED_TX;
            await this.storage.forcedUpdatePaymentStatus(payment.paymentId, payment.paymentStatus);
        } finally {
            this.releaseRelaySigner(signerItem);
        }
    }

    private async onApproveCancelPayment(payment: LoyaltyPaymentTaskData) {
        logger.info(`WatchScheduler.onApproveCancelPayment ${payment.paymentId}`);
        const contract = await this.getConsumerContract();
        const signerItem = await this.getRelaySigner();
        try {
            if (signerItem.signer.provider) {
                const contractTx = (await signerItem.signer.provider.getTransaction(
                    payment.openCancelTxId
                )) as ContractTransaction;
                const event = await this.waitPaymentLoyalty(contract, contractTx);
                if (event !== undefined) {
                    this.updateEvent(event, payment);
                    const item = await this.storage.getPayment(payment.paymentId);
                    if (item !== undefined && item.paymentStatus === LoyaltyPaymentTaskStatus.APPROVED_CANCEL_SENT_TX) {
                        payment.paymentStatus = LoyaltyPaymentTaskStatus.APPROVED_CANCEL_CONFIRMED_TX;
                        await this.storage.updatePayment(payment);
                    }

                    await this.sendPaymentResult(
                        TaskResultType.CANCEL,
                        TaskResultCode.SUCCESS,
                        "Success",
                        this.getCallBackResponse(payment)
                    );

                    if (item !== undefined && item.paymentStatus === LoyaltyPaymentTaskStatus.APPROVED_CANCEL_SENT_TX) {
                        payment.paymentStatus = LoyaltyPaymentTaskStatus.REPLY_COMPLETED_CANCEL;
                        await this.storage.updatePaymentStatus(payment.paymentId, payment.paymentStatus);
                    }
                } else {
                    const item = await this.storage.getPayment(payment.paymentId);
                    if (item !== undefined && item.paymentStatus === LoyaltyPaymentTaskStatus.APPROVED_CANCEL_SENT_TX) {
                        payment.paymentStatus = LoyaltyPaymentTaskStatus.APPROVED_CANCEL_REVERTED_TX;
                        await this.storage.forcedUpdatePaymentStatus(payment.paymentId, payment.paymentStatus);
                    }
                }
            }
        } catch (error) {
            payment.paymentStatus = LoyaltyPaymentTaskStatus.APPROVED_CANCEL_REVERTED_TX;
            await this.storage.forcedUpdatePaymentStatus(payment.paymentId, payment.paymentStatus);
        } finally {
            this.releaseRelaySigner(signerItem);
        }
    }

    private getCallBackResponse(item: LoyaltyPaymentTaskData): any {
        return {
            paymentId: item.paymentId,
            purchaseId: item.purchaseId,
            amount: item.amount.toString(),
            currency: item.currency,
            shopId: item.shopId,
            account: item.account,
            loyaltyType: item.loyaltyType,
            paidPoint: item.paidPoint.toString(),
            paidToken: item.paidToken.toString(),
            paidValue: item.paidValue.toString(),
            feePoint: item.feePoint.toString(),
            feeToken: item.feeToken.toString(),
            feeValue: item.feeValue.toString(),
            totalPoint: item.totalPoint.toString(),
            totalToken: item.totalToken.toString(),
            totalValue: item.totalValue.toString(),
            paymentStatus: item.paymentStatus,
        };
    }

    private updateEvent(event: ContractLoyaltyPaymentEvent, item: LoyaltyPaymentTaskData): void {
        if (item.paymentId !== event.paymentId) return;
        item.purchaseId = event.purchaseId;
        item.currency = event.currency;
        item.shopId = event.shopId;
        item.account = event.account;
        item.loyaltyType = event.loyaltyType;
        item.paidPoint = event.paidPoint;
        item.paidToken = event.paidToken;
        item.paidValue = event.paidValue;
        item.feePoint = event.feePoint;
        item.feeToken = event.feeToken;
        item.feeValue = event.feeValue;
        item.totalPoint = event.totalPoint;
        item.totalToken = event.totalToken;
        item.totalValue = event.totalValue;
        item.contractStatus = event.status;
    }

    private async waitPaymentLoyalty(
        contract: LoyaltyConsumer,
        tx: ContractTransaction
    ): Promise<ContractLoyaltyPaymentEvent | undefined> {
        const res: any = {};
        const contractReceipt = await tx.wait();
        const log = ContractUtils.findLog(contractReceipt, contract.interface, "LoyaltyPaymentEvent");
        if (log !== undefined) {
            const parsedLog = contract.interface.parseLog(log);

            res.paymentId = parsedLog.args.payment.paymentId;
            res.purchaseId = parsedLog.args.payment.purchaseId;
            res.amount = BigNumber.from(parsedLog.args.payment.paidValue);
            res.currency = parsedLog.args.payment.currency;
            res.shopId = parsedLog.args.payment.shopId;
            res.account = parsedLog.args.payment.account;
            res.timestamp = parsedLog.args.payment.timestamp;
            res.loyaltyType = parsedLog.args.payment.loyaltyType;
            res.paidPoint =
                parsedLog.args.payment.loyaltyType === ContractLoyaltyType.POINT
                    ? BigNumber.from(parsedLog.args.payment.paidPoint)
                    : BigNumber.from(0);
            res.paidToken =
                parsedLog.args.payment.loyaltyType === ContractLoyaltyType.TOKEN
                    ? BigNumber.from(parsedLog.args.payment.paidToken)
                    : BigNumber.from(0);
            res.paidValue = BigNumber.from(parsedLog.args.payment.paidValue);

            res.feePoint =
                parsedLog.args.payment.loyaltyType === ContractLoyaltyType.POINT
                    ? BigNumber.from(parsedLog.args.payment.feePoint)
                    : BigNumber.from(0);
            res.feeToken =
                parsedLog.args.payment.loyaltyType === ContractLoyaltyType.TOKEN
                    ? BigNumber.from(parsedLog.args.payment.feeToken)
                    : BigNumber.from(0);
            res.feeValue = BigNumber.from(parsedLog.args.payment.feeValue);

            res.status = BigNumber.from(parsedLog.args.payment.status);
            res.balance = BigNumber.from(parsedLog.args.balance);

            res.totalPoint = res.paidPoint.add(res.feePoint);
            res.totalToken = res.paidToken.add(res.feeToken);
            res.totalValue = res.paidValue.add(res.feeValue);

            return res;
        } else return undefined;
    }

    private async sendPaymentResult(
        type: TaskResultType,
        code: TaskResultCode,
        message: string,
        data: PaymentResultData
    ) {
        try {
            const client = new HTTPClient({
                headers: {
                    Authorization: this.config.relay.callbackAccessKey,
                },
            });
            const res = await client.post(this.config.relay.callbackEndpoint, {
                accessKey: this.config.relay.callbackAccessKey,
                type,
                code,
                message,
                data,
            });
            logger.info(res.data);
        } catch (error) {
            if (error instanceof Error) {
                logger.error(`sendPaymentResult : ${error.message}`);
            } else {
                logger.error(`sendPaymentResult : ${JSON.stringify(error)}`);
            }
        }
    }
    /// endregion

    /// region Task
    private async onWatchTask() {
        const tasks = await this.storage.getTasksStatusOf(
            [TaskResultType.ADD, TaskResultType.UPDATE, TaskResultType.STATUS],
            [ShopTaskStatus.SENT_TX]
        );
        for (const task of tasks) {
            if (task.type === TaskResultType.ADD) {
                await this.onAddShop(task);
            } else if (task.type === TaskResultType.UPDATE) {
                await this.onUpdateShop(task);
            } else if (task.type === TaskResultType.STATUS) {
                await this.onChangeStatusOfShop(task);
            }
        }
    }

    private async onAddShop(task: ShopTaskData) {
        logger.info(`WatchScheduler.onAddShop ${task.taskId}`);
        const contract = await this.getShopContract();
        const signerItem = await this.getRelaySigner();
        try {
            if (signerItem.signer.provider) {
                const contractTx = (await signerItem.signer.provider.getTransaction(task.txId)) as ContractTransaction;
                const event = await this.waitAndAddEvent(contract, contractTx);
                if (event !== undefined) {
                    task.taskStatus = ShopTaskStatus.COMPLETED;
                    task.name = event.name;
                    task.currency = event.currency;
                    task.status = event.status;
                    await this.storage.updateTask(task);

                    await this.sendPaymentResult(
                        TaskResultType.ADD,
                        TaskResultCode.SUCCESS,
                        "Success",
                        this.getCallBackResponseOfTask(task)
                    );
                } else {
                    task.taskStatus = ShopTaskStatus.REVERTED_TX;
                    await this.storage.forcedUpdateTaskStatus(task.taskId, task.taskStatus);
                }
            }
        } catch (error) {
            task.taskStatus = ShopTaskStatus.REVERTED_TX;
            await this.storage.forcedUpdateTaskStatus(task.taskId, task.taskStatus);
        } finally {
            this.releaseRelaySigner(signerItem);
        }
    }

    private async onUpdateShop(task: ShopTaskData) {
        logger.info(`WatchScheduler.onUpdateShop ${task.taskId}`);
        const contract = await this.getShopContract();
        const signerItem = await this.getRelaySigner();
        try {
            if (signerItem.signer.provider) {
                const contractTx = (await signerItem.signer.provider.getTransaction(task.txId)) as ContractTransaction;
                const event = await this.waitAndUpdateEvent(contract, contractTx);
                if (event !== undefined) {
                    task.taskStatus = ShopTaskStatus.COMPLETED;
                    task.name = event.name;
                    task.currency = event.currency;
                    task.status = event.status;
                    await this.storage.updateTask(task);

                    await this.sendPaymentResult(
                        TaskResultType.UPDATE,
                        TaskResultCode.SUCCESS,
                        "Success",
                        this.getCallBackResponseOfTask(task)
                    );
                } else {
                    task.taskStatus = ShopTaskStatus.REVERTED_TX;
                    await this.storage.forcedUpdateTaskStatus(task.taskId, task.taskStatus);
                }
            }
        } catch (error) {
            task.taskStatus = ShopTaskStatus.REVERTED_TX;
            await this.storage.forcedUpdateTaskStatus(task.taskId, task.taskStatus);
        } finally {
            this.releaseRelaySigner(signerItem);
        }
    }

    private async onChangeStatusOfShop(task: ShopTaskData) {
        logger.info(`WatchScheduler.onChangeStatusOfShop ${task.taskId}`);
        const contract = await this.getShopContract();
        const signerItem = await this.getRelaySigner();
        try {
            if (signerItem.signer.provider) {
                const contractTx = (await signerItem.signer.provider.getTransaction(task.txId)) as ContractTransaction;
                const event = await this.waitAndChangeStatusEvent(contract, contractTx);
                if (event !== undefined) {
                    task.taskStatus = ShopTaskStatus.COMPLETED;
                    task.status = event.status;
                    await this.storage.updateTask(task);

                    await this.sendPaymentResult(
                        TaskResultType.STATUS,
                        TaskResultCode.SUCCESS,
                        "Success",
                        this.getCallBackResponseOfTask(task)
                    );
                } else {
                    task.taskStatus = ShopTaskStatus.REVERTED_TX;
                    await this.storage.forcedUpdateTaskStatus(task.taskId, task.taskStatus);
                }
            }
        } catch (error) {
            task.taskStatus = ShopTaskStatus.REVERTED_TX;
            await this.storage.forcedUpdateTaskStatus(task.taskId, task.taskStatus);
        } finally {
            this.releaseRelaySigner(signerItem);
        }
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

    private async waitAndUpdateEvent(
        contract: Shop,
        tx: ContractTransaction
    ): Promise<ContractShopUpdateEvent | undefined> {
        const contractReceipt = await tx.wait();
        const log = ContractUtils.findLog(contractReceipt, contract.interface, "UpdatedShop");
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

    private async waitAndChangeStatusEvent(
        contract: Shop,
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

    private getCallBackResponseOfTask(item: ShopTaskData): any {
        return {
            taskId: item.taskId,
            shopId: item.shopId,
            name: item.name,
            currency: item.currency,
            status: item.status,
            account: item.account,
        };
    }
    /// endregion
}
