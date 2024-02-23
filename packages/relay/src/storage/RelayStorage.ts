import { IDatabaseConfig } from "../common/Config";
import { Utils } from "../utils/Utils";
import { Storage } from "./Storage";

import { BigNumber } from "ethers";
import MybatisMapper from "mybatis-mapper";

import path from "path";
import {
    ContractLoyaltyPaymentStatus,
    GWI_UNIT,
    IStorePurchaseData,
    IToBeProvideOfShop,
    IToBeProvideOfUser,
    LoyaltyPaymentTaskData,
    LoyaltyPaymentTaskStatus,
    MobileData,
    ShopTaskData,
    ShopTaskStatus,
    TaskResultType,
} from "../types";
import { ContractUtils } from "../utils/ContractUtils";
import * as hre from "hardhat";

/**
 * The class that inserts and reads the ledger into the database.
 */
export class RelayStorage extends Storage {
    constructor(databaseConfig: IDatabaseConfig) {
        super(databaseConfig);
    }

    public async initialize() {
        await super.initialize();
        MybatisMapper.createMapper([path.resolve(Utils.getInitCWD(), "src/storage/mapper/table.xml")]);
        MybatisMapper.createMapper([path.resolve(Utils.getInitCWD(), "src/storage/mapper/payment.xml")]);
        MybatisMapper.createMapper([path.resolve(Utils.getInitCWD(), "src/storage/mapper/task.xml")]);
        MybatisMapper.createMapper([path.resolve(Utils.getInitCWD(), "src/storage/mapper/mobile.xml")]);
        MybatisMapper.createMapper([path.resolve(Utils.getInitCWD(), "src/storage/mapper/purchase.xml")]);
        MybatisMapper.createMapper([path.resolve(Utils.getInitCWD(), "src/storage/mapper/temporary_accounts.xml")]);
        await this.createTables();
    }

    public static async make(config: IDatabaseConfig): Promise<RelayStorage> {
        const storage = new RelayStorage(config);
        await storage.initialize();
        return storage;
    }

    public createTables(): Promise<any> {
        return this.queryForMapper("table", "create_table", {});
    }

    public async dropTestDB(): Promise<any> {
        await this.queryForMapper("table", "drop_table", {});
    }

    /// region Payment

    public postPayment(item: LoyaltyPaymentTaskData): Promise<void> {
        return new Promise<void>(async (resolve, reject) => {
            this.queryForMapper("payment", "postPayment", {
                paymentId: item.paymentId,
                purchaseId: item.purchaseId,
                amount: item.amount.toString(),
                currency: item.currency,
                shopId: item.shopId,
                account: item.account,
                secret: item.secret,
                secretLock: item.secretLock,
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
                openNewTimestamp: item.openNewTimestamp,
                closeNewTimestamp: item.closeNewTimestamp,
                openCancelTimestamp: item.openCancelTimestamp,
                closeCancelTimestamp: item.closeCancelTimestamp,
                openNewTxId: item.openNewTxId,
                openNewTxTime: item.openNewTxTime,
                openCancelTxId: item.openCancelTxId,
                openCancelTxTime: item.openCancelTxTime,
            })
                .then(() => {
                    return resolve();
                })
                .catch((reason) => {
                    if (reason instanceof Error) return reject(reason);
                    return reject(new Error(reason));
                });
        });
    }

