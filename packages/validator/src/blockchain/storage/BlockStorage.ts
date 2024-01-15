import { NodeStorage } from "../../storage/NodeStorage";
import { ContractUtils } from "../../utils/ContractUtils";
import { BlockConfig } from "../node/BlockConfig";
import { Block, BlockHeader, BurnPointRoot, ExchangeRateRoot, PurchaseRoot } from "../types";
import { BlockCache } from "./BlockCache";

import { HashZero } from "@ethersproject/constants";

export class BlockStorage {
    protected readonly storage: NodeStorage;
    private latestSlot: bigint;
    private latestTimestamp: bigint;
    private latestHash: string;
    private blockConfig: BlockConfig;
    private blockCache: BlockCache;

    constructor(blockConfig: BlockConfig, storage: NodeStorage) {
        this.blockConfig = blockConfig;
        this.storage = storage;
        this.latestSlot = 0n;
        this.latestTimestamp = this.blockConfig.GENESIS_TIME;
        this.latestHash = HashZero;
        this.blockCache = new BlockCache();
    }

    public async initialize() {
        const block = await this.getLatestBlock(false);
        if (block !== undefined) {
            this.latestSlot = block.header.slot;
            this.latestTimestamp = block.header.timestamp;
            this.latestHash = block.computeHash();
        } else {
            const genesis = this.createGenesisBlock();
            await this.storage.postBlock(genesis);
            this.latestSlot = genesis.header.slot;
            this.latestTimestamp = genesis.header.timestamp;
            this.latestHash = genesis.computeHash();
            this.blockCache.set(genesis);
        }
    }

    public async save(block: Block) {
        if (block.header.slot - this.latestSlot === 1n && block.header.prevBlockHash === this.latestHash) {
            await this.storage.postBlock(block);
            this.latestSlot = block.header.slot;
            this.latestTimestamp = block.header.timestamp;
            this.latestHash = block.computeHash();
            this.blockCache.set(block);
        }
    }

    private createGenesisBlock() {
        const now = ContractUtils.getTimeStampBigInt();
        if (this.blockConfig.GENESIS_TIME < now) {
            this.blockConfig.GENESIS_TIME = now + 10n;
        }
        const genesis = new Block(
            new BlockHeader(HashZero, 0n, this.blockConfig.GENESIS_TIME, HashZero, HashZero, HashZero),
            new PurchaseRoot(),
            new ExchangeRateRoot(),
            new BurnPointRoot()
        );
        return genesis;
    }

    public getLatestSlot(): bigint {
        return this.latestSlot;
    }

    public getLatestBlockHash(): string {
        return this.latestHash;
    }

    public getLatestBlockTimestamp(): bigint {
        return this.latestTimestamp;
    }
    public async getLatestBlock(useCache: boolean = true): Promise<Block | undefined> {
        if (useCache) {
            return this.getBlock(this.latestSlot);
        }
        try {
            const block = await this.storage.getLatestBlock();
            if (block !== undefined) this.blockCache.set(block);
            return block;
        } catch (e) {
            return undefined;
        }
    }

    public async getGenesisBlock(): Promise<Block | undefined> {
        return this.getBlock(0n);
    }

    public async getBlock(slot: bigint): Promise<Block | undefined> {
        try {
            let block = this.blockCache.get(slot);
            if (block !== undefined) {
                return block;
            } else {
                block = await this.storage.getBlock(slot);
                if (block !== undefined) this.blockCache.set(block);
                return block;
            }
        } catch (e) {
            return undefined;
        }
    }
}
