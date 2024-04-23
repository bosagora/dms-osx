import { IDatabaseConfig } from "../common/Config";
import {
    IGraphAccountLedgerHistoryData,
    IGraphPageInfo,
    IGraphPhoneLedgerHistoryData,
    IGraphShopData,
    IGraphTokenTransferHistoryData,
    IStatisticsAccountInfo,
    IStatisticsShopInfo,
} from "../types";
import { Utils } from "../utils/Utils";
import { Storage } from "./Storage";

import { BigNumber } from "ethers";
import MybatisMapper from "mybatis-mapper";

import path from "path";

import { toChecksumAddress } from "ethereumjs-util";

/**
 * The class that inserts and reads the ledger into the database.
 */
export class GraphStorage extends Storage {
    public static AmountUnit: BigNumber = BigNumber.from("1000000000");
    private scheme: string;

    constructor(databaseConfig: IDatabaseConfig) {
        super(databaseConfig);
        this.scheme = databaseConfig.scheme;
    }

    public async initialize() {
        await super.initialize();
        MybatisMapper.createMapper([path.resolve(Utils.getInitCWD(), "src/storage/graph/shop.xml")]);
        MybatisMapper.createMapper([path.resolve(Utils.getInitCWD(), "src/storage/graph/user.xml")]);
        MybatisMapper.createMapper([path.resolve(Utils.getInitCWD(), "src/storage/graph/token.xml")]);
        MybatisMapper.createMapper([path.resolve(Utils.getInitCWD(), "src/storage/graph/statistics.xml")]);
        await this.createTables();
    }

    public static async make(config: IDatabaseConfig): Promise<GraphStorage> {
        const storage = new GraphStorage(config);
        await storage.initialize();
        return storage;
    }