    public getPayment(paymentId: string): Promise<LoyaltyPaymentTaskData | undefined> {
        return new Promise<LoyaltyPaymentTaskData | undefined>(async (resolve, reject) => {
            this.queryForMapper("payment", "getPayment", { paymentId })
                .then((result) => {
                    if (result.rows.length > 0) {
                        const m = result.rows[0];
                        return resolve({
                            paymentId: m.paymentId,
                            purchaseId: m.purchaseId,
                            amount: BigNumber.from(m.amount),
                            currency: m.currency,
                            shopId: m.shopId,
                            account: m.account,
                            secret: m.secret,
                            secretLock: m.secretLock,
                            loyaltyType: m.loyaltyType,
                            paidPoint: BigNumber.from(m.paidPoint),
                            paidToken: BigNumber.from(m.paidToken),
                            paidValue: BigNumber.from(m.paidValue),
                            feePoint: BigNumber.from(m.feePoint),
                            feeToken: BigNumber.from(m.feeToken),
                            feeValue: BigNumber.from(m.feeValue),
                            totalPoint: BigNumber.from(m.totalPoint),
                            totalToken: BigNumber.from(m.totalToken),
                            totalValue: BigNumber.from(m.totalValue),
                            paymentStatus: m.paymentStatus,
                            contractStatus: m.contractStatus,
                            openNewTimestamp: m.openNewTimestamp,
                            closeNewTimestamp: m.closeNewTimestamp,
                            openCancelTimestamp: m.openCancelTimestamp,
                            closeCancelTimestamp: m.closeCancelTimestamp,
                            openNewTxId: m.openNewTxId,
                            openNewTxTime: m.openNewTxTime,
                            openCancelTxId: m.openCancelTxId,
                            openCancelTxTime: m.openCancelTxTime,
                        });
                    } else {
                        return resolve(undefined);
                    }
                })
                .catch((reason) => {
                    if (reason instanceof Error) return reject(reason);
                    return reject(new Error(reason));
                });
        });
    }

    public updatePayment(item: LoyaltyPaymentTaskData): Promise<void> {
        return new Promise<void>(async (resolve, reject) => {
            this.queryForMapper("payment", "updatePayment", {
                paymentId: item.paymentId,
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
                contractStatus: item.contractStatus,
                openNewTimestamp: item.openNewTimestamp,
                closeNewTimestamp: item.closeNewTimestamp,
                openCancelTimestamp: item.openCancelTimestamp,
                closeCancelTimestamp: item.closeCancelTimestamp,
            })
                .then(() => {
                    return resolve();
                })
                .catch((reason) => {
                    if (reason instanceof Error) return reject(reason);
                    return reject(new Error(reason));
                });
        });
    }

    public updatePaymentStatus(paymentId: string, paymentStatus: LoyaltyPaymentTaskStatus): Promise<any> {
        return new Promise<void>(async (resolve, reject) => {
            this.queryForMapper("payment", "updateStatus", {
                paymentId,
                paymentStatus,
            })
                .then(() => {
                    return resolve();
                })
                .catch((reason) => {
                    if (reason instanceof Error) return reject(reason);
                    return reject(new Error(reason));
                });
        });
    }

    public forcedUpdatePaymentStatus(paymentId: string, paymentStatus: LoyaltyPaymentTaskStatus): Promise<any> {
        return new Promise<void>(async (resolve, reject) => {
            this.queryForMapper("payment", "forcedUpdateStatus", {
                paymentId,
                paymentStatus,
            })
                .then(() => {
                    return resolve();
                })
                .catch((reason) => {
                    if (reason instanceof Error) return reject(reason);
                    return reject(new Error(reason));
                });
        });
    }

    public updatePaymentContractStatus(paymentId: string, contractStatus: ContractLoyaltyPaymentStatus): Promise<any> {
        return new Promise<void>(async (resolve, reject) => {
            this.queryForMapper("payment", "updateContractStatus", {
                paymentId,
                contractStatus,
            })
                .then(() => {
                    return resolve();
                })
                .catch((reason) => {
                    if (reason instanceof Error) return reject(reason);
                    return reject(new Error(reason));
                });
        });
    }

    public updateCloseNewTimestamp(
        paymentId: string,
        paymentStatus: LoyaltyPaymentTaskStatus,
        value: number
    ): Promise<any> {
        return new Promise<void>(async (resolve, reject) => {
            this.queryForMapper("payment", "updateCloseNewTimestamp", {
                paymentId,
                paymentStatus,
                value,
            })
                .then(() => {
                    return resolve();
                })
                .catch((reason) => {
                    if (reason instanceof Error) return reject(reason);
                    return reject(new Error(reason));
                });
        });
    }

    public updateOpenCancelTimestamp(
        paymentId: string,
        paymentStatus: LoyaltyPaymentTaskStatus,
        value: number
    ): Promise<any> {
        return new Promise<void>(async (resolve, reject) => {
            this.queryForMapper("payment", "updateOpenCancelTimestamp", {
                paymentId,
                paymentStatus,
                value,
            })
                .then(() => {
                    return resolve();
                })
                .catch((reason) => {
                    if (reason instanceof Error) return reject(reason);
                    return reject(new Error(reason));
                });
        });
    }

