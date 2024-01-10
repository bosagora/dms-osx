import { ContractUtils } from "../../utils/ContractUtils";
import { BlockElementType, IBlockElementProof } from "../node/tasks";
import { Block, BlockHeader, BurnPointRoot, ExchangeRateRoot, PurchaseRoot } from "../types";

import { HashZero } from "@ethersproject/constants";
import { BlockConfig } from "../node/BlockConfig";

export class BlockStorage {
    private readonly blocks: Block[];
    private latestHeight: bigint;
    private latestTimestamp: bigint;
    private latestHash: string;
    private blockConfig: BlockConfig;

    constructor(blockConfig: BlockConfig) {
        this.blockConfig = blockConfig;
        const genesis = this.createGenesisBlock();
        this.blocks = [genesis];
        this.latestHeight = genesis.header.height;
        this.latestTimestamp = genesis.header.timestamp;
        this.latestHash = genesis.computeHash();
    }

    public save(block: Block) {
        if (block.header.height - this.latestHeight === 1n && block.header.prevBlockHash === this.latestHash) {
            this.blocks.push(block);
            this.latestHeight = block.header.height;
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

    public getLatestBlockHeight(): bigint {
        return this.latestHeight;
    }

    public getLatestBlockHash(): string {
        return this.latestHash;
    }

    public getLatestBlockTimestamp(): bigint {
        return this.latestTimestamp;
    }
    public getLatestBlock(): Block | undefined {
        if (this.blocks.length === 0) return undefined;
        return this.blocks[this.blocks.length - 1];
    }

    public getGenesisBlock(): Block {
        return this.blocks[0];
    }

    public getBlock(height: bigint): Block | undefined {
        return this.blocks.find((m) => m.header.height === height);
    }
}
