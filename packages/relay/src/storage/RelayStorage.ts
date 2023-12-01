import { IDatabaseConfig } from "../common/Config";
import { Utils } from "../utils/Utils";
import { Storage } from "./Storage";

import { BigNumber } from "ethers";
import MybatisMapper from "mybatis-mapper";

import path from "path";
import {
    LoyaltyPaymentTaskData,
    LoyaltyPaymentTaskStatus,
    MobileData,
    ShopTaskData,
    ShopTaskStatus,
    TaskResultType,
} from "../types";

/**
 * The class that inserts and reads the ledger into the database.
 */
export class RelayStorage extends Storage {
    constructor(databaseConfig: IDatabaseConfig, callback: (err: Error | null) => void) {
        super(databaseConfig, callback);
        MybatisMapper.createMapper([path.resolve(Utils.getInitCWD(), "src/storage/mapper/table.xml")]);
        MybatisMapper.createMapper([path.resolve(Utils.getInitCWD(), "src/storage/mapper/payment.xml")]);
        MybatisMapper.createMapper([path.resolve(Utils.getInitCWD(), "src/storage/mapper/task.xml")]);
        MybatisMapper.createMapper([path.resolve(Utils.getInitCWD(), "src/storage/mapper/mobile.xml")]);
        this.createTables()
            .then(() => {
                if (callback != null) callback(null);
            })
            .catch((err: any) => {
                if (callback != null) callback(err);
            });
    }

    public static make(databaseConfig: IDatabaseConfig): Promise<RelayStorage> {
        return new Promise<RelayStorage>((resolve, reject) => {
            const result = new RelayStorage(databaseConfig, (err: Error | null) => {
                if (err) reject(err);
                else resolve(result);
            });
            return result;
        });
    }

    public createTables(): Promise<any> {
        return this.queryForMapper("table", "create_table", {});
    }

    public async dropTestDB(): Promise<any> {
        await this.queryForMapper("table", "drop_table", {});
    }

    public postPayment(item: LoyaltyPaymentTaskData): Promise<void> {
        return new Promise<void>(async (resolve, reject) => {
            this.queryForMapper("payment", "postPayment", {
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
                openNewTimestamp: item.openNewTimestamp,
                closeNewTimestamp: item.closeNewTimestamp,
                openCancelTimestamp: item.openCancelTimestamp,
                closeCancelTimestamp: item.closeCancelTimestamp,
                openNewTxId: item.openNewTxId,
                openNewTxTime: item.openNewTxTime,
                closeNewTxId: item.closeNewTxId,
                closeNewTxTime: item.closeNewTxTime,
                openCancelTxId: item.openCancelTxId,
                openCancelTxTime: item.openCancelTxTime,
                closeCancelTxId: item.closeCancelTxId,
                closeCancelTxTime: item.closeCancelTxTime,
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
                            openNewTimestamp: m.openNewTimestamp,
                            closeNewTimestamp: m.closeNewTimestamp,
                            openCancelTimestamp: m.openCancelTimestamp,
                            closeCancelTimestamp: m.closeCancelTimestamp,
                            openNewTxId: m.openNewTxId,
                            openNewTxTime: m.openNewTxTime,
                            closeNewTxId: m.closeNewTxId,
                            closeNewTxTime: m.closeNewTxTime,
                            openCancelTxId: m.openCancelTxId,
                            openCancelTxTime: m.openCancelTxTime,
                            closeCancelTxId: m.closeCancelTxId,
                            closeCancelTxTime: m.closeCancelTxTime,
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

    public updateCloseNewTimestamp(paymentId: string, value: number): Promise<any> {
        return new Promise<void>(async (resolve, reject) => {
            this.queryForMapper("payment", "updateCloseNewTimestamp", {
                paymentId,
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

    public updateOpenCancelTimestamp(paymentId: string, value: number): Promise<any> {
        return new Promise<void>(async (resolve, reject) => {
            this.queryForMapper("payment", "updateOpenCancelTimestamp", {
                paymentId,
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

    public updateCloseCancelTimestamp(paymentId: string, value: number): Promise<any> {
        return new Promise<void>(async (resolve, reject) => {
            this.queryForMapper("payment", "updateCloseCancelTimestamp", {
                paymentId,
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

    public postTask(item: ShopTaskData): Promise<void> {
        return new Promise<void>(async (resolve, reject) => {
            this.queryForMapper("task", "postTask", {
                taskId: item.taskId,
                type: item.type,
                shopId: item.shopId,
                account: item.account,
                currency: item.currency,
                name: item.name,
                provideWaitTime: item.provideWaitTime,
                providePercent: item.providePercent,
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
                            provideWaitTime: m.provideWaitTime,
                            providePercent: m.providePercent,
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
                provideWaitTime: item.provideWaitTime,
                providePercent: item.providePercent,
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

    public updateTaskTimestamp(taskId: string, value: number): Promise<any> {
        return new Promise<void>(async (resolve, reject) => {
            this.queryForMapper("task", "updateTimestamp", {
                taskId,
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
                                provideWaitTime: m.provideWaitTime,
                                providePercent: m.providePercent,
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

    public updateTaskTx(taskId: string, txId: string, txTime: number): Promise<any> {
        return new Promise<void>(async (resolve, reject) => {
            this.queryForMapper("task", "updateTx", {
                taskId,
                txId,
                txTime,
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

    public updateOpenNewTx(paymentId: string, txId: string, txTime: number): Promise<any> {
        return new Promise<void>(async (resolve, reject) => {
            this.queryForMapper("payment", "updateOpenNewTx", {
                paymentId,
                txId,
                txTime,
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

    public updateCloseNewTx(paymentId: string, txId: string, txTime: number): Promise<any> {
        return new Promise<void>(async (resolve, reject) => {
            this.queryForMapper("payment", "updateCloseNewTx", {
                paymentId,
                txId,
                txTime,
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

    public updateOpenCancelTx(paymentId: string, txId: string, txTime: number): Promise<any> {
        return new Promise<void>(async (resolve, reject) => {
            this.queryForMapper("payment", "updateOpenCancelTx", {
                paymentId,
                txId,
                txTime,
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

    public updateCloseCancelTx(paymentId: string, txId: string, txTime: number): Promise<any> {
        return new Promise<void>(async (resolve, reject) => {
            this.queryForMapper("payment", "updateCloseCancelTx", {
                paymentId,
                txId,
                txTime,
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
                                openNewTimestamp: m.openNewTimestamp,
                                closeNewTimestamp: m.closeNewTimestamp,
                                openCancelTimestamp: m.openCancelTimestamp,
                                closeCancelTimestamp: m.closeCancelTimestamp,
                                openNewTxId: m.openNewTxId,
                                openNewTxTime: m.openNewTxTime,
                                closeNewTxId: m.closeNewTxId,
                                closeNewTxTime: m.closeNewTxTime,
                                openCancelTxId: m.openCancelTxId,
                                openCancelTxTime: m.openCancelTxTime,
                                closeCancelTxId: m.closeCancelTxId,
                                closeCancelTxTime: m.closeCancelTxTime,
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

    public postMobile(item: MobileData): Promise<void> {
        return new Promise<void>(async (resolve, reject) => {
            this.queryForMapper("mobile", "postMobile", {
                account: item.account,
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

    public getMobile(account: string): Promise<MobileData | undefined> {
        return new Promise<MobileData | undefined>(async (resolve, reject) => {
            this.queryForMapper("mobile", "getMobile", { account })
                .then((result) => {
                    if (result.rows.length > 0) {
                        const m = result.rows[0];
                        return resolve({
                            account: m.account,
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
}