    public updateCloseCancelTimestamp(
        paymentId: string,
        paymentStatus: LoyaltyPaymentTaskStatus,
        value: number
    ): Promise<any> {
        return new Promise<void>(async (resolve, reject) => {
            this.queryForMapper("payment", "updateCloseCancelTimestamp", {
                paymentId,
                paymentStatus,
                value,
            })
                .then(() => {
                    return resolve();
                })
                .catch((reason) => {
                    if (reason instanceof Error) return reject(reason);
                    return reject(new Error(reason));
                });
        });
    }

    public updateSecret(paymentId: string, secret: string, secretLock: string): Promise<any> {
        return new Promise<void>(async (resolve, reject) => {
            this.queryForMapper("payment", "updateSecret", {
                paymentId,
                secret,
                secretLock,
            })
                .then(() => {
                    return resolve();
                })
                .catch((reason) => {
                    if (reason instanceof Error) return reject(reason);
                    return reject(new Error(reason));
                });
        });
    }

    public updateOpenNewTx(
        paymentId: string,
        txId: string,
        txTime: number,
        paymentStatus: LoyaltyPaymentTaskStatus
    ): Promise<any> {
        return new Promise<void>(async (resolve, reject) => {
            this.queryForMapper("payment", "updateOpenNewTx", {
                paymentId,
                txId,
                txTime,
                paymentStatus,
            })
                .then(() => {
                    return resolve();
                })
                .catch((reason) => {
                    if (reason instanceof Error) return reject(reason);
                    return reject(new Error(reason));
                });
        });
    }

    public updateCloseNewTx(
        paymentId: string,
        txId: string,
        txTime: number,
        paymentStatus: LoyaltyPaymentTaskStatus
    ): Promise<any> {
        return new Promise<void>(async (resolve, reject) => {
            this.queryForMapper("payment", "updateCloseNewTx", {
                paymentId,
                txId,
                txTime,
                paymentStatus,
            })
                .then(() => {
                    return resolve();
                })
                .catch((reason) => {
                    if (reason instanceof Error) return reject(reason);
                    return reject(new Error(reason));
                });
        });
    }

    public updateOpenCancelTx(
        paymentId: string,
        txId: string,
        txTime: number,
        paymentStatus: LoyaltyPaymentTaskStatus
    ): Promise<any> {
        return new Promise<void>(async (resolve, reject) => {
            this.queryForMapper("payment", "updateOpenCancelTx", {
                paymentId,
                txId,
                txTime,
                paymentStatus,
            })
                .then(() => {
                    return resolve();
                })
                .catch((reason) => {
                    if (reason instanceof Error) return reject(reason);
                    return reject(new Error(reason));
                });
        });
    }

    public updateCloseCancelTx(
        paymentId: string,
        txId: string,
        txTime: number,
        paymentStatus: LoyaltyPaymentTaskStatus
    ): Promise<any> {
        return new Promise<void>(async (resolve, reject) => {
            this.queryForMapper("payment", "updateCloseCancelTx", {
                paymentId,
                txId,
                txTime,
                paymentStatus,
            })
                .then(() => {
                    return resolve();
                })
                .catch((reason) => {
                    if (reason instanceof Error) return reject(reason);
                    return reject(new Error(reason));
                });
        });
    }

