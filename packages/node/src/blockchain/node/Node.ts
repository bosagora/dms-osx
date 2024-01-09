import { Config } from "../../common/Config";
import { NodeStorage } from "../../storage/NodeStorage";
import { Event, EventDispatcher } from "../event/EventDispatcher";
import { BlockStorage } from "../storage/BlockStorage";
import { BranchStatus, BranchStatusStorage } from "../storage/BranchStatusStorage";
import { SignatureStorage } from "../storage/SignatureStorage";
import { Block } from "../types";
import { BlockConfig } from "./BlockConfig";

import {
    Attestation,
    Execution,
    Finalization,
    IBlockElement,
    IBlockElementProof,
    NodeTask,
    Proposal,
    Synchronization,
    Verification,
} from "./tasks";

export class Node extends EventDispatcher {
    protected readonly config: Config;
    protected readonly storage: NodeStorage;
    public blockStorage: BlockStorage;
    public signatureStorage: SignatureStorage;
    public branchStatusStorage: BranchStatusStorage;
    public blockConfig: BlockConfig;

    private readonly tasks: NodeTask[];

    constructor(config: Config, storage: NodeStorage) {
        super();
        this.config = config;
        this.storage = storage;
        this.blockConfig = new BlockConfig(
            this.config.setting.GENESIS_TIME,
            this.config.setting.SECONDS_PER_BLOCK,
            this.config.setting.waitedProvide
        );
        this.blockStorage = new BlockStorage(this.blockConfig);
        this.signatureStorage = new SignatureStorage();
        this.branchStatusStorage = new BranchStatusStorage();
        this.tasks = [];

        this.tasks.push(new Proposal(this.config, this.storage, this));
        this.tasks.push(new Attestation(this.config, this.storage, this));
        this.tasks.push(new Verification(this.config, this.storage, this));
        this.tasks.push(new Execution(this.config, this.storage, this));
        this.tasks.push(new Finalization(this.config, this.storage, this));
        this.tasks.push(new Synchronization(this.config, this.storage, this));
    }

    public async proposed(block: Block) {
        if (
            block.header.height === this.blockStorage.getLatestBlockHeight() + 1n &&
            block.header.prevBlockHash === this.blockStorage.getLatestBlockHash()
        ) {
            this.blockStorage.save(block);
            this.branchStatusStorage.setAllInBlock(block, BranchStatus.PROPOSED);
            await this.dispatchEvent(Event.PROPOSED, block);
        }
    }

    public async proofed(data: IBlockElementProof) {
        this.signatureStorage.save(data.height, data.type, { index: data.branch, signature: data.signature });
        this.branchStatusStorage.set(data, BranchStatus.PROOFED);
        await this.dispatchEvent(Event.PROOFED, data);
    }

    public async proofedBlock(proofs: IBlockElementProof[], block: Block) {
        for (const elem of proofs) {
            this.signatureStorage.save(elem.height, elem.type, { index: elem.branch, signature: elem.signature });
            this.branchStatusStorage.set(elem, BranchStatus.PROOFED);
        }
        await this.dispatchEvent(Event.PROOFED_BLOCK, block);
    }

    public async approved(data: IBlockElement) {
        this.branchStatusStorage.set(data, BranchStatus.APPROVED);
        await this.dispatchEvent(Event.APPROVED, data);
    }

    public async executed(data: IBlockElement) {
        this.branchStatusStorage.set(data, BranchStatus.EXECUTED);
        await this.dispatchEvent(Event.EXECUTED, data);
    }

    public async finalized(data: IBlockElement) {
        this.branchStatusStorage.set(data, BranchStatus.FINALIZED);
        await this.dispatchEvent(Event.FINALIZED, data);
    }

    public async canceled(data: IBlockElement) {
        this.branchStatusStorage.set(data, BranchStatus.CANCELED);
        await this.dispatchEvent(Event.CANCELED, data);
    }

    public getExpectedHeight(timestamp: bigint): bigint {
        return (timestamp - BigInt(this.blockConfig.GENESIS_TIME)) / BigInt(this.blockConfig.SECONDS_PER_BLOCK);
    }

    public getLatestBlockHeight(): bigint {
        return this.blockStorage.getLatestBlockHeight();
    }

    public getLatestBlockHash(): string {
        return this.blockStorage.getLatestBlockHash();
    }

    public getLatestBlockTimestamp(): bigint {
        return this.blockStorage.getLatestBlockTimestamp();
    }

    public getLatestBlock(): Block | undefined {
        return this.blockStorage.getLatestBlock();
    }

    public getGenesisBlock(): Block {
        return this.blockStorage.getGenesisBlock();
    }

    public getBlock(height: bigint): Block | undefined {
        return this.blockStorage.getBlock(height);
    }

    public async work() {
        await this.dispatcher();

        for (const task of this.tasks) await task.work();
    }
}
