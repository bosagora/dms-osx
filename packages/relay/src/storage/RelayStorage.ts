import { IDatabaseConfig } from "../common/Config";
import { Utils } from "../utils/Utils";
import { Storage } from "./Storage";

import { BigNumber } from "ethers";
import MybatisMapper from "mybatis-mapper";

import path from "path";
import { LoyaltyPaymentInputDataStatus, LoyaltyPaymentInternalData, LoyaltyType } from "../types";

/**
 * The class that inserts and reads the ledger into the database.
 */
export class RelayStorage extends Storage {
    constructor(databaseConfig: IDatabaseConfig, callback: (err: Error | null) => void) {
        super(databaseConfig, callback);
        MybatisMapper.createMapper([path.resolve(Utils.getInitCWD(), "src/storage/mapper/table.xml")]);
        MybatisMapper.createMapper([path.resolve(Utils.getInitCWD(), "src/storage/mapper/payment.xml")]);
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

    public async dropTestDB(database: any): Promise<any> {
        await this.queryForMapper("table", "drop_table", { database });
    }

    public postPayment(item: LoyaltyPaymentInternalData): Promise<void> {
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

    public getPayment(paymentId: string): Promise<LoyaltyPaymentInternalData | undefined> {
        return new Promise<LoyaltyPaymentInternalData | undefined>(async (resolve, reject) => {
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

    public updatePayment(item: LoyaltyPaymentInternalData): Promise<void> {
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

    public updatePaymentStatus(paymentId: string, paymentStatus: LoyaltyPaymentInputDataStatus): Promise<any> {
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
}