    public getShopList(pageNumber: number, pageSize: number): Promise<IGraphShopData[]> {
        return new Promise<IGraphShopData[]>(async (resolve, reject) => {
            this.queryForMapper("shop", "getShopList", { scheme: this.scheme, pageNumber, pageSize })
                .then((result) => {
                    return resolve(
                        result.rows.map((m) => {
                            return {
                                shopId: "0x" + m.shopId.toString("hex"),
                                name: m.name,
                                currency: m.currency,
                                status: m.status,
                                account: toChecksumAddress("0x" + m.account.toString("hex")),
                                providedAmount: BigNumber.from(m.providedAmount).mul(GraphStorage.AmountUnit),
                                usedAmount: BigNumber.from(m.usedAmount).mul(GraphStorage.AmountUnit),
                                settledAmount: BigNumber.from(m.settledAmount).mul(GraphStorage.AmountUnit),
                                withdrawnAmount: BigNumber.from(m.withdrawnAmount).mul(GraphStorage.AmountUnit),
                                withdrawReqId: BigNumber.from(m.withdrawReqId),
                                withdrawReqAmount: BigNumber.from(m.withdrawReqAmount).mul(GraphStorage.AmountUnit),
                                withdrawReqStatus: m.withdrawReqStatus,
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

    public getShopPageInfo(pageSize: number): Promise<IGraphPageInfo> {
        return new Promise<IGraphPageInfo>(async (resolve, reject) => {
            this.queryForMapper("shop", "getShopPageInfo", { scheme: this.scheme, pageSize })
                .then((result) => {
                    if (result.rows.length > 0) {
                        const m = result.rows[0];
                        return resolve({
                            totalCount: Number(m.totalCount),
                            totalPages: Number(m.totalPages),
                        });
                    } else {
                        return reject(new Error(""));
                    }
                })
                .catch((reason) => {
                    if (reason instanceof Error) return reject(reason);
                    return reject(new Error(reason));
                });
        });
    }

    public getTokenTransferHistory(
        account: string,
        pageNumber: number,
        pageSize: number
    ): Promise<IGraphTokenTransferHistoryData[]> {
        return new Promise<IGraphTokenTransferHistoryData[]>(async (resolve, reject) => {
            this.queryForMapper("token", "getTokenTransferHistory", {
                scheme: this.scheme,
                pageNumber,
                pageSize,
                account,
            })
                .then((result) => {
                    return resolve(
                        result.rows.map((m) => {
                            return {
                                from: toChecksumAddress("0x" + m.from.toString("hex")),
                                to: toChecksumAddress("0x" + m.to.toString("hex")),
                                value: BigNumber.from(m.value).mul(GraphStorage.AmountUnit),
                                blockTimestamp: BigNumber.from(m.block_timestamp),
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

    public getTokenTransferPageInfo(account: string, pageSize: number): Promise<IGraphPageInfo> {
        return new Promise<IGraphPageInfo>(async (resolve, reject) => {
            this.queryForMapper("token", "getTokenTransferHistoryPageInfo", { scheme: this.scheme, pageSize, account })
                .then((result) => {
                    if (result.rows.length > 0) {
                        const m = result.rows[0];
                        return resolve({
                            totalCount: Number(m.totalCount),
                            totalPages: Number(m.totalPages),
                        });
                    } else {
                        return reject(new Error(""));
                    }
                })
                .catch((reason) => {
                    if (reason instanceof Error) return reject(reason);
                    return reject(new Error(reason));
                });
        });
    }

    public getPhoneAccountStatistics(): Promise<IStatisticsAccountInfo> {
        return new Promise<IStatisticsAccountInfo>(async (resolve, reject) => {
            this.queryForMapper("statistics", "getPhoneAccountStatistics", { scheme: this.scheme })
                .then((result) => {
                    if (result.rows.length > 0) {
                        const m = result.rows[0];
                        return resolve({
                            account_count: Number(m.account_count),
                            total_balance: Number(m.total_balance),
                        });
                    } else {
                        return reject(new Error(""));
                    }
                })
                .catch((reason) => {
                    if (reason instanceof Error) return reject(reason);
                    return reject(new Error(reason));
                });
        });
    }

    public getPointAccountStatistics(excluded: string[]): Promise<IStatisticsAccountInfo> {
        return new Promise<IStatisticsAccountInfo>(async (resolve, reject) => {
            this.queryForMapper("statistics", "getPointAccountStatistics", { scheme: this.scheme, excluded })
                .then((result) => {
                    if (result.rows.length > 0) {
                        const m = result.rows[0];
                        return resolve({
                            account_count: Number(m.account_count),
                            total_balance: Number(m.total_balance),
                        });
                    } else {
                        return reject(new Error(""));
                    }
                })
                .catch((reason) => {
                    if (reason instanceof Error) return reject(reason);
                    return reject(new Error(reason));
                });
        });
    }

    public getTokenAccountStatistics(excluded: string[]): Promise<IStatisticsAccountInfo> {
        return new Promise<IStatisticsAccountInfo>(async (resolve, reject) => {
            this.queryForMapper("statistics", "getTokenAccountStatistics", { scheme: this.scheme, excluded })
                .then((result) => {
                    if (result.rows.length > 0) {
                        const m = result.rows[0];
                        return resolve({
                            account_count: Number(m.account_count),
                            total_balance: Number(m.total_balance),
                        });
                    } else {
                        return reject(new Error(""));
                    }
                })
                .catch((reason) => {
                    if (reason instanceof Error) return reject(reason);
                    return reject(new Error(reason));
                });
        });
    }

    public getShopCount(): Promise<number> {
        return new Promise<number>(async (resolve, reject) => {
            this.queryForMapper("statistics", "getShopCount", { scheme: this.scheme })
                .then((result) => {
                    if (result.rows.length > 0) {
                        return resolve(Number(result.rows[0].shop_count));
                    } else {
                        return reject(new Error(""));
                    }
                })
                .catch((reason) => {
                    if (reason instanceof Error) return reject(reason);
                    return reject(new Error(reason));
                });
        });
    }

    public getShopStatistics(): Promise<IStatisticsShopInfo[]> {
        return new Promise<IStatisticsShopInfo[]>(async (resolve, reject) => {
            this.queryForMapper("statistics", "getShopStatistics", { scheme: this.scheme })
                .then((result) => {
                    return resolve(
                        result.rows.map((m) => {
                            return {
                                currency: m.currency,
                                shop_count: Number(m.shop_count),
                                total_provided_amount: Number(m.total_provided_amount),
                                total_used_amount: Number(m.total_used_amount),
                                total_withdrawable_amount: Number(m.total_withdrawable_amount),
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

    public getAccountLedgerHistory(
        account: string,
        pageType: number,
        pageNumber: number,
        pageSize: number
    ): Promise<IGraphAccountLedgerHistoryData[]> {
        return new Promise<IGraphAccountLedgerHistoryData[]>(async (resolve, reject) => {
            this.queryForMapper("user", "getAccountLedgerHistory", {
                scheme: this.scheme,
                pageType,
                pageNumber,
                pageSize,
                account,
            })
                .then((result) => {
                    return resolve(
                        result.rows.map((m) => {
                            return {
                                account: toChecksumAddress("0x" + m.account.toString("hex")),
                                pageType: m.page_type,
                                action: m.action,
                                cancel: m.cancel,
                                loyaltyType: m.loyalty_type,
                                amountPoint: BigNumber.from(m.amount_point).mul(GraphStorage.AmountUnit),
                                amountToken: BigNumber.from(m.amount_token).mul(GraphStorage.AmountUnit),
                                amountValue: BigNumber.from(m.amount_value).mul(GraphStorage.AmountUnit),
                                feePoint: BigNumber.from(m.fee_point).mul(GraphStorage.AmountUnit),
                                feeToken: BigNumber.from(m.fee_token).mul(GraphStorage.AmountUnit),
                                feeValue: BigNumber.from(m.fee_value).mul(GraphStorage.AmountUnit),
                                balancePoint: BigNumber.from(m.balance_point).mul(GraphStorage.AmountUnit),
                                balanceToken: BigNumber.from(m.balance_token).mul(GraphStorage.AmountUnit),
                                purchaseId: m.purchase_id,
                                paymentId: m.payment_id,
                                shopId: m.shop_id,
                                blockNumber: BigNumber.from(m.block_number),
                                blockTimestamp: BigNumber.from(m.block_timestamp),
                                transactionHash: m.transaction_hash,
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

    public getAccountLedgerHistoryPageInfo(
        account: string,
        pageType: number,
        pageSize: number
    ): Promise<IGraphPageInfo> {
        return new Promise<IGraphPageInfo>(async (resolve, reject) => {
            this.queryForMapper("user", "getAccountLedgerHistoryPageInfo", {
                scheme: this.scheme,
                pageSize,
                account,
                pageType,
            })
                .then((result) => {
                    if (result.rows.length > 0) {
                        const m = result.rows[0];
                        return resolve({
                            totalCount: Number(m.totalCount),
                            totalPages: Number(m.totalPages),
                        });
                    } else {
                        return reject(new Error(""));
                    }
                })
                .catch((reason) => {
                    if (reason instanceof Error) return reject(reason);
                    return reject(new Error(reason));
                });
        });
    }

    public getPhoneLedgerHistory(
        phone: string,
        pageNumber: number,
        pageSize: number
    ): Promise<IGraphPhoneLedgerHistoryData[]> {
        return new Promise<IGraphPhoneLedgerHistoryData[]>(async (resolve, reject) => {
            this.queryForMapper("user", "getPhoneLedgerHistory", {
                scheme: this.scheme,
                pageNumber,
                pageSize,
                phone,
            })
                .then((result) => {
                    return resolve(
                        result.rows.map((m) => {
                            return {
                                phone: m.phone,
                                action: m.action,
                                amount: BigNumber.from(m.amount).mul(GraphStorage.AmountUnit),
                                balance: BigNumber.from(m.balance).mul(GraphStorage.AmountUnit),
                                purchaseId: m.purchase_id,
                                shopId: m.shop_id,
                                blockNumber: BigNumber.from(m.block_number),
                                blockTimestamp: BigNumber.from(m.block_timestamp),
                                transactionHash: m.transaction_hash,
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

    public getPhoneLedgerHistoryPageInfo(phone: string, pageSize: number): Promise<IGraphPageInfo> {
        return new Promise<IGraphPageInfo>(async (resolve, reject) => {
            this.queryForMapper("user", "getPhoneLedgerHistoryPageInfo", {
                scheme: this.scheme,
                pageSize,
                phone,
            })
                .then((result) => {
                    if (result.rows.length > 0) {
                        const m = result.rows[0];
                        return resolve({
                            totalCount: Number(m.totalCount),
                            totalPages: Number(m.totalPages),
                        });
                    } else {
                        return reject(new Error(""));
                    }
                })
                .catch((reason) => {
                    if (reason instanceof Error) return reject(reason);
                    return reject(new Error(reason));
                });
        });
    }
}
