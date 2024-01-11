import { NodeStorage } from "../../storage/NodeStorage";
import { ContractUtils } from "../../utils/ContractUtils";
import { BlockConfig } from "../node/BlockConfig";
import { Block, BlockHeader, BurnPointRoot, ExchangeRateRoot, PurchaseRoot } from "../types";

import { HashZero } from "@ethersproject/constants";

export class BlockStorage {
    protected readonly storage: NodeStorage;
    private latestSlot: bigint;
    private latestTimestamp: bigint;
    private latestHash: string;
    private blockConfig: BlockConfig;

    constructor(blockConfig: BlockConfig, storage: NodeStorage) {
        this.blockConfig = blockConfig;
        this.storage = storage;
        this.latestSlot = 0n;
        this.latestTimestamp = this.blockConfig.GENESIS_TIME;
        this.latestHash = HashZero;
    }

    public async initialize() {
        let genesis = await this.getGenesisBlock();
        if (genesis === undefined) {
            genesis = this.createGenesisBlock();
            await this.storage.postBlock(genesis);
        }
        this.latestSlot = genesis.header.slot;
        this.latestTimestamp = genesis.header.timestamp;
        this.latestHash = genesis.computeHash();
    }

    public async save(block: Block) {
        if (block.header.slot - this.latestSlot === 1n && block.header.prevBlockHash === this.latestHash) {
            await this.storage.postBlock(block);
            this.latestSlot = block.header.slot;
            this.latestTimestamp = block.header.timestamp;
            this.latestHash = block.computeHash();
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
    public getLatestBlock(): Promise<Block | undefined> {
        try {
            return this.storage.getLatestBlock();
        } catch (e) {
            return Promise.resolve(undefined);
        }
    }

    public getGenesisBlock(): Promise<Block | undefined> {
        try {
            return this.storage.getBlock(0n);
        } catch (e) {
            return Promise.resolve(undefined);
        }
    }

    public getBlock(slot: bigint): Promise<Block | undefined> {
        try {
            return this.storage.getBlock(slot);
        } catch (e) {
            return Promise.resolve(undefined);
        }
    }
}
