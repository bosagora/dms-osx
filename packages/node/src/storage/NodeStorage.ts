import { Block as PurchaseBlock, hashFull, NewTransaction, Transaction, TransactionType } from "dms-store-purchase-sdk";
import { IDatabaseConfig } from "../common/Config";
import { IExchangeRate } from "../types";
import { ContractUtils } from "../utils/ContractUtils";
import { Utils } from "../utils/Utils";
import { Storage } from "./Storage";

import { Block } from "../blockchain/types/Block";

import MybatisMapper from "mybatis-mapper";

import path from "path";

/**
 * The class that inserts and reads the ledger into the database.
 */
export class NodeStorage extends Storage {
    constructor(databaseConfig: IDatabaseConfig, callback: (err: Error | null) => void) {
        super(databaseConfig, callback);
        MybatisMapper.createMapper([path.resolve(Utils.getInitCWD(), "src/storage/mapper/table.xml")]);
        MybatisMapper.createMapper([path.resolve(Utils.getInitCWD(), "src/storage/mapper/purchase_blocks.xml")]);
        MybatisMapper.createMapper([path.resolve(Utils.getInitCWD(), "src/storage/mapper/exchange_rates.xml")]);
        MybatisMapper.createMapper([path.resolve(Utils.getInitCWD(), "src/storage/mapper/dms_blocks.xml")]);
        this.createTables()
            .then(() => {
                if (callback != null) callback(null);
            })
            .catch((err: any) => {
                if (callback != null) callback(err);
            });
    }

    public static make(databaseConfig: IDatabaseConfig): Promise<NodeStorage> {
        return new Promise<NodeStorage>((resolve, reject) => {
            const result = new NodeStorage(databaseConfig, (err: Error | null) => {
                if (err) reject(err);
                else resolve(result);
            });
            return result;
        });
    }

    public createTables(): Promise<any> {
        return this.queryForMapper("table", "create_table", {});
    }

    public async clearTestDB(): Promise<any> {
        await this.queryForMapper("table", "clear_table", {});
    }

    public async dropTestDB(): Promise<any> {
        await this.queryForMapper("table", "drop_table", {});
    }

    /// region Purchases PurchaseBlock
    public async getLatestHeight(): Promise<bigint> {
        const res = await this.queryForMapper("purchase_blocks", "getLatestHeight", {});
        if (res.rows.length > 0) {
            return BigInt(res.rows[0].height);
        } else {
            return 0n;
        }
    }

    public async postPurchaseBlock(block: PurchaseBlock) {
        const hash = hashFull(block.header);
        await this.queryForMapper("purchase_blocks", "postBlock", {
            height: block.header.height.toString(),
            curBlock: hash.toString(),
            prevBlock: block.header.prevBlock.toString(),
            merkleRoot: block.header.merkleRoot.toString(),
            timestamp: block.header.timestamp.toString(),
        });
        await this.postNewPurchases(
            block,
            block.txs.filter((m) => m.type === TransactionType.NEW)
        );
        await this.postCancelPurchases(
            block,
            block.txs.filter((m) => m.type === TransactionType.CANCEL)
        );
    }

    public async postNewPurchases(block: PurchaseBlock, txs: Transaction[]) {
        if (txs.length === 0) return;
        const pageSize = 16;
        const maxPage = Math.ceil(txs.length / pageSize);

        for (let pageIndex = 1; pageIndex <= maxPage; pageIndex++) {
            const purchases = [];
            for (let idx = (pageIndex - 1) * pageSize; idx < pageIndex * pageSize && idx < txs.length; idx++) {
                purchases.push(txs[idx]);
            }
            if (purchases.length > 0) {
                await this.queryForMapper("purchase_blocks", "postTransactions", {
                    purchases: purchases.map((purchase) => {
                        return {
                            purchaseId: purchase.purchaseId.toString(),
                            timestamp: purchase.timestamp.toString(),
                            height: block.header.height.toString(),
                            hash: hashFull(purchase).toString(),
                            contents: JSON.stringify(purchase.toJSON()),
                        };
                    }) as any,
                });
            }
        }
    }

    public async postCancelPurchases(block: PurchaseBlock, txs: Transaction[]) {
        for (const tx of txs) {
            await this.queryForMapper("purchases", "canceledTransaction", {
                purchaseId: tx.purchaseId,
            });
        }
    }

    public async updateStep(purchaseIds: string[], step: number) {
        await this.queryForMapper("purchase_blocks", "updateStep", {
            purchaseIds,
            step,
        });
    }

    public async getPurchaseTransaction(waiting: number): Promise<NewTransaction[]> {
        const res = await this.queryForMapper("purchase_blocks", "getTransaction", {
            timestamp: (ContractUtils.getTimeStampBigInt() - BigInt(waiting)).toString(),
        });
        return res.rows.map((m) => {
            return NewTransaction.reviver("", JSON.parse(m.contents.replace(/[\\]/gi, "")));
        });
    }
    /// endregion

    /// region Exchange Rate
    public async postExchangeRate(rates: IExchangeRate[]) {
        await this.queryForMapper("exchange_rates", "postExchangeRates", {
            rates: rates.map((m) => {
                return {
                    symbol: m.symbol,
                    rate: m.rate.toString(),
                };
            }) as any,
        });
    }

    public async getExchangeRate(): Promise<IExchangeRate[]> {
        const res = await this.queryForMapper("exchange_rates", "getExchangeRate", {});
        return res.rows.map((m) => {
            return {
                symbol: m.symbol,
                rate: BigInt(m.rate),
            };
        });
    }

    /// endregion

    /// region DMS PurchaseBlock
    public async postBlock(block: Block) {
        await this.queryForMapper("dms_blocks", "postBlock", {
            height: block.header.height.toString(),
            contents: JSON.stringify(block.toJSON()),
        });
    }

    public async getBlock(height: bigint): Promise<Block | undefined> {
        const res = await this.queryForMapper("dms_blocks", "getBlock", { height: height.toString() });
        if (res.rows.length > 0) {
            return Block.reviver("", JSON.parse(res.rows[0].contents.replace(/[\\]/gi, "")));
        } else {
            return undefined;
        }
    }

    public async getLatestBlock(): Promise<Block | undefined> {
        const res = await this.queryForMapper("dms_blocks", "getLatestBlock", {});
        if (res.rows.length > 0) {
            return Block.reviver("", JSON.parse(res.rows[0].contents.replace(/[\\]/gi, "")));
        } else {
            return undefined;
        }
    }
    /// endregion
}
