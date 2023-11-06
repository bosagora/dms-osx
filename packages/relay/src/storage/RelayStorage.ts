import { IDatabaseConfig } from "../common/Config";
import { Utils } from "../utils/Utils";
import { Storage } from "./Storage";

import { BigNumber } from "ethers";
import MybatisMapper from "mybatis-mapper";

import path from "path";
import { LoyaltyPaymentInputData, LoyaltyPaymentInputDataStatus, LoyaltyType } from "../types";

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
        await this.exec(
            `SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE pg_stat_activity.datname = '${database}'`
        );
        await this.queryForMapper("table", "drop_table", { database });
    }

    public postPayment(
        paymentId: string,
        purchaseId: string,
        amount: BigNumber,
        currency: string,
        shopId: string,
        account: string,
        loyaltyType: LoyaltyType,
        purchaseAmount: BigNumber,
        feeAmount: BigNumber,
        totalAmount: BigNumber,
        paymentStatus: LoyaltyPaymentInputDataStatus
    ): Promise<void> {
        return new Promise<void>(async (resolve, reject) => {
            this.queryForMapper("payment", "postPayment", {
                paymentId,
                purchaseId,
                amount: amount.toString(),
                currency,
                shopId,
                account,
                loyaltyType,
                purchaseAmount: purchaseAmount.toString(),
                feeAmount: feeAmount.toString(),
                totalAmount: totalAmount.toString(),
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

    public getPayment(paymentId: string): Promise<LoyaltyPaymentInputData | undefined> {
        return new Promise<LoyaltyPaymentInputData | undefined>(async (resolve, reject) => {
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
                            purchaseAmount: BigNumber.from(m.purchaseAmount),
                            feeAmount: BigNumber.from(m.feeAmount),
                            totalAmount: BigNumber.from(m.totalAmount),
                            paymentStatus: m.paymentStatus,
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
}
