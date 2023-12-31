import { ContractUtils } from "../utils/ContractUtils";
import { Block } from "./Block";
import { BlockHeader } from "./BlockHeader";
import { BurnPointRoot } from "./BurnPoint";
import { ExchangeRateRoot } from "./ExchangeRate";
import { PurchaseRoot } from "./Purchase";

import { HashZero } from "@ethersproject/constants";

export class BlockStorage {
    private readonly blocks: Block[];
    private latestHeight: bigint;
    private latestTimestamp: bigint;
    private latestHash: string;

    constructor() {
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
        const genesis = new Block(
            new BlockHeader(HashZero, 0n, BigInt(ContractUtils.getTimeStamp()), HashZero, HashZero, HashZero),
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
}