    public getPaymentsStatusOf(statusList: LoyaltyPaymentTaskStatus[]): Promise<LoyaltyPaymentTaskData[]> {
        return new Promise<LoyaltyPaymentTaskData[]>(async (resolve, reject) => {
            this.queryForMapper("payment", "getPaymentsStatusOf", { status: statusList })
                .then((result) => {
                    resolve(
                        result.rows.map((m) => {
                            return {
                                paymentId: m.paymentId,
                                purchaseId: m.purchaseId,
                                amount: BigNumber.from(m.amount),
                                currency: m.currency,
                                shopId: m.shopId,
                                account: m.account,
                                secret: m.secret,
                                secretLock: m.secretLock,
                                loyaltyType: m.loyaltyType,
                                paidPoint: BigNumber.from(m.paidPoint),
                                paidToken: BigNumber.from(m.paidToken),
                                paidValue: BigNumber.from(m.paidValue),
                                feePoint: BigNumber.from(m.feePoint),
                                feeToken: BigNumber.from(m.feeToken),
                                feeValue: BigNumber.from(m.feeValue),
                                totalPoint: BigNumber.from(m.totalPoint),
                                totalToken: BigNumber.from(m.totalToken),
                                totalValue: BigNumber.from(m.totalValue),
                                paymentStatus: m.paymentStatus,
                                contractStatus: m.contractStatus,
                                openNewTimestamp: m.openNewTimestamp,
                                closeNewTimestamp: m.closeNewTimestamp,
                                openCancelTimestamp: m.openCancelTimestamp,
                                closeCancelTimestamp: m.closeCancelTimestamp,
                                openNewTxId: m.openNewTxId,
                                openNewTxTime: m.openNewTxTime,
                                openCancelTxId: m.openCancelTxId,
                                openCancelTxTime: m.openCancelTxTime,
                            };
                        })
                    );
                })
                .catch((reason) => {
                    if (reason instanceof Error) return reject(reason);
                    return reject(new Error(reason));
                });
        });
    }

    public getContractPaymentsStatusOf(
        contractStatusList: ContractLoyaltyPaymentStatus[],
        paymentStatusList: LoyaltyPaymentTaskStatus[]
    ): Promise<LoyaltyPaymentTaskData[]> {
        return new Promise<LoyaltyPaymentTaskData[]>(async (resolve, reject) => {
            this.queryForMapper("payment", "getContractPaymentsStatusOf", { contractStatusList, paymentStatusList })
                .then((result) => {
                    resolve(
                        result.rows.map((m) => {
                            return {
                                paymentId: m.paymentId,
                                purchaseId: m.purchaseId,
                                amount: BigNumber.from(m.amount),
                                currency: m.currency,
                                shopId: m.shopId,
                                account: m.account,
                                secret: m.secret,
                                secretLock: m.secretLock,
                                loyaltyType: m.loyaltyType,
                                paidPoint: BigNumber.from(m.paidPoint),
                                paidToken: BigNumber.from(m.paidToken),
                                paidValue: BigNumber.from(m.paidValue),
                                feePoint: BigNumber.from(m.feePoint),
                                feeToken: BigNumber.from(m.feeToken),
                                feeValue: BigNumber.from(m.feeValue),
                                totalPoint: BigNumber.from(m.totalPoint),
                                totalToken: BigNumber.from(m.totalToken),
                                totalValue: BigNumber.from(m.totalValue),
                                paymentStatus: m.paymentStatus,
                                contractStatus: m.contractStatus,
                                openNewTimestamp: m.openNewTimestamp,
                                closeNewTimestamp: m.closeNewTimestamp,
                                openCancelTimestamp: m.openCancelTimestamp,
                                closeCancelTimestamp: m.closeCancelTimestamp,
                                openNewTxId: m.openNewTxId,
                                openNewTxTime: m.openNewTxTime,
                                openCancelTxId: m.openCancelTxId,
                                openCancelTxTime: m.openCancelTxTime,
                            };
                        })
                    );
                })
                .catch((reason) => {
                    if (reason instanceof Error) return reject(reason);
                    return reject(new Error(reason));
                });
        });
    }

    /// endregion

    /// region Task

    public postTask(item: ShopTaskData): Promise<void> {
        return new Promise<void>(async (resolve, reject) => {
            this.queryForMapper("task", "postTask", {
                taskId: item.taskId,
                type: item.type,
                shopId: item.shopId,
                account: item.account,
                currency: item.currency,
                name: item.name,
                status: item.status,
                taskStatus: item.taskStatus,
                timestamp: item.timestamp,
            })
                .then(() => {
                    return resolve();
                })
                .catch((reason) => {
                    if (reason instanceof Error) return reject(reason);
                    return reject(new Error(reason));
                });
        });
    }

