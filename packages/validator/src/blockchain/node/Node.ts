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

import * as assert from "assert";

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
            this.config.setting.SECONDS_PER_SLOT,
            this.config.setting.SLOTS_PER_EPOCH,
            this.config.setting.waitedProvide
        );
        this.blockStorage = new BlockStorage(this.blockConfig, this.storage);
        this.signatureStorage = new SignatureStorage(this.storage);
        this.branchStatusStorage = new BranchStatusStorage(this.storage);
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
            block.header.slot === this.blockStorage.getLatestSlot() + 1n &&
            block.header.prevBlockHash === this.blockStorage.getLatestBlockHash()
        ) {
            await this.blockStorage.save(block);
            await this.branchStatusStorage.setAllInBlock(block, BranchStatus.PROPOSED);
            await this.dispatchEvent(Event.PROPOSED, block);
        }
    }

    public async proofed(data: IBlockElementProof) {
        await this.signatureStorage.save(data.slot, data.type, {
            branchIndex: data.branchIndex,
            account: data.account,
            signature: data.signature,
        });
        await this.branchStatusStorage.set(data, BranchStatus.PROOFED);
        await this.dispatchEvent(Event.PROOFED, data);
    }

    public async proofedBlock(proofs: IBlockElementProof[], block: Block) {
        for (const elem of proofs) {
            await this.signatureStorage.save(elem.slot, elem.type, {
                branchIndex: elem.branchIndex,
                account: elem.account,
                signature: elem.signature,
            });
            await this.branchStatusStorage.set(elem, BranchStatus.PROOFED);
        }
        await this.dispatchEvent(Event.PROOFED_BLOCK, block);
    }

    public async approved(data: IBlockElement) {
        await this.branchStatusStorage.set(data, BranchStatus.APPROVED);
        await this.dispatchEvent(Event.APPROVED, data);
    }

    public async executed(data: IBlockElement) {
        await this.branchStatusStorage.set(data, BranchStatus.EXECUTED);
        await this.dispatchEvent(Event.EXECUTED, data);
    }

    public async finalized(data: IBlockElement) {
        await this.branchStatusStorage.set(data, BranchStatus.FINALIZED);
        await this.dispatchEvent(Event.FINALIZED, data);
    }

    public async canceled(data: IBlockElement) {
        await this.branchStatusStorage.set(data, BranchStatus.CANCELED);
        await this.dispatchEvent(Event.CANCELED, data);
    }

    public getExpectedSlot(timestamp: bigint): bigint {
        return (timestamp - BigInt(this.blockConfig.GENESIS_TIME)) / BigInt(this.blockConfig.SECONDS_PER_SLOT);
    }

    public getLatestSlot(): bigint {
        return this.blockStorage.getLatestSlot();
    }

    public getLatestBlockHash(): string {
        return this.blockStorage.getLatestBlockHash();
    }

    public getLatestBlockTimestamp(): bigint {
        return this.blockStorage.getLatestBlockTimestamp();
    }

    public async getLatestBlock(): Promise<Block | undefined> {
        return this.blockStorage.getLatestBlock();
    }

    public async getGenesisBlock(): Promise<Block | undefined> {
        return this.blockStorage.getGenesisBlock();
    }

    public async getBlock(slot: bigint): Promise<Block | undefined> {
        return this.blockStorage.getBlock(slot);
    }

    public async onStart() {
        await this.blockStorage.initialize();
    }

    public async work() {
        await this.dispatcher();

        for (const task of this.tasks) await task.work();
    }
}
