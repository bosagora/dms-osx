import { IDatabaseConfig } from "../common/Config";
import { Utils } from "../utils/Utils";
import { Storage } from "./Storage";

import { BigNumber } from "ethers";
import MybatisMapper from "mybatis-mapper";
// tslint:disable-next-line:no-submodule-imports
import * as mysql from "mysql2/promise";
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
    }

    /**
     * Construct an instance of `Storage` using `Promise` API.
     *
     * @param databaseConfig
     */
    public static make(databaseConfig: IDatabaseConfig): Promise<RelayStorage> {
        return new Promise<RelayStorage>((resolve, reject) => {
            const result = new RelayStorage(databaseConfig, (err: Error | null) => {
                if (err) reject(err);
                else resolve(result);
            });
            return result;
        });
    }

    /**
     * Creates tables related to the ledger.
     * @returns Returns the Promise. If it is finished successfully the `.then`
     * of the returned Promise is called and if an error occurs the `.catch`
     * is called with an error.
     */
    public createTables(): Promise<void> {
        return this.exec(MybatisMapper.getStatement("table", "create_table"));
    }

    /**
     * Drop Database
     * Use this only in the test code.
     * @param database The name of database
     */
    public async dropTestDB(database: any): Promise<void> {
        return this.exec(MybatisMapper.getStatement("table", "drop_table", { database }));
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
        paymentStatus: LoyaltyPaymentInputDataStatus,
        conn?: mysql.PoolConnection
    ): Promise<void> {
        return new Promise<void>(async (resolve, reject) => {
            this.queryForMapper(
                "payment",
                "postPayment",
                {
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
                },
                conn
            )
                .then(() => {
                    return resolve();
                })
                .catch((reason) => {
                    if (reason instanceof Error) return reject(reason);
                    return reject(new Error(reason));
                });
        });
    }

    public getPayment(paymentId: string, conn?: mysql.PoolConnection): Promise<LoyaltyPaymentInputData | undefined> {
        return new Promise<LoyaltyPaymentInputData | undefined>(async (resolve, reject) => {
            this.queryForMapper("payment", "getPayment", { paymentId }, conn)
                .then((rows: any[]) => {
                    if (rows.length > 0) {
                        const m = rows[0];
                        return resolve({
                            paymentId: m.paymentId,
                            purchaseId: m.purchaseId,
                            amount: m.amount,
                            currency: m.currency,
                            shopId: m.shopId,
                            account: m.account,
                            loyaltyType: m.loyaltyType,
                            purchaseAmount: m.purchaseAmount,
                            feeAmount: m.feeAmount,
                            totalAmount: m.totalAmount,
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

    public updatePaymentStatus(
        paymentId: string,
        paymentStatus: LoyaltyPaymentInputDataStatus,
        conn?: mysql.PoolConnection
    ): Promise<any[]> {
        return this.queryForMapper(
            "payment",
            "updateStatus",
            {
                paymentId,
                paymentStatus,
            },
            conn
        );
    }
}