    public getTask(taskId: string): Promise<ShopTaskData | undefined> {
        return new Promise<ShopTaskData | undefined>(async (resolve, reject) => {
            this.queryForMapper("task", "getTask", { taskId })
                .then((result) => {
                    if (result.rows.length > 0) {
                        const m = result.rows[0];
                        return resolve({
                            taskId: m.taskId,
                            type: m.type,
                            shopId: m.shopId,
                            account: m.account,
                            name: m.name,
                            currency: m.currency,
                            status: m.status,
                            taskStatus: m.taskStatus,
                            timestamp: m.timestamp,
                            txId: m.txId,
                            txTime: m.txTime,
                        });
                    } else {
                        return resolve(undefined);
                    }
                })
                .catch((reason) => {
                    if (reason instanceof Error) return reject(reason);
                    return reject(new Error(reason));
                });
        });
    }

    public updateTask(item: ShopTaskData): Promise<void> {
        return new Promise<void>(async (resolve, reject) => {
            this.queryForMapper("task", "updateTask", {
                taskId: item.taskId,
                name: item.name,
                currency: item.currency,
                status: item.status,
                taskStatus: item.taskStatus,
                timestamp: item.timestamp,
            })
                .then(() => {
                    return resolve();
                })
                .catch((reason) => {
                    if (reason instanceof Error) return reject(reason);
                    return reject(new Error(reason));
                });
        });
    }

    public updateTaskStatus(taskId: string, taskStatus: ShopTaskStatus): Promise<any> {
        return new Promise<void>(async (resolve, reject) => {
            this.queryForMapper("task", "updateStatus", {
                taskId,
                taskStatus,
            })
                .then(() => {
                    return resolve();
                })
                .catch((reason) => {
                    if (reason instanceof Error) return reject(reason);
                    return reject(new Error(reason));
                });
        });
    }

    public forcedUpdateTaskStatus(taskId: string, taskStatus: ShopTaskStatus): Promise<any> {
        return new Promise<void>(async (resolve, reject) => {
            this.queryForMapper("task", "forcedUpdateStatus", {
                taskId,
                taskStatus,
            })
                .then(() => {
                    return resolve();
                })
                .catch((reason) => {
                    if (reason instanceof Error) return reject(reason);
                    return reject(new Error(reason));
                });
        });
    }

    public getTasksStatusOf(type: TaskResultType[], status: ShopTaskStatus[]): Promise<ShopTaskData[]> {
        return new Promise<ShopTaskData[]>(async (resolve, reject) => {
            this.queryForMapper("task", "getTasksStatusOf", { type, status })
                .then((result) => {
                    resolve(
                        result.rows.map((m) => {
                            return {
                                taskId: m.taskId,
                                type: m.type,
                                shopId: m.shopId,
                                account: m.account,
                                name: m.name,
                                currency: m.currency,
                                status: m.status,
                                taskStatus: m.taskStatus,
                                timestamp: m.timestamp,
                                txId: m.txId,
                                txTime: m.txTime,
                            };
                        })
                    );
                })
                .catch((reason) => {
                    if (reason instanceof Error) return reject(reason);
                    return reject(new Error(reason));
                });
        });
    }

    public updateTaskTx(taskId: string, txId: string, txTime: number, taskStatus: ShopTaskStatus): Promise<any> {
        return new Promise<void>(async (resolve, reject) => {
            this.queryForMapper("task", "updateTx", {
                taskId,
                txId,
                txTime,
                taskStatus,
            })
                .then(() => {
                    return resolve();
                })
                .catch((reason) => {
                    if (reason instanceof Error) return reject(reason);
                    return reject(new Error(reason));
                });
        });
    }

    /// endregion

    // region Mobile

    public postMobile(item: MobileData): Promise<void> {
        return new Promise<void>(async (resolve, reject) => {
            this.queryForMapper("mobile", "postMobile", {
                account: item.account,
                type: item.type,
                token: item.token,
                language: item.language,
                os: item.os,
            })
                .then(() => {
                    return resolve();
                })
                .catch((reason) => {
                    if (reason instanceof Error) return reject(reason);
                    return reject(new Error(reason));
                });
        });
    }

