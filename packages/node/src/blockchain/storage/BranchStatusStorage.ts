import { NodeStorage } from "../../storage/NodeStorage";
import { BlockElementType, IBlockElement } from "../node/tasks/Types";
import { Block } from "../types";

export enum BranchStatus {
    PROPOSED = 0,
    PROOFED = 1,
    APPROVED = 2,
    EXECUTED = 3,
    FINALIZED = 4,
    CANCELED = 5,
}

export class BranchStatusStorage {
    protected readonly storage: NodeStorage;

    constructor(storage: NodeStorage) {
        this.storage = storage;
    }

    public async setAllInBlock(block: Block, status: BranchStatus) {
        for (let idx = 0; idx < block.purchases.branches.length; idx++) {
            await this.storage.setBranchStatus(block.header.height, BlockElementType.PURCHASE, idx, status);
        }

        for (let idx = 0; idx < block.exchangeRates.branches.length; idx++) {
            await this.storage.setBranchStatus(block.header.height, BlockElementType.EXCHANGE_RATE, idx, status);
        }

        for (let idx = 0; idx < block.burnPoints.branches.length; idx++) {
            await this.storage.setBranchStatus(block.header.height, BlockElementType.BURN_POINT, idx, status);
        }
    }

    public async set(data: IBlockElement, status: BranchStatus) {
        await this.storage.setBranchStatus(data.height, data.type, data.branchIndex, status);
    }

    public async get(data: IBlockElement): Promise<BranchStatus | undefined> {
        return this.storage.getBranchStatus(data.height, data.type, data.branchIndex);
    }
}
