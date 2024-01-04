import { Block, hashFull, NewTransaction, Transaction, TransactionType } from "dms-store-purchase-sdk";
import { IDatabaseConfig } from "../common/Config";
import { Utils } from "../utils/Utils";
import { Storage } from "./Storage";
import { logger } from "../common/Logger";

import MybatisMapper from "mybatis-mapper";

import path from "path";
import { IExchangeRate } from "../types";
import { ContractUtils } from "../utils/ContractUtils";
import { BigNumber } from "ethers";

/**
 * The class that inserts and reads the ledger into the database.
 */
export class NodeStorage extends Storage {
    constructor(databaseConfig: IDatabaseConfig, callback: (err: Error | null) => void) {
        super(databaseConfig, callback);
        MybatisMapper.createMapper([path.resolve(Utils.getInitCWD(), "src/storage/mapper/table.xml")]);
        MybatisMapper.createMapper([path.resolve(Utils.getInitCWD(), "src/storage/mapper/purchase_blocks.xml")]);
        MybatisMapper.createMapper([path.resolve(Utils.getInitCWD(), "src/storage/mapper/exchange_rates.xml")]);
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

    public async dropTestDB(): Promise<any> {
        await this.queryForMapper("table", "drop_table", {});
    }

    /// region Purchases Block
    public async getLatestHeight(): Promise<bigint> {
        const res = await this.queryForMapper("purchase_blocks", "getLatestHeight", {});
        if (res.rows.length > 0) {
            return BigInt(res.rows[0].height);
        } else {
            return 0n;
        }
    }

    public async postPurchaseBlock(block: Block) {
        const hash = hashFull(block.header);
        await this.queryForMapper("purchase_blocks", "postBlock", {
            height: block.header.height.toString(),
            curBlock: hash.toString(),
            prevBlock: block.header.prevBlock.toString(),
            merkleRoot: block.header.merkleRoot.toString(),
            timestamp: block.header.timestamp,
        });
        for (const tx of block.txs) {
            await this.postPurchaseTransaction(block, tx);
        }
    }

    public async postPurchaseTransaction(block: Block, tx: Transaction) {
        if (tx.type === TransactionType.NEW) {
            const hash = hashFull(tx);
            await this.queryForMapper("purchase_blocks", "postTransaction", {
                purchaseId: tx.purchaseId,
                timestamp: tx.timestamp,
                height: block.header.height.toString(),
                hash: hash.toString(),
                contents: JSON.stringify(tx.toJSON()),
            });
        } else {
            await this.queryForMapper("purchases", "canceledTransaction", {
                purchaseId: tx.purchaseId,
            });
        }
    }

    public async canceledTransaction(purchaseId: string) {
        await this.queryForMapper("purchase_blocks", "canceledTransaction", {
            purchaseId: purchaseId,
        });
    }

    public async storedTransaction(purchaseIds: string[]) {
        await this.queryForMapper("purchase_blocks", "storedTransaction", {
            purchaseIds: purchaseIds,
        });
    }

    public async getPurchaseTransaction(waiting: number): Promise<NewTransaction[]> {
        const res = await this.queryForMapper("purchase_blocks", "getTransaction", {
            timestamp: ContractUtils.getTimeStamp() - waiting,
        });
        return res.rows.map((m) => {
            return NewTransaction.reviver("", JSON.parse(m.contents.replace(/[\\]/gi, "")));
        });
    }
    /// endregion

    /// region Exchange Rate
    public async postExchangeRate(rates: IExchangeRate[]) {
        for (const elem of rates) {
            await this.queryForMapper("exchange_rates", "postExchangeRate", {
                symbol: elem.symbol,
                rate: elem.rate.toString(),
            });
        }
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
    ///
}