    public getMobile(account: string, type: number): Promise<MobileData | undefined> {
        return new Promise<MobileData | undefined>(async (resolve, reject) => {
            this.queryForMapper("mobile", "getMobile", { account, type })
                .then((result) => {
                    if (result.rows.length > 0) {
                        const m = result.rows[0];
                        return resolve({
                            account: m.account,
                            type: m.type,
                            token: m.token,
                            language: m.language,
                            os: m.os,
                        });
                    } else {
                        return resolve(undefined);
                    }
                })
                .catch((reason) => {
                    if (reason instanceof Error) return reject(reason);
                    return reject(new Error(reason));
                });
        });
    }

    /// endregion

    // region StorePurchase
    public postStorePurchase(data: IStorePurchaseData): Promise<void> {
        return new Promise<void>(async (resolve, reject) => {
            this.queryForMapper("purchase", "postStorePurchase", {
                purchaseId: data.purchaseId,
                timestamp: data.timestamp.toString(),
                account: data.account.toLowerCase(),
                loyaltyType: data.loyaltyType,
                currency: data.currency,
                providePoint: data.providePoint.div(GWI_UNIT).toString(),
                provideToken: data.provideToken.div(GWI_UNIT).toString(),
                provideValue: data.provideValue.div(GWI_UNIT).toString(),
                shopId: data.shopId.toLowerCase(),
                shopCurrency: data.shopCurrency,
                shopProvidedAmount: data.shopProvidedAmount.div(GWI_UNIT).toString(),
            })
                .then(() => {
                    return resolve();
                })
                .catch((reason) => {
                    if (reason instanceof Error) return reject(reason);
                    return reject(new Error(reason));
                });
        });
    }

    public getStorePurchase(): Promise<IStorePurchaseData[]> {
        return new Promise<IStorePurchaseData[]>(async (resolve, reject) => {
            this.queryForMapper("purchase", "getStorePurchase", {})
                .then((result) => {
                    resolve(
                        result.rows.map((m) => {
                            return {
                                purchaseId: m.purchaseId,
                                timestamp: BigInt(m.timestamp.toString()),
                                account: m.account,
                                loyaltyType: m.loyaltyType,
                                currency: m.currency,
                                providePoint: BigNumber.from(m.providePoint.toString()).mul(GWI_UNIT),
                                provideToken: BigNumber.from(m.provideToken.toString()).mul(GWI_UNIT),
                                provideValue: BigNumber.from(m.provideValue.toString()).mul(GWI_UNIT),
                                shopId: m.shopId,
                                shopCurrency: m.shopCurrency,
                                shopProvidedAmount: BigNumber.from(m.shopProvidedAmount.toString()).mul(GWI_UNIT),
                            };
                        })
                    );
                })
                .catch((reason) => {
                    if (reason instanceof Error) return reject(reason);
                    return reject(new Error(reason));
                });
        });
    }

    public cancelStorePurchase(purchaseId: string): Promise<void> {
        return new Promise<void>(async (resolve, reject) => {
            this.queryForMapper("purchase", "updateCancel", { purchaseId })
                .then((result) => {
                    return resolve();
                })
                .catch((reason) => {
                    if (reason instanceof Error) return reject(reason);
                    return reject(new Error(reason));
                });
        });
    }

    public doneStorePurchase(purchaseId: string): Promise<void> {
        return new Promise<void>(async (resolve, reject) => {
            this.queryForMapper("purchase", "updateDone", { purchaseId })
                .then((result) => {
                    return resolve();
                })
                .catch((reason) => {
                    if (reason instanceof Error) return reject(reason);
                    return reject(new Error(reason));
                });
        });
    }

    public getToBeProvideOfUser(account: string): Promise<IToBeProvideOfUser[]> {
        return new Promise<IToBeProvideOfUser[]>(async (resolve, reject) => {
            this.queryForMapper("purchase", "getToBeProvideOfUser", { account: account.toLowerCase() })
                .then((result) => {
                    resolve(
                        result.rows.map((m) => {
                            return {
                                account: m.account,
                                timestamp: BigInt(m.timestamp.toString()),
                                loyaltyType: m.loyaltyType,
                                currency: m.currency,
                                providePoint: BigNumber.from(m.providePoint.toString()).mul(GWI_UNIT),
                                provideToken: BigNumber.from(m.provideToken.toString()).mul(GWI_UNIT),
                                provideValue: BigNumber.from(m.provideValue.toString()).mul(GWI_UNIT),
                                purchaseId: m.purchaseId,
                                shopId: m.shopId,
                            };
                        })
                    );
                })
                .catch((reason) => {
                    if (reason instanceof Error) return reject(reason);
                    return reject(new Error(reason));
                });
        });
    }

