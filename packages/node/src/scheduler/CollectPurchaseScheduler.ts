import "@nomiclabs/hardhat-ethers";
import { Block } from "dms-store-purchase-sdk";
import { StorePurchase } from "../../typechain-types";
import { Config } from "../common/Config";
import { logger } from "../common/Logger";
import { NodeStorage } from "../storage/NodeStorage";
import { ContractPurchaseBlockHeader } from "../types";
import { HTTPClient } from "../utils/HTTPClient";
import { Scheduler } from "./Scheduler";

import * as hre from "hardhat";
import URI from "urijs";

export class CollectPurchaseScheduler extends Scheduler {
    private _config: Config | undefined;
    private _storage: NodeStorage | undefined;
    private _contract: StorePurchase | undefined;
    private _offset = 1n;

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

    private get storage(): NodeStorage {
        if (this._storage !== undefined) return this._storage;
        else {
            logger.error("Storage is not ready yet.");
            process.exit(1);
        }
    }

    public setOption(options: any) {
        if (options) {
            if (options.config && options.config instanceof Config) this._config = options.config;
            if (options.storage && options.storage instanceof NodeStorage) this._storage = options.storage;
        }
    }

    private async getContract(): Promise<StorePurchase> {
        if (this._contract === undefined) {
            const factory = await hre.ethers.getContractFactory("StorePurchase");
            this._contract = factory.attach(this.config.contracts.purchaseAddress);
        }
        return this._contract;
    }

    protected async work() {
        try {
            let latestHeight = (await this.storage.getLatestHeight()) - this._offset;
            if (latestHeight < 0n) latestHeight = 0n;
            this._offset = 0n;
            const header = await this.getBlockHeader(latestHeight + 1n);
            if (header !== undefined) {
                logger.info("CollectPurchaseScheduler");
                logger.info(`${header.height.toString()} - ${header.CID}`);
                const block = await this.getBlock(header.CID);
                if (block !== undefined) {
                    await this.storage.postPurchaseBlock(block);
                }
            }
        } catch (error) {
            logger.error(`Failed to execute the CollectPurchaseScheduler: ${error}`);
        }
    }
    private async getBlockHeader(height: bigint): Promise<ContractPurchaseBlockHeader | undefined> {
        const contract = await this.getContract();
        try {
            const res = await contract.getByHeight(height);

            return {
                height: BigInt(res[0].toString()),
                currentBlockHash: res[1].toString(),
                previousBlockHash: res[2].toString(),
                merkelRootHash: res[3].toString(),
                timestamp: BigInt(res[4].toString()),
                CID: res[5].toString(),
            };
        } catch (error) {
            return undefined;
        }
    }

    private async getBlock(cid: string): Promise<Block | undefined> {
        const url = URI(this.config.setting.ipfs_gateway_url).directory("ipfs").filename(cid).toString();
        const client = new HTTPClient();
        const res = await client.get(url);
        if (res.status === 200) {
            try {
                return Block.reviver("", res.data);
            } catch (error) {
                return undefined;
            }
        } else return undefined;
    }
}