    public getTotalToBeProvideOfUser(account: string): Promise<any> {
        return new Promise<any>(async (resolve, reject) => {
            this.queryForMapper("purchase", "getTotalToBeProvideOfUser", { account: account.toLowerCase() })
                .then((result) => {
                    const m = result.rows[0];
                    resolve({
                        providePoint: BigNumber.from(m.providePoint.toString()).mul(GWI_UNIT),
                        provideToken: BigNumber.from(m.provideToken.toString()).mul(GWI_UNIT),
                        provideValue: BigNumber.from(m.provideValue.toString()).mul(GWI_UNIT),
                    });
                })
                .catch((reason) => {
                    if (reason instanceof Error) return reject(reason);
                    return reject(new Error(reason));
                });
        });
    }

    public getToBeProvideOfShop(shopId: string): Promise<IToBeProvideOfShop[]> {
        return new Promise<IToBeProvideOfShop[]>(async (resolve, reject) => {
            this.queryForMapper("purchase", "getToBeProvideOfShop", { shopId: shopId.toLowerCase() })
                .then((result) => {
                    resolve(
                        result.rows.map((m) => {
                            return {
                                shopId: m.shopId,
                                timestamp: BigInt(m.timestamp.toString()),
                                currency: m.currency,
                                providedAmount: BigNumber.from(m.providedAmount.toString()).mul(GWI_UNIT),
                                purchaseId: m.purchaseId,
                            };
                        })
                    );
                })
                .catch((reason) => {
                    if (reason instanceof Error) return reject(reason);
                    return reject(new Error(reason));
                });
        });
    }

    public getTotalToBeProvideOfShop(shopId: string): Promise<any> {
        return new Promise<any>(async (resolve, reject) => {
            this.queryForMapper("purchase", "getTotalToBeProvideOfShop", { shopId: shopId.toLowerCase() })
                .then((result) => {
                    const m = result.rows[0];
                    resolve({
                        providedAmount: BigNumber.from(m.providedAmount.toString()).mul(GWI_UNIT),
                    });
                })
                .catch((reason) => {
                    if (reason instanceof Error) return reject(reason);
                    return reject(new Error(reason));
                });
        });
    }
    /// endregion

    public async getTemporaryAccount(account: string): Promise<string> {
        let temporary_account: string;
        while (true) {
            temporary_account = ContractUtils.getTemporaryAccount();
            if ((await this.getRealAccount(temporary_account)) === undefined) break;
        }

        const timestamp = ContractUtils.getTimeStampBigInt();
        return new Promise<string>(async (resolve, reject) => {
            this.queryForMapper("temporary_accounts", "postAccount", {
                account: account.toLowerCase(),
                temporary_account: temporary_account.toLowerCase(),
                timestamp: timestamp.toString(),
            })
                .then(() => {
                    return resolve(temporary_account);
                })
                .catch((reason) => {
                    if (reason instanceof Error) return reject(reason);
                    return reject(new Error(reason));
                });
        });
    }

    public getRealAccount(temporary_account: string): Promise<string | undefined> {
        return new Promise<string | undefined>(async (resolve, reject) => {
            this.queryForMapper("temporary_accounts", "getRealAccount", {
                temporary_account,
                timestamp: (ContractUtils.getTimeStampBigInt() - BigInt(60)).toString(),
            })
                .then((result) => {
                    if (result.rows.length > 0) {
                        return resolve(hre.ethers.utils.getAddress(result.rows[0].account));
                    } else {
                        return resolve(undefined);
                    }
                })
                .catch((reason) => {
                    if (reason instanceof Error) return reject(reason);
                    return reject(new Error(reason));
                });
        });
    }

    public removeExpiredAccount(): Promise<void> {
        return new Promise<void>(async (resolve, reject) => {
            this.queryForMapper("temporary_accounts", "removeExpiredAccount", {})
                .then((result) => {
                    return resolve();
                })
                .catch((reason) => {
                    if (reason instanceof Error) return reject(reason);
                    return reject(new Error(reason));
                });
        });
    }
}
